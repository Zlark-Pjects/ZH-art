package app.tecnopilot

import android.content.Context
import java.util.Calendar

/**
 * Pilot without internet: understands everyday phone requests on the device and runs the same
 * tools Claude would. No API key, no data leaves the phone. Several requests can be combined:
 * "brightness 20%, do not disturb on and alarm at 6:30".
 */
class OfflineBrain(private val ctx: Context, host: Host) {

    private val tools = Tools.all(ctx, host).associateBy { it.name }

    /** Ids from the last scan, so "delete them" works right after "old screenshots". */
    private var lastIds: List<Long> = emptyList()

    private class Step(val tool: String, val args: Map<String, Any?> = emptyMap(), val title: String? = null)

    fun handle(message: String, onEvent: (Agent.Event) -> Unit) {
        val text = message.trim()
        val lower = text.lowercase()
        if (lower.startsWith("here is")) {
            onEvent(Agent.Event.Reply(
                "I'm offline, so I can't talk the report through, but every issue in Doctor has its fix written next to it, " +
                    "and the Fix buttons open the right settings page. Ask me again when you're online for a full explanation.",
            ))
            return
        }
        val steps = plan(lower, text)
        if (steps.isEmpty()) {
            onEvent(Agent.Event.Reply(HELP))
            return
        }
        for (s in steps.distinctBy { it.tool + it.args }) {
            val spec = tools[s.tool] ?: continue
            onEvent(Agent.Event.Busy(spec.busy))
            val out = if (s.tool == "phone_checkup") checkupSummary()
            else runCatching { spec.run(Args(s.args)) }.getOrElse { "That didn't work: ${it.message}" }
            var found = false
            if (s.tool.startsWith("find_")) {
                val ids = Regex("ids: ([\\d,]+)").find(out)?.groupValues?.get(1)?.split(',')?.mapNotNull { it.toLongOrNull() }
                    ?: Regex("#(\\d+)").findAll(out).map { it.groupValues[1].toLong() }.toList()
                if (ids.isNotEmpty()) { lastIds = ids; found = true }
            }
            val tail = if (found) "\n\nSay \"delete them\" to remove these (you'll confirm on screen)." else ""
            onEvent(Agent.Event.Reply((s.title?.let { "**$it**\n$out" } ?: out) + tail))
        }
    }

    private fun checkupSummary(): String {
        val r = Checkup.run(ctx)
        return buildString {
            appendLine("Health score: **${r.score}/100**")
            if (r.issues.isEmpty()) append("No problems found. 🎉")
            r.issues.take(8).forEach { appendLine("- **${it.title}**: ${it.detail}") }
        }.trimEnd()
    }

    // ---- understanding ----------------------------------------------------------------------

    private fun plan(lower: String, original: String): List<Step> {
        // Reminders keep their whole text ("remind me to buy milk and eggs in 2 hours").
        if (Regex("\\bremind me\\b").containsMatchIn(lower)) return listOfNotNull(reminder(lower, original))
        Regex("^remember( that)?\\s+(.+)", RegexOption.IGNORE_CASE).find(original.trim())?.let {
            return listOf(Step("remember", mapOf("fact" to it.groupValues[2])))
        }
        if (Regex("\\b(forget|delete) (everything|all) (you know|about me)").containsMatchIn(lower)) {
            return listOf(Step("forget", mapOf("match" to "everything")))
        }
        if (Regex("\\b(delete|remove|bin|trash)\\b").containsMatchIn(lower) && !Regex("\\b(apps?|duplicates?|screenshots?)\\b").containsMatchIn(lower)) {
            val ids = Regex("#?(\\d+)").findAll(lower).map { it.groupValues[1].toLong() }.toList()
            when {
                ids.isNotEmpty() -> return listOf(Step("delete_media", mapOf("ids" to ids)))
                lastIds.isNotEmpty() && Regex("\\b(them|those|these|all|it)\\b").containsMatchIn(lower) ->
                    return listOf(Step("delete_media", mapOf("ids" to lastIds)))
            }
        }
        if (Regex("\\b(night mode|bedtime|going to (bed|sleep)|good ?night)\\b").containsMatchIn(lower)) {
            val steps = mutableListOf(
                Step("set_brightness", mapOf("percent" to 10)),
                Step("do_not_disturb", mapOf("on" to true)),
            )
            alarmTime(lower)?.let { (h, m) -> steps += Step("set_alarm", mapOf("hour" to h, "minute" to m)) }
            return steps
        }
        val clauses = lower.split(Regex("\\s*(?:,|;|\\band then\\b|\\bthen\\b|\\band\\b|\\balso\\b|\\bplus\\b)\\s*"))
            .filter { it.isNotBlank() }
        val steps = clauses.flatMap { action(it) }.toMutableList()
        if (steps.isEmpty()) report(lower)?.let { steps += it }
        return steps
    }

