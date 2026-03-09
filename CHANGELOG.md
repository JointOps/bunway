# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.7] - 2026-03-09

The biggest release since 1.0 — security middleware, Express parity, and 97%+ API compatibility.

### Security & Protection Middleware
- **Request Timeout** — `timeout(ms, options?)` middleware with `req.timedout` flag, custom status/message, skip function
- **HPP Protection** — `hpp(options?)` middleware for HTTP Parameter Pollution detection and body sanitization
- **Request Validation** — `validate(schema, options?)` middleware with declarative schema for body, query, and params
- **`req.timedout`** — typed boolean property on BunRequest for timeout detection

### Express Parity
- **`res.send()` auto-detection** — string→text/html, object→JSON, buffer→octet-stream (matches Express behavior)
- **`res.send()`** and **`res.json()`** now return `this` for chaining
- **`req.accepts()`** — rewritten with RFC 7231 quality-value parsing (replaces substring matching)
- **`req.acceptsCharsets()`**, **`req.acceptsEncodings()`**, **`req.acceptsLanguages()`** — rewritten with quality-value parsing
- **`req.is()`** — rewritten with proper MIME type matching and wildcard support (`text/*`, `*/json`)
- **`req.param()`** — now checks params → body → query (Express parity)
- **Regex route support** — `app.get(/pattern/, handler)` with named capture groups
- **Catch-all `*` routes** — `app.all("*", handler)` and `app.get("*", handler)`
- **`app.mountpath`** — property set on sub-app mount
- **`app.path()`** — returns canonical path of the app
- **`res.sendFile()` callback** — `res.sendFile(path, [options], callback)`
- **`res.sendFile()` options** — `lastModified`, `cacheControl`, `immutable`, `acceptRanges`
- **`res.download()` callback** — `res.download(path, [filename], [options], callback)`
- **`res.attachment()` Content-Type** — auto-detects from filename extension
- **`res.end()` encoding + callback** — `res.end(data, encoding, callback)`
- Content negotiation engine (`src/utils/content-negotiation.ts`) — replaces `accepts` + `type-is` npm packages

### Documentation
- New middleware guides: Request Timeout, HPP Protection, Request Validation
- Updated Express migration guide with full parity comparisons
- Updated README, llms.txt, llms-full.txt

### Testing
- 276 new tests across unit, integration, acceptance, and Express compatibility suites
- Total: **1,662 tests**, 3,653 assertions, 91 test files, 0 failures

### Express Compatibility
This release brings Express API compatibility from ~93% to **~97%**.

## [1.0.6] - 2026-03-04

### Added
- **Cache Validation** — `req.fresh` and `req.stale` for ETag/Last-Modified conditional requests
- **Range Requests** — `req.range(size, options?)` parses Range header (Express-compatible)
- **Partial Content** — `res.sendFile()` now handles Range requests automatically (206 + Content-Range)
- **Accept-Ranges** — `res.sendFile()` sets `Accept-Ranges: bytes` on all responses
- **JSONP** — `res.jsonp(data)` with configurable callback parameter name
- **Cross-References** — `req.res`, `res.req`, `res.app` set during request dispatch
- **Array Paths** — `app.use([path1, path2], handler)` for multi-path middleware registration

### Documentation
- New "Request & Response" guide covering cache validation, range requests, JSONP, and cross-references
- Updated Express migration guide with Phase 2 feature comparisons
- Updated README with new features
- Updated llms.txt and llms-full.txt

### Testing
- 97 new tests (62 unit + 25 integration + 4 acceptance + 6 compat)
- Total: ~1386 tests

### Phase 2 Complete
This release completes Phase 2 (Request/Response Completeness).

## [1.0.5] - 2026-02-28

### Added
- **Graceful Shutdown** — `app.close(callback?)` with callback and Promise support
- **Server Access** — `app.server` getter for the underlying Bun.Server instance
- **TLS/HTTPS Support** — `tls` option in `app.listen()` for native HTTPS
  - String and Buffer cert/key formats
  - Optional `passphrase` for encrypted private keys
  - Optional `ca` for custom certificate authorities

### Fixed
- **`req.protocol`** now respects `X-Forwarded-Proto` header when trust proxy is enabled (Express parity)
- **`req.secure`** now correctly reflects proxy-forwarded HTTPS (Express parity)

### Documentation
- New "Server Lifecycle" guide covering startup, HTTPS, shutdown, and testing
- Updated Express migration guide with HTTPS, shutdown, and protocol comparisons
- Updated README with TLS and shutdown features
- Updated llms.txt and llms-full.txt

### Testing
- 57 new tests (21 unit + 30 integration + 4 acceptance + 2 compat)
- Total: 1289 tests

### Phase 1 Complete
This release completes Phase 1 (Core Migration Blockers).

## [1.0.4] - 2026-02-21

### Added
- **File upload middleware** — `upload()` for multipart form-data parsing (multer-compatible)
  - Streaming multipart parser using Bun's native APIs (zero dependencies)
  - Memory storage (`memoryStorage()`) and disk storage (`diskStorage()`) engines
  - `single(fieldname)`, `array(fieldname, maxCount)`, `fields(specs)`, `none()`, `any()` strategies
  - Configurable `fileFilter` callback for file type validation
  - Configurable `limits` (fileSize, files, fields, fieldSize, fieldNameSize, parts)
  - `preservePath` option for original filename paths
  - `req.file` (single) and `req.files` (array/fields/any) on request object
  - Express/multer-compatible API — drop-in replacement

### Documentation
- Added comprehensive file upload middleware guide
- Updated Express migration guide with multer mapping
- Updated middleware overview with upload entry

