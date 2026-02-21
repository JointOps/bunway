import { describe, expect, it } from "bun:test";
import { helmet } from "../../../src/middleware/helmet";
import { BunRequest } from "../../../src/core/request";
import { BunResponse } from "../../../src/core/response";

function createReqRes() {
  const req = new BunRequest(new Request("http://localhost/test"));
  const res = new BunResponse();
  return { req, res };
}

function getHeaders(res: BunResponse): Headers {
  return res.toResponse().headers;
}

describe("Helmet Middleware (Unit)", () => {
  describe("Default behavior (all enabled)", () => {
    it("sets Content-Security-Policy with default directives", () => {
      const { req, res } = createReqRes();
      helmet()(req as any, res as any, () => {});
      const h = getHeaders(res);
      const csp = h.get("Content-Security-Policy");
      expect(csp).toBeDefined();
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self'");
      expect(csp).toContain("object-src 'none'");
    });

    it("sets Cross-Origin-Embedder-Policy to require-corp", () => {
      const { req, res } = createReqRes();
      helmet()(req as any, res as any, () => {});
      expect(getHeaders(res).get("Cross-Origin-Embedder-Policy")).toBe("require-corp");
    });

    it("sets Cross-Origin-Opener-Policy to same-origin", () => {
      const { req, res } = createReqRes();
      helmet()(req as any, res as any, () => {});
      expect(getHeaders(res).get("Cross-Origin-Opener-Policy")).toBe("same-origin");
    });

    it("sets Cross-Origin-Resource-Policy to same-origin", () => {
      const { req, res } = createReqRes();
      helmet()(req as any, res as any, () => {});
      expect(getHeaders(res).get("Cross-Origin-Resource-Policy")).toBe("same-origin");
    });

    it("sets X-DNS-Prefetch-Control to off", () => {
      const { req, res } = createReqRes();
      helmet()(req as any, res as any, () => {});
      expect(getHeaders(res).get("X-DNS-Prefetch-Control")).toBe("off");
    });

    it("sets X-Frame-Options to SAMEORIGIN", () => {
      const { req, res } = createReqRes();
      helmet()(req as any, res as any, () => {});
      expect(getHeaders(res).get("X-Frame-Options")).toBe("SAMEORIGIN");
    });

    it("sets X-Powered-By to empty string", () => {
      const { req, res } = createReqRes();
      helmet()(req as any, res as any, () => {});
      expect(getHeaders(res).get("X-Powered-By")).toBe("");
    });

    it("sets Strict-Transport-Security with default maxAge and includeSubDomains", () => {
      const { req, res } = createReqRes();
      helmet()(req as any, res as any, () => {});
      expect(getHeaders(res).get("Strict-Transport-Security")).toBe(
        "max-age=15552000; includeSubDomains"
      );
    });

    it("sets X-Download-Options to noopen", () => {
      const { req, res } = createReqRes();
      helmet()(req as any, res as any, () => {});
      expect(getHeaders(res).get("X-Download-Options")).toBe("noopen");
    });

    it("sets X-Content-Type-Options to nosniff", () => {
      const { req, res } = createReqRes();
      helmet()(req as any, res as any, () => {});
      expect(getHeaders(res).get("X-Content-Type-Options")).toBe("nosniff");
    });

    it("sets Origin-Agent-Cluster to ?1", () => {
      const { req, res } = createReqRes();
      helmet()(req as any, res as any, () => {});
      expect(getHeaders(res).get("Origin-Agent-Cluster")).toBe("?1");
    });

    it("sets X-Permitted-Cross-Domain-Policies to none", () => {
      const { req, res } = createReqRes();
      helmet()(req as any, res as any, () => {});
      expect(getHeaders(res).get("X-Permitted-Cross-Domain-Policies")).toBe("none");
    });

    it("sets Referrer-Policy to no-referrer", () => {
      const { req, res } = createReqRes();
      helmet()(req as any, res as any, () => {});
      expect(getHeaders(res).get("Referrer-Policy")).toBe("no-referrer");
    });

    it("sets X-XSS-Protection to 0", () => {
      const { req, res } = createReqRes();
      helmet()(req as any, res as any, () => {});
      expect(getHeaders(res).get("X-XSS-Protection")).toBe("0");
    });

    it("calls next() after setting headers", () => {
      const { req, res } = createReqRes();
      let called = false;
      helmet()(req as any, res as any, () => { called = true; });
      expect(called).toBe(true);
    });
  });

  describe("Disabling individual headers", () => {
    it("disables Content-Security-Policy when set to false", () => {
      const { req, res } = createReqRes();
      helmet({ contentSecurityPolicy: false })(req as any, res as any, () => {});
      expect(getHeaders(res).get("Content-Security-Policy")).toBeNull();
    });

    it("disables Cross-Origin-Embedder-Policy when set to false", () => {
      const { req, res } = createReqRes();
      helmet({ crossOriginEmbedderPolicy: false })(req as any, res as any, () => {});
      expect(getHeaders(res).get("Cross-Origin-Embedder-Policy")).toBeNull();
    });

    it("disables Cross-Origin-Opener-Policy when set to false", () => {
      const { req, res } = createReqRes();
      helmet({ crossOriginOpenerPolicy: false })(req as any, res as any, () => {});
      expect(getHeaders(res).get("Cross-Origin-Opener-Policy")).toBeNull();
    });

    it("disables Cross-Origin-Resource-Policy when set to false", () => {
      const { req, res } = createReqRes();
      helmet({ crossOriginResourcePolicy: false })(req as any, res as any, () => {});
      expect(getHeaders(res).get("Cross-Origin-Resource-Policy")).toBeNull();
    });

    it("disables X-DNS-Prefetch-Control when set to false", () => {
      const { req, res } = createReqRes();
      helmet({ dnsPrefetchControl: false })(req as any, res as any, () => {});
      expect(getHeaders(res).get("X-DNS-Prefetch-Control")).toBeNull();
    });

    it("disables X-Frame-Options when set to false", () => {
      const { req, res } = createReqRes();
      helmet({ frameguard: false })(req as any, res as any, () => {});
      expect(getHeaders(res).get("X-Frame-Options")).toBeNull();
    });

    it("disables X-Powered-By hiding when set to false", () => {
      const { req, res } = createReqRes();
      helmet({ hidePoweredBy: false })(req as any, res as any, () => {});
      expect(getHeaders(res).get("X-Powered-By")).toBeNull();
    });

    it("disables Strict-Transport-Security when set to false", () => {
      const { req, res } = createReqRes();
      helmet({ hsts: false })(req as any, res as any, () => {});
      expect(getHeaders(res).get("Strict-Transport-Security")).toBeNull();
    });

    it("disables X-Download-Options when set to false", () => {
      const { req, res } = createReqRes();
      helmet({ ieNoOpen: false })(req as any, res as any, () => {});
      expect(getHeaders(res).get("X-Download-Options")).toBeNull();
    });

    it("disables X-Content-Type-Options when set to false", () => {
      const { req, res } = createReqRes();
      helmet({ noSniff: false })(req as any, res as any, () => {});
      expect(getHeaders(res).get("X-Content-Type-Options")).toBeNull();
    });
  });

  describe("Custom CSP directives", () => {
    it("uses custom directives when provided", () => {
      const { req, res } = createReqRes();
      helmet({
        contentSecurityPolicy: {
          directives: {
            "default-src": ["'self'", "https://cdn.example.com"],
            "script-src": ["'self'", "'unsafe-inline'"],
          },
        },
      })(req as any, res as any, () => {});
      const csp = getHeaders(res).get("Content-Security-Policy")!;
      expect(csp).toContain("default-src 'self' https://cdn.example.com");
      expect(csp).toContain("script-src 'self' 'unsafe-inline'");
    });

    it("uses Content-Security-Policy-Report-Only when reportOnly is true", () => {
      const { req, res } = createReqRes();
      helmet({
        contentSecurityPolicy: { reportOnly: true },
      })(req as any, res as any, () => {});
      const h = getHeaders(res);
      expect(h.get("Content-Security-Policy-Report-Only")).toBeDefined();
      expect(h.get("Content-Security-Policy")).toBeNull();
    });
  });

  describe("HSTS options", () => {
    it("uses custom maxAge", () => {
      const { req, res } = createReqRes();
      helmet({ hsts: { maxAge: 31536000 } })(req as any, res as any, () => {});
      expect(getHeaders(res).get("Strict-Transport-Security")).toContain("max-age=31536000");
    });

    it("includes preload when enabled", () => {
      const { req, res } = createReqRes();
      helmet({ hsts: { preload: true } })(req as any, res as any, () => {});
      const hsts = getHeaders(res).get("Strict-Transport-Security")!;
      expect(hsts).toContain("preload");
      expect(hsts).toContain("includeSubDomains");
    });

    it("omits includeSubDomains when explicitly disabled", () => {
      const { req, res } = createReqRes();
      helmet({ hsts: { includeSubDomains: false } })(req as any, res as any, () => {});
      const hsts = getHeaders(res).get("Strict-Transport-Security")!;
      expect(hsts).toBe("max-age=15552000");
      expect(hsts).not.toContain("includeSubDomains");
    });
  });

  describe("Frameguard options", () => {
    it("sets X-Frame-Options to DENY when action is deny", () => {
      const { req, res } = createReqRes();
      helmet({ frameguard: { action: "deny" } })(req as any, res as any, () => {});
      expect(getHeaders(res).get("X-Frame-Options")).toBe("DENY");
    });
  });

  describe("DNS Prefetch Control options", () => {
    it("sets X-DNS-Prefetch-Control to on when allow is true", () => {
      const { req, res } = createReqRes();
      helmet({ dnsPrefetchControl: { allow: true } })(req as any, res as any, () => {});
      expect(getHeaders(res).get("X-DNS-Prefetch-Control")).toBe("on");
    });
  });

  describe("Custom cross-origin policies", () => {
    it("sets custom Cross-Origin-Embedder-Policy", () => {
      const { req, res } = createReqRes();
      helmet({ crossOriginEmbedderPolicy: { policy: "unsafe-none" } })(req as any, res as any, () => {});
      expect(getHeaders(res).get("Cross-Origin-Embedder-Policy")).toBe("unsafe-none");
    });

    it("sets custom Cross-Origin-Opener-Policy", () => {
      const { req, res } = createReqRes();
      helmet({ crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" } })(req as any, res as any, () => {});
      expect(getHeaders(res).get("Cross-Origin-Opener-Policy")).toBe("same-origin-allow-popups");
    });

    it("sets custom Cross-Origin-Resource-Policy", () => {
      const { req, res } = createReqRes();
      helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } })(req as any, res as any, () => {});
      expect(getHeaders(res).get("Cross-Origin-Resource-Policy")).toBe("cross-origin");
    });
  });

  describe("Referrer Policy options", () => {
    it("sets custom referrer policy as string", () => {
      const { req, res } = createReqRes();
      helmet({ referrerPolicy: { policy: "strict-origin" } })(req as any, res as any, () => {});
      expect(getHeaders(res).get("Referrer-Policy")).toBe("strict-origin");
    });

    it("sets referrer policy from array joined with commas", () => {
      const { req, res } = createReqRes();
      helmet({
        referrerPolicy: { policy: ["no-referrer", "strict-origin-when-cross-origin"] },
      })(req as any, res as any, () => {});
      expect(getHeaders(res).get("Referrer-Policy")).toBe(
        "no-referrer, strict-origin-when-cross-origin"
      );
    });
  });

  describe("Permitted Cross-Domain Policies options", () => {
    it("sets custom permitted cross-domain policies", () => {
      const { req, res } = createReqRes();
      helmet({
        permittedCrossDomainPolicies: { permittedPolicies: "master-only" },
      })(req as any, res as any, () => {});
      expect(getHeaders(res).get("X-Permitted-Cross-Domain-Policies")).toBe("master-only");
    });
  });
});
