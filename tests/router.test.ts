import { describe, expect, it } from "bun:test";
import { Router } from "../src";
import { buildRequest } from "./testUtils";

describe("Router", () => {
  describe("HTTP methods", () => {
    it("handles GET requests", async () => {
      const router = new Router();
      router.get("/test", (req, res) => res.json({ method: "GET" }));

      const response = await router.handle(buildRequest("/test"));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ method: "GET" });
    });

    it("handles POST requests", async () => {
      const router = new Router();
      router.post("/test", (req, res) => res.json({ method: "POST" }));

      const response = await router.handle(buildRequest("/test", { method: "POST" }));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ method: "POST" });
    });

    it("handles PUT requests", async () => {
      const router = new Router();
      router.put("/test", (req, res) => res.json({ method: "PUT" }));

      const response = await router.handle(buildRequest("/test", { method: "PUT" }));
      expect(await response.json()).toEqual({ method: "PUT" });
    });

    it("handles DELETE requests", async () => {
      const router = new Router();
      router.delete("/test", (req, res) => res.json({ method: "DELETE" }));

      const response = await router.handle(buildRequest("/test", { method: "DELETE" }));
      expect(await response.json()).toEqual({ method: "DELETE" });
    });

    it("handles PATCH requests", async () => {
      const router = new Router();
      router.patch("/test", (req, res) => res.json({ method: "PATCH" }));

      const response = await router.handle(buildRequest("/test", { method: "PATCH" }));
      expect(await response.json()).toEqual({ method: "PATCH" });
    });

    it("handles HEAD requests", async () => {
      const router = new Router();
      router.head("/test", (req, res) => res.status(200).send(null));

      const response = await router.handle(buildRequest("/test", { method: "HEAD" }));
      expect(response.status).toBe(200);
    });

    it("handles all HTTP methods with .all()", async () => {
      const router = new Router();
      router.all("/test", (req, res) => res.json({ method: req.method }));

      const methods = ["GET", "POST", "PUT", "DELETE", "PATCH"];
      for (const method of methods) {
        const response = await router.handle(buildRequest("/test", { method }));
        expect(await response.json()).toEqual({ method });
      }
    });
  });

  describe("route parameters", () => {
    it("extracts single parameter", async () => {
      const router = new Router();
      router.get("/users/:id", (req, res) => res.json({ id: req.params.id }));

      const response = await router.handle(buildRequest("/users/42"));
      expect(await response.json()).toEqual({ id: "42" });
    });

    it("extracts multiple parameters", async () => {
      const router = new Router();
      router.get("/users/:userId/posts/:postId", (req, res) => {
        res.json({ userId: req.params.userId, postId: req.params.postId });
      });

      const response = await router.handle(buildRequest("/users/1/posts/99"));
      expect(await response.json()).toEqual({ userId: "1", postId: "99" });
    });
  });

  describe("middleware", () => {
    it("executes middleware in order", async () => {
      const router = new Router();
      const order: number[] = [];

      router.use((req, res, next) => {
        order.push(1);
        next();
      });
      router.use((req, res, next) => {
        order.push(2);
        next();
      });
      router.get("/test", (req, res) => {
        order.push(3);
        res.json({ order });
      });

      const response = await router.handle(buildRequest("/test"));
      expect(await response.json()).toEqual({ order: [1, 2, 3] });
    });

    it("stops chain when response is sent", async () => {
      const router = new Router();
      let reachedHandler = false;

      router.use((req, res, next) => {
        res.status(401).json({ error: "Unauthorized" });
      });
      router.get("/test", (req, res) => {
        reachedHandler = true;
        res.json({ ok: true });
      });

      const response = await router.handle(buildRequest("/test"));
      expect(response.status).toBe(401);
      expect(reachedHandler).toBe(false);
    });
  });

  describe("sub-routers", () => {
    it("mounts sub-router at prefix", async () => {
      const main = new Router();
      const api = new Router();

      api.get("/users", (req, res) => res.json({ users: [] }));
      main.use("/api", api);

      const response = await main.handle(buildRequest("/api/users"));
      expect(await response.json()).toEqual({ users: [] });
    });

    it("strips prefix from sub-router pathname", async () => {
      const main = new Router();
      const api = new Router();

      api.get("/", (req, res) => res.json({ path: req.path }));
      main.use("/api/v1", api);

      const response = await main.handle(buildRequest("/api/v1/"));
      expect(await response.json()).toEqual({ path: "/" });
    });
  });

  describe("group()", () => {
    it("groups routes under a prefix", async () => {
      const router = new Router();

      router.group("/api", (api) => {
        api.get("/users", (req, res) => res.json({ users: [] }));
        api.get("/posts", (req, res) => res.json({ posts: [] }));
      });

      const usersRes = await router.handle(buildRequest("/api/users"));
      expect(await usersRes.json()).toEqual({ users: [] });

      const postsRes = await router.handle(buildRequest("/api/posts"));
      expect(await postsRes.json()).toEqual({ posts: [] });
    });

    it("applies middleware to group", async () => {
      const router = new Router();
      let middlewareCalled = false;

      const authMiddleware = (req: any, res: any, next: any) => {
        middlewareCalled = true;
        next();
      };

      router.group("/admin", { middleware: [authMiddleware] }, (admin) => {
        admin.get("/dashboard", (req, res) => res.json({ ok: true }));
      });

      await router.handle(buildRequest("/admin/dashboard"));
      expect(middlewareCalled).toBe(true);
    });
  });
});
