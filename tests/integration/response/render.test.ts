import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import bunway from "../../../src";
import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";

describe("Template Rendering", () => {
  const viewsDir = "./test-views";

  beforeEach(async () => {
    await mkdir(viewsDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(viewsDir, { recursive: true, force: true });
  });

  describe("res.render()", () => {
    it("renders a template with a registered engine", async () => {
      // Create a test template
      await writeFile(join(viewsDir, "hello.txt"), "Hello, <%= name %>!");

      const app = bunway();
      app.set("views", viewsDir);
      app.set("view engine", "txt");

      // Simple template engine that replaces <%= var %>
      app.engine("txt", (path, options, callback) => {
        Bun.file(path)
          .text()
          .then((content) => {
            const rendered = content.replace(/<%= (\w+) %>/g, (_, key) => {
              return String(options[key] ?? "");
            });
            callback(null, rendered);
          })
          .catch(callback);
      });

      app.get("/hello", async (_req, res) => {
        await res.render("hello", { name: "World" });
      });

      const response = await app.handle(new Request("http://localhost/hello"));
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("text/html");

      const body = await response.text();
      expect(body).toBe("Hello, World!");
    });

    it("uses view engine setting for extension", async () => {
      await writeFile(join(viewsDir, "test.ejs"), "<h1><%= title %></h1>");

      const app = bunway();
      app.set("views", viewsDir);
      app.set("view engine", "ejs");

      app.engine("ejs", (path, options, callback) => {
        Bun.file(path)
          .text()
          .then((content) => {
            const rendered = content.replace(/<%= (\w+) %>/g, (_, key) => {
              return String(options[key] ?? "");
            });
            callback(null, rendered);
          })
          .catch(callback);
      });

      app.get("/", async (_req, res) => {
        await res.render("test", { title: "My Page" });
      });

      const response = await app.handle(new Request("http://localhost/"));
      const body = await response.text();
      expect(body).toBe("<h1>My Page</h1>");
    });

    it("merges app.locals and res.locals with options", async () => {
      await writeFile(
        join(viewsDir, "locals.txt"),
        "App: <%= appName %>, Res: <%= resVar %>, Opt: <%= optVar %>"
      );

      const app = bunway();
      app.set("views", viewsDir);
      app.set("view engine", "txt");
      app.locals.appName = "MyApp";

      app.engine("txt", (path, options, callback) => {
        Bun.file(path)
          .text()
          .then((content) => {
            const rendered = content.replace(/<%= (\w+) %>/g, (_, key) => {
              return String(options[key] ?? "");
            });
            callback(null, rendered);
          })
          .catch(callback);
      });

      app.get("/", async (_req, res) => {
        res.locals.resVar = "ResValue";
        await res.render("locals", { optVar: "OptValue" });
      });

      const response = await app.handle(new Request("http://localhost/"));
      const body = await response.text();
      expect(body).toBe("App: MyApp, Res: ResValue, Opt: OptValue");
    });

    it("throws error when no view engine is set and no extension provided", async () => {
      const app = bunway();
      app.set("views", viewsDir);

      app.get("/", async (_req, res) => {
        try {
          await res.render("test");
          res.json({ error: "should have thrown" });
        } catch (err: any) {
          res.status(500).json({ error: err.message });
        }
      });

      const response = await app.handle(new Request("http://localhost/"));
      const data = await response.json();
      expect(data.error).toContain("No view engine");
    });

    it("throws error when engine is not registered", async () => {
      await writeFile(join(viewsDir, "test.unknown"), "content");

      const app = bunway();
      app.set("views", viewsDir);

      app.get("/", async (_req, res) => {
        try {
          await res.render("test.unknown");
          res.json({ error: "should have thrown" });
        } catch (err: any) {
          res.status(500).json({ error: err.message });
        }
      });

      const response = await app.handle(new Request("http://localhost/"));
      const data = await response.json();
      expect(data.error).toContain("No engine registered");
    });

    it("throws error when view file not found", async () => {
      const app = bunway();
      app.set("views", viewsDir);
      app.set("view engine", "txt");
      app.engine("txt", (_path, _options, callback) => {
        callback(null, "content");
      });

      app.get("/", async (_req, res) => {
        try {
          await res.render("nonexistent");
          res.json({ error: "should have thrown" });
        } catch (err: any) {
          res.status(500).json({ error: err.message });
        }
      });

      const response = await app.handle(new Request("http://localhost/"));
      const data = await response.json();
      expect(data.error).toContain("not found");
    });

    it("supports callback API", async () => {
      await writeFile(join(viewsDir, "callback.txt"), "Callback: <%= value %>");

      const app = bunway();
      app.set("views", viewsDir);
      app.set("view engine", "txt");

      app.engine("txt", (path, options, callback) => {
        Bun.file(path)
          .text()
          .then((content) => {
            const rendered = content.replace(/<%= (\w+) %>/g, (_, key) => {
              return String(options[key] ?? "");
            });
            callback(null, rendered);
          })
          .catch(callback);
      });

      app.get("/", async (_req, res) => {
        // Use await to ensure the render completes before handler returns
        await res.render("callback", { value: "Test" }, (_err, html) => {
          // Callback still gets called, but we use the promise for flow control
          if (html) {
            // html is already set by render, this is just for verification
          }
        });
      });

      const response = await app.handle(new Request("http://localhost/"));
      const body = await response.text();
      expect(body).toBe("Callback: Test");
    });

    it("renders with explicit file extension", async () => {
      await writeFile(join(viewsDir, "explicit.html"), "<html><%= content %></html>");

      const app = bunway();
      app.set("views", viewsDir);

      app.engine("html", (path, options, callback) => {
        Bun.file(path)
          .text()
          .then((content) => {
            const rendered = content.replace(/<%= (\w+) %>/g, (_, key) => {
              return String(options[key] ?? "");
            });
            callback(null, rendered);
          })
          .catch(callback);
      });

      app.get("/", async (_req, res) => {
        await res.render("explicit.html", { content: "Hello" });
      });

      const response = await app.handle(new Request("http://localhost/"));
      const body = await response.text();
      expect(body).toBe("<html>Hello</html>");
    });
  });
});
