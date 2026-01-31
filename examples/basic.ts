import { bunway, cors, errorHandler, HttpError, json } from "../dist";

const app = bunway();

app.use(cors({ origin: true }));
app.use(json());
app.use(errorHandler({ logger: console.error }));

app.get("/", (req, res) => res.text("Hello from bunWay!"));

app.get("/users/:id", (req, res) => {
  const id = req.params.id;
  if (!id || id === "0") {
    throw new HttpError(404, "User not found");
  }
  res.json({ id, name: `User ${id}` });
});

app.post("/echo", (req, res) => {
  res.ok({ received: req.body });
});

app.listen({ port: 7070 }, () => {
  console.log("bunWay basic example running at http://localhost:7070");
});
