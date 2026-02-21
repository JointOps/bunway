import { describe, expect, it } from "bun:test";
import { getMimeType, getBaseMimeType, MIME_TYPES } from "../../../src/utils/mime";

describe("MIME Utils (Unit)", () => {
  describe("MIME_TYPES", () => {
    it("should map .html to text/html with charset", () => {
      expect(MIME_TYPES[".html"]).toBe("text/html; charset=utf-8");
    });

    it("should map .json to application/json with charset", () => {
      expect(MIME_TYPES[".json"]).toBe("application/json; charset=utf-8");
    });

    it("should map .png to image/png", () => {
      expect(MIME_TYPES[".png"]).toBe("image/png");
    });

    it("should map .js to application/javascript with charset", () => {
      expect(MIME_TYPES[".js"]).toBe("application/javascript; charset=utf-8");
    });
  });

  describe("getMimeType()", () => {
    it("should return correct type for known extensions", () => {
      expect(getMimeType("style.css")).toBe("text/css; charset=utf-8");
    });

    it("should return application/octet-stream for unknown extensions", () => {
      expect(getMimeType("file.xyz")).toBe("application/octet-stream");
    });

    it("should handle full paths", () => {
      expect(getMimeType("/path/to/file.html")).toBe("text/html; charset=utf-8");
    });

    it("should be case insensitive", () => {
      expect(getMimeType("file.HTML")).toBe("text/html; charset=utf-8");
    });

    it("should return image/jpeg for .jpg", () => {
      expect(getMimeType("photo.jpg")).toBe("image/jpeg");
    });

    it("should return image/jpeg for .jpeg", () => {
      expect(getMimeType("photo.jpeg")).toBe("image/jpeg");
    });
  });

  describe("getBaseMimeType()", () => {
    it("should return type without charset for text types", () => {
      expect(getBaseMimeType("index.html")).toBe("text/html");
    });

    it("should return type as-is for non-text types without charset", () => {
      expect(getBaseMimeType("image.png")).toBe("image/png");
    });

    it("should strip charset from application/json", () => {
      expect(getBaseMimeType("data.json")).toBe("application/json");
    });

    it("should return application/octet-stream for unknown", () => {
      expect(getBaseMimeType("file.unknown")).toBe("application/octet-stream");
    });
  });
});
