import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type, GenerateVideosOperation } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

// Set up body parsers with limits for handling base64 images
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Initialize Google GenAI
const apiKey = process.env.GEMINI_API_KEY || "";
const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Quota cache state to prevent rate-limit loops and preserve key quota
let isQuotaExhausted = false;
let quotaExhaustionResetTime = 0;

function checkQuotaExhaustion(): boolean {
  if (isQuotaExhausted && Date.now() < quotaExhaustionResetTime) {
    return true;
  }
  isQuotaExhausted = false;
  return false;
}

function setQuotaExhausted() {
  console.log(`[Quota Manager] Setting quota-exhausted cache state for 10 minutes to protect key limits.`);
  isQuotaExhausted = true;
  quotaExhaustionResetTime = Date.now() + 10 * 60 * 1000; // Cache for 10 minutes
}

// Helper function to handle robust multi-model retries & fallbacks to prevent 503/429 errors
async function generateWithRetryAndFallback(options: {
  models: string[];
  contents: any;
  config: any;
  label: string;
}) {
  const { models, contents, config, label } = options;

  if (checkQuotaExhaustion()) {
    console.warn(`[Quota Manager] Skipping API call for "${label}" due to active cached rate/quota limit. Serving fallback directly.`);
    throw new Error("QUOTA_EXHAUSTED_CACHED");
  }

  let lastError: any = null;

  for (let m = 0; m < models.length; m++) {
    const modelName = models[m];
    
    for (let attempt = 1; attempt <= 2; attempt++) {
      const delay = (m === 0 && attempt === 1) ? 0 : 1200;
      if (delay > 0) {
        console.log(`[${label}] Delaying ${delay}ms before sending request to "${modelName}" (Attempt ${attempt}/2)...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      try {
        console.log(`[${label}] Sending request to model "${modelName}" (Model ${m + 1}/${models.length}, Attempt ${attempt}/2)`);
        const response = await ai.models.generateContent({
          model: modelName,
          contents,
          config,
        });
        console.log(`[${label}] Success with model: ${modelName}!`);
        return response;
      } catch (err: any) {
        lastError = err;
        const errMsg = err.message || err;
        const cleanMsg = typeof errMsg === "string" && errMsg.startsWith("{") ? "API response error" : errMsg;
        console.log(`[${label}] Failed with model "${modelName}" (Attempt ${attempt}/2):`, cleanMsg);
        
        // If it fails due to high demand (503) or rate limit (429), skip other retries on this busy model and try the next fallback model!
        const isQuotaOrDemand = err.status === 429 || err.status === 503 || (err.message && (err.message.includes("503") || err.message.includes("429") || err.message.includes("limit") || err.message.includes("demand") || err.message.includes("quota") || err.message.includes("RESOURCE_EXHAUSTED") || err.message.includes("UNAVAILABLE")));
        if (isQuotaOrDemand) {
          setQuotaExhausted();
          if (attempt === 1) {
            console.log(`[${label}] Detected high demand/quota error on "${modelName}". Skipping further retries for this model and moving to fallback model.`);
            break;
          }
        }
      }
    }
  }

  throw lastError || new Error(`All generation attempts failed for ${label}`);
}

// 1. STORYBOARD GENERATION ENDPOINT (Cooperative Multi-Model Production Crew)
app.post("/api/generate-storyboard", async (req, res) => {
  try {
    const { prompt, style, musicVibe, aspect, skipAI } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    if (skipAI || !apiKey || apiKey === "MY_GEMINI_API_KEY") {
      // Return a beautiful mocked template if skipAI is requested or no API key is set
      console.warn("Using fallback storyboard due to skipAI flag or missing API Key");
      return res.json(getFallbackStoryboard(prompt, style, musicVibe));
    }

    console.log("Multi-Model Pipeline - Calling Lead Director Model...");
    
    // MODEL 1: Lead Director AI (Vision & Dramatic Screenplay)
    const directorSystemInstruction = `You are Jean-Claude, a visionary film Director. 
Your task is to craft an inspiring and emotionally charged creative narrative concept for a 4-scene video project based on a user's prompt and a target visual style.
For each of the 4 scenes, write:
1. A dramatic title.
2. An emotive voiceover narration overlay.
3. A rich, visual description of the core mood and emotional atmosphere.

Also, outline clear audio directions for our Sound Designer (tempo, scale, general energy level).`;

    const directorPrompt = `Create a director's concept proposal for a video.
Prompt: "${prompt}"
Visual Style: "${style || "cinema"}"
Suggested Vibe: "${musicVibe || "ambient"}"
Aspect Ratio: "${aspect || "16:9"}"`;

    const directorResponse = await generateWithRetryAndFallback({
      models: ["gemini-3.5-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"],
      contents: directorPrompt,
      label: "Director Model (Jean-Claude)",
      config: {
        systemInstruction: directorSystemInstruction,
        temperature: 1.0,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            summary: { type: Type.STRING },
            scenesOutline: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sceneNumber: { type: Type.INTEGER },
                  sceneTitle: { type: Type.STRING },
                  narration: { type: Type.STRING },
                  moodVision: { type: Type.STRING }
                },
                required: ["sceneNumber", "sceneTitle", "narration", "moodVision"]
              }
            },
            audioDirection: {
              type: Type.OBJECT,
              properties: {
                recommendedVibe: { type: Type.STRING, description: "Must be: ambient, synthwave, cinematic, lofi, or chiptune" },
                tempoBpm: { type: Type.INTEGER, description: "Between 60 and 140" },
                scale: { type: Type.STRING, description: "Must be: major, minor, pentatonic, or phrygian" }
              },
              required: ["recommendedVibe", "tempoBpm", "scale"]
            }
          },
          required: ["title", "summary", "scenesOutline", "audioDirection"]
        }
      }
    });

    const directorVision = JSON.parse(directorResponse.text || "{}");
    console.log("Director Vision completed! Calling Lead Cinematographer Model to construct technical storyboard...");

    // MODEL 2: Lead Cinematographer AI (Visual coordinates, layered shapes, particles, and collaborative logs)
    const cinematographerSystemInstruction = `You are Akira, an elite Cinematographer and Visual Layout Engineer.
Your Director (Jean-Claude) has provided a detailed narrative screenplay and audio guide.
Your task is to translate this narrative vision into a precise visual-technical layout (JSON) that fits our vector canvas graphics and parallax rendering engine.

You MUST define:
- Detailed atmospheric background gradients (2-3 Hex color stops representing the colors of the scene).
- Accent highlight colors (Hex).
- Precise camera movements (pan, zoom, tilt, roll) with starting/ending coordinates & scales for smooth visual movement.
- Layered graphics specs: elements like geometric meshes, layered shapes, silhouettes, or grid layouts placed at different depths (1 background, 2 midground, 3 foreground) to enable gorgeous parallax scrolling animations.
- Particle systems (like glowing embers, falling cherry blossoms, neon rain, slow-drifting space dust, or bubbles) that float dynamically.

Ensure the visual elements and styles align exactly with the style requested:
- 'cyberpunk': neon hues, dark background, glowing sparks, digital grids.
- 'anime': pastel atmospheric skies, falling cherry blossoms, magical rings, splines.
- 'watercolor': soft bleeding gradients, floating circles/motes, organic shapes.
- 'vaporwave': magenta/cyan sunset gradients, wireframe grids, star clusters, circles.
- 'line-art': monochrome or clean duotone background, clean white/black outline elements, abstract wireframes.
- 'retro-pixel': high-contrast saturated primary hues, pixelated block shapes, square grids, starry particles.
- 'cinema': dramatic high-contrast golden hour or dark cosmic tones, cinematic bars, misty light flares, dust particles.
- 'oil-painting': thick textured hues, heavy layered polygon elements, swirling cosmic strokes.

Additionally, you must write a 'crewDialogue' array representing a brief, high-level, professional discussion/chat log among:
1. Jean-Claude (Lead Director, speaking on narrative/thematic vision)
2. Akira (yourself, Cinematographer, speaking on canvas coordinate layouts, parallax depths, and colors)
3. Evelyn (Sound Designer, speaking on synth scale, tempoBpm, and acoustic frequency bands)
reflecting how you successfully combined your specialties to finalize this collaborative masterpiece.`;

    const cinematographerPrompt = `Translate the Director's screenplay and vision into our technical canvas layout.
Director Screenplay Output: ${JSON.stringify(directorVision)}
Style Requested: ${style || "cinema"}`;

    const storyboardResponse = await generateWithRetryAndFallback({
      models: ["gemini-flash-latest", "gemini-3.5-flash", "gemini-3.1-flash-lite"],
      contents: cinematographerPrompt,
      label: "Cinematographer Model (Akira)",
      config: {
        systemInstruction: cinematographerSystemInstruction,
        temperature: 1.0,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            summary: { type: Type.STRING },
            visualStyle: { type: Type.STRING },
            musicVibe: { type: Type.STRING, description: "Must be one of: 'ambient', 'synthwave', 'cinematic', 'lofi', 'chiptune'" },
            tempoBpm: { type: Type.INTEGER },
            scale: { type: Type.STRING, description: "Must be one of: 'major', 'minor', 'pentatonic', 'phrygian'" },
            crewDialogue: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  role: { type: Type.STRING, description: "Must be one of: 'director', 'cinematographer', 'sound-designer'" },
                  name: { type: Type.STRING },
                  avatar: { type: Type.STRING },
                  message: { type: Type.STRING }
                },
                required: ["role", "name", "avatar", "message"]
              }
            },
            scenes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sceneNumber: { type: Type.INTEGER },
                  title: { type: Type.STRING },
                  duration: { type: Type.NUMBER, description: "Scene duration in seconds (4.0 to 7.0)" },
                  narration: { type: Type.STRING },
                  visualDescription: { type: Type.STRING },
                  backgroundColor: { type: Type.STRING, description: "Hex code color (e.g. #0a0518)" },
                  accentColor: { type: Type.STRING, description: "Hex code color (e.g. #00ffcc)" },
                  gradientColors: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "2 or 3 Hex code colors for background atmospheric gradient"
                  },
                  cameraMotion: {
                    type: Type.OBJECT,
                    properties: {
                      type: { type: Type.STRING, description: "Must be one of: 'pan-left', 'pan-right', 'zoom-in', 'zoom-out', 'orbit-left', 'orbit-right', 'parallax-tilt', 'drift'" },
                      speed: { type: Type.STRING, description: "slow, medium, fast" },
                      scaleStart: { type: Type.NUMBER },
                      scaleEnd: { type: Type.NUMBER },
                      xStart: { type: Type.NUMBER },
                      xEnd: { type: Type.NUMBER },
                      yStart: { type: Type.NUMBER },
                      yEnd: { type: Type.NUMBER }
                    },
                    required: ["type", "speed", "scaleStart", "scaleEnd", "xStart", "xEnd", "yStart", "yEnd"]
                  },
                  elements: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        type: { type: Type.STRING, description: "Must be: layered-shape, vector-icon, abstract-mesh, starfield, landscape-silhouette, geometric-grid" },
                        shape: { type: Type.STRING, description: "Must be: circle, rect, polygon, ring, line, spline, star" },
                        color: { type: Type.STRING, description: "Hex code color" },
                        size: { type: Type.NUMBER, description: "Size of shape on 0-400 scale" },
                        position: {
                          type: Type.OBJECT,
                          properties: {
                            x: { type: Type.NUMBER, description: "X percentage coordinate (0 to 100)" },
                            y: { type: Type.NUMBER, description: "Y percentage coordinate (0 to 100)" }
                          },
                          required: ["x", "y"]
                        },
                        movement: { type: Type.STRING, description: "float, rotate, pulse, glide, none" },
                        depth: { type: Type.INTEGER, description: "Layer depth (1 background, 2 midground, 3 foreground)" },
                        details: { type: Type.STRING }
                      },
                      required: ["type", "shape", "color", "size", "position", "movement", "depth"]
                    }
                  },
                  particles: {
                    type: Type.OBJECT,
                    properties: {
                      type: { type: Type.STRING, description: "Must be: stars, sparks, cherry-blossoms, rain, snow, bubbles, dust-motes, none" },
                      count: { type: Type.INTEGER, description: "Count of particles (e.g. 30 to 100)" },
                      color: { type: Type.STRING, description: "Hex code color" },
                      speed: { type: Type.NUMBER },
                      size: { type: Type.NUMBER }
                    },
                    required: ["type", "count", "color", "speed", "size"]
                  }
                },
                required: ["sceneNumber", "title", "duration", "narration", "visualDescription", "backgroundColor", "accentColor", "gradientColors", "cameraMotion", "elements", "particles"]
              }
            }
          },
          required: ["title", "summary", "visualStyle", "musicVibe", "tempoBpm", "scale", "scenes", "crewDialogue"]
        }
      }
    });

    const parsed = JSON.parse(storyboardResponse.text || "{}");
    res.json(parsed);
  } catch (err: any) {
    const errorMsg = err.message || "UNAVAILABLE";
    const cleanErrorMsg = typeof errorMsg === "string" && errorMsg.startsWith("{") ? "API response error" : errorMsg;
    console.log("Collaborative Storyboard generation was busy or quota-limited. Safely switching to procedural storyboard. Reason:", cleanErrorMsg);
    try {
      const { prompt, style, musicVibe } = req.body;
      const fallback = getFallbackStoryboard(prompt || "Cosmic Journey", style || "cinema", musicVibe || "ambient");
      fallback.warning = `The AI model pipeline is experiencing high demand (${cleanErrorMsg}). A high-fidelity customized procedural storyboard was generated to ensure uninterrupted creativity.`;
      res.json(fallback);
    } catch (fallbackErr: any) {
      console.log("Critical: Local procedural fallback also failed: ", fallbackErr.message || fallbackErr);
      res.status(500).json({ error: "Failed to generate storyboard" });
    }
  }
});

// 2. SCENE IMAGE GENERATION ENDPOINT (For visual backdrops inside scenes if desired)
app.post("/api/generate-image", async (req, res) => {
  try {
    const { prompt, aspectRatio } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      return res.status(401).json({ error: "Gemini API key is missing or unconfigured." });
    }

    if (checkQuotaExhaustion()) {
      console.warn(`[Quota Manager] Skipping image generation API call due to active cached rate/quota limit. Serving fallback directly.`);
      return res.json({ 
        imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80",
        isFallback: true,
        message: "Image skipped to respect active cached rate/quota limit. Procured stylized scenic backdrop."
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-image",
      contents: {
        parts: [
          {
            text: `${prompt}. High quality cinematic digital art, clean rendering, atmospheric lighting, appropriate aspect ratio.`,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio || "16:9",
        },
      },
    });

    let base64Image = "";
    if (response.candidates && response.candidates[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          base64Image = part.inlineData.data;
          break;
        }
      }
    }

    if (!base64Image) {
      throw new Error("No image data returned from Gemini");
    }

    res.json({ imageUrl: `data:image/png;base64,${base64Image}` });
  } catch (err: any) {
    const errMsg = err.message || err;
    const cleanMsg = typeof errMsg === "string" && errMsg.startsWith("{") ? "API response error" : errMsg;
    console.log("Image generation failed, using scenic fallback. Reason:", cleanMsg);
    const isQuotaOrDemand = err.status === 429 || err.status === 503 || (err.message && (err.message.includes("503") || err.message.includes("429") || err.message.includes("limit") || err.message.includes("demand") || err.message.includes("quota") || err.message.includes("RESOURCE_EXHAUSTED") || err.message.includes("UNAVAILABLE")));
    if (isQuotaOrDemand) {
      setQuotaExhausted();
    }
    res.json({ 
      imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80",
      isFallback: true,
      message: `Image model under high demand (${cleanMsg}). Procured stylized scenic backdrop.`
    });
  }
});

// 2.5 HUGGING FACE INFERENCE API ENDPOINT
app.post("/api/generate-hf", async (req, res) => {
  try {
    const { prompt, modelId } = req.body;
    const hfToken = process.env.HF_TOKEN;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const activeModel = modelId || "black-forest-labs/FLUX.1-schnell";

    if (!hfToken || hfToken === "MY_HF_TOKEN" || hfToken === "") {
      console.warn("Using fallback placeholder image due to missing Hugging Face Token");
      return res.json({ 
        imageUrl: `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80`,
        isFallback: true,
        message: "Demo fallback active. Add HF_TOKEN in secrets to run real models."
      });
    }

    console.log(`[Hugging Face] Querying Inference API for model: ${activeModel}`);
    const hfResponse = await fetch(`https://api-inference.huggingface.co/models/${activeModel}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${hfToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: prompt }),
    });

    if (!hfResponse.ok) {
      // Handle non-200 responses gracefully
      console.log(`[Hugging Face] Inference status: ${hfResponse.status}. Utilizing local visual backup.`);
      return res.json({ 
        imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80",
        isFallback: true,
        message: "Hugging Face model is currently preparing. Standard backdrop loaded."
      });
    }

    const buffer = await hfResponse.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const mimeType = hfResponse.headers.get("content-type") || "image/jpeg";

    res.json({ imageUrl: `data:${mimeType};base64,${base64}` });
  } catch (err: any) {
    console.log("[Hugging Face] Query completed with static procedural backup.");
    res.json({ 
      imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80",
      isFallback: true,
      message: "Hugging Face backdrop pipeline is currently resting. Polished visual placeholder retrieved."
    });
  }
});

