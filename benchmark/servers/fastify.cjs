const fastify = require("fastify")({ logger: false });

fastify.get("/json", async () => ({ message: "Hello, World!" }));

fastify.get("/plaintext", async (request, reply) => {
  reply.type("text/plain").send("Hello, World!");
});

fastify.get("/params/:id", async (request) => ({ id: request.params.id }));

fastify.get("/params/:a/:b/:c", async (request) => request.params);

fastify.get("/db", async () => {
  await new Promise((resolve) => setTimeout(resolve, 5));
  return [
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
  ];
});

fastify.post("/body", async (request) => ({
  received: true,
  bytes: JSON.stringify(request.body).length,
}));

const mws5 = Array.from({ length: 5 }, (_, i) => async (request) => { request[`m${i}`] = i; });
const mws10 = Array.from({ length: 10 }, (_, i) => async (request) => { request[`m${i}`] = i; });

fastify.get("/mw5", { preHandler: mws5 }, async () => ({ ok: true }));
fastify.get("/mw10", { preHandler: mws10 }, async () => ({ ok: true }));

for (let i = 0; i < 100; i++) {
  fastify.get(`/route${i}/:id`, async (request) => ({
    route: i,
    id: request.params.id,
  }));
}

const PORT = parseInt(process.env.PORT || "3000", 10);

fastify.listen({ port: PORT }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Fastify benchmark server on http://localhost:${PORT}`);
});
