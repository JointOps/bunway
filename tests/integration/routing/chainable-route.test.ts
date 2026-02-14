import { describe, expect, it } from "bun:test";
import bunway, { Router } from "../../../src";
import { buildRequest } from "../../utils/testUtils";

describe("Chainable Routes", () => {
  describe("Basic chaining", () => {
    it("registers GET route via app.route().get()", async () => {
      const app = bunway();
      app.route("/users").get((req, res) => res.json({ method: "GET" }));

      const response = await app.handle(buildRequest("/users"));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ method: "GET" });
    });

    it("chains multiple HTTP methods on same path", async () => {
      const app = bunway();
      app
        .route("/users")
        .get((req, res) => res.json({ method: "GET" }))
        .post((req, res) => res.json({ method: "POST" }))
        .put((req, res) => res.json({ method: "PUT" }))
        .delete((req, res) => res.json({ method: "DELETE" }));

      const getRes = await app.handle(buildRequest("/users", { method: "GET" }));
      expect(await getRes.json()).toEqual({ method: "GET" });

      const postRes = await app.handle(buildRequest("/users", { method: "POST" }));
      expect(await postRes.json()).toEqual({ method: "POST" });

      const putRes = await app.handle(buildRequest("/users", { method: "PUT" }));
      expect(await putRes.json()).toEqual({ method: "PUT" });

      const deleteRes = await app.handle(buildRequest("/users", { method: "DELETE" }));
      expect(await deleteRes.json()).toEqual({ method: "DELETE" });
    });

    it("supports .all() for any HTTP method", async () => {
      const app = bunway();
      app.route("/health").all((req, res) => res.json({ status: "ok" }));

      const getRes = await app.handle(buildRequest("/health", { method: "GET" }));
      expect(await getRes.json()).toEqual({ status: "ok" });

      const postRes = await app.handle(buildRequest("/health", { method: "POST" }));
      expect(await postRes.json()).toEqual({ status: "ok" });

      const putRes = await app.handle(buildRequest("/health", { method: "PUT" }));
      expect(await putRes.json()).toEqual({ status: "ok" });
    });

    it("supports PATCH, OPTIONS, and HEAD methods", async () => {
      const app = bunway();
      app
        .route("/test")
        .patch((req, res) => res.json({ method: "PATCH" }))
        .options((req, res) => res.json({ method: "OPTIONS" }))
        .head((req, res) => res.status(200).send());

      const patchRes = await app.handle(buildRequest("/test", { method: "PATCH" }));
      expect(await patchRes.json()).toEqual({ method: "PATCH" });

      const optionsRes = await app.handle(buildRequest("/test", { method: "OPTIONS" }));
      expect(await optionsRes.json()).toEqual({ method: "OPTIONS" });

      const headRes = await app.handle(buildRequest("/test", { method: "HEAD" }));
      expect(headRes.status).toBe(200);
    });
  });

  describe("Middleware support", () => {
    it("supports multiple handlers per method (middleware chain)", async () => {
      const app = bunway();
      const calls: string[] = [];

      app.route("/users").post(
        (req, res, next) => {
          calls.push("auth");
          next();
        },
        (req, res, next) => {
          calls.push("validate");
          next();
        },
        (req, res) => {
          calls.push("create");
          res.json({ created: true });
        }
      );

      const response = await app.handle(buildRequest("/users", { method: "POST" }));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ created: true });
      expect(calls).toEqual(["auth", "validate", "create"]);
    });

    it("applies middleware only to that route's methods", async () => {
      const app = bunway();
      let middlewareCalled = false;

      app.route("/protected").get(
        (req, res, next) => {
          middlewareCalled = true;
          next();
        },
        (req, res) => res.json({ protected: true })
      );

      app.get("/public", (req, res) => res.json({ public: true }));

      middlewareCalled = false;
      await app.handle(buildRequest("/protected"));
      expect(middlewareCalled).toBe(true);

      middlewareCalled = false;
      await app.handle(buildRequest("/public"));
      expect(middlewareCalled).toBe(false);
    });
  });

  describe("Router instance", () => {
    it("works on Router instance, not just app", async () => {
      const app = bunway();
      const router = new Router();

      router
        .route("/posts")
        .get((req, res) => res.json({ posts: [] }))
        .post((req, res) => res.json({ created: true }));

      app.use("/api", router);

      const getRes = await app.handle(buildRequest("/api/posts"));
      expect(await getRes.json()).toEqual({ posts: [] });

      const postRes = await app.handle(buildRequest("/api/posts", { method: "POST" }));
      expect(await postRes.json()).toEqual({ created: true });
    });

    it("works in mounted sub-router with chainable routes", async () => {
      const app = bunway();
      const adminRouter = new Router();

      adminRouter.route("/users/:id").get((req, res) => res.json({ id: req.params.id }));

      app.use("/admin", adminRouter);

      const response = await app.handle(buildRequest("/admin/users/123"));
      expect(await response.json()).toEqual({ id: "123" });
    });
  });

  describe("Route parameters", () => {
    it("supports route params in chainable routes", async () => {
      const app = bunway();
      app
        .route("/users/:id")
        .get((req, res) => res.json({ id: req.params.id, action: "get" }))
        .put((req, res) => res.json({ id: req.params.id, action: "update" }))
        .delete((req, res) => res.json({ id: req.params.id, action: "delete" }));

      const getRes = await app.handle(buildRequest("/users/42"));
      expect(await getRes.json()).toEqual({ id: "42", action: "get" });

      const putRes = await app.handle(buildRequest("/users/42", { method: "PUT" }));
      expect(await putRes.json()).toEqual({ id: "42", action: "update" });

      const deleteRes = await app.handle(buildRequest("/users/42", { method: "DELETE" }));
      expect(await deleteRes.json()).toEqual({ id: "42", action: "delete" });
    });

    it("supports multiple route params", async () => {
      const app = bunway();
      app.route("/users/:userId/posts/:postId").get((req, res) =>
        res.json({
          userId: req.params.userId,
          postId: req.params.postId,
        })
      );

      const response = await app.handle(buildRequest("/users/10/posts/20"));
      expect(await response.json()).toEqual({ userId: "10", postId: "20" });
    });
  });

  describe("Async handlers", () => {
    it("supports async handlers in chainable routes", async () => {
      const app = bunway();
      app.route("/async").get(async (req, res) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        res.json({ async: true });
      });

      const response = await app.handle(buildRequest("/async"));
      expect(await response.json()).toEqual({ async: true });
    });

    it("supports async middleware in chain", async () => {
      const app = bunway();
      const calls: string[] = [];

      app.route("/async-chain").post(
        async (req, res, next) => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          calls.push("middleware");
          next();
        },
        (req, res) => {
          calls.push("handler");
          res.json({ done: true });
        }
      );

      const response = await app.handle(buildRequest("/async-chain", { method: "POST" }));
      expect(await response.json()).toEqual({ done: true });
      expect(calls).toEqual(["middleware", "handler"]);
    });
  });

  describe("Return value and chaining", () => {
    it("returns this for proper chaining", async () => {
      const app = bunway();
      const route = app.route("/test");

      const getResult = route.get((req, res) => res.json({ method: "GET" }));
      expect(getResult).toBe(route);

      const postResult = route.post((req, res) => res.json({ method: "POST" }));
      expect(postResult).toBe(route);
    });

    it("allows fluent chaining syntax", async () => {
      const app = bunway();

      const route = app
        .route("/fluent")
        .get((req, res) => res.json({ method: "GET" }))
        .post((req, res) => res.json({ method: "POST" }))
        .put((req, res) => res.json({ method: "PUT" }));

      const response = await app.handle(buildRequest("/fluent", { method: "PUT" }));
      expect(await response.json()).toEqual({ method: "PUT" });
    });
  });

  describe("Error handling", () => {
    it("returns 404 on unregistered path", async () => {
      const app = bunway();
      app.route("/users").get((req, res) => res.json({ users: [] }));

      const response = await app.handle(buildRequest("/posts"));
      expect(response.status).toBe(404);
    });

    it("returns 405 on registered path but wrong method", async () => {
      const app = bunway();
      app.route("/users").get((req, res) => res.json({ users: [] }));

      const response = await app.handle(buildRequest("/users", { method: "POST" }));
      expect(response.status).toBe(405);
      const data = await response.json();
      expect(data.error).toBe("Method Not Allowed");
    });

    it("handles errors in chainable route handlers", async () => {
      const app = bunway();

      app.route("/error").get((req, res) => {
        throw new Error("Route error");
      });

      app.use((err: Error, req: any, res: any, next: any) => {
        res.status(500).json({ error: err.message });
      });

      const response = await app.handle(buildRequest("/error"));
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: "Route error" });
    });
  });

  describe("Compatibility with regular routes", () => {
    it("works alongside regular app.get() routes", async () => {
      const app = bunway();

      app.get("/regular", (req, res) => res.json({ type: "regular" }));
      app.route("/chainable").get((req, res) => res.json({ type: "chainable" }));

      const regularRes = await app.handle(buildRequest("/regular"));
      expect(await regularRes.json()).toEqual({ type: "regular" });

      const chainableRes = await app.handle(buildRequest("/chainable"));
      expect(await chainableRes.json()).toEqual({ type: "chainable" });
    });

    it("allows mixing regular and chainable routes", async () => {
      const app = bunway();

      app.get("/users", (req, res) => res.json({ action: "list" }));
      app.route("/users/:id").get((req, res) => res.json({ action: "get", id: req.params.id }));
      app.post("/users", (req, res) => res.json({ action: "create" }));

      const listRes = await app.handle(buildRequest("/users"));
      expect(await listRes.json()).toEqual({ action: "list" });

      const getRes = await app.handle(buildRequest("/users/1"));
      expect(await getRes.json()).toEqual({ action: "get", id: "1" });

      const createRes = await app.handle(buildRequest("/users", { method: "POST" }));
      expect(await createRes.json()).toEqual({ action: "create" });
    });
  });

  describe("Edge cases", () => {
    it("handles empty path correctly", async () => {
      const app = bunway();
      app.route("/").get((req, res) => res.json({ root: true }));

      const response = await app.handle(buildRequest("/"));
      expect(await response.json()).toEqual({ root: true });
    });

    it("handles multiple chainable routes on different paths", async () => {
      const app = bunway();

      app.route("/users").get((req, res) => res.json({ resource: "users" }));
      app.route("/posts").get((req, res) => res.json({ resource: "posts" }));
      app.route("/comments").get((req, res) => res.json({ resource: "comments" }));

      const usersRes = await app.handle(buildRequest("/users"));
      expect(await usersRes.json()).toEqual({ resource: "users" });

      const postsRes = await app.handle(buildRequest("/posts"));
      expect(await postsRes.json()).toEqual({ resource: "posts" });

      const commentsRes = await app.handle(buildRequest("/comments"));
      expect(await commentsRes.json()).toEqual({ resource: "comments" });
    });

    it("handles calling route() multiple times on same path", async () => {
      const app = bunway();

      app.route("/test").get((req, res) => res.json({ method: "GET" }));
      app.route("/test").post((req, res) => res.json({ method: "POST" }));

      const getRes = await app.handle(buildRequest("/test"));
      expect(await getRes.json()).toEqual({ method: "GET" });

      const postRes = await app.handle(buildRequest("/test", { method: "POST" }));
      expect(await postRes.json()).toEqual({ method: "POST" });
    });
  });
});
