import { useRef, useState, type ReactNode } from "react";
import { Film, Upload, X } from "lucide-react";
import { useVideoRender } from "../../lib/useVideoRender";
import { CAMERA_MOTIONS, VISUAL_PRESETS } from "../../lib/presets";
import type { VisualPreset } from "../../types";
import { Button, Field, Notice, Progress, Section, Segmented, StudioLayout, cx, inputClass } from "../../ui";
import { FilmGate, GateEmpty, GateRendering, GateVideo } from "../../ui/FilmGate";

type Aspect = "16:9" | "9:16";
const ASPECTS = [
  { value: "16:9" as Aspect, label: "16:9 Landscape" },
  { value: "9:16" as Aspect, label: "9:16 Portrait" },
];

type Render = ReturnType<typeof useVideoRender>;

function RenderControls({
  render,
  inputError,
  cta,
  onStart,
  disabled,
}: {
  render: Render;
  inputError: string;
  cta: string;
  onStart: () => void;
  disabled?: boolean;
}) {
  const busy = render.status === "requesting" || render.status === "rendering";
  return (
    <div className="flex flex-col gap-4 border-t border-line pt-6 pb-8">
      {busy && <Progress value={render.progress} label={render.status === "requesting" ? "Starting" : "Rendering"} />}
      {(inputError || render.error) && (
        <Notice tone="error" title={inputError ? undefined : "No render"}>
          {inputError || render.error}
        </Notice>
      )}
      {!busy && (
        <Button variant="primary" size="lg" className="w-full" onClick={onStart} disabled={disabled} icon={<Film className="h-5 w-5" />}>
          {cta}
        </Button>
      )}
      <p className="text-xs leading-relaxed text-faint">Uses Google Veo. Renders usually take one to four minutes.</p>
    </div>
  );
}

function RenderGate({
  render,
  slate,
  portrait,
  filename,
  idle,
}: {
  render: Render;
  slate: string;
  portrait: boolean;
  filename: string;
  idle: ReactNode;
}) {
  const busy = render.status === "requesting" || render.status === "rendering";
  return (
    <FilmGate slate={slate} meta={busy ? "Rendering" : render.url ? "Veo render" : "Standby"} portrait={portrait}>
      {render.url ? (
        <GateVideo url={render.url} filename={filename} />
      ) : busy ? (
        <GateRendering progress={render.progress} line="Veo is rendering your shot. You can switch views; it keeps going." />
      ) : (
        idle
      )}
    </FilmGate>
  );
}

/* ---------- Image to video ---------- */

export function AnimateView() {
  const render = useVideoRender();
  const [image, setImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [motion, setMotion] = useState("");
  const [aspect, setAspect] = useState<Aspect>("16:9");
  const [inputError, setInputError] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const readFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setInputError("That file isn't an image. Use PNG, JPEG or WebP.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setInputError("That image is over 15 MB. Use a smaller one.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImage(reader.result as string);
      setFileName(file.name);
      setInputError("");
      render.reset();
    };
    reader.readAsDataURL(file);
  };

  const start = () => {
    if (!image) {
      setInputError("Add an image first.");
      return;
    }
    setInputError("");
    render.start("/api/animate-image", { image, prompt: motion, aspectRatio: aspect });
  };

  const stage = (
    <RenderGate
      render={render}
      slate={fileName || "Image to video"}
      portrait={aspect === "9:16"}
      filename={`zh-art-animated-${Date.now()}.mp4`}
      idle={
        image ? (
          <div className="relative h-full w-full bg-black">
            <img src={image} alt="Your source image" className="h-full w-full object-contain" />
            {motion && (
              <p className="absolute inset-x-0 bottom-[7%] bg-gradient-to-t from-black/80 to-transparent px-[6%] pb-6 pt-12 font-serif text-lg italic text-fg/85 sm:text-2xl">
                {motion}
              </p>
            )}
          </div>
        ) : (
          <GateEmpty title="Bring a still" line="Drop an image in the rail and describe how it should move." />
        )
      }
    />
  );

  const rail = (
    <div>
      <Section index="01" title="Source image" aside="PNG · JPEG · WebP">
        <div
          role="button"
          tabIndex={0}
          aria-label={image ? "Replace image" : "Choose an image"}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            readFile(e.dataTransfer.files?.[0]);
          }}
          className={cx(
            "relative flex min-h-40 flex-col items-center justify-center gap-3 overflow-hidden rounded-[3px] border border-dashed p-6 text-center transition-colors",
            dragging ? "border-accent bg-accent/[0.05]" : "border-line-strong hover:border-fg/40",
          )}
        >
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => readFile(e.target.files?.[0])} />
          {image ? (
            <>
              <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
              <span className="relative text-sm text-fg">{fileName}</span>
              <span className="relative text-xs text-muted">Click or drop to replace</span>
            </>
          ) : (
            <>
              <Upload className="h-5 w-5 text-muted" aria-hidden />
              <span className="text-sm text-fg">Drop an image, or click to browse</span>
              <span className="text-xs text-faint">Up to 15 MB</span>
            </>
          )}
        </div>
        {image && (
          <div className="mt-3">
            <Button
              size="sm"
              variant="ghost"
              icon={<X className="h-4 w-4" />}
              onClick={() => {
                setImage(null);
                setFileName("");
                render.reset();
              }}
            >
              Remove image
            </Button>
          </div>
        )}
      </Section>

      <Section index="02" title="Motion" aside="Optional">
        <label htmlFor="anim-motion" className="sr-only">
          Describe the motion
        </label>
        <textarea
          id="anim-motion"
          value={motion}
          onChange={(e) => setMotion(e.target.value)}
          rows={3}
          placeholder="A slow push in on the face while embers drift upward…"
          className={cx(inputClass, "resize-none")}
        />
      </Section>

      <Section index="03" title="Format">
        <Segmented label="Aspect ratio" value={aspect} onChange={setAspect} options={ASPECTS} />
      </Section>

      <RenderControls render={render} inputError={inputError} cta="Animate with Veo" onStart={start} disabled={!image} />
    </div>
  );

  return <StudioLayout stage={stage} rail={rail} />;
}

