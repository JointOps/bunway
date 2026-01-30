---
title: Getting Started
description: Learn how to install bunWay, wire up middleware, and build your first Bun-native server with familiar Express-style ergonomics.
---

# Getting Started

bunway lets you write Bun HTTP handlers with familiar Express-style ergonomics while staying 100% Bun-native. If you know Express, you already know bunway.

::: tip Coming from Express?
bunway uses the exact same `(req, res, next)` signature you're used to. Check out the [Express Migration Guide](./express-migration.md) for a side-by-side comparison.
:::

## Installation

```bash
bun add bunway
```

> bunway is Bun-only. Please do not attempt to use it from Node.js.

## Hello world

Spin up a minimal server to see bunway in action.

```ts
import bunway, { cors, json, errorHandler } from "bunway";

const app = bunway();

app.use(cors({ origin: true }));
app.use(json());
app.use(errorHandler({ logger: console.error }));

app.get("/", (req, res) => res.text("Hello from bunway"));

app.listen({ port: 7070 }, () => {
  console.log("bunway listening on http://localhost:7070");
});
```

::: tip Express patterns, Bun speed
Notice the familiar `(req, res)` signature? bunway mirrors Express patterns so you can start building immediately.
:::

## Requests & responses

Every handler receives `(req, res, next)`:

- `req` (BunRequest) - Express-like request object with `params`, `query`, `body`, `locals`, and more
- `res` (BunResponse) - Express-like response object with `json()`, `send()`, `status()`, and more
- `next` (NextFunction) - Call to continue the middleware chain

::: code-group

```ts [Server]
app.post("/echo", async (req, res) => {
  const body = await req.parseBody();
  return res.json({ received: body });
});
```

```bash [Client]
curl -X POST http://localhost:7070/echo \
  -H "Content-Type: application/json" \
  -d '{"hello":"bunway"}'
```

:::

::: tip Auto body parsing
By default, bunway parses JSON and URL-encoded bodies automatically. The parsed payload is available on `req.body` right away.
:::

Want the raw Fetch API? Return a `Response` directly and bunway will still apply middleware headers.

## Sub-routers

```ts
import { Router } from "bunway";

const api = new Router();
api.get("/users", (req, res) => res.json({ users: [] }));

const app = bunway();
app.use("/api", api);
```

::: tip Middleware inheritance
Mounted routers inherit global middleware (CORS, logging, error handling), so `/api` feels cohesive without extra wiring.
:::

## Middleware

bunway ships with Express-compatible middleware:

```ts
import bunway, { cors, json, helmet, session, logger } from "bunway";

const app = bunway();

app.use(logger("dev"));
app.use(cors({ origin: true }));
app.use(helmet());
app.use(json());
app.use(session({ secret: "keyboard cat" }));
```

See the [Middleware Overview](/middleware/index) for the full list.

## Testing with Bun

Use Bun's built-in test runner:

```ts
import { describe, it, expect } from "bun:test";
import bunway from "bunway";

describe("health", () => {
  it("returns OK", async () => {
    const app = bunway();
    app.get("/health", (req, res) => res.text("OK"));
    const res = await app.handle(new Request("http://localhost/health"));
    expect(await res.text()).toBe("OK");
  });
});
```

Run tests via `bun test`.

::: warning Testing tips
The Bun test runner resets global state between files. Keep fixtures explicit and prefer per-test setup/teardown to avoid surprises.
:::

## Next steps

- [Express Migration Guide](./express-migration.md) - Side-by-side comparison
- [Request & Response](./core-primitives.md) - Deep dive into BunRequest and BunResponse
- [Router Deep Dive](./router.md) - Middleware, sub-routers, and patterns
- [Middleware Overview](/middleware/index) - All built-in middleware

::: tip Project scaffolding
Looking for repo layout, scripts, and contributor workflow? See the repository [README](https://github.com/JointOps/bunway#readme) for setup details beyond runtime usage.
:::
