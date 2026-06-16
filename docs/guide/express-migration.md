---
title: Coming from Express?
description: Migrate from Express to bunWay — same API, same patterns, zero rewrites.
---

# Coming from Express?

You already know bunWay. Same `(req, res, next)` signature, same middleware names, same routing patterns. Three things change on the way in:

<div class="migration-steps">
  <div class="migration-step">
    <span class="step-num">1</span>
    <span class="step-title">Change the import</span>
    <span class="step-desc"><code>require()</code> → <code>import</code></span>
  </div>
  <div class="migration-step">
    <span class="step-num">2</span>
    <span class="step-title">Rename the factory</span>
    <span class="step-desc"><code>express()</code> → <code>bunway()</code></span>
  </div>
  <div class="migration-step">
    <span class="step-num">3</span>
    <span class="step-title">Delete npm middleware</span>
    <span class="step-desc">23 built-ins ship with bunWay — no installs needed</span>
  </div>
</div>

<div class="stats-strip">
  <div class="stat-item">
    <span class="stat-number">23</span>
    <span class="stat-label">Built-in middleware</span>
  </div>
  <div class="stat-item">
    <span class="stat-number">0</span>
    <span class="stat-label">npm dependencies</span>
  </div>
  <div class="stat-item">
    <span class="stat-number">~1.6×</span>
    <span class="stat-label">Faster than Express</span>
  </div>
</div>

## The Diff

Here's a real Express app migrated to bunWay. Every unmarked line is untouched.

```js
const express = require('express') // [!code --]
const cors    = require('cors')    // [!code --]
const helmet  = require('helmet')  // [!code --]
const morgan  = require('morgan')  // [!code --]
import { bunway, cors, helmet, logger, json, session } from 'bunway' // [!code ++]

const app = express() // [!code --]
const app = bunway()  // [!code ++]

app.use(cors())
app.use(helmet())
app.use(morgan('dev')) // [!code --]
app.use(logger('dev')) // [!code ++]
app.use(express.json()) // [!code --]
app.use(json())         // [!code ++]
app.use(session({ secret: 'keyboard cat' }))

app.get('/users/:id', (req, res) => {
  res.json({ id: req.params.id })
})

app.listen(3000)
```

## What's Different

::: warning Only two things change
1. **ES modules only** — use `import` instead of `require()`. bunWay is TypeScript-first and ships no CommonJS build.
2. **Bun runtime** — run with `bun server.ts` instead of `node server.js`.

The handler signature `(req, res, next)`, every method, every property — identical.
:::

## Middleware Replacements

