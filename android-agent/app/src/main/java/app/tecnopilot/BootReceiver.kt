package app.tecnopilot

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Turns Safe mode back on after a restart, if it was on before. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        if (Prefs(ctx).filterWanted && ContentFilter.consentIntent(ctx) == null) {
            runCatching { ContentFilter.start(ctx) }
        }
        runCatching { PilotJobService.schedule(ctx) }
    }
}
