package app.tecnopilot

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray

/** Everything the app remembers between launches. Stored privately on the phone. */
class Prefs(context: Context) {
    private val sp: SharedPreferences =
        context.applicationContext.getSharedPreferences("pilot", Context.MODE_PRIVATE)

    var apiKey: String
        get() = sp.getString("api_key", "") ?: ""
        set(v) = sp.edit().putString("api_key", v.trim()).apply()

    var model: String
        get() = sp.getString("model", MODELS[0].first) ?: MODELS[0].first
        set(v) = sp.edit().putString("model", v).apply()

    var effort: String
        get() = sp.getString("effort", "medium") ?: "medium"
        set(v) = sp.edit().putString("effort", v).apply()

    /** "auto" uses Claude when there's internet and a key, otherwise the on-device brain. */
    var mode: String
        get() = sp.getString("mode", "auto") ?: "auto"
        set(v) = sp.edit().putString("mode", v).apply()

    /** After a voice command, listen again once Pilot has answered (hands-free). */
    var conversationMode: Boolean
        get() = sp.getBoolean("conversation", false)
        set(v) = sp.edit().putBoolean("conversation", v).apply()

    var speakReplies: Boolean
        get() = sp.getBoolean("speak", false)
        set(v) = sp.edit().putBoolean("speak", v).apply()

    var dailyCheckup: Boolean
        get() = sp.getBoolean("daily_checkup", true)
        set(v) = sp.edit().putBoolean("daily_checkup", v).apply()

    /** Notify when charging reaches this level; 0 turns the alert off. */
    var chargeLimit: Int
        get() = sp.getInt("charge_limit", 85)
        set(v) = sp.edit().putInt("charge_limit", v).apply()

    var lastChargeAlertAt: Long
        get() = sp.getLong("charge_alert_at", 0)
        set(v) = sp.edit().putLong("charge_alert_at", v).apply()

    /** Facts the user asked Pilot to remember ("I use WhatsApp a lot", "call me Zee"). */
    var memories: List<String>
        get() {
            val arr = JSONArray(sp.getString("memories", "[]"))
            return List(arr.length()) { arr.getString(it) }
        }
        set(v) = sp.edit().putString("memories", JSONArray(v).toString()).apply()

    /** Safe mode should be running (restored after a reboot or when the app opens). */
    var filterWanted: Boolean
        get() = sp.getBoolean("filter_wanted", false)
        set(v) = sp.edit().putBoolean("filter_wanted", v).apply()

    /** SHA-256 of the Safe mode PIN; empty when there is no PIN. */
    var filterPinHash: String
        get() = sp.getString("filter_pin", "") ?: ""
        set(v) = sp.edit().putString("filter_pin", v).apply()

    /** Sites the user added to the Safe mode blocklist. */
    var extraBlocked: Set<String>
        get() = sp.getStringSet("extra_blocked", emptySet()) ?: emptySet()
        set(v) = sp.edit().putStringSet("extra_blocked", v).apply()

    /** Offline notes and to-dos, newest last. */
    var notes: List<String>
        get() {
            val arr = JSONArray(sp.getString("notes", "[]"))
            return List(arr.length()) { arr.getString(it) }
        }
        set(v) = sp.edit().putString("notes", JSONArray(v).toString()).apply()

    var autoUpdateCheck: Boolean
        get() = sp.getBoolean("auto_update", true)
        set(v) = sp.edit().putBoolean("auto_update", v).apply()

    var lastUpdateCheck: Long
        get() = sp.getLong("update_checked", 0)
        set(v) = sp.edit().putLong("update_checked", v).apply()

    /** Version code we last told the user about, so each update is announced once. */
    var announcedVersion: Long
        get() = sp.getLong("update_announced", 0)
        set(v) = sp.edit().putLong("update_announced", v).apply()

    /** Daily screen-time alert in minutes; 0 = off. */
    var screenLimitMin: Int
        get() = sp.getInt("screen_limit", 0)
        set(v) = sp.edit().putInt("screen_limit", v).apply()

    /** Day stamp (yyyyDDD) of the last alert of each kind, so each fires at most once a day. */
    fun alertedToday(kind: String): Boolean {
        val today = java.util.Calendar.getInstance().let { it.get(java.util.Calendar.YEAR) * 1000 + it.get(java.util.Calendar.DAY_OF_YEAR) }
        if (sp.getInt("alert_$kind", 0) == today) return true
        sp.edit().putInt("alert_$kind", today).apply()
        return false
    }

    companion object {
        val MODELS = listOf(
            "claude-opus-5-5" to "Opus 5.5 · smartest (default)",
            "claude-sonnet-5-5" to "Sonnet 5.5 · fast and capable",
            "claude-haiku-5-5" to "Haiku 5.5 · cheapest and quickest",
        )
        val EFFORTS = listOf("low", "medium", "high")
        val MODES = listOf(
            "auto" to "Auto · Claude when online, on-device when not",
            "online" to "Online only · always Claude",
            "offline" to "Offline only · on-device, nothing leaves the phone",
        )
    }
}
