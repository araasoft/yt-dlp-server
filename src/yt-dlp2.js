import { YtDlp } from "ytdlp-nodejs";

const binaryPath = "./bin/yt-dlp";

const ytdlp = new YtDlp({
  binaryPath,
});

const urlCache = new Map();
const pendingExtractions = new Map();

const CACHE_TTL = 20 * 60 * 1000;
const qualityOrder = {
  249: 1,
  250: 2,
  251: 3,
};

function getUrlExpiry(url) {
  const parsed = new URL(url);
  const expire = Number(parsed.searchParams.get("expire"));
  return expire ? expire * 1000 : 0;
}

async function extractAudio(videoId) {
  const start = Date.now();

  try {
    const urls = await ytdlp.getDirectUrlsAsync(
      `https://www.youtube.com/watch?v=${videoId}`,
      {
        cookies: "./cookies.txt",
        format: "bestaudio",
      },
    );

    const relevantAudio = urls
      .map((url) => {
        try {
          const parsed = new URL(url);
          const mime = parsed.searchParams.get("mime");
          const itag = parsed.searchParams.get("itag");

          if (!mime?.startsWith("audio/")) return null;

          const expire = Number(parsed.searchParams.get("expire"));

          return {
            url,
            mime,
            itag,
            quality: qualityOrder[itag] ?? 0,
            expiresAt: expire ? expire * 1000 : null,
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => a.quality - b.quality);

    if (!relevantAudio.length) {
      throw new Error("No audio formats available");
    }

    console.log(`[yt-dlp] ${videoId}: ${Date.now() - start}ms`);

    return relevantAudio;
  } catch (error) {
    console.error(`[yt-dlp] ${videoId}:`, error.message);
    throw error;
  }
}

async function getAudio(videoId) {
  const cached = urlCache.get(videoId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.audios;
  }

  try {
    const audios = await extractAudio(videoId);
    const expiresAt = Math.min(
      ...audios.map((audio) => getUrlExpiry(audio.url)).filter(Boolean),
    );

    urlCache.set(videoId, {
      audios,
      expiresAt,
    });

    return audios;
  } finally {
  }
}

export default async function getUrl(id, quality = 0) {
  console.log("------------------------------------------");
  console.log("-------- YT-DLP RECEVED REQUEST  ---------");
  console.log(`-------- DATA ${id}  ---------`);
  console.log("------------------------------------------");

  const start = Date.now();
  const audios = await getAudio(id);
  const qualityIndex = Math.max(0, Math.min(2, Number(quality) || 0));
  const selected =
    audios.find((audio) => audio.quality === qualityIndex) ??
    audios[qualityIndex] ??
    audios[audios.length - 1];

  console.log(`[getUrl] ${id}: ${Date.now() - start}ms`);

  return {
    url: selected.url,
    mime: selected.mime,
    audios: [
      {
        itag: selected.itag,
        quality: qualityIndex,
        url: selected.url,
        song: {},
      },
    ],
  };
}
