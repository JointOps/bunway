import { bunway } from "../../src";
import { json as jsonMiddleware } from "../../src/middleware/body-parser";
import type { Handler } from "../../src";

const app = bunway();

app.get("/json", (req, res) => {
  res.json({ message: "Hello, World!" });
});

app.get("/plaintext", (req, res) => {
  res.text("Hello, World!");
});

app.get("/params/:id", (req, res) => {
  res.json({ id: req.params.id });
});

app.get("/params/:a/:b/:c", (req, res) => {
  res.json(req.params);
});

app.get("/db", async (req, res) => {
  await new Promise<void>((r) => setTimeout(r, 5));
  res.json([
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
  ]);
});

app.post("/body", jsonMiddleware(), (req, res) => {
  res.json({ received: true, bytes: JSON.stringify(req.body).length });
});

const mw5: Handler[] = Array.from({ length: 5 }, (_, i) => (req, res, next) => {
  req.locals[`m${i}`] = i;
  next();
});

const mw10: Handler[] = Array.from({ length: 10 }, (_, i) => (req, res, next) => {
  req.locals[`m${i}`] = i;
  next();
});

app.get("/mw5", ...mw5, (req, res) => res.json({ ok: true }));
app.get("/mw10", ...mw10, (req, res) => res.json({ ok: true }));

for (let i = 0; i < 100; i++) {
  app.get(`/route${i}/:id`, (req, res) => {
    res.json({ route: i, id: req.params.id });
  });
}

const PORT = parseInt(process.env.PORT || "3000", 10);
app.listen(PORT, () => {
  console.log(`bunWay benchmark server on http://localhost:${PORT}`);
});
