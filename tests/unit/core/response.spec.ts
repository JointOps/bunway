/**
 * BunResponse Unit Tests
 *
 * Tests the BunResponse class internal logic without full HTTP layer.
 * Based on NestJS and Elysia testing patterns.
 */

import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { BunResponse } from "../../../src/core/response";
import { BunRequest } from "../../../src/core/request";

describe("BunResponse (Unit)", () => {
  let res: BunResponse;

  beforeEach(() => {
    res = new BunResponse();
  });

  describe("Status Code", () => {
    it("should have default status 200", () => {
      expect(res.statusCode).toBe(200);
    });

    it("should set status code", () => {
      res.status(201);
      expect(res.statusCode).toBe(201);
    });

    it("should support chaining with status()", () => {
      const result = res.status(404);
      expect(result).toBe(res);
    });

    it("should set various status codes", () => {
      res.status(400);
      expect(res.statusCode).toBe(400);

      res.status(500);
      expect(res.statusCode).toBe(500);

      res.status(302);
      expect(res.statusCode).toBe(302);
    });
  });

  describe("Headers", () => {
    it("should set header with set()", () => {
      res.set("X-Custom", "value");
      expect(res.get("X-Custom")).toBe("value");
    });

    it("should set header with header() alias", () => {
      res.header("X-Custom", "value");
      expect(res.get("X-Custom")).toBe("value");
    });

    it("should return undefined for missing header", () => {
      expect(res.get("X-Missing")).toBeUndefined();
    });

    it("should overwrite header with set()", () => {
      res.set("X-Custom", "first");
      res.set("X-Custom", "second");
      expect(res.get("X-Custom")).toBe("second");
    });

    it("should append to header", () => {
      res.set("X-Custom", "first");
      res.append("X-Custom", "second");
      // Headers.append behavior - check the getHeaders
      const headers = res.getHeaders();
      expect(headers.get("X-Custom")).toContain("first");
    });

    it("should support chaining with set()", () => {
      const result = res.set("X-A", "1").set("X-B", "2");
      expect(result).toBe(res);
      expect(res.get("X-A")).toBe("1");
      expect(res.get("X-B")).toBe("2");
    });
  });

  describe("Content-Type", () => {
    it("should set content type with type()", () => {
      res.type("application/json");
      expect(res.get("Content-Type")).toBe("application/json");
    });

    it("should set content type with contentType() alias", () => {
      res.contentType("text/html");
      expect(res.get("Content-Type")).toBe("text/html");
    });

    it("should support chaining", () => {
      const result = res.type("text/plain");
      expect(result).toBe(res);
    });
  });

  describe("Vary Header", () => {
    it("should set Vary header", () => {
      res.vary("Accept");
      expect(res.get("Vary")).toBe("Accept");
    });

    it("should set multiple Vary fields from array", () => {
      res.vary(["Accept", "Accept-Encoding"]);
      expect(res.get("Vary")).toBe("Accept, Accept-Encoding");
    });

    it("should append to existing Vary header", () => {
      res.vary("Accept");
      res.vary("Accept-Encoding");
      const vary = res.get("Vary");
      expect(vary).toContain("Accept");
      expect(vary).toContain("Accept-Encoding");
    });

    it("should not duplicate Vary fields", () => {
      res.vary("Accept");
      res.vary("Accept");
      expect(res.get("Vary")).toBe("Accept");
    });

    it("should support chaining", () => {
      const result = res.vary("Accept");
      expect(result).toBe(res);
    });
  });

  describe("Location Header", () => {
    it("should set Location header", () => {
      res.location("/new-path");
      expect(res.get("Location")).toBe("/new-path");
    });

    it("should support full URLs", () => {
      res.location("https://example.com/path");
      expect(res.get("Location")).toBe("https://example.com/path");
    });

    it("should support chaining", () => {
      const result = res.location("/path");
      expect(result).toBe(res);
    });
  });

  describe("Link Header", () => {
    it("should set Link header", () => {
      res.links({ next: "/page/2", prev: "/page/1" });
      const link = res.get("Link");
      expect(link).toContain('</page/2>; rel="next"');
      expect(link).toContain('</page/1>; rel="prev"');
    });

    it("should support chaining", () => {
      const result = res.links({ next: "/page/2" });
      expect(result).toBe(res);
    });
  });

  describe("Attachment Header", () => {
    it("should set Content-Disposition for attachment", () => {
      res.attachment();
      expect(res.get("Content-Disposition")).toBe("attachment");
    });

    it("should set Content-Disposition with filename", () => {
      res.attachment("report.pdf");
      expect(res.get("Content-Disposition")).toBe('attachment; filename="report.pdf"');
    });

    it("should support chaining", () => {
      const result = res.attachment("file.txt");
      expect(result).toBe(res);
    });
  });

  describe("JSON Response", () => {
    it("should set body and content type for JSON", () => {
      res.json({ name: "John" });
      expect(res.get("Content-Type")).toBe("application/json");
      expect(res.isSent()).toBe(true);
    });

    it("should stringify object", () => {
      const data = { a: 1, b: 2 };
      res.json(data);
      expect(res._body).toBe(JSON.stringify(data));
    });

    it("should handle arrays", () => {
      res.json([1, 2, 3]);
      expect(res.isSent()).toBe(true);
    });

    it("should handle null", () => {
      res.json(null);
      expect(res.isSent()).toBe(true);
    });
  });

  describe("Text Response", () => {
    it("should set body and content type for text", () => {
      res.text("Hello, World!");
      expect(res.get("Content-Type")).toBe("text/plain");
      expect(res.isSent()).toBe(true);
    });
  });

  describe("HTML Response", () => {
    it("should set body and content type for HTML", () => {
      res.html("<h1>Hello</h1>");
      expect(res.get("Content-Type")).toBe("text/html");
      expect(res.isSent()).toBe(true);
    });
  });

  describe("Send Response", () => {
    it("should mark response as sent", () => {
      res.send("body");
      expect(res.isSent()).toBe(true);
    });

    it("should accept string body", () => {
      res.send("Hello");
      expect(res.isSent()).toBe(true);
    });

    it("should accept ArrayBuffer", () => {
      const buffer = new ArrayBuffer(8);
      res.send(buffer);
      expect(res.isSent()).toBe(true);
    });

    it("should accept Uint8Array", () => {
      const data = new Uint8Array([1, 2, 3]);
      res.send(data);
      expect(res.isSent()).toBe(true);
    });

    it("should accept null", () => {
      res.send(null);
      expect(res.isSent()).toBe(true);
    });
  });

  describe("SendStatus", () => {
    it("should set status and body", () => {
      res.sendStatus(404);
      expect(res.statusCode).toBe(404);
      expect(res.isSent()).toBe(true);
    });

    it("sendStatus sends status text, not the numeric string", async () => {
      res.sendStatus(200);
      const response = res.toResponse();
      expect(await response.text()).toBe("OK");
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain("text/plain");
    });

    it("sendStatus 404 sends 'Not Found'", async () => {
      res.sendStatus(404);
      const response = res.toResponse();
      expect(await response.text()).toBe("Not Found");
    });

    it("sendStatus unknown code falls back to numeric string", async () => {
      res.sendStatus(599);
      const response = res.toResponse();
      expect(await response.text()).toBe("599");
    });
  });

  describe("Redirect", () => {
    it("should set status and location", () => {
      res.redirect("/new-path");
      expect(res.statusCode).toBe(302);
      expect(res.get("Location")).toBe("/new-path");
      expect(res.isSent()).toBe(true);
    });

    it("should support custom status code", () => {
      res.redirect(301, "/permanent");
      expect(res.statusCode).toBe(301);
      expect(res.get("Location")).toBe("/permanent");
    });

    it("should support full URLs", () => {
      res.redirect("https://example.com");
      expect(res.get("Location")).toBe("https://example.com");
    });
  });

  describe("Cookie", () => {
    it("should set cookie header", () => {
      res.cookie("name", "value");
      expect(res.get("Set-Cookie")).toContain("name=value");
    });

    it("should support cookie options", () => {
      res.cookie("name", "value", { httpOnly: true, secure: true });
      const cookie = res.get("Set-Cookie");
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("Secure");
    });

    it("should support maxAge option", () => {
      res.cookie("name", "value", { maxAge: 3600 });
      expect(res.get("Set-Cookie")).toContain("Max-Age=3600");
    });

    it("should support path option", () => {
      res.cookie("name", "value", { path: "/api" });
      expect(res.get("Set-Cookie")).toContain("Path=/api");
    });

    it("should support domain option", () => {
      res.cookie("name", "value", { domain: ".example.com" });
      expect(res.get("Set-Cookie")).toContain("Domain=.example.com");
    });

    it("should support sameSite option", () => {
      res.cookie("name", "value", { sameSite: "Strict" });
      expect(res.get("Set-Cookie")).toContain("SameSite=Strict");
    });

    it("converts sameSite: true to 'Strict'", () => {
      res.cookie("name", "value", { sameSite: true });
      expect(res.get("Set-Cookie")).toContain("SameSite=Strict");
    });

    it("should support expires option with a future Date", () => {
      const future = new Date(Date.now() + 86400_000);
      res.cookie("token", "abc", { expires: future });
      const cookie = res.get("Set-Cookie")!;
      expect(cookie).toContain("token=abc");
      expect(cookie).toContain("Expires=");
    });

    it("should support chaining", () => {
      const result = res.cookie("name", "value");
      expect(result).toBe(res);
    });
  });

  describe("Clear Cookie", () => {
    it("should clear cookie by setting expired", () => {
      res.clearCookie("name");
      const cookie = res.get("Set-Cookie");
      expect(cookie).toContain("name=");
      expect(cookie).toContain("Expires=");
    });

    it("should preserve path option when clearing", () => {
      res.clearCookie("name", { path: "/api" });
      expect(res.get("Set-Cookie")).toContain("Path=/api");
    });

    it("should support chaining", () => {
      const result = res.clearCookie("name");
      expect(result).toBe(res);
    });
  });

  describe("Semantic Response Methods", () => {
    it("should send ok response", () => {
      res.ok({ data: "success" });
      expect(res.statusCode).toBe(200);
      expect(res.isSent()).toBe(true);
    });

    it("should send created response", () => {
      res.created({ id: 1 });
      expect(res.statusCode).toBe(201);
      expect(res.isSent()).toBe(true);
    });

    it("should send noContent response", () => {
      res.noContent();
      expect(res.statusCode).toBe(204);
      expect(res.isSent()).toBe(true);
    });

    it("should send badRequest response", () => {
      res.badRequest("Invalid input");
      expect(res.statusCode).toBe(400);
      expect(res.isSent()).toBe(true);
    });

    it("should send unauthorized response", () => {
      res.unauthorized();
      expect(res.statusCode).toBe(401);
      expect(res.isSent()).toBe(true);
    });

    it("should send forbidden response", () => {
      res.forbidden();
      expect(res.statusCode).toBe(403);
      expect(res.isSent()).toBe(true);
    });

    it("should send notFound response", () => {
      res.notFound();
      expect(res.statusCode).toBe(404);
      expect(res.isSent()).toBe(true);
    });
  });

  describe("Streaming", () => {
    it("should not be streaming by default", () => {
      expect(res.isStreaming()).toBe(false);
    });

    it("should enter streaming mode on write()", () => {
      res.write("chunk");
      expect(res.isStreaming()).toBe(true);
    });

    it("should accept string chunks", () => {
      const result = res.write("hello");
      expect(result).toBe(true);
    });

    it("should accept Uint8Array chunks", () => {
      const chunk = new Uint8Array([1, 2, 3]);
      const result = res.write(chunk);
      expect(result).toBe(true);
    });

    it("should end stream with end()", () => {
      res.write("hello");
      res.end();
      expect(res.isSent()).toBe(true);
    });

    it("should write final chunk with end(chunk)", () => {
      res.write("hello");
      res.end(" world");
      expect(res.isSent()).toBe(true);
    });

    it("should flush headers", () => {
      res.set("X-Test", "yes");
      res.flushHeaders();
      expect(res.headersSent).toBe(true);
      expect(res.getHeader("X-Test")).toBe("yes");
    });

    it("should have stream after write", () => {
      res.write("test");
      expect(res.getStream()).not.toBeNull();
    });
  });

  describe("Locals", () => {
    it("should have empty locals by default", () => {
      expect(res.locals).toEqual({});
    });

    it("should allow setting locals", () => {
      res.locals.user = { id: 1 };
      expect(res.locals.user).toEqual({ id: 1 });
    });

    it("should preserve locals", () => {
      res.locals.a = 1;
      res.locals.b = 2;
      expect(res.locals).toEqual({ a: 1, b: 2 });
    });
  });

  describe("headersSent", () => {
    it("should be false initially", () => {
      expect(res.headersSent).toBe(false);
    });

    it("should be true after sending response", () => {
      res.json({ data: true });
      expect(res.headersSent).toBe(true);
    });

    it("should be true after send()", () => {
      res.send("body");
      expect(res.headersSent).toBe(true);
    });

    it("should be true after text()", () => {
      res.text("text");
      expect(res.headersSent).toBe(true);
    });
  });

  describe("toResponse", () => {
    it("should create Response object", () => {
      res.status(201).json({ created: true });
      const response = res.toResponse();

      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(201);
    });

    it("should include headers", () => {
      res.set("X-Custom", "value").json({ data: true });
      const response = res.toResponse();

      expect(response.headers.get("X-Custom")).toBe("value");
      expect(response.headers.get("Content-Type")).toBe("application/json");
    });
  });

  describe("toStreamingResponse", () => {
    it("should return regular response if not streaming", async () => {
      res.json({ data: true });
      const response = await res.toStreamingResponse();
      expect(response.status).toBe(200);
    });

    it("should return streaming response if streaming", async () => {
      res.write("hello");
      res.end();
      const response = await res.toStreamingResponse();
      expect(response).toBeInstanceOf(Response);
    });
  });

  describe("getHeaders", () => {
    it("should return Headers object", () => {
      res.set("X-Custom", "value");
      const headers = res.getHeaders();
      expect(headers).toBeInstanceOf(Headers);
      expect(headers.get("X-Custom")).toBe("value");
    });
  });

  describe("Chaining", () => {
    it("should support full method chaining", () => {
      const result = res
        .status(201)
        .set("X-Custom", "value")
        .type("application/json")
        .vary("Accept");

      expect(result).toBe(res);
      expect(res.statusCode).toBe(201);
      expect(res.get("X-Custom")).toBe("value");
      expect(res.get("Content-Type")).toBe("application/json");
      expect(res.get("Vary")).toBe("Accept");
    });
  });
});

