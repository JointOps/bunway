#!/usr/bin/env bun
/**
 * Fair & Accurate Benchmark Suite for bunWay
 *
 * Implements TechEmpower-style benchmarking methodology:
 * - Uses external tools (oha, wrk, bombardier) for accurate measurements
 * - 30+ second test duration
 * - 5 second warmup, discarded
 * - 3+ independent runs per test
 * - Statistical analysis (mean, CV%, percentiles)
 * - Separate results for Bun vs Node.js runtimes
 *
 * Usage:
 *   bun benchmark/fair-bench.ts                # Full benchmark
 *   bun benchmark/fair-bench.ts --quick        # Quick mode (10s per test)
 *   bun benchmark/fair-bench.ts --tool=oha     # Force specific tool
 *   bun benchmark/fair-bench.ts --install      # Show installation instructions
 */

import { spawn, type Subprocess } from "bun";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";

// ============================================================================
// Configuration
// ============================================================================

const BENCHMARK_DIR = dirname(import.meta.path);
const RESULTS_DIR = join(BENCHMARK_DIR, "results");
const SERVERS_DIR = join(BENCHMARK_DIR, "servers");

interface BenchmarkConfig {
  duration: number; // seconds
  warmupDuration: number; // seconds
  connections: number;
  runs: number; // number of independent runs
  endpoints: string[];
}

const QUICK_CONFIG: BenchmarkConfig = {
  duration: 10,
  warmupDuration: 3,
  connections: 100,
  runs: 2,
  endpoints: ["/json", "/plaintext"],
};

const FULL_CONFIG: BenchmarkConfig = {
  duration: 30,
  warmupDuration: 5,
  connections: 100,
  runs: 3,
  endpoints: ["/json", "/plaintext", "/route50/123"],
};

interface FrameworkConfig {
  name: string;
  displayName: string;
  runtime: "bun" | "node";
  serverFile: string;
  port: number;
}

const FRAMEWORKS: FrameworkConfig[] = [
  { name: "bunway", displayName: "bunWay", runtime: "bun", serverFile: "bunway.ts", port: 3001 },
  { name: "hono", displayName: "Hono", runtime: "bun", serverFile: "hono.ts", port: 3002 },
  { name: "elysia", displayName: "Elysia", runtime: "bun", serverFile: "elysia.ts", port: 3003 },
  { name: "express", displayName: "Express", runtime: "node", serverFile: "express.cjs", port: 3004 },
  { name: "fastify", displayName: "Fastify", runtime: "node", serverFile: "fastify.cjs", port: 3005 },
];

// ============================================================================
// Tool Detection & Installation
// ============================================================================

type BenchmarkTool = "oha" | "wrk" | "bombardier" | "internal";

