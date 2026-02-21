import { describe, expect, it } from "bun:test";
import { getPathname, getQueryString } from "../../../src/utils/url";

describe("URL Utils (Unit)", () => {
  describe("getPathname()", () => {
    it("should extract pathname from full URL", () => {
      expect(getPathname("http://localhost:3000/users")).toBe("/users");
    });

    it("should return / for root URL", () => {
      expect(getPathname("http://localhost:3000/")).toBe("/");
    });

    it("should return / for URL without path", () => {
      expect(getPathname("http://localhost")).toBe("/");
    });

    it("should strip query string", () => {
      expect(getPathname("http://localhost/path?key=value")).toBe("/path");
    });

    it("should strip hash", () => {
      expect(getPathname("http://localhost/path#section")).toBe("/path");
    });

    it("should handle query before hash", () => {
      expect(getPathname("http://localhost/path?q=1#top")).toBe("/path");
    });

    it("should handle hash before query", () => {
      expect(getPathname("http://localhost/path#top?q=1")).toBe("/path");
    });

    it("should handle URL without protocol", () => {
      expect(getPathname("/users/123")).toBe("/users/123");
    });

    it("should handle deeply nested paths", () => {
      expect(getPathname("http://example.com/a/b/c/d/e")).toBe("/a/b/c/d/e");
    });
  });

  describe("getQueryString()", () => {
    it("should return query without leading ?", () => {
      expect(getQueryString("http://localhost/path?key=value")).toBe("key=value");
    });

    it("should return empty string when no query exists", () => {
      expect(getQueryString("http://localhost/path")).toBe("");
    });

    it("should strip hash from query", () => {
      expect(getQueryString("http://localhost/path?key=value#section")).toBe("key=value");
    });

    it("should handle multiple params", () => {
      expect(getQueryString("http://localhost/?a=1&b=2&c=3")).toBe("a=1&b=2&c=3");
    });

    it("should return empty string for URL with only hash", () => {
      expect(getQueryString("http://localhost/path#section")).toBe("");
    });
  });
});
