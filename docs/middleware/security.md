---
title: Helmet — Security Headers
description: Set HTTP security headers in bunWay with the built-in helmet() middleware — content security policy, HSTS, XSS protection, and more.
---

# Helmet — Security Headers

`helmet()` sets a suite of HTTP security headers that protect against common web vulnerabilities. It's a drop-in replacement for the `helmet` npm package.

::: tip Coming from Express?
`import { helmet } from 'bunway'` replaces `import helmet from 'helmet'`. Options are identical.
:::

## Quick Start

```ts
import { bunway, helmet } from 'bunway';

const app = bunway();
app.use(helmet());
```

## Default Headers

Helmet sets these headers on every response:

| Header | Default Value | Purpose |
|--------|--------------|---------|
| Content-Security-Policy | `default-src 'self'...` | Prevent XSS |
| Cross-Origin-Embedder-Policy | `require-corp` | Isolate resources |
| Cross-Origin-Opener-Policy | `same-origin` | Isolate browsing context |
| Cross-Origin-Resource-Policy | `same-origin` | Prevent cross-origin reads |
| X-DNS-Prefetch-Control | `off` | Disable DNS prefetching |
| X-Frame-Options | `SAMEORIGIN` | Prevent clickjacking |
| Strict-Transport-Security | `max-age=15552000` | Force HTTPS |
| X-Download-Options | `noopen` | IE download protection |
| X-Content-Type-Options | `nosniff` | Prevent MIME sniffing |
| X-Permitted-Cross-Domain-Policies | `none` | Adobe cross-domain |
| Referrer-Policy | `no-referrer` | Control referrer |
| X-XSS-Protection | `0` | Disable legacy XSS filter |

## Customization

```ts
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      "default-src": ["'self'"],
      "script-src":  ["'self'", "'unsafe-inline'", "cdn.example.com"],
      "style-src":   ["'self'", "'unsafe-inline'"],
      "img-src":     ["'self'", "data:", "*.example.com"]
    }
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  frameguard: { action: 'deny' }
}));
```

## Options

```ts
interface HelmetOptions {
  contentSecurityPolicy?: boolean | { directives?: Record<string, string[]>, reportOnly?: boolean };
  crossOriginEmbedderPolicy?: boolean | { policy?: string };
  crossOriginOpenerPolicy?: boolean | { policy?: string };
  crossOriginResourcePolicy?: boolean | { policy?: string };
  dnsPrefetchControl?: boolean | { allow?: boolean };
  frameguard?: boolean | { action?: 'deny' | 'sameorigin' };
  hidePoweredBy?: boolean;
  hsts?: boolean | { maxAge?: number, includeSubDomains?: boolean, preload?: boolean };
  ieNoOpen?: boolean;
  noSniff?: boolean;
  originAgentCluster?: boolean;
  permittedCrossDomainPolicies?: boolean | { permittedPolicies?: string };
  referrerPolicy?: boolean | { policy?: string | string[] };
  xssFilter?: boolean;
}
```

## Full Security Stack

Use `helmet()` alongside bunWay's other security middleware for a complete setup:

```ts
import {
  bunway,
  helmet,
  csrf,
  rateLimit,
  compression,
  cookieParser,
  session
} from 'bunway';

const app = bunway();

app.use(helmet());
app.use(compression());
app.use(rateLimit({ windowMs: 60000, max: 100 }));
app.use(cookieParser());
app.use(session({ secret: process.env.SESSION_SECRET }));
app.use(csrf({ secret: process.env.CSRF_SECRET! }));

app.get('/', (req, res) => res.json({ secure: true }));
app.listen(3000);
```

## Related

- [CSRF Protection](./csrf) — prevent cross-site request forgery
- [Rate Limiting](./rate-limit) — protect against abuse and brute force
- [Session](./session) — stateful sessions with signing support
- [HPP Protection](./hpp) — prevent HTTP parameter pollution
