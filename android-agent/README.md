# Tecno Pilot — an AI agent for your Tecno phone

An Android app that looks after a budget Tecno phone (built with the Spark/Pop/BG6i class in mind: HiOS, 3–4 GB RAM, eMMC storage). You chat with **Pilot**, a Claude agent that can measure the phone and act on it, and there's an offline **Phone Doctor** that works without an API key.

## Online and offline

Pilot has two brains, and the badge at the top of the screen shows which one is answering:

- **Online (Claude):** used when there's internet and an API key. Answers any question, explains in depth, chains many tools, and can search the web.
- **Offline (on the phone):** used with no internet, no key, or when Claude can't be reached. It understands phone commands, runs the same tools, and nothing leaves the phone. For example: "checkup", "why is my phone slow?", "free up space", "duplicate photos" → "delete them", "battery", "unused apps", "bloatware", "speed test", "what did I miss?", "brightness 30%", "flashlight on", "silent", "dnd on", "alarm at 6:30", "timer 10 minutes", "remind me in 20 minutes to call mum", "open WhatsApp", "open wifi settings", "night mode", "block porn", "what's using my data?", "note pay bill", "15% of 2400", "5 km to miles", "how do I take a screenshot?". You can combine commands: "brightness 20, dnd on and alarm at 6".

Setup › Online / offline chooses **Auto** (the default: Claude when online, on the phone otherwise), **Online only**, or **Offline only** (nothing is ever sent).

## What it does

