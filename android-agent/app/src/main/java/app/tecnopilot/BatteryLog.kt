package app.tecnopilot

import android.content.Context
import android.os.PowerManager
import java.io.File
import java.util.Locale

/**
 * A small battery diary: one line every ~15 minutes (written by PilotJobService),
 * kept for 7 days. Enough to measure drain rate and charging habits.
 */
object BatteryLog {
    data class Sample(val at: Long, val level: Int, val charging: Boolean, val tempC: Float, val screenOn: Boolean)

    private fun file(ctx: Context) = File(ctx.filesDir, "battery.csv")

    fun record(ctx: Context) {
        val b = DeviceInfo.battery(ctx)
        if (b.level < 0) return
        val screenOn = ctx.getSystemService(PowerManager::class.java).isInteractive
        val now = System.currentTimeMillis()
        val keep = read(ctx).filter { now - it.at < 7 * 86_400_000L }
        val all = keep + Sample(now, b.level, b.charging, b.tempC, screenOn)
        file(ctx).writeText(all.joinToString("\n") { "${it.at},${it.level},${it.charging},${it.tempC},${it.screenOn}" })
    }

    fun read(ctx: Context): List<Sample> = runCatching {
        file(ctx).readLines().mapNotNull { l ->
            val p = l.split(',')
            if (p.size < 5) null else Sample(p[0].toLong(), p[1].toInt(), p[2].toBoolean(), p[3].toFloat(), p[4].toBoolean())
        }
    }.getOrDefault(emptyList())

    /** %/hour while discharging, over pairs of consecutive samples no more than 1 h apart. */
    private fun drainRate(s: List<Sample>, screen: Boolean?): Double? {
        var drop = 0.0
        var hours = 0.0
        for ((a, b) in s.zipWithNext()) {
            val h = (b.at - a.at) / 3_600_000.0
            if (a.charging || b.charging || h <= 0 || h > 1.0) continue
            if (screen != null && (a.screenOn != screen)) continue
            drop += (a.level - b.level).coerceAtLeast(0)
            hours += h
        }
        return if (hours >= 0.5) drop / hours else null
    }

    fun report(ctx: Context): String {
        val b = DeviceInfo.battery(ctx)
        val s = read(ctx)
        val prefs = Prefs(ctx)
        return buildString {
            appendLine("Now: ${b.level}%, ${if (b.charging) "charging (${b.plugged})" else "on battery"}, ${b.tempC}°C, health ${b.health}" +
                (b.cycleCount?.let { ", $it cycles" } ?: ""))
            if (s.size < 3) {
                appendLine("The battery diary has only ${s.size} readings so far; drain rates appear after an hour or two of use.")
            } else {
                val since = duration(System.currentTimeMillis() - s.first().at)
                appendLine("Diary: ${s.size} readings over the last $since.")
                drainRate(s, null)?.let { r ->
                    appendLine(String.format(Locale.US, "Average drain on battery: %.1f%% per hour", r))
                    if (!b.charging && r > 0) appendLine("At that rate ${b.level}% lasts about ${duration((b.level / r * 3_600_000).toLong())}.")
                }
                drainRate(s, true)?.let { appendLine(String.format(Locale.US, " - screen on: %.1f%%/h", it)) }
                drainRate(s, false)?.let {
                    appendLine(String.format(Locale.US, " - screen off: %.1f%%/h%s", it,
                        if (it > 2.0) " (high: something is keeping the phone awake)" else " (normal)"))
                }
                val hot = s.count { it.tempC >= 42f }
                if (hot > 0) appendLine("$hot readings at 42°C or hotter; heat wears the battery out fastest.")
                val full = s.zipWithNext().count { (a, c) -> c.charging && c.level >= 100 && a.level < 100 }
                if (full > 0) appendLine("Charged to 100% $full time(s) this week. Stopping at 80–90% makes the battery last more years.")
                val lows = s.count { !it.charging && it.level <= 10 }
                if (lows > 0) appendLine("Dropped to 10% or lower in $lows readings; deep discharges also age the battery.")
            }
            append(if (prefs.chargeLimit > 0) "Charge alert is set at ${prefs.chargeLimit}%." else "Charge alert is off (turn it on in Setup).")
        }
    }
}
