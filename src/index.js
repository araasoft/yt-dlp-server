import express from "express";
import cors from "cors";
import {
  requestLogger,
  notFoundHandler,
  errorHandler,
} from "./api-middleware.js";
import { securityHeaders, corsOptions, createRateLimiter } from "./security.js";
import getAudioUrl from "./yt-dlp.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.set("etag", "weak");

  app.use(securityHeaders);

  app.get("/api/health", (req, res) =>
    res.json({
      ok: true,
      name: "AraaMusic Songs Server Woking...",
      pid: process.pid,
      uptime: Math.round(process.uptime()),
    }),
  );

  //  app.use(cors(corsOptions()));
  app.use(requestLogger);
  app.use(createRateLimiter({ windowMs: 60_000, max: 300 }));
  app.use(express.json({ limit: "100kb" })); // all payloads here are tiny

  app.use("/api/:session/get/url/:id/:quality", async (req, res) => {
    const { id, quality } = req.params;
    const data = await getAudioUrl(id, quality);
    res.status(200).json(data);
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

const PORT = process.env.PORT || 5001;
const app = createApp();

app.listen(PORT, () => {
  console.log(`AraaMusic API listening on http://localhost:${PORT}`);
});