// 2.7 INTERNET VISUAL RESEARCH GROUNDING ENDPOINT (AI Visual Surf/Research Agent)
app.post("/api/research-visuals", async (req, res) => {
  try {
    const { query, skipAI } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    if (skipAI || !apiKey || apiKey === "MY_GEMINI_API_KEY") {
      console.warn("[Research] Using local visual research fallback due to skipAI flag or missing API key.");
      return res.json(getFallbackVisualResearch(query));
    }

    if (checkQuotaExhaustion()) {
      console.warn("[Research] Skipping API call due to cached quota limits. Serving local fallback.");
      return res.json(getFallbackVisualResearch(query));
    }

    console.log(`[Research] Running visual trend research on the web for query: "${query}"`);
    
    const researchPrompt = `Conduct visual research and search the internet for the modern design, cinema, art trends, and visual concepts associated with this query: "${query}".
Search for style names, aesthetic guides, color palette ideas, key visual elements, and write 3 highly detailed visual prompts that can be used for generating images of this topic.

You MUST respond with a valid JSON object matching this schema:
{
  "aestheticName": "Name of the style or trend (e.g., Cyberpunk Synthwave Grid)",
  "description": "A 2-3 sentence overview explaining what is currently trending or popular on websites like Behance, ArtStation, or Pinterest regarding this topic, including the key visual patterns.",
  "keyConcepts": ["Concept 1", "Concept 2", "Concept 3", "Concept 4"],
  "colorPalette": ["Color Name 1 with optional Hex", "Color Name 2 with optional Hex", "Color Name 3 with optional Hex", "Color Name 4 with optional Hex"],
  "prompts": ["Prompt 1: Detailed scenic layout", "Prompt 2: Detail or atmosphere", "Prompt 3: Artistic or surreal alternative"],
  "sources": ["Source website or community 1", "Source website or community 2"]
}
Only output raw JSON. Do not write any text outside of the JSON object.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: researchPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            aestheticName: { type: Type.STRING },
            description: { type: Type.STRING },
            keyConcepts: { type: Type.ARRAY, items: { type: Type.STRING } },
            colorPalette: { type: Type.ARRAY, items: { type: Type.STRING } },
            prompts: { type: Type.ARRAY, items: { type: Type.STRING } },
            sources: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["aestheticName", "description", "keyConcepts", "colorPalette", "prompts"]
        },
        tools: [
          {
            googleSearch: {}
          }
        ]
      }
    });

    const text = response.text;
    console.log("[Research] Grounded content response: ", text);
    const parsed = JSON.parse(text || "{}");
    res.json(parsed);
  } catch (err: any) {
    const isQuotaOrDemand = err.status === 429 || err.status === 503 || (err.message && (err.message.includes("503") || err.message.includes("429") || err.message.includes("limit") || err.message.includes("demand") || err.message.includes("quota") || err.message.includes("RESOURCE_EXHAUSTED") || err.message.includes("UNAVAILABLE")));
    if (isQuotaOrDemand) {
      console.log("[Research] Quota limit or rate limit exceeded. Activating local visual research fallback.");
      setQuotaExhausted();
    } else {
      const errMsg = err.message || err;
      const cleanMsg = typeof errMsg === "string" && errMsg.startsWith("{") ? "API response error" : errMsg;
      console.log("[Research] API call failed. Utilizing fallback. Detail:", cleanMsg);
    }
    const fallback = getFallbackVisualResearch(req.body.query || "");
    fallback.warning = `The live visual research agent is taking a breather. Procured deep procedural search profile.`;
    res.json(fallback);
  }
});

// 2.8 CREATIVE ARTISTIC SUGGESTIONS ENDPOINT (For Storyboarding Assistance, Camera Angles & Transitions)
app.post("/api/artistic-suggestions", async (req, res) => {
  try {
    const { prompt, currentScene, style, skipAI } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt or sequence theme is required" });
    }

    if (skipAI || !apiKey || apiKey === "MY_GEMINI_API_KEY" || checkQuotaExhaustion()) {
      console.warn("[Artistic] Using procedural artistic suggestions fallback.");
      return res.json(getFallbackArtisticSuggestions(prompt, style || "cinema"));
    }

    console.log(`[Artistic] Running creative suggestions for: "${prompt}" in style "${style}"`);

    const systemInstruction = `You are Chloe, an award-winning cinematic layout Director and creative Storyboarding Consultant.
Given a sequence theme, a brief description of the current scene, and the target visual style, your job is to suggest a professional 3-scene narrative flow progression.
For each suggested scene, you MUST recommend:
1. Scene Title and Description (Scene Flow) - ensuring a smooth narrative arc.
2. Camera Angle and Focal Guidance (e.g. Extreme Close-Up, Dutch Angle, Low-Angle Tracking) with a detailed artistic/cinematic justification.
3. Scene Transition (e.g. Match Cut, Wipe, Cross Dissolve, J-Cut) with an explanation of how it creates emotional continuity.
4. AI-driven Visual Effects (VFX) / lighting notes (e.g. volumetric neon shafts, slow embers, bloom haze) to elevate the shot.

You must also outline the overall Emotional Arc and Cinematic Vibe.
Your response MUST be a valid JSON object matching the requested schema. Do not output markdown backticks or any conversation outside of the JSON.`;

    const assistantPrompt = `Analyze this sequence:
Sequence Theme: "${prompt}"
Current Scene Context: "${currentScene || "Initial opening shot"}"
Style Preset: "${style || "cinema"}"`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: assistantPrompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.9,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            emotionalArc: { type: Type.STRING },
            cinematicVibe: { type: Type.STRING },
            suggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sceneNumber: { type: Type.INTEGER },
                  title: { type: Type.STRING },
                  flowDescription: { type: Type.STRING },
                  cameraAngle: { type: Type.STRING },
                  cameraReason: { type: Type.STRING },
                  transitionType: { type: Type.STRING },
                  transitionReason: { type: Type.STRING },
                  vfxNotes: { type: Type.STRING }
                },
                required: ["sceneNumber", "title", "flowDescription", "cameraAngle", "cameraReason", "transitionType", "transitionReason", "vfxNotes"]
              }
            }
          },
          required: ["emotionalArc", "cinematicVibe", "suggestions"]
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);
  } catch (err: any) {
    const isQuotaOrDemand = err.status === 429 || err.status === 503 || (err.message && (err.message.includes("503") || err.message.includes("429") || err.message.includes("limit") || err.message.includes("demand") || err.message.includes("quota") || err.message.includes("RESOURCE_EXHAUSTED") || err.message.includes("UNAVAILABLE")));
    if (isQuotaOrDemand) {
      console.log("[Artistic] Gemini call rate limit exceeded. Utilizing procedural suggestions fallback.");
      setQuotaExhausted();
    } else {
      const errMsg = err.message || err;
      const cleanMsg = typeof errMsg === "string" && errMsg.startsWith("{") ? "API response error" : errMsg;
      console.log("[Artistic] Gemini call failed. Utilizing fallback. Detail:", cleanMsg);
    }
    const fallback = getFallbackArtisticSuggestions(req.body.prompt || "", req.body.style || "cinema");
    fallback.warning = `The AI artistic suggestions helper is resting. Retrieved high-fidelity procedural layout guides.`;
    res.json(fallback);
  }
});

// 3. VEO VIDEO GENERATION ENDPOINT (For authentic full AI video rendering)
app.post("/api/generate-video", async (req, res) => {
  try {
    const { prompt, aspectRatio, resolution } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || checkQuotaExhaustion()) {
      console.warn("[Veo fallback] API key is missing or quota exhausted. Serving mock video operation.");
      return res.json({ operationName: "mock_cinema_" + Date.now() });
    }

    // Call standard Veo model
    const operation = await ai.models.generateVideos({
      model: "veo-3.1-lite-generate-preview",
      prompt: prompt,
      config: {
        numberOfVideos: 1,
        resolution: resolution || "720p",
        aspectRatio: aspectRatio || "16:9",
      },
    });

    res.json({ operationName: operation.name });
  } catch (err: any) {
    console.warn("Veo Video generation start failed: ", err.message || err);
    
    const isQuotaOrDemand = err.status === 429 || err.status === 503 || (err.message && (err.message.includes("503") || err.message.includes("429") || err.message.includes("limit") || err.message.includes("demand") || err.message.includes("quota") || err.message.includes("RESOURCE_EXHAUSTED") || err.message.includes("UNAVAILABLE")));
    if (isQuotaOrDemand) {
      setQuotaExhausted();
    }

    // Serve fallback
    res.json({ operationName: "mock_cinema_" + Date.now() });
  }
});

// 3.5 VEO IMAGE TO VIDEO GENERATION ENDPOINT (Animate images into video)
app.post("/api/animate-image", async (req, res) => {
  try {
    const { image, prompt, aspectRatio } = req.body;

    if (!image) {
      return res.status(400).json({ error: "Image is required" });
    }

    if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || checkQuotaExhaustion()) {
      console.warn("[Veo fallback] API key is missing or quota exhausted. Serving mock animation operation.");
      const normPrompt = (prompt || "").toLowerCase();
      let mockType = "cinema";
      if (normPrompt.includes("cyberpunk") || normPrompt.includes("neon")) {
        mockType = "cyberpunk";
      } else if (normPrompt.includes("space") || normPrompt.includes("cosmic") || normPrompt.includes("astronaut")) {
        mockType = "space";
      } else if (normPrompt.includes("watercolor") || normPrompt.includes("art") || normPrompt.includes("paint") || normPrompt.includes("anime")) {
        mockType = "watercolor";
      }
      return res.json({ operationName: `mock_${mockType}_${Date.now()}` });
    }

    let base64Data = image;
    let mimeType = "image/png";

    if (image.startsWith("data:")) {
      const parts = image.split(",");
      base64Data = parts[1];
      const mimeMatch = parts[0].match(/data:(.*?);/);
      if (mimeMatch) {
        mimeType = mimeMatch[1];
      }
    }

    console.log(`Starting image-to-video animation using veo-3.1-fast-generate-preview, aspect ratio: ${aspectRatio || "16:9"}`);
    
    const operation = await ai.models.generateVideos({
      model: "veo-3.1-fast-generate-preview",
      prompt: prompt || "Animate this image into a beautiful dynamic video, with natural motion and cinematic lighting.",
      image: {
        imageBytes: base64Data,
        mimeType: mimeType,
      },
      config: {
        numberOfVideos: 1,
        resolution: "720p",
        aspectRatio: aspectRatio || "16:9",
      },
    });

    res.json({ operationName: operation.name });
  } catch (err: any) {
    console.warn("Veo Image-to-Video generation failed: ", err.message || err);
    
    const isQuotaOrDemand = err.status === 429 || err.status === 503 || (err.message && (err.message.includes("503") || err.message.includes("429") || err.message.includes("limit") || err.message.includes("demand") || err.message.includes("quota") || err.message.includes("RESOURCE_EXHAUSTED") || err.message.includes("UNAVAILABLE")));
    if (isQuotaOrDemand) {
      setQuotaExhausted();
    }

    // Serve fallback
    const normPrompt = (req.body.prompt || "").toLowerCase();
    let mockType = "cinema";
    if (normPrompt.includes("cyberpunk") || normPrompt.includes("neon")) {
      mockType = "cyberpunk";
    } else if (normPrompt.includes("space") || normPrompt.includes("cosmic")) {
      mockType = "space";
    } else if (normPrompt.includes("watercolor") || normPrompt.includes("anime")) {
      mockType = "watercolor";
    }
    res.json({ operationName: `mock_${mockType}_${Date.now()}` });
  }
});

// 3.8 VEO TEXT-TO-VIDEO GENERATION ENDPOINT (Direct Text-to-Animation Conversion)
app.post("/api/text-to-video", async (req, res) => {
  try {
    const { prompt, aspectRatio, motionStyle, vibe } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || checkQuotaExhaustion()) {
      console.warn("[Veo Text-to-Video fallback] Serving mock text-to-video operation.");
      const combinedPrompt = `${prompt} Style: ${vibe || "cinema"} Motion: ${motionStyle || "zoom-in"}`;
      const normPrompt = combinedPrompt.toLowerCase();
      let mockType = vibe || "cinema";
      if (normPrompt.includes("cyberpunk") || normPrompt.includes("neon")) {
        mockType = "cyberpunk";
      } else if (normPrompt.includes("space") || normPrompt.includes("cosmic") || normPrompt.includes("astronaut")) {
        mockType = "space";
      } else if (normPrompt.includes("watercolor") || normPrompt.includes("art") || normPrompt.includes("paint") || normPrompt.includes("anime")) {
        mockType = "watercolor";
      }
      return res.json({ operationName: `mock_${mockType}_${Date.now()}` });
    }

    console.log(`Starting text-to-video generation using veo-3.1-fast-generate-preview, aspect ratio: ${aspectRatio || "16:9"}`);
    
    const operation = await ai.models.generateVideos({
      model: "veo-3.1-fast-generate-preview",
      prompt: `${prompt}. Style preset: ${vibe || "cinema"}. Camera movement: ${motionStyle || "cinematic dynamic flow"}.`,
      config: {
        numberOfVideos: 1,
        resolution: "720p",
        aspectRatio: aspectRatio || "16:9",
      },
    });

    res.json({ operationName: operation.name });
  } catch (err: any) {
    console.warn("Veo Text-to-Video generation failed: ", err.message || err);
    
    const isQuotaOrDemand = err.status === 429 || err.status === 503 || (err.message && (err.message.includes("503") || err.message.includes("429") || err.message.includes("limit") || err.message.includes("demand") || err.message.includes("quota") || err.message.includes("RESOURCE_EXHAUSTED") || err.message.includes("UNAVAILABLE")));
    if (isQuotaOrDemand) {
      setQuotaExhausted();
    }

    // Serve fallback
    const normPrompt = (req.body.prompt || "").toLowerCase();
    let mockType = "cinema";
    if (normPrompt.includes("cyberpunk") || normPrompt.includes("neon")) {
      mockType = "cyberpunk";
    } else if (normPrompt.includes("space") || normPrompt.includes("cosmic")) {
      mockType = "space";
    } else if (normPrompt.includes("watercolor") || normPrompt.includes("anime")) {
      mockType = "watercolor";
    }
    res.json({ operationName: `mock_${mockType}_${Date.now()}` });
  }
});

// 4. VEO VIDEO STATUS ENDPOINT
app.post("/api/video-status", async (req, res) => {
  try {
    const { operationName } = req.body;

    if (!operationName) {
      return res.status(400).json({ error: "Operation name is required" });
    }

    if (operationName.startsWith("mock_")) {
      return res.json({ done: true });
    }

    const op = new GenerateVideosOperation();
    op.name = operationName;

    const updated = await ai.operations.getVideosOperation({ operation: op });
    res.json({ done: updated.done, response: updated.response });
  } catch (err: any) {
    console.warn("Veo Video status check failed: ", err.message || err);
    res.status(500).json({ error: err.message || "Failed to check status" });
  }
});

// 5. VEO VIDEO DOWNLOAD STREAM ENDPOINT
app.post("/api/video-download", async (req, res) => {
  try {
    const { operationName } = req.body;

    if (!operationName) {
      return res.status(400).json({ error: "Operation name is required" });
    }

    if (operationName.startsWith("mock_")) {
      let videoUrl = "https://player.vimeo.com/external/435674703.sd.mp4?s=6f41de3531fb7e868f706f9ef02be9ba45ff600a&profile_id=139&oauth2_token_id=57447761"; // default golden cinematic
      if (operationName.includes("cyberpunk")) {
        videoUrl = "https://player.vimeo.com/external/371433846.sd.mp4?s=236da2f3c0227e313d3cfd9944551c0d4a040b30&profile_id=139&oauth2_token_id=57447761";
      } else if (operationName.includes("space") || operationName.includes("cosmic")) {
        videoUrl = "https://player.vimeo.com/external/517617498.sd.mp4?s=d0db5f55fa7300fa447e090f70db2bca9354bc78&profile_id=139&oauth2_token_id=57447761";
      } else if (operationName.includes("watercolor") || operationName.includes("anime") || operationName.includes("art")) {
        videoUrl = "https://player.vimeo.com/external/538571059.sd.mp4?s=df98c39e240b9df4b4f3b259972b22b10f274a44&profile_id=139&oauth2_token_id=57447761";
      }
      return res.redirect(videoUrl);
    }

    const op = new GenerateVideosOperation();
    op.name = operationName;

    const updated = await ai.operations.getVideosOperation({ operation: op });
    const uri = updated.response?.generatedVideos?.[0]?.video?.uri;

    if (!uri) {
      return res.status(404).json({ error: "Video URI not found or video not finished yet." });
    }

    const videoRes = await fetch(uri, {
      headers: { "x-goog-api-key": apiKey },
    });

    res.setHeader("Content-Type", "video/mp4");
    
    // Node streams compatibility
    const reader = videoRes.body?.getReader();
    if (!reader) {
      return res.status(500).json({ error: "Unable to stream video download." });
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  } catch (err: any) {
    console.warn("Veo Video streaming download failed: ", err.message || err);
    res.status(500).json({ error: err.message || "Failed to download video stream" });
  }
});

// HELPERS: Mock Fallback Visual Research
function getFallbackVisualResearch(query: string): any {
  const norm = query.toLowerCase();
  
  if (norm.includes("cyberpunk") || norm.includes("neon") || norm.includes("retro") || norm.includes("arcade")) {
    return {
      aestheticName: "Neon Grid Retro-Futurism",
      description: "A digital aesthetic inspired by the early 1980s neon-synth wave and high-tech cyberpunk. This visual style centers on saturated fuchsia and cyan accents, retro wireframe horizons, CRT-monitor scanlines, and glowing light emitters on matte dark surfaces.",
      keyConcepts: ["Vaporwave sunset horizons", "Glowing emission meshes", "Analog CRT scanlines", "Low-key high-contrast shadows"],
      colorPalette: ["#FF007F (Fuchsia Glow)", "#00FFFF (Electric Cyan)", "#1A0033 (Deep Synth Shadow)", "#FFCC00 (Retro Gold)"],
      prompts: [
        "Cinema classic of a towering futuristic skyscraper surrounded by floating neon signs in fuchsia and electric cyan colors, high contrast cinematic shading, 8k resolution.",
        "Cyberpunk style close-up of a vintage retro-arcade console, emitting a warm neon-blue glow onto a damp city asphalt, dramatic shadows, realistic steam and fog.",
        "Aesthetic vaporwave landscape featuring a giant orange low-poly sun setting over a pink wireframe grid ocean, analog vintage video feel, nostalgic 80s artwork."
      ],
      sources: ["ArtStation Visual Design Trends", "Behance Retro Showcase", "Synthwave Aesthetic communities"]
    };
  }

  if (norm.includes("space") || norm.includes("cosmic") || norm.includes("astronaut") || norm.includes("star")) {
    return {
      aestheticName: "Celestial Ethereal & Cosmic Surrealism",
      description: "An elegant, dreamy aesthetic merging cosmic realism with soft surrealist imagery. This style highlights starry nebulas, glowing crescent moons, minimalist astronauts, and organic paint gradients that blend the deep void of space with bright pastel stars.",
      keyConcepts: ["Glow paint dust", "Ethereal crescent moons", "Astral ink bleeding", "Dreamy interstellar pastel hues"],
      colorPalette: ["#0F0C20 (Cosmic Deep Space)", "#FF9E00 (Glowing Starlight)", "#9D4EDD (Nebula Purple)", "#E0AA3E (Moon Dust Gold)"],
      prompts: [
        "Aesthetic high-contrast of an astronaut sitting on a giant crescent moon, casting a glowing line to fish for swirling starry nebulas, watercolor-blend bleed style.",
        "Epic cinematic view of a solitary research dome on an alien planet with two giant glowing pastel moons rising over a calm liquid glass ocean, 8k surrealism.",
        "Minimalist line-art illustration of a cosmic gate opening into a galaxy of floating neon lavender flowers, starry night backdrop, extremely elegant."
      ],
      sources: ["NASA Astronomical Imagery", "Pinterest Surreal Digital Art", "ArtStation Sci-Fi Concept boards"]
    };
  }

  // Default beautiful organic fallback
  return {
    aestheticName: "Golden-Hour Cinematic Realism",
    description: "A highly sophisticated aesthetic highlighting soft organic lighting, natural amber glows, and shallow depth of field. Ideal for cinematic storytelling, this style emphasizes tactile materials, detailed atmospheric dust, and golden rays reflecting off natural or metallic surfaces.",
    keyConcepts: ["Golden-hour rim lighting", "Volumetric dust motes", "Warm tactile shadows", "Bokeh background highlights"],
    colorPalette: ["#FFB703 (Warm Amber)", "#212529 (Charcoal Shadow)", "#8ECAE6 (Soft Sky Blue)", "#FB8500 (Deep Orange Glow)"],
    prompts: [
      "Cinema classic medium shot of a serene visual landscape, bathed in golden volumetric light with glowing dust particles floating in the air, shallow depth of field.",
      "Stunning oil canvas texture showing a hidden overgrown stone archway in a magical forest, light streaming through the dense canopy, rich organic moss greens and warm golds.",
      "Minimalist display photo of a sleek metallic drone reflecting a magnificent sunset, soft highlights, highly professional production design."
    ],
    sources: ["Unsplash Cinematic Curation", "Vimeo Production Design portfolios", "Behance Modern Photography"]
  };
}

// HELPERS: Mock Fallback Storyboard
function getFallbackStoryboard(prompt: string, style: string, musicVibe: string): any {
  const stylesMap: Record<string, { bg: string[]; accent: string; elemColor: string }> = {
    cyberpunk: { bg: ["#0b0416", "#20063b", "#021c35"], accent: "#ff007f", elemColor: "#00ffff" },
    anime: { bg: ["#1c1a2e", "#442e61", "#875e9c"], accent: "#ff8da1", elemColor: "#ffffff" },
    watercolor: { bg: ["#f7f3e8", "#ebdcb9", "#c9b69b"], accent: "#db7b7b", elemColor: "#336699" },
    vaporwave: { bg: ["#120826", "#4c1c5c", "#8c2e6b"], accent: "#00f0ff", elemColor: "#ff00ff" },
    "line-art": { bg: ["#0a0a0a", "#1a1a1a", "#2a2a2a"], accent: "#ffffff", elemColor: "#888888" },
    "retro-pixel": { bg: ["#05020c", "#18002d", "#002824"], accent: "#ffbc00", elemColor: "#00ff66" },
    cinema: { bg: ["#050811", "#121b2d", "#22354e"], accent: "#ffaa00", elemColor: "#e5e9f0" },
    "oil-painting": { bg: ["#1e140d", "#402312", "#5c3315"], accent: "#df7f2e", elemColor: "#bfa37a" },
  };

  const currentStyle = stylesMap[style] || stylesMap.cinema;
  const chosenMusic = ["ambient", "synthwave", "cinematic", "lofi", "chiptune"].includes(musicVibe) ? musicVibe : "ambient";
  const bpm = chosenMusic === "synthwave" ? 120 : chosenMusic === "chiptune" ? 130 : chosenMusic === "lofi" ? 80 : 100;
  const scale = chosenMusic === "synthwave" || chosenMusic === "chiptune" ? "phrygian" : "pentatonic";

  const crewDialogue = [
    {
      role: "director" as const,
      name: "Jean-Claude (Lead Director)",
      avatar: "🎬",
      message: `I wanted to explore "${prompt}" as an emotional narrative. Setting this in a ${style || "cinema"} visual style gives us the perfect stylistic framing to capture this theme.`
    },
    {
      role: "cinematographer" as const,
      name: "Akira (Cinematographer)",
      avatar: "🎥",
      message: `Absolutely. For the visual layers, I mapped out specific depth coordinates (background, midground, and foreground) to optimize our parallax effects. Let's use slow camera pans to enhance the scale.`
    },
    {
      role: "sound-designer" as const,
      name: "Evelyn (Sound Designer)",
      avatar: "🎹",
      message: `I love this direction. To weave a cohesive auditory layer, I've designed a custom ${chosenMusic} patch. Running a ${scale} synthesizer scale at ${bpm} BPM matches Jean-Claude's visual pacing perfectly.`
    }
  ];

  return {
    title: `Cosmic Voyage: ${prompt.length > 25 ? prompt.substring(0, 25) + "..." : prompt}`,
    summary: `A majestic journey based on the concept of: "${prompt}" visualized in high-contrast ${style || "cinema"} style.`,
    visualStyle: style || "cinema",
    musicVibe: chosenMusic,
    tempoBpm: bpm,
    scale: scale,
    crewDialogue: crewDialogue,
    scenes: [
      {
        sceneNumber: 1,
        title: "The Awakening",
        duration: 5.0,
        narration: `We begin our odyssey. A faint shimmer stirs in the depths of space, reflecting: ${prompt}.`,
        visualDescription: "A dark deep cosmos with glowing nebula patterns and floating geometric orbits.",
        backgroundColor: currentStyle.bg[0],
        accentColor: currentStyle.accent,
        gradientColors: currentStyle.bg,
        cameraMotion: {
          type: "zoom-in",
          speed: "slow",
          scaleStart: 1.0,
          scaleEnd: 1.15,
          xStart: 0,
          xEnd: 0,
          yStart: 0,
          yEnd: 0,
        },
        elements: [
          {
            type: "layered-shape",
            shape: "circle",
            color: currentStyle.accent,
            size: 150,
            position: { x: 50, y: 50 },
            movement: "pulse",
            depth: 2,
            details: "An energy core humming with potential",
          },
          {
            type: "starfield",
            shape: "star",
            color: "#ffffff",
            size: 40,
            position: { x: 20, y: 30 },
            movement: "float",
            depth: 1,
          },
          {
            type: "geometric-grid",
            shape: "line",
            color: currentStyle.elemColor,
            size: 300,
            position: { x: 50, y: 80 },
            movement: "glide",
            depth: 1,
          },
        ],
        particles: {
          type: style === "anime" ? "cherry-blossoms" : style === "cyberpunk" ? "sparks" : "stars",
          count: 60,
          color: currentStyle.accent,
          speed: 1.2,
          size: 2,
        },
      },
      {
        sceneNumber: 2,
        title: "The Celestial Spark",
        duration: 6.0,
        narration: "A wave of neon energy surges forward, giving shape to the dreams of the voyager.",
        visualDescription: "Dynamic visual shapes expand outward in a concentric shockwave of vibrant sparks.",
        backgroundColor: currentStyle.bg[1] || currentStyle.bg[0],
        accentColor: currentStyle.elemColor,
        gradientColors: [currentStyle.bg[1] || currentStyle.bg[0], currentStyle.bg[2] || currentStyle.bg[0]],
        cameraMotion: {
          type: "pan-right",
          speed: "medium",
          scaleStart: 1.05,
          scaleEnd: 1.05,
          xStart: -20,
          xEnd: 20,
          yStart: 0,
          yEnd: 0,
        },
        elements: [
          {
            type: "abstract-mesh",
            shape: "ring",
            color: currentStyle.elemColor,
            size: 220,
            position: { x: 45, y: 45 },
            movement: "rotate",
            depth: 2,
            details: "Spinning rings of stardust",
          },
          {
            type: "layered-shape",
            shape: "star",
            color: currentStyle.accent,
            size: 90,
            position: { x: 75, y: 35 },
            movement: "float",
            depth: 3,
          },
        ],
        particles: {
          type: "sparks",
          count: 80,
          color: currentStyle.elemColor,
          speed: 2.0,
          size: 3.5,
        },
      },
      {
        sceneNumber: 3,
        title: "Navigating the Unknown",
        duration: 5.5,
        narration: "We weave through ancient cosmic ruins, guided by the pulse of the background rhythm.",
        visualDescription: "Structural pillars or grid horizons drift backwards as a parallax background sweeps.",
        backgroundColor: currentStyle.bg[2] || currentStyle.bg[0],
        accentColor: currentStyle.accent,
        gradientColors: currentStyle.bg.reverse(),
        cameraMotion: {
          type: "parallax-tilt",
          speed: "slow",
          scaleStart: 1.1,
          scaleEnd: 1.0,
          xStart: 10,
          xEnd: -10,
          yStart: -10,
          yEnd: 10,
        },
        elements: [
          {
            type: "landscape-silhouette",
            shape: "polygon",
            color: "#05030d",
            size: 400,
            position: { x: 50, y: 90 },
            movement: "none",
            depth: 3,
            details: "Dark peaks outlining the horizon",
          },
          {
            type: "layered-shape",
            shape: "circle",
            color: "#ffffff",
            size: 80,
            position: { x: 30, y: 40 },
            movement: "pulse",
            depth: 1,
            details: "A distant glowing white sun",
          },
        ],
        particles: {
          type: "bubbles",
          count: 50,
          color: currentStyle.accent,
          speed: 1.0,
          size: 4,
        },
      },
      {
        sceneNumber: 4,
        title: "Transcendent Horizon",
        duration: 6.5,
        narration: "At last, we arrive at the nexus. Visual and musical harmony align in a brilliant final crescendo.",
        visualDescription: "All elements converge into a radiating geometric starburst centering the player.",
        backgroundColor: currentStyle.bg[0],
        accentColor: currentStyle.accent,
        gradientColors: currentStyle.bg,
        cameraMotion: {
          type: "zoom-out",
          speed: "slow",
          scaleStart: 1.2,
          scaleEnd: 1.0,
          xStart: 0,
          xEnd: 0,
          yStart: 0,
          yEnd: 0,
        },
        elements: [
          {
            type: "abstract-mesh",
            shape: "polygon",
            color: currentStyle.accent,
            size: 180,
            position: { x: 50, y: 50 },
            movement: "rotate",
            depth: 2,
            details: "A perfect tetrahedral crystalline core",
          },
          {
            type: "layered-shape",
            shape: "ring",
            color: currentStyle.elemColor,
            size: 320,
            position: { x: 50, y: 50 },
            movement: "pulse",
            depth: 1,
          },
        ],
        particles: {
          type: "stars",
          count: 100,
          color: "#ffffff",
          speed: 1.5,
          size: 2.5,
        },
      },
    ],
  };
}

