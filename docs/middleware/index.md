---
title: Middleware Overview
description: All built-in middleware in bunWay—sessions, security, logging, rate limiting, static files, and more. Express-compatible APIs, Bun-native performance.
---

# Middleware Overview

bunWay ships with a complete set of Express-compatible middleware—no npm hunting required. Same APIs you know, just faster.

## Built-in Middleware

| bunWay | Express Equivalent | Description |
|--------|-------------------|-------------|
| [`json()`](body-parsing.md) | `express.json()` | Parse JSON request bodies |
| [`urlencoded()`](body-parsing.md) | `express.urlencoded()` | Parse URL-encoded form data |
| [`text()`](body-parsing.md) | `express.text()` | Parse plain text bodies |
| [`cors()`](cors.md) | `cors` | Handle CORS headers and preflight |
| [`helmet()`](security.md) | `helmet` | Set security headers |
| [`session()`](session.md) | `express-session` | Session management with stores |
| [`passport()`](auth.md) | `passport` | Authentication strategies |
| [`logger()`](logger.md) | `morgan` | Request logging with formats |
| [`csrf()`](security.md#csrf-protection) | `csurf` | CSRF protection |
| [`rateLimit()`](rate-limit.md) | `express-rate-limit` | Rate limiting |
| [`serveStatic()`](static.md) | `express.static()` | Serve static files |
| [`cookieParser()`](cookies.md) | `cookie-parser` | Parse and sign cookies |
| [`compression()`](security.md#compression) | `compression` | Gzip/deflate responses |
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
app.use(csrf({ cookie: { secure: true } }));
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

### Authentication

```ts
import { passport, session } from 'bunway';

app.use(session({ secret: 'my-secret' }));
app.use(passport.initialize());
app.use(passport.session());

passport.use({
  name: 'local',
  authenticate(req) {
    const user = findUser(req.body.email, req.body.password);
    if (user) this.success(user);
    else this.fail('Invalid credentials');
  }
});

app.post('/login', passport.authenticate('local', {
  successRedirect: '/dashboard',
  failureRedirect: '/login'
}));
```

[Full documentation →](auth.md)

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
