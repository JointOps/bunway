# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/JointOps/bunway/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/JointOps/bunway/releases/tag/v1.0.0
[0.2.0]: https://github.com/JointOps/bunway/releases/tag/v0.2.0
[0.1.0]: https://github.com/JointOps/bunway/releases/tag/v0.1.0
