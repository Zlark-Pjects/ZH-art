package app.tecnopilot

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Build
import android.os.Environment
import android.os.PowerManager
import android.os.StatFs
import android.os.SystemClock
import android.provider.Settings
import java.io.File

/** A one-shot reading of the phone's vital signs. */
data class Vitals(
    val maker: String,
    val model: String,
    val device: String,
    val android: String,
    val sdk: Int,
    val securityPatch: String,
    val hiOs: String?,
    val soc: String?,
    val cores: Int,
    val maxCpuMhz: Int?,
    val ramTotal: Long,
    val ramAvail: Long,
    val lowMemory: Boolean,
    val storageTotal: Long,
    val storageFree: Long,
    val battery: BatterySnapshot,
    val thermal: String?,
    val uptimeMs: Long,
    val powerSave: Boolean,
    val pilotUnrestricted: Boolean,
    val brightness: Int?,
    val autoBrightness: Boolean?,
    val screenTimeoutMs: Long?,
    val animatorScale: Float,
    val transitionScale: Float,
    val windowScale: Float,
)

data class BatterySnapshot(
    val level: Int,
    val charging: Boolean,
    val plugged: String,
    val tempC: Float,
    val voltageMv: Int,
    val health: String,
    val technology: String?,
    val currentMa: Int?,
    val cycleCount: Int?,
)

object DeviceInfo {

