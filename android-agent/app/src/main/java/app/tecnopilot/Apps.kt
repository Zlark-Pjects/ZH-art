package app.tecnopilot

import android.app.AppOpsManager
import android.app.usage.StorageStatsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.os.Process
import android.os.storage.StorageManager

data class AppEntry(
    val pkg: String,
    val label: String,
    val system: Boolean,
    val enabled: Boolean,
    val installedAt: Long,
    val launchable: Boolean,
)

object Apps {

    fun hasUsageAccess(ctx: Context): Boolean {
        val ops = ctx.getSystemService(AppOpsManager::class.java)
        return ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.packageName) ==
            AppOpsManager.MODE_ALLOWED
    }

    private const val NO_USAGE =
        "No usage access yet. Open the Setup tab and allow 'Usage access' so Pilot can see which apps you use."

    fun installed(ctx: Context): List<AppEntry> {
        val pm = ctx.packageManager
        val launchable = pm.queryIntentActivities(
            Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER), 0,
        ).map { it.activityInfo.packageName }.toSet()
        return pm.getInstalledApplications(PackageManager.MATCH_DISABLED_COMPONENTS).map { ai ->
            AppEntry(
                pkg = ai.packageName,
                label = pm.getApplicationLabel(ai).toString(),
                system = ai.flags and ApplicationInfo.FLAG_SYSTEM != 0 &&
                    ai.flags and ApplicationInfo.FLAG_UPDATED_SYSTEM_APP == 0,
                enabled = ai.enabled,
                installedAt = runCatching { pm.getPackageInfo(ai.packageName, 0).firstInstallTime }.getOrDefault(0),
                launchable = ai.packageName in launchable,
            )
        }
    }

    /** App + data + cache size. Needs usage access; returns null without it. */
    fun sizeOf(ctx: Context, pkg: String): Long? = runCatching {
        val ssm = ctx.getSystemService(StorageStatsManager::class.java)
        val s = ssm.queryStatsForPackage(StorageManager.UUID_DEFAULT, pkg, Process.myUserHandle())
        s.appBytes + s.dataBytes
    }.getOrNull()

    fun usage(ctx: Context, days: Int): String {
        if (!hasUsageAccess(ctx)) return NO_USAGE
        val usm = ctx.getSystemService(UsageStatsManager::class.java)
        val now = System.currentTimeMillis()
        val stats = usm.queryAndAggregateUsageStats(now - days * 86_400_000L, now)
        val labels = installed(ctx).associateBy { it.pkg }
        val top = stats.values
            .filter { it.totalTimeInForeground > 60_000 && it.packageName != ctx.packageName }
            .filter { labels[it.packageName]?.launchable == true }
            .sortedByDescending { it.totalTimeInForeground }
        val total = top.sumOf { it.totalTimeInForeground }
        return buildString {
            appendLine("Screen time over the last $days day(s): ${duration(total)} (about ${duration(total / days)} a day).")
            appendLine("Top apps:")
            top.take(12).forEach {
                appendLine(" - ${labels[it.packageName]?.label ?: it.packageName}: ${duration(it.totalTimeInForeground)}")
            }
        }.trimEnd()
    }

    data class Idle(val app: AppEntry, val size: Long?, val lastUsed: Long)

    /** Apps the user installed, can open, and hasn't opened in [days] days; biggest first. */
    fun idleApps(ctx: Context, days: Int, withSizes: Boolean = true): List<Idle> {
        val usm = ctx.getSystemService(UsageStatsManager::class.java)
        val now = System.currentTimeMillis()
        val lastUsed = usm.queryAndAggregateUsageStats(now - 400L * 86_400_000L, now)
            .mapValues { it.value.lastTimeUsed }
        val cutoff = now - days * 86_400_000L
        return installed(ctx)
            .filter { it.launchable && !it.system && it.pkg != ctx.packageName }
            .filter { it.installedAt < cutoff && (lastUsed[it.pkg] ?: 0L) < cutoff }
            .map { Idle(it, if (withSizes) sizeOf(ctx, it.pkg) else null, lastUsed[it.pkg] ?: 0L) }
            .sortedByDescending { it.size ?: 0 }
    }

    fun unused(ctx: Context, days: Int): String {
        if (!hasUsageAccess(ctx)) return NO_USAGE
        val idle = idleApps(ctx, days)
        if (idle.isEmpty()) return "Every app you installed was used in the last $days days."
        return buildString {
            appendLine("${idle.size} apps not opened in $days+ days, using ${bytes(idle.sumOf { it.size ?: 0 })}:")
            idle.forEach { i ->
                val last = if (i.lastUsed > 0) "last used ${daysAgo(i.lastUsed)} days ago" else "never opened"
                appendLine(" - ${i.app.label} (${i.app.pkg}), ${i.size?.let(::bytes) ?: "?"}, $last")
            }
            append("Uninstall with manage_app action=uninstall (the phone asks to confirm).")
        }
    }

    fun list(ctx: Context, filter: String): String {
        val apps = installed(ctx).filter {
            when (filter) {
                "system" -> it.system
                "disabled" -> !it.enabled
                "all" -> true
                else -> !it.system
            }
        }.sortedBy { it.label.lowercase() }
        return buildString {
            appendLine("${apps.size} $filter apps:")
            apps.forEach { appendLine(" - ${it.label} (${it.pkg})${if (!it.enabled) " [disabled]" else ""}") }
        }.trimEnd()
    }

    /** Best match for a spoken or typed app name: "whatsapp", "the camera", "tiktok". */
    fun findLaunchable(ctx: Context, name: String): AppEntry? {
        val q = name.lowercase().removePrefix("the ").trim()
        val apps = installed(ctx).filter { it.launchable && it.enabled }
        return apps.firstOrNull { it.label.lowercase() == q }
            ?: apps.firstOrNull { it.pkg.lowercase() == q }
            ?: apps.filter { it.label.lowercase().contains(q) }.minByOrNull { it.label.length }
            ?: apps.firstOrNull { it.pkg.lowercase().contains(q.replace(" ", "")) }
    }
}

