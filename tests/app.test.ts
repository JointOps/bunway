import { afterEach, describe, expect, it, vi } from "bun:test";
import bunway, { json } from "../src";
import { buildRequest } from "./testUtils";

describe("bunway app", () => {
  let serveSpy: ReturnType<typeof vi.spyOn> | null = null;

  afterEach(() => {
    serveSpy?.mockRestore();
    serveSpy = null;
  });

  it("creates an app with factory function", () => {
    const app = bunway();
    expect(app).toBeDefined();
    expect(typeof app.get).toBe("function");
    expect(typeof app.post).toBe("function");
    expect(typeof app.listen).toBe("function");
  });

  it("handles GET requests", async () => {
    const app = bunway();
    app.get("/", (req, res) => {
      res.text("Hello bunWay");
    });

    const response = await app.handle(buildRequest("/"));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Hello bunWay");
  });

  it("handles POST requests with JSON body", async () => {
    const app = bunway();
    app.use(bunway.json());
    app.post("/users", (req, res) => {
      res.status(201).json({ received: req.body });
    });

    const response = await app.handle(
      buildRequest("/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "John" }),
      })
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ received: { name: "John" } });
  });

  it("handles route parameters", async () => {
    const app = bunway();
    app.get("/users/:id", (req, res) => {
      res.json({ id: req.params.id });
    });

    const response = await app.handle(buildRequest("/users/123"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "123" });
  });

  it("returns 404 for unmatched routes", async () => {
    const app = bunway();
    app.get("/", (req, res) => res.text("home"));

    const response = await app.handle(buildRequest("/not-found"));
    expect(response.status).toBe(404);
  });

  it("delegates to Bun.serve with port", () => {
    const app = bunway();
    app.get("/", (req, res) => res.text("ok"));

    serveSpy = vi.spyOn(Bun, "serve").mockImplementation((options) => {
      return { stop() {} } as ReturnType<typeof Bun.serve>;
    });

    const onListen = vi.fn();
    const server = app.listen(4321, onListen);

    expect(onListen).toHaveBeenCalledTimes(1);
    expect(serveSpy).toHaveBeenCalledWith(expect.objectContaining({ port: 4321 }));
    server.stop();
  });

  it("supports listen options with hostname", () => {
    const app = bunway();

    serveSpy = vi.spyOn(Bun, "serve").mockImplementation(() => {
      return { stop() {} } as ReturnType<typeof Bun.serve>;
    });

    const server = app.listen({ hostname: "0.0.0.0", port: 8080 });
    expect(serveSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        port: 8080,
        hostname: "0.0.0.0",
      })
    );
    server.stop();
  });
});

describe("bunway factory helpers", () => {
  it("exposes middleware as static properties", () => {
    expect(bunway.json).toBe(json);
    expect(typeof bunway.urlencoded).toBe("function");
    expect(typeof bunway.text).toBe("function");
    expect(typeof bunway.cors).toBe("function");
  });
});
