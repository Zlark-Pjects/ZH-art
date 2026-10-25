# Tecno Pilot — an AI agent for your Tecno phone

An Android app that looks after a budget Tecno phone (built with the Spark/Pop/BG6i class in mind: HiOS, 3–4 GB RAM, eMMC storage). You chat with **Pilot**, a Claude agent that can measure the phone and act on it, and there's an offline **Phone Doctor** that works without an API key.

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
| **Daily health notification** | Once a day, the offline checkup's score and top issues, no API calls. |

## Install on the phone

1. Get the APK: open the **Tecno Pilot APK** workflow run in this repo's GitHub Actions and download the `TecnoPilot-apk` artifact (or build it yourself, below).
2. On the phone, open the APK and allow "Install unknown apps" for your browser or file manager when asked.
3. Open Tecno Pilot › **Setup**: paste a Claude API key (from console.anthropic.com › API keys) and tap **Allow** on each permission you want. Every permission unlocks one tool; the app still works without them.
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
  Agent.kt              Claude tool loop (Anthropic Java SDK), system prompt with Tecno know-how
  Tools.kt              The tool catalogue: names, descriptions, input schemas, handlers
  MainActivity.kt       Pilot chat, Doctor dashboard, Setup; system dialogs for delete/uninstall
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