/**
 * Preinstalled apps commonly found on Tecno / HiOS phones (Transsion), and what to do about them.
 * Only apps actually installed on this phone are reported.
 */
object Bloat {
    enum class Verdict(val label: String) {
        SAFE("safe to disable"),
        OPTIONAL("optional — disable if you never use it"),
        KEEP("keep — part of the system"),
    }

    data class Known(val pkg: String, val name: String, val verdict: Verdict, val why: String)

    val KNOWN = listOf(
        Known("com.afmobi.boomplayer", "Boomplay", Verdict.SAFE, "Preinstalled music streaming app; runs background services."),
        Known("com.transsion.aivoiceassistant", "Ella voice assistant", Verdict.SAFE, "HiOS voice assistant; Tecno Pilot or Google Assistant replace it."),
        Known("com.transsion.carlcare", "Carlcare", Verdict.SAFE, "Service-centre app; reinstall if you ever need a repair booking."),
        Known("com.zaz.translate", "HiTranslate", Verdict.SAFE, "Floating translator; Google Translate does the same."),
        Known("com.transsion.tecnospot", "Tecno Spot", Verdict.SAFE, "Brand community / forum app."),
        Known("com.idea.questionnaire", "Questionnaire", Verdict.SAFE, "Survey/feedback prompts."),
        Known("com.transsion.scanningrecharger", "Scan to recharge", Verdict.SAFE, "Airtime voucher scanner."),
        Known("net.bat.store", "Palm Store", Verdict.SAFE, "Third-party app store that pushes app suggestions and notifications."),
        Known("com.transsnet.store", "Palm Store (store service)", Verdict.SAFE, "App store service and its promotions."),
        Known("com.talpa.hibrowser", "Phoenix / Hi Browser", Verdict.OPTIONAL, "Preinstalled browser with news feeds; safe to disable if you use Chrome."),
        Known("com.transsion.phoenix", "Phoenix Browser", Verdict.OPTIONAL, "Preinstalled browser with news feeds; safe to disable if you use Chrome."),
        Known("com.transsion.magicshow", "Visha / video player", Verdict.OPTIONAL, "Transsion's video player."),
        Known("com.facebook.appmanager", "Facebook App Manager", Verdict.SAFE, "Updates preinstalled Facebook apps in the background."),
        Known("com.facebook.services", "Facebook Services", Verdict.SAFE, "Background service for preinstalled Facebook apps."),
        Known("com.facebook.system", "Facebook App Installer", Verdict.SAFE, "Installs Facebook apps; not needed to use Facebook."),
        Known("com.google.android.apps.youtube.music", "YouTube Music", Verdict.OPTIONAL, "Disable if you don't use it."),
        Known("com.google.android.videos", "Google TV", Verdict.OPTIONAL, "Disable if you don't rent films."),
        Known("com.google.android.apps.tachyon", "Google Meet", Verdict.OPTIONAL, "Video calls; disable if you don't use it."),
        Known("com.transsion.phonemaster", "Phone Master", Verdict.KEEP, "HiOS cleaner and auto-start manager; keep it to control which apps may start in the background."),
        Known("com.transsion.hilauncher", "HiOS Launcher", Verdict.KEEP, "Your home screen."),
        Known("com.android.systemui", "System UI", Verdict.KEEP, "Status bar and notifications."),
        Known("com.gallery20", "Gallery", Verdict.KEEP, "The HiOS gallery."),
    )

