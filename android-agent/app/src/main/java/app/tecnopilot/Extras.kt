package app.tecnopilot

import android.app.usage.NetworkStats
import android.app.usage.NetworkStatsManager
import android.content.Context
import android.net.ConnectivityManager
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import kotlin.math.pow

/** Which apps used mobile data or Wi-Fi. Reads Android's own counters; needs usage access. */
object DataUsage {
    fun report(ctx: Context, days: Int, network: String): String {
        if (!Apps.hasUsageAccess(ctx)) return "No usage access yet. Open the Setup tab and allow 'Usage access'."
        val nsm = ctx.getSystemService(NetworkStatsManager::class.java)
        val pm = ctx.packageManager
        val start = if (days <= 0) Calendar.getInstance().apply {
            set(Calendar.DAY_OF_MONTH, 1); set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0)
        }.timeInMillis else System.currentTimeMillis() - days * 86_400_000L
        val end = System.currentTimeMillis()
        val types = when (network) {
            "wifi" -> listOf(ConnectivityManager.TYPE_WIFI)
            "both" -> listOf(ConnectivityManager.TYPE_MOBILE, ConnectivityManager.TYPE_WIFI)
            else -> listOf(ConnectivityManager.TYPE_MOBILE)
        }
        val perUid = HashMap<Int, Long>()
        for (t in types) runCatching {
            @Suppress("DEPRECATION")
            val stats = nsm.querySummary(t, null, start, end)
            val b = NetworkStats.Bucket()
            while (stats.hasNextBucket()) {
                stats.getNextBucket(b)
                perUid[b.uid] = (perUid[b.uid] ?: 0L) + b.rxBytes + b.txBytes
            }
            stats.close()
        }
        val total = perUid.values.sum()
        val period = if (days <= 0) "this month" else "the last $days day(s)"
        val label = when (network) { "wifi" -> "Wi-Fi"; "both" -> "mobile data + Wi-Fi"; else -> "mobile data" }
        if (total == 0L) return "No $label use recorded for $period."
        val named = perUid.entries.sortedByDescending { it.value }.take(10).map { (uid, bytes) ->
            val name = when (uid) {
                android.os.Process.SYSTEM_UID, 0 -> "Android system"
                -4 -> "Removed apps"
                -5 -> "Hotspot / tethering"
                else -> pm.getPackagesForUid(uid)?.firstOrNull()?.let { p ->
                    runCatching { pm.getApplicationLabel(pm.getApplicationInfo(p, 0)).toString() }.getOrDefault(p)
                } ?: "uid $uid"
            }
            "$name: ${bytes(bytes)}"
        }
        return buildString {
            appendLine("$label used $period: ${bytes(total)}. Biggest users:")
            named.forEach { appendLine(" - $it") }
            append("To save data: use Lite apps, turn off auto-play and auto-download of media in WhatsApp/Facebook, and set app updates to Wi-Fi only in Play Store.")
        }
    }
}

object AppSizes {
    fun largest(ctx: Context, limit: Int): String {
        if (!Apps.hasUsageAccess(ctx)) return "No usage access yet. Open the Setup tab and allow 'Usage access' to measure app sizes."
        val apps = Apps.installed(ctx).filter { it.launchable }.mapNotNull { a -> Apps.sizeOf(ctx, a.pkg)?.let { a to it } }
            .sortedByDescending { it.second }
        return buildString {
            appendLine("Apps using the most storage (app + data):")
            apps.take(limit).forEach { (a, s) -> appendLine(" - ${a.label} (${a.pkg}): ${bytes(s)}") }
            append("Clearing an app's cache (App info › Storage › Clear cache) is safe; 'Clear data' signs you out and deletes its files.")
        }
    }
}

object Notes {
    private val fmt = SimpleDateFormat("d MMM HH:mm", Locale.getDefault())

    fun add(ctx: Context, text: String): String {
        val p = Prefs(ctx)
        p.notes = (p.notes + "${fmt.format(Date())} · ${text.take(500)}").takeLast(200)
        return "Saved note #${p.notes.size}: $text"
    }

