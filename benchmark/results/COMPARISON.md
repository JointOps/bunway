# Benchmark Comparison Report

> Generated: January 30, 2026
> Machine: Apple Silicon (M-series)
> Test Config: 100 concurrent connections, 10 seconds per endpoint

---

## Summary

| Framework | Runtime | JSON (req/s) | Plaintext (req/s) | Routing (req/s) | Rank |
|-----------|---------|--------------|-------------------|-----------------|------|
| **Hono** | Bun | 91,846 | 91,846 | 91,846 | 🥇 1 |
| **Fastify** | Node.js | 81,352 | 81,352 | 81,352 | 🥈 2 |
| **bunWay** | Bun | 80,730 | 80,730 | 60,355 | 🥉 3 |
| **Elysia** | Bun | 63,676 | 63,676 | 63,676 | 4 |
| **Express** | Node.js | 43,818 | 43,818 | 43,818 | 5 |

---

## What These Numbers Mean

### Requests per Second (req/s)
The number of HTTP requests the server can handle in one second. Higher is better.

- **80,000+ req/s**: Excellent - handles very high traffic
- **50,000-80,000 req/s**: Good - suitable for most production workloads
- **20,000-50,000 req/s**: Acceptable - fine for moderate traffic
- **< 20,000 req/s**: May need optimization for high-traffic scenarios

### Latency
Time from when a request is sent to when the response is received.

- **< 1ms**: Excellent
- **1-5ms**: Good
- **5-20ms**: Acceptable
- **> 20ms**: May feel slow to users

---

## Detailed Analysis

### 🥇 Hono (91,846 req/s)
**The fastest framework tested.**

- Minimal abstraction over Bun's native HTTP
- Lightweight router with near-zero overhead
- Best choice when raw performance is the priority

### 🥈 Fastify (81,352 req/s)
**Fastest Node.js framework.**

- Highly optimized JSON serialization
- Schema-based validation (when used) adds minimal overhead
- Great choice for Node.js projects needing speed

### 🥉 bunWay (80,730 req/s)
**Express-compatible with near-Fastify performance.**

- Only ~1% slower than Fastify for JSON responses
- Express-compatible API means zero learning curve
- Best choice when migrating from Express to Bun

### Elysia (63,676 req/s)
**Feature-rich Bun framework.**

- Lower raw throughput than simpler alternatives
- Offers TypeScript-first experience with end-to-end type safety
- Best choice when developer experience matters more than raw speed

### Express (43,818 req/s)
**The baseline.**

- 2x slower than bunWay
- Still handles 43k+ requests/second (plenty for most apps)
- Massive ecosystem and community support

---

## Performance Comparison Chart

```
Requests per Second (higher is better)
──────────────────────────────────────────────────────────────────

Hono      ████████████████████████████████████████████████ 91,846
Fastify   ██████████████████████████████████████████       81,352
bunWay    █████████████████████████████████████████        80,730
Elysia    █████████████████████████████████                63,676
Express   ███████████████████████                          43,818

          0        25k       50k       75k       100k
```

---

## Key Takeaways

### bunWay vs Express
- **1.84x faster** than Express
- Same `(req, res, next)` API
- Drop-in replacement for most Express apps

### bunWay vs Fastify
- Nearly identical performance (~99%)
- bunWay uses familiar Express patterns
- Fastify requires learning new API

### bunWay vs Hono
- Hono is ~14% faster
- bunWay provides Express compatibility
- Choose Hono for maximum speed, bunWay for familiarity

### bunWay vs Elysia
- bunWay is ~27% faster
- Elysia offers better TypeScript integration
- Choose based on API style preference

---

## Test Methodology

### Endpoints Tested
| Endpoint | Description | Purpose |
|----------|-------------|---------|
| `/json` | Returns `{ message: "Hello, World!" }` | JSON serialization speed |
| `/plaintext` | Returns `"Hello, World!"` | Minimum framework overhead |
| `/route50/:id` | Route with parameter | Router matching performance |

### Configuration
- **Tool**: autocannon v8.0.0
- **Connections**: 100 concurrent
- **Duration**: 10 seconds per endpoint
- **Pipelining**: Disabled (realistic scenario)

### Environment
- **OS**: macOS (Darwin)
- **CPU**: Apple Silicon
- **Bun**: v1.3.7
- **Node.js**: v24.4.1

---

## Recommendations

| Use Case | Recommended Framework |
|----------|----------------------|
| Migrating from Express | **bunWay** |
| Maximum raw performance | **Hono** |
| Node.js with speed needs | **Fastify** |
| TypeScript-first development | **Elysia** |
| Ecosystem & community | **Express** |

---

## Running These Benchmarks

```bash
# Install dependencies
bun install

# Run individual server
bun benchmark/servers/bunway.ts

# Run benchmark
bunx autocannon -c 100 -d 10 http://localhost:3000/json

# Run full comparison
./benchmark/scripts/run-comparison.sh
```
