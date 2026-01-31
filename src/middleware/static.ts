import type { Handler } from "../types";
import { existsSync, statSync, realpathSync } from "fs";
import { join, resolve } from "path";
import { getMimeType, generateETag } from "../utils";

/**
 * Check if the resolved file path is safely within the root directory.
 * Prevents path traversal attacks including encoded sequences.
 */
function isPathSafe(filePath: string, rootPath: string): boolean {
  try {
    // Normalize and resolve to absolute paths
    const normalizedRoot = resolve(rootPath);
    const normalizedFile = resolve(filePath);

    // Check the file is within root (must start with root + separator or equal root)
    if (!normalizedFile.startsWith(normalizedRoot + "/") && normalizedFile !== normalizedRoot) {
      return false;
    }

    // If file exists, also verify via realpath to catch symlink attacks
    if (existsSync(normalizedFile)) {
      const realFile = realpathSync(normalizedFile);
      const realRoot = realpathSync(normalizedRoot);
      if (!realFile.startsWith(realRoot + "/") && realFile !== realRoot) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

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

    // Construct initial file path
    let filePath = join(rootPath, urlPath);

    // Security: Verify path is within root directory (prevents traversal attacks)
    if (!isPathSafe(filePath, rootPath)) {
      if (fallthrough) {
        next();
        return;
      }
      res.status(403).json({ error: "Forbidden" });
      return;
    }
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
      const etagValue = generateETag(stat.size, stat.mtimeMs);
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
