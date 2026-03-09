import { describe, it, expect } from "bun:test";
import bunway from "../../../src";

describe("Regex Route Support", () => {
  it("matches regex route pattern", async () => {
    const app = bunway();
    app.get(/fly$/, (req, res) => {
      res.json({ matched: true });
    });

    const r1 = await app.handle(new Request("http://localhost/fly"));
    expect(r1.status).toBe(200);

    // /butterfly ends with "fly" so it matches
    const r2 = await app.handle(new Request("http://localhost/butterfly"));
    expect(r2.status).toBe(200);

    // /flying does NOT end with "fly" so it doesn't match
    const r3 = await app.handle(new Request("http://localhost/flying"));
    expect(r3.status).toBe(404);
  });

  it("captures named groups from regex", async () => {
    const app = bunway();
    app.get(/\/users\/(?<id>\d+)/, (req, res) => {
      res.json({ id: req.params.id });
    });

    const response = await app.handle(new Request("http://localhost/users/42"));
    const body = await response.json();
    expect(body.id).toBe("42");
  });

  it("returns 404 for non-matching regex", async () => {
    const app = bunway();
    app.get(/^\/api\/v\d+$/, (req, res) => {
      res.json({ matched: true });
    });

    const response = await app.handle(new Request("http://localhost/other"));
    expect(response.status).toBe(404);
  });

  it("supports regex with multiple HTTP methods", async () => {
    const app = bunway();
    app.all(/\/api\/.*/, (req, res) => {
      res.json({ method: req.method });
    });

    const r1 = await app.handle(new Request("http://localhost/api/test"));
    expect(r1.status).toBe(200);

    const r2 = await app.handle(new Request("http://localhost/api/test", { method: "POST" }));
    expect(r2.status).toBe(200);
  });
});

describe("app.all('*') catch-all", () => {
  it("matches all routes with bare *", async () => {
    const app = bunway();
    let matched = false;
    app.all("*", (req, res) => {
      matched = true;
      res.json({ path: req.path });
    });

    const r1 = await app.handle(new Request("http://localhost/anything"));
    expect(r1.status).toBe(200);

    const r2 = await app.handle(new Request("http://localhost/deep/nested/path"));
    expect(r2.status).toBe(200);
  });

  it("works with GET * as well", async () => {
    const app = bunway();
    app.get("*", (req, res) => {
      res.json({ caught: true });
    });

    const response = await app.handle(new Request("http://localhost/any/path"));
    expect(response.status).toBe(200);
  });

  it("* catch-all does not swallow earlier specific routes", async () => {
    const app = bunway();
    app.get("/health", (req, res) => res.json({ route: "health" }));
    app.post("/submit", (req, res) => res.json({ route: "submit" }));
    app.all("*", (req, res) => res.status(404).json({ route: "catch-all" }));

    const r1 = await app.handle(new Request("http://localhost/health"));
    expect(r1.status).toBe(200);
    expect((await r1.json()).route).toBe("health");

    const r2 = await app.handle(new Request("http://localhost/submit", { method: "POST" }));
    expect(r2.status).toBe(200);
    expect((await r2.json()).route).toBe("submit");

    const r3 = await app.handle(new Request("http://localhost/nope"));
    expect(r3.status).toBe(404);
    expect((await r3.json()).route).toBe("catch-all");
  });

  it("POST * catch-all only matches POST", async () => {
    const app = bunway();
    app.post("*", (req, res) => res.json({ caught: true }));

    const r1 = await app.handle(new Request("http://localhost/any", { method: "POST" }));
    expect(r1.status).toBe(200);

    // GET returns 405 Method Not Allowed (path matches but method doesn't)
    const r2 = await app.handle(new Request("http://localhost/any"));
    expect(r2.status).toBe(405);
  });
});

