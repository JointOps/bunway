import type { Handler } from "../types";

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  message?: string | object;
  statusCode?: number;
  headers?: boolean;
  keyGenerator?: (req: { ip: string; path: string; method: string }) => string;
  skip?: (req: { ip: string; path: string; method: string }) => boolean;
  onLimitReached?: (req: { ip: string; path: string; method: string }) => void;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export function rateLimit(options: RateLimitOptions = {}): Handler {
  const {
    windowMs = 60 * 1000,
    max = 100,
    message = { error: "Too many requests, please try again later." },
    statusCode = 429,
    headers = true,
    keyGenerator = (req) => req.ip,
    skip,
    onLimitReached,
  } = options;

  const store = new Map<string, RateLimitEntry>();

  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.resetTime <= now) {
        store.delete(key);
      }
    }
  }, windowMs);

  return (req, res, next) => {
    const reqInfo = { ip: req.ip, path: req.path, method: req.method };

    if (skip && skip(reqInfo)) {
      next();
      return;
    }

    const key = keyGenerator(reqInfo);
    const now = Date.now();

    let entry = store.get(key);

    if (!entry || entry.resetTime <= now) {
      entry = {
        count: 0,
        resetTime: now + windowMs,
      };
      store.set(key, entry);
    }

    entry.count++;

    const remaining = Math.max(0, max - entry.count);
    const resetSeconds = Math.ceil((entry.resetTime - now) / 1000);

    if (headers) {
      res.set("X-RateLimit-Limit", String(max));
      res.set("X-RateLimit-Remaining", String(remaining));
      res.set("X-RateLimit-Reset", String(resetSeconds));
    }

    if (entry.count > max) {
      if (onLimitReached) {
        onLimitReached(reqInfo);
      }

      if (headers) {
        res.set("Retry-After", String(resetSeconds));
      }

      res.status(statusCode);
      if (typeof message === "string") {
        res.json({ error: message });
      } else {
        res.json(message);
      }
      return;
    }

    next();
  };
}
