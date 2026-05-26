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

app.group("/mw5", (group) =>
  group
    .derive(() => {
      const data: Record<string, number> = {};
      for (let i = 0; i < 5; i++) data[`m${i}`] = i;
      return { middlewareData: data };
    })
    .get("", () => ({ ok: true }))
);

app.group("/mw10", (group) =>
  group
    .derive(() => {
      const data: Record<string, number> = {};
      for (let i = 0; i < 10; i++) data[`m${i}`] = i;
      return { middlewareData: data };
    })
    .get("", () => ({ ok: true }))
);

for (let i = 0; i < 100; i++) {
  app.get(`/route${i}/:id`, ({ params }) => ({ route: i, id: params.id }));
}

const PORT = parseInt(process.env.PORT || "3000", 10);

app.listen(PORT, () => {
  console.log(`Elysia benchmark server on http://localhost:${PORT}`);
});
