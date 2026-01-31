import { describe, expect, it } from "bun:test";
import { Router } from "../../../src";

describe("Request route info", () => {
  it("sets route info when a route matches", async () => {
    const router = new Router();
    router.get("/users/:id", (req, res) => {
      res.json({
        route: req.route,
        params: req.params,
      });
    });

    const response = await router.handle(new Request("http://localhost/users/123"));
    const data = await response.json();

    expect(data.route).toEqual({ path: "/users/:id", method: "GET" });
    expect(data.params).toEqual({ id: "123" });
  });

  it("includes method in route info", async () => {
    const router = new Router();
    router.post("/items", (req, res) => {
      res.json({ route: req.route });
    });

    const response = await router.handle(
      new Request("http://localhost/items", { method: "POST" })
    );
    const data = await response.json();

    expect(data.route.method).toBe("POST");
    expect(data.route.path).toBe("/items");
  });
});
