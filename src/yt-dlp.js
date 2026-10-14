// src/services/ytdlp-link.js
// New, separate module. Does NOT touch src/data/yt-dlp.js.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { copyFileSync, existsSync } from "node:fs";

const run = promisify(execFile);

const BIN = process.env.YTDLP_BIN || "yt-dlp";
const COOKIES_SRC = process.env.YTDLP_COOKIES || "";
const COOKIES_RW = "/tmp/cookies.rw.txt"; // yt-dlp writes to this file
const PROXY = process.env.YTDLP_PROXY || ""; // http://user:pass@host:port
const MAX_PARALLEL = Number(process.env.YTDLP_CONCURRENCY || 3);
const CACHE_TTL_MS = 20 * 60 * 1000; // stream URLs expire (~6h), keep short

const FORMATS = {
  low: "worstaudio/worst",
  medium: "bestaudio[abr<=128]/bestaudio",
  high: "bestaudio/best",
};

if (COOKIES_SRC && existsSync(COOKIES_SRC)) copyFileSync(COOKIES_SRC, COOKIES_RW);

const cache = new Map(); // key -> { url, exp }
const inflight = new Map(); // key -> Promise (dedupe identical requests)
let active = 0;
const queue = [];

function acquire() {
  return new Promise((resolve) => {
    if (active < MAX_PARALLEL) {
      active++;
      resolve();
    } else queue.push(resolve);
  });
}
function release() {
  const next = queue.shift();
  if (next) next();
  else active--;
}

function buildArgs(id, quality) {
  const args = [
    "--no-warnings",
    "--no-playlist",
    "--js-runtimes", "deno",
    "--extractor-args", "youtube:player_client=default,mweb",
    "--socket-timeout", "15",
    "--retries", "2",
    "-f", FORMATS[quality] || FORMATS.high,
    "-g",
  ];
  if (existsSync(COOKIES_RW)) args.push("--cookies", COOKIES_RW);
  if (PROXY) args.push("--proxy", PROXY);
  args.push(`https://www.youtube.com/watch?v=${id}`);
  return args;
}

export async function getAudioUrl(id, quality = "high") {
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) {
    const e = new Error("Invalid video id");
    e.status = 400;
    throw e;
  }
  const key = `${id}:${quality}`;

  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.url;

  if (inflight.has(key)) return inflight.get(key);

  const p = (async () => {
    await acquire();
    try {
      const { stdout } = await run(BIN, buildArgs(id, quality), {
        timeout: 45_000,
        maxBuffer: 1024 * 1024,
      });
      const url = stdout.trim().split("\n")[0];
      if (!url.startsWith("http")) throw new Error("No URL returned");
      cache.set(key, { url, exp: Date.now() + CACHE_TTL_MS });
      return url;
    } catch (err) {
      const msg = String(err.stderr || err.message || "");
      const e = new Error(
        /Sign in to confirm|not a bot/i.test(msg)
          ? "YouTube bot check: refresh cookies or use a proxy"
          : "Extraction failed"
      );
      e.status = /not a bot|Sign in/i.test(msg) ? 503 : 502;
      e.detail = msg.slice(0, 500); // log only, never send to client
      throw e;
    } finally {
      release();
    }
  })();

  inflight.set(key, p);
  try {
    return await p;
  } finally {
    inflight.delete(key);
  }
}

// Example Express route:
// import { getAudioUrl } from "./services/ytdlp-link.js";
// app.get("/api/public/link/:id/:quality", async (req, res) => {
//   try {
//     res.json({ url: await getAudioUrl(req.params.id, req.params.quality) });
//   } catch (e) {
//     console.error(e.detail || e.message);
//     res.status(e.status || 500).json({ error: e.message });
//   }
// });
