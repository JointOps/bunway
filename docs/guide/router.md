---
title: Router Deep Dive
description: Learn how bunWay's router composes middleware, sub-routers, and native Fetch responses while staying true to Bun.
---

# Router Deep Dive

bunway's router uses Express-style ergonomics while staying true to Bun's Fetch APIs. This page explains the lifecycle so you can compose middleware, sub-routers, and custom responses with confidence.

::: tip Coming from Express?
If you've used Express routing, you already know bunway routing. The patterns are identical.
:::

## Anatomy of a request

1. **Match** – incoming requests match routes by HTTP method + path (supporting `:params`).
2. **Pipeline** – global middleware → auto body parser → route-specific middleware/handlers.
3. **Execution** – each handler receives `(req, res, next)`. Call `next()` to continue the chain.
4. **Finalization** – the router chooses the final `Response` (explicit return, `res.last`, or default 200) and merges header bags (e.g., CORS) before returning.

## Registering routes

Define routes using familiar HTTP verb helpers. Each handler receives the Express-compatible `(req, res, next)` signature:

```ts
const app = bunway();

app.get("/health", (req, res) => res.text("OK"));
app.post("/users", async (req, res) => res.created(await req.parseBody()));
app.patch("/users/:id", async (req, res) => {
  const id = req.param("id");
  const updates = await req.parseBody();
  return res.json(await updateUser(id, updates));
});
```

### Multiple handlers

Chain middleware the same way you would in Express:

```ts
app.get("/users/:id", authMiddleware, loadUser, (req, res) => {
  res.json(req.locals.user);
});
```

Each handler can perform work, populate `req.locals`, and call `next()` to continue:

```ts
const authMiddleware = (req, res, next) => {
  const token = req.get("Authorization");
  if (!token) return res.unauthorized();
  req.locals.user = verifyToken(token);
  next();
};
```

## Middleware ordering

Global middleware runs in the order registered, followed by route-specific middleware:

```ts
app.use(cors()); // global
app.use(json()); // global
app.use(loggingMiddleware); // global

app.get("/secure", authMiddleware, (req, res) => {
  res.ok(req.locals.user);
});
```

- Global middleware runs before route-specific middleware.
- `req.isBodyParsed()` lets you skip redundant parsing.
- Middleware can return `Response` to short-circuit the pipeline (e.g., auth failures).

## Sub-routers

Group related endpoints into sub-routers for better organization:

```ts
import { Router } from "bunway";

const api = new Router();
api.get("/users", listUsers);
api.get("/users/:id", showUser);

app.use("/api", api);
```

Sub-routers inherit parent middleware and can register their own `router.use()` handlers.

::: tip Sub-router inheritance
Middleware registered on the parent app runs before sub-router handlers. Add router-specific middleware inside the router for scoped behaviour.
:::

### Nested routers

Routers can be nested multiple levels deep:

```ts
const admin = new Router();
admin.use(requireAdmin);
admin.get("/stats", getStats);

api.use("/admin", admin);
// Full path: /api/admin/stats
```

::: tip Returning native responses
Handlers can always return `Response` objects straight from Fetch APIs—bunWay will still merge any middleware headers during finalization.
:::

## Error handling

- Throw `HttpError` for explicit status/body/headers.
- Throw/return `Response` for fully custom responses.
- Use `errorHandler()` middleware for logging/mapping.
- Unhandled errors fall back to a safe 500 JSON payload.

```ts
import { HttpError } from "bunway";

app.get("/secret", () => {
  throw new HttpError(403, "Forbidden");
});
```

## 404 behaviour

Unmatched routes return:

```json
HTTP/1.1 404 Not Found
Content-Type: application/json
{"error":"Not Found"}
```

Customize by adding a catch-all route at the end:

```ts
app.use((req, res) => res.status(404).json({ error: "Route not found" }));
```

::: warning Catch-all
Be sure to register catch-all handlers last—bunway processes middleware in order, so earlier routes can short-circuit the response.
:::

## Body parser defaults

Routers accept body parser defaults via constructor:

```ts
const router = new Router({
  bodyParser: {
    json: { limit: 2 * 1024 * 1024 },
    text: { enabled: true },
  },
});
```

Handlers can override parsing dynamically with `req.applyBodyParserOverrides()`.

## Recipes

### Request logger

```ts
app.use(async (req, res, next) => {
  const start = performance.now();
  await next();
  const ms = (performance.now() - start).toFixed(1);
  console.log(`${req.method} ${req.path} → ${res.statusCode} (${ms}ms)`);
});
```

Or use the built-in logger:

```ts
import { logger } from "bunway";
app.use(logger("dev"));
```

### Admin-only sub-router

```ts
import { Router, HttpError } from "bunway";

const admin = new Router();

admin.use((req, res, next) => {
  if (req.get("Authorization") !== "super-secret") {
    throw new HttpError(401, "Admin authorization required");
  }
  next();
});

admin.get("/stats", (req, res) => {
  res.json({ uptime: process.uptime() });
});

app.use("/admin", admin);
```

### Per-request body parser override

```ts
app.post("/webhook", async (req, res) => {
  req.applyBodyParserOverrides({ text: { enabled: true }, json: { enabled: false } });
  const payload = await req.parseBody();
  return res.ok({ received: payload });
});
```

## Advanced patterns

- **Streaming**: work directly with `await req.rawBody()` or `req.original.body` for streams.
- **Locals**: share data across middleware via `req.locals` (e.g., `req.locals.user = user`).
- **Async cleanup**: run code after `await next()` to implement logging, timers, or metrics.

---

Continue to [Middleware Overview](/middleware/index) or explore type-level details in the [API Reference](/api/index.html).
