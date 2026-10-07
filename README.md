# ZH-art — generative film studio

Type a sentence and get a four-scene storyboard: titles, narration, colours, camera moves and layered shapes. It plays live in the browser with a procedural score. From there you can render it with Google Veo, give scenes AI backdrops, research a look, and record the result to a video file.

## Run it

Requires Node 20+.

```bash
npm install
cp .env.example .env.local   # then fill in the keys you have
npm run dev                  # http://localhost:3000
```

Without any keys the app runs in **demo mode**. Storyboards and research come from built-in templates, and the UI says so. Video rendering is disabled.

| Variable | Needed for |
| --- | --- |
| `GEMINI_API_KEY` | AI storyboards, research, Veo video (image→video, text→video) |
| `HF_TOKEN` | Scene backdrops via Hugging Face (optional) |
| `AI_RATE_LIMIT` | Gemini/HF requests per visitor per 10 min (default 30) |
| `VIDEO_RATE_LIMIT` | Veo renders per visitor per hour (default 5) |
| `PORT` | Server port (default 3000) |

Rate limits only count requests that actually spend API quota.

## Production

```bash
npm run build
NODE_ENV=production npm start
```

## Layout

```
server.ts                      Express API (Gemini, Veo, Hugging Face) + Vite/static hosting
src/App.tsx                    App shell: header, navigation, guide
src/ui/                        Design-system primitives and the FilmGate frame
src/features/useStudio.ts      Shared studio state (storyboard, playback, backdrops, Veo)
src/features/storyboard/       Live stage, scene model, playback, spectrum
src/features/export/           Canvas + MediaRecorder video export
src/features/video/            Image→video and text→video views
src/features/research/         Visual research view
src/components/                Motion rig, creative suite, edit & export (lazy-loaded)
src/lib/                       Web Audio synth, video render hook, presets
```

The live stage and the exporter draw from the same scene model (`sceneModel.ts`), so an export matches the preview.
