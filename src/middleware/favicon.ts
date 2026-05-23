import { existsSync, readFileSync } from "fs";
import type { Handler } from "../types";

export interface FaviconOptions {
  maxAge?: number;
}

export function favicon(path: string, options: FaviconOptions = {}): Handler {
  if (!existsSync(path)) {
    throw new Error(`Favicon not found: ${path}`);
  }

  const icon = readFileSync(path);
  const maxAge = Math.floor((options.maxAge ?? 86_400_000) / 1000);
  const etag = `"${icon.byteLength.toString(16)}-${Date.now().toString(16)}"`;

  const headers = {
    "Content-Type": "image/x-icon",
    "Content-Length": String(icon.byteLength),
    "Cache-Control": `public, max-age=${maxAge}`,
    ETag: etag,
  };

  return (req, res, next) => {
    if (req.path !== "/favicon.ico") {
      next();
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      next();
      return;
    }

    res.set("Content-Type", headers["Content-Type"]);
    res.set("Content-Length", headers["Content-Length"]);
    res.set("Cache-Control", headers["Cache-Control"]);
    res.set("ETag", headers.ETag);

    if (req.get("if-none-match") === etag) {
      res.status(304).send(null);
      return;
    }

    if (req.method === "HEAD") {
      res.status(200).send(null);
      return;
    }

    res.status(200).send(icon);
  };
}