    private val TRANSSION_PREFIXES = listOf("com.transsion.", "com.talpa.", "com.afmobi.", "net.bat.", "com.transsnet.", "com.hoffnung")

    fun report(ctx: Context): Pair<String, String> {
        val installed = Apps.installed(ctx).associateBy { it.pkg }
        val found = KNOWN.filter { it.pkg in installed }
        val knownPkgs = KNOWN.map { it.pkg }.toSet()
        val others = installed.values.filter { a -> a.pkg !in knownPkgs && TRANSSION_PREFIXES.any { a.pkg.startsWith(it) } }
        val text = buildString {
            if (found.isEmpty()) appendLine("None of the common Tecno preinstalls were found.")
            for (v in Bloat.Verdict.values()) {
                val group = found.filter { it.verdict == v }
                if (group.isEmpty()) continue
                appendLine("${v.label.replaceFirstChar(Char::uppercase)}:")
                group.forEach {
                    val state = if (installed[it.pkg]?.enabled == false) "already disabled" else "enabled"
                    appendLine(" - ${it.name} (${it.pkg}), $state. ${it.why}")
                }
            }
            if (others.isNotEmpty()) {
                appendLine("Other Transsion system apps (not classified — leave these unless you know what they do): " +
                    others.joinToString(", ") { "${it.label} (${it.pkg})" })
            }
            appendLine("Without a computer: open each app's settings (manage_app action=settings) and tap Disable or Uninstall updates where HiOS allows it.")
            append("With a computer: the ADB script disables the 'safe' ones for your user; nothing is deleted and every line can be undone with the matching 'pm enable' line.")
        }
        return text to adbScript(found.filter { it.verdict == Verdict.SAFE && installed[it.pkg]?.enabled != false })
    }

    fun adbScript(apps: List<Known>): String = buildString {
        appendLine("# Tecno Pilot debloat script. Run from a computer with USB debugging on:")
        appendLine("#   Settings > About phone > tap 'Build number' 7 times, then Developer options > USB debugging.")
        appendLine("# Disable (reversible):")
        apps.forEach { appendLine("adb shell pm disable-user --user 0 ${it.pkg}   # ${it.name}") }
        appendLine("# Undo:")
        apps.forEach { appendLine("# adb shell pm enable ${it.pkg}") }
        appendLine("# Speed up animations (makes a slow phone feel faster):")
        appendLine("adb shell settings put global window_animation_scale 0.5")
        appendLine("adb shell settings put global transition_animation_scale 0.5")
        appendLine("adb shell settings put global animator_duration_scale 0.5")
    }
}
