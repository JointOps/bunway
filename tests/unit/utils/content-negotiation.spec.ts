import { describe, it, expect } from "bun:test";
import {
  parseAcceptHeader,
  parseMediaType,
  matchMimeType,
  normalizeType,
  extractMimeType,
  negotiateAccept,
  negotiateSimple,
  languageMatch,
  typeIs,
} from "../../../src/utils/content-negotiation";

describe("Content Negotiation Utils", () => {
  describe("parseAcceptHeader", () => {
    it("parses simple Accept header", () => {
      const result = parseAcceptHeader("text/html, application/json");
      expect(result).toHaveLength(2);
      expect(result[0].value).toBe("text/html");
      expect(result[0].quality).toBe(1.0);
    });

    it("parses quality values", () => {
      const result = parseAcceptHeader("text/html;q=0.9, application/json;q=1.0");
      expect(result[0].value).toBe("application/json");
      expect(result[0].quality).toBe(1.0);
      expect(result[1].value).toBe("text/html");
      expect(result[1].quality).toBe(0.9);
    });

    it("handles q=0 as not acceptable", () => {
      const result = parseAcceptHeader("text/html;q=0, application/json");
      expect(result[0].value).toBe("application/json");
      expect(result[1].quality).toBe(0);
    });

    it("handles empty header", () => {
      expect(parseAcceptHeader("")).toEqual([]);
    });

    it("handles wildcard", () => {
      const result = parseAcceptHeader("*/*");
      expect(result[0].value).toBe("*/*");
    });

    it("parses extra parameters", () => {
      const result = parseAcceptHeader("text/html;level=1;q=0.7");
      expect(result[0].quality).toBe(0.7);
      expect(result[0].params.level).toBe("1");
    });

    it("sorts by quality descending", () => {
      const result = parseAcceptHeader("text/plain;q=0.5, text/html, application/json;q=0.9");
      expect(result[0].value).toBe("text/html");
      expect(result[1].value).toBe("application/json");
      expect(result[2].value).toBe("text/plain");
    });
  });

  describe("parseMediaType", () => {
    it("parses standard MIME type", () => {
      const result = parseMediaType("application/json");
      expect(result?.type).toBe("application");
      expect(result?.subtype).toBe("json");
    });

    it("parses wildcard subtype", () => {
      const result = parseMediaType("text/*");
      expect(result?.type).toBe("text");
      expect(result?.subtype).toBe("*");
    });

    it("returns null for invalid", () => {
      expect(parseMediaType("json")).toBeNull();
    });
  });

  describe("matchMimeType", () => {
    it("matches exact types", () => {
      expect(matchMimeType("text/html", "text/html")).toBe(true);
    });

    it("matches wildcard subtype", () => {
      expect(matchMimeType("text/html", "text/*")).toBe(true);
    });

    it("matches full wildcard", () => {
      expect(matchMimeType("application/json", "*/*")).toBe(true);
    });

    it("rejects non-matching types", () => {
      expect(matchMimeType("text/html", "application/json")).toBe(false);
    });

    it("rejects non-matching subtypes", () => {
      expect(matchMimeType("text/html", "text/plain")).toBe(false);
    });
  });

  describe("normalizeType", () => {
    it("converts short names to MIME types", () => {
      expect(normalizeType("json")).toBe("application/json");
      expect(normalizeType("html")).toBe("text/html");
      expect(normalizeType("text")).toBe("text/plain");
      expect(normalizeType("xml")).toBe("application/xml");
      expect(normalizeType("css")).toBe("text/css");
    });

    it("passes through full MIME types", () => {
      expect(normalizeType("application/json")).toBe("application/json");
      expect(normalizeType("text/html")).toBe("text/html");
    });

    it("defaults unknown types to application/*", () => {
      expect(normalizeType("custom")).toBe("application/custom");
    });
  });

  describe("extractMimeType", () => {
    it("strips parameters from Content-Type", () => {
      expect(extractMimeType("application/json; charset=utf-8")).toBe("application/json");
    });

    it("handles bare Content-Type", () => {
      expect(extractMimeType("text/html")).toBe("text/html");
    });
  });

  describe("negotiateAccept", () => {
    it("returns first type when no Accept header", () => {
      expect(negotiateAccept(undefined, ["json", "html"])).toBe("json");
    });

    it("returns best match based on quality", () => {
      expect(negotiateAccept("text/html;q=0.9, application/json;q=1.0", ["html", "json"])).toBe("json");
    });

    it("returns false when no match", () => {
      expect(negotiateAccept("text/html", ["json"])).toBe(false);
    });

    it("handles */* wildcard", () => {
      expect(negotiateAccept("*/*", ["json"])).toBe("json");
    });

    it("handles complex browser Accept header", () => {
      const browserAccept = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
      expect(negotiateAccept(browserAccept, ["html", "json"])).toBe("html");
    });

    it("respects q=0 exclusion", () => {
      expect(negotiateAccept("text/html;q=0, application/json", ["html", "json"])).toBe("json");
    });
  });

  describe("negotiateSimple", () => {
    it("returns first candidate when no header", () => {
      expect(negotiateSimple(undefined, ["utf-8", "ascii"])).toBe("utf-8");
    });

    it("returns best match", () => {
      expect(negotiateSimple("gzip, deflate;q=0.5", ["deflate", "gzip"])).toBe("gzip");
    });

    it("handles wildcard *", () => {
      expect(negotiateSimple("*", ["gzip"])).toBe("gzip");
    });

    it("returns false when no match", () => {
      expect(negotiateSimple("br", ["gzip", "deflate"])).toBe(false);
    });
  });

  describe("languageMatch", () => {
    it("matches exact language", () => {
      expect(languageMatch("en", "en")).toBe(true);
    });

    it("matches language range (en matches en-US)", () => {
      expect(languageMatch("en-us", "en")).toBe(true);
    });

    it("rejects non-matching languages", () => {
      expect(languageMatch("fr", "en")).toBe(false);
    });

    it("does not match partial prefixes", () => {
      expect(languageMatch("en-us", "en-u")).toBe(false);
    });
  });

  describe("typeIs", () => {
    it("matches short type name", () => {
      expect(typeIs("application/json", ["json"])).toBe("json");
    });

    it("matches full MIME type", () => {
      expect(typeIs("application/json", ["application/json"])).toBe("application/json");
    });

    it("matches wildcard pattern", () => {
      expect(typeIs("text/html", ["text/*"])).toBe("text/*");
    });

    it("returns false when no Content-Type", () => {
      expect(typeIs(undefined, ["json"])).toBe(false);
    });

    it("returns false when no match", () => {
      expect(typeIs("text/html", ["json"])).toBe(false);
    });

    it("strips Content-Type parameters before matching", () => {
      expect(typeIs("application/json; charset=utf-8", ["json"])).toBe("json");
    });

    it("handles multipart type check", () => {
      expect(typeIs("multipart/form-data; boundary=----", ["multipart"])).toBe("multipart");
    });

    it("handles urlencoded type check", () => {
      expect(typeIs("application/x-www-form-urlencoded", ["urlencoded"])).toBe("urlencoded");
    });
  });
});
