---
title: Coming from Express?
description: Migrate from Express to bunWay with zero learning curve. Same patterns, same middleware, just faster.
---

# Coming from Express?

If you've built Express apps, you already know bunWay. We designed it that way.

::: tip Zero Learning Curve
bunWay uses the same patterns, same middleware names, and same API conventions you already know from Express. The only difference? It runs on Bun—and it's faster.
:::

## Side-by-Side Comparison

### Express (Node.js)

```js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const session = require('express-session');
const morgan = require('morgan');

const app = express();

app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(session({ secret: 'keyboard cat' }));

app.get('/users/:id', (req, res) => {
  res.json({ id: req.params.id });
});

app.listen(3000);
```

### bunWay (Bun)

```ts
import { bunway, cors, helmet, logger, json, session } from 'bunway';

const app = bunway();

app.use(cors());
app.use(helmet());
app.use(logger('dev'));
app.use(json());
app.use(session({ secret: 'keyboard cat' }));

app.get('/users/:id', (req, res) => {
  res.json({ id: req.params.id });
});

app.listen(3000);
```

The difference? One `import` statement. Everything else is the same.

## Middleware Mapping

Every Express middleware you know has a bunWay equivalent—built right in:

| Express | bunWay | What it does |
|---------|--------|--------------|
| `express.json()` | `json()` | Parse JSON request bodies |
| `express.urlencoded()` | `urlencoded()` | Parse URL-encoded form data |
| `express.text()` | `text()` | Parse text request bodies |
| `express.raw()` | `raw()` | Parse raw binary bodies (webhooks) |
| `express.static()` | `serveStatic()` | Serve static files |
| `cors` | `cors()` | Handle CORS headers |
| `helmet` | `helmet()` | Set security headers |
| `morgan` | `logger()` | Request logging |
| `express-session` | `session()` | Session management |
| `passport` | `passport()` | Authentication |
| `csurf` | `csrf()` | CSRF protection |
| `compression` | `compression()` | Gzip/deflate compression |
| `express-rate-limit` | `rateLimit()` | Rate limiting |
| `cookie-parser` | `cookieParser()` | Parse cookies |
| `multer` | `upload()` | File uploads (multipart) |

No more hunting through npm. No more version conflicts. It's all built-in.

## API Comparison

### Request Object

| Express | bunWay | Notes |
|---------|--------|-------|
| `req.params` | `req.params` | Identical |
| `req.query` | `req.query` | Identical |
| `req.body` | `req.body` | Identical |
| `req.cookies` | `req.cookies` | Identical |
| `req.path` | `req.path` | Identical |
| `req.method` | `req.method` | Identical |
| `req.get('header')` | `req.get('header')` | Identical |
| `req.ip` | `req.ip` | Identical |
| `req.session` | `req.session` | With session middleware |
| `req.protocol` | `req.protocol` | Identical (respects X-Forwarded-Proto with trust proxy) |
| `req.secure` | `req.secure` | Identical |
| `req.fresh` / `req.stale` | `req.fresh` / `req.stale` | ETag + Last-Modified cache validation |
| `req.range(size)` | `req.range(size)` | Range header parsing for partial content |

### Response Object

| Express | bunWay | Notes |
|---------|--------|-------|
| `res.json()` | `res.json()` | Identical |
| `res.send()` | `res.send()` | Identical |
| `res.status()` | `res.status()` | Identical |
| `res.set()` | `res.set()` | Identical |
| `res.cookie()` | `res.cookie()` | Identical |
| `res.redirect()` | `res.redirect()` | Identical |
| `res.sendStatus()` | `res.sendStatus()` | Identical |
| `res.sendFile()` range | `res.sendFile()` range | Automatic 206 Partial Content with `Accept-Ranges: bytes` |
| `res.jsonp(data)` | `res.jsonp(data)` | JSONP with configurable callback name |

### Routing

| Express | bunWay | Notes |
|---------|--------|-------|
| `app.get()` | `app.get()` | Identical |
| `app.post()` | `app.post()` | Identical |
| `app.put()` | `app.put()` | Identical |
| `app.delete()` | `app.delete()` | Identical |
| `app.use()` | `app.use()` | Identical |
| `app.route('/path')` | `app.route('/path')` | Chainable route definitions |
| `express.Router()` | `bunway.Router()` | Same pattern |
| `Router({ mergeParams: true })` | `Router({ mergeParams: true })` | Inherit parent route params |
| `req.res` / `res.req` | `req.res` / `res.req` | Cross-references set during dispatch |
| `res.app` | `res.app` | Access app instance from response |
| `app.use([paths], handler)` | `app.use([paths], handler)` | Array path mounting |
| `https.createServer(opts, app)` | `app.listen({ tls: opts })` | Native TLS support |
| `server.close(callback)` | `app.close(callback)` | Graceful shutdown |

