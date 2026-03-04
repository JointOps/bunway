import { describe, it, expect } from "bun:test";
import bunway from "../../src";

describe("Express Compatibility: Phase 2", () => {
  it("req.fresh works like Express (ETag match → fresh)", async () => {
    const app = bunway();
    app.get("/resource", (req, res) => {
      res.set("ETag", '"abc123"');
      if (req.fresh) {
        res.status(304).end();
        return;
      }
      res.json({ data: "value" });
    });

    const response = await app.handle(
      new Request("http://localhost/resource", {
        headers: { "If-None-Match": '"abc123"' },
      })
    );
    expect(response.status).toBe(304);
  });

  it("req.range() parses Range header like Express", async () => {
    const app = bunway();
    let result: unknown;
    app.get("/video", (req, res) => {
      result = req.range(10000);
      res.json({ ok: true });
    });

    await app.handle(
      new Request("http://localhost/video", {
        headers: { Range: "bytes=0-999" },
      })
    );
    expect(Array.isArray(result)).toBe(true);
    if (Array.isArray(result)) {
      expect(result[0]).toEqual({ start: 0, end: 999 });
    }
  });

  it("req.res / res.req cross-references work like Express", async () => {
    const app = bunway();
    let reqHasRes = false;
    let resHasReq = false;
    let resHasApp = false;
    app.get("/test", (req, res) => {
      reqHasRes = req.res === res;
      resHasReq = res.req === req;
      resHasApp = res.app !== undefined;
      res.json({ ok: true });
    });

    await app.handle(new Request("http://localhost/test"));
    expect(reqHasRes).toBe(true);
    expect(resHasReq).toBe(true);
    expect(resHasApp).toBe(true);
  });

  it("app.use([path1, path2], handler) works like Express", async () => {
    const app = bunway();
    const hits: string[] = [];
    app.use(["/api", "/rest"], (req, res, next) => {
      hits.push(req.path);
      next();
    });
    app.get("/api", (req, res) => res.json({}));
    app.get("/rest", (req, res) => res.json({}));

    await app.handle(new Request("http://localhost/api"));
    await app.handle(new Request("http://localhost/rest"));
    expect(hits.length).toBe(2);
  });

  it("res.jsonp() works like Express", async () => {
    const app = bunway();
    app.get("/api/data", (req, res) => res.jsonp({ name: "bunway" }));

    // With callback
    const r1 = await app.handle(
      new Request("http://localhost/api/data?callback=myFunc")
    );
    expect(r1.headers.get("Content-Type")).toBe("text/javascript; charset=utf-8");
    const body = await r1.text();
    expect(body).toContain("myFunc");

    // Without callback — falls back to JSON
    const r2 = await app.handle(
      new Request("http://localhost/api/data")
    );
    expect(r2.headers.get("Content-Type")).toBe("application/json");
  });

  it("res.jsonp() respects 'jsonp callback name' setting like Express", async () => {
    const app = bunway();
    app.set("jsonp callback name", "cb");
    app.get("/api", (req, res) => res.jsonp({ ok: true }));

    const response = await app.handle(
      new Request("http://localhost/api?cb=handler")
    );
    expect(response.headers.get("Content-Type")).toBe("text/javascript; charset=utf-8");
  });
});
