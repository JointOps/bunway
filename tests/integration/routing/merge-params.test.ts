import { describe, expect, it } from "bun:test";
import { Router } from "../../../src";
import { buildRequest } from "../../utils/testUtils";
import { bunway } from "../../../src/core/app";

describe("Router mergeParams", () => {
  it("parent param accessible in child router with mergeParams", async () => {
    const app = bunway();
    const userRouter = new Router({ mergeParams: true });

    userRouter.get("/posts", (req, res) => {
      res.json({ userId: req.params.userId });
    });

    app.use("/users/:userId", userRouter);

    const response = await app.handle(buildRequest("/users/123/posts"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ userId: "123" });
  });

  it("parent param NOT accessible without mergeParams (default)", async () => {
    const app = bunway();
    const userRouter = new Router();

    userRouter.get("/posts", (req, res) => {
      res.json({ userId: req.params.userId ?? null });
    });

    app.use("/users/:userId", userRouter);

    const response = await app.handle(buildRequest("/users/123/posts"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ userId: null });
  });

  it("child param overrides parent param with same name", async () => {
    const app = bunway();
    const childRouter = new Router({ mergeParams: true });

    childRouter.get("/:id", (req, res) => {
      res.json({ id: req.params.id });
    });

    app.use("/items/:id", childRouter);

    const response = await app.handle(buildRequest("/items/parent-val/child-val"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "child-val" });
  });

  it("deeply nested: grandparent params merge through chain", async () => {
    const app = bunway();
    const orgRouter = new Router({ mergeParams: true });
    const teamRouter = new Router({ mergeParams: true });

    teamRouter.get("/members", (req, res) => {
      res.json({
        orgId: req.params.orgId,
        teamId: req.params.teamId,
      });
    });

    orgRouter.use("/teams/:teamId", teamRouter);
    app.use("/orgs/:orgId", orgRouter);

    const response = await app.handle(buildRequest("/orgs/abc/teams/xyz/members"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ orgId: "abc", teamId: "xyz" });
  });

  it("multiple parent params all merge correctly", async () => {
    const app = bunway();
    const childRouter = new Router({ mergeParams: true });

    childRouter.get("/comments", (req, res) => {
      res.json({
        userId: req.params.userId,
        postId: req.params.postId,
      });
    });

    app.use("/users/:userId/posts/:postId", childRouter);

    const response = await app.handle(buildRequest("/users/42/posts/99/comments"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ userId: "42", postId: "99" });
  });

  it("mergeParams with app.group()", async () => {
    const app = bunway();

    app.group("/projects/:projectId", (projectRouter) => {
      const taskRouter = new Router({ mergeParams: true });
      taskRouter.get("/", (req, res) => {
        res.json({ projectId: req.params.projectId });
      });
      projectRouter.use("/tasks", taskRouter);
    });

    const response = await app.handle(buildRequest("/projects/p1/tasks"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ projectId: "p1" });
  });

  it("mergeParams with multiple sub-routers at same level", async () => {
    const app = bunway();
    const postsRouter = new Router({ mergeParams: true });
    const commentsRouter = new Router({ mergeParams: true });

    postsRouter.get("/", (req, res) => {
      res.json({ userId: req.params.userId, type: "posts" });
    });

    commentsRouter.get("/", (req, res) => {
      res.json({ userId: req.params.userId, type: "comments" });
    });

    app.use("/users/:userId/posts", postsRouter);
    app.use("/users/:userId/comments", commentsRouter);

    const postsRes = await app.handle(buildRequest("/users/7/posts"));
    expect(await postsRes.json()).toEqual({ userId: "7", type: "posts" });

    const commentsRes = await app.handle(buildRequest("/users/7/comments"));
    expect(await commentsRes.json()).toEqual({ userId: "7", type: "comments" });
  });

  it("empty parent params — child works normally", async () => {
    const app = bunway();
    const childRouter = new Router({ mergeParams: true });

    childRouter.get("/items/:itemId", (req, res) => {
      res.json({ itemId: req.params.itemId });
    });

    app.use("/api", childRouter);

    const response = await app.handle(buildRequest("/api/items/5"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ itemId: "5" });
  });

  it("works alongside regular app routes", async () => {
    const app = bunway();
    const childRouter = new Router({ mergeParams: true });

    app.get("/health", (req, res) => res.json({ status: "ok" }));

    childRouter.get("/profile", (req, res) => {
      res.json({ userId: req.params.userId });
    });

    app.use("/users/:userId", childRouter);

    const healthRes = await app.handle(buildRequest("/health"));
    expect(await healthRes.json()).toEqual({ status: "ok" });

    const profileRes = await app.handle(buildRequest("/users/10/profile"));
    expect(await profileRes.json()).toEqual({ userId: "10" });
  });

  it("mergeParams with middleware in child router", async () => {
    const app = bunway();
    const childRouter = new Router({ mergeParams: true });
    let middlewareUserId: string | undefined;

    childRouter.use((req, res, next) => {
      middlewareUserId = req.params.userId;
      next();
    });

    childRouter.get("/settings", (req, res) => {
      res.json({ userId: req.params.userId });
    });

    app.use("/users/:userId", childRouter);

    const response = await app.handle(buildRequest("/users/55/settings"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ userId: "55" });
    expect(middlewareUserId).toBe("55");
  });

  it("mergeParams false by default in Router constructor", () => {
    const router = new Router();
    const routerWithFalse = new Router({ mergeParams: false });
    const routerWithTrue = new Router({ mergeParams: true });

    expect((router as any).routerOptions.mergeParams).toBeUndefined();
    expect((routerWithFalse as any).routerOptions.mergeParams).toBe(false);
    expect((routerWithTrue as any).routerOptions.mergeParams).toBe(true);
  });

  it("intermediate router without mergeParams blocks grandparent params", async () => {
    const app = bunway();
    const middleRouter = new Router(); // no mergeParams
    const innerRouter = new Router({ mergeParams: true });

    innerRouter.get("/data", (req, res) => {
      res.json({
        orgId: req.params.orgId ?? null,
        teamId: req.params.teamId ?? null,
      });
    });

    middleRouter.use("/teams/:teamId", innerRouter);
    app.use("/orgs/:orgId", middleRouter);

    const response = await app.handle(buildRequest("/orgs/abc/teams/xyz/data"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.teamId).toBe("xyz");
    expect(body.orgId).toBeNull();
  });
});
