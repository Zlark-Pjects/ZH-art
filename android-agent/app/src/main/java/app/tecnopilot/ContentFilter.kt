package app.tecnopilot

import android.content.Context
import android.content.Intent
import android.net.VpnService
import android.os.ParcelFileDescriptor
import android.provider.Settings
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.security.MessageDigest
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger

/**
 * Safe mode: blocks pornographic and adult sites in every app and browser.
 *
 * Android's VPN slot is used only for DNS: the phone asks this service for every web address, and
 * the service answers "no such site" for adult domains, then forwards everything else to
 * CleanBrowsing's Family filter (which also blocks adult sites, forces SafeSearch on Google/Bing
 * and Restricted Mode on YouTube). Other traffic does not pass through the app.
 */
class ContentFilter : VpnService() {

    private var tun: ParcelFileDescriptor? = null
    @Volatile private var running = false
    private val pool = Executors.newFixedThreadPool(4)

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stop()
            return START_NOT_STICKY
        }
        if (!running) start()
        return START_STICKY
    }

    override fun onRevoke() = stop()

    override fun onDestroy() {
        stop()
        super.onDestroy()
    }

    private fun start() {
        val iface = runCatching {
            Builder()
                .setSession("Tecno Pilot Safe mode")
                .addAddress(TUN_ADDRESS, 32)
                .addDnsServer(DNS_ADDRESS)
                .addRoute(DNS_ADDRESS, 32)
                .setBlocking(true)
                .establish()
        }.getOrNull() ?: return
        tun = iface
        running = true
        active = true
        Prefs(this).filterWanted = true
        Thread({ loop(iface) }, "safe-mode-dns").start()
    }

    private fun stop() {
        running = false
        active = false
        runCatching { tun?.close() }
        tun = null
        stopSelf()
    }

    private fun loop(iface: ParcelFileDescriptor) {
        val input = FileInputStream(iface.fileDescriptor)
        val output = FileOutputStream(iface.fileDescriptor)
        val buf = ByteArray(32767)
        while (running) {
            val n = runCatching { input.read(buf) }.getOrElse { -1 }
            if (n < 0) break
            if (n == 0) continue
            val packet = buf.copyOf(n)
            val q = Dns.parseQuery(packet) ?: continue
            if (Blocklist.isBlocked(this, q.name)) {
                record(q.name)
                write(output, Dns.reply(q, Dns.blockedAnswer(q.payload)))
            } else {
                pool.execute {
                    val answer = forward(q.payload)
                    if (answer != null && running) write(output, Dns.reply(q, answer))
                }
            }
        }
        runCatching { input.close(); output.close() }
    }

    private fun write(out: FileOutputStream, packet: ByteArray) {
        synchronized(out) { runCatching { out.write(packet) } }
    }

    /** Asks the family resolver, through a socket that bypasses this VPN. */
    private fun forward(query: ByteArray): ByteArray? {
        for (server in UPSTREAM) {
            val answer = runCatching {
                DatagramSocket().use { s ->
                    protect(s)
                    s.soTimeout = 4000
                    s.send(DatagramPacket(query, query.size, InetAddress.getByName(server), 53))
                    val resp = ByteArray(4096)
                    val p = DatagramPacket(resp, resp.size)
                    s.receive(p)
                    resp.copyOf(p.length)
                }
            }.getOrNull()
            if (answer != null) return answer
        }
        return null
    }

    private fun record(domain: String) {
        blockedCount.incrementAndGet()
        synchronized(recent) {
            recent.remove(domain)
            recent.add(0, domain)
            while (recent.size > 20) recent.removeAt(recent.size - 1)
        }
    }

    companion object {
        const val ACTION_STOP = "app.tecnopilot.STOP_FILTER"
        private const val TUN_ADDRESS = "10.111.222.1"
        private const val DNS_ADDRESS = "10.111.222.2"
        /** CleanBrowsing Family filter: adult content blocked, SafeSearch and YouTube Restricted Mode enforced. */
        private val UPSTREAM = listOf("185.228.168.168", "185.228.169.168")
        const val PRIVATE_DNS_HOST = "family-filter-dns.cleanbrowsing.org"

        @Volatile var active = false
            private set
        val blockedCount = AtomicInteger()
        private val recent = ArrayList<String>()

        /** Null when the user already allowed Pilot to use the VPN slot; otherwise the consent screen. */
        fun consentIntent(ctx: Context): Intent? = VpnService.prepare(ctx)

        fun start(ctx: Context) {
            ctx.startService(Intent(ctx, ContentFilter::class.java))
        }

        fun stop(ctx: Context) {
            Prefs(ctx).filterWanted = false
            ctx.startService(Intent(ctx, ContentFilter::class.java).setAction(ACTION_STOP))
        }

        fun turnOn(ctx: Context, host: Host): String {
            if (active) return status(ctx)
            val consent = consentIntent(ctx)
            if (consent != null && !host.launchForResult(consent)) {
                return "Safe mode needs you to tap OK on Android's connection request. Nothing was changed."
            }
            start(ctx)
            repeat(20) { if (!active) Thread.sleep(100) }
            return if (active) status(ctx) else "Safe mode couldn't start. Another VPN may be on; turn it off and try again."
        }

        /** Without a PIN anyone (or Pilot) can turn it off; with one, only Setup with the PIN can. */
        fun turnOff(ctx: Context): String {
            if (!active) return "Safe mode is already off."
            if (Prefs(ctx).filterPinHash.isNotEmpty()) {
                return "Safe mode is protected by a PIN. Turn it off in Setup › Safe mode and enter the PIN."
            }
            stop(ctx)
            return "Safe mode is off. Adult sites are no longer blocked."
        }

        fun blockSite(ctx: Context, site: String): String {
            val d = site.lowercase().trim().removePrefix("https://").removePrefix("http://").removePrefix("www.")
                .substringBefore('/').trim('.')
            if (!Regex("^[a-z0-9-]+(\\.[a-z0-9-]+)+$").matches(d)) return "'$site' doesn't look like a web address."
            val p = Prefs(ctx)
            p.extraBlocked = p.extraBlocked + d
            return "Added $d to the Safe mode blocklist" + if (active) "." else " (it takes effect when Safe mode is on)."
        }

        fun hashPin(pin: String): String =
            MessageDigest.getInstance("SHA-256").digest(("tecnopilot:" + pin).toByteArray())
                .joinToString("") { "%02x".format(it) }

        fun status(ctx: Context): String = buildString {
            val prefs = Prefs(ctx)
            append(if (active) "Safe mode is ON: adult and pornographic sites are blocked in all apps and browsers, " +
                "and Google, Bing and YouTube are kept in safe mode."
            else "Safe mode is OFF.")
            if (active) {
                append(" Blocked ${blockedCount.get()} requests since it started.")
                val r = synchronized(recent) { recent.take(5) }
                if (r.isNotEmpty()) append(" Recently blocked: ${r.joinToString()}.")
            }
            append(if (prefs.filterPinHash.isNotEmpty()) " Turning it off needs the PIN." else " No PIN is set, so anyone can turn it off (set one in Setup › Safe mode).")
            val mode = Settings.Global.getString(ctx.contentResolver, "private_dns_mode")
            val host = Settings.Global.getString(ctx.contentResolver, "private_dns_specifier")
            if (mode == "hostname" && host != PRIVATE_DNS_HOST) {
                append(" Warning: Private DNS is set to $host, which can bypass the filter. Set Private DNS to Automatic or to $PRIVATE_DNS_HOST.")
            }
            if (active) append(" To stop it being switched off: Settings › Network › VPN › Tecno Pilot › turn on 'Always-on VPN' and 'Block connections without VPN'.")
        }
    }
}

