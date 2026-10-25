package app.tecnopilot

import android.app.Notification
import android.app.NotificationManager
import android.content.ComponentName
import android.content.Context
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

/**
 * Keeps the last 150 notifications in memory (never on disk, never uploaded unless you ask
 * Pilot about them) so it can answer "what did I miss?".
 */
class NotificationCatcher : NotificationListenerService() {

    data class Item(val at: Long, val app: String, val title: String, val text: String)

    override fun onListenerConnected() {
        runCatching { activeNotifications?.forEach(::add) }
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) = add(sbn)

    private fun add(sbn: StatusBarNotification) {
        val n = sbn.notification
        if (sbn.isOngoing || sbn.packageName == packageName) return
        if (n.flags and Notification.FLAG_GROUP_SUMMARY != 0) return
        val title = n.extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: ""
        val text = (n.extras.getCharSequence(Notification.EXTRA_BIG_TEXT)
            ?: n.extras.getCharSequence(Notification.EXTRA_TEXT))?.toString() ?: ""
        if (title.isBlank() && text.isBlank()) return
        val app = runCatching {
            packageManager.getApplicationLabel(packageManager.getApplicationInfo(sbn.packageName, 0)).toString()
        }.getOrDefault(sbn.packageName)
        synchronized(items) {
            items.removeAll { it.app == app && it.title == title && it.text == text }
            items.add(Item(sbn.postTime, app, title, text.take(300)))
            while (items.size > 150) items.removeAt(0)
        }
    }

    companion object {
        private val items = ArrayList<Item>()

        fun granted(ctx: Context): Boolean = ctx.getSystemService(NotificationManager::class.java)
            .isNotificationListenerAccessGranted(ComponentName(ctx, NotificationCatcher::class.java))

        fun recent(ctx: Context, sinceMinutes: Int, limit: Int): String {
            if (!granted(ctx)) return "Notification access is off. Open the Setup tab and allow 'Notification access'."
            val cutoff = System.currentTimeMillis() - sinceMinutes * 60_000L
            val list = synchronized(items) { items.filter { it.at >= cutoff }.sortedByDescending { it.at }.take(limit) }
            if (list.isEmpty()) return "No notifications in the last ${duration(sinceMinutes * 60_000L)} (Pilot only sees ones that arrived while it was allowed to)."
            val now = System.currentTimeMillis()
            return list.joinToString("\n") { "[${duration(now - it.at)} ago] ${it.app}: ${it.title} — ${it.text}" }
        }
    }
}