    /** Commands that change something. A clause can produce at most one. */
    private fun action(c: String): List<Step> {
        val on = !Regex("\\b(off|disable|stop|deactivate)\\b").containsMatchIn(c)
        val num = Regex("(\\d{1,3})\\s*(%|percent)?").find(c)?.groupValues?.get(1)?.toIntOrNull()

        if (Regex("\\b(flash ?light|torch)\\b").containsMatchIn(c)) return listOf(Step("flashlight", mapOf("on" to on)))

        if (Regex("\\b(do not disturb|dnd)\\b").containsMatchIn(c)) return listOf(Step("do_not_disturb", mapOf("on" to on)))

        if (Regex("\\bbright(ness|er)?\\b|\\bdim(mer)?\\b|\\bdarker\\b").containsMatchIn(c)) {
            return listOf(when {
                Regex("\\b(auto|adaptive)\\b").containsMatchIn(c) -> Step("set_brightness", mapOf("auto" to true))
                num != null -> Step("set_brightness", mapOf("percent" to num))
                Regex("\\b(max|full|high|brighter)\\b").containsMatchIn(c) -> Step("set_brightness", mapOf("percent" to 90))
                Regex("\\b(low|dim|dimmer|darker|min)\\b").containsMatchIn(c) -> Step("set_brightness", mapOf("percent" to 15))
                else -> Step("set_brightness", mapOf("percent" to 50))
            })
        }

        if (Regex("\\b(silent|vibrate|ringer|ring mode)\\b").containsMatchIn(c)) {
            val mode = when {
                "vibrat" in c -> "vibrate"
                "silent" in c && on -> "silent"
                else -> "normal"
            }
            return listOf(Step("set_ringer", mapOf("mode" to mode)))
        }

        if (Regex("\\b(volume|mute|unmute|louder|quieter)\\b").containsMatchIn(c)) {
            val stream = when {
                "ring" in c -> "ring"
                "alarm" in c -> "alarm"
                "notification" in c -> "notification"
                "call" in c -> "call"
                else -> "media"
            }
            val level = when {
                "unmute" in c -> 60
                "mute" in c -> 0
                num != null -> num
                Regex("\\b(max|full|louder|up)\\b").containsMatchIn(c) -> 90
                Regex("\\b(low|quieter|down)\\b").containsMatchIn(c) -> 25
                else -> 50
            }
            return listOf(Step("set_volume", mapOf("stream" to stream, "percent" to level)))
        }

        if (Regex("\\b(screen ?timeout|screen off after|sleep after)\\b").containsMatchIn(c)) {
            val secs = durationSeconds(c) ?: 30
            return listOf(Step("set_screen_timeout", mapOf("seconds" to secs)))
        }

        if (Regex("\\btimer\\b").containsMatchIn(c)) {
            val secs = durationSeconds(c) ?: return emptyList()
            return listOf(Step("set_timer", mapOf("seconds" to secs)))
        }

        if (Regex("\\b(alarm|wake me)\\b").containsMatchIn(c)) {
            val (h, m) = alarmTime(c) ?: return emptyList()
            return listOf(Step("set_alarm", mapOf("hour" to h, "minute" to m)))
        }

        Regex("^(?:please\\s+)?(?:open|launch|start|go to)\\s+(?:the\\s+|my\\s+)?(.+)$").find(c.trim())?.let { m ->
            val what = m.groupValues[1].removeSuffix(" please").trim()
            settingsPage(what)?.let { return listOf(Step("open_settings", mapOf("page" to it))) }
            return listOf(Step("launch_app", mapOf("name" to what.removeSuffix(" app").trim())))
        }

        Regex("^(?:call|dial)\\s+([+\\d][\\d \\-]{4,})$").find(c.trim())?.let {
            return listOf(Step("open", mapOf("target" to "dial", "value" to it.groupValues[1].replace(" ", ""))))
        }
        Regex("^(?:search|google|look up)\\s+(?:for\\s+)?(.+)$").find(c.trim())?.let {
            return listOf(Step("open", mapOf("target" to "search", "value" to it.groupValues[1])))
        }
        Regex("^(?:directions to|navigate to|where is|map of)\\s+(.+)$").find(c.trim())?.let {
            return listOf(Step("open", mapOf("target" to "map", "value" to it.groupValues[1])))
        }
        if ("settings" in c) settingsPage(c)?.let { return listOf(Step("open_settings", mapOf("page" to it))) }
        return emptyList()
    }

