package app.tecnopilot

import android.app.Application
import java.io.File
import java.io.PrintWriter
import java.io.StringWriter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Saves the error if the app ever crashes, so it can be shown (and copied) on the next launch.
 * Nothing is sent anywhere.
 */
class PilotApp : Application() {
    override fun onCreate() {
        super.onCreate()
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, error ->
            runCatching {
                val trace = StringWriter().also { error.printStackTrace(PrintWriter(it)) }.toString()
                val info = packageManager.getPackageInfo(packageName, 0)
                crashFile(this).writeText(
                    "Tecno Pilot ${info.versionName} (${info.longVersionCode}) crashed " +
                        SimpleDateFormat("d MMM HH:mm", Locale.US).format(Date()) +
                        " on ${android.os.Build.MANUFACTURER} ${android.os.Build.MODEL}, Android ${android.os.Build.VERSION.RELEASE}, thread ${thread.name}\n" +
                        trace.take(6000),
                )
            }
            previous?.uncaughtException(thread, error)
        }
    }

    companion object {
        fun crashFile(ctx: android.content.Context) = File(ctx.filesDir, "last_crash.txt")

        /** The saved crash report, removed once read. */
        fun takeCrash(ctx: android.content.Context): String? {
            val f = crashFile(ctx)
            if (!f.exists()) return null
            return runCatching { f.readText() }.getOrNull().also { f.delete() }
        }
    }
}