describe("Regex Route Edge Cases", () => {
  it("multiple named capture groups", async () => {
    const app = bunway();
    app.get(/\/(?<resource>\w+)\/(?<id>\d+)\/(?<action>\w+)/, (req, res) => {
      res.json({ resource: req.params.resource, id: req.params.id, action: req.params.action });
    });

    const response = await app.handle(new Request("http://localhost/users/99/edit"));
    const body = await response.json();
    expect(body.resource).toBe("users");
    expect(body.id).toBe("99");
    expect(body.action).toBe("edit");
  });

  it("regex with case-insensitive flag", async () => {
    const app = bunway();
    app.get(/\/hello/i, (req, res) => res.json({ ok: true }));

    const r1 = await app.handle(new Request("http://localhost/hello"));
    expect(r1.status).toBe(200);

    const r2 = await app.handle(new Request("http://localhost/HELLO"));
    expect(r2.status).toBe(200);

    const r3 = await app.handle(new Request("http://localhost/HeLLo"));
    expect(r3.status).toBe(200);
  });

  it("regex with start anchor only matches from beginning", async () => {
    const app = bunway();
    app.get(/^\/api/, (req, res) => res.json({ ok: true }));

    const r1 = await app.handle(new Request("http://localhost/api"));
    expect(r1.status).toBe(200);

    const r2 = await app.handle(new Request("http://localhost/api/users"));
    expect(r2.status).toBe(200);

    const r3 = await app.handle(new Request("http://localhost/v2/api"));
    expect(r3.status).toBe(404);
  });

  it("regex with both anchors for exact match", async () => {
    const app = bunway();
    app.get(/^\/exact$/, (req, res) => res.json({ ok: true }));

    const r1 = await app.handle(new Request("http://localhost/exact"));
    expect(r1.status).toBe(200);

    const r2 = await app.handle(new Request("http://localhost/exact/more"));
    expect(r2.status).toBe(404);

    const r3 = await app.handle(new Request("http://localhost/not-exact"));
    expect(r3.status).toBe(404);
  });

  it("regex route on POST verb only", async () => {
    const app = bunway();
    app.post(/\/submit/, (req, res) => res.json({ submitted: true }));

    const r1 = await app.handle(new Request("http://localhost/submit", { method: "POST" }));
    expect(r1.status).toBe(200);

    // GET returns 405 (path matches but method doesn't)
    const r2 = await app.handle(new Request("http://localhost/submit"));
    expect(r2.status).toBe(405);
  });

  it("regex route on PUT verb", async () => {
    const app = bunway();
    app.put(/\/items\/\d+/, (req, res) => res.json({ updated: true }));

    const r1 = await app.handle(new Request("http://localhost/items/5", { method: "PUT" }));
    expect(r1.status).toBe(200);

    // GET returns 405 (path matches but method doesn't)
    const r2 = await app.handle(new Request("http://localhost/items/5"));
    expect(r2.status).toBe(405);
  });

  it("regex route on DELETE verb", async () => {
    const app = bunway();
    app.delete(/\/items\/\d+/, (req, res) => res.json({ deleted: true }));

    const r1 = await app.handle(new Request("http://localhost/items/7", { method: "DELETE" }));
    expect(r1.status).toBe(200);

    // GET returns 405 (path matches but method doesn't)
    const r2 = await app.handle(new Request("http://localhost/items/7"));
    expect(r2.status).toBe(405);
  });

  it("regex route on PATCH verb", async () => {
    const app = bunway();
    app.patch(/\/items\/\d+/, (req, res) => res.json({ patched: true }));

    const r1 = await app.handle(new Request("http://localhost/items/3", { method: "PATCH" }));
    expect(r1.status).toBe(200);
  });

  it("multiple regex routes - first match wins", async () => {
    const app = bunway();
    app.get(/\/test/, (req, res) => res.json({ match: "first" }));
    app.get(/\/test\/.*/, (req, res) => res.json({ match: "second" }));

    // /test matches the first regex
    const r1 = await app.handle(new Request("http://localhost/test"));
    expect((await r1.json()).match).toBe("first");

    // /test/more also matches the first regex, so first wins
    const r2 = await app.handle(new Request("http://localhost/test/more"));
    expect((await r2.json()).match).toBe("first");
  });

  it("regex route does not interfere with parameterized routes", async () => {
    const app = bunway();
    app.get("/users/:id", (req, res) => res.json({ type: "param", id: req.params.id }));
    app.get(/\/admins\/(?<id>\d+)/, (req, res) => res.json({ type: "regex", id: req.params.id }));

    const r1 = await app.handle(new Request("http://localhost/users/10"));
    const b1 = await r1.json();
    expect(b1.type).toBe("param");
    expect(b1.id).toBe("10");

    const r2 = await app.handle(new Request("http://localhost/admins/20"));
    const b2 = await r2.json();
    expect(b2.type).toBe("regex");
    expect(b2.id).toBe("20");
  });

  it("static route takes priority over regex route", async () => {
    const app = bunway();
    app.get("/status", (req, res) => res.json({ type: "static" }));
    app.get(/\/status/, (req, res) => res.json({ type: "regex" }));

    const response = await app.handle(new Request("http://localhost/status"));
    expect((await response.json()).type).toBe("static");
  });

  it("parameterized route takes priority over regex route", async () => {
    const app = bunway();
    app.get("/items/:id", (req, res) => res.json({ type: "param" }));
    app.get(/\/items\/\d+/, (req, res) => res.json({ type: "regex" }));

    const response = await app.handle(new Request("http://localhost/items/5"));
    expect((await response.json()).type).toBe("param");
  });

  it("regex with alternation (|)", async () => {
    const app = bunway();
    app.get(/^\/(cats|dogs)$/, (req, res) => res.json({ ok: true }));

    const r1 = await app.handle(new Request("http://localhost/cats"));
    expect(r1.status).toBe(200);

    const r2 = await app.handle(new Request("http://localhost/dogs"));
    expect(r2.status).toBe(200);

    const r3 = await app.handle(new Request("http://localhost/birds"));
    expect(r3.status).toBe(404);
  });

  it("regex with optional segment (?)", async () => {
    const app = bunway();
    app.get(/^\/colou?r$/, (req, res) => res.json({ ok: true }));

    const r1 = await app.handle(new Request("http://localhost/color"));
    expect(r1.status).toBe(200);

    const r2 = await app.handle(new Request("http://localhost/colour"));
    expect(r2.status).toBe(200);

    const r3 = await app.handle(new Request("http://localhost/colouur"));
    expect(r3.status).toBe(404);
  });

  it("regex with repetition (+)", async () => {
    const app = bunway();
    app.get(/^\/ha(ha)+$/, (req, res) => res.json({ ok: true }));

    const r1 = await app.handle(new Request("http://localhost/haha"));
    expect(r1.status).toBe(200);

    const r2 = await app.handle(new Request("http://localhost/hahahaha"));
    expect(r2.status).toBe(200);

    // /ha alone should not match (needs at least one "ha" repetition)
    const r3 = await app.handle(new Request("http://localhost/ha"));
    expect(r3.status).toBe(404);
  });

  it("regex matching special URL characters (dots, hyphens)", async () => {
    const app = bunway();
    app.get(/\/files\/[\w.-]+\.json$/, (req, res) => res.json({ ok: true }));

    const r1 = await app.handle(new Request("http://localhost/files/config.json"));
    expect(r1.status).toBe(200);

    const r2 = await app.handle(new Request("http://localhost/files/my-data.v2.json"));
    expect(r2.status).toBe(200);

    const r3 = await app.handle(new Request("http://localhost/files/config.yaml"));
    expect(r3.status).toBe(404);
  });

  it("regex with no capturing groups returns empty params", async () => {
    const app = bunway();
    app.get(/\/health/, (req, res) => {
      res.json({ params: req.params });
    });

    const response = await app.handle(new Request("http://localhost/health"));
    const body = await response.json();
    expect(body.params).toEqual({});
  });

  it("all() with regex registers on every HTTP method", async () => {
    const app = bunway();
    app.all(/\/multi/, (req, res) => res.json({ method: req.method }));

    const methods = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"];
    for (const method of methods) {
      const r = await app.handle(new Request("http://localhost/multi", { method }));
      expect(r.status).toBe(200);
      if (method !== "HEAD") {
        const body = await r.json();
        expect(body.method).toBe(method);
      }
    }
  });
});
