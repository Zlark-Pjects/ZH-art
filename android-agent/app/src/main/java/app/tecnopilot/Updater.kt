package app.tecnopilot

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.net.Uri
import android.os.Build
import android.provider.Settings
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

/**
 * Self-update from this app's GitHub releases. Every CI build publishes TecnoPilot.apk and
 * version.json to the "tecno-pilot-latest" release; Pilot compares version numbers, downloads the
 * APK, checks its SHA-256 and hands it to Android's installer. Android only accepts it if it is
 * signed with the same key as the installed app, so settings and data are kept.
 */
object Updater {
    private const val BASE = "https://github.com/Zlark-Pjects/ZH-art/releases/download/tecno-pilot-latest/"

    data class Release(val code: Long, val name: String, val notes: String, val apk: String, val sha256: String, val size: Long)

    fun currentCode(ctx: Context): Long = ctx.packageManager.getPackageInfo(ctx.packageName, 0).longVersionCode
    fun currentName(ctx: Context): String = ctx.packageManager.getPackageInfo(ctx.packageName, 0).versionName ?: "?"

    /** The latest published build, or null when it can't be reached. */
    fun latest(): Release? = runCatching {
        val c = (URL(BASE + "version.json").openConnection() as HttpURLConnection).apply {
            connectTimeout = 10_000; readTimeout = 10_000; instanceFollowRedirects = true
            setRequestProperty("Cache-Control", "no-cache")
        }
        val text = c.inputStream.use { it.readBytes().toString(Charsets.UTF_8) }
        c.disconnect()
        val j = JSONObject(text)
        Release(
            code = j.getLong("versionCode"),
            name = j.optString("versionName"),
            notes = j.optString("notes"),
            apk = j.optString("apk", BASE + "TecnoPilot.apk"),
            sha256 = j.optString("sha256").lowercase(),
            size = j.optLong("size"),
        )
    }.getOrNull()

    /** One line for the user (and for Pilot's tools). */
    fun check(ctx: Context): Pair<String, Release?> {
        if (!Network.isOnline(ctx)) return "No internet, so I can't check for updates right now." to null
        val r = latest() ?: return "Couldn't reach the update server. Try again later." to null
        Prefs(ctx).lastUpdateCheck = System.currentTimeMillis()
        val cur = currentCode(ctx)
        return if (r.code > cur) {
            "Update available: version ${r.name} (you have ${currentName(ctx)}, ${bytes(r.size)}). What's new: ${r.notes}" to r
        } else {
            "Tecno Pilot is up to date (version ${currentName(ctx)})." to null
        }
    }

    fun canInstall(ctx: Context) = ctx.packageManager.canRequestPackageInstalls()

    fun allowInstallsIntent(ctx: Context) =
        Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${ctx.packageName}"))

    /** Downloads and verifies the APK, reporting progress 0–100. Returns the file or throws. */
    fun download(ctx: Context, r: Release, progress: (Int) -> Unit): File {
        val out = File(ctx.cacheDir, "update.apk")
        val c = (URL(r.apk).openConnection() as HttpURLConnection).apply {
            connectTimeout = 15_000; readTimeout = 30_000; instanceFollowRedirects = true
        }
        val total = c.contentLengthLong.takeIf { it > 0 } ?: r.size
        val md = MessageDigest.getInstance("SHA-256")
        c.inputStream.use { input ->
            out.outputStream().use { o ->
                val buf = ByteArray(64 * 1024)
                var done = 0L
                var last = -1
                while (true) {
                    val n = input.read(buf)
                    if (n < 0) break
                    o.write(buf, 0, n)
                    md.update(buf, 0, n)
                    done += n
                    if (total > 0) {
                        val p = (done * 100 / total).toInt()
                        if (p != last) { last = p; progress(p) }
                    }
                }
            }
        }
        c.disconnect()
        val hash = md.digest().joinToString("") { "%02x".format(it) }
        if (r.sha256.isNotEmpty() && hash != r.sha256) {
            out.delete()
            error("The download was corrupted (checksum mismatch). Try again.")
        }
        return out
    }

    /** Hands the APK to Android's installer; the user confirms on screen. */
    fun install(ctx: Context, apk: File) {
        val pi = ctx.packageManager.packageInstaller
        val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply {
            setAppPackageName(ctx.packageName)
            if (Build.VERSION.SDK_INT >= 31) setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
        }
        val id = pi.createSession(params)
        pi.openSession(id).use { s ->
            s.openWrite("TecnoPilot.apk", 0, apk.length()).use { o -> apk.inputStream().use { it.copyTo(o) }; s.fsync(o) }
            val flags = PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0)
            val status = PendingIntent.getBroadcast(ctx, id, Intent(ctx, InstallReceiver::class.java), flags)
            s.commit(status.intentSender)
        }
    }
}

/** Receives the installer's answer; shows Android's confirmation screen when it asks for one. */
class InstallReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        when (val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)) {
            PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                @Suppress("DEPRECATION")
                val confirm = intent.getParcelableExtra<Intent>(Intent.EXTRA_INTENT) ?: return
                confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                runCatching { ctx.startActivity(confirm) }
            }
            PackageInstaller.STATUS_SUCCESS -> Unit // the app restarts as the new version
            else -> {
                val msg = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE) ?: "status $status"
                val why = if (status == PackageInstaller.STATUS_FAILURE_CONFLICT || status == PackageInstaller.STATUS_FAILURE_INCOMPATIBLE)
                    " The update is signed differently from the installed app; uninstall Tecno Pilot once and install the new APK." else ""
                PilotJobService.notify(ctx, 7, "Update didn't install", msg + why)
            }
        }
    }
}
