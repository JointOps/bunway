import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import bunway, { serveStatic } from "../src";
import { buildRequest } from "./testUtils";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";

const TEST_DIR = join(process.cwd(), "test-static");

beforeAll(() => {
  mkdirSync(TEST_DIR, { recursive: true });
  writeFileSync(join(TEST_DIR, "index.html"), "<html><body>Hello</body></html>");
  writeFileSync(join(TEST_DIR, "style.css"), "body { color: red; }");
  writeFileSync(join(TEST_DIR, "app.js"), "console.log('hello');");
  writeFileSync(join(TEST_DIR, "data.json"), '{"test": true}');
  writeFileSync(join(TEST_DIR, ".hidden"), "secret");
  mkdirSync(join(TEST_DIR, "subdir"), { recursive: true });
  writeFileSync(join(TEST_DIR, "subdir", "nested.txt"), "nested content");
});

afterAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("serveStatic middleware", () => {
  it("serves static files", async () => {
    const app = bunway();
    app.use(serveStatic(TEST_DIR));

    const response = await app.handle(buildRequest("/style.css"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/css");
    expect(await response.text()).toBe("body { color: red; }");
  });

  it("serves index.html by default", async () => {
    const app = bunway();
    app.use(serveStatic(TEST_DIR));

    const response = await app.handle(buildRequest("/"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/html");
    expect(await response.text()).toContain("Hello");
  });

  it("sets correct MIME types", async () => {
    const app = bunway();
    app.use(serveStatic(TEST_DIR));

    const jsResponse = await app.handle(buildRequest("/app.js"));
    expect(jsResponse.headers.get("Content-Type")).toContain("application/javascript");

    const jsonResponse = await app.handle(buildRequest("/data.json"));
    expect(jsonResponse.headers.get("Content-Type")).toContain("application/json");
  });

  it("returns 404 for non-existent files", async () => {
    const app = bunway();
    app.use(serveStatic(TEST_DIR, { fallthrough: false }));

    const response = await app.handle(buildRequest("/nonexistent.txt"));

    expect(response.status).toBe(404);
  });

  it("falls through when file not found (default)", async () => {
    const app = bunway();
    app.use(serveStatic(TEST_DIR));
    app.get("/nonexistent.txt", (req, res) => res.text("fallback"));

    const response = await app.handle(buildRequest("/nonexistent.txt"));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("fallback");
  });

  it("ignores dotfiles by default", async () => {
    const app = bunway();
    app.use(serveStatic(TEST_DIR, { fallthrough: false }));

    const response = await app.handle(buildRequest("/.hidden"));

    expect(response.status).toBe(404);
  });

  it("denies dotfiles when configured", async () => {
    const app = bunway();
    app.use(serveStatic(TEST_DIR, { dotfiles: "deny" }));

    const response = await app.handle(buildRequest("/.hidden"));

    expect(response.status).toBe(403);
  });

  it("allows dotfiles when configured", async () => {
    const app = bunway();
    app.use(serveStatic(TEST_DIR, { dotfiles: "allow" }));

    const response = await app.handle(buildRequest("/.hidden"));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("secret");
  });

  it("serves nested files", async () => {
    const app = bunway();
    app.use(serveStatic(TEST_DIR));

    const response = await app.handle(buildRequest("/subdir/nested.txt"));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("nested content");
  });

  it("sets Cache-Control header", async () => {
    const app = bunway();
    app.use(serveStatic(TEST_DIR, { maxAge: 3600 }));

    const response = await app.handle(buildRequest("/style.css"));

    expect(response.headers.get("Cache-Control")).toBe("max-age=3600");
  });

  it("sets immutable Cache-Control when configured", async () => {
    const app = bunway();
    app.use(serveStatic(TEST_DIR, { maxAge: 31536000, immutable: true }));

    const response = await app.handle(buildRequest("/style.css"));

    expect(response.headers.get("Cache-Control")).toBe("max-age=31536000, immutable");
  });

  it("sets ETag header", async () => {
    const app = bunway();
    app.use(serveStatic(TEST_DIR));

    const response = await app.handle(buildRequest("/style.css"));

    expect(response.headers.get("ETag")).toBeDefined();
    expect(response.headers.get("ETag")).toMatch(/^W\/"[a-f0-9]+-[a-f0-9]+"$/);
  });

  it("returns 304 for matching ETag", async () => {
    const app = bunway();
    app.use(serveStatic(TEST_DIR));

    const firstResponse = await app.handle(buildRequest("/style.css"));
    const etag = firstResponse.headers.get("ETag");

    const secondResponse = await app.handle(
      buildRequest("/style.css", {
        headers: { "If-None-Match": etag! },
      })
    );

    expect(secondResponse.status).toBe(304);
  });

  it("sets Last-Modified header", async () => {
    const app = bunway();
    app.use(serveStatic(TEST_DIR));

    const response = await app.handle(buildRequest("/style.css"));

    expect(response.headers.get("Last-Modified")).toBeDefined();
  });

  it("handles HEAD requests", async () => {
    const app = bunway();
    app.use(serveStatic(TEST_DIR));

    const response = await app.handle(
      buildRequest("/style.css", { method: "HEAD" })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/css");
    expect(await response.text()).toBe("");
  });

  it("blocks directory traversal", async () => {
    const app = bunway();
    app.use(serveStatic(TEST_DIR, { fallthrough: false }));

    const response = await app.handle(buildRequest("/../package.json"));

    expect(response.status).toBe(404);
  });

  it("only allows GET and HEAD methods", async () => {
    const app = bunway();
    app.use(serveStatic(TEST_DIR, { fallthrough: false }));

    const response = await app.handle(
      buildRequest("/style.css", { method: "POST" })
    );

    expect(response.status).toBe(405);
  });
});