## Migration Examples

### Body Parsing

**Express:**
```js
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
```

**bunWay:**
```ts
app.use(json({ limit: '10mb' }));
app.use(urlencoded({ extended: true }));
```

### Session Management

**Express:**
```js
const session = require('express-session');
app.use(session({
  secret: 'my-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 86400000 }
}));
```

**bunWay:**
```ts
import { session } from 'bunway';
app.use(session({
  secret: 'my-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 86400000 }
}));
```

### Static Files

**Express:**
```js
app.use(express.static('public'));
app.use('/assets', express.static('assets', { maxAge: '1d' }));
```

**bunWay:**
```ts
app.use(serveStatic('public'));
app.use('/assets', serveStatic('assets', { maxAge: 86400000 }));
```

### Request Logging

**Express:**
```js
const morgan = require('morgan');
app.use(morgan('combined'));
app.use(morgan(':method :url :status :response-time ms'));
```

**bunWay:**
```ts
import { logger } from 'bunway';
app.use(logger('combined'));
app.use(logger(':method :url :status :response-time ms'));
```

Same format strings. Same output.

### Security Headers

**Express:**
```js
const helmet = require('helmet');
app.use(helmet());
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
```

**bunWay:**
```ts
import { helmet } from 'bunway';
app.use(helmet());
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
```

### Rate Limiting

**Express:**
```js
const rateLimit = require('express-rate-limit');
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
}));
```

**bunWay:**
```ts
import { rateLimit } from 'bunway';
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
}));
```

### Sub-Routers

**Express:**
```js
const router = express.Router();
router.get('/profile', (req, res) => res.json({ user: 'me' }));
app.use('/api', router);
```

**bunWay:**
```ts
const router = bunway.Router();
router.get('/profile', (req, res) => res.json({ user: 'me' }));
app.use('/api', router);
```

## Why Switch?

### Speed
Bun is significantly faster than Node.js. Your Express-style code runs faster without any changes.

### Simplicity
- No `node_modules` with thousands of packages
- No version conflicts between middleware
- Native TypeScript—no build step needed

### Batteries Included
Stop hunting for middleware on npm. Everything you need is built-in:
- Body parsing
- CORS
- Sessions
- Security headers
- Logging
- Rate limiting
- Static files
- Compression
- CSRF protection

### Zero Learning Curve
You already know how to use bunWay. Same patterns. Same API. Just faster.

## Quick Start

```bash
bun add bunway
```

```ts
import { bunway, json, cors, helmet, logger } from 'bunway';

const app = bunway();

app.use(cors());
app.use(helmet());
app.use(logger('dev'));
app.use(json());

app.get('/', (req, res) => {
  res.json({ message: 'Hello from bunWay!' });
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

That's it. You're running on Bun.

## Content Negotiation (v1.0.8+)

bunWay now implements RFC 7231 quality-value parsing for all `req.accepts*()` methods.
This means headers like `Accept: text/html;q=0.9, application/json` are parsed correctly
with proper priority ordering — identical to Express's `accepts` package.

### req.is() — MIME Type Matching

bunWay's `req.is()` now supports MIME type wildcards:

```typescript
// These all work like Express:
req.is("json")           // matches "application/json"
req.is("text/*")         // matches "text/html", "text/plain", etc.
req.is("application/*")  // matches "application/json", "application/xml", etc.
```

### res.send() — Auto Content-Type Detection

`res.send()` now auto-detects Content-Type like Express:

```typescript
res.send("Hello")        // → Content-Type: text/html; charset=utf-8
res.send({ ok: true })   // → Content-Type: application/json (delegates to json())
res.send(buffer)         // → Content-Type: application/octet-stream
```

### Regex Routes

bunWay now supports regex route patterns:

```typescript
app.get(/\/fly$/, (req, res) => { ... });
app.get(/\/users\/(?<id>\d+)/, (req, res) => {
  res.json({ id: req.params.id }); // Named capture groups become params
});
```

### Catch-all Routes

```typescript
app.all("*", (req, res) => {
  res.status(404).json({ error: "Not Found" });
});
```

### Sub-App Mounting

```typescript
const admin = bunway();
app.use("/admin", admin);
console.log(admin.mountpath); // "/admin"
console.log(admin.path());   // "/admin"
```

## What's Different?

Just two things:

1. **Import style**: ES modules only (no `require()`)
2. **Runtime**: Bun, not Node.js

That's it. The handler signature is identical: `(req, res, next)`.

---

Ready to migrate? Check out the [Getting Started](/guide/getting-started) guide or browse the [Middleware](/middleware/index) documentation.
