package app.tecnopilot

import android.content.Intent
import android.content.IntentSender
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

/** Guards releases: the app must open, every tab must work, and no tool or offline command may throw. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class StartupTest {
    private val host = object : Host {
        override fun launch(intent: Intent) = true
        override fun confirm(sender: IntentSender) = false
        override fun launchForResult(intent: Intent) = false
    }

    private fun idle() = shadowOf(Looper.getMainLooper()).idle()

    private fun views(v: View, out: MutableList<View> = ArrayList()): List<View> {
        out += v
        if (v is ViewGroup) for (i in 0 until v.childCount) views(v.getChildAt(i), out)
        return out
    }

    @Test
    fun opensAndSwitchesTabs() {
        val c = Robolectric.buildActivity(MainActivity::class.java).setup()
        idle()
        val root = c.get().window.decorView
        for (tab in listOf("Doctor", "Setup", "Pilot")) {
            views(root).filterIsInstance<TextView>().first { it.text.toString().endsWith(tab) }.performClick()
            idle()
        }
        c.pause().stop().destroy()
    }

    @Test
    fun everyToolRuns() {
        val ctx = RuntimeEnvironment.getApplication()
        val needsDevice = setOf("speed_test", "update_app", "safe_mode", "delete_media", "share_report")
        val failures = Tools.all(ctx, host).filter { it.name !in needsDevice }.mapNotNull { t ->
            val args: Map<String, Any?> = when (t.name) {
                "manage_app" -> mapOf("package" to ctx.packageName, "action" to "settings")
                "launch_app" -> mapOf("name" to "settings")
                "open" -> mapOf("target" to "search", "value" to "tecno")
                "notes" -> mapOf("action" to "add", "text" to "test")
                "block_site" -> mapOf("site" to "example.com")
                "remember" -> mapOf("fact" to "test")
                "forget" -> mapOf("match" to "test")
                else -> emptyMap()
            }
            runCatching { t.run(Args(args)) }.exceptionOrNull()?.let { "${t.name}: $it" }
        }
        assertTrue("Tools failed: $failures", failures.isEmpty())
        Checkup.describe(Checkup.run(ctx))
    }

    @Test
    fun offlineCommandsRun() {
        val ctx = RuntimeEnvironment.getApplication()
        val brain = OfflineBrain(ctx, host)
        val failures = listOf(
            "checkup", "free up space", "battery", "unused apps", "bloatware", "what did I miss", "brightness thirty percent",
            "flashlight on", "silent", "dnd on", "alarm at six thirty", "timer ten minutes", "remind me in 20 minutes to call mum",
            "open settings", "night mode", "block site example.com", "what's using my data", "biggest apps", "note buy bread",
            "my notes", "delete note 1", "15% of 2400", "5 km to miles", "what time is it", "how do I take a screenshot",
            "good morning", "save battery", "screen time limit 3 hours", "make a password", "flip a coin", "days until christmas", "hello",
        ).mapNotNull { q -> runCatching { brain.handle(q) {} }.exceptionOrNull()?.let { "$q: $it" } }
        assertTrue("Commands failed: $failures", failures.isEmpty())
    }
}