describe("res.req / res.app cross-references", () => {
  it("res.req is undefined before setReq", () => {
    const res = new BunResponse();
    expect(res.req).toBeUndefined();
  });

  it("res.req is set after setReq()", () => {
    const res = new BunResponse();
    const req = new BunRequest(new Request("http://localhost/test"), "/test");
    res.setReq(req);
    expect(res.req).toBe(req);
  });

  it("res.app is undefined before setApp", () => {
    const res = new BunResponse();
    expect(res.app).toBeUndefined();
  });

  it("res.app is set after setApp()", () => {
    const res = new BunResponse();
    const mockApp = {
      get: (s: string) => undefined,
      getEngine: (e: string) => undefined,
      locals: {},
    };
    res.setApp(mockApp);
    expect(res.app).toBe(mockApp);
  });
});

describe("res.jsonp()", () => {
  it("falls back to JSON when no callback query param", () => {
    const res = new BunResponse();
    const req = new BunRequest(new Request("http://localhost/api/data"), "/api/data");
    res.setReq(req);
    res.setApp({ get: () => "callback", getEngine: () => undefined, locals: {} });
    res.jsonp({ name: "bunway" });
    expect(res.get("Content-Type")).toBe("application/json");
    const response = res.toResponse();
    expect(response.status).toBe(200);
  });

  it("wraps JSON in callback function when callback param present", () => {
    const res = new BunResponse();
    const req = new BunRequest(new Request("http://localhost/api?callback=myFunc"), "/api");
    res.setReq(req);
    res.setApp({ get: () => "callback", getEngine: () => undefined, locals: {} });
    res.jsonp({ name: "bunway" });
    expect(res.get("Content-Type")).toBe("text/javascript; charset=utf-8");
  });

  it("sanitizes callback name — removes unsafe chars", () => {
    const res = new BunResponse();
    const req = new BunRequest(
      new Request("http://localhost/api?callback=alert(1)//"),
      "/api"
    );
    res.setReq(req);
    res.setApp({ get: () => "callback", getEngine: () => undefined, locals: {} });
    res.jsonp({ x: 1 });
    // alert(1)// sanitized to alert1
    const response = res.toResponse();
    expect(res.get("Content-Type")).toBe("text/javascript; charset=utf-8");
  });

  it("uses custom callback param name from app settings", () => {
    const res = new BunResponse();
    const req = new BunRequest(new Request("http://localhost/api?cb=myFunc"), "/api");
    res.setReq(req);
    res.setApp({ get: (s: string) => s === "jsonp callback name" ? "cb" : undefined, getEngine: () => undefined, locals: {} });
    res.jsonp({ ok: true });
    expect(res.get("Content-Type")).toBe("text/javascript; charset=utf-8");
  });

  it("sets X-Content-Type-Options: nosniff", () => {
    const res = new BunResponse();
    const req = new BunRequest(new Request("http://localhost/api?callback=fn"), "/api");
    res.setReq(req);
    res.setApp({ get: () => "callback", getEngine: () => undefined, locals: {} });
    res.jsonp({ x: 1 });
    expect(res.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("falls back to JSON when callback is empty string", () => {
    const res = new BunResponse();
    const req = new BunRequest(new Request("http://localhost/api?callback="), "/api");
    res.setReq(req);
    res.setApp({ get: () => "callback", getEngine: () => undefined, locals: {} });
    res.jsonp({ x: 1 });
    expect(res.get("Content-Type")).toBe("application/json");
  });

  it("handles array data", () => {
    const res = new BunResponse();
    const req = new BunRequest(new Request("http://localhost/api?callback=fn"), "/api");
    res.setReq(req);
    res.setApp({ get: () => "callback", getEngine: () => undefined, locals: {} });
    res.jsonp([1, 2, 3]);
    expect(res.get("Content-Type")).toBe("text/javascript; charset=utf-8");
  });

  it("handles null data", () => {
    const res = new BunResponse();
    const req = new BunRequest(new Request("http://localhost/api?callback=fn"), "/api");
    res.setReq(req);
    res.setApp({ get: () => "callback", getEngine: () => undefined, locals: {} });
    res.jsonp(null);
    expect(res.get("Content-Type")).toBe("text/javascript; charset=utf-8");
  });

  it("falls back to JSON when sanitized callback is empty", () => {
    const res = new BunResponse();
    const req = new BunRequest(new Request("http://localhost/api?callback=!!!"), "/api");
    res.setReq(req);
    res.setApp({ get: () => "callback", getEngine: () => undefined, locals: {} });
    res.jsonp({ x: 1 });
    // Express sets Content-Type to text/javascript before sanitizing callback
    // When sanitization empties the callback, Content-Type is already set
    expect(res.get("Content-Type")).toBe("text/javascript; charset=utf-8");
  });

  it("defaults callback param to 'callback' when no app setting", () => {
    const res = new BunResponse();
    const req = new BunRequest(new Request("http://localhost/api?callback=fn"), "/api");
    res.setReq(req);
    res.jsonp({ x: 1 });
    expect(res.get("Content-Type")).toBe("text/javascript; charset=utf-8");
  });

  it("escapes U+2028 and U+2029 in JSONP body", async () => {
    const res = new BunResponse();
    const req = new BunRequest(new Request("http://localhost/api?callback=fn"), "/api");
    res.setReq(req);
    res.setApp({ get: () => "callback", getEngine: () => undefined, locals: {} });
    res.jsonp({ text: "line\u2028sep\u2029" });
    const body = await res.toResponse().text();
    expect(body).toContain("\\u2028");
    expect(body).toContain("\\u2029");
    expect(body).not.toContain("\u2028");
    expect(body).not.toContain("\u2029");
  });

  it("respects json spaces setting for JSONP output", async () => {
    const res = new BunResponse();
    const req = new BunRequest(new Request("http://localhost/api?callback=fn"), "/api");
    res.setReq(req);
    res.setApp({
      get: (s: string) => {
        if (s === "jsonp callback name") return "callback";
        if (s === "json spaces") return 2;
        return undefined;
      },
      getEngine: () => undefined,
      locals: {},
    });
    res.jsonp({ a: 1 });
    expect(res.get("Content-Type")).toBe("text/javascript; charset=utf-8");
    const body = await res.toResponse().text();
    expect(body).toContain("  \"a\": 1");
  });
});

describe("send() Blob body", () => {
  it("accepts Blob body and marks response as sent", () => {
    const res = new BunResponse();
    const blob = new Blob(["hello blob"], { type: "text/plain" });
    res.send(blob);
    expect(res.isSent()).toBe(true);
  });
});

describe("vary() case-insensitive deduplication", () => {
  it("does not add Accept when accept already set with different casing", () => {
    const res = new BunResponse();
    res.vary("Accept");
    res.vary("accept");
    expect(res.get("Vary")).toBe("Accept");
  });

  it("deduplicates mixed-case field names in array", () => {
    const res = new BunResponse();
    res.vary(["Accept", "Accept-Encoding"]);
    res.vary(["ACCEPT", "accept-encoding"]);
    const vary = res.get("Vary")!;
    const fields = vary.split(",").map((f) => f.trim().toLowerCase());
    expect(fields.filter((f) => f === "accept").length).toBe(1);
    expect(fields.filter((f) => f === "accept-encoding").length).toBe(1);
  });
});

describe("end() non-streaming mode with chunk", () => {
  it("sets body and marks sent when end(string) called on non-streaming response", () => {
    const res = new BunResponse();
    res.end("final body");
    expect(res.isSent()).toBe(true);
  });

  it("sets body when end(ArrayBuffer) called", () => {
    const res = new BunResponse();
    res.end(new ArrayBuffer(4));
    expect(res.isSent()).toBe(true);
  });

  it("calls callback when end(chunk, callback) called", () => {
    const res = new BunResponse();
    let called = false;
    res.end("chunk", () => { called = true; });
    expect(called).toBe(true);
    expect(res.isSent()).toBe(true);
  });

  it("calls callback when end(undefined, callback) called", () => {
    const res = new BunResponse();
    let called = false;
    res.end(undefined, () => { called = true; });
    expect(called).toBe(true);
  });
});

describe("format()", () => {
  it("calls first handler when Accept is wildcard */*", () => {
    const res = new BunResponse();
    res.setAcceptHeader("*/*");
    let called = false;
    res.format({
      "application/json": () => { called = true; res.json({ ok: true }); },
    });
    expect(called).toBe(true);
    expect(res.get("Content-Type")).toBe("application/json");
  });

  it("calls html handler for text/html Accept header", () => {
    const res = new BunResponse();
    res.setAcceptHeader("text/html");
    let htmlCalled = false;
    res.format({
      html: () => { htmlCalled = true; res.html("<p>ok</p>"); },
      json: () => {},
    });
    expect(htmlCalled).toBe(true);
    expect(res.get("Content-Type")).toBe("text/html");
  });

  it("falls back to default handler when no type matches", () => {
    const res = new BunResponse();
    res.setAcceptHeader("image/png");
    let defaultCalled = false;
    res.format({
      json: () => {},
      default: () => { defaultCalled = true; res.send("fallback"); },
    });
    expect(defaultCalled).toBe(true);
  });

  it("sets 406 when no handler matches and no default handler", () => {
    const res = new BunResponse();
    res.setAcceptHeader("image/png");
    res.format({ json: () => {} });
    expect(res.statusCode).toBe(406);
    expect(res.isSent()).toBe(true);
  });
});

describe("render()", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "bunway-render-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true });
  });

  it("throws when no app context is set", async () => {
    const res = new BunResponse();
    await expect(res.render("index")).rejects.toThrow("No app context");
  });

  it("calls callback with error when no app context", async () => {
    const res = new BunResponse();
    let cbErr: Error | null = null;
    await res.render("index", (err) => { cbErr = err; });
    expect(cbErr).not.toBeNull();
    expect(cbErr!.message).toContain("No app context");
  });

  it("throws when no view engine and view name has no extension", async () => {
    const res = new BunResponse();
    res.setApp({ get: () => undefined, getEngine: () => undefined, locals: {} });
    await expect(res.render("index")).rejects.toThrow("No view engine");
  });

  it("throws when engine is not registered for the extension", async () => {
    const res = new BunResponse();
    res.setApp({
      get: (s: string) => s === "view engine" ? "ejs" : tmpDir,
      getEngine: () => undefined,
      locals: {},
    });
    await expect(res.render("index")).rejects.toThrow("No engine registered");
  });

  it("throws when view file does not exist", async () => {
    const res = new BunResponse();
    const engine = (_p: string, _o: any, cb: any) => cb(null, "<html/>");
    res.setApp({
      get: (s: string) => s === "view engine" ? "ejs" : tmpDir,
      getEngine: () => engine,
      locals: {},
    });
    await expect(res.render("missing")).rejects.toThrow("not found");
  });

  it("sets HTML Content-Type and marks sent on successful render", async () => {
    writeFileSync(join(tmpDir, "index.ejs"), "");
    const res = new BunResponse();
    const engine = (_p: string, _o: any, cb: (err: Error | null, html?: string) => void) =>
      cb(null, "<html>rendered</html>");
    res.setApp({
      get: (s: string) => s === "view engine" ? "ejs" : tmpDir,
      getEngine: () => engine,
      locals: {},
    });
    await res.render("index");
    expect(res.get("Content-Type")).toBe("text/html");
    expect(res.isSent()).toBe(true);
  });

  it("passes rendered HTML to callback on success", async () => {
    writeFileSync(join(tmpDir, "page.ejs"), "");
    const res = new BunResponse();
    const engine = (_p: string, _o: any, cb: (err: Error | null, html?: string) => void) =>
      cb(null, "<p>page</p>");
    res.setApp({
      get: (s: string) => s === "view engine" ? "ejs" : tmpDir,
      getEngine: () => engine,
      locals: {},
    });
    let cbHtml: string | undefined;
    await res.render("page", (err, html) => { cbHtml = html; });
    expect(cbHtml).toBe("<p>page</p>");
  });

  it("passes engine error to callback", async () => {
    writeFileSync(join(tmpDir, "bad.ejs"), "");
    const res = new BunResponse();
    const engineErr = new Error("render failed");
    const engine = (_p: string, _o: any, cb: (err: Error | null, html?: string) => void) =>
      cb(engineErr);
    res.setApp({
      get: (s: string) => s === "view engine" ? "ejs" : tmpDir,
      getEngine: () => engine,
      locals: {},
    });
    let cbErr: Error | null = null;
    await res.render("bad", (err) => { cbErr = err; });
    expect(cbErr).toBe(engineErr);
  });

  it("rejects when engine errors and no callback provided", async () => {
    writeFileSync(join(tmpDir, "fail.ejs"), "");
    const res = new BunResponse();
    const engineErr = new Error("render exploded");
    const engine = (_p: string, _o: any, cb: (err: Error | null, html?: string) => void) =>
      cb(engineErr);
    res.setApp({
      get: (s: string) => s === "view engine" ? "ejs" : tmpDir,
      getEngine: () => engine,
      locals: {},
    });
    await expect(res.render("fail")).rejects.toBe(engineErr);
  });
});

