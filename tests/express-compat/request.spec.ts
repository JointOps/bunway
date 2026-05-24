import { describe, test, expect } from "bun:test";
import bunway, { Router } from "../../src";
import { buildRequest } from "../utils/testUtils";

describe("Express Compatibility: Request Object", () => {
  test("req.method works like Express", async () => {
    const app = bunway();
    app.get("/test", (req, res) => res.json({ method: req.method }));

    const response = await app.handle(buildRequest("/test"));
    expect(await response.json()).toEqual({ method: "GET" });
  });

  test("req.url works like Express", async () => {
    const app = bunway();
    app.get("/test", (req, res) => res.json({ url: req.url }));

    const response = await app.handle(buildRequest("/test?foo=bar"));
    const data = await response.json();
    expect(data.url).toContain("/test?foo=bar");
  });

  test("req.path works like Express", async () => {
    const app = bunway();
    app.get("/users/:id", (req, res) => res.json({ path: req.path }));

    const response = await app.handle(buildRequest("/users/123?foo=bar"));
    expect(await response.json()).toEqual({ path: "/users/123" });
  });

  test("req.params works like Express", async () => {
    const app = bunway();
    app.get("/users/:userId/posts/:postId", (req, res) => {
      res.json({ params: req.params });
    });

    const response = await app.handle(buildRequest("/users/42/posts/99"));
    expect(await response.json()).toEqual({
      params: { userId: "42", postId: "99" }
    });
  });

  test("req.query works like Express", async () => {
    const app = bunway();
    app.get("/search", (req, res) => {
      const query: Record<string, string> = {};
      for (const [key, value] of req.query.entries()) {
        query[key] = value;
      }
      res.json({ query });
    });

    const response = await app.handle(buildRequest("/search?q=bunway&page=1"));
    expect(await response.json()).toEqual({
      query: { q: "bunway", page: "1" }
    });
  });

  test("req.get() works like Express", async () => {
    const app = bunway();
    app.get("/test", (req, res) => {
      res.json({
        contentType: req.get("content-type"),
        userAgent: req.get("user-agent")
      });
    });

    const response = await app.handle(buildRequest("/test", {
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "test-agent"
      }
    }));

    expect(await response.json()).toEqual({
      contentType: "application/json",
      userAgent: "test-agent"
    });
  });

  test("req.header() alias works like Express", async () => {
    const app = bunway();
    app.get("/test", (req, res) => {
      res.json({ host: req.header("host") });
    });

    const response = await app.handle(buildRequest("/test", {
      headers: { "Host": "example.com" }
    }));

    expect(await response.json()).toEqual({ host: "example.com" });
  });

  test("req.hostname works like Express", async () => {
    const app = bunway();
    app.get("/test", (req, res) => {
      res.json({ hostname: req.hostname });
    });

    const response = await app.handle(buildRequest("http://example.com:3000/test"));
    expect(await response.json()).toEqual({ hostname: "example.com" });
  });

  test("req.protocol works like Express", async () => {
    const app = bunway();
    app.get("/test", (req, res) => {
      res.json({ protocol: req.protocol });
    });

    const response = await app.handle(buildRequest("http://localhost/test"));
    expect(await response.json()).toEqual({ protocol: "http" });
  });

  test("req.secure works like Express", async () => {
    const app = bunway();
    app.get("/test", (req, res) => {
      res.json({ secure: req.secure });
    });

    const response1 = await app.handle(buildRequest("http://localhost/test"));
    expect(await response1.json()).toEqual({ secure: false });

    const response2 = await app.handle(buildRequest("https://localhost/test"));
    expect(await response2.json()).toEqual({ secure: true });
  });

  test("req.xhr works like Express", async () => {
    const app = bunway();
    app.get("/test", (req, res) => {
      res.json({ xhr: req.xhr });
    });

    const response1 = await app.handle(buildRequest("/test"));
    expect(await response1.json()).toEqual({ xhr: false });

    const response2 = await app.handle(buildRequest("/test", {
      headers: { "X-Requested-With": "XMLHttpRequest" }
    }));
    expect(await response2.json()).toEqual({ xhr: true });
  });

  test("req.is() works like Express", async () => {
    const app = bunway();
    app.post("/test", (req, res) => {
      res.json({
        isJson: req.is("json"),
        isHtml: req.is("html")
      });
    });

    const response = await app.handle(buildRequest("/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    }));

    expect(await response.json()).toEqual({
      isJson: "json",
      isHtml: false
    });
  });

  test("req.accepts() works like Express", async () => {
    const app = bunway();
    app.get("/test", (req, res) => {
      res.json({
        acceptsJson: req.accepts("json"),
        acceptsHtml: req.accepts("html")
      });
    });

    const response = await app.handle(buildRequest("/test", {
      headers: { "Accept": "application/json" }
    }));

    expect(await response.json()).toEqual({
      acceptsJson: "json",
      acceptsHtml: false
    });
  });

  test("req.acceptsEncodings() works like Express", async () => {
    const app = bunway();
    app.get("/test", (req, res) => {
      res.json({
        acceptsGzip: req.acceptsEncodings("gzip"),
        acceptsDeflate: req.acceptsEncodings("deflate")
      });
    });

    const response = await app.handle(buildRequest("/test", {
      headers: { "Accept-Encoding": "gzip, deflate" }
    }));

    expect(await response.json()).toEqual({
      acceptsGzip: "gzip",
      acceptsDeflate: "deflate"
    });
  });

  test("req.acceptsCharsets() works like Express", async () => {
    const app = bunway();
    app.get("/test", (req, res) => {
      res.json({
        acceptsUtf8: req.acceptsCharsets("utf-8"),
        acceptsLatin: req.acceptsCharsets("latin1")
      });
    });

    const response = await app.handle(buildRequest("/test", {
      headers: { "Accept-Charset": "utf-8" }
    }));

    expect(await response.json()).toEqual({
      acceptsUtf8: "utf-8",
      acceptsLatin: false
    });
  });

  test("req.acceptsLanguages() works like Express", async () => {
    const app = bunway();
    app.get("/test", (req, res) => {
      res.json({
        acceptsEn: req.acceptsLanguages("en"),
        acceptsFr: req.acceptsLanguages("fr")
      });
    });

    const response = await app.handle(buildRequest("/test", {
      headers: { "Accept-Language": "en-US,en;q=0.9" }
    }));

    expect(await response.json()).toEqual({
      acceptsEn: "en",
      acceptsFr: false
    });
  });

  test("req.param() works like Express", async () => {
    const app = bunway();
    app.get("/users/:id", (req, res) => {
      res.json({
        fromParams: req.param("id"),
        fromQuery: req.param("filter")
      });
    });

    const response = await app.handle(buildRequest("/users/123?filter=active"));
    expect(await response.json()).toEqual({
      fromParams: "123",
      fromQuery: "active"
    });
  });

  test("req.originalUrl works like Express", async () => {
    const app = bunway();
    app.get("/test", (req, res) => {
      res.json({ originalUrl: req.originalUrl });
    });

    const response = await app.handle(buildRequest("/test?foo=bar&baz=qux"));
    expect(await response.json()).toEqual({
      originalUrl: "/test?foo=bar&baz=qux"
    });
  });

  test("req.path works with mounted routers like Express", async () => {
    const app = bunway();
    const router = new Router();

    router.get("/posts", (req, res) => {
      res.json({ path: req.path });
    });

    app.use("/api/v1", router);

    const response = await app.handle(buildRequest("/api/v1/posts"));
    expect(await response.json()).toEqual({ path: "/posts" });
  });

  test("req.locals works like Express", async () => {
    const app = bunway();

    app.use((req, res, next) => {
      req.locals.user = { id: 123, name: "test" };
      next();
    });

    app.get("/test", (req, res) => {
      res.json({ user: req.locals.user });
    });

    const response = await app.handle(buildRequest("/test"));
    expect(await response.json()).toEqual({
      user: { id: 123, name: "test" }
    });
  });

  test("req.protocol respects X-Forwarded-Proto with trust proxy (Express pattern)", async () => {
    const app = bunway();
    app.set("trust proxy", true);
    app.get("/test", (req, res) => {
      res.json({ protocol: req.protocol });
    });

    const response = await app.handle(buildRequest("/test", {
      headers: { "X-Forwarded-Proto": "https" },
    }));
    expect(await response.json()).toEqual({ protocol: "https" });
  });

  test("req.secure respects X-Forwarded-Proto with trust proxy (Express pattern)", async () => {
    const app = bunway();
    app.set("trust proxy", true);
    app.get("/test", (req, res) => {
      res.json({ secure: req.secure });
    });

    const response = await app.handle(buildRequest("/test", {
      headers: { "X-Forwarded-Proto": "https" },
    }));
    expect(await response.json()).toEqual({ secure: true });
  });

  test("req.ip returns socket IP when trust proxy is false (Express pattern)", async () => {
    const app = bunway();
    app.get("/test", (req, res) => {
      res.json({ ip: req.ip });
    });

    const response = await app.handle(buildRequest("/test", {
      headers: { "X-Forwarded-For": "1.2.3.4" },
    }));
    const { ip } = await response.json() as { ip: string };
    expect(typeof ip).toBe("string");
  });

  test("req.ip returns X-Forwarded-For client IP with trust proxy true (Express pattern)", async () => {
    const app = bunway();
    app.set("trust proxy", true);
    app.get("/test", (req, res) => {
      res.json({ ip: req.ip });
    });

    const response = await app.handle(buildRequest("/test", {
      headers: { "X-Forwarded-For": "1.2.3.4, 10.0.0.1" },
    }));
    expect(await response.json()).toEqual({ ip: "1.2.3.4" });
  });

  test("req.ips returns empty array when trust proxy is false (Express pattern)", async () => {
    const app = bunway();
    app.get("/test", (req, res) => {
      res.json({ ips: req.ips });
    });

    const response = await app.handle(buildRequest("/test", {
      headers: { "X-Forwarded-For": "1.2.3.4, 10.0.0.1" },
    }));
    expect(await response.json()).toEqual({ ips: [] });
  });

  test("req.subdomains returns subdomain parts like Express", async () => {
    const app = bunway();
    app.get("/test", (req, res) => {
      res.json({ subdomains: req.subdomains });
    });

    const response = await app.handle(buildRequest("http://foo.bar.example.com/test"));
    expect(await response.json()).toEqual({ subdomains: ["bar", "foo"] });
  });

  test("req.subdomains is empty for plain domain like Express", async () => {
    const app = bunway();
    app.get("/test", (req, res) => {
      res.json({ subdomains: req.subdomains });
    });

    const response = await app.handle(buildRequest("http://example.com/test"));
    expect(await response.json()).toEqual({ subdomains: [] });
  });

  test("req.subdomains is empty for IP address like Express", async () => {
    const app = bunway();
    app.get("/test", (req, res) => {
      res.json({ subdomains: req.subdomains });
    });

    const response = await app.handle(buildRequest("http://192.168.1.1/test"));
    expect(await response.json()).toEqual({ subdomains: [] });
  });

  test("req.id is set by requestId middleware like Express", async () => {
    const app = bunway();
    app.use(bunway.requestId());
    app.get("/test", (req, res) => {
      res.json({ id: (req as any).id });
    });

    const response = await app.handle(buildRequest("/test"));
    const { id } = await response.json() as { id: string };
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  test("req.id echoes X-Request-Id header when provided", async () => {
    const app = bunway();
    app.use(bunway.requestId());
    app.get("/test", (req, res) => {
      res.json({ id: (req as any).id });
    });

    const response = await app.handle(buildRequest("/test", {
      headers: { "X-Request-Id": "custom-id-123" },
    }));
    expect(await response.json()).toEqual({ id: "custom-id-123" });
  });

  test("req.query.foo plain-object access works like Express", async () => {
    const app = bunway();
    app.get("/search", (req, res) => {
      res.json({ name: req.query["name"], page: req.query["page"] });
    });

    const response = await app.handle(buildRequest("/search?name=bunway&page=2"));
    expect(await response.json()).toEqual({ name: "bunway", page: "2" });
  });

  test("req.fresh is true when ETag matches like Express", async () => {
    const app = bunway();
    app.get("/test", (req, res) => {
      res.set("ETag", '"v1"');
      res.json({ fresh: req.fresh });
    });

    const response = await app.handle(buildRequest("/test", {
      headers: { "If-None-Match": '"v1"' },
    }));
    expect(await response.json()).toEqual({ fresh: true });
  });

  test("req.fresh is false when ETag does not match like Express", async () => {
    const app = bunway();
    app.get("/test", (req, res) => {
      res.set("ETag", '"v2"');
      res.json({ fresh: req.fresh });
    });

    const response = await app.handle(buildRequest("/test", {
      headers: { "If-None-Match": '"v1"' },
    }));
    expect(await response.json()).toEqual({ fresh: false });
  });

  test("req.fresh is true via Last-Modified/If-Modified-Since when not modified like Express", async () => {
    const app = bunway();
    const modDate = "Mon, 01 Jan 2024 00:00:00 GMT";
    app.get("/test", (req, res) => {
      res.set("Last-Modified", modDate);
      res.json({ fresh: req.fresh });
    });

    const response = await app.handle(buildRequest("/test", {
      headers: { "If-Modified-Since": modDate },
    }));
    expect(await response.json()).toEqual({ fresh: true });
  });

  test("req.fresh is false via If-Modified-Since when resource was modified after like Express", async () => {
    const app = bunway();
    app.get("/test", (req, res) => {
      res.set("Last-Modified", "Tue, 02 Jan 2024 00:00:00 GMT");
      res.json({ fresh: req.fresh });
    });

    const response = await app.handle(buildRequest("/test", {
      headers: { "If-Modified-Since": "Mon, 01 Jan 2024 00:00:00 GMT" },
    }));
    expect(await response.json()).toEqual({ fresh: false });
  });

  test("req.stale is inverse of req.fresh like Express", async () => {
    const app = bunway();
    app.get("/test", (req, res) => {
      res.set("ETag", '"v2"');
      res.json({ stale: req.stale, fresh: req.fresh });
    });

    const response = await app.handle(buildRequest("/test", {
      headers: { "If-None-Match": '"v1"' },
    }));
    const data = await response.json() as { stale: boolean; fresh: boolean };
    expect(data.stale).toBe(true);
    expect(data.fresh).toBe(false);
  });

  test("req.stale is false when resource is not modified like Express", async () => {
    const app = bunway();
    app.get("/test", (req, res) => {
      res.set("ETag", '"v1"');
      res.json({ stale: req.stale });
    });

    const response = await app.handle(buildRequest("/test", {
      headers: { "If-None-Match": '"v1"' },
    }));
    expect(await response.json()).toEqual({ stale: false });
  });
});
