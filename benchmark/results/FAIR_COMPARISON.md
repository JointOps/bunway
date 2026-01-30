# Fair Benchmark Comparison Report

> **Generated**: January 30, 2026 at 03:35 PM
> **Machine**: darwin (arm64)
> **Benchmark Tool**: OHA
> **Test Duration**: 10s per endpoint × 2 runs
> **Warmup**: 3s (discarded)
> **Connections**: 100 concurrent

---

## Methodology

This benchmark follows TechEmpower-style methodology for fair and accurate results:

1. **No Global Middleware** - All frameworks have zero global middleware on `/json` and `/plaintext`
2. **External Tool** - Using `oha` for accurate measurements (not client-side bottlenecked)
3. **Multiple Runs** - 2 independent runs per test for statistical validity
4. **Warmup Period** - 3s warmup discarded before measurement
5. **Runtime Separation** - Bun and Node.js results shown separately (not apples-to-oranges)
6. **CV% Validation** - Coefficient of Variation < 10% indicates reliable results

---

## Bun Frameworks (Bun v1.3.7)

| Rank | Framework | JSON (req/s) | CV% | Plaintext (req/s) | Latency (avg) |
|------|-----------|--------------|-----|-------------------|---------------|
| 🥇 | **Elysia** | 119,816 | 0.3% ✓ | 120,354 | 0.83ms |
| 🥈 | **Hono** | 98,437 | 0.3% ✓ | 111,827 | 1.01ms |
| 🥉 | **bunWay** | 95,207 | 0.2% ✓ | 92,026 | 1.05ms |

## Node.js Frameworks (Node.js v24.3.0)

| Rank | Framework | JSON (req/s) | CV% | Plaintext (req/s) | Latency (avg) |
|------|-----------|--------------|-----|-------------------|---------------|
| 🥇 | **Fastify** | 64,432 | 0.4% ✓ | 64,538 | 1.55ms |
| 🥈 | **Express** | 39,856 | 0.1% ✓ | 40,951 | 2.51ms |

---

## Performance Charts

### Bun Frameworks - Requests/sec (higher is better)

```
Elysia     ████████████████████████████████████████ 119,816
Hono       █████████████████████████████████ 98,437
bunWay     ████████████████████████████████ 95,207
```

### Node.js Frameworks - Requests/sec (higher is better)

```
Fastify    ████████████████████████████████████████ 64,432
Express    █████████████████████████ 39,856
```

---

## Cross-Runtime Comparison

⚠️ **Important**: Direct Bun vs Node.js comparison is NOT apples-to-apples.
Runtime differences dominate framework differences. This section is for informational purposes only.

| Rank | Framework | Runtime | JSON (req/s) | vs #1 |
|------|-----------|---------|--------------|-------|
| 1 | Elysia | Bun | 119,816 | 100.0% |
| 2 | Hono | Bun | 98,437 | 82.2% |
| 3 | bunWay | Bun | 95,207 | 79.5% |
| 4 | Fastify | Node.js | 64,432 | 53.8% |
| 5 | Express | Node.js | 39,856 | 33.3% |


---

## Detailed Statistics

### Elysia (Bun)

| Endpoint | Mean RPS | Median | Min | Max | StdDev | CV% | Reliable |
|----------|----------|--------|-----|-----|--------|-----|----------|
| `/json` | 119,816 | 120,196 | 119,436 | 120,196 | 380 | 0.3% | ✓ |
| `/plaintext` | 120,354 | 122,047 | 118,660 | 122,047 | 1,694 | 1.4% | ✓ |

### Hono (Bun)

| Endpoint | Mean RPS | Median | Min | Max | StdDev | CV% | Reliable |
|----------|----------|--------|-----|-----|--------|-----|----------|
| `/json` | 98,437 | 98,692 | 98,181 | 98,692 | 256 | 0.3% | ✓ |
| `/plaintext` | 111,827 | 112,847 | 110,808 | 112,847 | 1,019 | 0.9% | ✓ |

### bunWay (Bun)

| Endpoint | Mean RPS | Median | Min | Max | StdDev | CV% | Reliable |
|----------|----------|--------|-----|-----|--------|-----|----------|
| `/json` | 95,207 | 95,379 | 95,035 | 95,379 | 172 | 0.2% | ✓ |
| `/plaintext` | 92,026 | 92,401 | 91,651 | 92,401 | 375 | 0.4% | ✓ |

### Fastify (Node.js)

| Endpoint | Mean RPS | Median | Min | Max | StdDev | CV% | Reliable |
|----------|----------|--------|-----|-----|--------|-----|----------|
| `/json` | 64,432 | 64,686 | 64,177 | 64,686 | 254 | 0.4% | ✓ |
| `/plaintext` | 64,538 | 64,585 | 64,490 | 64,585 | 47 | 0.1% | ✓ |

### Express (Node.js)

| Endpoint | Mean RPS | Median | Min | Max | StdDev | CV% | Reliable |
|----------|----------|--------|-----|-----|--------|-----|----------|
| `/json` | 39,856 | 39,889 | 39,823 | 39,889 | 33 | 0.1% | ✓ |
| `/plaintext` | 40,951 | 41,131 | 40,771 | 41,131 | 180 | 0.4% | ✓ |

---

## What Makes This Benchmark Fair

| Aspect | This Benchmark | Why It Matters |
|--------|---------------|----------------|
| Middleware | None on `/json`, `/plaintext` | Global middleware unfairly handicaps frameworks |
| Tool | oha | External tools avoid client-side bottlenecks |
| Duration | 10s | JIT, GC, caches need time to stabilize |
| Warmup | 3s discarded | Cold code performs differently than warm code |
| Runs | 2 independent runs | Single runs are statistically invalid |
| Statistics | CV% reported | Identifies noisy/unreliable results |
| Runtimes | Separated | Bun vs Node.js is runtime comparison, not framework |

---

## Reproducing These Results

```bash
# Install benchmark tool (recommended)
brew install oha   # or wrk, bombardier

# Run full benchmark suite
bun benchmark/fair-bench.ts

# Quick mode
bun benchmark/fair-bench.ts --quick
```

---

*Generated by bunWay Fair Benchmark Suite*