/** Adult domains blocked on the phone itself, before any lookup leaves it. */
object Blocklist {
    private val DOMAINS = setOf(
        "pornhub.com", "xvideos.com", "xnxx.com", "xhamster.com", "redtube.com", "youporn.com", "tube8.com",
        "spankbang.com", "eporner.com", "beeg.com", "motherless.com", "brazzers.com", "onlyfans.com", "fansly.com",
        "chaturbate.com", "livejasmin.com", "stripchat.com", "bongacams.com", "camsoda.com", "cam4.com", "myfreecams.com",
        "nhentai.net", "hentaihaven.xxx", "rule34.xxx", "e-hentai.org", "fapello.com", "erome.com", "porn.com",
        "sex.com", "hclips.com", "txxx.com", "porntrex.com", "thumbzilla.com", "tnaflix.com", "drtuber.com",
        "sunporno.com", "4tube.com", "porndig.com", "ixxx.com", "manyvids.com", "clips4sale.com", "adultfriendfinder.com",
        "xhamster.desi", "xhamsterlive.com", "pornpics.com", "imagefap.com", "literotica.com", "f95zone.to",
    )
    private val TOKENS = setOf("porn", "porno", "xxx", "sex", "nsfw", "hentai", "milf", "nude", "nudes", "camgirl", "camgirls", "escort", "escorts")
    private val FRAGMENTS = listOf(
        "pornhub", "xvideo", "xnxx", "xhamster", "redtube", "youporn", "brazzers", "onlyfans", "chaturbate", "livejasmin",
        "stripchat", "bongacams", "camsoda", "spankbang", "eporner", "nhentai", "rule34", "fapello", "pornstar", "porntube",
        "freeporn", "sexcam", "sexchat", "sextube", "xxxvideo", "hentai", "milf",
    )
    private val TLDS = setOf("xxx", "porn", "adult", "sex")

