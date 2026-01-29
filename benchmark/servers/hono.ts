import { Hono } from "hono";

const app = new Hono();

// JSON serialization benchmark
app.get("/json", (c) => c.json({ message: "Hello, World!" }));

// Plaintext benchmark
app.get("/plaintext", (c) => c.text("Hello, World!"));

// Routing benchmark - register 100 routes
for (let i = 0; i < 100; i++) {
  app.get(`/route${i}/:id`, (c) => c.json({ route: i, id: c.req.param("id") }));
}

// Middleware benchmark
app.use("/middleware", async (c, next) => {
  for (let i = 0; i < 10; i++) {
    c.set(`mw${i}`, true);
  }
  await next();
});
app.get("/middleware", (c) => c.json({ processed: true }));

// Body parsing benchmark
app.post("/body", async (c) => {
  const body = await c.req.json();
  return c.json({ received: true, size: JSON.stringify(body).length });
});

// Simulated DB latency benchmark
app.get("/db/:delay", async (c) => {
  const delay = parseInt(c.req.param("delay") || "5", 10);
  await new Promise((resolve) => setTimeout(resolve, delay));
  return c.json([
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
  ]);
});

// Health check
app.get("/health", (c) =>
  c.json({
    status: "ok",
    framework: "hono",
    memory: process.memoryUsage(),
    uptime: process.uptime(),
  })
);

const PORT = parseInt(process.env.PORT || "3000", 10);

export default {
  port: PORT,
  fetch: app.fetch,
};

console.log(`Hono benchmark server running on http://localhost:${PORT}`);
