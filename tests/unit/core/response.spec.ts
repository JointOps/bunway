/**
 * BunResponse Unit Tests
 *
 * Tests the BunResponse class internal logic without full HTTP layer.
 * Based on NestJS and Elysia testing patterns.
 */

import { describe, expect, it, beforeEach } from "bun:test";
import { BunResponse } from "../../../src/core/response";

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
      res.json({ a: 1, b: 2 });
      const response = res.toResponse();
      // Body should be JSON string
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

    it("should set body to status code string", () => {
      res.sendStatus(200);
      // Body should be "200"
      expect(res.isSent()).toBe(true);
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
      res.flushHeaders();
      // Just verify it doesn't throw
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
