type BunwayExports = typeof import("../src");

const runtime = (await (Bun.env.BUNWAY_USE_SRC === "true"
  ? import("../src")
  : import("../dist"))) as BunwayExports;

const {
  bunway,
  cors,
  errorHandler,
  HttpError,
  json,
  text,
  urlencoded,
  Router: RouterCtor,
  BUNWAY_DEFAULT_PORT,
} = runtime;

type RouterInstance = InstanceType<typeof RouterCtor>;

type User = { id: string; name: string };

function createAdminRouter(): RouterInstance {
  const router = new RouterCtor();
  router.use((req, res, next) => {
    const auth = req.headers.get("authorization");
    if (auth !== "super-secret") {
      throw new HttpError(401, "Admin authorization required", {
        headers: { "WWW-Authenticate": "Basic realm=admin" },
      });
    }
    next();
  });

  router.get("/stats", (req, res) => res.json({ uptime: process.uptime() }));
  return router;
}

function createApiRouter(): RouterInstance {
  const router = new RouterCtor();
  const users = new Map<string, User>([
    ["1", { id: "1", name: "Ada" }],
    ["2", { id: "2", name: "Linus" }],
  ]);

  router.get("/users", (req, res) => res.ok({ users: Array.from(users.values()) }));

  router.get("/users/:id", (req, res) => {
    const user = users.get(req.params.id ?? "");
    if (!user) throw new HttpError(404, "User not found");
    res.ok(user);
  });

  router.post("/users", (req, res) => {
    const form = req.body as Record<string, unknown>;
    const id = crypto.randomUUID();
    const name = String(form?.name ?? "Anonymous");
    users.set(id, { id, name });
    res.created({ id, name });
  });

  router.post("/users/:id/preferences", (req, res) => {
    const data = req.body as Record<string, unknown>;
    const id = req.params.id;
    users.set(id, { id, name: String(data?.name ?? "Anonymous") });
    res.locals.updatedAt = new Date().toISOString();
    res.json({ saved: true, updatedAt: res.locals.updatedAt });
  });

  router.get(
    "/raw",
    (req, res) => {
      res.type("application/json").send(JSON.stringify({ message: "Raw response" }));
    }
  );

  return router;
}

export function createApp(): ReturnType<typeof bunway> {
  const app = bunway();

  const shouldLogRequests =
    Bun.env.BUNWAY_LOG_REQUESTS === "true" || Bun.env.NODE_ENV !== "production";

  app.use(
    cors({
      origin: (origin) => {
        if (!origin) return "*";
        if (origin.startsWith("http://localhost")) return origin;
        return false;
      },
      credentials: true,
      allowPrivateNetwork: true,
    })
  );

  app.use((req, res, next) => {
    if (!shouldLogRequests) {
      next();
      return;
    }
    const start = performance.now();
    res.locals.requestStart = start;
    next();
    const duration = performance.now() - start;
    console.log(
      `${req.method} ${req.path} -> ${res.statusCode} (${duration.toFixed(1)}ms)`
    );
  });

  app.use(json());
  app.use(urlencoded());
  app.use(text());

  app.use(
    errorHandler({
      logger: (err, req) => {
        console.error("Unhandled error", req.method, req.path, err);
      },
    })
  );

  app.use("/admin", createAdminRouter());
  app.use("/api", createApiRouter());

  app.get("/health", (req, res) => res.text("OK"));
  app.post("/echo", (req, res) => {
    res.ok({ body: req.body });
  });

  return app;
}

const PORT = Number(Bun.env.PORT ?? BUNWAY_DEFAULT_PORT);
const app = createApp();

app.listen({ port: PORT }, () => {
  console.log(`bunWay demo listening on http://localhost:${PORT}`);
});