    fun isBlocked(ctx: Context, name: String): Boolean = isBlocked(name, Prefs(ctx).extraBlocked)

    fun isBlocked(name: String, extra: Set<String>): Boolean {
        val d = name.lowercase().trimEnd('.')
        if (d.isEmpty()) return false
        val labels = d.split('.')
        if (labels.last() in TLDS) return true
        for (i in labels.indices) {
            val suffix = labels.drop(i).joinToString(".")
            if (suffix in DOMAINS || suffix in extra) return true
        }
        val words = d.split('.', '-', '_')
        if (words.any { it in TOKENS }) return true
        return FRAGMENTS.any { it in d }
    }
}

/** Just enough DNS-over-IPv4/UDP to read a question and send an answer back. */
object Dns {
    class Query(val srcIp: ByteArray, val dstIp: ByteArray, val srcPort: Int, val dstPort: Int, val payload: ByteArray, val name: String)

    fun parseQuery(p: ByteArray): Query? {
        if (p.size < 28 || (p[0].toInt() shr 4) != 4 || p[9].toInt() != 17) return null
        val ihl = (p[0].toInt() and 0x0f) * 4
        if (p.size < ihl + 8 + 12) return null
        val srcPort = u16(p, ihl)
        val dstPort = u16(p, ihl + 2)
        if (dstPort != 53) return null
        val payload = p.copyOfRange(ihl + 8, p.size)
        val name = questionName(payload) ?: return null
        return Query(p.copyOfRange(12, 16), p.copyOfRange(16, 20), srcPort, dstPort, payload, name)
    }

    private fun questionName(d: ByteArray): String? {
        var i = 12
        val parts = ArrayList<String>()
        while (i < d.size) {
            val len = d[i].toInt() and 0xff
            if (len == 0) return parts.joinToString(".")
            if (len and 0xc0 != 0 || i + 1 + len > d.size) return null
            parts += String(d, i + 1, len, Charsets.US_ASCII)
            i += 1 + len
        }
        return null
    }

    /** NXDOMAIN ("no such site") for the same question. */
    fun blockedAnswer(q: ByteArray): ByteArray {
        val r = q.copyOf()
        r[2] = (0x80 or (q[2].toInt() and 0x01)).toByte() // QR=1, keep RD
        r[3] = 0x83.toByte() // RA=1, RCODE=3
        for (k in 6..11) r[k] = 0 // no answer/authority/additional records
        // Keep only the header and the question.
        var i = 12
        while (i < r.size && r[i].toInt() != 0) i += 1 + (r[i].toInt() and 0xff)
        return r.copyOf(minOf(r.size, i + 5))
    }

    fun reply(q: Query, dns: ByteArray): ByteArray {
        val total = 20 + 8 + dns.size
        val p = ByteArray(total)
        p[0] = 0x45; p[2] = (total shr 8).toByte(); p[3] = total.toByte()
        p[6] = 0x40; p[8] = 64; p[9] = 17
        System.arraycopy(q.dstIp, 0, p, 12, 4)
        System.arraycopy(q.srcIp, 0, p, 16, 4)
        val sum = checksum(p, 0, 20)
        p[10] = (sum shr 8).toByte(); p[11] = sum.toByte()
        val udpLen = 8 + dns.size
        p[20] = (q.dstPort shr 8).toByte(); p[21] = q.dstPort.toByte()
        p[22] = (q.srcPort shr 8).toByte(); p[23] = q.srcPort.toByte()
        p[24] = (udpLen shr 8).toByte(); p[25] = udpLen.toByte()
        // UDP checksum 0 = "not computed", which IPv4 allows.
        System.arraycopy(dns, 0, p, 28, dns.size)
        return p
    }

    private fun u16(b: ByteArray, i: Int) = ((b[i].toInt() and 0xff) shl 8) or (b[i + 1].toInt() and 0xff)

    private fun checksum(b: ByteArray, off: Int, len: Int): Int {
        var s = 0L
        var i = off
        while (i < off + len) { s += u16(b, i); i += 2 }
        while (s shr 16 != 0L) s = (s and 0xffff) + (s shr 16)
        return (s.inv() and 0xffff).toInt()
    }
}
