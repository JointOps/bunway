import { describe, it, expect } from "bun:test";
import bunway from "../../../src";
import { methodOverride } from "../../../src/middleware/method-override";
import { urlencoded } from "../../../src/middleware/body-parser";

describe("Integration: methodOverride middleware", () => {
  it("POST → PUT via X-HTTP-Method-Override routes to PUT handler", async () => {
    const app = bunway();
    app.use(methodOverride());
    app.put("/resource", (req, res) => res.json({ method: req.method }));

    const response = await app.handle(new Request("http://localhost/resource", {
      method: "POST",
      headers: { "X-HTTP-Method-Override": "PUT" },
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ method: "PUT" });
  });

  it("POST → DELETE via _method query param routes to DELETE handler", async () => {
    const app = bunway();
    app.use(methodOverride({ getter: "_method" }));
    app.delete("/resource", (req, res) => res.json({ method: req.method }));

    const response = await app.handle(new Request("http://localhost/resource?_method=DELETE", {
      method: "POST",
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ method: "DELETE" });
  });

  it("POST → PATCH via body field routes to PATCH handler", async () => {
    const app = bunway();
    app.use(urlencoded());
    app.use(methodOverride({ getter: "_method" }));
    app.patch("/resource", (req, res) => res.json({ method: req.method }));

    const response = await app.handle(new Request("http://localhost/resource", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "_method=PATCH",
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ method: "PATCH" });
  });

  it("_originalMethod is 'POST' inside the overridden handler", async () => {
    const app = bunway();
    app.use(methodOverride());
    app.put("/resource", (req, res) => {
      res.json({ original: (req as unknown as { _originalMethod: string })._originalMethod });
    });

    const response = await app.handle(new Request("http://localhost/resource", {
      method: "POST",
      headers: { "X-HTTP-Method-Override": "PUT" },
    }));
    expect(await response.json()).toEqual({ original: "POST" });
  });

  it("non-POST requests are not overridden", async () => {
    const app = bunway();
    app.use(methodOverride());
    app.get("/resource", (req, res) => res.json({ method: req.method }));

    const response = await app.handle(new Request("http://localhost/resource", {
      method: "GET",
      headers: { "X-HTTP-Method-Override": "DELETE" },
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ method: "GET" });
  });

  it("illegal override method (CONNECT) is silently skipped", async () => {
    const app = bunway();
    app.use(methodOverride());
    app.post("/resource", (req, res) => res.json({ method: req.method }));

    const response = await app.handle(new Request("http://localhost/resource", {
      method: "POST",
      headers: { "X-HTTP-Method-Override": "CONNECT" },
    }));
    expect(await response.json()).toEqual({ method: "POST" });
  });
});
