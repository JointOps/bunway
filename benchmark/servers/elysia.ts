import { Elysia } from "elysia";

const app = new Elysia();

app.get("/json", () => ({ message: "Hello, World!" }));

app.get(
  "/plaintext",
  () =>
    new Response("Hello, World!", {
      headers: { "Content-Type": "text/plain" },
    })
);

app.get("/params/:a", ({ params }) => ({ id: params.a }));

app.get("/params/:a/:b/:c", ({ params }) => params);

app.get("/db", async () => {
  await new Promise<void>((r) => setTimeout(r, 5));
  return [
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
  ];
});

app.post("/body", ({ body }) => ({
  received: true,
  bytes: JSON.stringify(body).length,
}));

app.get(
  "/mw5",
  () => ({ ok: true }),
  {
    beforeHandle: [
      ({ request }) => { (request as any).m0 = 0; },
      ({ request }) => { (request as any).m1 = 1; },
      ({ request }) => { (request as any).m2 = 2; },
      ({ request }) => { (request as any).m3 = 3; },
      ({ request }) => { (request as any).m4 = 4; },
    ],
  }
);

app.get(
  "/mw10",
  () => ({ ok: true }),
  {
    beforeHandle: [
      ({ request }) => { (request as any).m0 = 0; },
      ({ request }) => { (request as any).m1 = 1; },
      ({ request }) => { (request as any).m2 = 2; },
      ({ request }) => { (request as any).m3 = 3; },
      ({ request }) => { (request as any).m4 = 4; },
      ({ request }) => { (request as any).m5 = 5; },
      ({ request }) => { (request as any).m6 = 6; },
      ({ request }) => { (request as any).m7 = 7; },
      ({ request }) => { (request as any).m8 = 8; },
      ({ request }) => { (request as any).m9 = 9; },
    ],
  }
);

for (let i = 0; i < 100; i++) {
  app.get(`/route${i}/:id`, ({ params }) => ({ route: i, id: params.id }));
}

const PORT = parseInt(process.env.PORT || "3000", 10);

app.listen(PORT, () => {
  console.log(`Elysia benchmark server on http://localhost:${PORT}`);
});
