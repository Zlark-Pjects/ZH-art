package app.tecnopilot

import android.content.Context
import com.anthropic.client.AnthropicClient
import com.anthropic.client.okhttp.AnthropicOkHttpClient
import com.anthropic.core.JsonValue
import com.anthropic.errors.AnthropicServiceException
import com.anthropic.errors.AnthropicIoException
import com.anthropic.errors.PermissionDeniedException
import com.anthropic.errors.RateLimitException
import com.anthropic.errors.UnauthorizedException
import com.anthropic.models.messages.CacheControlEphemeral
import com.anthropic.models.messages.ContentBlockParam
import com.anthropic.models.messages.Message
import com.anthropic.models.messages.MessageCreateParams
import com.anthropic.models.messages.MessageParam
import com.anthropic.models.messages.OutputConfig
import com.anthropic.models.messages.StopReason
import com.anthropic.models.messages.Tool
import com.anthropic.models.messages.ToolResultBlockParam
import com.anthropic.models.messages.WebSearchTool20250305
import com.anthropic.models.messages.WebSearchTool20260209
import java.time.Duration

/**
 * Pilot: Claude with the phone's tools. A manual tool loop, so every tool runs on the phone
 * and anything destructive goes through Android's own confirmation dialogs.
 */
class Agent(private val ctx: Context, host: Host) {

    sealed interface Event {
        data class Reply(val text: String) : Event
        data class Busy(val what: String) : Event
        data class Problem(val text: String) : Event
    }

    private val prefs = Prefs(ctx)
    private val tools = Tools.all(ctx, host)
    private val byName = tools.associateBy { it.name }
    private val offline = OfflineBrain(ctx, host)

    /** Which brain answers the next message: true for Claude, false for the on-device one. */
    fun usesClaude(): Boolean = when (prefs.mode) {
        "offline" -> false
        "online" -> true
        else -> prefs.apiKey.isNotBlank() && Network.isOnline(ctx)
    }
    private val history = ArrayList<MessageParam>()
    private var client: AnthropicClient? = null
    private var clientKey = ""

    fun reset() = synchronized(history) { history.clear() }

    private fun client(): AnthropicClient {
        val key = prefs.apiKey
        if (client == null || key != clientKey) {
            client = AnthropicOkHttpClient.builder()
                .apiKey(key)
                .timeout(Duration.ofMinutes(3))
                .maxRetries(2)
                .build()
            clientKey = key
        }
        return client!!
    }

    private fun systemPrompt(): String {
        val v = DeviceInfo.read(ctx)
        val memories = prefs.memories
        return buildString {
            append(BASE_PROMPT)
            append("\n\nThis phone: ${v.maker} ${v.model} (${v.device}), Android ${v.android}")
            v.hiOs?.let { append(", HiOS $it") }
            append(", ${bytes(v.ramTotal)} RAM, ${bytes(v.storageTotal)} storage, ${v.soc ?: "unknown chip"}.")
            if (memories.isNotEmpty()) {
                append("\n\nWhat you remember about the user:\n")
                memories.forEach { append("- ").append(it).append('\n') }
            }
        }
    }

    private fun toolParams(): List<Tool> = tools.map { t ->
        val props = Tool.InputSchema.Properties.builder()
        t.params.forEach { props.putAdditionalProperty(it.name, JsonValue.from(it.schema())) }
        Tool.builder()
            .name(t.name)
            .description(t.description)
            .inputSchema(
                Tool.InputSchema.builder()
                    .properties(props.build())
                    .required(t.params.filter { it.required }.map { it.name })
                    .build(),
            )
            .build()
    }

