const express = require("express");

const app = express();

app.get("/json", (req, res) => {
  res.json({ message: "Hello, World!" });
});

app.get("/plaintext", (req, res) => {
  res.type("text/plain").send("Hello, World!");
});

app.get("/params/:id", (req, res) => {
  res.json({ id: req.params.id });
});

app.get("/params/:a/:b/:c", (req, res) => {
  res.json(req.params);
});

app.get("/db", async (req, res) => {
  await new Promise((resolve) => setTimeout(resolve, 5));
  res.json([
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
  ]);
});

app.post("/body", express.json(), (req, res) => {
  res.json({ received: true, bytes: JSON.stringify(req.body).length });
});

const makeMiddleware = (i) => (req, res, next) => {
  req[`m${i}`] = i;
  next();
};

app.get("/mw5", ...Array.from({ length: 5 }, (_, i) => makeMiddleware(i)), (req, res) => {
  res.json({ ok: true });
});

app.get("/mw10", ...Array.from({ length: 10 }, (_, i) => makeMiddleware(i)), (req, res) => {
  res.json({ ok: true });
});

for (let i = 0; i < 100; i++) {
  app.get(`/route${i}/:id`, (req, res) => {
    res.json({ route: i, id: req.params.id });
  });
}

const PORT = parseInt(process.env.PORT || "3000", 10);

app.listen(PORT, () => {
  console.log(`Express benchmark server on http://localhost:${PORT}`);
});
