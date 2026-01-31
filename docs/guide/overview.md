---
title: Overview
description: Discover bunWay's mission to bring Express-style routing to Bun, its goals, current features, and the roadmap ahead.
---

# Overview

bunway brings Express-compatible routing to Bun without sacrificing Bun's native speed. The goal is simple: **if you know Express, you know bunway**.

::: tip Express Compatibility
bunway uses the exact same `(req, res, next)` handler signature as Express. Your existing middleware patterns work here.
:::

## Who is bunway for?

- **Express developers** wanting Bun's speed without learning a new API
- **Teams** migrating Node.js apps to Bun
- **Anyone** who prefers the battle-tested Express patterns over newer abstractions

## Goals

- **Express-compatible** – same `(req, res, next)` signature, familiar middleware patterns
- **Bun-native** – built on Bun's Fetch primitives (`Request`, `Response`, `Bun.serve`)
- **Batteries included** – 12+ middleware covering most production needs
- **Zero dependencies** – pure Bun, no Node polyfills

## Current capabilities (v1.0.0)

bunway ships with everything you need for production apps:

### Core

- `bunway()` factory with `app.listen()`
- Express-compatible `(req, res, next)` handler signature
- `BunRequest` and `BunResponse` helpers
- Sub-routers with middleware inheritance
- Router finalizer that merges middleware headers

### Built-in Middleware

| Middleware       | Description                    | Express Equivalent    |
| ---------------- | ------------------------------ | --------------------- |
| `json()`         | JSON body parsing              | `express.json()`      |
| `urlencoded()`   | URL-encoded body parsing       | `express.urlencoded()`|
| `text()`         | Text body parsing              | `body-parser.text()`  |
| `cors()`         | CORS handling                  | `cors`                |
| `helmet()`       | Security headers               | `helmet`              |
| `session()`      | Session management             | `express-session`     |
| `cookieParser()` | Cookie parsing                 | `cookie-parser`       |
| `compression()`  | Response compression           | `compression`         |
| `serveStatic()`  | Static file serving            | `express.static()`    |
| `rateLimit()`    | Rate limiting                  | `express-rate-limit`  |
| `csrf()`         | CSRF protection                | `csurf`               |
| `passport()`     | Authentication                 | `passport`            |
| `logger()`       | Request logging                | `morgan`              |
| `errorHandler()` | Error handling                 | Custom middleware     |

## Quick example

```ts
import bunway, { cors, json, helmet, session, logger } from "bunway";

const app = bunway();

// Familiar middleware stack
app.use(logger("dev"));
app.use(cors({ origin: true }));
app.use(helmet());
app.use(json());
app.use(session({ secret: "keyboard cat" }));

// Express-style routes
app.get("/", (req, res) => res.json({ message: "Hello bunway!" }));

app.get("/users/:id", (req, res) => {
  res.json({ id: req.params.id });
});

app.listen({ port: 3000 });
```

## What's next?

Most core features are complete. Active development focuses on:

- **Streaming & uploads** – multipart parsing, file uploads, SSE helpers
- **Advanced WebSocket** – routing sugar on top of `Bun.serve`
- **Performance** – continued optimization and benchmarking

See [Roadmap & Contributions](../community/build-together.md) for the full picture.

## Philosophy

- **Express patterns, Bun speed**: Familiar APIs, native performance
- **Community-led**: We build what developers actually need
- **Transparent**: Full TypeScript support with documented types

Ready to build? Continue with [Getting Started](getting-started.md) or jump to the [Express Migration Guide](express-migration.md).
