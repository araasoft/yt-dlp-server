import dotenv from "dotenv";
dotenv.config()
// Shared security helpers: headers, CORS, validators. Zero dependencies.

export function securityHeaders(req, res, next) {
  res.removeHeader("X-Powered-By");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  // API only returns JSON / images: nothing should ever execute from it.
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  if (req.secure || req.headers["x-forwarded-proto"] === "https") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
}

// CORS_ORIGIN may be a comma-separated allow-list.
export function corsOptions() {
  const allowed = (process.env.CORS_ORIGIN || "http://localhost:8158")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    origin(origin, cb) {
      // No Origin header = non-browser client (curl, mobile app): allowed.
      if (!origin || allowed.includes(origin)) return cb(null, true);
      cb(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 600,
  };
}

// Firebase RTDB keys cannot contain . $ # [ ] / and must be non-empty.
export const isSafeKey = (s) =>
  typeof s === "string" && s.length > 0 && s.length <= 128 && !/[.$#[\]/\u0000-\u001f]/.test(s);

export const isSafeId = (s) => typeof s === "string" && /^[\w-]{1,128}$/.test(s);

export const escapeXml = (s) =>
  String(s).replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]);

// Rejects :id params that are not simple identifiers (blocks path tricks / RTDB crashes).
export const safeIdParam = (name) => (req, res, next) => {
  if (!isSafeId(req.params[name])) {
    return res.status(400).json({ status: "error", code: 400, message: `Invalid ${name}` });
  }
  next();
};

// Fixed-window per-key rate limiter with bounded memory.
export function createRateLimiter({ windowMs = 60_000, max = 100, maxKeys = 50_000, keyFn = (r) => r.ip } = {}) {
  let hits = new Map();
  let windowStart = Date.now();
  return (req, res, next) => {
    const now = Date.now();
    if (now - windowStart >= windowMs) {
      hits = new Map();
      windowStart = now;
    }
    const key = keyFn(req) || "unknown";
    let n = hits.get(key) || 0;
    if (n === 0 && hits.size >= maxKeys) return res.status(429).json({ status: "error", code: 429, message: "Too many requests" });
    n++;
    hits.set(key, n);
    const retry = Math.ceil((windowStart + windowMs - now) / 1000);
    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, max - n)));
    if (n > max) {
      res.setHeader("Retry-After", String(retry));
      return res.status(429).json({ status: "error", code: 429, message: "Too many requests", details: { retryAfter: retry } });
    }
    next();
  };
}
