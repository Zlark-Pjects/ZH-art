package app.tecnopilot

import java.util.Locale

fun bytes(n: Long): String {
    if (n < 1024) return "$n B"
    val units = listOf("KB", "MB", "GB", "TB")
    var v = n / 1024.0
    var i = 0
    while (v >= 1024 && i < units.size - 1) { v /= 1024; i++ }
    return String.format(Locale.US, if (v >= 100) "%.0f %s" else "%.1f %s", v, units[i])
}

fun pct(part: Long, whole: Long): Int = if (whole <= 0) 0 else ((part * 100) / whole).toInt()

fun duration(ms: Long): String {
    val m = ms / 60_000
    return when {
        m < 1 -> "<1 min"
        m < 60 -> "$m min"
        m < 60 * 24 -> "${m / 60} h ${m % 60} min"
        else -> "${m / (60 * 24)} d ${(m / 60) % 24} h"
    }
}

fun daysAgo(ts: Long, now: Long = System.currentTimeMillis()): Long = (now - ts) / 86_400_000L