// HELPERS: Mock Fallback Artistic Suggestions
function getFallbackArtisticSuggestions(prompt: string, style: string): any {
  const normStyle = (style || "cinema").toLowerCase();
  
  let emotionalArc = "Opening in quiet anticipation, building dynamic momentum, and resolving in high-contrast visual awe.";
  let cinematicVibe = "Grand Epic Cinema with dramatic lens flares, high-key backlight contrasts, and sweeping focal shifts.";
  
  if (normStyle === "cyberpunk" || normStyle === "vaporwave") {
    emotionalArc = "Initiating in low-key digital melancholia, building to an energetic neon-saturated crescendo, and dissolving into deep scanline feedback.";
    cinematicVibe = "High-tech Retro-noir with chromatic aberration overlays, wide anamorphic lenses, and rhythmic strobing underglow.";
  } else if (normStyle === "anime" || normStyle === "watercolor") {
    emotionalArc = "Beginning in warm pastel serenity, transitioning to floating organic ecstasy, and stabilizing in peaceful ambient harmony.";
    cinematicVibe = "Nostalgic Hand-drawn/Bleeding Watercolor with warm sun-drenched atmospheric haze and dynamic circular focus.";
  }

  return {
    emotionalArc,
    cinematicVibe,
    suggestions: [
      {
        sceneNumber: 1,
        title: `The Dawn of ${prompt.substring(0, 15)}`,
        flowDescription: `Establish the foundational setting of "${prompt}". Use minimalist, heavy silhouettes at the bottom frame with high-contrast gradient light behind them to convey deep scale and immediate mystery.`,
        cameraAngle: "Extreme Low-Angle Wide Shot",
        cameraReason: "Emphasizes the massive scale and makes the viewer feel dwarfed by the environment, creating a sense of wonder and visual weight.",
        transitionType: "Soft Bleed-in Dissolve",
        transitionReason: "Enables the colors to bleed slowly into existence, echoing an awakening consciousness or initial dramatic idea.",
        vfxNotes: "Atmospheric bloom lights drifting slowly from bottom-left to top-right, creating soft sunbeam light leaks."
      },
      {
        sceneNumber: 2,
        title: "Intimate Revelation",
        flowDescription: `Focus in on a central stylized element. Contrast the deep landscape with an intense, close focus on details — for instance, a glowing emblem, key actor silhouette, or floating energy core.`,
        cameraAngle: "High-Contrast Shallow Depth-of-Field Close-Up",
        cameraReason: "Forces the viewer's eye onto the texture and micro-movements, creating emotional intimacy and detailing the narrative shift.",
        transitionType: "Anamorphic Focus Match Cut",
        transitionReason: "Maintains focal alignment between scenes while shifting scale, keeping the viewer's psychological interest centered on the key element.",
        vfxNotes: "Dynamic particle sparks and digital grid lines pulsing slightly in sync with a heavy bass heartbeat overlay."
      },
      {
        sceneNumber: 3,
        title: "Transcendent Horizon Convergence",
        flowDescription: `The narrative reaches its visual crescendo. Let all elements expand outward. Connect the sky gradient with high-speed lines or swirling vectors that converge at a central golden-hour focus point.`,
        cameraAngle: "Sweeping Crane Orbit Shot with Dutch Tilt",
        cameraReason: "Injects dynamic vertical energy and a slight vertigo-inducing tilt, signifying transcendence, triumph, or an epic paradigm shift.",
        transitionType: "Kinetic Whip Pan",
        transitionReason: "Matches high energy output of the climax, pulling the camera away at warp speed to leave a lasting visual imprint.",
        vfxNotes: "Radial light shafts emerging from the epicenter, layered with falling petal or spark systems and heavy vignettes."
      }
    ]
  };
}

// Start Server Setup with Vite integration
async function startServer() {
  // Mount Vite middleware for dev mode
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development server middleware mounted.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Production static server route mounted.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`ZH-art Server running on http://localhost:${PORT}`);
  });
}

startServer();
