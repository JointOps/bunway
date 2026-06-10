import { createHmac, timingSafeEqual } from "crypto";

/**
 * Sign a value using HMAC-SHA256.
 * @param value - The value to sign
 * @param secret - The secret key
 * @returns The signed value in format "value.signature"
 */
export function sign(value: string, secret: string): string {
  const signature = createHmac("sha256", secret).update(value).digest("base64url");
  return `${value}.${signature}`;
}

/**
 * Verify and extract value from a signed string.
 * Uses timing-safe comparison to prevent timing attacks.
 * @param signedValue - The signed value in format "value.signature"
 * @param secrets - Array of secrets to try (for key rotation)
 * @returns The original value if signature is valid, false otherwise
 */
export function unsign(signedValue: string, secrets: string[]): string | false {
  const idx = signedValue.lastIndexOf(".");
  if (idx === -1) return false;

  const value = signedValue.slice(0, idx);
  const signature = signedValue.slice(idx + 1);

  for (const secret of secrets) {
    const expected = createHmac("sha256", secret).update(value).digest("base64url");
    try {
      if (timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
        return value;
      }
    } catch {
      continue;
    }
  }

  return false;
}

/**
 * Generate a cryptographically secure random token.
 * Default path uses base64url encoding (fastest). Custom charset uses direct string concat.
 * @param length - The length of the token
 * @param charset - Optional custom character set
 * @returns A random token string
 */
export function generateToken(length: number = 32, charset?: string): string {
  if (!charset) {
    // Fast path: base64url encodes 3 bytes → 4 chars; slice to exact length
    const bytes = new Uint8Array(Math.ceil(length * 3 / 4));
    crypto.getRandomValues(bytes);
    return Buffer.from(bytes).toString("base64url").slice(0, length);
  }
  // Custom charset: build string directly — faster than array+join for short strings
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += charset[array[i]! % charset.length];
  }
  return result;
}

/**
 * Generate a cryptographically secure session ID.
 * @returns A 48-character hex string
 */
export function generateSessionId(): string {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  return Buffer.from(array).toString("hex");
}

/**
 * Generate an ETag from file statistics.
 * @param size - File size in bytes
 * @param mtimeMs - File modification time in milliseconds
 * @returns A weak ETag string
 */
export function generateETag(size: number, mtimeMs: number): string {
  const mtime = Math.floor(mtimeMs).toString(16);
  const sizeHex = size.toString(16);
  return `W/"${sizeHex}-${mtime}"`;
}

/**
 * Generate a weak ETag from a response body string.
 */
export function generateBodyETag(body: string): string {
  const len = Buffer.byteLength(body, "utf8");
  const hash = Bun.hash(body);
  return `W/"${len.toString(16)}-${hash.toString(16)}"`;
}

/**
 * Sign a session ID with "s:" prefix for session cookies.
 * @param sessionId - The session ID to sign
 * @param secret - The secret key
 * @returns The signed value in format "s:sessionId.signature"
 */
export function signSessionId(sessionId: string, secret: string): string {
  const signed = sign(sessionId, secret);
  return `s:${signed}`;
}

/**
 * Verify and extract session ID from a signed session cookie.
 * @param signedValue - The signed value in format "s:sessionId.signature"
 * @param secret - The secret key
 * @returns The session ID if valid, false otherwise
 */
export function unsignSessionId(signedValue: string, secret: string): string | false {
  if (!signedValue.startsWith("s:")) return false;
  return unsign(signedValue.slice(2), [secret]);
}

/**
 * Compare two strings in constant time to prevent timing attacks.
 * @param a - First string
 * @param b - Second string
 * @returns true if strings are equal, false otherwise
 */
export function timingSafeCompare(a: string, b: string): boolean {
  // If lengths differ, we still need constant-time comparison
  // Use the longer length to avoid leaking length information
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  // If lengths differ, comparison will fail but we do it in constant time
  if (aBuffer.length !== bBuffer.length) {
    // Compare against self to maintain constant time, then return false
    timingSafeEqual(aBuffer, aBuffer);
    return false;
  }

  return timingSafeEqual(aBuffer, bBuffer);
}
