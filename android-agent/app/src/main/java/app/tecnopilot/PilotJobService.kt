package app.tecnopilot

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.ComponentName
import android.content.Context
import android.content.Intent

/**
 * Background work, kept light for a low-RAM phone: a battery reading every ~15 minutes
 * (which also drives the charge alert) and one offline checkup notification a day.
 */
class PilotJobService : JobService() {

    override fun onStartJob(params: JobParameters): Boolean {
        Thread {
            runCatching {
                when (params.jobId) {
                    JOB_SAMPLE -> {
                        BatteryLog.record(this)
                        chargeAlert(this)
                    }
                    JOB_DAILY -> if (Prefs(this).dailyCheckup) {
                        val r = Checkup.run(this)
                        val worst = r.issues.take(3).joinToString(" · ") { it.title }
                        notify(this, 2, "Phone health ${r.score}/100", worst.ifEmpty { "All good. Nothing to fix today." })
                    }
                }
            }
            jobFinished(params, false)
        }.start()
        return true
    }

    override fun onStopJob(params: JobParameters) = true

    companion object {
        const val JOB_SAMPLE = 1
        const val JOB_DAILY = 2
        const val CHANNEL = "pilot"

        fun schedule(ctx: Context) {
            val js = ctx.getSystemService(JobScheduler::class.java)
            val cn = ComponentName(ctx, PilotJobService::class.java)
            if (js.getPendingJob(JOB_SAMPLE) == null) {
                js.schedule(JobInfo.Builder(JOB_SAMPLE, cn).setPeriodic(15 * 60_000L).setPersisted(true).build())
            }
            if (js.getPendingJob(JOB_DAILY) == null) {
                js.schedule(
                    JobInfo.Builder(JOB_DAILY, cn).setPeriodic(24 * 3_600_000L).setPersisted(true)
                        .setRequiresBatteryNotLow(true).build(),
                )
            }
        }

        private fun chargeAlert(ctx: Context) {
            val prefs = Prefs(ctx)
            val limit = prefs.chargeLimit
            if (limit <= 0) return
            val b = DeviceInfo.battery(ctx)
            val now = System.currentTimeMillis()
            if (b.charging && b.level >= limit && now - prefs.lastChargeAlertAt > 3 * 3_600_000L) {
                prefs.lastChargeAlertAt = now
                notify(ctx, 3, "Battery at ${b.level}% — unplug now",
                    "Stopping around $limit% instead of 100% keeps the battery healthy for longer.")
            }
        }

        fun notify(ctx: Context, id: Int, title: String, text: String) {
            val nm = ctx.getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(NotificationChannel(CHANNEL, "Tecno Pilot", NotificationManager.IMPORTANCE_DEFAULT))
            val open = PendingIntent.getActivity(
                ctx, id, Intent(ctx, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE,
            )
            val n = Notification.Builder(ctx, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat)
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(Notification.BigTextStyle().bigText(text))
                .setContentIntent(open)
                .setAutoCancel(true)
                .build()
            runCatching { nm.notify(id, n) }
        }
    }
}
