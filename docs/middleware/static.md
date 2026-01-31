---
title: Static File Middleware
description: Serve static files like express.static() with caching, ETags, and security.
---

# Static File Middleware

Serve static files like `express.static()`—with caching, ETags, and path traversal protection.

## Quick Start

```ts
import { bunway, serveStatic } from 'bunway';

const app = bunway();

app.use(serveStatic('public'));

app.listen(3000);
```

Now files in `./public` are served:
- `public/index.html` → `http://localhost:3000/`
- `public/css/style.css` → `http://localhost:3000/css/style.css`
- `public/js/app.js` → `http://localhost:3000/js/app.js`

## Mount Path

Serve from a specific URL path:

```ts
// Serve ./assets at /static
app.use('/static', serveStatic('assets'));

// assets/logo.png → http://localhost:3000/static/logo.png
```

## Options

```ts
interface StaticOptions {
  index?: string | string[] | false;  // Index files (default: 'index.html')
  dotfiles?: 'allow' | 'deny' | 'ignore';  // Dotfile handling (default: 'ignore')
  maxAge?: number;      // Cache-Control max-age in ms (default: 0)
  immutable?: boolean;  // Add immutable to Cache-Control (default: false)
  etag?: boolean;       // Generate ETags (default: true)
  lastModified?: boolean;  // Set Last-Modified header (default: true)
  fallthrough?: boolean;   // Pass to next middleware if not found (default: true)
  extensions?: string[];   // Try these extensions (default: [])
}
```

## Caching

### Cache Headers

```ts
// Cache for 1 day
app.use(serveStatic('public', {
  maxAge: 86400000  // 1 day in ms
}));

// Cache forever (use with hashed filenames)
app.use('/assets', serveStatic('dist/assets', {
  maxAge: 31536000000,  // 1 year
  immutable: true
}));
```

### ETags

ETags are enabled by default. The server returns `304 Not Modified` when the file hasn't changed:

```ts
app.use(serveStatic('public', {
  etag: true,        // Default
  lastModified: true // Default
}));
```

Disable for performance:

```ts
app.use(serveStatic('public', {
  etag: false,
  lastModified: false
}));
```

## Index Files

### Default

By default, `index.html` is served for directory requests:

```
GET /           → public/index.html
GET /about/     → public/about/index.html
```

### Multiple Index Files

```ts
app.use(serveStatic('public', {
  index: ['index.html', 'index.htm', 'default.html']
}));
```

### Disable Index

```ts
app.use(serveStatic('public', {
  index: false  // Don't serve index files
}));
```

## File Extensions

Automatically try extensions:

```ts
app.use(serveStatic('public', {
  extensions: ['html', 'htm']
}));

// GET /about → tries public/about, then public/about.html, then public/about.htm
```

## Dotfiles

Control access to dotfiles (`.gitignore`, `.env`, etc.):

```ts
// Ignore (default) - return 404
app.use(serveStatic('public', { dotfiles: 'ignore' }));

// Deny - return 403
app.use(serveStatic('public', { dotfiles: 'deny' }));

// Allow - serve them
app.use(serveStatic('public', { dotfiles: 'allow' }));
```

## Fallthrough

When a file isn't found:

```ts
// Pass to next middleware (default)
app.use(serveStatic('public', { fallthrough: true }));

// Return 404 immediately
app.use(serveStatic('public', { fallthrough: false }));
```

With fallthrough enabled:

```ts
app.use(serveStatic('public'));
app.get('*', (req, res) => {
  // Handle SPA routing
  res.sendFile('public/index.html');
});
```

## Security

### Path Traversal Protection

bunWay prevents path traversal attacks:

```
GET /../../../etc/passwd  → 403 Forbidden
GET /..%2F..%2Fetc/passwd → 403 Forbidden
```

### Symlink Protection

Symlinks that point outside the root directory are blocked.

### Recommendations

```ts
// Secure static file setup
app.use(helmet());
app.use(serveStatic('public', {
  dotfiles: 'deny',      // Block access to dotfiles
  maxAge: 86400000,      // Enable caching
  etag: true             // Enable conditional requests
}));
```

## Examples

### SPA with Client-Side Routing

```ts
const app = bunway();

// Serve static assets
app.use(serveStatic('dist', {
  maxAge: 86400000
}));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile('dist/index.html');
});
```

### Multiple Static Directories

```ts
// Serve uploads with no caching
app.use('/uploads', serveStatic('uploads', {
  maxAge: 0,
  dotfiles: 'deny'
}));

// Serve assets with long caching
app.use('/assets', serveStatic('public/assets', {
  maxAge: 31536000000,
  immutable: true
}));

// Serve other static files
app.use(serveStatic('public'));
```

### Development vs Production

```ts
const isDev = process.env.NODE_ENV !== 'production';

app.use(serveStatic('public', {
  maxAge: isDev ? 0 : 86400000,
  etag: !isDev
}));
```

## Migration from express.static()

The API is nearly identical:

```js
// Express
app.use(express.static('public'));
app.use('/assets', express.static('assets', { maxAge: '1d' }));

// bunWay
app.use(serveStatic('public'));
app.use('/assets', serveStatic('assets', { maxAge: 86400000 }));
```

Note: bunWay uses milliseconds for `maxAge` instead of a string.
