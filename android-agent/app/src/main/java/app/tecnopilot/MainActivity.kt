package app.tecnopilot

import android.Manifest
import android.app.Activity
import android.app.AlarmManager
import android.app.NotificationManager
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Intent
import android.content.IntentSender
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.Network as AndroidNetwork
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import android.speech.RecognizerIntent
import android.speech.tts.TextToSpeech
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.view.inputmethod.EditorInfo
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.RadioButton
import android.widget.RadioGroup
import android.widget.ScrollView
import android.widget.Switch
import android.widget.TextView
import android.widget.Toast
import java.util.Locale
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

class MainActivity : Activity(), Host {

    private val ui = Handler(Looper.getMainLooper())
    private val worker = Executors.newCachedThreadPool()
    private lateinit var prefs: Prefs
    private lateinit var agent: Agent
    private var tts: TextToSpeech? = null

    private lateinit var pages: List<View>
    private lateinit var tabs: List<TextView>
    private lateinit var chatList: LinearLayout
    private lateinit var chatScroll: ScrollView
    private lateinit var input: EditText
    private lateinit var sendBtn: ImageButton
    private var busyLine: TextView? = null
    private var thinking = false

    private lateinit var doctorBox: LinearLayout
    private lateinit var resultCard: LinearLayout
    private lateinit var resultText: TextView
    private var resultExtra: String? = null
    private lateinit var permBox: LinearLayout

