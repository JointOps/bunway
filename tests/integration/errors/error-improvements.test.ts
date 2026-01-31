import { describe, expect, it } from "bun:test";
import bunway from "../../../src";
import { errorHandler } from "../../../src/middleware/error-handler";

describe("error improvements", () => {
  describe("405 Method Not Allowed", () => {
    it("returns 405 when path exists but method doesn't match", async () => {
      const app = bunway();

      app.get("/users", (req, res) => res.json({ users: [] }));
      app.post("/users", (req, res) => res.status(201).json({ id: 1 }));

      const response = await app.handle(
        new Request("http://localhost/users", { method: "DELETE" })
      );

      expect(response.status).toBe(405);

      const body = await response.json();
      expect(body.error).toBe("Method Not Allowed");
      expect(body.allowedMethods).toContain("GET");
      expect(body.allowedMethods).toContain("POST");
      expect(response.headers.get("Allow")).toContain("GET");
    });

    it("returns 404 when path doesn't exist at all", async () => {
      const app = bunway();

      app.get("/users", (req, res) => res.json({ users: [] }));

      const response = await app.handle(
        new Request("http://localhost/nonexistent")
      );

      expect(response.status).toBe(404);

      const body = await response.json();
      expect(body.error).toBe("Not Found");
      expect(body.message).toContain("Cannot GET /nonexistent");
    });
  });

  describe("improved 404 messages", () => {
    it("includes method and path in 404 message", async () => {
      const app = bunway();

      const response = await app.handle(
        new Request("http://localhost/api/v1/unknown", { method: "POST" })
      );

      const body = await response.json();
      expect(body.message).toContain("POST");
      expect(body.message).toContain("/api/v1/unknown");
    });
  });

  describe("errorHandler development mode", () => {
    it("includes stack trace in development mode", async () => {
      const app = bunway();

      app.get("/error", () => {
        throw new Error("Test error");
      });

      app.use(errorHandler({ development: true }));

      const response = await app.handle(new Request("http://localhost/error"));
      const body = await response.json();

      expect(body.error).toBe("Test error");
      expect(body.stack).toBeDefined();
      expect(body.stack).toContain("Test error");
      expect(body.type).toBe("Error");
    });

    it("includes request info in development mode", async () => {
      const app = bunway();

      app.get("/error", () => {
        throw new Error("Test error");
      });

      app.use(errorHandler({ development: true }));

      const response = await app.handle(new Request("http://localhost/error"));
      const body = await response.json();

      expect(body.method).toBe("GET");
      expect(body.path).toBe("/error");
      expect(body.timestamp).toBeDefined();
    });

    it("excludes stack trace in production mode", async () => {
      const app = bunway();

      app.get("/error", () => {
        throw new Error("Test error");
      });

      app.use(errorHandler({ development: false }));

      const response = await app.handle(new Request("http://localhost/error"));
      const body = await response.json();

      expect(body.error).toBe("Test error");
      expect(body.stack).toBeUndefined();
      expect(body.type).toBeUndefined();
    });

    it("showRequestInfo works independently of development mode", async () => {
      const app = bunway();

      app.get("/error", () => {
        throw new Error("Test error");
      });

      app.use(errorHandler({ development: false, showRequestInfo: true }));

      const response = await app.handle(new Request("http://localhost/error"));
      const body = await response.json();

      expect(body.method).toBe("GET");
      expect(body.path).toBe("/error");
      expect(body.stack).toBeUndefined(); // No stack in production
    });
  });

  describe("JSON parsing errors", () => {
    it("provides helpful error for invalid JSON", async () => {
      const app = bunway();

      app.use(bunway.json());
      app.post("/data", (req, res) => res.json({ received: req.body }));

      const response = await app.handle(
        new Request("http://localhost/data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: '{"invalid": json}',
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("Invalid JSON");
    });

    it("handles empty JSON gracefully", async () => {
      const app = bunway();

      app.use(bunway.json());
      app.post("/data", (req, res) => res.json({ received: req.body }));

      const response = await app.handle(
        new Request("http://localhost/data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "",
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.received).toEqual({});
    });
  });

  describe("printRoutes and getRegisteredRoutes", () => {
    it("getRegisteredRoutes returns all routes", () => {
      const app = bunway();

      app.get("/", (req, res) => res.text("home"));
      app.get("/users", (req, res) => res.json([]));
      app.post("/users", (req, res) => res.status(201).json({}));
      app.get("/users/:id", (req, res) => res.json({}));
      app.ws("/chat", { open() {} });

      const routes = app.getRegisteredRoutes();

      expect(routes.length).toBe(5);
      expect(routes.find((r) => r.method === "GET" && r.path === "/")).toBeDefined();
      expect(routes.find((r) => r.method === "POST" && r.path === "/users")).toBeDefined();
      expect(routes.find((r) => r.method === "WS" && r.path === "/chat")).toBeDefined();
    });

    it("getRegisteredRoutes includes sub-router routes", () => {
      const app = bunway();
      const api = new (require("../../../src").Router)();

      api.get("/items", (req: any, res: any) => res.json([]));
      api.post("/items", (req: any, res: any) => res.status(201).json({}));

      app.get("/", (req, res) => res.text("home"));
      app.use("/api", api);

      const routes = app.getRegisteredRoutes();

      expect(routes.find((r) => r.fullPath === "/")).toBeDefined();
      expect(routes.find((r) => r.fullPath === "/api/items" && r.method === "GET")).toBeDefined();
      expect(routes.find((r) => r.fullPath === "/api/items" && r.method === "POST")).toBeDefined();
    });
  });
});
