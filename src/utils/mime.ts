import { extname } from "path";

/**
 * MIME type mappings for common file extensions.
 * Text-based formats include charset=utf-8 for proper encoding.
 */
export const MIME_TYPES: Record<string, string> = {
  // HTML/Text
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",

  // JavaScript
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",

  // Data formats
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",

  // Images
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".avif": "image/avif",

  // Fonts
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".eot": "application/vnd.ms-fontobject",

  // Documents
  ".pdf": "application/pdf",

  // Archives
  ".zip": "application/zip",
  ".gz": "application/gzip",
  ".tar": "application/x-tar",

  // Audio
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",

  // Video
  ".mp4": "video/mp4",
  ".webm": "video/webm",

  // WebAssembly
  ".wasm": "application/wasm",
};

/**
 * Get the MIME type for a file based on its extension.
 * @param filePath - The file path or filename
 * @returns The MIME type string, defaults to "application/octet-stream"
 */
export function getMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

/**
 * Get the MIME type without charset suffix (for Content-Type comparison).
 * @param filePath - The file path or filename
 * @returns The base MIME type without charset
 */
export function getBaseMimeType(filePath: string): string {
  const mimeType = getMimeType(filePath);
  return mimeType.split(";")[0]!.trim();
}
