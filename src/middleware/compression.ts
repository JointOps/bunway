import type { Handler } from "../types";
import { gzipSync, deflateSync } from "zlib";

export interface CompressionOptions {
  level?: number;
  threshold?: number;
  filter?: (contentType: string) => boolean;
}

// Symbol to mark response as already wrapped by compression
const COMPRESSION_APPLIED = Symbol("compressionApplied");

const COMPRESSIBLE_TYPES = [
  "text/",
  "application/json",
  "application/javascript",
  "application/xml",
  "application/xhtml+xml",
  "image/svg+xml",
];

function isCompressible(contentType: string): boolean {
  return COMPRESSIBLE_TYPES.some((type) => contentType.includes(type));
}

export function compression(options: CompressionOptions = {}): Handler {
  const { level = 6, threshold = 1024, filter = isCompressible } = options;

  return (req, res, next) => {
    // Prevent double-wrapping if compression middleware is applied multiple times
    if ((res as any)[COMPRESSION_APPLIED]) {
      next();
      return;
    }
    (res as any)[COMPRESSION_APPLIED] = true;

    const acceptEncoding = req.get("accept-encoding") || "";
    const supportsGzip = acceptEncoding.includes("gzip");
    const supportsDeflate = acceptEncoding.includes("deflate");

    if (!supportsGzip && !supportsDeflate) {
      next();
      return;
    }

    const originalJson = res.json.bind(res);
    const originalText = res.text.bind(res);
    const originalHtml = res.html.bind(res);
    const originalSend = res.send.bind(res);

    const compress = (
      data: string | ArrayBuffer | Uint8Array | null,
      contentType: string
    ): { data: ArrayBuffer | string | null; encoding: string | null } => {
      if (data === null) return { data: null, encoding: null };

      let buffer: Buffer;
      if (typeof data === "string") {
        buffer = Buffer.from(data, "utf-8");
      } else if (data instanceof ArrayBuffer) {
        buffer = Buffer.from(data);
      } else {
        buffer = Buffer.from(data);
      }

      if (buffer.length < threshold) {
        if (typeof data === "string") {
          return { data, encoding: null };
        }
        return { data: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer, encoding: null };
      }

      if (!filter(contentType)) {
        if (typeof data === "string") {
          return { data, encoding: null };
        }
        return { data: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer, encoding: null };
      }

      if (supportsGzip) {
        const compressed = gzipSync(buffer, { level });
        return { data: compressed.buffer.slice(compressed.byteOffset, compressed.byteOffset + compressed.byteLength) as ArrayBuffer, encoding: "gzip" };
      }

      if (supportsDeflate) {
        const compressed = deflateSync(buffer, { level });
        return { data: compressed.buffer.slice(compressed.byteOffset, compressed.byteOffset + compressed.byteLength) as ArrayBuffer, encoding: "deflate" };
      }

      if (typeof data === "string") {
        return { data, encoding: null };
      }
      return { data: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer, encoding: null };
    };

    res.json = (data: unknown): void => {
      const jsonStr = JSON.stringify(data);
      const result = compress(jsonStr, "application/json");
      if (result.encoding) {
        res.set("Content-Encoding", result.encoding);
        res.set("Vary", "Accept-Encoding");
      }
      res.set("Content-Type", "application/json");
      res.send(result.data);
    };

    res.text = (data: string): void => {
      const result = compress(data, "text/plain");
      if (result.encoding) {
        res.set("Content-Encoding", result.encoding);
        res.set("Vary", "Accept-Encoding");
      }
      res.set("Content-Type", "text/plain");
      res.send(result.data);
    };

    res.html = (data: string): void => {
      const result = compress(data, "text/html");
      if (result.encoding) {
        res.set("Content-Encoding", result.encoding);
        res.set("Vary", "Accept-Encoding");
      }
      res.set("Content-Type", "text/html");
      res.send(result.data);
    };

    next();
  };
}