    fun list(ctx: Context): String {
        val n = Prefs(ctx).notes
        if (n.isEmpty()) return "No notes yet. Say \"note buy bread\" to add one."
        return n.mapIndexed { i, s -> "${i + 1}. $s" }.joinToString("\n")
    }

    fun remove(ctx: Context, which: String): String {
        val p = Prefs(ctx)
        val before = p.notes
        p.notes = when {
            which == "all" -> emptyList()
            which.toIntOrNull() != null -> before.filterIndexed { i, _ -> i + 1 != which.toInt() }
            else -> before.filterNot { it.contains(which, true) }
        }
        return "Removed ${before.size - p.notes.size} note(s)."
    }
}

/** Arithmetic with + - × ÷ ^ %, brackets, and "15% of 2400". */
object Calc {
    fun tryAnswer(q: String): String? {
        var s = q.lowercase().trim().trimEnd('?', '.', '=').trim()
        s = s.replace(Regex("^(what('?s| is)|calculate|calc|compute|how much is|solve)\\s+"), "")
        Regex("^(\\d+(?:\\.\\d+)?)\\s*%\\s*of\\s*(\\d+(?:\\.\\d+)?)$").find(s)?.let {
            val r = it.groupValues[1].toDouble() / 100 * it.groupValues[2].toDouble()
            return "${it.groupValues[1]}% of ${it.groupValues[2]} = ${show(r)}"
        }
        val expr = s.replace("×", "*").replace("÷", "/").replace(Regex("(?<=\\d)\\s*x\\s*(?=\\d)"), "*")
            .replace("plus", "+").replace("minus", "-").replace("times", "*").replace("divided by", "/")
            .replace(",", "")
        if (!Regex("^[\\d\\s+\\-*/^().%]+$").matches(expr) || !Regex("\\d\\s*[+\\-*/^%]\\s*[\\d(]|\\)").containsMatchIn(expr)) return null
        return runCatching { "${expr.trim()} = ${show(Parser(expr.replace(" ", "")).parse())}" }.getOrNull()
    }

    private fun show(d: Double): String =
        if (d == Math.floor(d) && kotlin.math.abs(d) < 1e15) String.format(Locale.US, "%,d", d.toLong())
        else String.format(Locale.US, "%,.4f", d).trimEnd('0').trimEnd('.')

    private class Parser(val s: String) {
        var i = 0
        fun parse(): Double { val v = sum(); require(i == s.length); return v }
        fun sum(): Double {
            var v = product()
            while (i < s.length && (s[i] == '+' || s[i] == '-')) { val op = s[i++]; val r = product(); v = if (op == '+') v + r else v - r }
            return v
        }
        fun product(): Double {
            var v = power()
            while (i < s.length && (s[i] == '*' || s[i] == '/' || s[i] == '%')) {
                val op = s[i++]
                if (op == '%' && (i >= s.length || s[i] in "+-*/)")) { v /= 100; continue }
                val r = power()
                v = when (op) { '*' -> v * r; '/' -> v / r; else -> v % r }
            }
            return v
        }
        fun power(): Double { val b = unary(); return if (i < s.length && s[i] == '^') { i++; b.pow(power()) } else b }
        fun unary(): Double = if (i < s.length && s[i] == '-') { i++; -unary() } else atom()
        fun atom(): Double {
            if (s[i] == '(') { i++; val v = sum(); require(s[i] == ')'); i++; return v }
            val st = i
            while (i < s.length && (s[i].isDigit() || s[i] == '.')) i++
            return s.substring(st, i).toDouble()
        }
    }
}

