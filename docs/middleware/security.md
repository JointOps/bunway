---
title: Security Middleware
description: Helmet, CSRF protection, rate limiting, and compression middleware for bunWay.
---

# Security Middleware

bunWay includes essential security middleware—all Express-compatible, all built-in.

## Helmet

Set security headers like the `helmet` npm package.

```ts
import { bunway, helmet } from 'bunway';

const app = bunway();
app.use(helmet());
```

### Default Headers

Helmet sets these headers by default:

| Header | Value | Purpose |
|--------|-------|---------|
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

### Customization

```ts
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "cdn.example.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "*.example.com"]
    }
  },
  crossOriginEmbedderPolicy: false,  // Disable
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  frameguard: { action: 'deny' }
}));
```

### Options

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

## CSRF Protection

Protect against Cross-Site Request Forgery attacks.

```ts
import { bunway, csrf, cookieParser } from 'bunway';

const app = bunway();
app.use(cookieParser());
app.use(csrf());

app.get('/form', (req, res) => {
  res.html(`
    <form method="POST" action="/submit">
      <input type="hidden" name="_csrf" value="${req.csrfToken()}">
      <button type="submit">Submit</button>
    </form>
  `);
});

app.post('/submit', (req, res) => {
  res.json({ success: true });
});
```

### How It Works

1. CSRF middleware generates a token and stores it in a cookie
2. Include the token in forms as `_csrf` field or in headers as `x-csrf-token`
3. POST/PUT/DELETE requests must include a valid token

### Options

```ts
interface CsrfOptions {
  cookie?: {
    name?: string;       // Cookie name (default: '_csrf')
    path?: string;       // Cookie path (default: '/')
    secure?: boolean;    // HTTPS only (default: true)
    httpOnly?: boolean;  // HTTP only (default: true)
    sameSite?: 'strict' | 'lax' | 'none';  // SameSite (default: 'strict')
  };
  ignoreMethods?: string[];  // Methods to skip (default: ['GET', 'HEAD', 'OPTIONS'])
  headerName?: string;       // Header name (default: 'x-csrf-token')
  bodyField?: string;        // Body field name (default: '_csrf')
  tokenLength?: number;      // Token length (default: 32)
}
```

### API Usage

For APIs, send the token in a header:

```ts
// Server
app.get('/api/csrf-token', (req, res) => {
  res.json({ token: req.csrfToken() });
});

// Client
const { token } = await fetch('/api/csrf-token').then(r => r.json());
await fetch('/api/data', {
  method: 'POST',
  headers: { 'x-csrf-token': token }
});
```

## Rate Limiting

Protect your app from abuse with rate limiting.

```ts
import bunway, { rateLimit } from 'bunway';

const app = bunway();

app.use(rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 100              // 100 requests per minute
}));
```

bunWay provides two rate limiting options:

- **Built-in `rateLimit()`** - Simple, zero-config, Express-compatible
- **[hitlimit-bun](https://github.com/JointOps/hitlimit-bun)** - Advanced rate limiting with Redis support, sliding window, and more

[Full Rate Limiting Documentation →](rate-limit.md)

## Compression

Compress responses with gzip or deflate.

```ts
import { bunway, compression } from 'bunway';

const app = bunway();
app.use(compression());

app.get('/large-data', (req, res) => {
  res.json(largeDataset);  // Automatically compressed
});
```

### Options

```ts
interface CompressionOptions {
  level?: number;      // Compression level 1-9 (default: 6)
  threshold?: number;  // Min size to compress in bytes (default: 1024)
  filter?: (contentType: string) => boolean;  // Custom filter
}
```

### Custom Filter

```ts
app.use(compression({
  threshold: 512,
  filter: (contentType) => {
    // Compress JSON and text, skip images
    return contentType.includes('json') ||
           contentType.includes('text');
  }
}));
```

### Compressible Types

By default, these content types are compressed:

- `text/*`
- `application/json`
- `application/javascript`
- `application/xml`
- `application/xhtml+xml`
- `image/svg+xml`

## Complete Security Setup

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

// Security headers
app.use(helmet());

// Compression
app.use(compression());

// Rate limiting
app.use(rateLimit({ windowMs: 60000, max: 100 }));

// Cookies and sessions
app.use(cookieParser());
app.use(session({ secret: process.env.SESSION_SECRET }));

// CSRF protection
app.use(csrf());

// Your routes
app.get('/', (req, res) => res.json({ secure: true }));

app.listen(3000);
```