### Testing
- 155+ upload-specific tests (integration + acceptance + unit)
- Library-wide unit test audit: 679 unit tests across 21 files
- Total test count: 1232 tests, 2984 expects

## [1.0.3] - 2026-02-21

### Added
- **Router `mergeParams` option** — child routers can inherit parent route parameters
  - `new Router({ mergeParams: true })` enables parent param inheritance
  - Parameterized prefix matching for sub-router mounting (`/users/:userId`)
  - Child params override parent params on name conflicts
  - Deep nesting support (grandparent → parent → child param chain)
  - `group()` transparently passes params through
  - Intermediate routers without `mergeParams` correctly block param inheritance
  - Express-compatible behavior matching `express.Router({ mergeParams: true })`

### Documentation
- Added mergeParams section to router deep dive guide
- Updated Express compatibility table in README
- Updated LLM context files (llms.txt, llms-full.txt)
- Added 12 integration tests (696 total tests passing)

## [1.0.2] - 2026-02-14

### Added
- **Raw body parser** — `raw()` middleware for parsing binary request bodies
  - Essential for webhook signature verification (Stripe, GitHub, PayPal, etc.)
  - Supports size limits with string format ("5mb", "100kb", "1.5mb")
  - Custom content-type matching (string, RegExp, or function)
  - `verify` callback for signature verification before body assignment
  - Returns Buffer instance on `req.body` for binary data handling
  - Example: `raw({ type: 'application/json', verify: (req, res, buf) => {...} })`

### Documentation
- Added comprehensive raw body parser guide with webhook examples
- Updated body-parsing.md with signature verification patterns
- Enhanced Express compatibility table in README
- Updated LLM context files with raw parser details
- Added 16 integration tests covering all raw parser features

### Fixed
- CI verification script now skips git status check in CI environment
  - Prevents false failures when dist files change during build
  - Enables successful publish workflow on VERSION changes

## [1.0.1] - 2026-02-14

### Added
- **Chainable routes** — Express-compatible `app.route()` API for cleaner route definitions
  - Define multiple HTTP methods on the same path without repetition
  - Supports all HTTP methods: GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD, ALL
  - Works with middleware chaining per method
  - Compatible with both app and Router instances
  - Zero performance overhead (thin wrapper pattern)
  - Example: `app.route('/users').get(listUsers).post(createUser)`

### Documentation
- Added comprehensive chainable routes section to router guide
- Updated Express compatibility table in README
- Enhanced LLM context files (llms.txt, llms-full.txt)
- Added 22 integration tests (exceeds minimum requirement)

## [1.0.0] - 2026-01-31

🎉 **First stable release!** bunWay is production-ready.

### Highlights

- **Express-compatible API** — Same `(req, res, next)` patterns you know
- **13 built-in middleware** — Sessions, auth, security, logging, and more
- **Zero dependencies** — Just Bun, nothing else
- **Full TypeScript support** — Strict types throughout

### Added
- Custom landing page with new navbar design
- WebSockets documentation
- Authentication middleware documentation
- Rate limiting middleware documentation
- Professional benchmark suite with TechEmpower-style methodology
- Automated publish workflow triggered on VERSION change
- CodeQL security scanning
- Dependabot for dependency updates

### Changed
- Improved documentation across all middleware
- Enhanced getting started guide
- Updated Express migration guide

## [0.2.0] - 2026-01-30

### Added
- Session middleware with memory and file stores
- Passport-style authentication middleware
- Logger middleware with Morgan-compatible API
- CSRF protection middleware
- Helmet security middleware
- Compression middleware
- Rate limiting middleware
- Static file serving middleware
- Cookie parser middleware
- Body parser (JSON, URL-encoded, raw, text)
- CORS middleware
- Error handler middleware
- Wildcard routes and optional parameters
- Express compatibility helpers
- WebSocket support
- Benchmark infrastructure for performance testing

### Changed
- **BREAKING**: Rewritten core to Express-compatible `(req, res, next)` API
- Improved router performance with hybrid matching
- Enhanced middleware execution chain
- Reorganized test structure (unit/integration/acceptance)

### Fixed
- Security hardening and best practices
- ANSI colors only applied when logging to stdout

## [0.1.0] - 2024-XX-XX

### Added
- Initial release
- Express-compatible routing API
- Middleware support with `use()`, `get()`, `post()`, etc.
- Request wrapper with Express-like properties
- Response wrapper with Express-like methods
- Child router support
- Route parameters and query parsing
- TypeScript support with full type definitions

---

## Release Process

1. Update `VERSION` file with new version number
2. Update this `CHANGELOG.md` with changes
3. Commit: `git commit -am "chore: bump version to X.Y.Z"`
4. Push to main: `git push origin main`
5. GitHub Actions automatically:
   - Runs all tests
   - Publishes to npm
   - Creates GitHub release with auto-generated notes
   - Tags the release

[Unreleased]: https://github.com/JointOps/bunway/compare/v1.0.7...HEAD
[1.0.7]: https://github.com/JointOps/bunway/compare/v1.0.6...v1.0.7
[1.0.6]: https://github.com/JointOps/bunway/compare/v1.0.5...v1.0.6
[1.0.5]: https://github.com/JointOps/bunway/compare/v1.0.4...v1.0.5
[1.0.4]: https://github.com/JointOps/bunway/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/JointOps/bunway/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/JointOps/bunway/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/JointOps/bunway/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/JointOps/bunway/releases/tag/v1.0.0
[0.2.0]: https://github.com/JointOps/bunway/releases/tag/v0.2.0
[0.1.0]: https://github.com/JointOps/bunway/releases/tag/v0.1.0
