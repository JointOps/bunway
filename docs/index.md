---
layout: home
title: "bunWay"
description: "bunWay is a Bun-native routing toolkit inspired by Express, offering familiar middleware, routing, and batteries-included DX."
hero:
  name: "bunWay"
  text: "Bun-native routing toolkit"
  tagline: "Run everything. The Bun way."
  image:
    src: "/hero-bun.svg"
    alt: "Bun Way hero illustration"
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View Roadmap
      link: /community/build-together
features:
  - title: "⚡ Bun-first"
    details: Built directly on Bun's Request/Response primitives, Bun.serve, and test runner—no Node polyfills.
  - title: "🧭 Express-friendly"
    details: Familiar middleware, routers, and helpers make the transition from Express effortless.
  - title: "🔋 Batteries included"
    details: Body parsers, CORS, error handling, TypeDoc, VitePress docs, and a roadmap toward cookies, sessions, auth, and more.
---

::: info Why bunWay?
- Bun-first: built around Bun.serve, native Request/Response objects, and the Bun test runner.
- Express-friendly: plug into familiar middleware and router patterns without losing Fetch semantics.
- Batteries included: JSON parsers, CORS, error handling, docs, and a roadmap toward sessions, cookies, and more.
:::

## Try it in 30 seconds

```ts
import { bunway, cors, json } from "bunway";

const app = bunway();
app.use(cors({ origin: true }));
app.use(json());

app.get("/hello", (ctx) => ctx.res.json({ message: "Run everything. The Bun way." }));

app.listen(7070);
```

Drop the snippet into `bun run` and see Bun-native routing in action.

## What you'll find here

<div class="features-list">
  <div class="feature">
    <span class="feature__icon">📚</span>
    <div class="feature__body">
      <h3>Core Primitives</h3>
      <p>Deep dive into <a href="/guide/core-primitives">WayRequest, WayResponse, and WayContext</a> to master the building blocks.</p>
    </div>
  </div>
  <div class="feature">
    <span class="feature__icon">🗺️</span>
    <div class="feature__body">
      <h3>Router</h3>
      <p>Understand the <a href="/guide/router">routing lifecycle, middleware pipelines, and sub-routers</a> with Bun-first ergonomics.</p>
    </div>
  </div>
  <div class="feature">
    <span class="feature__icon">🧩</span>
    <div class="feature__body">
      <h3>Middleware</h3>
      <p>Explore <a href="/middleware/index">body parsing, CORS, and error handling</a> tutorials to keep everything Bun-native.</p>
    </div>
  </div>
  <div class="feature">
    <span class="feature__icon">🤝</span>
    <div class="feature__body">
      <h3>Build Together</h3>
      <p>Jump into the <a href="/community/build-together">roadmap and contribution guide</a> to help shape bunWay.</p>
    </div>
  </div>
</div>

## Ready to run everything the Bun way?

Start with the [Getting Started guide](/guide/getting-started), then star us on [GitHub](https://github.com/JointOps/bunway) and help shape the toolkit.
