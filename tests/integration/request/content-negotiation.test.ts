import { describe, expect, it } from "bun:test";
import bunway, { Router } from "../../../src";

describe("Content Negotiation", () => {
  describe("req.acceptsCharsets()", () => {
    it("returns first charset if accept-charset header is missing", async () => {
      const router = new Router();
      router.get("/", (req, res) => {
        res.json({ charset: req.acceptsCharsets("utf-8", "iso-8859-1") });
      });

      const response = await router.handle(new Request("http://localhost/"));
      const data = await response.json();
      expect(data.charset).toBe("utf-8");
    });

    it("returns matching charset", async () => {
      const router = new Router();
      router.get("/", (req, res) => {
        res.json({ charset: req.acceptsCharsets("utf-8", "iso-8859-1") });
      });

      const response = await router.handle(
        new Request("http://localhost/", {
          headers: { "Accept-Charset": "iso-8859-1" },
        })
      );
      const data = await response.json();
      expect(data.charset).toBe("iso-8859-1");
    });

    it("returns false when no charset matches", async () => {
      const router = new Router();
      router.get("/", (req, res) => {
        res.json({ charset: req.acceptsCharsets("utf-8") });
      });

      const response = await router.handle(
        new Request("http://localhost/", {
          headers: { "Accept-Charset": "iso-8859-1" },
        })
      );
      const data = await response.json();
      expect(data.charset).toBe(false);
    });
  });

  describe("req.acceptsEncodings()", () => {
    it("returns first encoding if accept-encoding header is missing", async () => {
      const router = new Router();
      router.get("/", (req, res) => {
        res.json({ encoding: req.acceptsEncodings("gzip", "deflate") });
      });

      const response = await router.handle(new Request("http://localhost/"));
      const data = await response.json();
      expect(data.encoding).toBe("gzip");
    });

    it("returns matching encoding", async () => {
      const router = new Router();
      router.get("/", (req, res) => {
        res.json({ encoding: req.acceptsEncodings("gzip", "deflate", "br") });
      });

      const response = await router.handle(
        new Request("http://localhost/", {
          headers: { "Accept-Encoding": "br, gzip" },
        })
      );
      const data = await response.json();
      expect(data.encoding).toBe("gzip");
    });
  });

  describe("req.acceptsLanguages()", () => {
    it("returns first language if accept-language header is missing", async () => {
      const router = new Router();
      router.get("/", (req, res) => {
        res.json({ language: req.acceptsLanguages("en", "es") });
      });

      const response = await router.handle(new Request("http://localhost/"));
      const data = await response.json();
      expect(data.language).toBe("en");
    });

    it("returns matching language", async () => {
      const router = new Router();
      router.get("/", (req, res) => {
        res.json({ language: req.acceptsLanguages("en", "es", "fr") });
      });

      const response = await router.handle(
        new Request("http://localhost/", {
          headers: { "Accept-Language": "es-MX, es" },
        })
      );
      const data = await response.json();
      expect(data.language).toBe("es");
    });
  });

  describe("res.format()", () => {
    it("responds with JSON when client accepts application/json", async () => {
      const app = bunway();
      app.get("/", (_req, res) => {
        res.format({
          json: () => res.json({ message: "JSON response" }),
          html: () => res.html("<p>HTML response</p>"),
        });
      });

      const response = await app.handle(
        new Request("http://localhost/", {
          headers: { Accept: "application/json" },
        })
      );

      expect(response.headers.get("Content-Type")).toBe("application/json");
      const data = await response.json();
      expect(data.message).toBe("JSON response");
    });

    it("responds with HTML when client accepts text/html", async () => {
      const app = bunway();
      app.get("/", (_req, res) => {
        res.format({
          json: () => res.json({ message: "JSON response" }),
          html: () => res.html("<p>HTML response</p>"),
        });
      });

      const response = await app.handle(
        new Request("http://localhost/", {
          headers: { Accept: "text/html" },
        })
      );

      expect(response.headers.get("Content-Type")).toBe("text/html");
      const body = await response.text();
      expect(body).toBe("<p>HTML response</p>");
    });

    it("uses default handler when no type matches", async () => {
      const app = bunway();
      app.get("/", (_req, res) => {
        res.format({
          json: () => res.json({ message: "JSON" }),
          default: () => res.text("Default response"),
        });
      });

      const response = await app.handle(
        new Request("http://localhost/", {
          headers: { Accept: "text/xml" },
        })
      );

      const body = await response.text();
      expect(body).toBe("Default response");
    });

    it("returns 406 when no handler matches and no default", async () => {
      const app = bunway();
      app.get("/", (_req, res) => {
        res.format({
          json: () => res.json({ message: "JSON" }),
        });
      });

      const response = await app.handle(
        new Request("http://localhost/", {
          headers: { Accept: "text/xml" },
        })
      );

      expect(response.status).toBe(406);
    });

    it("handles */* accept header", async () => {
      const app = bunway();
      app.get("/", (_req, res) => {
        res.format({
          json: () => res.json({ first: true }),
          html: () => res.html("<p>second</p>"),
        });
      });

      const response = await app.handle(
        new Request("http://localhost/", {
          headers: { Accept: "*/*" },
        })
      );

      // Should use first handler
      expect(response.status).toBe(200);
    });

    it("handles full MIME type keys", async () => {
      const app = bunway();
      app.get("/", (_req, res) => {
        res.format({
          "application/json": () => res.json({ type: "json" }),
          "text/html": () => res.html("<p>html</p>"),
        });
      });

      const response = await app.handle(
        new Request("http://localhost/", {
          headers: { Accept: "application/json" },
        })
      );

      const data = await response.json();
      expect(data.type).toBe("json");
    });
  });
});
