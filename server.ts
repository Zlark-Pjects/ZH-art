import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

/*
 * ZH-art runs entirely in the browser: the storyboard builder, playback,
 * score and video export need no API keys and no backend. This server only
 * hosts the app (Vite middleware in development, the built files in production).
 */

const app = express();
const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, { index: false, maxAge: "1h" }));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`ZH-art running on http://localhost:${PORT}`);
  });
}

startServer();
