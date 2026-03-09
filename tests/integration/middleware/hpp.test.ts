import { describe, it, expect } from "bun:test";
import bunway from "../../../src";
import { hpp } from "../../../src/middleware/hpp";
import { json } from "../../../src/middleware/body-parser";

describe("Integration: hpp middleware", () => {
  it("detects query parameter pollution end-to-end", async () => {
    const app = bunway();
    app.use(hpp());
    app.get("/search", (req, res) => {
      res.json({
        query: req.query.get("q"),
        polluted: req.locals.queryPolluted,
      });
    });

    const response = await app.handle(
      new Request("http://localhost/search?q=first&q=second")
    );
    const body = await response.json();
    expect(body.polluted).toBeDefined();
    expect(body.polluted.q).toEqual(["first", "second"]);
    // req.query.get() returns first value (URLSearchParams default)
    expect(body.query).toBe("first");
  });

  it("sanitizes body arrays with hpp middleware", async () => {
    const app = bunway();
    app.use(json());
    app.use(hpp());
    app.post("/submit", (req, res) => {
      res.json({
        body: req.body,
        polluted: req.locals.bodyPolluted,
      });
    });

    const response = await app.handle(
      new Request("http://localhost/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: ["user", "admin"], name: "Alice" }),
      })
    );
    const body = await response.json();
    expect(body.body.role).toBe("admin"); // last value
    expect(body.body.name).toBe("Alice"); // unchanged
    expect(body.polluted.role).toEqual(["user", "admin"]);
  });

  it("whitelist allows specific array params", async () => {
    const app = bunway();
    app.use(json());
    app.use(hpp({ whitelist: ["tags"] }));
    app.post("/submit", (req, res) => {
      res.json({ body: req.body });
    });

    const response = await app.handle(
      new Request("http://localhost/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tags: ["js", "bun"], role: ["user", "admin"] }),
      })
    );
    const body = await response.json();
    expect(body.body.tags).toEqual(["js", "bun"]); // whitelisted, kept as array
    expect(body.body.role).toBe("admin"); // sanitized
  });

  it("clean request passes through without modification", async () => {
    const app = bunway();
    app.use(hpp());
    app.get("/api", (req, res) => {
      res.json({
        name: req.query.get("name"),
        polluted: req.locals.queryPolluted,
      });
    });

    const response = await app.handle(
      new Request("http://localhost/api?name=Alice")
    );
    const body = await response.json();
    expect(body.name).toBe("Alice");
    expect(body.polluted).toBeUndefined();
  });

  it("handles request with no query string", async () => {
    const app = bunway();
    app.use(hpp());
    app.get("/api", (req, res) => res.json({ ok: true }));

    const response = await app.handle(new Request("http://localhost/api"));
    expect(response.status).toBe(200);
  });
});
