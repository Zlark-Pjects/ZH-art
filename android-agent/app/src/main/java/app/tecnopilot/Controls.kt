package app.tecnopilot

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.IntentSender
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.provider.AlarmClock
import android.provider.MediaStore
import android.provider.Settings

/** What tools need from the screen: opening things and waiting for system confirmation dialogs. */
interface Host {
    fun launch(intent: Intent): Boolean
    /** Shows a system confirmation (e.g. "Allow Tecno Pilot to delete 12 photos?") and waits for the answer. */
    fun confirm(sender: IntentSender): Boolean
}

object Controls {

    fun setBrightness(ctx: Context, host: Host, percent: Int?, auto: Boolean): String {
        if (!Settings.System.canWrite(ctx)) {
            host.launch(Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS, Uri.parse("package:${ctx.packageName}")))
            return "Needs 'Modify system settings'. I opened that screen: switch it on, then ask again."
        }
        val cr = ctx.contentResolver
        if (auto) {
            Settings.System.putInt(cr, Settings.System.SCREEN_BRIGHTNESS_MODE, Settings.System.SCREEN_BRIGHTNESS_MODE_AUTOMATIC)
            return "Adaptive brightness on."
        }
        val p = (percent ?: 50).coerceIn(1, 100)
        Settings.System.putInt(cr, Settings.System.SCREEN_BRIGHTNESS_MODE, Settings.System.SCREEN_BRIGHTNESS_MODE_MANUAL)
        Settings.System.putInt(cr, Settings.System.SCREEN_BRIGHTNESS, (p * 255 / 100).coerceAtLeast(1))
        return "Brightness set to $p%."
    }

    fun setScreenTimeout(ctx: Context, host: Host, seconds: Int): String {
        if (!Settings.System.canWrite(ctx)) {
            host.launch(Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS, Uri.parse("package:${ctx.packageName}")))
            return "Needs 'Modify system settings'. I opened that screen: switch it on, then ask again."
        }
        val s = seconds.coerceIn(15, 1800)
        Settings.System.putInt(ctx.contentResolver, Settings.System.SCREEN_OFF_TIMEOUT, s * 1000)
        return "Screen now sleeps after ${duration(s * 1000L).replace("<1 min", "$s s")}."
    }

    fun setVolume(ctx: Context, stream: String, percent: Int): String {
        val am = ctx.getSystemService(AudioManager::class.java)
        val st = when (stream) {
            "ring" -> AudioManager.STREAM_RING
            "alarm" -> AudioManager.STREAM_ALARM
            "notification" -> AudioManager.STREAM_NOTIFICATION
            "call" -> AudioManager.STREAM_VOICE_CALL
            else -> AudioManager.STREAM_MUSIC
        }
        val max = am.getStreamMaxVolume(st)
        return runCatching {
            am.setStreamVolume(st, (percent.coerceIn(0, 100) * max + 50) / 100, AudioManager.FLAG_SHOW_UI)
            "$stream volume set to $percent%."
        }.getOrElse { "Couldn't change $stream volume (Do Not Disturb may be blocking it): ${it.message}" }
    }

    fun setRinger(ctx: Context, host: Host, mode: String): String {
        val am = ctx.getSystemService(AudioManager::class.java)
        val nm = ctx.getSystemService(NotificationManager::class.java)
        if (mode == "silent" && !nm.isNotificationPolicyAccessGranted) {
            host.launch(Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS))
            return "Silent mode needs 'Do Not Disturb access'. I opened it: allow Tecno Pilot, then ask again."
        }
        return runCatching {
            am.ringerMode = when (mode) {
                "silent" -> AudioManager.RINGER_MODE_SILENT
                "vibrate" -> AudioManager.RINGER_MODE_VIBRATE
                else -> AudioManager.RINGER_MODE_NORMAL
            }
            "Ringer set to $mode."
        }.getOrElse { "Couldn't change the ringer: ${it.message}" }
    }

    fun setDnd(ctx: Context, host: Host, on: Boolean): String {
        val nm = ctx.getSystemService(NotificationManager::class.java)
        if (!nm.isNotificationPolicyAccessGranted) {
            host.launch(Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS))
            return "Needs 'Do Not Disturb access'. I opened it: allow Tecno Pilot, then ask again."
        }
        nm.setInterruptionFilter(if (on) NotificationManager.INTERRUPTION_FILTER_PRIORITY else NotificationManager.INTERRUPTION_FILTER_ALL)
        return if (on) "Do Not Disturb on (priority only)." else "Do Not Disturb off."
    }

    fun flashlight(ctx: Context, on: Boolean): String {
        val cm = ctx.getSystemService(CameraManager::class.java)
        val id = cm.cameraIdList.firstOrNull {
            val c = cm.getCameraCharacteristics(it)
            c.get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true &&
                c.get(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_BACK
        } ?: return "This phone has no flashlight Pilot can reach."
        return runCatching { cm.setTorchMode(id, on); "Flashlight ${if (on) "on" else "off"}." }
            .getOrElse { "Couldn't switch the flashlight (the camera may be in use)." }
    }

    val SETTINGS_PAGES = mapOf(
        "wifi" to Settings.ACTION_WIFI_SETTINGS,
        "bluetooth" to Settings.ACTION_BLUETOOTH_SETTINGS,
        "mobile_data" to Settings.ACTION_DATA_ROAMING_SETTINGS,
        "data_usage" to Settings.ACTION_DATA_USAGE_SETTINGS,
        "battery" to Intent.ACTION_POWER_USAGE_SUMMARY,
        "battery_saver" to Settings.ACTION_BATTERY_SAVER_SETTINGS,
        "storage" to Settings.ACTION_INTERNAL_STORAGE_SETTINGS,
        "display" to Settings.ACTION_DISPLAY_SETTINGS,
        "sound" to Settings.ACTION_SOUND_SETTINGS,
        "apps" to Settings.ACTION_MANAGE_APPLICATIONS_SETTINGS,
        "default_apps" to Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS,
        "notifications" to "android.settings.ALL_APPS_NOTIFICATION_SETTINGS",
        "location" to Settings.ACTION_LOCATION_SOURCE_SETTINGS,
        "security" to Settings.ACTION_SECURITY_SETTINGS,
        "accessibility" to Settings.ACTION_ACCESSIBILITY_SETTINGS,
        "developer" to Settings.ACTION_APPLICATION_DEVELOPMENT_SETTINGS,
        "about" to Settings.ACTION_DEVICE_INFO_SETTINGS,
        "system_update" to "android.settings.SYSTEM_UPDATE_SETTINGS",
        "date_time" to Settings.ACTION_DATE_SETTINGS,
        "language" to Settings.ACTION_LOCALE_SETTINGS,
        "internet_panel" to Settings.Panel.ACTION_INTERNET_CONNECTIVITY,
        "volume_panel" to Settings.Panel.ACTION_VOLUME,
        "settings" to Settings.ACTION_SETTINGS,
    )

    fun openSettings(host: Host, page: String): String {
        val action = SETTINGS_PAGES[page] ?: return "Unknown page '$page'. Pages: ${SETTINGS_PAGES.keys.joinToString()}."
        if (host.launch(Intent(action))) return "Opened $page settings."
        if (page == "developer") return "Developer options are hidden. Settings › About phone › tap 'Build number' 7 times to unlock them."
        return if (host.launch(Intent(Settings.ACTION_SETTINGS))) "That page isn't on this phone; opened Settings instead." else "Couldn't open settings."
    }

    fun manageApp(ctx: Context, host: Host, pkg: String, action: String): String {
        val exists = runCatching { ctx.packageManager.getApplicationInfo(pkg, 0) }.isSuccess
        if (!exists) return "No app with package $pkg is installed."
        val ok = when (action) {
            "open" -> ctx.packageManager.getLaunchIntentForPackage(pkg)?.let(host::launch) ?: false
            "uninstall" -> host.launch(Intent(Intent.ACTION_DELETE, Uri.parse("package:$pkg")))
            "store" -> host.launch(Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$pkg")))
            else -> host.launch(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$pkg")))
        }
        return when {
            !ok -> "Couldn't $action $pkg."
            action == "uninstall" -> "Showed the uninstall prompt for $pkg; the user confirms on screen."
            action == "settings" -> "Opened app info for $pkg. There the user can Force stop, clear Storage › Cache, turn off notifications, or Disable it."
            else -> "Done: $action $pkg."
        }
    }

    fun deleteMedia(ctx: Context, host: Host, ids: List<Long>): String {
        if (Build.VERSION.SDK_INT < 30) return "Deleting from Pilot needs Android 11 or newer."
        val items = StorageScan.find(ctx, ids)
        if (items.isEmpty()) return "None of those ids exist any more."
        val pi = MediaStore.createDeleteRequest(ctx.contentResolver, items.map { it.uri })
        val yes = host.confirm(pi.intentSender)
        return if (yes) "Deleted ${items.size} files, freeing ${bytes(items.sumOf { it.size })} (they go to the system bin if your phone has one)."
        else "The user cancelled; nothing was deleted."
    }

    fun setAlarm(host: Host, hour: Int, minute: Int, label: String?): String {
        val i = Intent(AlarmClock.ACTION_SET_ALARM)
            .putExtra(AlarmClock.EXTRA_HOUR, hour).putExtra(AlarmClock.EXTRA_MINUTES, minute)
            .putExtra(AlarmClock.EXTRA_SKIP_UI, true)
        label?.let { i.putExtra(AlarmClock.EXTRA_MESSAGE, it) }
        return if (host.launch(i)) "Alarm set for %02d:%02d.".format(hour, minute) else "No clock app accepted the alarm."
    }

    fun setTimer(host: Host, seconds: Int, label: String?): String {
        val i = Intent(AlarmClock.ACTION_SET_TIMER).putExtra(AlarmClock.EXTRA_LENGTH, seconds)
            .putExtra(AlarmClock.EXTRA_SKIP_UI, true)
        label?.let { i.putExtra(AlarmClock.EXTRA_MESSAGE, it) }
        return if (host.launch(i)) "Timer started for ${duration(seconds * 1000L).replace("<1 min", "$seconds s")}." else "No clock app accepted the timer."
    }

    fun open(host: Host, what: String, value: String): String {
        val i = when (what) {
            "url" -> Intent(Intent.ACTION_VIEW, Uri.parse(if (value.startsWith("http")) value else "https://$value"))
            "search" -> Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com/search?q=" + Uri.encode(value)))
            "map" -> Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=" + Uri.encode(value)))
            "dial" -> Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + Uri.encode(value)))
            "sms" -> Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:" + Uri.encode(value)))
            "share" -> Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, value), null)
            else -> return "Unknown target '$what'."
        }
        return if (host.launch(i)) "Opened $what." else "Nothing on this phone can open that."
    }
}