/** "5 km to miles", "100 f in c", "2 gb to mb". */
object Units {
    private val factors: Map<String, Pair<String, Double>> = buildMap {
        fun put(kind: String, base: Double, vararg names: String) = names.forEach { put(it, kind to base) }
        put("len", 1000.0, "km", "kilometer", "kilometers", "kilometre", "kilometres")
        put("len", 1.0, "m", "meter", "meters", "metre", "metres")
        put("len", 0.01, "cm", "centimeter", "centimeters", "centimetre", "centimetres")
        put("len", 0.001, "mm", "millimeter", "millimeters")
        put("len", 1609.344, "mi", "mile", "miles")
        put("len", 0.3048, "ft", "foot", "feet")
        put("len", 0.0254, "in", "inch", "inches")
        put("len", 0.9144, "yd", "yard", "yards")
        put("mass", 1.0, "kg", "kilo", "kilos", "kilogram", "kilograms")
        put("mass", 0.001, "g", "gram", "grams")
        put("mass", 0.45359237, "lb", "lbs", "pound", "pounds")
        put("mass", 0.028349523, "oz", "ounce", "ounces")
        put("vol", 1.0, "l", "liter", "liters", "litre", "litres")
        put("vol", 0.001, "ml", "milliliter", "milliliters", "millilitre", "millilitres")
        put("vol", 3.785411784, "gal", "gallon", "gallons")
        put("data", 1.0, "kb", "kilobyte", "kilobytes")
        put("data", 1024.0, "mb", "megabyte", "megabytes")
        put("data", 1024.0 * 1024, "gb", "gigabyte", "gigabytes")
        put("data", 1024.0 * 1024 * 1024, "tb", "terabyte", "terabytes")
        put("speed", 1.0, "km/h", "kmh", "kph")
        put("speed", 1.609344, "mph")
        put("time", 1.0, "sec", "secs", "second", "seconds")
        put("time", 60.0, "min", "mins", "minute", "minutes")
        put("time", 3600.0, "hr", "hrs", "hour", "hours")
        put("time", 86400.0, "day", "days")
    }

    fun tryAnswer(q: String): String? {
        val m = Regex("(-?\\d+(?:\\.\\d+)?)\\s*([a-z/°]+)\\s+(?:to|in|into|as)\\s+([a-z/°]+)").find(q.lowercase()) ?: return null
        val v = m.groupValues[1].toDouble()
        val from = m.groupValues[2].removePrefix("°")
        val to = m.groupValues[3].removePrefix("°")
        val temp = setOf("c", "celsius", "f", "fahrenheit")
        if (from in temp && to in temp) {
            val r = if (from.startsWith("c") && to.startsWith("f")) v * 9 / 5 + 32
            else if (from.startsWith("f") && to.startsWith("c")) (v - 32) * 5 / 9 else v
            return String.format(Locale.US, "%s°%s = %.1f°%s", m.groupValues[1], from.first().uppercase(), r, to.first().uppercase())
        }
        val a = factors[from] ?: return null
        val b = factors[to] ?: return null
        if (a.first != b.first) return null
        val r = v * a.second / b.second
        return String.format(Locale.US, "%s %s = %s %s", m.groupValues[1], from,
            String.format(Locale.US, "%,.4f", r).trimEnd('0').trimEnd('.'), to)
    }
}

/** Offline answers to common "how do I…" questions on Tecno/HiOS phones. */
object TecnoGuide {
    private class Tip(val keys: List<String>, val answer: String)

