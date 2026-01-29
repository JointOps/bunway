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

function matchesType(contentType: string, matcher: string | RegExp | ((ct: string) => boolean)): boolean {
  if (typeof matcher === "string") return contentType.includes(matcher);
  if (matcher instanceof RegExp) return matcher.test(contentType);
  return matcher(contentType);
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
