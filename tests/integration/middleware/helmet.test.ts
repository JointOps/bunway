import { describe, expect, it } from "bun:test";
import bunway, { helmet } from "../../../src";
import { buildRequest } from "../../utils/testUtils";

describe("helmet middleware", () => {
  it("sets default security headers", async () => {
    const app = bunway();
    app.use(helmet());
    app.get("/test", (req, res) => res.json({ ok: true }));

    const response = await app.handle(buildRequest("/test"));

    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(response.headers.get("X-XSS-Protection")).toBe("0");
    expect(response.headers.get("Strict-Transport-Security")).toContain("max-age=");
    expect(response.headers.get("Content-Security-Policy")).toBeDefined();
    expect(response.headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
    expect(response.headers.get("Cross-Origin-Resource-Policy")).toBe("same-origin");
    expect(response.headers.get("Cross-Origin-Embedder-Policy")).toBe("require-corp");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(response.headers.get("X-DNS-Prefetch-Control")).toBe("off");
    expect(response.headers.get("X-Download-Options")).toBe("noopen");
    expect(response.headers.get("X-Permitted-Cross-Domain-Policies")).toBe("none");
    expect(response.headers.get("Origin-Agent-Cluster")).toBe("?1");
  });

  it("allows disabling specific headers", async () => {
    const app = bunway();
    app.use(
      helmet({
        contentSecurityPolicy: false,
        hsts: false,
        frameguard: false,
      })
    );
    app.get("/test", (req, res) => res.json({ ok: true }));

    const response = await app.handle(buildRequest("/test"));

    expect(response.headers.get("Content-Security-Policy")).toBeNull();
    expect(response.headers.get("Strict-Transport-Security")).toBeNull();
    expect(response.headers.get("X-Frame-Options")).toBeNull();
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("allows custom CSP directives", async () => {
    const app = bunway();
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            "default-src": ["'self'"],
            "script-src": ["'self'", "https://cdn.example.com"],
            "img-src": ["*"],
          },
        },
      })
    );
    app.get("/test", (req, res) => res.json({ ok: true }));

    const response = await app.handle(buildRequest("/test"));
    const csp = response.headers.get("Content-Security-Policy");

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' https://cdn.example.com");
    expect(csp).toContain("img-src *");
  });

  it("allows custom HSTS options", async () => {
    const app = bunway();
    app.use(
      helmet({
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        },
      })
    );
    app.get("/test", (req, res) => res.json({ ok: true }));

    const response = await app.handle(buildRequest("/test"));
    const hsts = response.headers.get("Strict-Transport-Security");

    expect(hsts).toContain("max-age=31536000");
    expect(hsts).toContain("includeSubDomains");
    expect(hsts).toContain("preload");
  });

  it("allows custom frameguard action", async () => {
    const app = bunway();
    app.use(helmet({ frameguard: { action: "deny" } }));
    app.get("/test", (req, res) => res.json({ ok: true }));

    const response = await app.handle(buildRequest("/test"));

    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("allows custom referrer policy", async () => {
    const app = bunway();
    app.use(helmet({ referrerPolicy: { policy: "strict-origin-when-cross-origin" } }));
    app.get("/test", (req, res) => res.json({ ok: true }));

    const response = await app.handle(buildRequest("/test"));

    expect(response.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("allows multiple referrer policies", async () => {
    const app = bunway();
    app.use(
      helmet({
        referrerPolicy: { policy: ["no-referrer", "strict-origin-when-cross-origin"] },
      })
    );
    app.get("/test", (req, res) => res.json({ ok: true }));

    const response = await app.handle(buildRequest("/test"));

    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer, strict-origin-when-cross-origin");
  });

  it("can enable DNS prefetch", async () => {
    const app = bunway();
    app.use(helmet({ dnsPrefetchControl: { allow: true } }));
    app.get("/test", (req, res) => res.json({ ok: true }));

    const response = await app.handle(buildRequest("/test"));

    expect(response.headers.get("X-DNS-Prefetch-Control")).toBe("on");
  });

  it("sets report-only CSP when configured", async () => {
    const app = bunway();
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: { "default-src": ["'self'"] },
          reportOnly: true,
        },
      })
    );
    app.get("/test", (req, res) => res.json({ ok: true }));

    const response = await app.handle(buildRequest("/test"));

    expect(response.headers.get("Content-Security-Policy")).toBeNull();
    expect(response.headers.get("Content-Security-Policy-Report-Only")).toContain("default-src 'self'");
  });
});