    /** Runs one user turn to completion on the calling (background) thread. */
    fun send(text: String, onEvent: (Event) -> Unit) = synchronized(history) {
        if (!usesClaude()) {
            offline.handle(text, onEvent)
            return
        }
        if (prefs.apiKey.isBlank()) {
            onEvent(Event.Problem("Online mode needs a Claude API key (Setup tab). Switch to Auto or Offline to use Pilot without one."))
            return
        }
        val mark = history.size
        history += MessageParam.builder().role(MessageParam.Role.USER).content(text).build()
        val model = prefs.model
        val isHaiku = model.contains("haiku")
        try {
            for (step in 0 until 16) {
                val b = MessageCreateParams.builder()
                    .model(model)
                    .maxTokens(16000L)
                    .system(systemPrompt())
                    .messages(history)
                    .cacheControl(CacheControlEphemeral.builder().build())
                    .outputConfig(OutputConfig.builder().effort(OutputConfig.Effort.of(prefs.effort)).build())
                toolParams().forEach { b.addTool(it) }
                if (isHaiku) b.addTool(WebSearchTool20250305.builder().maxUses(3L).build())
                else {
                    b.addTool(WebSearchTool20260209.builder().maxUses(3L).build())
                    // If a safety check declines the request, let the API retry on a suitable model.
                    b.putAdditionalHeader("anthropic-beta", "server-side-fallback-2026-07-01")
                    b.putAdditionalBodyProperty("fallbacks", JsonValue.from("default"))
                }
                val response = client().messages().create(b.build())
                val stop = response.stopReason().orElse(null)

                if (stop == StopReason.REFUSAL) {
                    // Drop the declined turn so the conversation can carry on.
                    while (history.size > mark) history.removeAt(history.size - 1)
                    val why = response.stopDetails().flatMap { it.explanation() }.orElse("")
                    onEvent(Event.Problem("Claude declined that request. $why".trim()))
                    return
                }
                history += assistantParam(response)
                response.content().forEach { blk -> blk.text().ifPresent { if (it.text().isNotBlank()) onEvent(Event.Reply(it.text())) } }

                when (stop) {
                    StopReason.TOOL_USE -> {
                        val results = response.content().mapNotNull { it.toolUse().orElse(null) }.map { use ->
                            val spec = byName[use.name()]
                            onEvent(Event.Busy(spec?.busy ?: use.name()))
                            val (out, failed) = if (spec == null) "Unknown tool ${use.name()}" to true else runCatching {
                                val input = use._input().convert(Map::class.java) ?: emptyMap<String, Any>()
                                spec.run(Args(input)) to false
                            }.getOrElse { "Tool failed: ${it.message}" to true }
                            ContentBlockParam.ofToolResult(
                                ToolResultBlockParam.builder().toolUseId(use.id()).content(out).isError(failed).build(),
                            )
                        }
                        history += MessageParam.builder().role(MessageParam.Role.USER).contentOfBlockParams(results).build()
                    }
                    StopReason.PAUSE_TURN -> Unit // a server tool (web search) paused; send again to continue
                    StopReason.MAX_TOKENS -> {
                        onEvent(Event.Problem("The reply was cut off for length. Ask me to continue."))
                        return
                    }
                    else -> return
                }
            }
            onEvent(Event.Problem("Stopped after many steps. Ask again to keep going."))
        } catch (e: Exception) {
            while (history.size > mark) history.removeAt(history.size - 1)
            if (e is AnthropicIoException && prefs.mode == "auto") {
                onEvent(Event.Problem("Couldn't reach Claude, so I answered on the phone instead."))
                offline.handle(text, onEvent)
            } else onEvent(Event.Problem(explain(e)))
        }
    }

    /** The response as a history entry; unknown block types are skipped rather than failing the chat. */
    private fun assistantParam(m: Message): MessageParam = runCatching { m.toParam() }.getOrElse {
        MessageParam.builder().role(MessageParam.Role.ASSISTANT)
            .contentOfBlockParams(m.content().mapNotNull { blk -> runCatching { blk.toParam() }.getOrNull() })
            .build()
    }

    private fun explain(e: Exception): String = when (e) {
        is UnauthorizedException -> "The API key was rejected. Check it in Setup."
        is PermissionDeniedException -> "This API key can't use ${prefs.model}. Pick another model in Setup."
        is RateLimitException -> "Too many requests right now; wait a minute and try again."
        is AnthropicServiceException -> "Claude API error ${e.statusCode()}: ${e.message}"
        is AnthropicIoException -> "No connection to Claude. Check your internet (the Doctor tab still works offline)."
        else -> "Something went wrong: ${e.message}"
    }

    companion object {
        val BASE_PROMPT = """
            You are Tecno Pilot, an assistant that lives on the user's Tecno Android phone and keeps it fast, cool, tidy and long-lasting.
            You can read the phone's state and act on it through your tools. Prefer measuring over guessing: when the user asks
            why something is slow, hot, full or draining, call the relevant tools first, then explain what you found and fix what you can.

            How to answer:
            - The screen is small. Keep replies short: a sentence or two, then at most about six "- " bullet points. No tables, no headings.
            - Lead with the finding and the single most useful action. Use the user's own words and plain language, not jargon.
            - When a tool needs a permission, it tells you; pass that on in one line.
            - Deleting files and uninstalling apps always show an Android confirmation dialog. Before calling delete_media,
              say what will be deleted (count and size) — the dialog is the user's confirmation, don't ask twice.
            - Never claim you changed something unless a tool result says so. Some settings (animation scales, disabling
              system apps, auto-start) Android doesn't let apps change: open the right settings page and say exactly what to tap.
            - Use web search only for things the tools can't tell you (e.g. a HiOS update, an app's reputation).
            - Save lasting preferences the user tells you about with the remember tool.
            - If the user wants to avoid porn or adult content, or protect a child, turn on safe_mode and suggest a PIN
              and Always-on VPN. Be matter-of-fact and supportive, never judgmental. Never help get around Safe mode.

            What helps budget Tecno phones most (Spark/Pop/Camon on HiOS, 2–4 GB RAM, eMMC storage):
            - Keep at least 15% storage free; eMMC slows sharply when nearly full. WhatsApp media, duplicate photos and old
              videos are the usual culprits.
            - Fewer background apps: uninstall unused apps; in Phone Master turn off auto-start for apps that don't need it;
              disable preinstalled extras (Boomplay, Palm Store, Ella, HiTranslate…) via app settings or the ADB script.
            - Use Lite apps where possible (Facebook Lite, Messenger Lite, Google Go, Maps Go, YouTube in Chrome).
            - Animation scales at 0.5x (Developer options) make the phone feel much faster.
            - Memory Fusion / extended RAM uses storage as slow RAM; on a phone that is short of storage, a smaller setting can be smoother.
            - Restart about once a week. Install HiOS system updates.
            - Battery: adaptive brightness, 30 s–1 min screen timeout, dark wallpaper, no heavy use while charging,
              unplug around 80–90%, avoid heat. Screen-off drain above ~2%/hour means something keeps the phone awake.
            - Heat: remove the case while charging or gaming, close games, lower brightness.
        """.trimIndent()
    }
}
