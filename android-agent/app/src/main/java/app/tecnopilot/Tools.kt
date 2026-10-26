package app.tecnopilot

import android.content.Context

/** One phone capability Pilot can use. The same handlers back the offline Doctor buttons. */
class ToolSpec(
    val name: String,
    val description: String,
    val params: List<Param>,
    /** Short status shown in the chat while it runs, e.g. "Checking the battery". */
    val busy: String,
    val run: (Args) -> String,
)

class Param(
    val name: String,
    val type: String,
    val description: String,
    val required: Boolean = false,
    val enum: List<String>? = null,
) {
    fun schema(): Map<String, Any> = buildMap {
        if (type == "id_list") {
            put("type", "array")
            put("items", mapOf("type" to "integer"))
        } else put("type", type)
        put("description", description)
        enum?.let { put("enum", it) }
    }
}

/** Lenient reader for tool inputs: wrong or missing values fall back to defaults. */
class Args(private val m: Map<*, *>) {
    fun str(k: String, def: String = "") = m[k]?.toString()?.takeIf { it.isNotBlank() } ?: def
    fun strOrNull(k: String) = m[k]?.toString()?.takeIf { it.isNotBlank() }
    fun int(k: String, def: Int) = when (val v = m[k]) {
        is Number -> v.toInt()
        is String -> v.toDoubleOrNull()?.toInt() ?: def
        else -> def
    }
    fun intOrNull(k: String) = if (m[k] == null) null else int(k, 0)
    fun bool(k: String, def: Boolean) = when (val v = m[k]) {
        is Boolean -> v
        is String -> v.equals("true", true) || v == "on" || v == "yes"
        else -> def
    }
    fun ids(k: String): List<Long> = when (val v = m[k]) {
        is List<*> -> v.mapNotNull { (it as? Number)?.toLong() ?: it?.toString()?.trim('#')?.toLongOrNull() }
        is String -> v.split(',', ' ').mapNotNull { it.trim('#').toLongOrNull() }
        else -> emptyList()
    }
}

object Tools {