Delete the npm package and update the import. The API is identical unless noted in the [full reference](#api-reference) below.

### Body Parsing

<div class="swap-grid">
  <div class="swap-card"><code class="swap-old">express.json()</code><span class="swap-arrow">→</span><code class="swap-new">json()</code></div>
  <div class="swap-card"><code class="swap-old">express.urlencoded()</code><span class="swap-arrow">→</span><code class="swap-new">urlencoded()</code></div>
  <div class="swap-card"><code class="swap-old">body-parser.text()</code><span class="swap-arrow">→</span><code class="swap-new">text()</code></div>
  <div class="swap-card"><code class="swap-old">body-parser.raw()</code><span class="swap-arrow">→</span><code class="swap-new">raw()</code></div>
</div>

### Security

<div class="swap-grid">
  <div class="swap-card"><code class="swap-old">helmet</code><span class="swap-arrow">→</span><code class="swap-new">helmet()</code></div>
  <div class="swap-card"><code class="swap-old">express-rate-limit</code><span class="swap-arrow">→</span><code class="swap-new">rateLimit()</code></div>
  <div class="swap-card"><code class="swap-old">csurf</code><span class="swap-arrow">→</span><code class="swap-new">csrf()</code></div>
  <div class="swap-card"><code class="swap-old">hpp</code><span class="swap-arrow">→</span><code class="swap-new">hpp()</code></div>
  <div class="swap-card"><code class="swap-old">express-session</code><span class="swap-arrow">→</span><code class="swap-new">session()</code></div>
  <div class="swap-card"><code class="swap-old">cookie-parser</code><span class="swap-arrow">→</span><code class="swap-new">cookieParser()</code></div>
</div>

### Files & Assets

<div class="swap-grid">
  <div class="swap-card"><code class="swap-old">express.static()</code><span class="swap-arrow">→</span><code class="swap-new">serveStatic()</code></div>
  <div class="swap-card"><code class="swap-old">multer</code><span class="swap-arrow">→</span><code class="swap-new">upload()</code></div>
  <div class="swap-card"><code class="swap-old">serve-favicon</code><span class="swap-arrow">→</span><code class="swap-new">favicon()</code></div>
  <div class="swap-card"><code class="swap-old">compression</code><span class="swap-arrow">→</span><code class="swap-new">compression()</code></div>
</div>

### Observability & Utilities

<div class="swap-grid">
  <div class="swap-card"><code class="swap-old">morgan</code><span class="swap-arrow">→</span><code class="swap-new">logger()</code></div>
  <div class="swap-card"><code class="swap-old">response-time</code><span class="swap-arrow">→</span><code class="swap-new">responseTime()</code></div>
  <div class="swap-card"><code class="swap-old">express-request-id</code><span class="swap-arrow">→</span><code class="swap-new">requestId()</code></div>
  <div class="swap-card"><code class="swap-old">method-override</code><span class="swap-arrow">→</span><code class="swap-new">methodOverride()</code></div>
  <div class="swap-card"><code class="swap-old">connect-timeout</code><span class="swap-arrow">→</span><code class="swap-new">timeout()</code></div>
  <div class="swap-card"><code class="swap-old">cors</code><span class="swap-arrow">→</span><code class="swap-new">cors()</code></div>
  <div class="swap-card"><code class="swap-old">express-validator</code><span class="swap-arrow">→</span><code class="swap-new">validate()</code></div>
  <div class="swap-card"><code class="swap-old">express-sse</code><span class="swap-arrow">→</span><code class="swap-new">sse()</code></div>
  <div class="swap-card"><code class="swap-old">custom 4-arg middleware</code><span class="swap-arrow">→</span><code class="swap-new">errorHandler()</code></div>
</div>

## API Reference

The request and response objects are 1:1 with Express. Open any section — <span class="badge-same">identical</span> means zero code changes, <span class="badge-plus">enhanced</span> means bunWay is a superset.

<AccordionSection>

<AccordionItem title="Request — properties">

| Property | Status |
|---|---|
| `req.params` | <span class="badge-same">identical</span> |
| `req.query` | <span class="badge-same">identical</span> |
| `req.body` | <span class="badge-same">identical</span> |
| `req.cookies` | <span class="badge-same">identical</span> |
| `req.path` | <span class="badge-same">identical</span> |
| `req.method` | <span class="badge-same">identical</span> |
| `req.ip` | <span class="badge-same">identical</span> |
| `req.session` | <span class="badge-same">identical</span> |
| `req.protocol` | <span class="badge-same">identical</span> |
| `req.secure` | <span class="badge-same">identical</span> |

</AccordionItem>

<AccordionItem title="Request — methods">

| Method | Status | Notes |
|---|---|---|
| `req.get(header)` | <span class="badge-same">identical</span> | |
| `req.fresh` / `req.stale` | <span class="badge-same">identical</span> | ETag + Last-Modified cache validation |
| `req.range(size)` | <span class="badge-same">identical</span> | Range header parsing |
| `req.param(name)` | <span class="badge-same">identical</span> | params → body → query |
| `req.acceptsCharsets()` | <span class="badge-same">identical</span> | |
| `req.acceptsEncodings()` | <span class="badge-same">identical</span> | |
| `req.acceptsLanguages()` | <span class="badge-same">identical</span> | |
| `req.is(type)` | <span class="badge-plus">enhanced</span> | Supports `text/*` and `application/*` wildcards |
| `req.accepts(type)` | <span class="badge-plus">enhanced</span> | RFC 7231 quality-value parsing |

</AccordionItem>

<AccordionItem title="Response — methods">

| Method | Status | Notes |
|---|---|---|
| `res.json()` | <span class="badge-same">identical</span> | |
| `res.send()` | <span class="badge-plus">enhanced</span> | Auto content-type detection + chainable |
| `res.status()` | <span class="badge-same">identical</span> | |
| `res.set()` | <span class="badge-same">identical</span> | |
| `res.cookie()` | <span class="badge-same">identical</span> | |
| `res.redirect()` | <span class="badge-same">identical</span> | |
| `res.sendStatus()` | <span class="badge-same">identical</span> | |
| `res.sendFile()` | <span class="badge-plus">enhanced</span> | Automatic 206 Partial Content |
| `res.jsonp()` | <span class="badge-same">identical</span> | |
| `res.download()` | <span class="badge-plus">enhanced</span> | Optional error callback |
| `res.attachment()` | <span class="badge-plus">enhanced</span> | Auto content-type detection |
| `res.end()` | <span class="badge-plus">enhanced</span> | Encoding + callback support |

</AccordionItem>

<AccordionItem title="Routing & server">

| API | Status | Notes |
|---|---|---|
| `app.get/post/put/delete()` | <span class="badge-same">identical</span> | |
| `app.use()` | <span class="badge-same">identical</span> | Array path mounting supported |
| `app.route(path)` | <span class="badge-same">identical</span> | Chainable route definitions |
| `import { Router } from "bunway"` | <span class="badge-same">identical</span> | Was `express.Router()` |
| `Router({ mergeParams: true })` | <span class="badge-same">identical</span> | |
| `req.res` / `res.req` | <span class="badge-same">identical</span> | Cross-references set during dispatch |
| `res.app` | <span class="badge-same">identical</span> | |
| Regex routes | <span class="badge-new">new</span> | `app.get(/\/fly$/, handler)` |
| `app.all('*', handler)` | <span class="badge-same">identical</span> | |
| Sub-app mounting | <span class="badge-plus">enhanced</span> | `app.mountpath` + `app.path()` |
| `app.listen({ tls: opts })` | <span class="badge-plus">enhanced</span> | Native TLS — no `https.createServer()` |
| `app.close(cb)` | <span class="badge-same">identical</span> | |

</AccordionItem>

</AccordionSection>

---

Ready? [Get started →](/guide/getting-started) or jump straight to [Middleware →](/middleware/index)
