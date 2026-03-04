import { describe, it, expect } from "bun:test";
import bunway from "../../../src";

describe("Integration: res.jsonp()", () => {
  it("returns JSONP with callback parameter", async () => {
    const app = bunway();
    app.get("/api", (req, res) => res.jsonp({ name: "bunway" }));

    const response = await app.handle(
      new Request("http://localhost/api?callback=myFunc")
    );
    expect(response.headers.get("Content-Type")).toBe("text/javascript; charset=utf-8");
    const body = await response.text();
    expect(body).toContain("myFunc");
    expect(body).toContain('"name":"bunway"');
  });

  it("falls back to JSON when no callback", async () => {
    const app = bunway();
    app.get("/api", (req, res) => res.jsonp({ name: "bunway" }));

    const response = await app.handle(
      new Request("http://localhost/api")
    );
    expect(response.headers.get("Content-Type")).toBe("application/json");
    const body = await response.json();
    expect(body).toEqual({ name: "bunway" });
  });

  it("uses custom callback name from app.set()", async () => {
    const app = bunway();
    app.set("jsonp callback name", "cb");
    app.get("/api", (req, res) => res.jsonp({ ok: true }));

    const response = await app.handle(
      new Request("http://localhost/api?cb=handler")
    );
    const body = await response.text();
    expect(body).toContain("handler");
    expect(response.headers.get("Content-Type")).toBe("text/javascript; charset=utf-8");
  });

  it("sanitizes XSS in callback name", async () => {
    const app = bunway();
    app.get("/api", (req, res) => res.jsonp({ x: 1 }));

    const response = await app.handle(
      new Request("http://localhost/api?callback=alert(document.cookie)//")
    );
    const body = await response.text();
    // Parentheses, slashes stripped: "alertdocument.cookie" remains after sanitize
    expect(body).not.toContain("(document.cookie)");
    expect(body).not.toContain("//");
  });

  it("default callback name is 'callback'", async () => {
    const app = bunway();
    app.get("/api", (req, res) => res.jsonp({ v: 1 }));

    const response = await app.handle(
      new Request("http://localhost/api?callback=fn")
    );
    expect(response.headers.get("Content-Type")).toBe("text/javascript; charset=utf-8");
  });
});