    fun battery(ctx: Context): BatterySnapshot {
        val i: Intent? = ctx.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val level = i?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale = i?.getIntExtra(BatteryManager.EXTRA_SCALE, 100) ?: 100
        val status = i?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
        val plugged = when (i?.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) ?: 0) {
            BatteryManager.BATTERY_PLUGGED_AC -> "charger"
            BatteryManager.BATTERY_PLUGGED_USB -> "USB"
            BatteryManager.BATTERY_PLUGGED_WIRELESS -> "wireless"
            else -> "not plugged in"
        }
        val health = when (i?.getIntExtra(BatteryManager.EXTRA_HEALTH, 0) ?: 0) {
            BatteryManager.BATTERY_HEALTH_GOOD -> "good"
            BatteryManager.BATTERY_HEALTH_OVERHEAT -> "overheating"
            BatteryManager.BATTERY_HEALTH_DEAD -> "dead"
            BatteryManager.BATTERY_HEALTH_OVER_VOLTAGE -> "over voltage"
            BatteryManager.BATTERY_HEALTH_COLD -> "cold"
            BatteryManager.BATTERY_HEALTH_UNSPECIFIED_FAILURE -> "failure"
            else -> "unknown"
        }
        val bm = ctx.getSystemService(BatteryManager::class.java)
        // CURRENT_NOW is µA on most phones, but some MediaTek/Unisoc kernels report mA.
        val rawCurrent = bm?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CURRENT_NOW)
        val currentMa = rawCurrent?.takeIf { it != Int.MIN_VALUE && it != 0 }?.let {
            if (kotlin.math.abs(it) > 20_000) it / 1000 else it
        }
        val cycles = if (Build.VERSION.SDK_INT >= 34) {
            i?.getIntExtra(BatteryManager.EXTRA_CYCLE_COUNT, -1)?.takeIf { it >= 0 }
        } else null
        return BatterySnapshot(
            level = if (level >= 0) level * 100 / scale else -1,
            charging = status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL,
            plugged = plugged,
            tempC = (i?.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, 0) ?: 0) / 10f,
            voltageMv = i?.getIntExtra(BatteryManager.EXTRA_VOLTAGE, 0) ?: 0,
            health = health,
            technology = i?.getStringExtra(BatteryManager.EXTRA_TECHNOLOGY),
            currentMa = currentMa,
            cycleCount = cycles,
        )
    }

    fun read(ctx: Context): Vitals {
        val am = ctx.getSystemService(ActivityManager::class.java)
        val mem = ActivityManager.MemoryInfo().also { am.getMemoryInfo(it) }
        val stat = StatFs(Environment.getDataDirectory().path)
        val pm = ctx.getSystemService(PowerManager::class.java)
        val cr = ctx.contentResolver
        val thermal = if (Build.VERSION.SDK_INT >= 29) when (pm.currentThermalStatus) {
            PowerManager.THERMAL_STATUS_NONE -> "normal"
            PowerManager.THERMAL_STATUS_LIGHT -> "warm"
            PowerManager.THERMAL_STATUS_MODERATE -> "hot, slowing down a little"
            PowerManager.THERMAL_STATUS_SEVERE -> "very hot, throttling"
            PowerManager.THERMAL_STATUS_CRITICAL, PowerManager.THERMAL_STATUS_EMERGENCY,
            PowerManager.THERMAL_STATUS_SHUTDOWN -> "critical"
            else -> null
        } else null
        return Vitals(
            maker = Build.MANUFACTURER,
            model = Build.MODEL,
            device = Build.DEVICE,
            android = Build.VERSION.RELEASE,
            sdk = Build.VERSION.SDK_INT,
            securityPatch = Build.VERSION.SECURITY_PATCH,
            hiOs = sysProp("ro.tranos.version") ?: sysProp("ro.os_version"),
            soc = if (Build.VERSION.SDK_INT >= 31) "${Build.SOC_MANUFACTURER} ${Build.SOC_MODEL}".trim() else Build.HARDWARE,
            cores = Runtime.getRuntime().availableProcessors(),
            maxCpuMhz = maxCpuMhz(),
            ramTotal = mem.totalMem,
            ramAvail = mem.availMem,
            lowMemory = mem.lowMemory,
            storageTotal = stat.totalBytes,
            storageFree = stat.availableBytes,
            battery = battery(ctx),
            thermal = thermal,
            uptimeMs = SystemClock.elapsedRealtime(),
            powerSave = pm.isPowerSaveMode,
            pilotUnrestricted = pm.isIgnoringBatteryOptimizations(ctx.packageName),
            brightness = runCatching { Settings.System.getInt(cr, Settings.System.SCREEN_BRIGHTNESS) }.getOrNull(),
            autoBrightness = runCatching {
                Settings.System.getInt(cr, Settings.System.SCREEN_BRIGHTNESS_MODE) ==
                    Settings.System.SCREEN_BRIGHTNESS_MODE_AUTOMATIC
            }.getOrNull(),
            screenTimeoutMs = runCatching { Settings.System.getLong(cr, Settings.System.SCREEN_OFF_TIMEOUT) }.getOrNull(),
            animatorScale = Settings.Global.getFloat(cr, Settings.Global.ANIMATOR_DURATION_SCALE, 1f),
            transitionScale = Settings.Global.getFloat(cr, Settings.Global.TRANSITION_ANIMATION_SCALE, 1f),
            windowScale = Settings.Global.getFloat(cr, Settings.Global.WINDOW_ANIMATION_SCALE, 1f),
        )
    }

    fun describe(v: Vitals): String = buildString {
        appendLine("Phone: ${v.maker} ${v.model} (${v.device}), Android ${v.android} (API ${v.sdk}), security patch ${v.securityPatch}")
        v.hiOs?.let { appendLine("HiOS: $it") }
        appendLine("Chip: ${v.soc ?: "unknown"}, ${v.cores} cores" + (v.maxCpuMhz?.let { ", up to $it MHz" } ?: ""))
        appendLine("RAM: ${bytes(v.ramAvail)} free of ${bytes(v.ramTotal)} (${pct(v.ramAvail, v.ramTotal)}% free)" + if (v.lowMemory) " — system reports LOW MEMORY" else "")
        appendLine("Storage: ${bytes(v.storageFree)} free of ${bytes(v.storageTotal)} (${pct(v.storageFree, v.storageTotal)}% free)")
        val b = v.battery
        appendLine(
            "Battery: ${b.level}%, ${if (b.charging) "charging via ${b.plugged}" else "on battery"}, " +
                "${b.tempC}°C, ${b.voltageMv} mV, health ${b.health}" +
                (b.currentMa?.let { ", current $it mA" } ?: "") +
                (b.cycleCount?.let { ", $it charge cycles" } ?: ""),
        )
        v.thermal?.let { appendLine("Temperature status: $it") }
        appendLine("Up for ${duration(v.uptimeMs)} since the last restart")
        appendLine("Battery saver: ${if (v.powerSave) "on" else "off"}")
        appendLine(
            "Screen: brightness ${v.brightness ?: "?"}/255 (${if (v.autoBrightness == true) "auto" else "manual"}), " +
                "sleeps after ${v.screenTimeoutMs?.let { duration(it) } ?: "?"}",
        )
        appendLine("Animation scales: window ${v.windowScale}x, transition ${v.transitionScale}x, animator ${v.animatorScale}x")
        append("Tecno Pilot battery-optimisation exempt: ${if (v.pilotUnrestricted) "yes" else "no (HiOS may stop its background checks)"}")
    }

    private fun maxCpuMhz(): Int? = runCatching {
        (0 until Runtime.getRuntime().availableProcessors()).maxOf { cpu ->
            File("/sys/devices/system/cpu/cpu$cpu/cpufreq/cpuinfo_max_freq").readText().trim().toInt() / 1000
        }
    }.getOrNull()

    /** Reads a system property (HiOS version etc.). Not a public API, so it may fail. */
    private fun sysProp(key: String): String? = runCatching {
        val c = Class.forName("android.os.SystemProperties")
        (c.getMethod("get", String::class.java).invoke(null, key) as String).ifBlank { null }
    }.getOrNull()
}
