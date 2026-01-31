---
title: Rate Limiting
description: Protect your bunWay application from abuse with built-in rate limiting or hitlimit-bun for advanced use cases.
---

# Rate Limiting

bunWay provides two rate limiting options:

1. **Built-in `rateLimit()`** - Simple, zero-config, Express-compatible
2. **[hitlimit-bun](https://github.com/JointOps/hitlimit-bun)** - Advanced rate limiting with Redis support

## Built-in Rate Limiter

The simplest way to add rate limiting. Works exactly like `express-rate-limit`.

```ts
import bunway, { rateLimit } from 'bunway';

const app = bunway();

app.use(rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 100              // 100 requests per minute
}));

app.get('/', (req, res) => res.json({ hello: 'world' }));

app.listen(3000);
```

### Response Headers

Rate limit info is included in response headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 60
Retry-After: 60  (only when rate limited)
```

### Options

```ts
interface RateLimitOptions {
  windowMs?: number;    // Time window in ms (default: 60000)
  max?: number;         // Max requests per window (default: 100)
  message?: string | object;  // Error message when limited
  statusCode?: number;  // Error status (default: 429)
  headers?: boolean;    // Include rate limit headers (default: true)
  keyGenerator?: (req) => string;  // Custom key function
  skip?: (req) => boolean;         // Skip certain requests
  onLimitReached?: (req) => void;  // Callback when limit hit
}
```

### Custom Key Generator

Rate limit by different criteria:

```ts
// By user ID instead of IP
app.use(rateLimit({
  max: 100,
  keyGenerator: (req) => req.session?.userId || req.ip
}));

// By API key
app.use(rateLimit({
  max: 1000,
  keyGenerator: (req) => req.get('x-api-key') || req.ip
}));
```

### Skip Certain Requests

```ts
app.use(rateLimit({
  max: 100,
  skip: (req) => {
    // Skip health checks
    if (req.path === '/health') return true;
    // Skip authenticated admins
    if (req.session?.isAdmin) return true;
    return false;
  }
}));
```

### Per-Route Limits

```ts
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,
  message: { error: 'Too many login attempts' }
});

app.use('/api/', apiLimiter);
app.use('/auth/login', authLimiter);
```

---

## hitlimit-bun (Advanced)

For production applications needing distributed rate limiting, Redis support, or advanced features, use [hitlimit-bun](https://github.com/JointOps/hitlimit-bun).

### Installation

```bash
bun add hitlimit-bun
```

### Basic Usage

```ts
import bunway from 'bunway';
import { rateLimit } from 'hitlimit-bun';

const app = bunway();

app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 100
}));

app.listen(3000);
```

### Redis Store (Distributed)

For multi-server deployments where rate limits need to be shared:

```ts
import { rateLimit, RedisStore } from 'hitlimit-bun';

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  store: new RedisStore({
    url: process.env.REDIS_URL
  })
});

app.use(limiter);
```

### Sliding Window Algorithm

More accurate rate limiting that prevents burst traffic at window boundaries:

```ts
import { rateLimit } from 'hitlimit-bun';

app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  algorithm: 'sliding-window'  // vs 'fixed-window' (default)
}));
```

### Multiple Rate Limits

Apply different limits for different scenarios:

```ts
import { rateLimit } from 'hitlimit-bun';

// Global limit
app.use(rateLimit({ windowMs: 60000, max: 1000 }));

// Strict limit for auth endpoints
app.use('/auth', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many attempts. Try again in 15 minutes.' }
}));

// Higher limit for authenticated users
app.use('/api', (req, res, next) => {
  const limit = req.session?.userId
    ? rateLimit({ max: 500 })
    : rateLimit({ max: 100 });
  limit(req, res, next);
});
```

### Features Comparison

| Feature | Built-in `rateLimit()` | hitlimit-bun |
|---------|:----------------------:|:------------:|
| Basic rate limiting | Yes | Yes |
| Custom key generator | Yes | Yes |
| Skip function | Yes | Yes |
| Memory store | Yes | Yes |
| Redis store | No | Yes |
| Sliding window | No | Yes |
| Token bucket | No | Yes |
| Cluster support | No | Yes |

### When to Use Which?

**Use built-in `rateLimit()`** when:
- Single server deployment
- Simple rate limiting needs
- Getting started quickly

**Use hitlimit-bun** when:
- Multiple servers/instances
- Need Redis for distributed state
- Need sliding window algorithm
- High-traffic production apps

---

## Rate Limiting Best Practices

### 1. Layer Your Limits

```ts
// Global: prevent total abuse
app.use(rateLimit({ windowMs: 60000, max: 1000 }));

// API: normal usage
app.use('/api', rateLimit({ windowMs: 60000, max: 100 }));

// Auth: prevent brute force
app.use('/auth', rateLimit({ windowMs: 900000, max: 5 }));
```

### 2. Use Appropriate Keys

```ts
// For APIs: use API key
keyGenerator: (req) => req.get('x-api-key') || req.ip

// For authenticated users: use user ID
keyGenerator: (req) => req.session?.userId || req.ip

// For public endpoints: use IP
keyGenerator: (req) => req.ip
```

### 3. Provide Clear Error Messages

```ts
app.use(rateLimit({
  max: 100,
  message: {
    error: 'Rate limit exceeded',
    retryAfter: 60,
    docs: 'https://api.example.com/docs/rate-limits'
  }
}));
```

### 4. Don't Rate Limit Health Checks

```ts
app.use(rateLimit({
  skip: (req) => req.path === '/health' || req.path === '/ready'
}));
```

---

For more details, see the [hitlimit-bun documentation](https://github.com/JointOps/hitlimit-bun).