    private var confirmLatch: CountDownLatch? = null
    @Volatile private var confirmResult = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = Prefs(this)
        agent = Agent(this, this)
        window.statusBarColor = C.BG
        window.navigationBarColor = C.BG

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(C.BG)
        }
        root.addView(header())
        val content = FrameLayout(this)
        pages = listOf(chatPage(), doctorPage(), setupPage())
        pages.forEach { content.addView(it, FrameLayout.LayoutParams(-1, -1)) }
        root.addView(content, lp(h = 0, weight = 1f))
        root.addView(tabBar())
        setContentView(root)
        applyInsets(root)

        show(0)
        watchNetwork()
        PilotJobService.schedule(this)
        worker.execute { runCatching { BatteryLog.record(this) } }
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQ_NOTIF)
    }

    override fun onResume() {
        super.onResume()
        refreshPermissions()
        refreshMode()
    }

    override fun onDestroy() {
        netCallback?.let { runCatching { getSystemService(ConnectivityManager::class.java).unregisterNetworkCallback(it) } }
        tts?.shutdown()
        worker.shutdownNow()
        super.onDestroy()
    }

    // ---- layout -------------------------------------------------------------------------------

    private fun applyInsets(root: View) {
        if (Build.VERSION.SDK_INT >= 30) {
            window.setDecorFitsSystemWindows(false)
            root.setOnApplyWindowInsetsListener { v, insets ->
                val bars = insets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.ime())
                v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
                WindowInsets.CONSUMED
            }
        } else {
            root.fitsSystemWindows = true
        }
    }

    private lateinit var modeBadge: TextView
    private var netCallback: ConnectivityManager.NetworkCallback? = null

    private fun header(): View {
        modeBadge = text("", 12f, bold = true).apply {
            setPadding(dp(10), dp(4), dp(10), dp(4))
            setOnClickListener { show(2) }
        }
        val titles = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            addView(text("Tecno Pilot", 22f, bold = true))
            addView(text("${Build.MANUFACTURER} ${Build.MODEL} · Android ${Build.VERSION.RELEASE}", 13f, C.SUB))
        }
        titles.layoutParams = lp(w = 0, weight = 1f)
        return row(titles, modeBadge).apply { setPadding(dp(18), dp(14), dp(18), dp(8)) }
    }

    /** Shows which brain will answer: Claude (online) or the on-device one (offline). */
    private fun refreshMode() {
        if (!::modeBadge.isInitialized) return
        val claude = agent.usesClaude()
        modeBadge.text = if (claude) "● Online · Claude" else "● Offline · on phone"
        modeBadge.setTextColor(if (claude) C.ACCENT_INK else C.BG)
        modeBadge.background = rounded(this, if (claude) C.ACCENT else C.WARN, 14)
    }

    private fun watchNetwork() {
        val cb = object : ConnectivityManager.NetworkCallback() {
            override fun onCapabilitiesChanged(n: AndroidNetwork, c: NetworkCapabilities) { ui.post { refreshMode() } }
            override fun onLost(n: AndroidNetwork) { ui.postDelayed({ refreshMode() }, 500) }
        }
        runCatching { getSystemService(ConnectivityManager::class.java).registerDefaultNetworkCallback(cb) }
            .onSuccess { netCallback = cb }
        refreshMode()
    }

    private fun tabBar(): View {
        val bar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setBackgroundColor(C.CARD)
            setPadding(dp(8), dp(6), dp(8), dp(6))
        }
        tabs = listOf("💬  Pilot", "🩺  Doctor", "⚙️  Setup").mapIndexed { i, label ->
            text(label, 14f, bold = true).apply {
                gravity = Gravity.CENTER
                setPadding(0, dp(12), 0, dp(12))
                setOnClickListener { show(i) }
            }.also { bar.addView(it, lp(w = 0, weight = 1f)) }
        }
        return bar
    }

    private fun show(i: Int) {
        pages.forEachIndexed { j, p -> p.visibility = if (i == j) View.VISIBLE else View.GONE }
        tabs.forEachIndexed { j, t ->
            t.setTextColor(if (i == j) C.ACCENT_INK else C.SUB)
            t.background = if (i == j) rounded(this, C.ACCENT, 20) else null
        }
        if (i == 2) refreshPermissions()
    }

    // ---- Pilot (chat) -------------------------------------------------------------------------

    private fun chatPage(): View {
        val page = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        chatList = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(14), dp(4), dp(14), dp(12))
        }
        chatScroll = ScrollView(this).apply { addView(chatList); isFillViewport = true }
        page.addView(chatScroll, lp(h = 0, weight = 1f))

        bubble(
            "Hi! I'm Pilot. I can check your phone's health, free up storage, find apps you never use, " +
                "track battery drain, test your internet and change settings for you. What should we fix first?\n\n" +
                "I work online (Claude, for any question) and offline (on the phone, for phone commands). " +
                "The badge at the top shows which one is answering.",
            mine = false,
        )

        val chips = LinearLayout(this).apply { setPadding(dp(10), dp(4), dp(10), dp(4)) }
        listOf(
            "🩺 Full checkup" to "Run a full checkup of my phone and fix what you can.",
            "🐢 Why is it slow?" to "My phone feels slow and laggy. Find out why and help me speed it up.",
            "🧹 Free up space" to "Help me free up storage space. Start with the biggest wins.",
            "🔋 Battery drain" to "How is my battery doing? Why does it drain and how can it last longer?",
            "📦 Apps to remove" to "Which apps can I remove? Show the ones I never use.",
            "🧰 Debloat" to "Which preinstalled Tecno apps can I safely disable?",
            "📶 Internet speed" to "Test my internet speed and tell me if something is wrong.",
            "🔔 What did I miss?" to "Summarise the notifications I missed in the last few hours.",
            "🌙 Night mode" to "Set me up for the night: brightness low, Do Not Disturb on, and an alarm at 6:30.",
        ).forEach { (label, prompt) ->
            chips.addView(text(label, 13f).apply {
                background = rounded(context, C.CARD2, 18, C.LINE)
                setPadding(dp(14), dp(8), dp(14), dp(8))
                setOnClickListener { send(prompt) }
            }, LinearLayout.LayoutParams(-2, -2).apply { rightMargin = dp(8) })
        }
        page.addView(HorizontalScrollView(this).apply {
            isHorizontalScrollBarEnabled = false
            addView(chips)
        })

        input = EditText(this).apply {
            hint = "Ask Pilot anything about your phone…"
            setHintTextColor(C.SUB)
            setTextColor(C.TEXT)
            textSize = 15f
            background = rounded(context, C.CARD, 22, C.LINE)
            setPadding(dp(16), dp(10), dp(16), dp(10))
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES or InputType.TYPE_TEXT_FLAG_MULTI_LINE
            maxLines = 4
            imeOptions = EditorInfo.IME_ACTION_SEND
            setOnEditorActionListener { _, id, _ -> if (id == EditorInfo.IME_ACTION_SEND) { send(); true } else false }
        }
        val mic = iconButton(android.R.drawable.ic_btn_speak_now, "Speak") { listen() }
        sendBtn = iconButton(android.R.drawable.ic_menu_send, "Send") { send() }
        val bar = row(input, mic, sendBtn).apply { setPadding(dp(10), dp(6), dp(10), dp(10)) }
        input.layoutParams = lp(w = 0, weight = 1f)
        page.addView(bar)
        return page
    }

    private fun iconButton(icon: Int, desc: String, onClick: () -> Unit) = ImageButton(this).apply {
        setImageResource(icon)
        setColorFilter(C.ACCENT_INK)
        contentDescription = desc
        background = rounded(context, C.ACCENT, 22)
        layoutParams = LinearLayout.LayoutParams(dp(44), dp(44)).apply { leftMargin = dp(8) }
        setOnClickListener { onClick() }
    }

    private fun bubble(s: String, mine: Boolean, color: Int = if (mine) C.ACCENT else C.CARD) {
        val tv = text(if (mine) s else miniMarkdown(s), 15f, if (mine) C.ACCENT_INK else if (color == C.CRIT || color == C.WARN) C.BG else C.TEXT).apply {
            background = rounded(context, color, 16)
            setPadding(dp(14), dp(10), dp(14), dp(10))
            setTextIsSelectable(true)
        }
        chatList.addView(tv, LinearLayout.LayoutParams(-2, -2).apply {
            topMargin = dp(8)
            gravity = if (mine) Gravity.END else Gravity.START
            if (mine) leftMargin = dp(48) else rightMargin = dp(32)
        })
        scrollDown()
    }

    private fun scrollDown() = chatScroll.post { chatScroll.fullScroll(View.FOCUS_DOWN) }

    private fun setBusy(what: String?) {
        busyLine?.let { chatList.removeView(it) }
        busyLine = null
        if (what != null) {
            busyLine = text("⏳ $what…", 13f, C.SUB).also {
                chatList.addView(it, lp(top = dp(8)))
                scrollDown()
            }
        }
    }

    private fun send(preset: String? = null) {
        val msg = (preset ?: input.text.toString()).trim()
        if (msg.isEmpty() || thinking) return
        show(0)
        input.setText("")
        bubble(msg, mine = true)
        if (msg.lowercase() in setOf("/new", "new chat", "/reset")) {
            agent.reset()
            bubble("Started a fresh conversation.", mine = false)
            return
        }
        refreshMode()
        thinking = true
        sendBtn.isEnabled = false
        setBusy("Thinking")
        worker.execute {
            agent.send(msg) { e ->
                ui.post {
                    when (e) {
                        is Agent.Event.Busy -> setBusy(e.what)
                        is Agent.Event.Reply -> {
                            setBusy(null); bubble(e.text, mine = false); speak(e.text); setBusy("Working")
                        }
                        is Agent.Event.Problem -> { setBusy(null); bubble(e.text, mine = false, color = C.WARN) }
                    }
                }
            }
            ui.post {
                setBusy(null)
                thinking = false
                sendBtn.isEnabled = true
            }
        }
    }

    private fun listen() {
        val i = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            .putExtra(RecognizerIntent.EXTRA_PROMPT, "Ask Pilot")
        try {
            startActivityForResult(i, REQ_VOICE)
        } catch (e: ActivityNotFoundException) {
            toast("No voice typing on this phone. Install or update the Google app.")
        }
    }

    private fun speak(s: String) {
        if (!prefs.speakReplies) return
        val clean = s.replace(Regex("[*#•`]"), "")
        val engine = tts
        if (engine == null) {
            tts = TextToSpeech(this) { status ->
                if (status == TextToSpeech.SUCCESS) {
                    tts?.language = Locale.getDefault()
                    tts?.speak(clean, TextToSpeech.QUEUE_ADD, null, "pilot")
                }
            }
        } else engine.speak(clean, TextToSpeech.QUEUE_ADD, null, "pilot")
    }

    // ---- Doctor (offline dashboard) ------------------------------------------------------------

    private fun doctorPage(): View {
        val col = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(14), dp(4), dp(14), dp(20))
        }
        doctorBox = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        col.addView(card(
            text("Phone Doctor", 18f, bold = true),
            text("A full scan that works offline, no API key needed.", 13f, C.SUB),
            button("Run checkup") { runCheckup() }.apply { layoutParams = lp(top = dp(12)) },
            doctorBox,
        ))

        col.addView(text("Quick tools", 16f, bold = true), lp(top = dp(18)))
        val actions = listOf(
            "🧹 Storage" to { StorageScan.report(this) },
            "🐘 Big files" to { StorageScan.largeFiles(this, 50, 20, "all") },
            "👯 Duplicates" to { StorageScan.duplicatePhotos(this, 10) },
            "🖼 Old screenshots" to { StorageScan.oldScreenshots(this, 30) },
            "📦 Unused apps" to { Apps.unused(this, 30) },
            "⏱ Screen time" to { Apps.usage(this, 7) },
            "🧰 Bloatware" to { Bloat.report(this).let { (t, s) -> resultExtra = s; t } },
            "🔋 Battery" to { BatteryLog.report(this) },
            "📶 Speed test" to { Network.status(this) + "\n\n" + Network.speedTest(this) },
            "🔔 Notifications" to { NotificationCatcher.recent(this, 240, 30) },
            "📋 Vital signs" to { DeviceInfo.describe(DeviceInfo.read(this)) },
            "🔦 Flashlight" to { Controls.flashlight(this, !torchOn).also { torchOn = !torchOn } },
        )
        actions.chunked(2).forEach { pair ->
            val r = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
            pair.forEachIndexed { i, (label, fn) ->
                r.addView(button(label, primary = false) { runQuick(label, fn) },
                    lp(w = 0, weight = 1f).apply { if (i == 1) leftMargin = dp(8) })
            }
            if (pair.size == 1) r.addView(View(this), lp(w = 0, weight = 1f))
            col.addView(r, lp(top = dp(8)))
        }

        resultText = text("", 14f).apply { setTextIsSelectable(true) }
        val copy = button("Copy", primary = false) { copyResult() }
        val ask = button("Ask Pilot about this") {
            send("Here is a report from the Doctor tab. Explain what matters and what I should do:\n\n" + resultText.text)
        }
        resultCard = card(resultText, row(copy, ask.apply { layoutParams = lp(w = 0, weight = 1f).apply { leftMargin = dp(8) } })
            .apply { layoutParams = lp(top = dp(12)) })
        resultCard.visibility = View.GONE
        col.addView(resultCard, lp(top = dp(14)))
        return ScrollView(this).apply { addView(col) }
    }

    private var torchOn = false

    private fun runQuick(label: String, fn: () -> String) {
        resultExtra = null
        resultCard.visibility = View.VISIBLE
        resultText.text = "$label: working…"
        worker.execute {
            val out = runCatching(fn).getOrElse { "Failed: ${it.message}" }
            ui.post {
                resultText.text = out + (resultExtra?.let { "\n\nADB script (tap Copy):\n$it" } ?: "")
            }
        }
    }

    private fun copyResult() {
        val cm = getSystemService(ClipboardManager::class.java)
        cm.setPrimaryClip(ClipData.newPlainText("Tecno Pilot", resultExtra ?: resultText.text))
        toast(if (resultExtra != null) "ADB script copied" else "Copied")
    }

    private fun runCheckup() {
        doctorBox.removeAllViews()
        doctorBox.addView(text("Scanning…", 14f, C.SUB), lp(top = dp(12)))
        worker.execute {
            val r = runCatching { Checkup.run(this) }
            ui.post { r.onSuccess(::showCheckup).onFailure { doctorBox.removeAllViews(); doctorBox.addView(text("Scan failed: ${it.message}")) } }
        }
    }

    private fun showCheckup(r: Checkup.Report) {
        doctorBox.removeAllViews()
        val color = when { r.score >= 80 -> C.ACCENT; r.score >= 55 -> C.WARN; else -> C.CRIT }
        doctorBox.addView(row(
            text("${r.score}", 44f, color, bold = true),
            text("  / 100\n  ${if (r.score >= 80) "In good shape" else if (r.score >= 55) "Could be better" else "Needs attention"}", 14f, C.SUB),
        ), lp(top = dp(12)))
        val v = r.vitals
        doctorBox.addView(text(
            "Storage ${pct(v.storageFree, v.storageTotal)}% free · RAM ${pct(v.ramAvail, v.ramTotal)}% free · " +
                "Battery ${v.battery.level}% at ${v.battery.tempC}°C · up ${duration(v.uptimeMs)}",
            13f, C.SUB,
        ), lp(top = dp(4)))
        if (r.issues.isEmpty()) doctorBox.addView(text("Nothing to fix. 🎉", 15f), lp(top = dp(10)))
        r.issues.forEach { issue ->
            val c = when (issue.level) { Checkup.Level.CRITICAL -> C.CRIT; Checkup.Level.WARN -> C.WARN; else -> C.ACCENT }
            val box = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                background = rounded(context, C.CARD2, 12)
                setPadding(dp(12), dp(10), dp(12), dp(10))
                addView(text("● ${issue.title}", 15f, c, bold = true))
                addView(text(issue.detail, 13f, C.TEXT))
                if (issue.fix != null && issue.fixLabel != null) {
                    addView(button(issue.fixLabel, primary = false) {
                        if (issue.fix == "setup") show(2) else Controls.openSettings(this@MainActivity, issue.fix)
                    }, LinearLayout.LayoutParams(-2, -2).apply { topMargin = dp(8) })
                }
            }
            doctorBox.addView(box, lp(top = dp(8)))
        }
        doctorBox.addView(button("Ask Pilot to fix these") {
            send("Here is my phone checkup. Fix what you can and tell me what to do about the rest:\n\n" + Checkup.describe(r))
        }, lp(top = dp(12)))
    }

    // ---- Setup ---------------------------------------------------------------------------------

    private fun setupPage(): View {
        val col = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(14), dp(4), dp(14), dp(24))
        }

        val key = EditText(this).apply {
            hint = "sk-ant-…"
            setHintTextColor(C.SUB)
            setTextColor(C.TEXT)
            setText(prefs.apiKey)
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
            background = rounded(context, C.CARD2, 12, C.LINE)
            setPadding(dp(12), dp(10), dp(12), dp(10))
        }
        col.addView(card(
            text("Claude API key", 16f, bold = true),
            text("Needed only for online mode. Create a key at console.anthropic.com › API keys and paste it here. It stays on this phone.", 13f, C.SUB),
            key.apply { layoutParams = lp(top = dp(10)) },
            button("Save key") {
                prefs.apiKey = key.text.toString()
                agent.reset()
                toast(if (prefs.apiKey.isBlank()) "Key removed" else "Saved. Say hi to Pilot!")
                refreshMode()
                if (prefs.apiKey.isNotBlank()) show(0)
            }.apply { layoutParams = lp(top = dp(10)) },
        ))

        val modes = RadioGroup(this)
        Prefs.MODES.forEachIndexed { i, (id, label) -> modes.addView(radio(label, 400 + i, id == prefs.mode)) }
        modes.setOnCheckedChangeListener { _, checked -> prefs.mode = Prefs.MODES[checked - 400].first; refreshMode() }
        col.addView(card(
            text("Online / offline", 16f, bold = true),
            text("Offline, Pilot understands phone commands (checkup, clean up, battery, brightness, alarms, open apps…) " +
                "and everything stays on the phone. Online, Claude answers anything and explains in depth.", 13f, C.SUB),
            modes,
        ), lp(top = dp(12)))

        val models = RadioGroup(this)
        Prefs.MODELS.forEachIndexed { i, (id, label) ->
            models.addView(radio(label, 100 + i, id == prefs.model))
        }
        models.setOnCheckedChangeListener { _, checked -> prefs.model = Prefs.MODELS[checked - 100].first; agent.reset() }
        val efforts = RadioGroup(this).apply { orientation = RadioGroup.HORIZONTAL }
        Prefs.EFFORTS.forEachIndexed { i, e -> efforts.addView(radio(e, 200 + i, e == prefs.effort)) }
        efforts.setOnCheckedChangeListener { _, checked -> prefs.effort = Prefs.EFFORTS[checked - 200] }
        col.addView(card(
            text("Model", 16f, bold = true), models,
            text("Thinking effort (higher = smarter but slower and pricier)", 13f, C.SUB).apply { layoutParams = lp(top = dp(8)) },
            efforts,
        ), lp(top = dp(12)))

        val limits = RadioGroup(this).apply { orientation = RadioGroup.HORIZONTAL }
        listOf(0, 80, 85, 90).forEachIndexed { i, v ->
            limits.addView(radio(if (v == 0) "off" else "$v%", 300 + i, prefs.chargeLimit == v))
        }
        limits.setOnCheckedChangeListener { _, checked -> prefs.chargeLimit = listOf(0, 80, 85, 90)[checked - 300] }
        col.addView(card(
            text("Habits", 16f, bold = true),
            switch("Read replies aloud", prefs.speakReplies) { prefs.speakReplies = it },
            switch("Daily health notification", prefs.dailyCheckup) { prefs.dailyCheckup = it },
            text("Charge alert: tell me to unplug at", 14f).apply { layoutParams = lp(top = dp(8)) },
            limits,
        ), lp(top = dp(12)))

        permBox = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        col.addView(card(
            text("Permissions", 16f, bold = true),
            text("Each one unlocks a tool. Pilot never uploads anything unless you ask it a question that needs it.", 13f, C.SUB),
            permBox,
        ), lp(top = dp(12)))

        col.addView(card(
            text("Tecno tip", 16f, bold = true),
            text("HiOS closes background apps aggressively. For the battery diary and charge alert to keep working: " +
                "allow 'Ignore battery optimisation' above, and in Phone Master › App auto-start (or Settings › Apps › Tecno Pilot › Battery) allow Tecno Pilot.", 13f),
            button("Open Phone Master", primary = false) {
                packageManager.getLaunchIntentForPackage("com.transsion.phonemaster")?.let { launch(it) }
                    ?: Controls.openSettings(this, "apps")
            }.apply { layoutParams = lp(top = dp(10)) },
        ), lp(top = dp(12)))
        return ScrollView(this).apply { addView(col) }
    }

    private fun radio(label: String, id: Int, checked: Boolean) = RadioButton(this).apply {
        this.id = id
        text = label
        setTextColor(C.TEXT)
        buttonTintList = android.content.res.ColorStateList.valueOf(C.ACCENT)
        isChecked = checked
    }

    private fun switch(label: String, on: Boolean, onChange: (Boolean) -> Unit) = Switch(this).apply {
        text = label
        setTextColor(C.TEXT)
        isChecked = on
        setPadding(0, dp(8), 0, dp(8))
        setOnCheckedChangeListener { _, v -> onChange(v) }
    }

    private class Perm(val name: String, val why: String, val granted: () -> Boolean, val grant: () -> Unit)

    private fun permissions(): List<Perm> {
        val pkgUri = Uri.parse("package:$packageName")
        val nm = getSystemService(NotificationManager::class.java)
        return listOf(
            Perm("Usage access", "Unused apps, screen time, app sizes", { Apps.hasUsageAccess(this) }) {
                launch(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))
            },
            Perm("Photos, videos & music", "Storage cleaner, big files, duplicates", { StorageScan.hasAccess(this) }) {
                requestPermissions(StorageScan.mediaPermissions(), REQ_MEDIA)
            },
            Perm("Modify system settings", "Brightness and screen timeout", { Settings.System.canWrite(this) }) {
                launch(Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS, pkgUri))
            },
            Perm("Do Not Disturb access", "Silent mode and Do Not Disturb", { nm.isNotificationPolicyAccessGranted }) {
                launch(Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS))
            },
            Perm("Notification access", "\"What did I miss?\" digest", { NotificationCatcher.granted(this) }) {
                launch(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
            },
            Perm("Show notifications", "Reminders, charge alert, daily checkup", {
                Build.VERSION.SDK_INT < 33 || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
            }) {
                if (Build.VERSION.SDK_INT >= 33) requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQ_NOTIF)
            },
            Perm("Alarms & reminders", "On-time reminders", {
                Build.VERSION.SDK_INT < 31 || getSystemService(AlarmManager::class.java).canScheduleExactAlarms()
            }) {
                if (Build.VERSION.SDK_INT >= 31) launch(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, pkgUri))
            },
            Perm("Ignore battery optimisation", "Keeps the battery diary running on HiOS", {
                getSystemService(PowerManager::class.java).isIgnoringBatteryOptimizations(packageName)
            }) {
                @Suppress("BatteryLife")
                launch(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, pkgUri))
            },
        )
    }

    private fun refreshPermissions() {
        if (!::permBox.isInitialized) return
        permBox.removeAllViews()
        permissions().forEach { p ->
            val ok = runCatching(p.granted).getOrDefault(false)
            val label = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                addView(text((if (ok) "✅ " else "⬜ ") + p.name, 15f))
                addView(text(p.why, 12f, C.SUB))
            }
            val r = row(label)
            label.layoutParams = lp(w = 0, weight = 1f)
            if (!ok) r.addView(button("Allow", primary = true) { p.grant() })
            permBox.addView(r, lp(top = dp(10)))
        }
    }

    // ---- Host ----------------------------------------------------------------------------------

    override fun launch(intent: Intent): Boolean {
        if (Looper.myLooper() == Looper.getMainLooper()) return tryStart(intent)
        val done = CountDownLatch(1)
        var ok = false
        ui.post { ok = tryStart(intent); done.countDown() }
        done.await(5, TimeUnit.SECONDS)
        return ok
    }

    private fun tryStart(intent: Intent) = try {
        startActivity(intent); true
    } catch (e: ActivityNotFoundException) {
        false
    } catch (e: SecurityException) {
        false
    }

    override fun confirm(sender: IntentSender): Boolean {
        val latch = CountDownLatch(1)
        confirmLatch = latch
        confirmResult = false
        ui.post {
            try {
                startIntentSenderForResult(sender, REQ_CONFIRM, null, 0, 0, 0)
            } catch (e: IntentSender.SendIntentException) {
                latch.countDown()
            }
        }
        latch.await(5, TimeUnit.MINUTES)
        return confirmResult
    }

    @Deprecated("Activity result API")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        when (requestCode) {
            REQ_CONFIRM -> {
                confirmResult = resultCode == RESULT_OK
                confirmLatch?.countDown()
            }
            REQ_VOICE -> data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull()?.let { send(it) }
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        refreshPermissions()
    }

    private fun toast(s: String) = Toast.makeText(this, s, Toast.LENGTH_SHORT).show()

    companion object {
        private const val REQ_CONFIRM = 11
        private const val REQ_VOICE = 12
        private const val REQ_MEDIA = 13
        private const val REQ_NOTIF = 14
    }
}
