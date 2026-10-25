package app.tecnopilot

import android.content.Context

/**
 * The offline "phone doctor": scores the phone 0–100 and lists what's worth fixing, worst first.
 * Works without an API key; Pilot uses the same report when you ask it for a checkup.
 */
object Checkup {
    enum class Level(val weight: Int) { CRITICAL(20), WARN(8), TIP(3) }

    /** [fix] is a settings page key from Controls.SETTINGS_PAGES, "setup" for the Setup tab, or null. */
    data class Issue(val level: Level, val title: String, val detail: String, val fix: String?, val fixLabel: String?)

    data class Report(val score: Int, val issues: List<Issue>, val vitals: Vitals)

    fun run(ctx: Context): Report {
        val v = DeviceInfo.read(ctx)
        val out = ArrayList<Issue>()
        val freeStorage = pct(v.storageFree, v.storageTotal)
        when {
            freeStorage < 8 -> out += Issue(Level.CRITICAL, "Storage almost full ($freeStorage% free)",
                "Below ~10% free, budget phones slow down badly and apps crash. Free a few GB: big videos, WhatsApp media, duplicates.", "storage", "Open storage")
            freeStorage < 15 -> out += Issue(Level.WARN, "Storage getting full ($freeStorage% free)",
                "Keep at least 15% free so the phone stays quick.", "storage", "Open storage")
        }
        val freeRam = pct(v.ramAvail, v.ramTotal)
        if (v.lowMemory || freeRam < 15) out += Issue(Level.WARN, "RAM is tight ($freeRam% free)",
            "Too many apps stay in the background. Remove apps you don't use and restrict auto-start in Phone Master.", "apps", "Open apps")
        val b = v.battery
        when {
            b.tempC >= 45f -> out += Issue(Level.CRITICAL, "Battery is hot (${b.tempC}°C)",
                "Stop gaming/charging, take off the case, and keep it out of the sun.", "battery", "Battery usage")
            b.tempC >= 40f -> out += Issue(Level.WARN, "Battery is warm (${b.tempC}°C)",
                "Heat ages batteries fastest. Avoid using heavy apps while charging.", "battery", "Battery usage")
        }
        if (b.health != "good" && b.health != "unknown") out += Issue(Level.CRITICAL, "Battery health: ${b.health}",
            "The battery reports a fault; a Carlcare service centre can check it.", null, null)
        if (b.level in 0..20 && !b.charging && !v.powerSave) out += Issue(Level.TIP, "Battery low and saver off",
            "Turn on Battery saver to stretch the last ${b.level}%.", "battery_saver", "Battery saver")
        if (v.uptimeMs > 7 * 86_400_000L) out += Issue(Level.TIP, "Not restarted for ${duration(v.uptimeMs)}",
            "A restart once a week clears memory leaks and stuck background apps.", null, null)
        if (v.animatorScale >= 1f || v.windowScale >= 1f) out += Issue(Level.TIP, "Animations at full length",
            "Setting window, transition and animator scales to 0.5x in Developer options makes the phone feel much snappier.", "developer", "Developer options")
        v.screenTimeoutMs?.let {
            if (it > 120_000) out += Issue(Level.TIP, "Screen stays on for ${duration(it)}",
                "30 s–1 min saves a lot of battery on a big screen.", "display", "Display")
        }
        if (v.autoBrightness == false && (v.brightness ?: 0) > 200) out += Issue(Level.TIP, "Brightness fixed near maximum",
            "The screen is the biggest battery user. Adaptive brightness helps.", "display", "Display")
        if (!v.pilotUnrestricted) out += Issue(Level.TIP, "Pilot's background checks may be stopped",
            "HiOS closes background apps aggressively. Exempt Tecno Pilot from battery optimisation so the battery diary and charge alert keep working.", "setup", "Setup")
        if (Apps.hasUsageAccess(ctx)) {
            val idle = idleCount(ctx)
            if (idle >= 5) out += Issue(Level.WARN, "$idle apps unused for 30+ days",
                "They take storage and some run in the background. Ask Pilot \"which apps can I remove?\".", "apps", "Open apps")
        } else out += Issue(Level.TIP, "Usage access off", "Allow it in Setup so Pilot can find unused apps and measure screen time.", "setup", "Setup")
        val bloat = Bloat.KNOWN.count { k ->
            k.verdict == Bloat.Verdict.SAFE && runCatching { ctx.packageManager.getApplicationInfo(k.pkg, 0).enabled }.getOrDefault(false)
        }
        if (bloat > 0) out += Issue(Level.TIP, "$bloat preinstalled extras are enabled",
            "Disabling unneeded Tecno extras saves RAM and stops ads/notifications. See the Bloatware report.", null, null)
        if (v.sdk < 34) out += Issue(Level.TIP, "Check for updates",
            "You're on Android ${v.android} (patch ${v.securityPatch}). Install any HiOS update for security fixes.", "system_update", "Updates")

        val sorted = out.sortedBy { it.level.ordinal }
        val score = (100 - sorted.sumOf { it.level.weight }).coerceIn(5, 100)
        return Report(score, sorted, v)
    }

    private fun idleCount(ctx: Context): Int =
        runCatching { Apps.idleApps(ctx, 30, withSizes = false).size }.getOrDefault(0)

    fun describe(r: Report): String = buildString {
        appendLine("Health score: ${r.score}/100")
        if (r.issues.isEmpty()) appendLine("No problems found.")
        r.issues.forEach { appendLine("[${it.level}] ${it.title}: ${it.detail}") }
        appendLine()
        append(DeviceInfo.describe(r.vitals))
    }
}
