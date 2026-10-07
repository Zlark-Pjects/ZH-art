# ZH-art — a film studio in the browser

Build a short animated film from one idea: compose the storyboard, give it a look, design and animate a cast, score it, and export a real video file. Everything runs in your browser — no accounts, no AI services, no API keys.

## The studio

All five parts work on **one project**, which autosaves in your browser.

| Part | What you do there | Feeds into |
| --- | --- | --- |
| **Storyboard** | Write an idea and **Build**: an offline composer reads places and things in it (space, ocean, forest, city, fire, snow, desert…) and lays out scenes with a story arc, palette, camera moves, shapes, particles and a score. Then edit anything by hand: words, timing, colours, camera, shapes (drag them on the picture), particles, a backdrop photo, and cast. **Another take** re-rolls; **Undo** reverts a build. | Everything |
| **Looks** | A curated library of palettes and atmospheres. Preview one on the current scene, then apply it to every scene. | Storyboard colours, particles, score |
| **Characters** | **Forge:** build whole characters from parts (body, head, eyes, hair, headgear, arms, legs, wings or cape, tail, held item), proportions and a palette — or generate them: pick an archetype (knight, beast, spirit, machine, insectoid, celestial, anything), *Surprise me*, mutate a little or a lot, breed two saved characters, lock what you like and reroll the rest. Every design comes from a seed, so it can be reproduced. **Portrait & grade:** faces, expressions and the film's colour grade. | Cast, Motion rig, grade on stage and export |
| **Motion rig** | Drag joints to pose, layer a motion (run, float, lunge…), record keyframes, or **act it out on your webcam**: on-device pose tracking drives the rig live and records takes. Save as a clip. | Cast clips |
| **Edit & export** | Reorder scenes, start from templates, record the film with its score to MP4/WebM. | The finished video |

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

Webcam capture uses MediaPipe Pose Landmarker running in the browser. The model (`public/models/pose_landmarker_lite.task`) is committed, and the WASM runtime is copied from `node_modules` into `public/mediapipe/` on install and build (`scripts/copy-mediapipe.mjs`), so the app serves everything itself: no CDN, and camera video never leaves the device. Browsers only allow camera access over HTTPS or on localhost.

## Layout

```
server.ts                          Static/Vite host
src/App.tsx                        Shell: header, project menu, navigation, guide
src/project/                       The project: types, storage (localStorage + IndexedDB),
                                   builder (offline composer), looks, rig maths
src/project/forge/                 Character parts, figure renderer, seeded generator
src/features/useStudio.ts          Project + playback + builder settings for every tab
src/features/storyboard/           Stage, scene model, scene inspector, playback, spectrum
src/features/looks/                Look library
src/features/forge/                Character Forge
src/features/export/               Canvas + MediaRecorder video export
src/components/                    Characters, Motion rig, Edit & export panels (lazy-loaded)
src/ui/                            Design-system primitives and the FilmGate frame
```

The live stage and the exporter draw from the same scene model (`sceneModel.ts`), so an export matches the preview, cast and grade included.
