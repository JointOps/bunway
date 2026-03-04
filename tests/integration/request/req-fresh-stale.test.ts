import { describe, it, expect } from "bun:test";
import bunway from "../../../src";

describe("Integration: req.fresh / req.stale", () => {
  it("returns 304 when ETag matches and handler checks req.fresh", async () => {
    const app = bunway();
    app.get("/data", (req, res) => {
      res.set("ETag", '"v1"');
      if (req.fresh) {
        res.status(304).end();
        return;
      }
      res.json({ data: "hello" });
    });

    const response = await app.handle(
      new Request("http://localhost/data", {
        headers: { "if-none-match": '"v1"' },
      })
    );
    expect(response.status).toBe(304);
  });

  it("returns 200 when ETag does not match", async () => {
    const app = bunway();
    app.get("/data", (req, res) => {
      res.set("ETag", '"v2"');
      if (req.fresh) {
        res.status(304).end();
        return;
      }
      res.json({ data: "hello" });
    });

    const response = await app.handle(
      new Request("http://localhost/data", {
        headers: { "if-none-match": '"v1"' },
      })
    );
    expect(response.status).toBe(200);
  });

  it("returns 200 for POST even with matching ETag", async () => {
    const app = bunway();
    app.post("/data", (req, res) => {
      res.set("ETag", '"v1"');
      if (req.fresh) {
        res.status(304).end();
        return;
      }
      res.json({ saved: true });
    });

    const response = await app.handle(
      new Request("http://localhost/data", {
        method: "POST",
        headers: { "if-none-match": '"v1"' },
      })
    );
    expect(response.status).toBe(200);
  });

  it("req.stale is true when content has changed", async () => {
    const app = bunway();
    let staleValue = false;
    app.get("/check", (req, res) => {
      res.set("ETag", '"v2"');
      staleValue = req.stale;
      res.json({ stale: staleValue });
    });

    await app.handle(
      new Request("http://localhost/check", {
        headers: { "if-none-match": '"v1"' },
      })
    );
    expect(staleValue).toBe(true);
  });

  it("handles Last-Modified based freshness", async () => {
    const app = bunway();
    const serverDate = new Date("2026-01-15T00:00:00Z");
    app.get("/data", (req, res) => {
      res.set("Last-Modified", serverDate.toUTCString());
      if (req.fresh) {
        res.status(304).end();
        return;
      }
      res.json({ data: "hello" });
    });

    const response = await app.handle(
      new Request("http://localhost/data", {
        headers: { "if-modified-since": new Date("2026-02-01T00:00:00Z").toUTCString() },
      })
    );
    expect(response.status).toBe(304);
  });

  it("cross-references work through middleware pipeline", async () => {
    const app = bunway();
    let hasRes = false;
    let hasReq = false;
    app.use((req, res, next) => {
      hasRes = req.res !== undefined;
      hasReq = res.req !== undefined;
      next();
    });
    app.get("/test", (req, res) => res.json({ ok: true }));
    await app.handle(new Request("http://localhost/test"));
    expect(hasRes).toBe(true);
    expect(hasReq).toBe(true);
  });
});
