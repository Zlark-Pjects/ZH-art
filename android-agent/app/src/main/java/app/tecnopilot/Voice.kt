package app.tecnopilot

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.util.Locale

/**
 * Voice in and out, without internet where the phone allows it.
 * Listening prefers Android's on-device recognizer (Android 12+), otherwise the system recognizer
 * with "prefer offline" set. Speaking uses the phone's text-to-speech engine, which works offline.
 * Call everything on the main thread.
 */
class Voice(private val ctx: Context) {

    interface Listener {
        fun onPartial(text: String)
        fun onHeard(text: String)
        fun onVoiceError(message: String, offerDownload: Boolean)
        fun onListeningChanged(listening: Boolean)
    }

    private var recognizer: SpeechRecognizer? = null
    private var onDevice = false
    var listening = false
        private set

    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private val pending = ArrayList<String>()
    /** Runs when the last queued reply has been spoken (used by conversation mode). */
    var onSpokenAll: (() -> Unit)? = null

    fun available(): Boolean = SpeechRecognizer.isRecognitionAvailable(ctx) ||
        (Build.VERSION.SDK_INT >= 31 && SpeechRecognizer.isOnDeviceRecognitionAvailable(ctx))

    /** "On-device" when Android's own offline recognizer is used, "Offline-preferred" otherwise. */
    fun engineName(): String = when {
        Build.VERSION.SDK_INT >= 31 && SpeechRecognizer.isOnDeviceRecognitionAvailable(ctx) -> "on-device"
        SpeechRecognizer.isRecognitionAvailable(ctx) -> "offline-preferred"
        else -> "none"
    }

    fun listen(l: Listener) {
        stopListening()
        stopSpeaking()
        val r = if (Build.VERSION.SDK_INT >= 31 && SpeechRecognizer.isOnDeviceRecognitionAvailable(ctx)) {
            onDevice = true
            SpeechRecognizer.createOnDeviceSpeechRecognizer(ctx)
        } else {
            onDevice = false
            SpeechRecognizer.createSpeechRecognizer(ctx)
        }
        recognizer = r
        r.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) { listening = true; l.onListeningChanged(true) }
            override fun onBeginningOfSpeech() = Unit
            override fun onRmsChanged(rmsdB: Float) = Unit
            override fun onBufferReceived(buffer: ByteArray?) = Unit
            override fun onEndOfSpeech() = Unit
            override fun onEvent(eventType: Int, params: Bundle?) = Unit
            override fun onPartialResults(partial: Bundle?) {
                partial?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()?.let { if (it.isNotBlank()) l.onPartial(it) }
            }
            override fun onResults(results: Bundle?) {
                finish(l)
                val text = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
                if (text.isNullOrBlank()) l.onVoiceError("I didn't catch that. Tap the mic and try again.", false)
                else l.onHeard(text)
            }
            override fun onError(error: Int) {
                finish(l)
                val (msg, download) = explain(error)
                l.onVoiceError(msg, download)
            }
        })
        r.startListening(
            Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault().toLanguageTag())
                .putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
                .putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1),
        )
    }

    private fun finish(l: Listener) {
        listening = false
        l.onListeningChanged(false)
        recognizer?.destroy()
        recognizer = null
    }

    fun stopListening() {
        recognizer?.let { runCatching { it.cancel(); it.destroy() } }
        recognizer = null
        listening = false
    }

    private fun explain(error: Int): Pair<String, Boolean> = when (error) {
        SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT ->
            "I didn't catch that. Tap the mic and speak after the beep." to false
        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS ->
            "Pilot needs the microphone permission for voice commands." to false
        SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT, SpeechRecognizer.ERROR_SERVER,
        12 /* ERROR_LANGUAGE_NOT_SUPPORTED */, 13 /* ERROR_LANGUAGE_UNAVAILABLE */ ->
            ("Voice needs the offline speech pack for your language. Tap 'Get offline voice' in Setup › Voice " +
                "(or Google app › Settings › Voice › Offline speech recognition) and download it once on Wi-Fi.") to true
        SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "The microphone is busy. Try again in a moment." to false
        SpeechRecognizer.ERROR_AUDIO -> "Couldn't record audio. Is another app using the microphone?" to false
        else -> "Voice didn't work (error $error). Try again." to false
    }

    /** Asks Android to download the offline speech model (Android 13+), or opens the settings that do. */
    fun downloadOfflineModel(host: Host) {
        if (Build.VERSION.SDK_INT >= 33 && SpeechRecognizer.isOnDeviceRecognitionAvailable(ctx)) {
            runCatching {
                val r = SpeechRecognizer.createOnDeviceSpeechRecognizer(ctx)
                r.triggerModelDownload(
                    Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                        .putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault().toLanguageTag()),
                )
                r.destroy()
                return
            }
        }
        val google = Intent("com.google.android.googlequicksearchbox.action.VOICE_SETTINGS")
        if (!host.launch(google) && !host.launch(Intent(android.provider.Settings.ACTION_VOICE_INPUT_SETTINGS))) {
            host.launch(Intent(android.provider.Settings.ACTION_SETTINGS))
        }
    }

    // ---- speaking --------------------------------------------------------------------------

    fun speak(text: String) {
        val clean = text.replace(Regex("[*#•`]"), "").replace(Regex("\\s*\\n\\s*-\\s*"), ". ").replace(Regex("\\s+"), " ").trim()
        // Long reports are on screen; read the start.
        val say = if (clean.length > 320) clean.take(300).substringBeforeLast(". ") + ". The rest is on screen." else clean
        if (say.isBlank()) return
        val engine = tts
        if (engine == null) {
            pending += say
            tts = TextToSpeech(ctx) { status ->
                if (status == TextToSpeech.SUCCESS) {
                    ttsReady = true
                    tts?.language = Locale.getDefault()
                    tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                        override fun onStart(id: String?) = Unit
                        override fun onDone(id: String?) { if (tts?.isSpeaking != true) onSpokenAll?.invoke() }
                        @Deprecated("Deprecated in Java")
                        override fun onError(id: String?) = Unit
                    })
                    pending.forEach { utter(it) }
                    pending.clear()
                }
            }
        } else if (ttsReady) utter(say) else pending += say
    }

    private var n = 0
    private fun utter(s: String) { tts?.speak(s, TextToSpeech.QUEUE_ADD, null, "pilot-${n++}") }

    fun isSpeaking() = tts?.isSpeaking == true

    fun stopSpeaking() { runCatching { tts?.stop() } }

    fun shutdown() {
        stopListening()
        runCatching { tts?.shutdown() }
        tts = null
    }
}

