import { Elysia } from "elysia";

const app = new Elysia();

// JSON serialization benchmark
app.get("/json", () => ({ message: "Hello, World!" }));

// Plaintext benchmark
app.get("/plaintext", () => new Response("Hello, World!", {
  headers: { "Content-Type": "text/plain" }
}));

// Routing benchmark - register 100 routes
for (let i = 0; i < 100; i++) {
  app.get(`/route${i}/:id`, ({ params }) => ({ route: i, id: params.id }));
}

// Middleware benchmark
const middlewareApp = new Elysia()
  .derive(() => {
    const data: Record<string, boolean> = {};
    for (let i = 0; i < 10; i++) {
      data[`mw${i}`] = true;
    }
    return { middlewareData: data };
  })
  .get("/middleware", () => ({ processed: true }));

app.use(middlewareApp);

// Body parsing benchmark
app.post("/body", ({ body }) => ({
  received: true,
  size: JSON.stringify(body).length,
}));

// Simulated DB latency benchmark
app.get("/db/:delay", async ({ params }) => {
  const delay = parseInt(params.delay, 10) || 5;
  await new Promise((resolve) => setTimeout(resolve, delay));
  return [
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
  ];
});

// Health check
app.get("/health", () => ({
  status: "ok",
  framework: "elysia",
  memory: process.memoryUsage(),
  uptime: process.uptime(),
}));

const PORT = parseInt(process.env.PORT || "3000", 10);

app.listen(PORT, () => {
  console.log(`Elysia benchmark server running on http://localhost:${PORT}`);
});
