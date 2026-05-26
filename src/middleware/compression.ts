import type { Handler } from "../types";

export interface CompressionOptions {
  level?: number;
  threshold?: number;
  filter?: (contentType: string) => boolean;
}

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
    if ((res as any)[COMPRESSION_APPLIED]) { next(); return; }
    (res as any)[COMPRESSION_APPLIED] = true;

    const accept = req.get("accept-encoding") || "";
    const encoding = accept.includes("br") ? "br"
      : accept.includes("gzip") ? "gzip"
      : accept.includes("deflate") ? "deflate"
      : null;

    if (encoding) {
      (res as any)._compressionEncoding = encoding;
      (res as any)._compressionThreshold = threshold;
      (res as any)._compressionLevel = level;
      (res as any)._compressionFilter = filter;
    }

    next();
  };
}
