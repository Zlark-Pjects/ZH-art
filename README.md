# ZH-art — a film studio in the browser

Build a short animated film from one idea: compose the storyboard, give it a look, design and animate a cast, score it, and export a real video file. It also has a game, **Stickville City**, under Play. Everything runs in your browser — no accounts, no AI services, no API keys.

## The studio

All five parts work on **one project**, which autosaves in your browser.

| Part | What you do there | Feeds into |
| --- | --- | --- |
| **Storyboard** | Write an idea and **Build**: an offline composer reads places and things in it (space, ocean, forest, city, fire, snow, desert…) and lays out scenes with a story arc, palette, camera moves, shapes, particles and a score. Then edit anything by hand: words, timing, colours, cast that walks, flies or slides along keyed paths, camera (a preset move, or **camera keyframes** with zoom, pan, rise and easing, previewed at the playhead), shapes (drag them on the picture), particles, a backdrop photo, and cast. **Another take** re-rolls; **Undo** reverts a build; or open one of the sample films. | Everything |
| **Timeline** (under the picture) | Scenes, text and music on tracks under one playhead. Drag scenes to reorder and their edges to trim, split at the playhead, and pick a transition between any two scenes (cut, fade, wipe, zoom, flash). Add titles and captions (pop, slide, typewriter, fade). Add **your own song**, or find one in the **free music browser** (Sound tab): it searches Openverse's Creative Commons and public-domain music, shows only licences that allow putting music to video (commercial-only by default), previews tracks, and saves the artist credit with the song for you to copy when you share the film. Its tempo and beats are found on your device, cuts snap to them, and **Cut on beat** moves every cut onto the nearest beat. Drag the song to choose which part plays. | The finished film |
| **Looks** | A curated library of palettes and atmospheres. Preview one on the current scene, then apply it to every scene. The **film grade** (preset, contrast, saturation, vignette, tint) lives here and applies live. | Storyboard colours, particles, score, grade |
| **Characters** | **Forge:** build whole characters from parts (body, head, eyes, hair, headgear, arms, legs, wings or cape, tail, held item), proportions and a palette — or generate them: pick an archetype (knight, beast, spirit, machine, insectoid, celestial, anything), *Surprise me*, mutate a little or a lot, breed two saved characters, lock what you like and reroll the rest. Every design comes from a seed, so it can be reproduced. Five body plans — two legs, four legs, flyer, serpent and floater — each with its own idle, walk, run, jump and attack loops. **Game export:** turn any character into a sprite sheet (PNG, one row per animation, including your own Motion clips and captured takes) with a Phaser-ready JSON atlas, or a zip with import notes for Godot, Unity and GameMaker. | Cast and Motion |
| **Motion** | Pose your character by dragging its joints, then key poses over time. Each key has its own timing and easing (smooth, linear, ease in/out, overshoot, bounce, hold), with onion-skin ghosts of the neighbouring keys. Layer a procedural motion (run, float, lunge…) on top. Or **capture a performance** from your webcam or **any video file**, then trim, smooth and foot-lock the take, and choose how many keys per second to keep. Save as a clip. **Every body plan follows clips:** four-legged, flying, serpent and floating characters are retargeted from the skeleton (arms drive front legs, wings or a serpent's head; legs drive back legs; hips and lean move the body). | Cast clips |
| **Export** | Render the film, with transitions, text, song and score, to MP4/WebM at 720p, 1080p, 9:16 or 1:1. Frame by frame with WebCodecs where available (every frame exact, no need to play in real time), real-time recording elsewhere. | The finished video |

| **Play** | **Stickville City**, an open city of stick people seen from above. Make your character (free the first time; more looks at the Style shop) and explore: downtown, your block, a park and lake, the beach, an industrial zone, the army base and the enemy Red Zone, with traffic and people everywhere. **Drive** a dirt bike, cars (borrow any in the street), an army jeep or your own helicopter, with drifting (Space), nitro (Shift) and ramp stunts (spin with A/D in the air). **Several games in one:** six army missions with 1–3 star ratings (base defence against drone waves and a boss, convoy escort, stealth recon past guard bots and searchlights, codebreaking terminals answered with knowledge, a hostage extraction, a helicopter sky patrol); three street races against computer drivers; pizza delivery and taxi jobs; a stunt park; trivia. **Story:** six named people with chains of requests (fetch, find, riddles, races, stunts, deliveries). **Progress:** money, levels, building on your block (home and solar farm pay every minute, garage car and paint jobs, science lab, helipad), upgrades (nitro, engine, tyres, armour, rapid fire, spread shot, shield). An in-game **phone** has the map and GPS, missions, races, jobs, people, garage, style, brain games, radio (two stations of music generated live), stats and settings. The **Builder** adds to the city while you play: trees, palms, props, ramps, boost pads, coins, walls, signs and talking people with your own words, your own quiz questions, and **your own Blender models** (see `blender/README.md`); share it all as a world code. Every building, vehicle (16 headings, seven paint colours) and prop is modelled and rendered in Blender (`blender/build_city_art.py`). Keyboard and mouse, or a joystick and buttons on a phone; progress saves in the browser. | Itself |

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

### Stickville on its own

The game also builds as one self-contained HTML file, without the film studio:

```bash
npm run build:stickville   # → dist-stickville/stickville.html
```

Open that file directly in a browser, or upload it anywhere that serves static files (GitHub Pages, Netlify, itch.io as an HTML game). Its scripts and styles are inlined; only the fonts load from Google Fonts, with system fallbacks offline. Progress saves in the player's browser.

### Tests

```bash
npm test             # builds, then runs the end-to-end tests in Chromium
npm run test:e2e     # tests only, against an existing build
```

The tests (`tests/e2e/`) drive the real app: every tab, the timeline (split, trim, reorder, transitions, text, a song's beat), camera keys, moving cast, Motion clips, the Forge and sprite export, a video export, and phone layouts. They fail on any page error. GitHub Actions runs them on every push (`.github/workflows/ci.yml`).

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
src/features/city/                 Stickville City: map (roads, districts, collisions), engine (driving, traffic, people, enemies, missions, races, jobs, story), render (canvas, HUD), music (radio), data, Phone, CityView (menus, Builder, touch controls)
blender/                           Blender add-on/exporter for your own models (stickville_blender.py), the modelling kit (kit.py) and the script that renders the city's art (build_city_art.py)
src/features/mocap/                Pose tracking (webcam, video file) and take clean-up
src/ui/                            Design-system primitives and the FilmGate frame
src/lib/                           Save-file helper, zip writer, score synth, song analysis and playback (music.ts)
```

The live stage and the exporter draw from the same scene model (`sceneModel.ts`) and timeline maths (`timeline.ts`), so an export matches the preview: cast, grade, transitions and text included.
