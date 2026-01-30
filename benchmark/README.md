# bunWay Benchmark Suite

Professional, fair, and reproducible benchmarks for comparing web framework performance.

## Quick Start

```bash
# Install benchmark tool (one-time setup)
brew install oha

# Run benchmarks
bun run benchmark:fair:quick    # ~3 minutes
bun run benchmark:fair          # ~20 minutes (full suite)
```

Results are saved to `benchmark/results/FAIR_COMPARISON.md`.

---

## Methodology

This benchmark suite follows **TechEmpower-style methodology** for fair and accurate results:

| Aspect | Configuration | Why It Matters |
|--------|---------------|----------------|
| **No Global Middleware** | `/json` and `/plaintext` have zero middleware | Global middleware unfairly handicaps frameworks |
| **External Tool** | Uses `oha` (Rust) | Avoids client-side bottlenecks at high RPS |
| **Warmup Period** | 3-5 seconds, discarded | Cold code performs differently than warm code |
| **Multiple Runs** | 2-3 independent runs | Single runs are statistically invalid |
| **CV% Validation** | Coefficient of Variation < 10% | Identifies noisy/unreliable results |
| **Runtime Separation** | Bun vs Node.js shown separately | Runtime differences dominate framework differences |

---

## Prerequisites

### Required
- [Bun](https://bun.sh) v1.0+
- [Node.js](https://nodejs.org) v20+ (for Express/Fastify benchmarks)

### Benchmark Tool (Choose One)

We recommend **oha** for the most accurate results with fast Bun servers:

```bash
# macOS
brew install oha

# Linux (with Rust)
cargo install oha

# Alternative: wrk
brew install wrk        # macOS
apt-get install wrk     # Ubuntu/Debian

# Alternative: bombardier
brew install bombardier
```

**Tool Selection Guide:**

| Server Speed | Recommended Tool |
|--------------|------------------|
| < 30k req/s | Any tool works |
| 30-80k req/s | wrk or bombardier |
| > 80k req/s | **oha** (Rust) |

If no external tool is installed, the benchmark falls back to an internal implementation (less accurate for fast servers).

---

## Running Benchmarks

### Quick Benchmark (~3 minutes)

```bash
bun run benchmark:fair:quick
```

- 10 seconds per endpoint
- 2 independent runs
- 3 second warmup

### Full Benchmark (~20 minutes)

```bash
bun run benchmark:fair
```

- 30 seconds per endpoint
- 3 independent runs
- 5 second warmup

### Options

```bash
# Force a specific tool
bun benchmark/fair-bench.ts --tool=oha
bun benchmark/fair-bench.ts --tool=wrk

# Show tool installation instructions
bun benchmark/fair-bench.ts --install
```

---

## Understanding Results

### Sample Output

```
BUN FRAMEWORKS:
  🥇 Elysia        119,816 req/s (CV: 0.3%)
  🥈 Hono           98,437 req/s (CV: 0.3%)
  🥉 bunWay         95,207 req/s (CV: 0.2%)

NODE.JS FRAMEWORKS:
  🥇 Fastify        64,432 req/s (CV: 0.4%)
  🥈 Express        39,856 req/s (CV: 0.1%)
```

### What the Metrics Mean

| Metric | Description |
|--------|-------------|
| **req/s** | Requests per second (higher is better) |
| **CV%** | Coefficient of Variation - measures result consistency |
| **✓** | CV < 10% = reliable result |
| **⚠️** | CV > 10% = high variance, may need more runs |

### Result Files

After running benchmarks, you'll find:

```
benchmark/results/
├── FAIR_COMPARISON.md                    # Human-readable report
├── fair_comparison_YYYYMMDD_HHMMSS.json  # Raw data with full statistics
└── ...
```

---

## Frameworks Tested

### Bun Frameworks
| Framework | Description |
|-----------|-------------|
| **bunWay** | Express-style routing for Bun |
| **Hono** | Ultrafast web framework |
| **Elysia** | TypeScript-first framework |

### Node.js Frameworks
| Framework | Description |
|-----------|-------------|
| **Fastify** | Fast and low overhead |
| **Express** | Minimalist web framework |

---

## Benchmark Endpoints

Each framework implements identical endpoints:

| Endpoint | Description | Middleware |
|----------|-------------|------------|
| `GET /json` | JSON serialization | **None** |
| `GET /plaintext` | Plain text response | **None** |
| `GET /route50/:id` | Dynamic routing | **None** |
| `GET /middleware` | Middleware chain (10 layers) | Yes |
| `POST /body` | JSON body parsing | Body parser only |
| `GET /db/:delay` | Simulated DB latency | None |
| `GET /health` | Health check | None |

---

## Reproducing Results

For consistent, reproducible results:

1. **Close other applications** - Reduces CPU contention
2. **Disable power saving** - Prevents CPU throttling
3. **Use wired network** - If testing remotely
4. **Run multiple times** - Verify CV% < 10%

```bash
# Run 3 times and compare
bun run benchmark:fair:quick
bun run benchmark:fair:quick
bun run benchmark:fair:quick
```

---

## Manual Testing

### Run Individual Servers

```bash
# bunWay
PORT=3000 bun benchmark/servers/bunway.ts

# Express (Node.js)
PORT=3000 node benchmark/servers/express.cjs

# Elysia
PORT=3000 bun benchmark/servers/elysia.ts

# Hono
PORT=3000 bun benchmark/servers/hono.ts

# Fastify (Node.js)
PORT=3000 node benchmark/servers/fastify.cjs
```

### Manual Benchmark with oha

```bash
# Start server in one terminal
bun benchmark/servers/bunway.ts

# Run benchmark in another terminal
oha -z 10s -c 100 --no-tui http://localhost:3000/json
```

---

## Adding Your Framework

To add a new framework to the benchmark:

1. Create `benchmark/servers/your-framework.ts` (or `.cjs` for Node.js)
2. Implement all required endpoints
3. **Important**: No global middleware on `/json` and `/plaintext`
4. Add framework config to `benchmark/fair-bench.ts`:

```typescript
// In FRAMEWORKS array
{
  name: "your-framework",
  displayName: "YourFramework",
  runtime: "bun", // or "node"
  serverFile: "your-framework.ts",
  port: 3006,
}
```

### Server Template

```typescript
// benchmark/servers/your-framework.ts
import { YourFramework } from "your-framework";

const app = new YourFramework();

// NOTE: NO global middleware - ensures fair benchmarks

// JSON benchmark (NO middleware)
app.get("/json", () => ({ message: "Hello, World!" }));

// Plaintext benchmark (NO middleware)
app.get("/plaintext", () => "Hello, World!");

// Route with params (NO middleware)
for (let i = 0; i < 100; i++) {
  app.get(`/route${i}/:id`, ({ params }) => ({ route: i, id: params.id }));
}

// Middleware benchmark - ONLY here
app.use("/middleware", middlewareChain);
app.get("/middleware", () => ({ processed: true }));

// Body parsing - middleware ONLY on this route
app.post("/body", bodyParser, (req) => ({
  received: true,
  size: JSON.stringify(req.body).length,
}));

const PORT = parseInt(process.env.PORT || "3000");
app.listen(PORT);
console.log(`Server running on http://localhost:${PORT}`);
```

---

## Troubleshooting

### "No benchmark tool detected"

Install oha:
```bash
brew install oha        # macOS
cargo install oha       # Linux/Windows with Rust
```

### High CV% (> 10%)

- Close background applications
- Run the full benchmark (longer duration)
- Check for thermal throttling
- Try running at different times

### Server fails to start

- Check if port is already in use: `lsof -i :3001`
- Verify all dependencies are installed: `bun install`

### Results seem too low

- Ensure you're using an external tool (oha/wrk)
- Check `Tool: internal` in output means fallback is being used
- Run `bun benchmark/fair-bench.ts --install` for setup instructions

---

## Legacy Benchmark

The original benchmark runner is still available:

```bash
bun run benchmark         # Uses internal Bun fetch
bun run benchmark:quick   # Quick mode
```

Note: The legacy benchmark may show inflated numbers for Bun servers due to client-side bottlenecks. Use `benchmark:fair` for accurate comparisons.

---

## Contributing

When submitting benchmark changes:

1. Run benchmarks 3+ times to verify consistency
2. Include CV% in your results
3. Document any methodology changes
4. Ensure all frameworks have identical test conditions
5. No global middleware on `/json` and `/plaintext` endpoints

---

## License

MIT - See [LICENSE](../LICENSE)
