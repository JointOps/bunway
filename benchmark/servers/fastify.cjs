const fastify = require("fastify")({ logger: false });

// JSON serialization benchmark
fastify.get("/json", async () => ({ message: "Hello, World!" }));

// Plaintext benchmark
fastify.get("/plaintext", async (request, reply) => {
  reply.type("text/plain").send("Hello, World!");
});

// Routing benchmark - register 100 routes
for (let i = 0; i < 100; i++) {
  fastify.get(`/route${i}/:id`, async (request) => ({
    route: i,
    id: request.params.id,
  }));
}

// Middleware benchmark
fastify.addHook("onRequest", async (request) => {
  if (request.url === "/middleware") {
    for (let i = 0; i < 10; i++) {
      request[`mw${i}`] = true;
    }
  }
});
fastify.get("/middleware", async () => ({ processed: true }));

// Body parsing benchmark
fastify.post("/body", async (request) => ({
  received: true,
  size: JSON.stringify(request.body).length,
}));

// Simulated DB latency benchmark
fastify.get("/db/:delay", async (request) => {
  const delay = parseInt(request.params.delay, 10) || 5;
  await new Promise((resolve) => setTimeout(resolve, delay));
  return [
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
  ];
});

// Health check
fastify.get("/health", async () => ({
  status: "ok",
  framework: "fastify",
  memory: process.memoryUsage(),
  uptime: process.uptime(),
}));

const PORT = parseInt(process.env.PORT || "3000", 10);

fastify.listen({ port: PORT }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Fastify benchmark server running on http://localhost:${PORT}`);
});
