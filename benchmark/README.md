# bunWay Benchmarks

Performance benchmarks comparing bunWay against Express, Fastify, Elysia, and Hono.

## Quick Start

```bash
# Install benchmark dependencies
npm install -g autocannon

# Run bunWay benchmark server
bun benchmark/servers/bunway.ts

# In another terminal, run benchmark
./benchmark/scripts/run-single.sh /json 10 100
```

## Full Comparison

Run benchmarks across all frameworks:

```bash
# Requires: autocannon, jq
./benchmark/scripts/run-comparison.sh
```

## Endpoints

| Endpoint | Description |
|----------|-------------|
| `/json` | JSON serialization |
| `/plaintext` | Plaintext response |
| `/route50/:id` | Route with parameter (tests router) |
| `/middleware` | Passes through 10 middleware |
| `/body` | POST with JSON body parsing |
| `/db/:delay` | Simulated database latency |
| `/health` | Health check with memory stats |

## Stress Testing (k6)

```bash
# Install k6
brew install k6

# Load test
k6 run benchmark/scenarios/load-test.js

# Spike test
k6 run benchmark/scenarios/spike-test.js

# Soak test (4 hours)
k6 run benchmark/scenarios/soak-test.js
```

## Running Individual Servers

```bash
# bunWay
bun benchmark/servers/bunway.ts

# Express (requires: npm install express)
node benchmark/servers/express.js

# Elysia (requires: bun add elysia)
bun benchmark/servers/elysia.ts

# Hono (requires: bun add hono)
bun benchmark/servers/hono.ts

# Fastify (requires: npm install fastify)
node benchmark/servers/fastify.js
```

## Results

Results are saved to `benchmark/results/` as JSON files.