async function checkToolAvailable(tool: string): Promise<boolean> {
  try {
    const proc = spawn({
      cmd: ["which", tool],
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    return exitCode === 0;
  } catch {
    return false;
  }
}

async function detectBestTool(): Promise<BenchmarkTool> {
  // Priority: oha > wrk > bombardier > internal
  if (await checkToolAvailable("oha")) return "oha";
  if (await checkToolAvailable("wrk")) return "wrk";
  if (await checkToolAvailable("bombardier")) return "bombardier";
  return "internal";
}

function printInstallInstructions(): void {
  console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                    BENCHMARK TOOL INSTALLATION                                ║
╚══════════════════════════════════════════════════════════════════════════════╝

For accurate benchmarks of fast servers (>50k req/s), install one of these tools:

1. OHA (Recommended for Bun servers) - Rust HTTP benchmarker
   ┌─────────────────────────────────────────────────────────────┐
   │  brew install oha                # macOS                    │
   │  cargo install oha               # Any platform with Rust   │
   └─────────────────────────────────────────────────────────────┘

2. WRK - Classic C benchmarker
   ┌─────────────────────────────────────────────────────────────┐
   │  brew install wrk                # macOS                    │
   │  apt-get install wrk             # Ubuntu/Debian            │
   └─────────────────────────────────────────────────────────────┘

3. BOMBARDIER - Go benchmarker (cross-platform)
   ┌─────────────────────────────────────────────────────────────┐
   │  brew install bombardier         # macOS                    │
   │  go install github.com/codesenberg/bombardier@latest        │
   └─────────────────────────────────────────────────────────────┘

Tool Selection Guide:
┌──────────────────┬──────────────────────────────────────────────┐
│ Server Speed     │ Recommended Tool                             │
├──────────────────┼──────────────────────────────────────────────┤
│ < 30k req/s      │ Any tool works fine                          │
│ 30-80k req/s     │ wrk or bombardier                            │
│ > 80k req/s      │ oha (Rust) - most accurate for fast servers  │
└──────────────────┴──────────────────────────────────────────────┘

Without external tools, the benchmark will use an internal fallback which
may be less accurate for very fast servers due to client-side bottlenecks.
`);
}

// ============================================================================
// External Tool Runners
// ============================================================================

interface ToolResult {
  rps: number;
  latencyAvg: number;
  latencyP50: number;
  latencyP99: number;
  errors: number;
  totalRequests: number;
}

async function runOha(
  url: string,
  duration: number,
  connections: number
): Promise<ToolResult> {
  const proc = spawn({
    cmd: [
      "oha",
      "-z", `${duration}s`,
      "-c", String(connections),
      "--no-tui",
      "--output-format", "json",
      url,
    ],
    stdout: "pipe",
    stderr: "pipe",
  });

  const output = await new Response(proc.stdout).text();
  await proc.exited;

  try {
    const data = JSON.parse(output);

    // Count errors from errorDistribution
    let errorCount = 0;
    if (data.errorDistribution) {
      for (const count of Object.values(data.errorDistribution)) {
        errorCount += count as number;
      }
    }

    // Count total requests from statusCodeDistribution
    let totalRequests = 0;
    if (data.statusCodeDistribution) {
      for (const count of Object.values(data.statusCodeDistribution)) {
        totalRequests += count as number;
      }
    }

    return {
      rps: data.summary?.requestsPerSec || 0,
      latencyAvg: (data.summary?.average || 0) * 1000, // Convert to ms
      latencyP50: (data.latencyPercentiles?.p50 || 0) * 1000,
      latencyP99: (data.latencyPercentiles?.p99 || 0) * 1000,
      errors: errorCount,
      totalRequests: totalRequests + errorCount,
    };
  } catch {
    console.error("Failed to parse oha output:", output.slice(0, 500));
    throw new Error("Failed to parse oha output");
  }
}

async function runWrk(
  url: string,
  duration: number,
  connections: number
): Promise<ToolResult> {
  const proc = spawn({
    cmd: [
      "wrk",
      "-t", "4", // threads
      "-c", String(connections),
      "-d", `${duration}s`,
      "--latency",
      url,
    ],
    stdout: "pipe",
    stderr: "pipe",
  });

  const output = await new Response(proc.stdout).text();
  await proc.exited;

  // Parse wrk output
  const rpsMatch = output.match(/Requests\/sec:\s+([\d.]+)/);
  const latencyMatch = output.match(/Latency\s+([\d.]+)(us|ms|s)/);
  const p50Match = output.match(/50%\s+([\d.]+)(us|ms|s)/);
  const p99Match = output.match(/99%\s+([\d.]+)(us|ms|s)/);
  const requestsMatch = output.match(/(\d+) requests in/);
  const errorsMatch = output.match(/Socket errors:.*read (\d+)/);

  const parseLatency = (value: string, unit: string): number => {
    const v = parseFloat(value);
    if (unit === "us") return v / 1000;
    if (unit === "s") return v * 1000;
    return v; // ms
  };

  return {
    rps: rpsMatch ? parseFloat(rpsMatch[1]) : 0,
    latencyAvg: latencyMatch ? parseLatency(latencyMatch[1], latencyMatch[2]) : 0,
    latencyP50: p50Match ? parseLatency(p50Match[1], p50Match[2]) : 0,
    latencyP99: p99Match ? parseLatency(p99Match[1], p99Match[2]) : 0,
    errors: errorsMatch ? parseInt(errorsMatch[1], 10) : 0,
    totalRequests: requestsMatch ? parseInt(requestsMatch[1], 10) : 0,
  };
}

async function runBombardier(
  url: string,
  duration: number,
  connections: number
): Promise<ToolResult> {
  const proc = spawn({
    cmd: [
      "bombardier",
      "-c", String(connections),
      "-d", `${duration}s`,
      "-p", "r", // print results
      "-o", "json",
      url,
    ],
    stdout: "pipe",
    stderr: "pipe",
  });

  const output = await new Response(proc.stdout).text();
  await proc.exited;

  try {
    const data = JSON.parse(output);
    return {
      rps: data.result?.rps?.mean || 0,
      latencyAvg: (data.result?.latency?.mean || 0) / 1e6, // ns to ms
      latencyP50: (data.result?.latency?.percentiles?.["50"] || 0) / 1e6,
      latencyP99: (data.result?.latency?.percentiles?.["99"] || 0) / 1e6,
      errors: data.result?.errors || 0,
      totalRequests: data.result?.req1xx + data.result?.req2xx + data.result?.req3xx + data.result?.req4xx + data.result?.req5xx || 0,
    };
  } catch {
    console.error("Failed to parse bombardier output:", output.slice(0, 500));
    throw new Error("Failed to parse bombardier output");
  }
}

async function runInternalBenchmark(
  url: string,
  duration: number,
  connections: number
): Promise<ToolResult> {
  // Internal fallback - less accurate but works without external tools
  const endTime = Date.now() + duration * 1000;
  const latencies: number[] = [];
  let errors = 0;
  let completed = 0;

  // Run concurrent requests
  const workers: Promise<void>[] = [];

  for (let i = 0; i < connections; i++) {
    workers.push(
      (async () => {
        while (Date.now() < endTime) {
          const start = performance.now();
          try {
            const res = await fetch(url);
            if (!res.ok) errors++;
            latencies.push(performance.now() - start);
            completed++;
          } catch {
            errors++;
            latencies.push(performance.now() - start);
            completed++;
          }
        }
      })()
    );
  }

  await Promise.all(workers);

  // Calculate statistics
  latencies.sort((a, b) => a - b);
  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
  const rps = completed / duration;

  return {
    rps,
    latencyAvg: avg,
    latencyP50: p50,
    latencyP99: p99,
    errors,
    totalRequests: completed,
  };
}

// ============================================================================
// Benchmark Runner
// ============================================================================

async function runBenchmarkWithTool(
  tool: BenchmarkTool,
  url: string,
  duration: number,
  connections: number
): Promise<ToolResult> {
  switch (tool) {
    case "oha":
      return runOha(url, duration, connections);
    case "wrk":
      return runWrk(url, duration, connections);
    case "bombardier":
      return runBombardier(url, duration, connections);
    case "internal":
      return runInternalBenchmark(url, duration, connections);
  }
}

// ============================================================================
// Statistical Analysis
// ============================================================================

interface RunStatistics {
  samples: number[];
  mean: number;
  median: number;
  min: number;
  max: number;
  stdDev: number;
  cv: number; // Coefficient of variation (%)
  isReliable: boolean; // CV < 10%
}

function calculateStatistics(samples: number[]): RunStatistics {
  if (samples.length === 0) {
    return { samples: [], mean: 0, median: 0, min: 0, max: 0, stdDev: 0, cv: 0, isReliable: false };
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const median = sorted[Math.floor(sorted.length / 2)] || 0;
  const min = sorted[0] || 0;
  const max = sorted[sorted.length - 1] || 0;

  const variance = samples.reduce((sum, x) => sum + (x - mean) ** 2, 0) / samples.length;
  const stdDev = Math.sqrt(variance);
  const cv = mean > 0 ? (stdDev / mean) * 100 : 0;

  return {
    samples,
    mean,
    median,
    min,
    max,
    stdDev,
    cv,
    isReliable: cv < 10,
  };
}

// ============================================================================
// Server Management
// ============================================================================

async function startServer(framework: FrameworkConfig): Promise<Subprocess> {
  const serverPath = join(SERVERS_DIR, framework.serverFile);

  if (!existsSync(serverPath)) {
    throw new Error(`Server file not found: ${serverPath}`);
  }

  const cmd =
    framework.runtime === "bun"
      ? ["bun", "run", serverPath]
      : ["node", serverPath];

  const proc = spawn({
    cmd,
    env: { ...process.env, PORT: String(framework.port) },
    stdout: "pipe",
    stderr: "pipe",
  });

  // Wait for server to be ready
  const maxWait = 15000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    try {
      const res = await fetch(`http://localhost:${framework.port}/json`);
      if (res.ok) {
        // Additional warmup - let the server stabilize
        for (let i = 0; i < 100; i++) {
          await fetch(`http://localhost:${framework.port}/json`);
        }
        return proc;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  proc.kill();
  throw new Error(`Server ${framework.name} failed to start within ${maxWait}ms`);
}

function stopServer(proc: Subprocess): void {
  try {
    proc.kill();
  } catch {
    // Process may already be dead
  }
}

// ============================================================================
// Results & Reporting
// ============================================================================

interface EndpointResult {
  rps: RunStatistics;
  latencyAvg: RunStatistics;
  latencyP50: RunStatistics;
  latencyP99: RunStatistics;
  errors: number;
  totalRequests: number;
}

interface FrameworkResults {
  name: string;
  displayName: string;
  runtime: "bun" | "node";
  endpoints: Record<string, EndpointResult>;
  timestamp: string;
}

interface FairBenchmarkRun {
  timestamp: string;
  config: BenchmarkConfig;
  tool: BenchmarkTool;
  environment: {
    os: string;
    arch: string;
    bunVersion: string;
    nodeVersion: string;
  };
  bunResults: FrameworkResults[];
  nodeResults: FrameworkResults[];
}

function generateFairReport(run: FairBenchmarkRun): string {
  const { bunResults, nodeResults, timestamp, config, tool, environment } = run;

  // Sort each group by JSON RPS
  const sortedBun = [...bunResults].sort(
    (a, b) => (b.endpoints["/json"]?.rps.mean || 0) - (a.endpoints["/json"]?.rps.mean || 0)
  );
  const sortedNode = [...nodeResults].sort(
    (a, b) => (b.endpoints["/json"]?.rps.mean || 0) - (a.endpoints["/json"]?.rps.mean || 0)
  );

  const medals = ["🥇", "🥈", "🥉"];

  let md = `# Fair Benchmark Comparison Report

> **Generated**: ${new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}
> **Machine**: ${environment.os} (${environment.arch})
> **Benchmark Tool**: ${tool.toUpperCase()}
> **Test Duration**: ${config.duration}s per endpoint × ${config.runs} runs
> **Warmup**: ${config.warmupDuration}s (discarded)
> **Connections**: ${config.connections} concurrent

---

## Methodology

This benchmark follows TechEmpower-style methodology for fair and accurate results:

1. **No Global Middleware** - All frameworks have zero global middleware on \`/json\` and \`/plaintext\`
2. **External Tool** - Using \`${tool}\` for accurate measurements (not client-side bottlenecked)
3. **Multiple Runs** - ${config.runs} independent runs per test for statistical validity
4. **Warmup Period** - ${config.warmupDuration}s warmup discarded before measurement
5. **Runtime Separation** - Bun and Node.js results shown separately (not apples-to-oranges)
6. **CV% Validation** - Coefficient of Variation < 10% indicates reliable results

---

## Bun Frameworks (Bun v${environment.bunVersion})

| Rank | Framework | JSON (req/s) | CV% | Plaintext (req/s) | Latency (avg) |
|------|-----------|--------------|-----|-------------------|---------------|
`;

  sortedBun.forEach((fw, i) => {
    const rank = medals[i] || String(i + 1);
    const jsonRps = fw.endpoints["/json"]?.rps;
    const plainRps = fw.endpoints["/plaintext"]?.rps;
    const latency = fw.endpoints["/json"]?.latencyAvg;

    const cvBadge = jsonRps?.isReliable ? "✓" : "⚠️";

    md += `| ${rank} | **${fw.displayName}** | ${Math.round(jsonRps?.mean || 0).toLocaleString()} | ${jsonRps?.cv.toFixed(1)}% ${cvBadge} | ${Math.round(plainRps?.mean || 0).toLocaleString()} | ${latency?.mean.toFixed(2)}ms |\n`;
  });

  md += `
## Node.js Frameworks (Node.js ${environment.nodeVersion})

| Rank | Framework | JSON (req/s) | CV% | Plaintext (req/s) | Latency (avg) |
|------|-----------|--------------|-----|-------------------|---------------|
`;

  sortedNode.forEach((fw, i) => {
    const rank = medals[i] || String(i + 1);
    const jsonRps = fw.endpoints["/json"]?.rps;
    const plainRps = fw.endpoints["/plaintext"]?.rps;
    const latency = fw.endpoints["/json"]?.latencyAvg;

    const cvBadge = jsonRps?.isReliable ? "✓" : "⚠️";

    md += `| ${rank} | **${fw.displayName}** | ${Math.round(jsonRps?.mean || 0).toLocaleString()} | ${jsonRps?.cv.toFixed(1)}% ${cvBadge} | ${Math.round(plainRps?.mean || 0).toLocaleString()} | ${latency?.mean.toFixed(2)}ms |\n`;
  });

  // Performance charts
  md += `
---

## Performance Charts

### Bun Frameworks - Requests/sec (higher is better)

\`\`\`
`;

  const maxBunRps = Math.max(...sortedBun.map((fw) => fw.endpoints["/json"]?.rps.mean || 0));
  sortedBun.forEach((fw) => {
    const rps = fw.endpoints["/json"]?.rps.mean || 0;
    const barLength = Math.round((rps / maxBunRps) * 40);
    const bar = "█".repeat(barLength);
    const name = fw.displayName.padEnd(10);
    md += `${name} ${bar} ${Math.round(rps).toLocaleString()}\n`;
  });

  md += `\`\`\`

### Node.js Frameworks - Requests/sec (higher is better)

\`\`\`
`;

  const maxNodeRps = Math.max(...sortedNode.map((fw) => fw.endpoints["/json"]?.rps.mean || 0));
  sortedNode.forEach((fw) => {
    const rps = fw.endpoints["/json"]?.rps.mean || 0;
    const barLength = Math.round((rps / maxNodeRps) * 40);
    const bar = "█".repeat(barLength);
    const name = fw.displayName.padEnd(10);
    md += `${name} ${bar} ${Math.round(rps).toLocaleString()}\n`;
  });

  md += `\`\`\`

---

## Cross-Runtime Comparison

⚠️ **Important**: Direct Bun vs Node.js comparison is NOT apples-to-apples.
Runtime differences dominate framework differences. This section is for informational purposes only.

`;

  const allResults = [...sortedBun, ...sortedNode].sort(
    (a, b) => (b.endpoints["/json"]?.rps.mean || 0) - (a.endpoints["/json"]?.rps.mean || 0)
  );

  md += `| Rank | Framework | Runtime | JSON (req/s) | vs #1 |\n`;
  md += `|------|-----------|---------|--------------|-------|\n`;

  const topRps = allResults[0]?.endpoints["/json"]?.rps.mean || 1;
  allResults.forEach((fw, i) => {
    const rps = fw.endpoints["/json"]?.rps.mean || 0;
    const pct = ((rps / topRps) * 100).toFixed(1);
    const runtime = fw.runtime === "bun" ? "Bun" : "Node.js";
    md += `| ${i + 1} | ${fw.displayName} | ${runtime} | ${Math.round(rps).toLocaleString()} | ${pct}% |\n`;
  });

  md += `

---

## Detailed Statistics

`;

  const allSorted = [...sortedBun, ...sortedNode];
  for (const fw of allSorted) {
    md += `### ${fw.displayName} (${fw.runtime === "bun" ? "Bun" : "Node.js"})\n\n`;
    md += `| Endpoint | Mean RPS | Median | Min | Max | StdDev | CV% | Reliable |\n`;
    md += `|----------|----------|--------|-----|-----|--------|-----|----------|\n`;

    for (const [endpoint, result] of Object.entries(fw.endpoints)) {
      const rps = result.rps;
      const reliable = rps.isReliable ? "✓" : "⚠️";
      md += `| \`${endpoint}\` | ${Math.round(rps.mean).toLocaleString()} | ${Math.round(rps.median).toLocaleString()} | ${Math.round(rps.min).toLocaleString()} | ${Math.round(rps.max).toLocaleString()} | ${Math.round(rps.stdDev).toLocaleString()} | ${rps.cv.toFixed(1)}% | ${reliable} |\n`;
    }
    md += "\n";
  }

  md += `---

## What Makes This Benchmark Fair

| Aspect | This Benchmark | Why It Matters |
|--------|---------------|----------------|
| Middleware | None on \`/json\`, \`/plaintext\` | Global middleware unfairly handicaps frameworks |
| Tool | ${tool} | External tools avoid client-side bottlenecks |
| Duration | ${config.duration}s | JIT, GC, caches need time to stabilize |
| Warmup | ${config.warmupDuration}s discarded | Cold code performs differently than warm code |
| Runs | ${config.runs} independent runs | Single runs are statistically invalid |
| Statistics | CV% reported | Identifies noisy/unreliable results |
| Runtimes | Separated | Bun vs Node.js is runtime comparison, not framework |

---

## Reproducing These Results

\`\`\`bash
# Install benchmark tool (recommended)
brew install oha   # or wrk, bombardier

# Run full benchmark suite
bun benchmark/fair-bench.ts

# Quick mode
bun benchmark/fair-bench.ts --quick
\`\`\`

---

*Generated by bunWay Fair Benchmark Suite*
`;

  return md;
}

// ============================================================================
// Main Runner
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  // Handle --install flag
  if (args.includes("--install") || args.includes("-i")) {
    printInstallInstructions();
    return;
  }

  const isQuick = args.includes("--quick") || args.includes("-q");
  const forceTool = args.find((a) => a.startsWith("--tool="))?.split("=")[1] as BenchmarkTool | undefined;

  const config = isQuick ? QUICK_CONFIG : FULL_CONFIG;

  // Detect or use forced tool
  let tool: BenchmarkTool;
  if (forceTool) {
    if (await checkToolAvailable(forceTool)) {
      tool = forceTool;
    } else {
      console.error(`Error: Tool '${forceTool}' is not installed.`);
      printInstallInstructions();
      process.exit(1);
    }
  } else {
    tool = await detectBestTool();
  }

  console.log("\n╔══════════════════════════════════════════════════════════════════╗");
  console.log("║          bunWay Fair Benchmark Suite (TechEmpower-style)          ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝\n");

  console.log(`Mode:        ${isQuick ? "Quick" : "Full"}`);
  console.log(`Tool:        ${tool}${tool === "internal" ? " (⚠️ install oha/wrk for better accuracy)" : ""}`);
  console.log(`Duration:    ${config.duration}s per endpoint`);
  console.log(`Warmup:      ${config.warmupDuration}s (discarded)`);
  console.log(`Runs:        ${config.runs} independent runs`);
  console.log(`Connections: ${config.connections}`);
  console.log(`Endpoints:   ${config.endpoints.join(", ")}`);
  console.log("");

  if (tool === "internal") {
    console.log("⚠️  Using internal benchmark (no external tools detected)");
    console.log("   For more accurate results, run: bun benchmark/fair-bench.ts --install\n");
  }

  // Ensure results directory exists
  if (!existsSync(RESULTS_DIR)) {
    mkdirSync(RESULTS_DIR, { recursive: true });
  }

  const bunResults: FrameworkResults[] = [];
  const nodeResults: FrameworkResults[] = [];
  const timestamp = new Date().toISOString();

  for (const framework of FRAMEWORKS) {
    console.log(`\n${"═".repeat(70)}`);
    console.log(`  ${framework.displayName} (${framework.runtime === "bun" ? "Bun" : "Node.js"})`);
    console.log(`${"═".repeat(70)}`);

    let proc: Subprocess | null = null;

    try {
      console.log(`  Starting server on port ${framework.port}...`);
      proc = await startServer(framework);
      console.log(`  Server ready ✓\n`);

      const endpointResults: Record<string, EndpointResult> = {};

      for (const endpoint of config.endpoints) {
        const url = `http://localhost:${framework.port}${endpoint}`;
        console.log(`  Benchmarking ${endpoint}:`);

        // Warmup (discarded)
        process.stdout.write(`    Warmup (${config.warmupDuration}s)... `);
        await runBenchmarkWithTool(tool, url, config.warmupDuration, config.connections);
        console.log("done");

        // Multiple runs
        const rpsSamples: number[] = [];
        const latencyAvgSamples: number[] = [];
        const latencyP50Samples: number[] = [];
        const latencyP99Samples: number[] = [];
        let totalErrors = 0;
        let totalRequests = 0;

        for (let run = 1; run <= config.runs; run++) {
          process.stdout.write(`    Run ${run}/${config.runs} (${config.duration}s)... `);

          const result = await runBenchmarkWithTool(tool, url, config.duration, config.connections);

          rpsSamples.push(result.rps);
          latencyAvgSamples.push(result.latencyAvg);
          latencyP50Samples.push(result.latencyP50);
          latencyP99Samples.push(result.latencyP99);
          totalErrors += result.errors;
          totalRequests += result.totalRequests;

          console.log(`${Math.round(result.rps).toLocaleString()} req/s`);

          // Brief pause between runs
          await new Promise((r) => setTimeout(r, 1000));
        }

        const rpsStats = calculateStatistics(rpsSamples);
        const reliabilityBadge = rpsStats.isReliable ? "✓" : "⚠️ high variance";

        console.log(`    → Mean: ${Math.round(rpsStats.mean).toLocaleString()} req/s (CV: ${rpsStats.cv.toFixed(1)}%) ${reliabilityBadge}\n`);

        endpointResults[endpoint] = {
          rps: rpsStats,
          latencyAvg: calculateStatistics(latencyAvgSamples),
          latencyP50: calculateStatistics(latencyP50Samples),
          latencyP99: calculateStatistics(latencyP99Samples),
          errors: totalErrors,
          totalRequests,
        };
      }

      const frameworkResult: FrameworkResults = {
        name: framework.name,
        displayName: framework.displayName,
        runtime: framework.runtime,
        endpoints: endpointResults,
        timestamp,
      };

      if (framework.runtime === "bun") {
        bunResults.push(frameworkResult);
      } else {
        nodeResults.push(frameworkResult);
      }
    } catch (error) {
      console.error(`  Error testing ${framework.name}:`, error);
    } finally {
      if (proc) {
        stopServer(proc);
        console.log(`  Server stopped ✓`);
      }
      // Wait before starting next server
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  // Save results
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const timeStr = new Date().toISOString().slice(11, 19).replace(/:/g, "");

  const run: FairBenchmarkRun = {
    timestamp,
    config,
    tool,
    environment: {
      os: process.platform,
      arch: process.arch,
      bunVersion: Bun.version,
      nodeVersion: process.version,
    },
    bunResults,
    nodeResults,
  };

  // Save JSON results
  const jsonFile = join(RESULTS_DIR, `fair_comparison_${dateStr}_${timeStr}.json`);
  writeFileSync(jsonFile, JSON.stringify(run, null, 2));
  console.log(`\n✓ Results saved to: ${jsonFile}`);

  // Generate and save markdown report
  const mdReport = generateFairReport(run);
  const mdFile = join(RESULTS_DIR, "FAIR_COMPARISON.md");
  writeFileSync(mdFile, mdReport);
  console.log(`✓ Report saved to: ${mdFile}`);

  // Print summary
  console.log("\n╔══════════════════════════════════════════════════════════════════╗");
  console.log("║                    FAIR BENCHMARK COMPLETE                        ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝\n");

  console.log("BUN FRAMEWORKS:");
  const sortedBun = [...bunResults].sort(
    (a, b) => (b.endpoints["/json"]?.rps.mean || 0) - (a.endpoints["/json"]?.rps.mean || 0)
  );
  sortedBun.forEach((fw, i) => {
    const rps = fw.endpoints["/json"]?.rps.mean || 0;
    const cv = fw.endpoints["/json"]?.rps.cv || 0;
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "  ";
    const reliability = cv < 10 ? "" : " ⚠️";
    console.log(`  ${medal} ${fw.displayName.padEnd(10)} ${Math.round(rps).toLocaleString().padStart(10)} req/s (CV: ${cv.toFixed(1)}%)${reliability}`);
  });

  console.log("\nNODE.JS FRAMEWORKS:");
  const sortedNode = [...nodeResults].sort(
    (a, b) => (b.endpoints["/json"]?.rps.mean || 0) - (a.endpoints["/json"]?.rps.mean || 0)
  );
  sortedNode.forEach((fw, i) => {
    const rps = fw.endpoints["/json"]?.rps.mean || 0;
    const cv = fw.endpoints["/json"]?.rps.cv || 0;
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : "  ";
    const reliability = cv < 10 ? "" : " ⚠️";
    console.log(`  ${medal} ${fw.displayName.padEnd(10)} ${Math.round(rps).toLocaleString().padStart(10)} req/s (CV: ${cv.toFixed(1)}%)${reliability}`);
  });

  console.log(`\nDetailed report: ${mdFile}`);
}

main().catch(console.error);