| | |
|---|---|
| **Pilot chat** | Ask in plain words: "why is my phone slow?", "free up space", "set me up for the night". Pilot calls ~30 phone tools, explains what it found and fixes what Android lets an app fix. Voice input (mic button) and optional spoken replies. Quick chips for common jobs. Remembers your preferences (`remember` / `forget`). |
| **Phone Doctor** | Offline checkup with a 0–100 health score: storage, RAM, battery heat and health, uptime, animation scales, screen settings, unused apps, enabled bloatware, OS version. Each problem has a one-tap fix, plus "Ask Pilot to fix these". |
| **Storage cleaner** | Where space goes (WhatsApp/Telegram media, camera, screenshots), the biggest files, **duplicate photos/videos** (same size + same first 64 KB) and old screenshots. Deletion goes through Android's own confirmation dialog, so nothing is removed without your tap. |
| **App auditor** | Screen time, most-used apps, apps you haven't opened in 30+ days with their size, uninstall prompts and App-info shortcuts. |
| **Tecno debloat** | Detects common Transsion/HiOS extras (Boomplay, Palm Store, Ella, HiTranslate, Carlcare, Facebook services, …), rates them safe / optional / keep, and writes a **reversible ADB script** (`pm disable-user`) plus 0.5× animation scales. Copy it from the Doctor tab. |
| **Battery coach** | A 7-day battery diary (a reading every ~15 min): drain per hour with the screen on and off, time left, heat, charging-to-100% and deep-discharge habits. A **charge alert** tells you to unplug at 80/85/90%. |
| **Network** | Connection check (does the internet actually work, Wi-Fi signal and band) and a speed test (25 MB on Wi-Fi, 5 MB on mobile data). |
| **Notification digest** | "What did I miss?" — Pilot summarises recent notifications (kept in memory only). |
| **Controls** | Brightness, screen timeout, volume, ringer, Do Not Disturb, flashlight, alarms, timers, reminders, opening apps by name, settings pages, web/maps/dialer/SMS/share. |
| **🛡 Safe mode** | Blocks pornographic and adult sites in every browser and app, and keeps Google, Bing and YouTube in safe mode (SafeSearch / Restricted Mode). Turn it on in Setup or say "block porn". A **PIN** stops it being turned off (Pilot itself can't turn it off when a PIN is set), **Always-on VPN** stops it being disabled from Settings, it comes back after a restart, and you can add your own sites ("block site tiktok.com"). How it works: it uses Android's VPN slot for web-address lookups only. Adult domains are refused on the phone (a built-in list plus name patterns), and other lookups go to CleanBrowsing's free Family filter. Your other traffic never passes through the app. |
| **Data usage** | Which apps used your mobile data or Wi-Fi this month. |
| **Notes & to-dos** | "note buy bread", "my notes", "delete note 2", kept on the phone. |
| **Offline extras** | Calculator ("15% of 2400"), unit converter ("5 km to miles", "2 GB to MB", "100 F in C"), time and date, the biggest apps, and a built-in Tecno/HiOS how-to guide (screenshots, Memory Fusion, developer options, hotspot, app lock, factory reset, safe-mode boot, IMEI, backups, overheating…). |
| **🎙 Offline voice** | Tap the mic and speak; Pilot answers aloud. It uses Android's on-device speech recognition (Android 12+) or the phone's speech service in offline mode, so it works with no internet once the offline speech pack is downloaded (Setup › Voice › Get offline voice). Spoken numbers are understood ("brightness thirty percent", "alarm at half past six", "timer for ten minutes"). **Conversation mode** keeps listening after each answer until you say "stop". There's a **Voice command** shortcut on the app icon, and you can make Pilot your **digital assistant** so holding Home starts it. |
| **More offline helpers** | "Good morning" briefing (battery, storage, notes, missed notifications, health), a "save battery" power-saver profile, a daily screen-time limit reminder, overheating and storage-full alerts, charging-time estimate, "share my phone report", password generator, coin flip and dice, "days until Christmas". |
| **Daily health notification** | Once a day, the offline checkup's score and top issues, no API calls. |

## Install on the phone

1. Get the APK: open the **Tecno Pilot APK** workflow run in this repo's GitHub Actions and download the `TecnoPilot-apk` artifact (or build it yourself, below).
2. On the phone, open the APK and allow "Install unknown apps" for your browser or file manager when asked.
3. Open Tecno Pilot. It works offline straight away. For online answers, go to **Setup** and paste a Claude API key (from console.anthropic.com › API keys). Tap **Allow** on each permission you want; every permission unlocks one tool, and the app still works without them.
4. HiOS stops background apps aggressively. For the battery diary and charge alert, allow **Ignore battery optimisation** in Setup and allow auto-start for Tecno Pilot in **Phone Master**.

The chat uses your API key and is billed to your Anthropic account. Setup lets you pick the model: Opus 5.5 (default, smartest), Sonnet 5.5, or Haiku 5.5 (cheapest). You can also set the thinking effort. The Doctor tab, the background checks and the alerts never call the API.

## Privacy

The API key and everything Pilot remembers are stored in the app's private storage on the phone. Phone data goes to Claude only as tool results while you're chatting. For example, the file list after you ask to free space, or your notifications after you ask what you missed. Notifications are held in memory only, never written to disk.

## Build

Requires JDK 17 and the Android SDK (API 35).

```bash
cd android-agent
./gradlew assembleRelease     # app/build/outputs/apk/release/app-release.apk
```

CI (`.github/workflows/android-agent.yml`) builds it on every push that touches `android-agent/`. Both builds are signed with `app/sideload.jks`, a sideloading key checked into the repo so that every new build installs over the previous one. It is not a Play Store key.

## Layout

```
app/src/main/java/app/tecnopilot/
  Agent.kt              Claude tool loop (Anthropic Java SDK), Tecno know-how; picks online or offline
  OfflineBrain.kt       On-device command understanding: same tools, no internet
  Tools.kt              The tool catalogue: names, descriptions, input schemas, handlers
  MainActivity.kt       Pilot chat, Doctor dashboard, Setup; system dialogs for delete/uninstall
  ContentFilter.kt      Safe mode: DNS-only VPN, adult-site blocklist, family resolver, PIN
  Voice.kt              Offline speech recognition, spoken replies, spoken-number parsing
  Extras.kt             Data usage, biggest apps, notes, calculator, unit converter, Tecno how-to guide
  BootReceiver.kt       Restores Safe mode and background checks after a restart
  Checkup.kt            Offline health score and issue list
  DeviceInfo.kt         RAM, storage, battery, thermal, uptime, screen and animation settings
  StorageScan.kt        MediaStore scans: big files, duplicates, screenshots, folder sizes
  Apps.kt               Usage stats, unused apps, app sizes; Bloat: Tecno preinstall guide + ADB script
  BatteryLog.kt         7-day battery diary and drain analysis
  Network.kt            Connection status and speed test
  Controls.kt           Settings, volume, DND, flashlight, alarms, intents
  PilotJobService.kt    Background battery readings, charge alert, daily checkup notification
  NotificationCatcher.kt  Notification digest
  ReminderReceiver.kt   Reminders
```

Built with framework views only (no AndroidX), so the app stays small and light on a low-RAM phone.
