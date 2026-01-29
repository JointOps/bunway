import { describe, expect, it } from "bun:test";
import bunway, { BunWayApp } from "../../../src";

describe("App Settings", () => {
  describe("set() and get()", () => {
    it("sets and gets a custom setting", () => {
      const app = bunway();
      app.set("custom", "value");
      expect(app.get("custom")).toBe("value");
    });

    it("sets and gets view engine", () => {
      const app = bunway();
      app.set("view engine", "ejs");
      expect(app.get("view engine")).toBe("ejs");
    });

    it("sets and gets views directory", () => {
      const app = bunway();
      app.set("views", "./templates");
      expect(app.get("views")).toBe("./templates");
    });

    it("sets and gets trust proxy", () => {
      const app = bunway();
      app.set("trust proxy", true);
      expect(app.get("trust proxy")).toBe(true);
    });

    it("sets and gets json spaces", () => {
      const app = bunway();
      app.set("json spaces", 2);
      expect(app.get("json spaces")).toBe(2);
    });

    it("returns undefined for unset settings", () => {
      const app = bunway();
      expect(app.get("nonexistent")).toBeUndefined();
    });

    it("chains set calls", () => {
      const app = bunway();
      app.set("a", 1).set("b", 2).set("c", 3);
      expect(app.get("a")).toBe(1);
      expect(app.get("b")).toBe(2);
      expect(app.get("c")).toBe(3);
    });
  });

  describe("enable() and disable()", () => {
    it("enables a setting", () => {
      const app = bunway();
      app.enable("strict routing");
      expect(app.get("strict routing")).toBe(true);
    });

    it("disables a setting", () => {
      const app = bunway();
      app.set("x-powered-by", true);
      app.disable("x-powered-by");
      expect(app.get("x-powered-by")).toBe(false);
    });

    it("chains enable/disable calls", () => {
      const app = bunway();
      app.enable("a").disable("b").enable("c");
      expect(app.get("a")).toBe(true);
      expect(app.get("b")).toBe(false);
      expect(app.get("c")).toBe(true);
    });
  });

  describe("enabled() and disabled()", () => {
    it("returns true for enabled settings", () => {
      const app = bunway();
      app.enable("test");
      expect(app.enabled("test")).toBe(true);
      expect(app.disabled("test")).toBe(false);
    });

    it("returns true for disabled settings", () => {
      const app = bunway();
      app.disable("test");
      expect(app.disabled("test")).toBe(true);
      expect(app.enabled("test")).toBe(false);
    });

    it("treats truthy values as enabled", () => {
      const app = bunway();
      app.set("test", "truthy string");
      expect(app.enabled("test")).toBe(true);
    });

    it("treats falsy values as disabled", () => {
      const app = bunway();
      app.set("test", 0);
      expect(app.disabled("test")).toBe(true);
    });
  });

  describe("default settings", () => {
    it("has default views directory", () => {
      const app = bunway();
      expect(app.get("views")).toBe("./views");
    });

    it("has trust proxy disabled by default", () => {
      const app = bunway();
      expect(app.get("trust proxy")).toBe(false);
    });

    it("has x-powered-by enabled by default", () => {
      const app = bunway();
      expect(app.get("x-powered-by")).toBe(true);
    });

    it("has etag set to weak by default", () => {
      const app = bunway();
      expect(app.get("etag")).toBe("weak");
    });

    it("has env set to development or NODE_ENV", () => {
      const app = bunway();
      const expected = process.env.NODE_ENV || "development";
      expect(app.get("env")).toBe(expected);
    });
  });

  describe("locals", () => {
    it("provides app-level locals object", () => {
      const app = bunway();
      expect(app.locals).toBeDefined();
      expect(typeof app.locals).toBe("object");
    });

    it("allows setting and getting locals", () => {
      const app = bunway();
      app.locals.title = "My App";
      app.locals.version = "1.0.0";
      expect(app.locals.title).toBe("My App");
      expect(app.locals.version).toBe("1.0.0");
    });
  });

  describe("engine()", () => {
    it("registers a template engine", () => {
      const app = bunway();
      const mockEngine = (_path: string, _options: Record<string, unknown>, callback: (err: Error | null, html?: string) => void) => {
        callback(null, "<html></html>");
      };
      app.engine("ejs", mockEngine);
      expect(app.getEngine("ejs")).toBe(mockEngine);
    });

    it("registers engine with or without dot prefix", () => {
      const app = bunway();
      const mockEngine = (_path: string, _options: Record<string, unknown>, callback: (err: Error | null, html?: string) => void) => {
        callback(null, "<html></html>");
      };
      app.engine(".hbs", mockEngine);
      expect(app.getEngine("hbs")).toBe(mockEngine);
      expect(app.getEngine(".hbs")).toBe(mockEngine);
    });
  });

  describe("get() routing vs settings", () => {
    it("works as HTTP GET when handlers are provided", async () => {
      const app = bunway();
      app.get("/test", (_req, res) => {
        res.json({ ok: true });
      });

      const response = await app.handle(new Request("http://localhost/test"));
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ ok: true });
    });

    it("works as setting getter when no handlers", () => {
      const app = bunway();
      app.set("view engine", "pug");
      expect(app.get("view engine")).toBe("pug");
    });
  });

  describe("constructor options", () => {
    it("accepts initial settings via options", () => {
      const app = new BunWayApp({
        settings: {
          "view engine": "ejs",
          "custom": "value",
        },
      });
      expect(app.get("view engine")).toBe("ejs");
      expect(app.get("custom")).toBe("value");
    });
  });
});
