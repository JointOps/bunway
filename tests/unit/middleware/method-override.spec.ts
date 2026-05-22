import { describe, expect, it } from "bun:test";
import bunway from "../../../src";
import { urlencoded } from "../../../src/middleware/body-parser";
import { methodOverride } from "../../../src/middleware/method-override";

describe("methodOverride middleware", () => {
  it("overrides POST to PUT via X-HTTP-Method-Override header", async () => {
    const app = bunway();
    app.use(methodOverride());
    app.put("/r", (req, res) => res.json({ method: req.method }));

    const res = await app.handle(new Request("http://localhost/r", {
      method: "POST",
      headers: { "X-HTTP-Method-Override": "PUT" },
    }));
    expect(await res.json()).toEqual({ method: "PUT" });
  });

  it("overrides POST to DELETE via query param _method", async () => {
    const app = bunway();
    app.use(methodOverride({ getter: "_method" }));
    app.delete("/r", (req, res) => res.json({ method: req.method }));

    const res = await app.handle(new Request("http://localhost/r?_method=DELETE", { method: "POST" }));
    expect(await res.json()).toEqual({ method: "DELETE" });
  });

  it("overrides POST to PATCH via body field", async () => {
    const app = bunway();
    app.use(urlencoded());
    app.use(methodOverride({ getter: "_method" }));
    app.patch("/r", (req, res) => res.json({ method: req.method }));

    const res = await app.handle(new Request("http://localhost/r", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "_method=PATCH",
    }));
    expect(await res.json()).toEqual({ method: "PATCH" });
  });

  it("does not override non-POST methods", async () => {
    const app = bunway();
    app.use(methodOverride());
    app.put("/r", (req, res) => res.json({ method: req.method }));

    const res = await app.handle(new Request("http://localhost/r", {
      method: "PUT",
      headers: { "X-HTTP-Method-Override": "DELETE" },
    }));
    expect(await res.json()).toEqual({ method: "PUT" });
  });

  it("ignores unsafe or non-whitelisted override values", async () => {
    const app = bunway();
    app.use(methodOverride());
    app.post("/r", (req, res) => res.json({ method: req.method }));

    const res = await app.handle(new Request("http://localhost/r", {
      method: "POST",
      headers: { "X-HTTP-Method-Override": "CONNECT" },
    }));
    expect(await res.json()).toEqual({ method: "POST" });
  });

  it("custom getter function is supported", async () => {
    const app = bunway();
    app.use(methodOverride({ getter: (req) => req.get("X-My-Method") ?? undefined }));
    app.delete("/r", (req, res) => res.json({ method: req.method }));

    const res = await app.handle(new Request("http://localhost/r", {
      method: "POST",
      headers: { "X-My-Method": "DELETE" },
    }));
    expect(await res.json()).toEqual({ method: "DELETE" });
  });

  it("sets req._originalMethod before overriding", async () => {
    const app = bunway();
    app.use(methodOverride());
    app.put("/r", (req, res) => {
      res.json({ original: (req as unknown as { _originalMethod: string })._originalMethod });
    });

    const res = await app.handle(new Request("http://localhost/r", {
      method: "POST",
      headers: { "X-HTTP-Method-Override": "PUT" },
    }));
    expect(await res.json()).toEqual({ original: "POST" });
  });

  it("override is case-insensitive", async () => {
    const app = bunway();
    app.use(methodOverride());
    app.put("/r", (req, res) => res.json({ method: req.method }));

    const res = await app.handle(new Request("http://localhost/r", {
      method: "POST",
      headers: { "X-HTTP-Method-Override": "put" },
    }));
    expect(await res.json()).toEqual({ method: "PUT" });
  });
});