    /** Questions and scans: the best single match for the whole message. */
    private fun report(c: String): Step? {
        fun has(p: String) = Regex(p).containsMatchIn(c)
        return when {
            has("\\bduplicate") -> Step("find_duplicate_photos", title = "Duplicate photos and videos")
            has("\\bscreenshot") -> Step("find_old_screenshots", mapOf("older_than_days" to (Regex("(\\d+)\\s*day").find(c)?.groupValues?.get(1)?.toInt() ?: 30)), "Old screenshots")
            has("\\b(big|large|largest|biggest|huge) (files?|videos?|photos?)") -> Step("find_large_files", title = "Biggest files")
            has("\\b(bloat|debloat|pre-?installed|preloaded|ads?\\b|adverts?)") -> Step("bloatware_report", title = "Preinstalled extras")
            has("\\b(unused|never use|don'?t use|remove (some )?apps|apps (to|i can|can i|should i) (remove|delete|uninstall|get rid of)|uninstall)") ->
                Step("unused_apps", title = "Apps you don't use")
            has("\\b(screen ?time|most used|usage|how long)") -> Step("app_usage", title = "Screen time")
            has("\\b(notification|missed|what did i miss|messages)") -> Step("recent_notifications", title = "Recent notifications")
            has("\\b(speed ?test|internet speed|slow internet|internet (is )?slow|data (is )?slow|test (my )?(internet|connection|wifi))") ->
                Step("speed_test", title = "Internet speed")
            has("\\b(wi-?fi|network|connection|internet|online|signal)") -> Step("network_status", title = "Connection")
            has("\\b(storage|space|full|clean|free up|junk|cache|gallery)") -> Step("storage_report", title = "Storage")
            has("\\b(battery|drain|charg|power)") -> Step("battery_report", title = "Battery")
            has("\\b(apps|installed)") -> Step("list_apps", title = "Your apps")
            has("\\b(ram|specs|model|android version|hios|processor|cpu|chip|info|temperature|hot|uptime)") ->
                Step("device_status", title = "Vital signs")
            has("\\b(check ?up|health|scan|slow|lag|laggy|hang|freez|fix|optimi[sz]e|speed up|boost|problem|diagnos|doctor)") ->
                Step("phone_checkup", title = "Phone checkup")
            else -> null
        }
    }

    // ---- parsing helpers --------------------------------------------------------------------

    private fun settingsPage(s: String): String? {
        val aliases = listOf(
            "developer" to "developer", "battery saver" to "battery_saver", "power saving" to "battery_saver",
            "data usage" to "data_usage", "mobile data" to "mobile_data", "wifi" to "wifi", "wi-fi" to "wifi",
            "bluetooth" to "bluetooth", "storage" to "storage", "display" to "display", "screen" to "display",
            "sound" to "sound", "notification" to "notifications", "location" to "location", "gps" to "location",
            "update" to "system_update", "about" to "about", "language" to "language", "accessibility" to "accessibility",
            "security" to "security", "date" to "date_time", "time" to "date_time", "default app" to "default_apps",
            "battery" to "battery", "apps" to "apps", "volume" to "volume_panel", "internet" to "internet_panel",
            "settings" to "settings",
        )
        val isSettings = "setting" in s || aliases.take(5).any { it.first in s } ||
            Regex("^(wi-?fi|bluetooth|developer options|battery saver|data usage|mobile data)$").matches(s.trim())
        if (!isSettings) return null
        return aliases.firstOrNull { it.first in s }?.second
    }

