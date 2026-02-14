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
});
