---
title: Middleware Overview
description: All built-in middleware in bunWay—sessions, security, logging, rate limiting, static files, and more. Express-compatible APIs, Bun-native performance.
---

# Middleware Overview

bunWay ships with a complete set of Express-compatible middleware—no npm hunting required. Same APIs you know, just faster.

::: tip Authentication
Choosing between JWT, Passport, and Token Vault? See the [Authentication overview](./auth) for how they compare and compose.
:::

## Built-in Middleware

| bunWay | Express Equivalent | Description |
|--------|-------------------|-------------|
| [`json()`](body-parsing.md) | `express.json()` | Parse JSON request bodies |
| [`urlencoded()`](body-parsing.md) | `express.urlencoded()` | Parse URL-encoded form data |
| [`text()`](body-parsing.md) | `express.text()` | Parse plain text bodies |
| [`raw()`](body-parsing.md) | `body-parser.raw()` | Parse raw binary request bodies |
| [`cors()`](cors.md) | `cors` | Handle CORS headers and preflight |
| [`helmet()`](security.md) | `helmet` | Set security headers |
| [`session()`](session.md) | `express-session` | Session management with stores |
| [`logger()`](logger.md) | `morgan` | Request logging with formats |
| [`csrf()`](csrf.md) | `csurf` | CSRF protection |
| [`jwt()`](jwt.md) / [`jwtSign()`](jwt.md) / [`jwtDecode()`](jwt.md) | `express-jwt` | Bearer JWT verification, signing, decoding |
| [`passportInitialize()`](passport.md) / [`passportSession()`](passport.md) / [`passportAuthenticate()`](passport.md) | `passport` | Adapters for the real `passport` package |
| [`tokenVault()`](token-vault.md) | Custom | Access/refresh token issuance with rotation & reuse detection |
| [`rateLimit()`](rate-limit.md) | `express-rate-limit` | Rate limiting |
| [`serveStatic()`](static.md) | `express.static()` | Serve static files |
| [`cookieParser()`](cookies.md) | `cookie-parser` | Parse and sign cookies |
| [`compression()`](compression.md)           | `compression` | Gzip/Brotli/deflate response compression |
| [`upload()`](file-uploads.md) | `multer` | File uploads (multipart/form-data) |
| [`timeout()`](./timeout)     | `connect-timeout`     | Request timeout with `req.timedout` |
| [`hpp()`](./hpp)             | `hpp`                 | HTTP Parameter Pollution protection |
| [`validate()`](./validation) | `express-validator`   | Schema-based request validation     |
| [`sse()`](sse.md)                            | `express-sse`         | Server-Sent Events with heartbeat   |
| [`responseTime()`](response-time.md)         | `response-time`       | X-Response-Time header              |
| [`requestId()`](request-id.md)               | `express-request-id`  | X-Request-Id generation             |
| [`methodOverride()`](method-override.md)     | `method-override`     | PUT/DELETE/PATCH from HTML forms    |
| [`favicon()`](favicon.md)                    | `serve-favicon`       | Serve favicon.ico with ETag         |
| [`errorHandler()`](error-handler.md) | Custom | Catch-all error handling |

## Quick Reference

### Body Parsing

```ts
import { json, urlencoded, text } from 'bunway';

app.use(json({ limit: '10mb' }));
app.use(urlencoded({ extended: true }));
app.use(text());
```

[Full documentation →](body-parsing.md)

### Security

```ts
import { helmet, csrf, rateLimit } from 'bunway';

app.use(helmet());
app.use(csrf({ secret: process.env.CSRF_SECRET!, cookie: { secure: true } }));
app.use(rateLimit({ windowMs: 60000, max: 100 }));
```

[Full documentation →](security.md)

### Sessions

```ts
import { session } from 'bunway';

app.use(session({
  secret: 'my-secret',
  cookie: { maxAge: 86400000 }
}));

app.get('/profile', (req, res) => {
  req.session.views = (req.session.views || 0) + 1;
  res.json({ views: req.session.views });
});
```

[Full documentation →](session.md)

### Logging

```ts
import { logger } from 'bunway';

app.use(logger('dev'));                    // Colored dev output
app.use(logger('combined'));               // Apache combined format
app.use(logger(':method :url :status'));   // Custom format
```

[Full documentation →](logger.md)

### Static Files

```ts
import { serveStatic } from 'bunway';

app.use(serveStatic('public'));
app.use('/assets', serveStatic('assets', {
  maxAge: 86400000,
  etag: true
}));
```

[Full documentation →](static.md)

### Cookies

```ts
import { cookieParser } from 'bunway';

app.use(cookieParser({ secret: 'my-secret' }));

app.get('/preferences', (req, res) => {
  console.log(req.cookies);        // Unsigned cookies
  console.log(req.signedCookies);  // Signed cookies
  res.cookie('theme', 'dark', { maxAge: 86400 });
  res.json({ ok: true });
});
```

[Full documentation →](cookies.md)

### File Uploads

```ts
import { upload, diskStorage } from 'bunway';

app.post('/avatar', upload.single('avatar'), (req, res) => {
  res.json({ file: req.file.originalname });
});

app.post('/photos', upload.array('photos', 5), (req, res) => {
  res.json({ count: req.files.length });
});
```

[Full documentation →](file-uploads.md)

### CORS

```ts
import { cors } from 'bunway';

app.use(cors());
app.use(cors({ origin: 'https://example.com' }));
app.use(cors({ origin: true, credentials: true }));
```

[Full documentation →](cors.md)

### Error Handling

```ts
import { errorHandler, HttpError } from 'bunway';

app.use(errorHandler());

app.get('/fail', (req, res) => {
  throw new HttpError(404, 'Not found');
});
```

[Full documentation →](error-handler.md)

## Creating Custom Middleware

bunWay middleware follows the Express `(req, res, next)` signature:

```ts
import type { Handler } from 'bunway';

const myMiddleware: Handler = (req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
};

app.use(myMiddleware);
```

### Async Middleware

```ts
const asyncMiddleware: Handler = async (req, res, next) => {
  const user = await db.getUser(req.session.userId);
  req.user = user;
  next();
};
```

### Error Handling Middleware

```ts
const errorMiddleware = (err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message });
};

app.use(errorMiddleware);
```
