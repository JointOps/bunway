import { describe, it, expect } from "bun:test";
import { BunRequest } from "../../../src/core/request";

function createRequest(url: string, headers?: Record<string, string>): BunRequest {
  return new BunRequest(new Request(url, { headers }));
}

describe("BunRequest Content Negotiation", () => {
  describe("accepts()", () => {
    it("returns first type when no Accept header", () => {
      const req = createRequest("http://localhost/");
      expect(req.accepts("json", "html")).toBe("json");
    });

    it("returns best match based on quality values", () => {
      const req = createRequest("http://localhost/", {
        Accept: "text/html;q=0.9, application/json;q=1.0",
      });
      expect(req.accepts("html", "json")).toBe("json");
    });

    it("returns false when no match", () => {
      const req = createRequest("http://localhost/", {
        Accept: "text/html",
      });
      expect(req.accepts("json")).toBe(false);
    });

    it("handles browser Accept header", () => {
      const req = createRequest("http://localhost/", {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      });
      expect(req.accepts("html", "json")).toBe("html");
    });

    it("handles wildcard Accept", () => {
      const req = createRequest("http://localhost/", { Accept: "*/*" });
      expect(req.accepts("json")).toBe("json");
    });

    it("returns first type with empty Accept header", () => {
      const req = createRequest("http://localhost/", { Accept: "" });
      expect(req.accepts("json", "html")).toBe("json");
    });
  });

  describe("acceptsCharsets()", () => {
    it("returns first charset when no header", () => {
      const req = createRequest("http://localhost/");
      expect(req.acceptsCharsets("utf-8", "ascii")).toBe("utf-8");
    });

    it("respects quality values", () => {
      const req = createRequest("http://localhost/", {
        "Accept-Charset": "iso-8859-1;q=0.5, utf-8;q=1.0",
      });
      expect(req.acceptsCharsets("iso-8859-1", "utf-8")).toBe("utf-8");
    });
  });

  describe("acceptsEncodings()", () => {
    it("returns best encoding match", () => {
      const req = createRequest("http://localhost/", {
        "Accept-Encoding": "gzip, deflate;q=0.5",
      });
      expect(req.acceptsEncodings("deflate", "gzip")).toBe("gzip");
    });
  });

  describe("acceptsLanguages()", () => {
    it("returns best language match", () => {
      const req = createRequest("http://localhost/", {
        "Accept-Language": "en-US;q=0.9, fr;q=1.0",
      });
      expect(req.acceptsLanguages("en", "fr")).toBe("fr");
    });

    it("matches language ranges (en matches en-US header)", () => {
      const req = createRequest("http://localhost/", {
        "Accept-Language": "en-US, fr;q=0.5",
      });
      // "en" should match "en-US" via language range
      expect(req.acceptsLanguages("en", "fr")).toBe("en");
    });

    it("handles malformed language tags gracefully", () => {
      const req = createRequest("http://localhost/", {
        "Accept-Language": "en-US;q=abc, fr;q=0.5",
      });
      // Malformed q=abc should be treated as 0, so fr should win
      expect(req.acceptsLanguages("en", "fr")).toBe("fr");
    });
  });

  describe("is()", () => {
    it("matches short type name", () => {
      const req = createRequest("http://localhost/", {
        "Content-Type": "application/json",
      });
      expect(req.is("json")).toBe("json");
    });

    it("matches MIME wildcard", () => {
      const req = createRequest("http://localhost/", {
        "Content-Type": "text/html",
      });
      expect(req.is("text/*")).toBe("text/*");
    });

    it("returns false for no Content-Type", () => {
      const req = createRequest("http://localhost/");
      expect(req.is("json")).toBe(false);
    });

    it("strips Content-Type params before matching", () => {
      const req = createRequest("http://localhost/", {
        "Content-Type": "application/json; charset=utf-8",
      });
      expect(req.is("json")).toBe("json");
    });

    it("handles full MIME type", () => {
      const req = createRequest("http://localhost/", {
        "Content-Type": "application/json",
      });
      expect(req.is("application/json")).toBe("application/json");
    });

    it("handles multipart check", () => {
      const req = createRequest("http://localhost/", {
        "Content-Type": "multipart/form-data; boundary=----abc",
      });
      expect(req.is("multipart")).toBe("multipart");
    });
  });

  describe("param()", () => {
    it("checks params first", () => {
      const req = createRequest("http://localhost/?name=query");
      req.params = { name: "param" };
      expect(req.param("name")).toBe("param");
    });

    it("checks body second", () => {
      const req = createRequest("http://localhost/");
      req.body = { name: "body" };
      expect(req.param("name")).toBe("body");
    });

    it("checks query third", () => {
      const req = createRequest("http://localhost/?name=query");
      expect(req.param("name")).toBe("query");
    });

    it("returns undefined when not found anywhere", () => {
      const req = createRequest("http://localhost/");
      expect(req.param("missing")).toBeUndefined();
    });

    it("prefers params over body over query", () => {
      const req = createRequest("http://localhost/?x=query");
      req.body = { x: "body" };
      req.params = { x: "param" };
      expect(req.param("x")).toBe("param");
    });

    it("falls through to query when body is empty object", () => {
      const req = createRequest("http://localhost/?name=query");
      req.body = {};
      expect(req.param("name")).toBe("query");
    });

    it("falls through to query when body is undefined", () => {
      const req = createRequest("http://localhost/?name=query");
      req.body = undefined;
      expect(req.param("name")).toBe("query");
    });
  });
});
