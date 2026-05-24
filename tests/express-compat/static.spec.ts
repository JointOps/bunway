import { describe, test, expect } from "bun:test";
import bunway, { Router } from "../../src";
import { buildRequest } from "../utils/testUtils";

describe("Express Compatibility: Static File Serving", () => {
  test("bunway.static() serves files like express.static()", async () => {
    const app = bunway();
    app.use(bunway.static("tests/express-compat/fixtures/public"));
    app.get("/test", (req, res) => res.json({ fallthrough: true }));

    const response = await app.handle(buildRequest("/index.html"));
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain("Test HTML");
  });

  test("Static middleware serves with correct Content-Type like Express", async () => {
    const app = bunway();
    app.use(bunway.static("tests/express-compat/fixtures/public"));

    const response = await app.handle(buildRequest("/index.html"));
    expect(response.headers.get("Content-Type")).toContain("text/html");
  });

  test("Static middleware returns 404 for missing files like Express", async () => {
    const app = bunway();
    app.use(bunway.static("tests/express-compat/fixtures/public"));
    app.get("/.*", (req, res) => res.status(404).json({ error: "Not Found" }));

    const response = await app.handle(buildRequest("/does-not-exist.html"));
    expect(response.status).toBe(404);
  });

  test("Static middleware with mount path works like Express", async () => {
    const app = bunway();
    const router = new Router();
    router.use(bunway.static("tests/express-compat/fixtures/public"));
    app.use("/assets", router);

    const response = await app.handle(buildRequest("/assets/test.txt"));
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain("Test");
  });

  test("Static middleware falls through to next handler like Express", async () => {
    const app = bunway();
    app.use(bunway.static("tests/express-compat/fixtures/public"));
    app.get("/api/*", (req, res) => res.json({ api: true }));

    const response = await app.handle(buildRequest("/api/test"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ api: true });
  });

  test("Static middleware sends ETag header like Express", async () => {
    const app = bunway();
    app.use(bunway.static("tests/express-compat/fixtures/public"));

    const response = await app.handle(buildRequest("/test.txt"));
    expect(response.status).toBe(200);
    expect(response.headers.get("ETag")).toBeTruthy();
  });

  test("Static middleware returns 304 for matching ETag (If-None-Match) like Express", async () => {
    const app = bunway();
    app.use(bunway.static("tests/express-compat/fixtures/public"));

    const first = await app.handle(buildRequest("/test.txt"));
    const etag = first.headers.get("ETag")!;
    expect(etag).toBeTruthy();

    const second = await app.handle(buildRequest("/test.txt", {
      headers: { "If-None-Match": etag }
    }));
    expect(second.status).toBe(304);
  });

  test("Static middleware sends Cache-Control header like Express", async () => {
    const app = bunway();
    app.use(bunway.static("tests/express-compat/fixtures/public", { maxAge: 3600 }));

    const response = await app.handle(buildRequest("/test.txt"));
    expect(response.status).toBe(200);
    const cc = response.headers.get("Cache-Control");
    expect(cc).toContain("max-age=3600");
  });

  test("Static middleware sends Last-Modified header like Express", async () => {
    const app = bunway();
    app.use(bunway.static("tests/express-compat/fixtures/public"));

    const response = await app.handle(buildRequest("/test.txt"));
    expect(response.headers.get("Last-Modified")).toBeTruthy();
  });

  test("Static middleware returns 304 for If-Modified-Since when file is unmodified", async () => {
    const app = bunway();
    app.use(bunway.static("tests/express-compat/fixtures/public"));

    const first = await app.handle(buildRequest("/test.txt"));
    const lastModified = first.headers.get("Last-Modified")!;
    expect(lastModified).toBeTruthy();

    const future = new Date(Date.parse(lastModified) + 60_000).toUTCString();
    const second = await app.handle(buildRequest("/test.txt", {
      headers: { "If-Modified-Since": future }
    }));
    expect(second.status).toBe(304);
  });

  test("Static middleware serves MIME type for .txt files like Express", async () => {
    const app = bunway();
    app.use(bunway.static("tests/express-compat/fixtures/public"));

    const response = await app.handle(buildRequest("/test.txt"));
    expect(response.headers.get("Content-Type")).toContain("text/plain");
  });

  test("Static middleware denies dotfiles when dotfiles='deny' like Express", async () => {
    const app = bunway();
    app.use(bunway.static("tests/express-compat/fixtures/public", { dotfiles: "deny" }));

    const response = await app.handle(buildRequest("/.hidden"));
    expect(response.status).toBe(403);
  });

  test("Static middleware ignores dotfiles when dotfiles='ignore' like Express", async () => {
    const app = bunway();
    app.use(bunway.static("tests/express-compat/fixtures/public", { dotfiles: "ignore" }));
    app.get("/.hidden", (req, res) => res.status(404).json({ fallthrough: true }));

    const response = await app.handle(buildRequest("/.hidden"));
    expect(response.status).toBe(404);
  });

  test("Static middleware serves dotfiles when dotfiles='allow' like Express", async () => {
    const app = bunway();
    app.use(bunway.static("tests/express-compat/fixtures/public", { dotfiles: "allow" }));

    const response = await app.handle(buildRequest("/.hidden"));
    expect(response.status).toBe(200);
  });

  test("Static middleware serves index.html for directory like Express", async () => {
    const app = bunway();
    app.use(bunway.static("tests/express-compat/fixtures/public"));

    const response = await app.handle(buildRequest("/"));
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain("Test HTML");
  });

  test("Static middleware with index:false does not serve directory index like Express", async () => {
    const app = bunway();
    app.use(bunway.static("tests/express-compat/fixtures/public", { index: false }));
    app.get("/", (req, res) => res.json({ fallthrough: true }));

    const response = await app.handle(buildRequest("/"));
    expect(await response.json()).toEqual({ fallthrough: true });
  });
});
