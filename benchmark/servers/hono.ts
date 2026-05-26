import { Hono } from "hono";
import type { Context, Next } from "hono";

const app = new Hono();

app.get("/json", (c) => c.json({ message: "Hello, World!" }));

app.get("/plaintext", (c) => c.text("Hello, World!"));

app.get("/params/:id", (c) => c.json({ id: c.req.param("id") }));

app.get("/params/:a/:b/:c", (c) => c.json(c.req.param()));

app.get("/db", async (c) => {
  await new Promise<void>((r) => setTimeout(r, 5));
  return c.json([
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
  ]);
});

app.post("/body", async (c) => {
  const body = await c.req.json();
  return c.json({ received: true, bytes: JSON.stringify(body).length });
});

const makeMiddleware = (i: number) => async (c: Context, next: Next) => {
  c.set(`m${i}`, i);
  await next();
};

app.get("/mw5", ...Array.from({ length: 5 }, (_, i) => makeMiddleware(i)), (c) => c.json({ ok: true }));
app.get("/mw10", ...Array.from({ length: 10 }, (_, i) => makeMiddleware(i)), (c) => c.json({ ok: true }));

for (let i = 0; i < 100; i++) {
  app.get(`/route${i}/:id`, (c) => c.json({ route: i, id: c.req.param("id") }));
}

const PORT = parseInt(process.env.PORT || "3000", 10);

export default {
  port: PORT,
  fetch: app.fetch,
};

console.log(`Hono benchmark server on http://localhost:${PORT}`);
