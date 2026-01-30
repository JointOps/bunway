import { bunway } from "../../src";

const app = bunway();

// JSON serialization benchmark
app.get("/json", (req, res) => {
  res.json({ message: "Hello, World!" });
});

// Plaintext benchmark
app.get("/plaintext", (req, res) => {
  res.text("Hello, World!");
});

// Routing benchmark - register 100 routes
for (let i = 0; i < 100; i++) {
  app.get(`/route${i}/:id`, (req, res) => {
    res.json({ route: i, id: req.params.id });
  });
}

// Middleware benchmark - separate app to not affect main benchmarks
const middlewareApp = bunway();
for (let i = 0; i < 10; i++) {
  middlewareApp.use((req, res, next) => {
    req.locals[`mw${i}`] = true;
    next();
  });
}
middlewareApp.get("/middleware", (req, res) => {
  res.json({ processed: true });
});

// Body parsing benchmark - use route-level middleware, not global!
// This way /json and /plaintext use the fast path
app.post("/body", bunway.json(), (req, res) => {
  res.json({ received: true, size: JSON.stringify(req.body).length });
});

// Simulated DB latency benchmark
app.get("/db/:delay", async (req, res) => {
  const delay = parseInt(req.params.delay, 10) || 5;
  await new Promise((resolve) => setTimeout(resolve, delay));
  res.json([
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
  ]);
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    framework: "bunway",
    memory: process.memoryUsage(),
    uptime: process.uptime(),
  });
});

const PORT = parseInt(process.env.PORT || "3000", 10);

app.listen(PORT, () => {
  console.log(`bunWay benchmark server running on http://localhost:${PORT}`);
});
