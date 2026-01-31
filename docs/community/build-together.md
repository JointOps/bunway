---
title: Roadmap & Contributions
description: Explore bunWay's community roadmap, contribution guidelines, and current focus areas for Bun-native features.
---

# Roadmap & Contributions

bunway is a community-powered project building the Bun-native, Express-compatible web toolkit we want to use. This page shows what's shipped and what's next.

## Philosophy

- **Express-compatible** – same `(req, res, next)` signature and middleware patterns you know
- **Bun-native** – built on Bun's Fetch primitives, no Node polyfills
- **Batteries included** – one package for routing, middleware, sessions, security, observability
- **Community-led** – we build what developers actually need

<div class="timeline">
  <div class="timeline__node">
    <span class="timeline__badge success">Phase 0 · Complete</span>
    <h3>Core MVP</h3>
    <p>Express-compatible foundation with Bun-native primitives.</p>
    <ul>
      <li><code>BunRequest</code>, <code>BunResponse</code> with Express-style APIs</li>
      <li>Express-compatible <code>(req, res, next)</code> handler signature</li>
      <li>Router verbs, params, sub-routers, middleware, 404 fallback</li>
      <li><code>bunway()</code> factory + <code>app.listen()</code></li>
      <li>Built-ins: <code>errorHandler</code>, <code>cors</code>, <code>json</code>, <code>urlencoded</code>, <code>text</code></li>
      <li>Comprehensive Bun test suite</li>
    </ul>
  </div>
  <div class="timeline__node">
    <span class="timeline__badge success">Phase 1 · Complete</span>
    <h3>HTTP niceties & DX</h3>
    <p>Polished developer experience with essential middleware.</p>
    <ul>
      <li><code>cookieParser()</code> – parse/set cookies, signed cookies</li>
      <li><code>helmet()</code> – security headers</li>
      <li><code>compression()</code> – gzip/br compression</li>
      <li><code>serveStatic()</code> – static file serving with cache controls</li>
    </ul>
  </div>
  <div class="timeline__node">
    <span class="timeline__badge success">Phase 2 · Complete</span>
    <h3>Sessions & auth</h3>
    <p>Stateful applications with sessions and authentication.</p>
    <ul>
      <li><code>session()</code> – session middleware with Memory/File stores</li>
      <li><code>csrf()</code> – CSRF protection</li>
      <li><code>passport()</code> – authentication middleware</li>
    </ul>
  </div>
  <div class="timeline__node">
    <span class="timeline__badge progress">Phase 3 · In Progress</span>
    <h3>Streaming & uploads</h3>
    <p>Advanced request handling for modern applications.</p>
    <ul>
      <li class="done">WebSocket routing (types exported)</li>
      <li class="todo">Multipart/form-data streaming</li>
      <li class="todo">File upload constraints (size, type filters)</li>
      <li class="todo">Server-Sent Events helper</li>
    </ul>
  </div>
  <div class="timeline__node">
    <span class="timeline__badge progress">Phase 4 · In Progress</span>
    <h3>QoS & protection</h3>
    <p>Production-ready quality of service features.</p>
    <ul>
      <li class="done"><code>rateLimit()</code> – rate limiting with Memory store</li>
      <li class="todo">Request timeouts/aborts</li>
      <li class="todo">DoS protection (slowloris guards)</li>
    </ul>
  </div>
  <div class="timeline__node">
    <span class="timeline__badge success">Phase 5 · Complete</span>
    <h3>Observability</h3>
    <p>Visibility into your running applications.</p>
    <ul>
      <li><code>logger()</code> – morgan-style request logging</li>
      <li class="todo">Request IDs + trace propagation</li>
      <li class="todo">Metrics endpoint (Prometheus)</li>
    </ul>
  </div>
</div>

## Current focus areas

We're actively working on:

1. **File uploads** – multipart/form-data parsing with streaming support
2. **SSE helpers** – Server-Sent Events for real-time applications
3. **Request timeouts** – graceful handling of slow clients
4. **WebSocket routing** – sugar on top of `Bun.serve` WebSocket support

## How to contribute

::: tip Getting started
Pick an item from the roadmap, open an issue to discuss approach, and prototype using Bun's native APIs.
:::

1. **Pick a feature** – grab something from the roadmap that interests you
2. **Open an issue** – discuss the approach before diving in
3. **Prototype** – build on Bun's primitives, keep it lean
4. **Test & document** – Bun tests + docs updates
5. **Submit PR** – we'll review and iterate together

## Development workflow

```bash
bun install           # Install deps
bun run test          # Run test suite
bun run typecheck     # TypeScript check
bun run format        # Prettier formatting
bun run docs:dev      # VitePress docs (development)
```

`bun run prepare:dist` builds the publishable package.

## Community promise

bunway is built for developers who love Express patterns but want Bun's speed. We're creating the toolkit we wish existed: fast, native, expressive, and well-documented.

Jump in. Share ideas. Help us build the best Express-compatible framework for Bun.

<style>
.timeline__badge.success { background: #10b981; }
.timeline__badge.progress { background: #f59e0b; }
.done { color: #10b981; }
.done::before { content: "✓ "; font-weight: bold; }
.todo { color: #6b7280; }
.todo::before { content: "○ "; }
</style>