    fun all(ctx: Context, host: Host): List<ToolSpec> {
        val prefs = Prefs(ctx)
        return listOf(
            ToolSpec(
                "phone_checkup",
                "Full health check of this phone: a 0-100 score, problems ranked worst first (storage, RAM, heat, battery, " +
                    "restarts, animations, unused apps, bloatware), and all vital signs. Call this first when the user asks " +
                    "why the phone is slow, hot, laggy, or for a general checkup.",
                emptyList(), "Running a full checkup",
            ) { Checkup.describe(Checkup.run(ctx)) },
            ToolSpec(
                "device_status",
                "Current vital signs: model, Android/HiOS version, chip, RAM, storage, battery, temperature, uptime, screen " +
                    "settings and animation scales. Use for quick factual questions about the phone.",
                emptyList(), "Reading vital signs",
            ) { DeviceInfo.describe(DeviceInfo.read(ctx)) },
            ToolSpec(
                "battery_report",
                "Battery now plus the 7-day battery diary: drain per hour (screen on vs off), time left estimate, heat, and " +
                    "charging habits. Call when the user asks about battery life, drain, charging or battery health.",
                emptyList(), "Checking the battery",
            ) { BatteryLog.report(ctx) },
            ToolSpec(
                "storage_report",
                "Where storage is going: free space, totals for photos/videos/music, biggest folders (WhatsApp, Telegram, " +
                    "camera, downloads), screenshots. Call first when the user wants to free space.",
                emptyList(), "Measuring storage",
            ) { StorageScan.report(ctx) },
            ToolSpec(
                "find_large_files",
                "Lists the biggest photos, videos or audio files with #ids that delete_media accepts.",
                listOf(
                    Param("min_mb", "integer", "Only files at least this big, in MB. Default 50."),
                    Param("limit", "integer", "How many to list. Default 15."),
                    Param("kind", "string", "Which files. Default all.", enum = listOf("all", "image", "video", "audio")),
                ), "Looking for big files",
            ) { a -> StorageScan.largeFiles(ctx, a.int("min_mb", 50), a.int("limit", 15), a.str("kind", "all")) },
            ToolSpec(
                "find_duplicate_photos",
                "Finds identical copies of photos and videos (e.g. the same picture saved by WhatsApp twice). Returns the ids of the extra copies.",
                listOf(Param("limit", "integer", "How many duplicate sets to show. Default 10.")), "Comparing photos",
            ) { a -> StorageScan.duplicatePhotos(ctx, a.int("limit", 10)) },
            ToolSpec(
                "find_old_screenshots",
                "Finds screenshots older than N days and returns their ids.",
                listOf(Param("older_than_days", "integer", "Default 30.")), "Finding old screenshots",
            ) { a -> StorageScan.oldScreenshots(ctx, a.int("older_than_days", 30)) },
            ToolSpec(
                "delete_media",
                "Deletes photos/videos/audio by #id. Android shows the user a confirmation dialog, so nothing is deleted without " +
                    "their tap. Only use ids returned by the find_* tools, and tell the user what will be deleted first.",
                listOf(Param("ids", "id_list", "The #ids to delete.", required = true)), "Waiting for you to confirm",
            ) { a -> Controls.deleteMedia(ctx, host, a.ids("ids")) },
            ToolSpec(
                "app_usage",
                "Screen time and the most-used apps over the last N days.",
                listOf(Param("days", "integer", "1 for today-ish, 7 for a week. Default 7.")), "Reading screen time",
            ) { a -> Apps.usage(ctx, a.int("days", 7).coerceIn(1, 30)) },
            ToolSpec(
                "unused_apps",
                "Apps the user installed but hasn't opened for N days, with their size. Good uninstall candidates.",
                listOf(Param("days", "integer", "Default 30.")), "Finding unused apps",
            ) { a -> Apps.unused(ctx, a.int("days", 30)) },
            ToolSpec(
                "list_apps",
                "Lists installed apps with package names.",
                listOf(Param("filter", "string", "Default user.", enum = listOf("user", "system", "disabled", "all"))), "Listing apps",
            ) { a -> Apps.list(ctx, a.str("filter", "user")) },
            ToolSpec(
                "bloatware_report",
                "Which Tecno/HiOS preinstalled extras are on this phone, which are safe to disable, and an ADB script to " +
                    "disable them reversibly from a computer. Call when the user asks about bloatware, ads, debloating or speeding up.",
                emptyList(), "Checking preinstalled apps",
            ) { Bloat.report(ctx).let { (text, script) -> "$text\n\nADB script:\n$script" } },
            ToolSpec(
                "manage_app",
                "Acts on an installed app: open it, show the uninstall prompt, open its App info page (force stop, clear cache, " +
                    "disable, notifications), or its Play Store page.",
                listOf(
                    Param("package", "string", "Package name, e.g. com.whatsapp.", required = true),
                    Param("action", "string", "What to do.", required = true, enum = listOf("open", "uninstall", "settings", "store")),
                ), "Opening the app",
            ) { a -> Controls.manageApp(ctx, host, a.str("package"), a.str("action", "settings")) },
            ToolSpec(
                "launch_app",
                "Opens an app by its everyday name (\"WhatsApp\", \"camera\", \"calculator\").",
                listOf(Param("name", "string", "The app name.", required = true)), "Opening the app",
            ) { a ->
                val app = Apps.findLaunchable(ctx, a.str("name"))
                if (app == null) "No app called '${a.str("name")}' is installed."
                else Controls.manageApp(ctx, host, app.pkg, "open").replace(app.pkg, app.label)
            },
            ToolSpec(
                "set_brightness",
                "Sets screen brightness to a percentage, or switches adaptive brightness on.",
                listOf(
                    Param("percent", "integer", "1-100. Ignored when auto is true."),
                    Param("auto", "boolean", "true for adaptive brightness."),
                ), "Changing brightness",
            ) { a -> Controls.setBrightness(ctx, host, a.intOrNull("percent"), a.bool("auto", false)) },
            ToolSpec(
                "set_screen_timeout",
                "Sets how long the screen stays on without touch.",
                listOf(Param("seconds", "integer", "15 to 1800.", required = true)), "Changing screen timeout",
            ) { a -> Controls.setScreenTimeout(ctx, host, a.int("seconds", 30)) },
            ToolSpec(
                "set_volume",
                "Sets a volume level.",
                listOf(
                    Param("stream", "string", "Which volume.", required = true, enum = listOf("media", "ring", "notification", "alarm", "call")),
                    Param("percent", "integer", "0-100.", required = true),
                ), "Changing volume",
            ) { a -> Controls.setVolume(ctx, a.str("stream", "media"), a.int("percent", 50)) },
            ToolSpec(
                "set_ringer",
                "Switches the ringer between normal, vibrate and silent.",
                listOf(Param("mode", "string", "Ringer mode.", required = true, enum = listOf("normal", "vibrate", "silent"))), "Changing ringer",
            ) { a -> Controls.setRinger(ctx, host, a.str("mode", "normal")) },
            ToolSpec(
                "do_not_disturb",
                "Turns Do Not Disturb (priority only) on or off.",
                listOf(Param("on", "boolean", "true to turn it on.", required = true)), "Changing Do Not Disturb",
            ) { a -> Controls.setDnd(ctx, host, a.bool("on", true)) },
            ToolSpec(
                "flashlight",
                "Turns the flashlight on or off.",
                listOf(Param("on", "boolean", "true to turn it on.", required = true)), "Switching the flashlight",
            ) { a -> Controls.flashlight(ctx, a.bool("on", true)) },
            ToolSpec(
                "open_settings",
                "Opens a system settings page so the user can change something Pilot can't change itself (Wi-Fi, " +
                    "battery saver, developer options for animation scales, system updates, …).",
                listOf(Param("page", "string", "Which page.", required = true, enum = Controls.SETTINGS_PAGES.keys.toList())), "Opening settings",
            ) { a -> Controls.openSettings(host, a.str("page", "settings")) },
            ToolSpec(
                "network_status",
                "Connection type, whether the internet actually works, Wi-Fi signal strength and band.",
                emptyList(), "Checking the connection",
            ) { Network.status(ctx) },
            ToolSpec(
                "speed_test",
                "Measures download speed and ping (about 25 MB on Wi-Fi, 5 MB on mobile data). Call when the user asks if " +
                    "the internet is slow.",
                emptyList(), "Testing internet speed",
            ) { Network.speedTest(ctx) },
            ToolSpec(
                "set_alarm",
                "Sets an alarm in the clock app.",
                listOf(
                    Param("hour", "integer", "0-23.", required = true),
                    Param("minute", "integer", "0-59.", required = true),
                    Param("label", "string", "Optional label."),
                ), "Setting an alarm",
            ) { a -> Controls.setAlarm(host, a.int("hour", 7).coerceIn(0, 23), a.int("minute", 0).coerceIn(0, 59), a.strOrNull("label")) },
            ToolSpec(
                "set_timer",
                "Starts a countdown timer in the clock app.",
                listOf(Param("seconds", "integer", "Length.", required = true), Param("label", "string", "Optional label.")), "Starting a timer",
            ) { a -> Controls.setTimer(host, a.int("seconds", 60).coerceAtLeast(1), a.strOrNull("label")) },
            ToolSpec(
                "set_reminder",
                "Posts a notification after N minutes with the given text.",
                listOf(
                    Param("minutes", "integer", "Minutes from now.", required = true),
                    Param("text", "string", "What to remind about.", required = true),
                ), "Setting a reminder",
            ) { a -> ReminderReceiver.schedule(ctx, a.int("minutes", 30).coerceAtLeast(1), a.str("text", "Reminder")) },
            ToolSpec(
                "recent_notifications",
                "Notifications that arrived recently (app, title, text). Call when the user asks what they missed or to " +
                    "summarise messages.",
                listOf(
                    Param("since_minutes", "integer", "How far back. Default 240."),
                    Param("limit", "integer", "Default 40."),
                ), "Reading notifications",
            ) { a -> NotificationCatcher.recent(ctx, a.int("since_minutes", 240), a.int("limit", 40)) },
            ToolSpec(
                "open",
                "Opens a website, a Google search, a place on the map, the dialer with a number, an SMS to a number, or the share sheet with text.",
                listOf(
                    Param("target", "string", "What to open.", required = true, enum = listOf("url", "search", "map", "dial", "sms", "share")),
                    Param("value", "string", "The URL, query, place, number or text.", required = true),
                ), "Opening",
            ) { a -> Controls.open(host, a.str("target", "search"), a.str("value")) },
            ToolSpec(
                "safe_mode",
                "Safe mode blocks pornographic and adult websites in every browser and app on the phone and forces " +
                    "SafeSearch on Google/Bing and Restricted Mode on YouTube. Use action=on when the user wants adult " +
                    "content blocked (for themselves or a child), status to report, off to disable (refused when a PIN is set).",
                listOf(Param("action", "string", "What to do.", required = true, enum = listOf("on", "off", "status"))), "Updating Safe mode",
            ) { a ->
                when (a.str("action", "status")) {
                    "on" -> ContentFilter.turnOn(ctx, host)
                    "off" -> ContentFilter.turnOff(ctx)
                    else -> ContentFilter.status(ctx)
                }
            },
            ToolSpec(
                "block_site",
                "Adds a website to the Safe mode blocklist (e.g. a site the user finds distracting or inappropriate).",
                listOf(Param("site", "string", "Domain such as example.com.", required = true)), "Blocking the site",
            ) { a -> ContentFilter.blockSite(ctx, a.str("site")) },
            ToolSpec(
                "data_usage",
                "Which apps used the most mobile data or Wi-Fi. Call when the user's data runs out fast or asks what uses data.",
                listOf(
                    Param("days", "integer", "0 for this month (default), or the last N days."),
                    Param("network", "string", "Default mobile.", enum = listOf("mobile", "wifi", "both")),
                ), "Reading data usage",
            ) { a -> DataUsage.report(ctx, a.int("days", 0), a.str("network", "mobile")) },
            ToolSpec(
                "largest_apps",
                "Installed apps ranked by how much storage they use (app + data).",
                listOf(Param("limit", "integer", "Default 12.")), "Measuring apps",
            ) { a -> AppSizes.largest(ctx, a.int("limit", 12)) },
            ToolSpec(
                "notes",
                "The user's notes and to-do list stored on the phone: add one, list them, or remove by number, words or 'all'.",
                listOf(
                    Param("action", "string", "What to do.", required = true, enum = listOf("add", "list", "remove")),
                    Param("text", "string", "The note to add, or which to remove (number, words or 'all')."),
                ), "Updating notes",
            ) { a ->
                when (a.str("action", "list")) {
                    "add" -> Notes.add(ctx, a.str("text"))
                    "remove" -> Notes.remove(ctx, a.str("text", "all"))
                    else -> Notes.list(ctx)
                }
            },
            ToolSpec(
                "briefing",
                "A short summary of the phone and the day: battery, storage, notes, missed notifications, health score. " +
                    "Call for 'good morning', 'brief me' or 'what's up with my phone'.",
                emptyList(), "Preparing your briefing",
            ) { Briefing.build(ctx) },
            ToolSpec(
                "power_saver_profile",
                "Applies a battery-saving profile: brightness 30%, 30 s screen timeout, then opens Battery saver.",
                emptyList(), "Saving power",
            ) { PowerSaver.apply(ctx, host) },
            ToolSpec(
                "screen_time_limit",
                "Sets a daily screen-time limit; Pilot notifies once when it's reached. 0 turns it off.",
                listOf(Param("minutes", "integer", "Daily limit in minutes, e.g. 180.", required = true)), "Setting the limit",
            ) { a ->
                val m = a.int("minutes", 0).coerceIn(0, 24 * 60)
                prefs.screenLimitMin = m
                if (m == 0) "Screen-time limit off." else "I'll remind you when you pass ${duration(m * 60_000L)} of screen time in a day." +
                    if (!Apps.hasUsageAccess(ctx)) " (Allow Usage access in Setup for this to work.)" else ""
            },
            ToolSpec(
                "share_report",
                "Opens the share sheet with a full phone report (checkup + battery + storage), e.g. to send to a repair shop or friend.",
                emptyList(), "Preparing the report",
            ) {
                val text = "Tecno Pilot phone report\n\n" + Checkup.describe(Checkup.run(ctx)) + "\n\n" + BatteryLog.report(ctx) + "\n\n" + StorageScan.report(ctx)
                Controls.open(host, "share", text)
            },
            ToolSpec(
                "generate_password",
                "Creates a strong random password on the phone.",
                listOf(Param("length", "integer", "Default 16.")), "Making a password",
            ) { a -> Handy.password(a.int("length", 16)) },
            ToolSpec(
                "update_app",
                "Checks GitHub for a newer version of Tecno Pilot, or downloads and installs it (the user confirms Android's install screen). " +
                    "Call for 'check for updates' / 'update the app'.",
                listOf(Param("action", "string", "check or install.", required = true, enum = listOf("check", "install"))), "Checking for updates",
            ) { a ->
                val (msg, r) = Updater.check(ctx)
                when {
                    a.str("action", "check") != "install" || r == null -> msg
                    !Updater.canInstall(ctx) -> {
                        host.launch(Updater.allowInstallsIntent(ctx))
                        "To update itself Pilot needs 'Install unknown apps'. I opened that screen: switch it on, then ask again."
                    }
                    else -> runCatching {
                        Updater.install(ctx, Updater.download(ctx, r) {})
                        "Downloaded version ${r.name}. Tap Update on Android's screen to install it."
                    }.getOrElse { "Update failed: ${it.message}" }
                }
            },
            ToolSpec(
                "remember",
                "Saves a short fact about the user or their preferences for future chats (\"prefers short answers\", \"uses WhatsApp Business\").",
                listOf(Param("fact", "string", "One short sentence.", required = true)), "Remembering",
            ) { a ->
                val fact = a.str("fact").take(200)
                prefs.memories = (prefs.memories + fact).takeLast(30)
                "Saved. I now remember ${prefs.memories.size} things."
            },
            ToolSpec(
                "forget",
                "Removes saved facts containing the given words, or all of them.",
                listOf(Param("match", "string", "Words to match, or 'everything'.", required = true)), "Forgetting",
            ) { a ->
                val m = a.str("match")
                val before = prefs.memories
                prefs.memories = if (m == "everything") emptyList() else before.filterNot { it.contains(m, true) }
                "Forgot ${before.size - prefs.memories.size} item(s)."
            },
        )
    }
}
