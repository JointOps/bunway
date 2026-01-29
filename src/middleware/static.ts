import type { Handler } from "../types";
import { existsSync, statSync } from "fs";
import { join, extname } from "path";

export interface StaticOptions {
  index?: string | string[] | false;
  dotfiles?: "allow" | "deny" | "ignore";
  maxAge?: number;
  immutable?: boolean;
  etag?: boolean;
  lastModified?: boolean;
  fallthrough?: boolean;
  extensions?: string[];
}

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".eot": "application/vnd.ms-fontobject",
  ".pdf": "application/pdf",
  ".zip": "application/zip",
  ".gz": "application/gzip",
  ".tar": "application/x-tar",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".wasm": "application/wasm",
};

function getMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

interface FileStat {
  mtimeMs: number;
  size: number;
  mtime: Date;
  isFile(): boolean;
  isDirectory(): boolean;
}

function generateETag(stat: FileStat): string {
  const mtime = stat.mtimeMs.toString(16);
  const size = stat.size.toString(16);
  return `W/"${size}-${mtime}"`;
}

export function serveStatic(root: string, options: StaticOptions = {}): Handler {
  const {
    index = "index.html",
    dotfiles = "ignore",
    maxAge = 0,
    immutable = false,
    etag = true,
    lastModified = true,
    fallthrough = true,
    extensions = [],
  } = options;

  const indexFiles = index === false ? [] : Array.isArray(index) ? index : [index];
  const rootPath = root.startsWith("/") ? root : join(process.cwd(), root);

  return async (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      if (fallthrough) {
        next();
        return;
      }
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    let urlPath = decodeURIComponent(req.path);

    if (urlPath.includes("..")) {
      if (fallthrough) {
        next();
        return;
      }
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    let filePath = join(rootPath, urlPath);
    let stat: ReturnType<typeof statSync> | null = null;

    if (existsSync(filePath)) {
      stat = statSync(filePath);

      if (stat.isDirectory()) {
        for (const indexFile of indexFiles) {
          const indexPath = join(filePath, indexFile);
          if (existsSync(indexPath)) {
            filePath = indexPath;
            stat = statSync(filePath);
            break;
          }
        }

        if (stat.isDirectory()) {
          if (fallthrough) {
            next();
            return;
          }
          res.status(404).json({ error: "Not Found" });
          return;
        }
      }
    } else {
      for (const ext of extensions) {
        const extPath = filePath + (ext.startsWith(".") ? ext : `.${ext}`);
        if (existsSync(extPath)) {
          filePath = extPath;
          stat = statSync(filePath);
          break;
        }
      }
    }

    if (!stat || !stat.isFile()) {
      if (fallthrough) {
        next();
        return;
      }
      res.status(404).json({ error: "Not Found" });
      return;
    }

    const fileName = filePath.split("/").pop() || "";
    if (fileName.startsWith(".")) {
      if (dotfiles === "deny") {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      if (dotfiles === "ignore") {
        if (fallthrough) {
          next();
          return;
        }
        res.status(404).json({ error: "Not Found" });
        return;
      }
    }

    const mimeType = getMimeType(filePath);
    res.set("Content-Type", mimeType);
    res.set("Content-Length", String(stat.size));

    if (etag) {
      const etagValue = generateETag(stat);
      res.set("ETag", etagValue);

      const ifNoneMatch = req.get("if-none-match");
      if (ifNoneMatch === etagValue) {
        res.status(304).send(null);
        return;
      }
    }

    if (lastModified) {
      res.set("Last-Modified", stat.mtime.toUTCString());

      const ifModifiedSince = req.get("if-modified-since");
      if (ifModifiedSince) {
        const clientDate = new Date(ifModifiedSince);
        if (stat.mtime <= clientDate) {
          res.status(304).send(null);
          return;
        }
      }
    }

    let cacheControl = `max-age=${maxAge}`;
    if (immutable) {
      cacheControl += ", immutable";
    }
    res.set("Cache-Control", cacheControl);

    if (req.method === "HEAD") {
      res.status(200).send(null);
      return;
    }

    const file = Bun.file(filePath);
    const content = await file.arrayBuffer();
    res.status(200).send(content);
  };
}
