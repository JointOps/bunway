/**
 * Lightweight content negotiation utilities.
 * Replaces the `accepts` and `type-is` npm packages.
 *
 * Implements RFC 7231 quality-value parsing for Accept, Accept-Charset,
 * Accept-Encoding, and Accept-Language headers.
 */

export interface MediaType {
  type: string;      // e.g., "text"
  subtype: string;   // e.g., "html"
  quality: number;   // 0.0–1.0
  params: Record<string, string>;
}

/**
 * Parse an Accept-style header into an array of {value, quality} pairs,
 * sorted by quality descending.
 *
 * Handles:
 * - `text/html, application/json;q=0.9`
 * - `gzip, deflate;q=0.5, *;q=0.1`
 * - `en-US, en;q=0.9, fr;q=0.8`
 */
export function parseAcceptHeader(header: string): Array<{ value: string; quality: number; params: Record<string, string> }> {
  if (!header) return [];

  const entries: Array<{ value: string; quality: number; params: Record<string, string> }> = [];

  const parts = header.split(",");
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const segments = trimmed.split(";");
    const value = segments[0]!.trim();
    let quality = 1.0;
    const params: Record<string, string> = {};

    for (let i = 1; i < segments.length; i++) {
      const param = segments[i]!.trim();
      const eqIdx = param.indexOf("=");
      if (eqIdx === -1) continue;

      const key = param.slice(0, eqIdx).trim().toLowerCase();
      const val = param.slice(eqIdx + 1).trim();

      if (key === "q") {
        quality = parseFloat(val);
        if (isNaN(quality) || quality < 0) quality = 0;
        if (quality > 1) quality = 1;
      } else {
        params[key] = val;
      }
    }

    entries.push({ value, quality, params });
  }

  // Sort by quality descending, then by specificity (original order as tiebreaker)
  entries.sort((a, b) => b.quality - a.quality);
  return entries;
}

/**
 * Parse a MIME type string into type and subtype.
 *
 * "application/json" → { type: "application", subtype: "json" }
 * "text/*" → { type: "text", subtype: "*" }
 */
export function parseMediaType(mediaType: string): { type: string; subtype: string } | null {
  const slashIdx = mediaType.indexOf("/");
  if (slashIdx === -1) return null;

  return {
    type: mediaType.slice(0, slashIdx).trim().toLowerCase(),
    subtype: mediaType.slice(slashIdx + 1).trim().toLowerCase(),
  };
}

/**
 * Check if two MIME types match, supporting wildcards.
 *
 * matchMimeType("text/html", "text/*") → true
 * matchMimeType("application/json", "*​/*") → true
 * matchMimeType("text/html", "application/json") → false
 */
export function matchMimeType(actual: string, pattern: string): boolean {
  const a = parseMediaType(actual);
  const p = parseMediaType(pattern);
  if (!a || !p) return false;

  if (p.type === "*" && p.subtype === "*") return true;
  if (p.type === "*") return p.subtype === a.subtype;
  if (p.subtype === "*") return p.type === a.type;
  return p.type === a.type && p.subtype === a.subtype;
}

/**
 * Normalize a short type name to a MIME type for matching purposes.
 *
 * "json" → "application/json"
 * "html" → "text/html"
 * "text" → "text/plain"
 * "application/json" → "application/json" (passthrough)
 */
const SHORT_TYPES: Record<string, string> = {
  json: "application/json",
  html: "text/html",
  text: "text/plain",
  xml: "application/xml",
  urlencoded: "application/x-www-form-urlencoded",
  multipart: "multipart/form-data",
  bin: "application/octet-stream",
  css: "text/css",
  js: "application/javascript",
  javascript: "application/javascript",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  pdf: "application/pdf",
};

export function normalizeType(type: string): string {
  if (type.includes("/")) return type;
  return SHORT_TYPES[type.toLowerCase()] ?? `application/${type}`;
}

/**
 * Extract the base MIME type from a Content-Type header value.
 *
 * "application/json; charset=utf-8" → "application/json"
 */
export function extractMimeType(contentType: string): string {
  const semiIdx = contentType.indexOf(";");
  return (semiIdx === -1 ? contentType : contentType.slice(0, semiIdx)).trim().toLowerCase();
}

/**
 * Best-match content negotiation for Accept header.
 *
 * Given a list of types the server can produce, returns the best match
 * against the client's Accept header, or false if no match.
 *
 * accepts(acceptHeader, ["json", "html"]) → "json" | "html" | false
 */
export function negotiateAccept(acceptHeader: string | undefined, types: string[]): string | false {
  if (!types.length) return false;

  // No Accept header → prefer first type
  if (!acceptHeader) return types[0]!;

  const accepted = parseAcceptHeader(acceptHeader);
  if (!accepted.length) return types[0]!;

  // For each accepted type (sorted by quality), find the first match
  for (const entry of accepted) {
    if (entry.quality === 0) continue;

    for (const type of types) {
      const normalized = normalizeType(type);
      if (matchMimeType(normalized, entry.value) || entry.value === "*/*" || entry.value === "*") {
        return type;
      }
    }
  }

  return false;
}

/**
 * Best-match negotiation for simple header values (charset, encoding, language).
 *
 * negotiateSimple(header, candidates) → best match or false
 */
export function negotiateSimple(
  header: string | undefined,
  candidates: string[],
  matchFn?: (candidate: string, entry: string) => boolean
): string | false {
  if (!candidates.length) return false;
  if (!header) return candidates[0]!;

  const entries = parseAcceptHeader(header);
  if (!entries.length) return candidates[0]!;

  for (const entry of entries) {
    if (entry.quality === 0) continue;

    for (const candidate of candidates) {
      const cLower = candidate.toLowerCase();
      const eLower = entry.value.toLowerCase();

      if (eLower === "*") return candidate;
      if (cLower === eLower) return candidate;

      // Language range matching: "en" matches "en-US"
      if (matchFn && matchFn(cLower, eLower)) return candidate;
    }
  }

  return false;
}

/**
 * Language range matching (RFC 4647 basic filtering).
 * "en" matches "en", "en-US", "en-GB"
 * "en-US" matches "en-US" only
 */
export function languageMatch(candidate: string, entry: string): boolean {
  // "en" (candidate) should match "en-US" (entry) — entry starts with candidate prefix
  // "en-US" (candidate) should match "en-US" (entry) — exact match handled by negotiateSimple
  return candidate === entry || entry.startsWith(candidate + "-") || candidate.startsWith(entry + "-");
}

/**
 * Check if a Content-Type matches any of the given type patterns.
 * Implements type-is behavior.
 *
 * typeIs("application/json", ["json"]) → "json"
 * typeIs("text/html", ["html", "json"]) → "html"
 * typeIs("application/json", ["text/*"]) → false
 * typeIs(null, ["json"]) → false
 */
export function typeIs(contentType: string | undefined, types: string[]): string | false {
  if (!contentType) return false;

  const actual = extractMimeType(contentType);

  for (const type of types) {
    const normalized = normalizeType(type);

    // Check for MIME wildcard patterns
    if (normalized.includes("*")) {
      if (matchMimeType(actual, normalized)) return type;
    } else {
      // Exact or shorthand match
      if (actual === normalized) return type;
      // Also check if the subtype matches (e.g., "json" matches "application/json")
      if (!type.includes("/") && actual.endsWith("/" + type.toLowerCase())) return type;
    }
  }

  return false;
}
