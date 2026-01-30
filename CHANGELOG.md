# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Professional benchmark suite with TechEmpower-style methodology
- Automated publish workflow triggered on VERSION change
- CodeQL security scanning
- Dependabot for dependency updates
- Codecov integration for test coverage reporting

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

[Unreleased]: https://github.com/JointOps/bunway/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/JointOps/bunway/releases/tag/v0.2.0
[0.1.0]: https://github.com/JointOps/bunway/releases/tag/v0.1.0
