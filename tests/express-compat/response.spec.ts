import { describe, test, expect } from "bun:test";
import bunway from "../../src";
import { buildRequest } from "../utils/testUtils";

describe("Express Compatibility: Response Object", () => {
  test("res.status() works like Express", async () => {
    const app = bunway();
    app.get("/test", (req, res) => {
      res.status(201).json({ ok: true });
    });

    const response = await app.handle(buildRequest("/test"));
    expect(response.status).toBe(201);
  });

  test("res.json() works like Express", async () => {
    const app = bunway();
    app.get("/test", (req, res) => {
      res.json({ name: "bunway", version: "1.0.0" });
    });

    const response = await app.handle(buildRequest("/test"));
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(await response.json()).toEqual({
      name: "bunway",
      version: "1.0.0"
    });
  });

  test("res.send() works like Express", async () => {
    const app = bunway();
    app.get("/test", (req, res) => {
      res.send("Hello World");
    });

    const response = await app.handle(buildRequest("/test"));
    expect(await response.text()).toBe("Hello World");
  });

  test("res.text() works like Express", async () => {
    const app = bunway();
    app.get("/test", (req, res) => {
      res.text("Plain text response");
    });

    const response = await app.handle(buildRequest("/test"));
    expect(response.headers.get("Content-Type")).toBe("text/plain");
    expect(await response.text()).toBe("Plain text response");
  });

  test("res.html() works like Express", async () => {
    const app = bunway();
    app.get("/test", (req, res) => {
      res.html("<h1>Hello</h1>");
    });

    const response = await app.handle(buildRequest("/test"));
    expect(response.headers.get("Content-Type")).toBe("text/html");
    expect(await response.text()).toBe("<h1>Hello</h1>");
  });

  test("res.set() works like Express", async () => {
    const app = bunway();
    app.get("/test", (req, res) => {
      res.set("X-Custom-Header", "test-value");
      res.json({ ok: true });
    });

    const response = await app.handle(buildRequest("/test"));
    expect(response.headers.get("X-Custom-Header")).toBe("test-value");
  });

  test("res.header() alias works like Express", async () => {
    const app = bunway();
    app.get("/test", (req, res) => {
      res.header("X-Test", "value");
      res.json({ ok: true });
    });

    const response = await app.handle(buildRequest("/test"));
    expect(response.headers.get("X-Test")).toBe("value");
  });

  test("res.get() works like Express", async () => {
    const app = bunway();
    app.get("/test", (req, res) => {
      res.set("X-Custom", "value");
      const value = res.get("X-Custom");
      res.json({ value });
    });

    const response = await app.handle(buildRequest("/test"));
    expect(await response.json()).toEqual({ value: "value" });
  });

  test("res.type() works like Express", async () => {
    const app = bunway();
    app.get("/test", (req, res) => {
      res.type("application/xml");
      res.send("<root></root>");
    });

    const response = await app.handle(buildRequest("/test"));
    expect(response.headers.get("Content-Type")).toBe("application/xml");
  });

  test("res.redirect() works like Express", async () => {
    const app = bunway();
    app.get("/old", (req, res) => {
      res.redirect("/new");
    });

    const response = await app.handle(buildRequest("/old"));
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/new");
  });

  test("res.redirect() with status works like Express", async () => {
    const app = bunway();
    app.get("/old", (req, res) => {
      res.redirect(301, "/new");
    });

    const response = await app.handle(buildRequest("/old"));
    expect(response.status).toBe(301);
    expect(response.headers.get("Location")).toBe("/new");
  });

  test("res.location() works like Express", async () => {
    const app = bunway();
    app.get("/test", (req, res) => {
      res.location("/somewhere");
      res.json({ ok: true });
    });

    const response = await app.handle(buildRequest("/test"));
    expect(response.headers.get("Location")).toBe("/somewhere");
  });

  test("res.cookie() works like Express", async () => {
    const app = bunway();
    app.get("/test", (req, res) => {
      res.cookie("session", "abc123", { maxAge: 3600 });
      res.json({ ok: true });
    });

    const response = await app.handle(buildRequest("/test"));
    const setCookie = response.headers.get("Set-Cookie");
    expect(setCookie).toContain("session=abc123");
    expect(setCookie).toContain("Max-Age=3600");
  });

  test("res.clearCookie() works like Express", async () => {
    const app = bunway();
    app.get("/test", (req, res) => {
      res.clearCookie("session");
      res.json({ ok: true });
    });

    const response = await app.handle(buildRequest("/test"));
    const setCookie = response.headers.get("Set-Cookie");
    expect(setCookie).toContain("session=");
    expect(setCookie).toContain("Expires=Thu, 01 Jan 1970");
  });

  test("res.sendStatus() works like Express", async () => {
    const app = bunway();
    app.get("/test", (req, res) => {
      res.sendStatus(404);
    });

    const response = await app.handle(buildRequest("/test"));
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not Found");
  });

  test("res.format() works like Express", async () => {
    const app = bunway();
    app.get("/test", (req, res) => {
      res.format({
        "text/html": () => res.html("<h1>HTML</h1>"),
        "application/json": () => res.json({ type: "json" }),
        "default": () => res.text("default")
      });
    });

    const response1 = await app.handle(buildRequest("/test", {
      headers: { "Accept": "application/json" }
    }));
    expect(await response1.json()).toEqual({ type: "json" });

    const response2 = await app.handle(buildRequest("/test", {
      headers: { "Accept": "text/html" }
    }));
    expect(await response2.text()).toBe("<h1>HTML</h1>");
  });

  test("res.vary() works like Express", async () => {
    const app = bunway();
    app.get("/test", (req, res) => {
      res.vary("Accept-Encoding");
      res.json({ ok: true });
    });

    const response = await app.handle(buildRequest("/test"));
    expect(response.headers.get("Vary")).toBe("Accept-Encoding");
  });

  test("res.links() works like Express", async () => {
    const app = bunway();
    app.get("/test", (req, res) => {
      res.links({
        next: "/page/2",
        prev: "/page/1"
      });
      res.json({ ok: true });
    });

    const response = await app.handle(buildRequest("/test"));
    const link = response.headers.get("Link");
    expect(link).toContain('</page/2>; rel="next"');
    expect(link).toContain('</page/1>; rel="prev"');
  });

  test("res.attachment() works like Express", async () => {
    const app = bunway();
    app.get("/test", (req, res) => {
      res.attachment("file.pdf");
      res.send("content");
    });

    const response = await app.handle(buildRequest("/test"));
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="file.pdf"');
  });

  test("res.locals works like Express", async () => {
    const app = bunway();

    app.use((req, res, next) => {
      res.locals.user = { id: 1 };
      next();
    });

    app.get("/test", (req, res) => {
      res.json({ user: res.locals.user });
    });

    const response = await app.handle(buildRequest("/test"));
    expect(await response.json()).toEqual({ user: { id: 1 } });
  });

  test("res.append() adds to existing header like Express", async () => {
    const app = bunway();
    app.get("/test", (req, res) => {
      res.append("X-Custom", "first");
      res.append("X-Custom", "second");
      res.json({ ok: true });
    });

    const response = await app.handle(buildRequest("/test"));
    const header = response.headers.get("X-Custom");
    expect(header).toContain("first");
    expect(header).toContain("second");
  });

  test("res.end() terminates response like Express", async () => {
    const app = bunway();
    app.get("/test", (req, res) => {
      res.status(204).end();
    });

    const response = await app.handle(buildRequest("/test"));
    expect(response.status).toBe(204);
  });

  test("res.write() and res.end() enable streaming like Express", async () => {
    const app = bunway();
    app.get("/stream", (req, res) => {
      res.set("Content-Type", "text/plain");
      res.write("Hello ");
      res.write("World");
      res.end("!");
    });

    const response = await app.handle(buildRequest("/stream"));
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain("Hello");
    expect(text).toContain("World");
  });

  test("res.sendFile() serves a file like Express", async () => {
    const app = bunway();
    app.get("/file", async (req, res) => {
      await res.sendFile("tests/express-compat/fixtures/public/test.txt", { root: process.cwd() });
    });

    const response = await app.handle(buildRequest("/file"));
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain("Test");
  });

  test("res.sendFile() calls callback on success like Express", async () => {
    const app = bunway();
    let callbackCalled = false;
    app.get("/file", async (req, res) => {
      await res.sendFile("tests/express-compat/fixtures/public/test.txt", { root: process.cwd() }, (err) => {
        if (!err) callbackCalled = true;
      });
    });

    const response = await app.handle(buildRequest("/file"));
    expect(response.status).toBe(200);
    expect(callbackCalled).toBe(true);
  });

  test("res.download() sets Content-Disposition like Express", async () => {
    const app = bunway();
    app.get("/download", async (req, res) => {
      await res.download("tests/express-compat/fixtures/public/test.txt", "myfile.txt", { root: process.cwd() });
    });

    const response = await app.handle(buildRequest("/download"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="myfile.txt"');
  });

  test("res.download() uses filename from path when no name given like Express", async () => {
    const app = bunway();
    app.get("/download", async (req, res) => {
      await res.download("tests/express-compat/fixtures/public/test.txt", { root: process.cwd() });
    });

    const response = await app.handle(buildRequest("/download"));
    expect(response.headers.get("Content-Disposition")).toContain("test.txt");
  });

  test("res.render() calls view engine and sends HTML like Express", async () => {
    const app = bunway();
    app.engine("html", (path, options, callback) => {
      callback(null, `<h1>Rendered: ${(options as any).title}</h1>`);
    });
    app.set("view engine", "html");
    app.set("views", "tests/express-compat/fixtures/public");

    app.get("/page", (req, res) => {
      res.render("index", { title: "Test" });
    });

    const response = await app.handle(buildRequest("/page"));
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain("Rendered: Test");
  });

  test("res.jsonp() sends JSONP response like Express", async () => {
    const app = bunway();
    app.get("/data", (req, res) => {
      res.jsonp({ value: 42 });
    });

    const response = await app.handle(buildRequest("/data?callback=myFn"));
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain("myFn");
    expect(text).toContain("42");
  });

  test("res.jsonp() sends JSON without callback like Express", async () => {
    const app = bunway();
    app.get("/data", (req, res) => {
      res.jsonp({ value: 42 });
    });

    const response = await app.handle(buildRequest("/data"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ value: 42 });
  });
});
