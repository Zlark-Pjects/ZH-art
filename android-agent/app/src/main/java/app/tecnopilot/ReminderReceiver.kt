package app.tecnopilot

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        val text = intent.getStringExtra("text") ?: "Reminder"
        PilotJobService.notify(ctx, 1000 + (text.hashCode() and 0xfff), "Reminder", text)
    }

    companion object {
        /** Returns a short description of when it will fire. */
        fun schedule(ctx: Context, minutes: Int, text: String): String {
            val am = ctx.getSystemService(AlarmManager::class.java)
            val at = System.currentTimeMillis() + minutes * 60_000L
            val pi = PendingIntent.getBroadcast(
                ctx, (at / 1000).toInt(),
                Intent(ctx, ReminderReceiver::class.java).putExtra("text", text),
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )
            val exact = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms()
            if (exact) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
            else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
            return "Reminder set for ${duration(minutes * 60_000L)} from now: \"$text\"" +
                if (exact) "." else " (may be a few minutes late: allow 'Alarms & reminders' in Setup for exact timing)."
        }
    }
}
