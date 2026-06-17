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
      <li><code>compression()</code> – gzip/br/deflate compression</li>
      <li><code>serveStatic()</code> – static file serving with cache controls</li>
    </ul>
  </div>
  <div class="timeline__node">
    <span class="timeline__badge success">Phase 2 · Complete</span>
    <h3>Sessions & auth</h3>
    <p>Stateful applications with sessions and authentication.</p>
    <ul>
      <li><code>session()</code> – session middleware with Memory/File stores</li>
      <li><code>csrf()</code> – CSRF protection (double-submit cookie pattern)</li>
    </ul>
  </div>
  <div class="timeline__node">
    <span class="timeline__badge success">Phase 3 · Complete</span>
    <h3>Streaming & uploads</h3>
    <p>Advanced request handling for modern applications.</p>
    <ul>
      <li><code>upload()</code> – multipart/form-data with memory & disk storage</li>
      <li><code>sse()</code> – Server-Sent Events with heartbeat support</li>
      <li>WebSocket routing (types exported)</li>
    </ul>
  </div>
  <div class="timeline__node">
    <span class="timeline__badge success">Phase 4 · Complete</span>
    <h3>QoS & protection</h3>
    <p>Production-ready quality of service features.</p>
    <ul>
      <li><code>rateLimit()</code> – rate limiting with Memory store</li>
      <li><code>timeout()</code> – request timeout with configurable response</li>
      <li><code>hpp()</code> – HTTP Parameter Pollution protection</li>
    </ul>
  </div>
  <div class="timeline__node">
    <span class="timeline__badge success">Phase 5 · Complete</span>
    <h3>Observability & DX polish</h3>
    <p>Visibility and developer utilities for production apps.</p>
    <ul>
      <li><code>logger()</code> – morgan-style request logging with color support</li>
      <li><code>requestId()</code> – request ID propagation</li>
      <li><code>responseTime()</code> – response time header</li>
      <li><code>methodOverride()</code> – HTTP method override for legacy clients</li>
      <li><code>favicon()</code> – efficient favicon serving with ETag caching</li>
      <li><code>validate()</code> – request validation middleware</li>
    </ul>
  </div>
  <div class="timeline__node">
    <span class="timeline__badge progress">Phase 6 · In Progress</span>
    <h3>Middleware hardening & 100% parity</h3>
    <p>Every middleware is working — now we're completing them to full parity with their Express counterparts and hardening with comprehensive test coverage.</p>
    <ul>
      <li class="todo">Full test suites for all 26 middleware</li>
      <li class="todo">100% option parity with Express counterpart packages</li>
      <li class="todo">Edge case coverage and stress testing</li>
      <li class="todo">Pluggable stores for rate-limit (Redis, etc.)</li>
      <li class="todo">Byte range support in <code>serveStatic</code></li>
      <li class="todo">IETF standard rate limit headers (draft-6)</li>
      <li class="todo">Metrics endpoint (Prometheus)</li>
    </ul>
  </div>
  <div class="timeline__node">
    <span class="timeline__badge upcoming">Phase 7 · Upcoming</span>
    <h3>Performance</h3>
    <p>Now that the DX layer is complete, the focus shifts to making bunway as fast as possible.</p>
    <ul>
      <li class="todo">Benchmark suite — establish baseline req/sec numbers</li>
      <li class="todo">Streaming compression (avoid buffering full responses)</li>
      <li class="todo">Header lookup optimisations</li>
      <li class="todo">Middleware chain allocation reduction</li>
      <li class="todo">Cookie parser — hand-rolled for speed</li>
    </ul>
  </div>
</div>

## Where we need help

All 26 middleware are working. Here's what's left — every item below is an open invitation:

- **Test coverage** – pick any middleware that interests you and write its test suite
- **Option parity** – compare a middleware against its Express counterpart, find a missing option, open an issue or send a PR
- **Pluggable stores** – `rateLimit` uses an in-memory store; Redis/custom adapters are a great contribution
- **Performance** – benchmarks, profiling, hot-path optimisations
- **Docs** – usage examples, migration guides, recipe pages

If something is missing or broken, **open an issue**. If you know how to fix it, **open a PR**. We review fast.

## How to contribute

::: tip Getting started
Pick something from the list above, open an issue to discuss the approach, and build on Bun's native APIs.
:::

1. **Pick a task** – anything in Phase 6 or 7, or something you hit in your own project
2. **Open an issue** – describe the gap, expected vs actual behaviour, and your proposed approach
3. **Build it** – use Bun's primitives, keep it lean, match Express API shape
4. **Test & document** – Bun tests + update the relevant docs page
5. **Submit a PR** – we'll review and iterate together

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

bunway is built for developers who love Express patterns but want Bun's speed. The DX foundation is done — now we're making it bulletproof and fast.

Jump in. Share ideas. Help us build the best Express-compatible framework for Bun.

<style>
.timeline__badge.success { background: #10b981; }
.timeline__badge.progress { background: #f59e0b; }
.timeline__badge.upcoming { background: #6366f1; }
.done { color: #10b981; }
.done::before { content: "✓ "; font-weight: bold; }
.todo { color: #6b7280; }
.todo::before { content: "○ "; }
</style>