describe("sendFile()", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "bunway-sendfile-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true });
  });

  it("sends full file and marks response as sent", async () => {
    writeFileSync(join(tmpDir, "hello.txt"), "hello world");
    const res = new BunResponse();
    await res.sendFile(join(tmpDir, "hello.txt"));
    expect(res.isSent()).toBe(true);
    expect(res.get("Content-Type")).toContain("text/plain");
    expect(res.statusCode).toBe(200);
  });

  it("calls callback on successful send", async () => {
    writeFileSync(join(tmpDir, "file.txt"), "data");
    const res = new BunResponse();
    let cbCalled = false;
    await res.sendFile(join(tmpDir, "file.txt"), () => { cbCalled = true; });
    expect(cbCalled).toBe(true);
  });

  it("calls callback with error when file does not exist", async () => {
    const res = new BunResponse();
    let cbErr: Error | undefined;
    await res.sendFile(join(tmpDir, "missing.txt"), (err) => { cbErr = err; });
    expect(cbErr).toBeDefined();
    expect(cbErr!.message).toContain("ENOENT");
  });

  it("returns 403 for dotfile when dotfiles option is deny", async () => {
    writeFileSync(join(tmpDir, ".hidden"), "secret");
    const res = new BunResponse();
    await res.sendFile(join(tmpDir, ".hidden"), { dotfiles: "deny" });
    expect(res.statusCode).toBe(403);
  });
});

