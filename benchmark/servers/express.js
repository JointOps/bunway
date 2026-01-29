const express = require("express");

const app = express();
app.use(express.json());

// JSON serialization benchmark
app.get("/json", (req, res) => {
  res.json({ message: "Hello, World!" });
});

// Plaintext benchmark
app.get("/plaintext", (req, res) => {
  res.type("text/plain").send("Hello, World!");
});

// Routing benchmark - register 100 routes
for (let i = 0; i < 100; i++) {
  app.get(`/route${i}/:id`, (req, res) => {
    res.json({ route: i, id: req.params.id });
  });
}

// Middleware benchmark
for (let i = 0; i < 10; i++) {
  app.use("/middleware", (req, res, next) => {
    req[`mw${i}`] = true;
    next();
  });
}
app.get("/middleware", (req, res) => {
  res.json({ processed: true });
});

// Body parsing benchmark
app.post("/body", (req, res) => {
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
