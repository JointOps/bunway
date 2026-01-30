const express = require("express");

const app = express();

// NOTE: NO global middleware - this ensures /json and /plaintext are fair benchmarks
// Body parsing is ONLY applied to routes that need it

// JSON serialization benchmark (NO middleware)
app.get("/json", (req, res) => {
  res.json({ message: "Hello, World!" });
});

// Plaintext benchmark (NO middleware)
app.get("/plaintext", (req, res) => {
  res.type("text/plain").send("Hello, World!");
});

// Routing benchmark - register 100 routes (NO middleware)
for (let i = 0; i < 100; i++) {
  app.get(`/route${i}/:id`, (req, res) => {
    res.json({ route: i, id: req.params.id });
  });
}

// Middleware benchmark - ONLY affects /middleware endpoint
const middlewareRouter = express.Router();
for (let i = 0; i < 10; i++) {
  middlewareRouter.use((req, res, next) => {
    req[`mw${i}`] = true;
    next();
  });
}
middlewareRouter.get("/", (req, res) => {
  res.json({ processed: true });
});
app.use("/middleware", middlewareRouter);

// Body parsing benchmark - json() middleware ONLY on this route
app.post("/body", express.json(), (req, res) => {
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
    framework: "express",
    memory: process.memoryUsage(),
    uptime: process.uptime(),
  });
});

const PORT = parseInt(process.env.PORT || "3000", 10);

app.listen(PORT, () => {
  console.log(`Express benchmark server running on http://localhost:${PORT}`);
});
