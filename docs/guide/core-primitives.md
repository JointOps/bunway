---
title: Request & Response
description: Explore bunWay's BunRequest and BunResponse helpers to understand how Express-compatible handlers work with Bun-native primitives.
---

# Request & Response

bunway decorates Bun's Fetch primitives with Express-compatible helpers. Understanding these building blocks makes it easier to compose middleware and handlers.

## Handler Signature

Every handler receives three arguments, just like Express:

```ts
app.use((req, res, next) => {
  console.log(req.method, req.path);
  next();
});
```

| Argument | Type           | Description                                    |
| -------- | -------------- | ---------------------------------------------- |
| `req`    | `BunRequest`   | Express-like request with params, query, body  |
| `res`    | `BunResponse`  | Express-like response with json(), send(), etc |
| `next`   | `NextFunction` | Call to continue the middleware chain          |

::: tip Coming from Express?
The signature is identical to Express: `(req, res, next)`. Your muscle memory works here.
:::

## BunRequest

`BunRequest` wraps Bun's native `Request` with Express-style helpers:

```ts
app.get("/users/:id", async (req, res) => {
  const id = req.param("id"); // or req.params.id
  const status = req.query.get("status");
  const body = req.body; // auto-parsed

  // Store data for downstream middleware
  req.locals.user = { id, status };

  return res.json({ id, status, body });
});
```

### Properties

| Property       | Type                     | Description                           |
| -------------- | ------------------------ | ------------------------------------- |
| `params`       | `Record<string, string>` | Route parameters (`:id`, `:slug`)     |
| `query`        | `URLSearchParams`        | Query string (`?foo=bar`)             |
| `body`         | `unknown`                | Parsed request body                   |
| `bodyType`     | `string \| null`         | Parser used: `json`, `urlencoded`, `text` |
| `locals`       | `Record<string, any>`    | Per-request storage for middleware    |
| `path`         | `string`                 | URL pathname                          |
| `method`       | `string`                 | HTTP method                           |
| `headers`      | `Headers`                | Request headers                       |
| `cookies`      | `Record<string, string>` | Parsed cookies (with `cookieParser()`) |
| `signedCookies`| `Record<string, string>` | Verified signed cookies               |
| `session`      | `Session`                | Session data (with `session()`)       |
| `original`     | `Request`                | Original Bun Request object           |

### Methods

```ts
// Parameter access
req.param("id"); // Get route parameter
req.get("Content-Type"); // Get header value

// Body parsing
await req.parseBody(); // Parse with current options
req.isBodyParsed(); // Check if already parsed
req.applyBodyParserOverrides({ json: { limit: 5_000_000 } });

// Raw access
await req.rawBody(); // Get raw body as ArrayBuffer
await req.rawText(); // Get raw body as string
```

::: tip Locals
Use `req.locals` as a per-request scratchpad. It's the standard Express pattern for sharing data between middleware:

```ts
// Auth middleware
app.use((req, res, next) => {
  req.locals.user = verifyToken(req.get("Authorization"));
  next();
});

// Route handler
app.get("/profile", (req, res) => {
  res.json(req.locals.user);
});
```

:::

## BunResponse

`BunResponse` provides Express-style response methods:

```ts
app.post("/sessions", async (req, res) => {
  const session = await createSession(req);
  return res
    .status(201)
    .header("Set-Cookie", `session=${session.id}; HttpOnly; Path=/`)
    .json({ id: session.id });
});
```

### Methods

| Method              | Description                                      |
| ------------------- | ------------------------------------------------ |
| `status(code)`      | Set status code (chainable)                      |
| `header(name, val)` | Set response header (chainable)                  |
| `json(data)`        | Send JSON response                               |
| `text(string)`      | Send text response                               |
| `send(body)`        | Send response (auto-detects type)                |
| `html(string)`      | Send HTML response                               |
| `redirect(url)`     | Redirect (302 by default)                        |
| `cookie(n, v, opt)` | Set a cookie                                     |
| `clearCookie(name)` | Clear a cookie                                   |

### Status helpers

```ts
res.ok({ data: "success" }); // 200
res.created({ id: 123 }); // 201
res.noContent(); // 204
res.badRequest("Invalid input"); // 400
res.unauthorized(); // 401
res.forbidden(); // 403
res.notFound(); // 404
```

::: tip Response builders
BunResponse methods return native Fetch `Response` objects, so you can pass them directly to Bun APIs without serialization.
:::

## Returning native Responses

Prefer the Fetch API? Return a `Response` directly and bunway will still merge middleware headers:

```ts
app.get("/raw", () => new Response("raw", { status: 200 }));

app.get("/stream", () => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue("Hello ");
      controller.enqueue("World");
      controller.close();
    },
  });
  return new Response(stream);
});
```

## Constants

### BUNWAY_DEFAULT_PORT

The default port used when `listen()` is called without a port argument:

```ts
import { BUNWAY_DEFAULT_PORT } from 'bunway';

console.log(BUNWAY_DEFAULT_PORT);  // 3000

// These are equivalent:
app.listen();
app.listen(BUNWAY_DEFAULT_PORT);
app.listen(3000);
```

## Custom Logger

bunWay supports plugging in your own logger (Pino, Winston, or any implementation):

```ts
import { bunway, errorHandler } from 'bunway';
import type { BunWayLogger } from 'bunway';

// Custom logger implementation
const customLogger: BunWayLogger = {
  info: (msg, meta) => console.log(`[INFO] ${msg}`, meta),
  warn: (msg, meta) => console.warn(`[WARN] ${msg}`, meta),
  error: (msg, meta) => console.error(`[ERROR] ${msg}`, meta),
  debug: (msg, meta) => console.debug(`[DEBUG] ${msg}`, meta),  // optional
};

const app = bunway();

// Set via app settings
app.set('logger', customLogger);

// Use with error handler
app.use(errorHandler({ useAppLogger: true }));
```

### BunWayLogger Interface

```ts
interface BunWayLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  debug?(message: string, meta?: Record<string, unknown>): void;  // optional
}
```

### Using Pino

```ts
import pino from 'pino';

const pinoLogger = pino();

const logger: BunWayLogger = {
  info: (msg, meta) => pinoLogger.info(meta, msg),
  warn: (msg, meta) => pinoLogger.warn(meta, msg),
  error: (msg, meta) => pinoLogger.error(meta, msg),
  debug: (msg, meta) => pinoLogger.debug(meta, msg),
};

app.set('logger', logger);
```

### Accessing the Logger

```ts
// Get the configured logger from anywhere with app access
const logger = app.getLogger();
logger.info('Application started', { port: 3000 });
```

## TypeScript Support

bunway exports all types for full TypeScript support:

```ts
import type {
  Handler,
  ErrorHandler,
  BunRequest,
  BunResponse,
  NextFunction,
  BunWayLogger,
  CookieOptions,
  RouterOptions,
  ListenOptions
} from "bunway";

const authMiddleware: Handler = (req, res, next) => {
  if (!req.get("Authorization")) {
    return res.unauthorized();
  }
  next();
};
```

## Next steps

With the primitives in mind, learn how routing works in bunway by reading the [Router](router.md) guide, then explore the built-in [Middleware](/middleware/index).
