import { describe, expect, it } from "bun:test";
import {
  sign,
  unsign,
  generateToken,
  generateSessionId,
  generateETag,
  signSessionId,
  unsignSessionId,
  timingSafeCompare,
} from "../../../src/utils/crypto";

describe("Crypto Utils (Unit)", () => {
  describe("sign()", () => {
    it("should return value.signature format", () => {
      const result = sign("hello", "secret");
      expect(result).toContain(".");
      expect(result.startsWith("hello.")).toBe(true);
    });

    it("should produce different signatures with different secrets", () => {
      const result1 = sign("hello", "secret1");
      const result2 = sign("hello", "secret2");
      expect(result1).not.toBe(result2);
    });

    it("should produce the same signature for same value and secret", () => {
      const result1 = sign("hello", "secret");
      const result2 = sign("hello", "secret");
      expect(result1).toBe(result2);
    });
  });

  describe("unsign()", () => {
    it("should return original value with correct secret", () => {
      const signed = sign("myvalue", "mysecret");
      const result = unsign(signed, ["mysecret"]);
      expect(result).toBe("myvalue");
    });

    it("should return false with wrong secret", () => {
      const signed = sign("myvalue", "mysecret");
      const result = unsign(signed, ["wrongsecret"]);
      expect(result).toBe(false);
    });

    it("should return false for malformed input without a dot", () => {
      const result = unsign("nodothere", ["secret"]);
      expect(result).toBe(false);
    });

    it("should support key rotation with array of secrets", () => {
      const signed = sign("data", "old-secret");
      const result = unsign(signed, ["new-secret", "old-secret"]);
      expect(result).toBe("data");
    });

    it("should return false for empty string", () => {
      const result = unsign("", ["secret"]);
      expect(result).toBe(false);
    });
  });

  describe("generateToken()", () => {
    it("should default to length 32", () => {
      const token = generateToken();
      expect(token.length).toBe(32);
    });

    it("should respect custom length", () => {
      const token = generateToken(64);
      expect(token.length).toBe(64);
    });

    it("should use only characters from custom charset", () => {
      const charset = "abc";
      const token = generateToken(100, charset);
      for (const ch of token) {
        expect(charset.includes(ch)).toBe(true);
      }
    });

    it("should return a string of the correct length", () => {
      const token = generateToken(16);
      expect(typeof token).toBe("string");
      expect(token.length).toBe(16);
    });

    it("should generate unique tokens", () => {
      const token1 = generateToken();
      const token2 = generateToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe("generateSessionId()", () => {
    it("should return a 48 character string", () => {
      const id = generateSessionId();
      expect(id.length).toBe(48);
    });

    it("should only contain hex characters", () => {
      const id = generateSessionId();
      expect(/^[0-9a-f]+$/.test(id)).toBe(true);
    });

    it("should produce different IDs on different calls", () => {
      const id1 = generateSessionId();
      const id2 = generateSessionId();
      expect(id1).not.toBe(id2);
    });
  });

  describe("generateETag()", () => {
    it("should return weak ETag format", () => {
      const etag = generateETag(1024, 1700000000000);
      expect(etag.startsWith('W/"')).toBe(true);
      expect(etag.endsWith('"')).toBe(true);
    });

    it("should use hex encoding for size and mtime", () => {
      const etag = generateETag(255, 16);
      expect(etag).toBe('W/"ff-10"');
    });
  });

  describe("signSessionId()", () => {
    it("should return s: prefixed signed value", () => {
      const result = signSessionId("abc123", "secret");
      expect(result.startsWith("s:")).toBe(true);
    });

    it("should contain the session ID in the result", () => {
      const result = signSessionId("abc123", "secret");
      expect(result.startsWith("s:abc123.")).toBe(true);
    });
  });

  describe("unsignSessionId()", () => {
    it("should return session ID from valid signed value", () => {
      const signed = signSessionId("session-xyz", "secret");
      const result = unsignSessionId(signed, "secret");
      expect(result).toBe("session-xyz");
    });

    it("should return false for invalid signature", () => {
      const signed = signSessionId("session-xyz", "secret");
      const result = unsignSessionId(signed, "wrong-secret");
      expect(result).toBe(false);
    });

    it("should return false if not starting with s:", () => {
      const result = unsignSessionId("nosprefix.signature", "secret");
      expect(result).toBe(false);
    });
  });

  describe("timingSafeCompare()", () => {
    it("should return true for equal strings", () => {
      expect(timingSafeCompare("hello", "hello")).toBe(true);
    });

    it("should return false for different strings", () => {
      expect(timingSafeCompare("hello", "world")).toBe(false);
    });

    it("should return false for different length strings", () => {
      expect(timingSafeCompare("short", "much longer string")).toBe(false);
    });

    it("should handle empty strings", () => {
      expect(timingSafeCompare("", "")).toBe(true);
    });
  });
});