    private val TIPS = listOf(
        Tip(listOf("screenshot", "screen shot"), "Screenshot: press Power + Volume down together. On HiOS you can also swipe down with three fingers (Settings › Accessibility/Gestures › Three-finger screenshot), or use the Screenshot tile in the quick settings panel."),
        Tip(listOf("record", "screen record"), "Screen recording: pull down the quick settings panel and tap 'Screen recorder' (add it with the pencil icon if it's missing)."),
        Tip(listOf("dark mode", "dark theme", "night theme"), "Dark mode: Settings › Display › Dark theme (or Dark mode). Dark mode also saves battery on AMOLED screens; on LCD screens (most Spark/Pop models) the saving is small, but it's easier on the eyes."),
        Tip(listOf("battery percentage", "battery percent"), "Battery percentage: Settings › Notification & status bar (or Battery) › Battery percentage / Battery display."),
        Tip(listOf("memory fusion", "extend ram", "extended ram", "virtual ram", "ram expansion"), "Memory Fusion (extra RAM from storage): Settings › Special function or Memory › Memory Fusion. It uses storage as slow RAM; if storage is nearly full or the phone stutters, try a smaller size or turn it off and restart."),
        Tip(listOf("developer option", "animation scale", "animations faster"), "Developer options: Settings › About phone › tap 'Build number' 7 times. Then Settings › System › Developer options: set Window, Transition and Animator animation scale to 0.5x for a snappier phone."),
        Tip(listOf("factory reset", "reset phone", "reset my phone", "erase everything"), "Factory reset: Settings › System › Reset options › Erase all data. Back up first (Google account, Photos, WhatsApp chat backup) — it deletes everything on the phone."),
        Tip(listOf("safe mode", "boot safe"), "Android safe mode (starts with only built-in apps, to find a bad app): hold Power, then long-press 'Power off' and confirm 'Reboot to safe mode'. Restart normally to leave it."),
        Tip(listOf("imei"), "IMEI: dial *#06#, or Settings › About phone › Status."),
        Tip(listOf("hotspot", "share internet", "tether"), "Hotspot: Settings › Network & Internet (or Mobile network) › Personal hotspot. Set a password and turn it off when done; it drains the battery quickly."),
        Tip(listOf("app lock", "lock app", "lock an app", "lock whatsapp", "hide app"), "App lock: Settings › Security › App lock (or Phone Master › App lock) lets you protect apps with a PIN or fingerprint. HiOS can also hide apps from there on many versions."),
        Tip(listOf("split screen", "two apps"), "Split screen: open the Recents screen, tap the app's icon at the top of its card and choose 'Split screen', then pick the second app."),
        Tip(listOf("find my phone", "lost phone", "stolen"), "Lost phone: on another device go to android.com/find (Google Find My Device) and sign in with your Google account to ring, lock or erase it. Make sure Settings › Google › Find My Device is on now."),
        Tip(listOf("backup", "back up"), "Backup: Settings › System › Backup (Google One) for apps, contacts and settings; Google Photos for pictures; WhatsApp › Settings › Chats › Chat backup for chats."),
        Tip(listOf("data saver", "save data"), "Data saver: Settings › Network & Internet › Data saver stops background data for most apps. In WhatsApp: Settings › Storage and data › Media auto-download › choose 'No media' on mobile data."),
        Tip(listOf("update", "software update", "system update"), "System update: Settings › System › System update (or About phone › System update). Updates bring security fixes and often battery improvements; install on Wi-Fi with 50%+ battery."),
        Tip(listOf("default browser", "default app"), "Default apps: Settings › Apps › Default apps lets you choose the browser, SMS, phone and home apps."),
        Tip(listOf("auto start", "autostart", "background app", "apps closing"), "Auto-start: open Phone Master › App management › Auto-start (or Settings › Apps › the app › Battery) to decide which apps may run in the background. Turning it off for games and shopping apps saves RAM and battery; leave it on for WhatsApp, alarms and Tecno Pilot."),
        Tip(listOf("ussd", "airtime", "balance", "data bundle"), "Checking airtime or data balance uses your network's USSD codes (for example *310# or *556# depending on the network). Dial them from the Phone app; Pilot can open the dialer with \"call *310#\"."),
        Tip(listOf("keyboard", "typing"), "Keyboard: Settings › System › Languages & input › On-screen keyboard. Gboard is light and supports voice typing, which Pilot also uses for the mic button."),
        Tip(listOf("overheat", "too hot", "getting hot", "heats up"), "If the phone gets hot: stop charging while gaming, take off the case, lower brightness, close games and camera, and keep it out of the sun. Heat is the biggest cause of battery wear."),
        Tip(listOf("wont charge", "won't charge", "slow charging", "charging slow"), "Slow charging: use the original charger and cable, clean the port gently with a dry toothbrush, avoid using heavy apps while charging, and try a restart. If the battery health shows a fault, visit Carlcare."),
        Tip(listOf("restart", "reboot"), "Restart: hold Power and tap Restart. Once a week clears memory leaks and stuck apps."),
        Tip(listOf("wallpaper"), "Wallpaper: long-press an empty spot on the home screen › Wallpapers. A dark, still wallpaper is lightest on a budget phone."),
        Tip(listOf("ringtone"), "Ringtone: Settings › Sound & vibration › Phone ringtone. You can pick any song from your files with 'Add ringtone' or the + button."),
        Tip(listOf("fingerprint", "face unlock", "screen lock", "pin lock"), "Screen lock and fingerprint: Settings › Security › Screen lock / Fingerprint / Face unlock. Set a PIN first; fingerprint and face need it as a backup."),
        Tip(listOf("dual sim", "sim card", "sim settings", "default sim"), "SIM settings: Settings › Network & Internet › SIM cards (Dual SIM) to choose which SIM is used for calls, SMS and mobile data."),
        Tip(listOf("transfer", "new phone", "move data", "share files", "xender", "send files"), "Moving files to another phone: Android's Quick Share (Nearby Share) in the share menu works offline over Wi-Fi Direct. Many Tecno phones also have 'Phone Clone' / 'Tecno Share'."),
        Tip(listOf("eye comfort", "blue light", "night light", "eye protection"), "Eye comfort: Settings › Display › Eye care / Eye comfort (Night light) adds a warm filter at night and can be scheduled from sunset to sunrise."),
        Tip(listOf("font size", "text size", "bigger text", "display size"), "Text size: Settings › Display › Font size and Display size. Pilot can't change these, but it's two sliders."),
        Tip(listOf("storage card", "sd card", "memory card"), "SD card: Settings › Storage shows it. Set the Camera to save to the SD card (Camera › Settings › Storage location) to keep internal storage free."),
        Tip(listOf("clear cache", "cache"), "Clear an app's cache: Settings › Apps › choose the app › Storage › Clear cache. It's safe (no data lost). 'Clear data/storage' resets the app and signs you out."),
        Tip(listOf("block porn", "parental", "child", "kids", "adult content", "porn", "explicit"), "Tecno Pilot's Safe mode blocks adult and pornographic sites in every browser and app and keeps Google, Bing and YouTube in safe mode. Turn it on in Setup › Safe mode (or say \"safe mode on\") and set a PIN so it can't be switched off without you."),
    )

