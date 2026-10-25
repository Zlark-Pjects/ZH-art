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

    companion object {
        val MODELS = listOf(
            "claude-opus-5-5" to "Opus 5.5 · smartest (default)",
            "claude-sonnet-5-5" to "Sonnet 5.5 · fast and capable",
            "claude-haiku-5-5" to "Haiku 5.5 · cheapest and quickest",
        )
        val EFFORTS = listOf("low", "medium", "high")
    }
}
