# ZH-art — a film studio in the browser

Build a short animated film from one idea: compose the storyboard, give it a look, design and animate a cast, score it, and export a real video file. Everything runs in your browser — no accounts, no AI services, no API keys.

## The studio

All five parts work on **one project**, which autosaves in your browser.

| Part | What you do there | Feeds into |
| --- | --- | --- |
| **Storyboard** | Write an idea and **Build**: an offline composer reads places and things in it (space, ocean, forest, city, fire, snow, desert…) and lays out scenes with a story arc, palette, camera moves, shapes, particles and a score. Then edit anything by hand: words, timing, colours, camera, shapes (drag them on the picture), particles, a backdrop photo, and cast. **Another take** re-rolls; **Undo** reverts a build. | Everything |
| **Looks** | A curated library of palettes and atmospheres. Preview one on the current scene, then apply it to every scene. | Storyboard colours, particles, score |
| **Characters** | Design faces, hair, colours and costume; save characters to the project; set the film's colour grade. | Cast, Motion rig, grade on stage and export |
| **Motion rig** | Drag joints to pose, layer a motion (run, float, lunge…), record keyframes, save as a clip. | Cast clips |
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

## Layout

```
server.ts                          Static/Vite host
src/App.tsx                        Shell: header, project menu, navigation, guide
src/project/                       The project: types, storage (localStorage + IndexedDB),
                                   builder (offline composer), looks, rig maths
src/features/useStudio.ts          Project + playback + builder settings for every tab
src/features/storyboard/           Stage, scene model, scene inspector, playback, spectrum
src/features/looks/                Look library
src/features/export/               Canvas + MediaRecorder video export
src/components/                    Characters, Motion rig, Edit & export panels (lazy-loaded)
src/ui/                            Design-system primitives and the FilmGate frame
```

The live stage and the exporter draw from the same scene model (`sceneModel.ts`), so an export matches the preview, cast and grade included.
