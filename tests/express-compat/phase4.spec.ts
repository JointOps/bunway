import { describe, it, expect } from "bun:test";
import bunway from "../../src";
import { json } from "../../src/middleware/body-parser";

describe("Express Compatibility: Phase 4 — Express Parity", () => {
  it("req.accepts() quality-value negotiation matches Express", async () => {
    const app = bunway();
    app.get("/", (req, res) => {
      res.json({ type: req.accepts("json", "html") });
    });

    // Prefer JSON via quality value
    const response = await app.handle(
      new Request("http://localhost/", {
        headers: { Accept: "text/html;q=0.5, application/json" },
      })
    );
    const body = await response.json();
    expect(body.type).toBe("json");
  });

  it("req.is() MIME type matching works like type-is", async () => {
    const app = bunway();
    app.post("/", (req, res) => {
      res.json({
        json: req.is("json"),
        textWild: req.is("text/*"),
      });
    });

    const response = await app.handle(
      new Request("http://localhost/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
    );
    const body = await response.json();
    expect(body.json).toBe("json");
    expect(body.textWild).toBe(false);
  });

  it("res.send() auto-detects Content-Type like Express", async () => {
    const app = bunway();
    app.get("/string", (req, res) => res.send("Hello"));
    app.get("/object", (req, res) => res.send({ ok: true }));

    const r1 = await app.handle(new Request("http://localhost/string"));
    expect(r1.headers.get("content-type")).toBe("text/html; charset=utf-8");

    const r2 = await app.handle(new Request("http://localhost/object"));
    expect(r2.headers.get("content-type")).toBe("application/json");
  });

  it("regex routes work like Express", async () => {
    const app = bunway();
    app.get(/fly$/, (req, res) => res.json({ flying: true }));

    const r1 = await app.handle(new Request("http://localhost/butterfly"));
    expect(r1.status).toBe(200);

    const r2 = await app.handle(new Request("http://localhost/flying"));
    expect(r2.status).toBe(404);
  });

  it("app.all('*') catch-all works like Express", async () => {
    const app = bunway();
    app.get("/health", (req, res) => res.json({ status: "ok" }));
    app.all("*", (req, res) => res.status(404).json({ error: "Not Found" }));

    const r1 = await app.handle(new Request("http://localhost/health"));
    expect(r1.status).toBe(200);

    const r2 = await app.handle(new Request("http://localhost/unknown"));
    expect(r2.status).toBe(404);
  });

  it("req.param() checks body like Express (deprecated but expected)", async () => {
    const app = bunway();
    app.use(json());
    app.post("/api", (req, res) => {
      res.json({ name: req.param("name") });
    });

    const response = await app.handle(
      new Request("http://localhost/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "from-body" }),
      })
    );
    const body = await response.json();
    expect(body.name).toBe("from-body");
  });

  it("app.mountpath is set on sub-app mount", async () => {
    const app = bunway();
    const admin = bunway();
    admin.get("/info", (req, res) => {
      res.json({ mountpath: admin.mountpath });
    });
    app.use("/admin", admin);

    const response = await app.handle(new Request("http://localhost/admin/info"));
    const body = await response.json();
    expect(body.mountpath).toBe("/admin");
  });
});