/** Turns spoken numbers into digits so commands work by voice: "thirty percent" → "30 percent". */
object SpokenNumbers {
    private val ONES = mapOf(
        "zero" to 0, "one" to 1, "two" to 2, "three" to 3, "four" to 4, "five" to 5, "six" to 6, "seven" to 7,
        "eight" to 8, "nine" to 9, "ten" to 10, "eleven" to 11, "twelve" to 12, "thirteen" to 13, "fourteen" to 14,
        "fifteen" to 15, "sixteen" to 16, "seventeen" to 17, "eighteen" to 18, "nineteen" to 19,
    )
    private val TENS = mapOf("twenty" to 20, "thirty" to 30, "forty" to 40, "fifty" to 50, "sixty" to 60, "seventy" to 70, "eighty" to 80, "ninety" to 90)

    fun normalize(input: String): String {
        val words = input.split(Regex("\\s+"))
        val out = ArrayList<String>()
        var i = 0
        while (i < words.size) {
            val raw = words[i]
            val w = raw.lowercase().trim(',', '.', '?', '!').replace("-", " ")
            val parts = w.split(" ")
            var value: Int? = null
            var used = 1
            if (parts.size == 2 && parts[0] in TENS && parts[1] in ONES) value = TENS[parts[0]]!! + ONES[parts[1]]!!
            else if (w in TENS) {
                value = TENS[w]
                val next = words.getOrNull(i + 1)?.lowercase()?.trim(',', '.', '?', '!')
                if (next != null && next in ONES && ONES[next]!! in 1..9) { value = value!! + ONES[next]!!; used = 2 }
            } else if (w in ONES) value = ONES[w]
            if (value != null && words.getOrNull(i + used)?.lowercase()?.trim(',', '.') == "hundred") { value *= 100; used++ }
            if (value != null && words.getOrNull(i + used)?.lowercase()?.trim(',', '.') == "thousand") { value *= 1000; used++ }
            if (value != null) {
                out += value.toString() + raw.takeLastWhile { it in ",.?!" }
                i += used
            } else {
                out += raw
                i++
            }
        }
        var s = out.joinToString(" ")
        s = s.replace(Regex("(?i)\\b(\\d+)\\s+(percent|per cent)\\b"), "$1%")
        s = s.replace(Regex("(?i)\\bhalf past (\\d{1,2})\\b")) { "${it.groupValues[1]}:30" }
        s = s.replace(Regex("(?i)\\bquarter past (\\d{1,2})\\b")) { "${it.groupValues[1]}:15" }
        s = s.replace(Regex("(?i)\\b(\\d{1,2})\\s+o'?\\s?clock\\b"), "$1:00")
        // "alarm at 6 30" / "wake me at 7 15 am" → 6:30 / 7:15
        s = s.replace(Regex("(?i)\\b(at|for)\\s+(\\d{1,2})\\s+(\\d{2})\\b")) { "${it.groupValues[1]} ${it.groupValues[2]}:${it.groupValues[3]}" }
        s = s.replace(Regex("(?i)\\b(\\d{1,2})\\s*(a\\.?m\\.?|p\\.?m\\.?)")) { "${it.groupValues[1]}${it.groupValues[2].replace(".", "").lowercase()}" }
        return s
    }
}