    private fun durationSeconds(c: String): Int? {
        var total = 0
        var found = false
        Regex("(\\d+(?:\\.\\d+)?)\\s*(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)\\b").findAll(c).forEach {
            val n = it.groupValues[1].toDouble()
            total += when (it.groupValues[2].first()) {
                'h' -> (n * 3600).toInt()
                'm' -> (n * 60).toInt()
                else -> n.toInt()
            }
            found = true
        }
        if (!found && Regex("half an? hour").containsMatchIn(c)) return 1800
        if (!found && Regex("\\ban? hour\\b").containsMatchIn(c)) return 3600
        return if (found) total else null
    }

    /** "6:30", "6.30am", "7 pm", "at 7", "in 8 hours". */
    private fun alarmTime(c: String): Pair<Int, Int>? {
        Regex("\\bin\\s+(\\d+(?:\\.\\d+)?)\\s*(hours?|hrs?|h|minutes?|mins?)\\b").find(c)?.let {
            val secs = durationSeconds(it.value) ?: return null
            val cal = Calendar.getInstance().apply { add(Calendar.SECOND, secs) }
            return cal.get(Calendar.HOUR_OF_DAY) to cal.get(Calendar.MINUTE)
        }
        val m = Regex("\\b(\\d{1,2})(?:[:.](\\d{2}))?\\s*(am|pm|a\\.m\\.|p\\.m\\.)?").findAll(c)
            .firstOrNull { it.groupValues[2].isNotEmpty() || it.groupValues[3].isNotEmpty() || Regex("\\bat\\s+${it.value.trim()}").containsMatchIn(c) }
            ?: return null
        var h = m.groupValues[1].toInt()
        val min = m.groupValues[2].toIntOrNull() ?: 0
        val ampm = m.groupValues[3]
        if (ampm.startsWith("p") && h < 12) h += 12
        if (ampm.startsWith("a") && h == 12) h = 0
        if (h > 23 || min > 59) return null
        return h to min
    }

    private fun reminder(lower: String, original: String): Step? {
        val secs = durationSeconds(lower)
        val minutes = when {
            secs != null -> (secs / 60).coerceAtLeast(1)
            else -> alarmTime(lower)?.let { (h, m) ->
                val now = Calendar.getInstance()
                val at = (now.clone() as Calendar).apply {
                    set(Calendar.HOUR_OF_DAY, h); set(Calendar.MINUTE, m); set(Calendar.SECOND, 0)
                    if (before(now)) add(Calendar.DAY_OF_MONTH, 1)
                }
                ((at.timeInMillis - now.timeInMillis) / 60_000).toInt().coerceAtLeast(1)
            } ?: 30
        }
        val what = original
            .replace(Regex("(?i)\\b(please\\s+)?remind me\\b"), "")
            .replace(Regex("(?i)\\b(in|after)\\s+(\\d+(?:\\.\\d+)?)\\s*(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)\\b"), "")
            .replace(Regex("(?i)\\b(in|after)\\s+(half an? hour|an? hour)\\b"), "")
            .replace(Regex("(?i)\\bat\\s+\\d{1,2}(?:[:.]\\d{2})?\\s*(am|pm)?\\b"), "")
            .trim().removePrefix("to ").removePrefix("that ").removePrefix("about ").trim(' ', ',', '.')
        return Step("set_reminder", mapOf("minutes" to minutes, "text" to what.ifBlank { "Reminder" }))
    }

    companion object {
        val HELP = """
            I'm in **offline mode**, so I understand phone commands rather than any question. Try:
            - "checkup" · "why is my phone slow?"
            - "free up space" · "big files" · "duplicate photos" · "old screenshots"
            - "battery" · "unused apps" · "screen time" · "bloatware"
            - "speed test" · "what did I miss?"
            - "brightness 30%" · "flashlight on" · "silent" · "do not disturb on" · "volume 70"
            - "alarm at 6:30" · "timer 10 minutes" · "remind me in 20 minutes to call mum"
            - "open WhatsApp" · "open wifi settings" · "night mode"
            Combine them: "brightness 20, dnd on and alarm at 6".
        """.trimIndent()
    }
}
