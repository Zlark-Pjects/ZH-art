package app.tecnopilot

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.wifi.WifiManager
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale

object Network {

    fun isOnline(ctx: Context): Boolean {
        val cm = ctx.getSystemService(ConnectivityManager::class.java)
        val caps = cm.getNetworkCapabilities(cm.activeNetwork) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }

    fun status(ctx: Context): String {
        val cm = ctx.getSystemService(ConnectivityManager::class.java)
        val caps = cm.getNetworkCapabilities(cm.activeNetwork) ?: return "Offline: no network connection."
        val type = when {
            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "Wi-Fi"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "mobile data"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "ethernet"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN) -> "VPN"
            else -> "other"
        }
        return buildString {
            append("Connected via $type")
            if (caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN)) append(" (through a VPN)")
            append(". Internet ${if (caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)) "works" else "is NOT reachable (captive portal or no signal?)"}.")
            append(" Metered: ${if (cm.isActiveNetworkMetered) "yes" else "no"}.")
            append(" Estimated bandwidth ${caps.linkDownstreamBandwidthKbps / 1000} Mbps down / ${caps.linkUpstreamBandwidthKbps / 1000} Mbps up.")
            if (type == "Wi-Fi") {
                @Suppress("DEPRECATION")
                val info = ctx.applicationContext.getSystemService(WifiManager::class.java).connectionInfo
                val bars = WifiManager.calculateSignalLevel(info.rssi, 5)
                append(" Wi-Fi signal ${info.rssi} dBm ($bars/4 bars), link ${info.linkSpeed} Mbps, ${if (info.frequency > 4900) "5 GHz" else "2.4 GHz"}.")
            }
        }
    }

    /** Latency to Cloudflare plus a timed download, sized down on mobile data. */
    fun speedTest(ctx: Context): String {
        val cm = ctx.getSystemService(ConnectivityManager::class.java)
        if (cm.activeNetwork == null) return "Offline: no network connection."
        val metered = cm.isActiveNetworkMetered
        val pings = (1..4).mapNotNull {
            runCatching {
                val t = System.nanoTime()
                (URL("https://speed.cloudflare.com/__down?bytes=0").openConnection() as HttpURLConnection).run {
                    connectTimeout = 5000; readTimeout = 5000
                    inputStream.use { s -> s.readBytes() }
                    disconnect()
                }
                (System.nanoTime() - t) / 1_000_000
            }.getOrNull()
        }
        if (pings.isEmpty()) return "Speed test server unreachable; the connection may be blocked or very weak."
        val size = if (metered) 5_000_000 else 25_000_000
        var read = 0L
        val start = System.nanoTime()
        runCatching {
            (URL("https://speed.cloudflare.com/__down?bytes=$size").openConnection() as HttpURLConnection).run {
                connectTimeout = 8000; readTimeout = 8000
                inputStream.use { s ->
                    val buf = ByteArray(64 * 1024)
                    while (true) {
                        val n = s.read(buf)
                        if (n < 0) break
                        read += n
                        if (System.nanoTime() - start > 12_000_000_000L) break
                    }
                }
                disconnect()
            }
        }
        val secs = (System.nanoTime() - start) / 1e9
        val mbps = if (secs > 0) read * 8 / secs / 1e6 else 0.0
        val best = pings.drop(1).minOrNull() ?: pings.min()
        val verdict = when {
            mbps >= 25 -> "great: HD video calls and streaming are fine"
            mbps >= 8 -> "good for streaming and browsing"
            mbps >= 2 -> "slow: SD video and chats only"
            else -> "very slow"
        }
        return String.format(
            Locale.US, "Download %.1f Mbps (%s of data used), ping %d ms. Verdict: %s.%s",
            mbps, bytes(read), best, verdict,
            if (metered) " Ran a small test because you're on mobile data." else "",
        )
    }
}
