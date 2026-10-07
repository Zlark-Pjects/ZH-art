# ZH-art — a film studio in the browser

Build a short animated film from one idea: compose the storyboard, give it a look, design and animate a cast, score it, and export a real video file. Everything runs in your browser — no accounts, no AI services, no API keys.

## The studio

All five parts work on **one project**, which autosaves in your browser.

| Part | What you do there | Feeds into |
| --- | --- | --- |
| **Storyboard** | Write an idea and **Build**: an offline composer reads places and things in it (space, ocean, forest, city, fire, snow, desert…) and lays out scenes with a story arc, palette, camera moves, shapes, particles and a score. Then edit anything by hand: words, timing, colours, camera (a preset move, or **camera keyframes** with zoom, pan, rise and easing, previewed at the playhead), shapes (drag them on the picture), particles, a backdrop photo, and cast. **Another take** re-rolls; **Undo** reverts a build; or open one of the sample films. | Everything |
| **Timeline** (under the picture) | Scenes, text and music on tracks under one playhead. Drag scenes to reorder and their edges to trim, split at the playhead, and pick a transition between any two scenes (cut, fade, wipe, zoom, flash). Add titles and captions (pop, slide, typewriter, fade). Add **your own song**: its tempo and beats are found on your device, cuts snap to them, and **Cut on beat** moves every cut onto the nearest beat. Drag the song to choose which part plays. | The finished film |
| **Looks** | A curated library of palettes and atmospheres. Preview one on the current scene, then apply it to every scene. The **film grade** (preset, contrast, saturation, vignette, tint) lives here and applies live. | Storyboard colours, particles, score, grade |
| **Characters** | **Forge:** build whole characters from parts (body, head, eyes, hair, headgear, arms, legs, wings or cape, tail, held item), proportions and a palette — or generate them: pick an archetype (knight, beast, spirit, machine, insectoid, celestial, anything), *Surprise me*, mutate a little or a lot, breed two saved characters, lock what you like and reroll the rest. Every design comes from a seed, so it can be reproduced. Five body plans — two legs, four legs, flyer, serpent and floater — each with its own idle, walk, run, jump and attack loops. **Game export:** turn any character into a sprite sheet (PNG, one row per animation, including your own Motion clips and captured takes) with a Phaser-ready JSON atlas, or a zip with import notes for Godot, Unity and GameMaker. | Cast and Motion |
| **Motion** | Pose your character by dragging its joints, then key poses over time. Each key has its own timing and easing (smooth, linear, ease in/out, overshoot, bounce, hold), with onion-skin ghosts of the neighbouring keys. Layer a procedural motion (run, float, lunge…) on top. Or **capture a performance** from your webcam or **any video file**, then trim, smooth and foot-lock the take, and choose how many keys per second to keep. Save as a clip. **Every body plan follows clips:** four-legged, flying, serpent and floating characters are retargeted from the skeleton (arms drive front legs, wings or a serpent's head; legs drive back legs; hips and lean move the body). | Cast clips |
| **Export** | Record the film, with transitions, text, song and score, to MP4/WebM at 720p, 1080p, 9:16 or 1:1. | The finished video |

**Projects** (top right): switch between projects, start new ones, duplicate, delete, and save/open `.zhart.json` project files to back up or move work between computers.

## Run it

Requires Node 20+.

```bash
npm install
npm run dev          # http://localhost:3000
```

Production:

```bash
npm run build
NODE_ENV=production npm start   # honours PORT
```

The server only hosts the app; it has no API endpoints.

### Motion capture

Webcam and video-file capture use MediaPipe Pose Landmarker running in the browser. Video files are read locally and tracked frame by frame (up to 60 seconds per take); nothing is uploaded. The model (`public/models/pose_landmarker_lite.task`) is committed, and the WASM runtime is copied from `node_modules` into `public/mediapipe/` on install and build (`scripts/copy-mediapipe.mjs`), so the app serves everything itself: no CDN, and camera video never leaves the device. Browsers only allow camera access over HTTPS or on localhost.

## Layout

```
server.ts                          Static/Vite host
src/App.tsx                        Shell: header, project menu, navigation, guide
src/project/                       The project: types, storage (localStorage + IndexedDB),
                                   builder (offline composer), looks, rig maths
src/project/forge/                 Character parts, body plans (plans.ts), retargeting (retarget.ts), drawing kit (draw.ts), seeded generator
src/features/useStudio.ts          Project + playback + builder settings for every tab
src/features/storyboard/           Stage, scene model, scene inspector, playback, spectrum
src/features/timeline/             Timeline tracks, transitions, text, sound panel (timeline.ts holds the shared maths)
src/features/looks/                Look library and film grade
src/features/forge/                Character Forge, sprite sheet export (sprites.ts)
src/features/export/               Canvas + MediaRecorder video export
src/features/motion/               Motion: rig stage, keyframe track, capture panel
src/features/mocap/                Pose tracking (webcam, video file) and take clean-up
src/ui/                            Design-system primitives and the FilmGate frame
src/lib/                           Save-file helper, zip writer, score synth, song analysis and playback (music.ts)
```

The live stage and the exporter draw from the same scene model (`sceneModel.ts`) and timeline maths (`timeline.ts`), so an export matches the preview: cast, grade, transitions and text included.