    fun tryAnswer(q: String): String? {
        val s = q.lowercase()
        if (!Regex("\\b(how|where|what|can i|turn on|enable|set up|setup|change|help)\\b").containsMatchIn(s) &&
            !Regex("\\b(tip|guide|explain)\\b").containsMatchIn(s)) return null
        return TIPS.firstOrNull { t -> t.keys.any { it in s } }?.answer
    }
}

object Clock {
    fun tryAnswer(q: String): String? {
        val s = q.lowercase()
        val now = Date()
        return when {
            Regex("\\bwhat('?s| is)? the time\\b|\\bwhat time is it\\b|^time\\??$").containsMatchIn(s) ->
                "It's ${SimpleDateFormat("HH:mm", Locale.getDefault()).format(now)}."
            Regex("\\b(what('?s| is) (the |today'?s )?date|what day is (it|today)|today'?s date)\\b").containsMatchIn(s) ->
                "Today is ${SimpleDateFormat("EEEE d MMMM yyyy", Locale.getDefault()).format(now)}."
            else -> null
        }
    }
}

/** Little offline helpers: passwords, coins, dice, countdowns. */
object Handy {
    private val rnd = java.security.SecureRandom()

    fun password(length: Int): String {
        val chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#%&*?"
        val n = length.coerceIn(8, 40)
        return "New password: " + (1..n).map { chars[rnd.nextInt(chars.length)] }.joinToString("") +
            "\nLong-press to copy. Use a different password for every account."
    }

    fun coin() = if (rnd.nextBoolean()) "🪙 Heads" else "🪙 Tails"

    fun dice(count: Int) = (1..count.coerceIn(1, 6)).map { rnd.nextInt(6) + 1 }.let {
        "🎲 " + it.joinToString(" + ") + if (it.size > 1) " = ${it.sum()}" else ""
    }

    private val MONTHS = listOf("jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec")

