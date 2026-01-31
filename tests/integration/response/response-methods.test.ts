import { describe, expect, it } from "bun:test";
import { Router } from "../../../src";

describe("Response Methods", () => {
  describe("res.vary()", () => {
    it("sets Vary header with single field", async () => {
      const router = new Router();
      router.get("/", (_req, res) => {
        res.vary("Accept");
        res.json({ ok: true });
      });

      const response = await router.handle(new Request("http://localhost/"));
      expect(response.headers.get("Vary")).toBe("Accept");
    });

    it("sets Vary header with multiple fields", async () => {
      const router = new Router();
      router.get("/", (_req, res) => {
        res.vary(["Accept", "Accept-Language", "Accept-Encoding"]);
        res.json({ ok: true });
      });

      const response = await router.handle(new Request("http://localhost/"));
      expect(response.headers.get("Vary")).toBe("Accept, Accept-Language, Accept-Encoding");
    });

    it("appends to existing Vary header", async () => {
      const router = new Router();
      router.get("/", (_req, res) => {
        res.vary("Accept");
        res.vary("Accept-Language");
        res.json({ ok: true });
      });

      const response = await router.handle(new Request("http://localhost/"));
      expect(response.headers.get("Vary")).toBe("Accept, Accept-Language");
    });

    it("does not duplicate fields", async () => {
      const router = new Router();
      router.get("/", (_req, res) => {
        res.vary("Accept");
        res.vary("accept"); // same field, different case
        res.json({ ok: true });
      });

      const response = await router.handle(new Request("http://localhost/"));
      expect(response.headers.get("Vary")).toBe("Accept");
    });
  });

  describe("res.location()", () => {
    it("sets Location header", async () => {
      const router = new Router();
      router.get("/", (_req, res) => {
        res.location("/new-location");
        res.status(201).json({ created: true });
      });

      const response = await router.handle(new Request("http://localhost/"));
      expect(response.headers.get("Location")).toBe("/new-location");
    });

    it("sets absolute URL", async () => {
      const router = new Router();
      router.get("/", (_req, res) => {
        res.location("https://example.com/resource");
        res.json({ ok: true });
      });

      const response = await router.handle(new Request("http://localhost/"));
      expect(response.headers.get("Location")).toBe("https://example.com/resource");
    });
  });

  describe("res.links()", () => {
    it("sets Link header with single link", async () => {
      const router = new Router();
      router.get("/", (_req, res) => {
        res.links({ next: "/page/2" });
        res.json({ ok: true });
      });

      const response = await router.handle(new Request("http://localhost/"));
      expect(response.headers.get("Link")).toBe('</page/2>; rel="next"');
    });

    it("sets Link header with multiple links", async () => {
      const router = new Router();
      router.get("/", (_req, res) => {
        res.links({
          next: "/page/2",
          prev: "/page/0",
          last: "/page/10",
        });
        res.json({ ok: true });
      });

      const response = await router.handle(new Request("http://localhost/"));
      const link = response.headers.get("Link");
      expect(link).toContain('</page/2>; rel="next"');
      expect(link).toContain('</page/0>; rel="prev"');
      expect(link).toContain('</page/10>; rel="last"');
    });
  });

  describe("res.contentType()", () => {
    it("sets Content-Type header", async () => {
      const router = new Router();
      router.get("/", (_req, res) => {
        res.contentType("text/xml");
        res.send("<xml></xml>");
      });

      const response = await router.handle(new Request("http://localhost/"));
      expect(response.headers.get("Content-Type")).toBe("text/xml");
    });

    it("is alias for res.type()", async () => {
      const router = new Router();
      router.get("/", (_req, res) => {
        res.contentType("application/pdf");
        res.send("pdf content");
      });

      const response = await router.handle(new Request("http://localhost/"));
      expect(response.headers.get("Content-Type")).toBe("application/pdf");
    });
  });

  describe("res.attachment()", () => {
    it("sets Content-Disposition to attachment", async () => {
      const router = new Router();
      router.get("/", (_req, res) => {
        res.attachment();
        res.send("file content");
      });

      const response = await router.handle(new Request("http://localhost/"));
      expect(response.headers.get("Content-Disposition")).toBe("attachment");
    });

    it("sets Content-Disposition with filename", async () => {
      const router = new Router();
      router.get("/", (_req, res) => {
        res.attachment("report.pdf");
        res.send("file content");
      });

      const response = await router.handle(new Request("http://localhost/"));
      expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="report.pdf"');
    });
  });
});
