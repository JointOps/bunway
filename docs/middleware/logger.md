---
title: Logger Middleware
description: Morgan-compatible request logging for bunWay with predefined and custom formats.
---

# Logger Middleware

Request logging compatible with Morgan. Same format strings, same output—just faster.

## Quick Start

```ts
import { bunway, logger } from 'bunway';

const app = bunway();

app.use(logger('dev'));

app.get('/', (req, res) => res.json({ hello: 'world' }));

app.listen(3000);
```

Output:
```
GET / 200 1.234 ms - 17
```

## Predefined Formats

### `dev`

Colored output for development. Status codes are color-coded.

```ts
app.use(logger('dev'));
// GET /users 200 1.234 ms - 123
```

### `combined`

Apache combined log format.

```ts
app.use(logger('combined'));
// ::1 - - [30/Jan/2026:12:00:00 +0000] "GET /users HTTP/1.1" 200 123 "-" "Mozilla/5.0..."
```

### `common`

Apache common log format.

```ts
app.use(logger('common'));
// ::1 - - [30/Jan/2026:12:00:00 +0000] "GET /users HTTP/1.1" 200 123
```

### `short`

Shorter than combined with response time.

```ts
app.use(logger('short'));
// ::1 - GET /users HTTP/1.1 200 123 - 1.234 ms
```

### `tiny`

Minimal output.

```ts
app.use(logger('tiny'));
// GET /users 200 123 - 1.234 ms
```

## Custom Format Strings

Use tokens to create custom formats:

```ts
app.use(logger(':method :url :status :response-time ms'));
// GET /users 200 1.234 ms

app.use(logger(':date - :method :url'));
// 30/Jan/2026:12:00:00 +0000 - GET /users

app.use(logger('[:date] ":method :url" :status'));
// [30/Jan/2026:12:00:00 +0000] "GET /users" 200
```

### Available Tokens

| Token | Description |
|-------|-------------|
| `:method` | HTTP method (GET, POST, etc.) |
| `:url` | Request URL |
| `:path` | Request path |
| `:status` | Response status code |
| `:response-time` | Response time in milliseconds |
| `:content-length` | Response content length |
| `:date` | Date in CLF format |
| `:referrer` | Referrer header |
| `:user-agent` | User-Agent header |
| `:remote-addr` | Client IP address |
| `:remote-user` | Basic auth username |
| `:http-version` | HTTP version |

## Custom Format Function

For complete control, use a format function:

```ts
app.use(logger((tokens, req, res, meta) => {
  return [
    req.method,
    req.path,
    res.statusCode,
    `${meta.responseTime.toFixed(2)}ms`
  ].join(' ');
}));
```

## Options

```ts
interface LoggerOptions {
  skip?: (req, res) => boolean;   // Skip logging for certain requests
  stream?: { write: (msg: string) => void };  // Custom output stream
  immediate?: boolean;            // Log on request instead of response
}
```

### Skip Certain Requests

```ts
app.use(logger('dev', {
  skip: (req, res) => {
    // Skip health checks
    if (req.path === '/health') return true;
    // Skip successful static file requests
    if (req.path.startsWith('/static') && res.statusCode < 400) return true;
    return false;
  }
}));
```

### Log to File

```ts
import { appendFile } from 'fs/promises';

app.use(logger('combined', {
  stream: {
    write: async (msg) => {
      await appendFile('access.log', msg);
    }
  }
}));
```

### Immediate Logging

Log when request arrives (before response):

```ts
app.use(logger('dev', { immediate: true }));
```

## Examples

### Development Setup

```ts
if (process.env.NODE_ENV !== 'production') {
  app.use(logger('dev'));
} else {
  app.use(logger('combined', {
    stream: { write: (msg) => productionLogger.info(msg.trim()) }
  }));
}
```

### Request ID Logging

```ts
app.use((req, res, next) => {
  req.id = crypto.randomUUID();
  next();
});

app.use(logger((tokens, req, res, meta) => {
  return `[${req.id}] ${req.method} ${req.path} ${res.statusCode} ${meta.responseTime.toFixed(2)}ms`;
}));
```

### JSON Logging

```ts
app.use(logger((tokens, req, res, meta) => {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    status: res.statusCode,
    responseTime: meta.responseTime,
    userAgent: req.get('user-agent')
  });
}));
```

## Migration from Morgan

The API is identical:

```js
// Express + Morgan
const morgan = require('morgan');
app.use(morgan('dev'));
app.use(morgan(':method :url :status'));

// bunWay
import { logger } from 'bunway';
app.use(logger('dev'));
app.use(logger(':method :url :status'));
```

Same formats. Same tokens. Just faster.