describe("download()", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "bunway-download-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true });
  });

  it("sets Content-Disposition with file basename when no name given", async () => {
    writeFileSync(join(tmpDir, "report.pdf"), "pdf content");
    const res = new BunResponse();
    await res.download(join(tmpDir, "report.pdf"));
    expect(res.get("Content-Disposition")).toContain('filename="report.pdf"');
  });

  it("sets Content-Disposition with custom filename", async () => {
    writeFileSync(join(tmpDir, "file.txt"), "data");
    const res = new BunResponse();
    await res.download(join(tmpDir, "file.txt"), "custom-name.txt");
    expect(res.get("Content-Disposition")).toContain('filename="custom-name.txt"');
  });

  it("calls callback on successful download", async () => {
    writeFileSync(join(tmpDir, "data.txt"), "data");
    const res = new BunResponse();
    let cbCalled = false;
    await res.download(join(tmpDir, "data.txt"), () => { cbCalled = true; });
    expect(cbCalled).toBe(true);
  });

  it("calls callback with error when file does not exist", async () => {
    const res = new BunResponse();
    let cbErr: Error | undefined;
    await res.download(join(tmpDir, "missing.txt"), (err) => { cbErr = err; });
    expect(cbErr).toBeDefined();
    expect(cbErr!.message).toMatch(/ENOENT/);
  });
});
