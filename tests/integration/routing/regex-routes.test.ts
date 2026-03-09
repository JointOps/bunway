import { describe, it, expect } from "bun:test";
import bunway from "../../../src";

describe("Integration: Regex Routes", () => {
  it("handles regex route in full pipeline", async () => {
    const app = bunway();
    app.get(/\/api\/v(\d+)\/users/, (req, res) => {
      res.json({ matched: true });
    });

    const r1 = await app.handle(new Request("http://localhost/api/v2/users"));
    expect(r1.status).toBe(200);

    const r2 = await app.handle(new Request("http://localhost/api/users"));
    expect(r2.status).toBe(404);
  });

  it("regex routes work alongside string routes", async () => {
    const app = bunway();
    app.get("/exact", (req, res) => res.json({ type: "exact" }));
    app.get(/\/pattern\/\w+/, (req, res) => res.json({ type: "regex" }));

    const r1 = await app.handle(new Request("http://localhost/exact"));
    expect((await r1.json()).type).toBe("exact");

    const r2 = await app.handle(new Request("http://localhost/pattern/test"));
    expect((await r2.json()).type).toBe("regex");
  });

  it("catch-all * works end-to-end", async () => {
    const app = bunway();
    app.get("/specific", (req, res) => res.json({ route: "specific" }));
    app.all("*", (req, res) => res.status(404).json({ route: "catch-all" }));

    const r1 = await app.handle(new Request("http://localhost/specific"));
    expect((await r1.json()).route).toBe("specific");

    const r2 = await app.handle(new Request("http://localhost/anything-else"));
    expect(r2.status).toBe(404);
    expect((await r2.json()).route).toBe("catch-all");
  });
});