    /** "days until 25 december", "how many days to christmas", "days until 2027-01-01". */
    fun daysUntil(q: String): String? {
        val s = q.lowercase()
        if (!Regex("\\b(days? (until|till|to|before)|how long (until|till|to))\\b").containsMatchIn(s)) return null
        val now = Calendar.getInstance().apply { set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0) }
        val target = (now.clone() as Calendar)
        when {
            "christmas" in s -> { target.set(Calendar.MONTH, 11); target.set(Calendar.DAY_OF_MONTH, 25) }
            "new year" in s -> { target.set(Calendar.MONTH, 0); target.set(Calendar.DAY_OF_MONTH, 1); target.add(Calendar.YEAR, 1) }
            else -> {
                Regex("(\\d{4})-(\\d{1,2})-(\\d{1,2})").find(s)?.let {
                    target.set(it.groupValues[1].toInt(), it.groupValues[2].toInt() - 1, it.groupValues[3].toInt())
                } ?: run {
                    // "1 january" / "1st of jan", then "january 1" / "dec 31".
                    val dm = Regex("(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?([a-z]{3})[a-z]*").findAll(s)
                        .firstOrNull { MONTHS.indexOf(it.groupValues[2]) >= 0 }?.let { it.groupValues[1].toInt() to MONTHS.indexOf(it.groupValues[2]) }
                    val md = Regex("([a-z]{3})[a-z]*\\s+(\\d{1,2})").findAll(s)
                        .firstOrNull { MONTHS.indexOf(it.groupValues[1]) >= 0 }?.let { it.groupValues[2].toInt() to MONTHS.indexOf(it.groupValues[1]) }
                    val (day, mon) = dm ?: md ?: return null
                    target.set(Calendar.MONTH, mon); target.set(Calendar.DAY_OF_MONTH, day)
                }
            }
        }
        if (target.before(now) && !Regex("\\d{4}-").containsMatchIn(s)) target.add(Calendar.YEAR, 1)
        val days = ((target.timeInMillis - now.timeInMillis) / 86_400_000L)
        return "${SimpleDateFormat("EEEE d MMMM yyyy", Locale.getDefault()).format(target.time)} is " +
            when { days == 0L -> "today! 🎉"; days < 0 -> "${-days} days ago."; else -> "in $days days." }
    }
}

/** A morning summary built entirely on the phone. */
object Briefing {
    fun build(ctx: Context): String {
        val v = DeviceInfo.read(ctx)
        val b = v.battery
        val greeting = when (Calendar.getInstance().get(Calendar.HOUR_OF_DAY)) { in 5..11 -> "Good morning"; in 12..17 -> "Good afternoon"; else -> "Good evening" }
        return buildString {
            appendLine("$greeting! ${SimpleDateFormat("EEEE d MMMM, HH:mm", Locale.getDefault()).format(Date())}.")
            appendLine("- Battery ${b.level}%${if (b.charging) " (charging)" else ""}, ${b.tempC}°C")
            appendLine("- Storage ${pct(v.storageFree, v.storageTotal)}% free (${bytes(v.storageFree)})")
            val notes = Prefs(ctx).notes
            if (notes.isNotEmpty()) appendLine("- ${notes.size} note(s); latest: ${notes.last().substringAfter(" · ")}")
            if (NotificationCatcher.granted(ctx)) {
                val missed = NotificationCatcher.recent(ctx, 12 * 60, 100).lines().filter { it.startsWith("[") }
                if (missed.isNotEmpty()) {
                    val apps = missed.map { it.substringAfter("] ").substringBefore(":") }.groupingBy { it }.eachCount()
                        .entries.sortedByDescending { it.value }.take(4).joinToString { "${it.key} ${it.value}" }
                    appendLine("- ${missed.size} notifications in the last 12 h ($apps)")
                }
            }
            if (ContentFilter.active) appendLine("- 🛡 Safe mode is on")
            val r = Checkup.run(ctx)
            append("- Phone health ${r.score}/100" + (r.issues.firstOrNull()?.let { "; top tip: ${it.title}" } ?: ""))
        }
    }
}

/** Battery-saving profile: dimmer screen, short timeout, then the battery saver switch. */
object PowerSaver {
    fun apply(ctx: Context, host: Host): String {
        val a = Controls.setBrightness(ctx, host, 30, false)
        if (a.startsWith("Needs")) return a
        Controls.setScreenTimeout(ctx, host, 30)
        host.launch(android.content.Intent(android.provider.Settings.ACTION_BATTERY_SAVER_SETTINGS))
        return "Power saver profile: brightness 30%, screen sleeps after 30 s. I opened Battery saver: switch it on to limit background apps too."
    }
}
