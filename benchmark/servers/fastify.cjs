const fastify = require("fastify")({ logger: false });

// NOTE: NO global hooks - this ensures /json and /plaintext are fair benchmarks
// Middleware is ONLY applied to routes that need it

// JSON serialization benchmark (NO hooks)
fastify.get("/json", async () => ({ message: "Hello, World!" }));

// Plaintext benchmark (NO hooks)
fastify.get("/plaintext", async (request, reply) => {
  reply.type("text/plain").send("Hello, World!");
});

// Routing benchmark - register 100 routes (NO hooks)
for (let i = 0; i < 100; i++) {
  fastify.get(`/route${i}/:id`, async (request) => ({
    route: i,
    id: request.params.id,
  }));
}

// Middleware benchmark - ONLY affects /middleware endpoint using encapsulation
fastify.register(async function middlewarePlugin(instance) {
  // This hook ONLY runs for routes in this plugin
  instance.addHook("onRequest", async (request) => {
    for (let i = 0; i < 10; i++) {
      request[`mw${i}`] = true;
    }
  });
  instance.get("/", async () => ({ processed: true }));
}, { prefix: "/middleware" });

// Body parsing benchmark (Fastify has built-in body parsing, no extra middleware needed)
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
