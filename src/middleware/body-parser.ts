import type { Handler } from "../types";

const DEFAULT_LIMIT = 1024 * 1024;

export interface JsonOptions {
  limit?: number;
  type?: string | RegExp | ((contentType: string) => boolean);
}

export interface UrlencodedOptions {
  limit?: number;
  extended?: boolean;
  type?: string | RegExp | ((contentType: string) => boolean);
}

export interface TextOptions {
  limit?: number;
  type?: string | RegExp | ((contentType: string) => boolean);
}

export interface RawOptions {
  limit?: number | string;
  type?: string | RegExp | ((contentType: string) => boolean);
  verify?: (req: any, res: any, buf: Buffer, encoding: string) => void;
}

function matchesType(contentType: string, matcher: string | RegExp | ((ct: string) => boolean)): boolean {
  if (typeof matcher === "string") return contentType.includes(matcher);
  if (matcher instanceof RegExp) return matcher.test(contentType);
  return matcher(contentType);
}

function parseLimit(limit: number | string): number {
  if (typeof limit === "number") return limit;

  const units: Record<string, number> = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
  };

  const match = limit.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
  if (!match || !match[1]) return DEFAULT_LIMIT;

  const value = parseFloat(match[1]);
  const unitStr = match[2] || "b";
  const unit = unitStr as keyof typeof units;
  return Math.floor(value * (units[unit] ?? 1));
}

export function json(options: JsonOptions = {}): Handler {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const typeMatcher = options.type ?? "application/json";

  return async (req, res, next) => {
    if (req.isBodyParsed()) {
      next();
      return;
    }

    const contentType = req.get("content-type") || "";
    if (!matchesType(contentType, typeMatcher)) {
      next();
      return;
    }

    try {
      await req.parseJson(limit);
      next();
    } catch (err) {
      const status = (err as { status?: number }).status || 400;
      const message = err instanceof Error ? err.message : "Invalid JSON";
      res.status(status).json({ error: message });
    }
  };
}

export function urlencoded(options: UrlencodedOptions = {}): Handler {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const typeMatcher = options.type ?? "application/x-www-form-urlencoded";

  return async (req, res, next) => {
    if (req.isBodyParsed()) {
      next();
      return;
    }

    const contentType = req.get("content-type") || "";
    if (!matchesType(contentType, typeMatcher)) {
      next();
      return;
    }

    try {
      await req.parseUrlencoded(limit);
      next();
    } catch (err) {
      const status = (err as { status?: number }).status || 400;
      const message = err instanceof Error ? err.message : "Invalid form data";
      res.status(status).json({ error: message });
    }
  };
}

export function text(options: TextOptions = {}): Handler {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const typeMatcher = options.type ?? "text/plain";

  return async (req, res, next) => {
    if (req.isBodyParsed()) {
      next();
      return;
    }

    const contentType = req.get("content-type") || "";
    if (!matchesType(contentType, typeMatcher)) {
      next();
      return;
    }

    try {
      await req.parseText(limit);
      next();
    } catch (err) {
      const status = (err as { status?: number }).status || 400;
      const message = err instanceof Error ? err.message : "Invalid text";
      res.status(status).json({ error: message });
    }
  };
}

export function raw(options: RawOptions = {}): Handler {
  const limit = parseLimit(options.limit ?? "100kb");
  const typeMatcher = options.type ?? "application/octet-stream";
  const verify = options.verify;

  return async (req, res, next) => {
    if (req.isBodyParsed()) {
      next();
      return;
    }

    const contentType = req.get("content-type") || "";
    if (!matchesType(contentType, typeMatcher)) {
      next();
      return;
    }

    try {
      const rawBody = await req.rawBody();

      if (rawBody.length > limit) {
        res.status(413).json({ error: "Payload too large" });
        return;
      }

      const buffer = Buffer.from(rawBody);

      if (verify) {
        try {
          verify(req, res, buffer, "binary");
        } catch (verifyErr) {
          const message = verifyErr instanceof Error ? verifyErr.message : "Verification failed";
          res.status(403).json({ error: message });
          return;
        }
      }

      req.body = buffer;
      next();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to parse raw body";
      res.status(400).json({ error: message });
    }
  };
}
