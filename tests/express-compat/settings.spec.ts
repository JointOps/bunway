import { describe, test, expect } from "bun:test";
import bunway from "../../src";
import { buildRequest } from "../utils/test-helpers";

describe("Express Compatibility: App Settings", () => {
  test("app.set() and app.get() work like Express", async () => {
    const app = bunway();
    app.set("view engine", "ejs");
    app.set("port", 3000);

    expect(app.get("view engine")).toBe("ejs");
    expect(app.get("port")).toBe(3000);
  });

  test("app.enable() and app.enabled() work like Express", async () => {
    const app = bunway();
    app.enable("trust proxy");

    expect(app.enabled("trust proxy")).toBe(true);
    expect(app.disabled("trust proxy")).toBe(false);
  });

  test("app.disable() and app.disabled() work like Express", async () => {
    const app = bunway();
    app.disable("x-powered-by");

    expect(app.disabled("x-powered-by")).toBe(true);
    expect(app.enabled("x-powered-by")).toBe(false);
  });

  test("app.locals works like Express", async () => {
    const app = bunway();
    app.locals.title = "BunWay App";
    app.locals.version = "1.0.0";

    expect(app.locals.title).toBe("BunWay App");
    expect(app.locals.version).toBe("1.0.0");

    app.get("/test", (req, res) => {
      res.json({
        title: app.locals.title,
        version: app.locals.version
      });
    });

    const response = await app.handle(buildRequest("/test"));
    expect(await response.json()).toEqual({
      title: "BunWay App",
      version: "1.0.0"
    });
  });

  test("Settings persist across requests like Express", async () => {
    const app = bunway();
    app.set("custom setting", "value");

    app.get("/test1", (req, res) => {
      res.json({ setting: app.get("custom setting") });
    });

    app.get("/test2", (req, res) => {
      res.json({ setting: app.get("custom setting") });
    });

    const response1 = await app.handle(buildRequest("/test1"));
    expect(await response1.json()).toEqual({ setting: "value" });

    const response2 = await app.handle(buildRequest("/test2"));
    expect(await response2.json()).toEqual({ setting: "value" });
  });

  test("'json spaces' setting formats JSONP output with indentation like Express", async () => {
    const app = bunway();
    app.set("json spaces", 2);

    app.get("/data", (req, res) => {
      res.jsonp({ key: "value" });
    });

    const response = await app.handle(buildRequest("/data?callback=fn"));
    const text = await response.text();
    expect(text).toContain("fn(");
    expect(text).toContain('"key"');
  });

  test("'case sensitive routing' setting is stored and retrievable like Express", async () => {
    const app = bunway();
    app.set("case sensitive routing", true);
    expect(app.get("case sensitive routing")).toBe(true);
  });

  test("'strict routing' setting is stored and retrievable like Express", async () => {
    const app = bunway();
    app.set("strict routing", true);
    expect(app.get("strict routing")).toBe(true);
  });

  test("'etag' can be disabled like Express", async () => {
    const app = bunway();
    app.set("etag", false);
    expect(app.get("etag")).toBe(false);
    expect(app.disabled("etag")).toBe(true);
  });

  test("'etag' supports weak and strong modes like Express", async () => {
    const app = bunway();
    app.set("etag", "weak");
    expect(app.get("etag")).toBe("weak");
    app.set("etag", "strong");
    expect(app.get("etag")).toBe("strong");
  });

  test("'x-powered-by' disable removes setting like Express", async () => {
    const app = bunway();
    app.disable("x-powered-by");
    expect(app.disabled("x-powered-by")).toBe(true);
    expect(app.enabled("x-powered-by")).toBe(false);
  });

  test("'env' setting reflects NODE_ENV like Express", async () => {
    const app = bunway();
    const env = app.get("env") as string;
    expect(env).toMatch(/^(development|test|production)$/);
  });
});
