---
layout: home
title: "bunWay"
description: "bunWay is a Bun-native routing toolkit with Express-compatible APIs. Same middleware, same patterns—just faster."
hero:
  name: "bunWay"
  text: "Express patterns. Bun speed."
  tagline: "If you know Express, you know bunWay."
  image:
    src: "/hero-bun.svg"
    alt: "Bun Way hero illustration"
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: Coming from Express?
      link: /guide/express-migration
features:
  - title: "⚡ Bun-first"
    details: Built directly on Bun's Request/Response primitives, Bun.serve, and test runner—no Node polyfills.
  - title: "🧭 Express-compatible"
    details: Same middleware names, same API patterns. helmet(), session(), logger()—they all work exactly as you expect.
  - title: "🔋 Batteries included"
    details: Body parsing, CORS, sessions, security headers, rate limiting, compression, static files—all built-in.
---

## Know Express? You Know bunWay.

bunWay brings Express patterns to Bun. Same middleware, same routing, same API—just faster.

| Express | bunWay |
|---------|--------|
| `express.json()` | `json()` |
| `express.static()` | `serveStatic()` |
| `helmet` | `helmet()` |
| `morgan` | `logger()` |
| `express-session` | `session()` |
| `express-rate-limit` | `rateLimit()` |

[See the full migration guide →](/guide/express-migration)

## Try it in 30 seconds

```ts
import { bunway, cors, helmet, logger, json, session } from "bunway";

const app = bunway();

app.use(cors());
app.use(helmet());
app.use(logger('dev'));
app.use(json());
app.use(session({ secret: 'my-secret' }));

app.get("/users/:id", (req, res) => {
  res.json({ id: req.params.id });
});

app.listen(3000);
```

Same code you'd write in Express. Just faster.

## What you'll find here

<div class="features-list">
  <div class="feature">
    <span class="feature__icon">🔄</span>
    <div class="feature__body">
      <h3>Express Migration</h3>
      <p>Coming from Express? Check out the <a href="/guide/express-migration">migration guide</a> for a side-by-side comparison.</p>
    </div>
  </div>
  <div class="feature">
    <span class="feature__icon">🧩</span>
    <div class="feature__body">
      <h3>Middleware</h3>
      <p>Explore <a href="/middleware/index">all built-in middleware</a>: sessions, security, logging, rate limiting, and more.</p>
    </div>
  </div>
  <div class="feature">
    <span class="feature__icon">🗺️</span>
    <div class="feature__body">
      <h3>Router</h3>
      <p>Understand the <a href="/guide/router">routing lifecycle, middleware pipelines, and sub-routers</a>.</p>
    </div>
  </div>
  <div class="feature">
    <span class="feature__icon">📚</span>
    <div class="feature__body">
      <h3>Core Primitives</h3>
      <p>Deep dive into <a href="/guide/core-primitives">request, response, and context</a> objects.</p>
    </div>
  </div>
</div>

## Ready to try Bun without learning a new framework?

```bash
bun add bunway
```

Start with the [Getting Started guide](/guide/getting-started) or jump straight to the [Express migration guide](/guide/express-migration).
