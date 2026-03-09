import { describe, it, expect } from "bun:test";
import bunway from "../../../src";

describe("app.mountpath and app.path()", () => {
  it("mountpath defaults to /", () => {
    const app = bunway();
    expect(app.mountpath).toBe("/");
  });

  it("mountpath is set when sub-app is mounted", async () => {
    const app = bunway();
    const admin = bunway();

    admin.get("/dashboard", (req, res) => {
      res.json({ mountpath: admin.mountpath });
    });

    app.use("/admin", admin);

    const response = await app.handle(new Request("http://localhost/admin/dashboard"));
    const body = await response.json();
    expect(body.mountpath).toBe("/admin");
  });

  it("path() returns canonical path", () => {
    const app = bunway();
    const admin = bunway();
    const superAdmin = bunway();

    app.use("/admin", admin);
    admin.use("/super", superAdmin);

    expect(app.path()).toBe("/");
    expect(admin.path()).toBe("/admin");
    expect(superAdmin.path()).toBe("/admin/super");
  });

  it("path() works for unmounted app", () => {
    const app = bunway();
    expect(app.path()).toBe("/");
  });
});
