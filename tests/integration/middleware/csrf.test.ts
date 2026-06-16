import { describe, expect, it } from "bun:test";
import { Router, csrf, cookieParser, json } from "../../../src";

const SECRET = "integration-csrf-secret-32chars!!";

function buildRequest(
  path: string,
  options: { method?: string; headers?: Record<string, string>; body?: string } = {}
): Request {
  return new Request(`http://localhost${path}`, {
    method: options.method ?? "GET",
    headers: options.headers,
    body: options.body,
  });
}

function getCsrfCookie(response: Response): string | undefined {
  return response.headers.getSetCookie()
    .find(c => c.startsWith("_csrf="))
    ?.split(";")[0]?.split("=")[1];
}

async function getSignedToken(router: Router, cookieHeader?: string): Promise<{ signedToken: string; rawToken: string }> {
  const headers: Record<string, string> = {};
  if (cookieHeader) headers["Cookie"] = cookieHeader;
  const res = await router.handle(buildRequest("/csrf-token", { headers }));
  const rawToken = getCsrfCookie(res);
  const { token: signedToken } = await res.json<{ token: string }>();
  return { signedToken, rawToken: rawToken! };
}

function buildRouter(opts: Parameters<typeof csrf>[0] = { secret: SECRET }): Router {
  const router = new Router();
  router.use(cookieParser());
  router.use(json());
  router.use(csrf(opts));
  router.get("/csrf-token", (req, res) => res.json({ token: (req as any).csrfToken() }));
  router.post("/submit", (req, res) => res.json({ ok: true }));
  return router;
}

describe("CSRF Middleware (Integration)", () => {
  it("GET sets _csrf cookie", async () => {
    const router = buildRouter();
    const res = await router.handle(buildRequest("/csrf-token"));
    expect(res.status).toBe(200);
    expect(getCsrfCookie(res)).toBeDefined();
  });

  it("csrfToken endpoint returns signed token distinct from cookie value", async () => {
    const router = buildRouter();
    const { signedToken, rawToken } = await getSignedToken(router);
    expect(signedToken).not.toBe(rawToken);
    expect(signedToken.lastIndexOf(".")).toBeGreaterThan(0);
  });

  it("GET passthrough without token", async () => {
    const router = buildRouter();
    const { rawToken } = await getSignedToken(router);
    const res = await router.handle(buildRequest("/csrf-token", { headers: { Cookie: `_csrf=${rawToken}` } }));
    expect(res.status).toBe(200);
  });

  it("POST with signed token in header succeeds", async () => {
    const router = buildRouter();
    const { signedToken, rawToken } = await getSignedToken(router);

    const res = await router.handle(buildRequest("/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `_csrf=${rawToken}`, "x-csrf-token": signedToken },
      body: "{}",
    }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("POST with signed token in body succeeds", async () => {
    const router = buildRouter();
    const { signedToken, rawToken } = await getSignedToken(router);

    const res = await router.handle(buildRequest("/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `_csrf=${rawToken}` },
      body: JSON.stringify({ _csrf: signedToken }),
    }));
    expect(res.status).toBe(200);
  });

  it("POST with raw (unsigned) cookie value rejected - old behavior no longer works", async () => {
    const router = buildRouter();
    const { rawToken } = await getSignedToken(router);

    const res = await router.handle(buildRequest("/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `_csrf=${rawToken}`, "x-csrf-token": rawToken },
      body: "{}",
    }));
    expect(res.status).toBe(403);
  });

  it("POST with no token -> 403 via error middleware", async () => {
    const router = buildRouter();
    const { rawToken } = await getSignedToken(router);

    const res = await router.handle(buildRequest("/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `_csrf=${rawToken}` },
      body: "{}",
    }));
    expect(res.status).toBe(403);
  });

  it("POST with forged token (wrong HMAC) -> 403", async () => {
    const router = buildRouter();
    const { rawToken } = await getSignedToken(router);

    const res = await router.handle(buildRequest("/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `_csrf=${rawToken}`,
        "x-csrf-token": `${rawToken}.invalid-hmac-signature`,
      },
      body: "{}",
    }));
    expect(res.status).toBe(403);
  });

  it("cookie injection: valid signed token but different cookie -> 403", async () => {
    const router = buildRouter();
    const { signedToken } = await getSignedToken(router);

    const res = await router.handle(buildRequest("/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: "_csrf=attacker-injected-value",
        "x-csrf-token": signedToken,
      },
      body: "{}",
    }));
    expect(res.status).toBe(403);
  });

  it("HEAD and OPTIONS pass without token", async () => {
    const router = buildRouter();
    router.head("/check", (req, res) => res.status(200).send(null));
    router.options("/check", (req, res) => res.status(204).send(null));

    expect((await router.handle(buildRequest("/check", { method: "HEAD" }))).status).toBe(200);
    expect((await router.handle(buildRequest("/check", { method: "OPTIONS" }))).status).toBe(204);
  });

  it("uses custom cookie name", async () => {
    const router = new Router();
    router.use(cookieParser());
    router.use(csrf({ secret: SECRET, cookie: { name: "my-csrf" } }));
    router.get("/", (req, res) => res.json({ token: (req as any).csrfToken() }));

    const res = await router.handle(buildRequest("/"));
    const cookie = res.headers.getSetCookie().find(c => c.startsWith("my-csrf="));
    expect(cookie).toBeDefined();
  });

  it("uses custom header name", async () => {
    const router = buildRouter({ secret: SECRET, headerName: "x-custom-csrf" });
    const { signedToken, rawToken } = await getSignedToken(router);

    const res = await router.handle(buildRequest("/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `_csrf=${rawToken}`, "x-custom-csrf": signedToken },
      body: "{}",
    }));
    expect(res.status).toBe(200);
  });
});
