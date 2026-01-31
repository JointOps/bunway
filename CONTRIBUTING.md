# Contributing to bunWay

bunWay exists because the Bun community wanted the familiar Express flow without leaving Bun’s native runtime. Thank you for helping push that vision forward.

## Code of Conduct

By participating in this project you agree to follow our [Code of Conduct](./CODE_OF_CONDUCT.md). Please report unacceptable behaviour to [shayanhussain48@gmail.com](mailto:shayanhussain48@gmail.com).

## Getting started

1. **Install Bun** – bunWay depends on Bun’s runtime and test runner. Install the latest Bun release from [bun.sh](https://bun.sh/).
2. **Install dependencies** – run `bun install` once you have cloned the repository.
3. **Preferred tooling** – keep it Bun-native. Reach for Bun APIs first and avoid Node-only polyfills.

## Development workflow

- `bun run test` – execute the Bun test suite.
- `bun run typecheck` – run TypeScript in `--noEmit` mode.
- `bun run docs:build` – build the VitePress guides (regenerates TypeDoc automatically).
- `npm run prepare:dist` – build the distributable package into `dist/`.
- `npm run check:dist` – verify the built package before publishing.

### Working on docs

Guides live under `docs/` (VitePress) and API reference is generated into `docs/public/api` via TypeDoc. Use `bun run docs:dev` for local previews. When updating APIs, please adjust comments in `src/` and regenerate TypeDoc with `bun run docs` or `bun run docs:build`.

### Tests

All tests use Bun’s built-in runner. Please add coverage for new behaviour in `tests/` and keep scenarios Bun-native—no Jest or Node-only helpers. Integration suites can spin up full bunWay apps and exercise them via `fetch`.

## Pull requests

1. **Discuss first** – open an issue (bug or feature request) before large changes. Check the [Roadmap](https://bunway.jointops.dev/community/build-together.html) for active phases.
2. **Branch naming** – any descriptive branch name is fine (e.g. `feature/cookies-support`).
3. **Keep commits focused** – small, logical commits are easier to review.
4. **Run the checklist** – make sure tests, type checks, docs, and formatters pass before opening a PR.
5. **Fill out the PR template** – include context, test commands, and relevant docs.

## Filing issues

- Use the provided issue templates to help us triage quickly.
- Include Bun version (`bun --version`), bunWay version, OS, and reproduction steps.
- Link to relevant routes, middleware, or configuration if applicable.

## Release process (maintainers)

1. Update the version in the `VERSION` file following semver (this is the source of truth).
2. Run `npm run release` – this syncs the version, checks the tree, builds docs and dist, verifies the package, and publishes `dist/` to npm.
3. Create a GitHub release with notes summarising the changes.

## Community guidelines

- Stay Bun-first. If you need functionality from Node core, open an issue so we can explore Bun alternatives.
- Document user-facing changes—update TypeDoc comments and VitePress guides as you go.
- Be kind and helpful. We’re building a welcoming home for Bun developers chasing Express nostalgia.

Thanks again for contributing to bunWay!