/* ---------- Text to video ---------- */

export function TextToVideoView() {
  const render = useVideoRender();
  const [text, setText] = useState("A crystal phoenix rising from black obsidian ash, magenta embers drifting through fog");
  const [vibe, setVibe] = useState<VisualPreset>("cinema");
  const [camera, setCamera] = useState<string>("zoom-in");
  const [aspect, setAspect] = useState<Aspect>("16:9");
  const [inputError, setInputError] = useState("");

  const start = () => {
    if (!text.trim()) {
      setInputError("Describe the shot first.");
      return;
    }
    setInputError("");
    render.start("/api/text-to-video", { prompt: text, aspectRatio: aspect, motionStyle: camera, vibe });
  };

  const stage = (
    <RenderGate
      render={render}
      slate="Text to video"
      portrait={aspect === "9:16"}
      filename={`zh-art-text-${Date.now()}.mp4`}
      idle={
        <div className="flex h-full w-full flex-col justify-end bg-[radial-gradient(120%_90%_at_20%_10%,#1b1a17_0%,#08080a_60%)] p-[8%]">
          <p className="eyebrow mb-4">Shot description</p>
          <p className="line-clamp-4 max-w-3xl font-serif text-[clamp(1.4rem,3.6vw,3.25rem)] italic leading-[1.1] text-fg/90">
            {text || "Describe a shot in the rail."}
          </p>
          <p className="eyebrow mt-6 text-faint">
            {VISUAL_PRESETS.find((v) => v.id === vibe)?.name} · {CAMERA_MOTIONS.find((c) => c.value === camera)?.label} · {aspect}
          </p>
        </div>
      }
    />
  );

  const rail = (
    <div>
      <Section index="01" title="Shot">
        <label htmlFor="t2v-text" className="sr-only">
          Shot description
        </label>
        <textarea
          id="t2v-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          className={cx(inputClass, "resize-none")}
        />
        <p className="mt-2 text-xs text-faint">Concrete nouns and light beat adjectives. Under 100 words works best.</p>
      </Section>
      <Section index="02" title="Look">
        <Segmented
          label="Visual style"
          value={vibe}
          onChange={setVibe}
          columns={2}
          options={VISUAL_PRESETS.map((p) => ({ value: p.id, label: p.name, hint: p.desc, swatch: p.swatch }))}
        />
      </Section>
      <Section index="03" title="Camera">
        <div className="flex flex-col gap-5">
          <Segmented
            label="Movement"
            value={camera}
            onChange={setCamera}
            columns={3}
            options={CAMERA_MOTIONS.map((c) => ({ value: c.value, label: c.label }))}
          />
          <Segmented label="Aspect ratio" value={aspect} onChange={setAspect} options={ASPECTS} />
        </div>
      </Section>
      <RenderControls render={render} inputError={inputError} cta="Render shot" onStart={start} />
    </div>
  );

  return <StudioLayout stage={stage} rail={rail} />;
}

