import { describe, expect, it } from "bun:test";
import { BunResponse } from "../../../src";

describe("BunResponse", () => {
  describe("status", () => {
    it("sets status code", () => {
      const res = new BunResponse();
      res.status(201);
      expect(res.statusCode).toBe(201);
    });

    it("is chainable", () => {
      const res = new BunResponse();
      expect(res.status(404)).toBe(res);
    });
  });

  describe("headers", () => {
    it("sets headers with set()", () => {
      const res = new BunResponse();
      res.set("X-Custom", "value");
      expect(res.get("X-Custom")).toBe("value");
    });

    it("sets headers with header()", () => {
      const res = new BunResponse();
      res.header("X-Custom", "value");
      expect(res.get("X-Custom")).toBe("value");
    });

    it("appends headers", () => {
      const res = new BunResponse();
      res.append("Set-Cookie", "a=1");
      res.append("Set-Cookie", "b=2");
      const response = res.status(200).toResponse();
      expect(response.headers.getSetCookie()).toEqual(["a=1", "b=2"]);
    });

    it("sets content type with type()", () => {
      const res = new BunResponse();
      res.type("text/html");
      expect(res.get("Content-Type")).toBe("text/html");
    });
  });

  describe("json()", () => {
    it("sends JSON response", () => {
      const res = new BunResponse();
      res.json({ name: "John" });
      expect(res.isSent()).toBe(true);
      expect(res.get("Content-Type")).toBe("application/json");
    });
  });

  describe("text()", () => {
    it("sends text response", () => {
      const res = new BunResponse();
      res.text("Hello");
      expect(res.isSent()).toBe(true);
      expect(res.get("Content-Type")).toBe("text/plain");
    });
  });

  describe("html()", () => {
    it("sends HTML response", () => {
      const res = new BunResponse();
      res.html("<h1>Hello</h1>");
      expect(res.isSent()).toBe(true);
      expect(res.get("Content-Type")).toBe("text/html");
    });
  });

  describe("redirect()", () => {
    it("redirects with default 302", () => {
      const res = new BunResponse();
      res.redirect("/new-page");
      expect(res.statusCode).toBe(302);
      expect(res.get("Location")).toBe("/new-page");
      expect(res.isSent()).toBe(true);
    });

    it("redirects with custom status", () => {
      const res = new BunResponse();
      res.redirect(301, "/permanent");
      expect(res.statusCode).toBe(301);
      expect(res.get("Location")).toBe("/permanent");
    });
  });

  describe("sendStatus()", () => {
    it("sends status with default body", () => {
      const res = new BunResponse();
      res.sendStatus(404);
      expect(res.statusCode).toBe(404);
      expect(res.isSent()).toBe(true);
    });
  });

  describe("convenience methods", () => {
    it("ok() sends 200", () => {
      const res = new BunResponse();
      res.ok({ success: true });
      expect(res.statusCode).toBe(200);
      expect(res.isSent()).toBe(true);
    });

    it("created() sends 201", () => {
      const res = new BunResponse();
      res.created({ id: 1 });
      expect(res.statusCode).toBe(201);
    });

    it("noContent() sends 204", () => {
      const res = new BunResponse();
      res.noContent();
      expect(res.statusCode).toBe(204);
    });

    it("badRequest() sends 400", () => {
      const res = new BunResponse();
      res.badRequest("Invalid input");
      expect(res.statusCode).toBe(400);
    });

    it("unauthorized() sends 401", () => {
      const res = new BunResponse();
      res.unauthorized();
      expect(res.statusCode).toBe(401);
    });

    it("forbidden() sends 403", () => {
      const res = new BunResponse();
      res.forbidden();
      expect(res.statusCode).toBe(403);
    });

    it("notFound() sends 404", () => {
      const res = new BunResponse();
      res.notFound();
      expect(res.statusCode).toBe(404);
    });
  });

  describe("cookies", () => {
    it("sets cookie", () => {
      const res = new BunResponse();
      res.cookie("session", "abc123");
      const response = res.toResponse();
      expect(response.headers.getSetCookie()[0]).toContain("session=abc123");
    });

    it("sets cookie with options", () => {
      const res = new BunResponse();
      res.cookie("token", "xyz", {
        httpOnly: true,
        secure: true,
        maxAge: 3600,
        path: "/",
        sameSite: "strict",
      });
      const cookie = res.toResponse().headers.getSetCookie()[0];
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("Secure");
      expect(cookie).toContain("Max-Age=3600");
      expect(cookie).toContain("Path=/");
      expect(cookie).toContain("SameSite=Strict");
    });

    it("clears cookie", () => {
      const res = new BunResponse();
      res.clearCookie("session");
      const cookie = res.toResponse().headers.getSetCookie()[0];
      expect(cookie).toContain("session=");
      expect(cookie).toContain("Expires=Thu, 01 Jan 1970");
    });
  });

  describe("toResponse()", () => {
    it("creates a Response object", async () => {
      const res = new BunResponse();
      res.status(201).json({ created: true });
      const response = res.toResponse();
      expect(response.status).toBe(201);
      expect(await response.json()).toEqual({ created: true });
    });
  });

  describe("locals", () => {
    it("provides per-response storage", () => {
      const res = new BunResponse();
      res.locals.data = { count: 5 };
      expect(res.locals.data).toEqual({ count: 5 });
    });
  });
});
