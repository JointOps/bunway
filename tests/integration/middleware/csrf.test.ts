import { describe, expect, it } from "bun:test";
import { Router, csrf, cookieParser, json } from "../../../src";

function buildRequest(
  path: string,
  options: { method?: string; headers?: Record<string, string>; body?: string } = {}
): Request {
  return new Request(`http://localhost${path}`, {
    method: options.method || "GET",
    headers: options.headers,
    body: options.body,
  });
}

function getCookie(response: Response, name: string): string | undefined {
  const cookies = response.headers.getSetCookie();
  for (const cookie of cookies) {
    if (cookie.startsWith(`${name}=`)) {
      return cookie.split(";")[0].split("=")[1];
    }
  }
  return undefined;
}

describe("CSRF Middleware", () => {
  it("sets CSRF token cookie on GET request", async () => {
    const router = new Router();
    router.use(cookieParser());
    router.use(csrf());
    router.get("/", (req, res) => res.json({ token: (req as any).csrfToken() }));

    const response = await router.handle(buildRequest("/"));
    expect(response.status).toBe(200);

    const token = getCookie(response, "_csrf");
    expect(token).toBeDefined();
    expect(token!.length).toBe(32);
  });

  it("allows GET requests without token validation", async () => {
    const router = new Router();
    router.use(cookieParser());
    router.use(csrf());
    router.get("/data", (req, res) => res.json({ ok: true }));

    const response = await router.handle(buildRequest("/data"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("rejects POST without CSRF token", async () => {
    const router = new Router();
    router.use(cookieParser());
    router.use(json());
    router.use(csrf());
    router.post("/submit", (req, res) => res.json({ ok: true }));

    const response = await router.handle(
      buildRequest("/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: "_csrf=abc123" },
        body: JSON.stringify({}),
      })
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Invalid CSRF token" });
  });

  it("accepts POST with valid CSRF token in header", async () => {
    const router = new Router();
    router.use(cookieParser());
    router.use(json());
    router.use(csrf());
    router.post("/submit", (req, res) => res.json({ ok: true }));

    const token = "valid-csrf-token-12345678901234";

    const response = await router.handle(
      buildRequest("/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `_csrf=${token}`,
          "x-csrf-token": token,
        },
        body: JSON.stringify({}),
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("accepts POST with valid CSRF token in body", async () => {
    const router = new Router();
    router.use(cookieParser());
    router.use(json());
    router.use(csrf());
    router.post("/submit", (req, res) => res.json({ ok: true }));

    const token = "valid-csrf-token-12345678901234";

    const response = await router.handle(
      buildRequest("/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `_csrf=${token}`,
        },
        body: JSON.stringify({ _csrf: token }),
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("rejects POST with mismatched token", async () => {
    const router = new Router();
    router.use(cookieParser());
    router.use(json());
    router.use(csrf());
    router.post("/submit", (req, res) => res.json({ ok: true }));

    const response = await router.handle(
      buildRequest("/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: "_csrf=cookie-token-123456789012",
          "x-csrf-token": "different-token-12345678901",
        },
        body: JSON.stringify({}),
      })
    );

    expect(response.status).toBe(403);
  });

  it("ignores HEAD and OPTIONS by default", async () => {
    const router = new Router();
    router.use(cookieParser());
    router.use(csrf());
    router.head("/check", (req, res) => res.status(200).send(null));
    router.options("/check", (req, res) => res.status(204).send(null));

    const headRes = await router.handle(buildRequest("/check", { method: "HEAD" }));
    expect(headRes.status).toBe(200);

    const optionsRes = await router.handle(buildRequest("/check", { method: "OPTIONS" }));
    expect(optionsRes.status).toBe(204);
  });

  it("uses custom cookie name", async () => {
    const router = new Router();
    router.use(cookieParser());
    router.use(csrf({ cookie: { name: "my-csrf" } }));
    router.get("/", (req, res) => res.json({ ok: true }));

    const response = await router.handle(buildRequest("/"));
    const token = getCookie(response, "my-csrf");
    expect(token).toBeDefined();
  });

  it("uses custom header name", async () => {
    const router = new Router();
    router.use(cookieParser());
    router.use(json());
    router.use(csrf({ headerName: "x-custom-csrf" }));
    router.post("/submit", (req, res) => res.json({ ok: true }));

    const token = "custom-header-token-1234567890";

    const response = await router.handle(
      buildRequest("/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `_csrf=${token}`,
          "x-custom-csrf": token,
        },
        body: JSON.stringify({}),
      })
    );

    expect(response.status).toBe(200);
  });
});
