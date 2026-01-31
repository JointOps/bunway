#!/usr/bin/env bun
/**
 * Automated Benchmark Runner for bunWay
 *
 * Usage:
 *   bun run benchmark         # Run all benchmarks
 *   bun run benchmark:quick   # Quick benchmark (fewer iterations)
 *   bun run benchmark:ci      # CI mode (bunWay only, JSON output)
 */

import { spawn, type Subprocess } from "bun";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { join, dirname } from "path";

// ============================================================================
// Configuration
// ============================================================================

const BENCHMARK_DIR = dirname(import.meta.path);
const RESULTS_DIR = join(BENCHMARK_DIR, "results");
const SERVERS_DIR = join(BENCHMARK_DIR, "servers");

interface BenchmarkConfig {
  iterations: number;
  warmupIterations: number;
  concurrency: number;
  endpoints: string[];
}

const QUICK_CONFIG: BenchmarkConfig = {
  iterations: 3000,
  warmupIterations: 500,
  concurrency: 50,
  endpoints: ["/json", "/plaintext"],
};

const FULL_CONFIG: BenchmarkConfig = {
  iterations: 10000,
  warmupIterations: 1000,
  concurrency: 100,
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
// Benchmark Functions
// ============================================================================

interface BenchmarkResult {
  rps: number;
  latencyAvg: number;
  latencyP99: number;
  errors: number;
}

async function runBenchmark(
  url: string,
  config: BenchmarkConfig
): Promise<BenchmarkResult> {
  const { iterations, warmupIterations, concurrency } = config;

  // Warmup
  for (let i = 0; i < warmupIterations; i++) {
    try {
      await fetch(url);
    } catch {
      // Ignore warmup errors
    }
  }

  // Actual benchmark - measure latencies
  const latencies: number[] = [];
  let errors = 0;
  const batchSize = concurrency;
  const batches = Math.ceil(iterations / batchSize);

  const overallStart = performance.now();

  for (let b = 0; b < batches; b++) {
    const batchPromises: Promise<void>[] = [];
    const remaining = Math.min(batchSize, iterations - b * batchSize);

    for (let i = 0; i < remaining; i++) {
      const start = performance.now();
      batchPromises.push(
        fetch(url)
          .then((res) => {
            if (!res.ok) errors++;
            latencies.push(performance.now() - start);
          })
          .catch(() => {
            errors++;
            latencies.push(performance.now() - start);
          })
      );
    }

    await Promise.all(batchPromises);
  }

  const overallEnd = performance.now();
  const duration = (overallEnd - overallStart) / 1000;

  // Calculate metrics
  latencies.sort((a, b) => a - b);
  const latencyAvg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const p99Index = Math.floor(latencies.length * 0.99);
  const latencyP99 = latencies[p99Index] || latencies[latencies.length - 1] || 0;
  const rps = iterations / duration;

  return { rps, latencyAvg, latencyP99, errors };
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
  const maxWait = 10000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    try {
      const res = await fetch(`http://localhost:${framework.port}/json`);
      if (res.ok) {
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

interface FrameworkResults {
  name: string;
  displayName: string;
  runtime: string;
  endpoints: Record<string, BenchmarkResult>;
  timestamp: string;
}

interface BenchmarkRun {
  timestamp: string;
  config: BenchmarkConfig;
  environment: {
    os: string;
    arch: string;
    bunVersion: string;
    nodeVersion: string;
  };
  results: FrameworkResults[];
}

function generateMarkdownReport(run: BenchmarkRun): string {
  const { results, timestamp, config, environment } = run;

  // Sort by JSON RPS (descending)
  const sorted = [...results].sort(
    (a, b) => (b.endpoints["/json"]?.rps || 0) - (a.endpoints["/json"]?.rps || 0)
  );

  const medals = ["🥇", "🥈", "🥉", "4", "5", "6", "7", "8", "9", "10"];

  let md = `# Benchmark Comparison Report

> Generated: ${new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}
> Machine: ${environment.os} (${environment.arch})
> Bun: ${environment.bunVersion} | Node.js: ${environment.nodeVersion}
> Config: ${config.iterations.toLocaleString()} requests, ${config.concurrency} concurrent connections

---

## Summary

| Rank | Framework | Runtime | JSON (req/s) | Plaintext (req/s) | Routing (req/s) | Latency (avg) |
|------|-----------|---------|--------------|-------------------|-----------------|---------------|
`;

  sorted.forEach((fw, i) => {
    const rank = medals[i] || String(i + 1);
    const jsonRps = fw.endpoints["/json"]?.rps || 0;
    const plainRps = fw.endpoints["/plaintext"]?.rps || 0;
    const routeRps = fw.endpoints["/route50/123"]?.rps || 0;
    const latency = fw.endpoints["/json"]?.latencyAvg || 0;

    md += `| ${rank} | **${fw.displayName}** | ${fw.runtime === "bun" ? "Bun" : "Node.js"} | ${Math.round(jsonRps).toLocaleString()} | ${Math.round(plainRps).toLocaleString()} | ${routeRps ? Math.round(routeRps).toLocaleString() : "N/A"} | ${latency.toFixed(2)}ms |\n`;
  });

  // Performance chart
  md += `
---

## Performance Chart

\`\`\`
Requests per Second (higher is better)
${"─".repeat(66)}

`;

  const maxRps = Math.max(...sorted.map((fw) => fw.endpoints["/json"]?.rps || 0));

  sorted.forEach((fw) => {
    const rps = fw.endpoints["/json"]?.rps || 0;
    const barLength = Math.round((rps / maxRps) * 40);
    const bar = "█".repeat(barLength);
    const name = fw.displayName.padEnd(10);
    md += `${name} ${bar} ${Math.round(rps).toLocaleString()}\n`;
  });

  md += `
          0        ${Math.round(maxRps / 4).toLocaleString()}       ${Math.round(maxRps / 2).toLocaleString()}       ${Math.round((maxRps * 3) / 4).toLocaleString()}       ${Math.round(maxRps).toLocaleString()}
\`\`\`

---

## Key Comparisons

`;

  // Find bunWay for comparisons
  const bunway = results.find((r) => r.name === "bunway");
  if (bunway) {
    const bunwayRps = bunway.endpoints["/json"]?.rps || 1;

    sorted.forEach((fw) => {
      if (fw.name === "bunway") return;

      const fwRps = fw.endpoints["/json"]?.rps || 0;
      const ratio = (bunwayRps / fwRps) * 100;
      const comparison = ratio > 100 ? `${(ratio - 100).toFixed(1)}% faster` : `${(100 - ratio).toFixed(1)}% slower`;

      md += `### bunWay vs ${fw.displayName}\n`;
      md += `- bunWay is **${comparison}** than ${fw.displayName}\n`;
      md += `- bunWay: ${Math.round(bunwayRps).toLocaleString()} req/s | ${fw.displayName}: ${Math.round(fwRps).toLocaleString()} req/s\n\n`;
    });
  }

  md += `---

## Detailed Results

`;

  for (const fw of sorted) {
    md += `### ${fw.displayName}\n\n`;
    md += `| Endpoint | Requests/sec | Latency (avg) | Latency (p99) | Errors |\n`;
    md += `|----------|--------------|---------------|---------------|--------|\n`;

    for (const [endpoint, result] of Object.entries(fw.endpoints)) {
      md += `| \`${endpoint}\` | ${Math.round(result.rps).toLocaleString()} | ${result.latencyAvg.toFixed(2)}ms | ${result.latencyP99.toFixed(2)}ms | ${result.errors} |\n`;
    }
    md += "\n";
  }

  md += `---

## Running These Benchmarks

\`\`\`bash
# Run full benchmark suite
bun run benchmark

# Quick benchmark (fewer iterations)
bun run benchmark:quick

# CI mode (bunWay only, JSON output)
bun run benchmark:ci
\`\`\`

---

*Generated by bunWay Benchmark Runner*
`;

  return md;
}

// ============================================================================
// Main Runner
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const isQuick = args.includes("--quick") || args.includes("-q");
  const isCi = args.includes("--ci");
  const onlyBunway = args.includes("--bunway-only") || isCi;

  const config = isQuick ? QUICK_CONFIG : FULL_CONFIG;
  const frameworksToTest = onlyBunway
    ? FRAMEWORKS.filter((f) => f.name === "bunway")
    : FRAMEWORKS;

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║           bunWay Automated Benchmark Runner               ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  console.log(`Mode: ${isQuick ? "Quick" : "Full"}`);
  console.log(`Iterations: ${config.iterations.toLocaleString()}`);
  console.log(`Concurrency: ${config.concurrency}`);
  console.log(`Frameworks: ${frameworksToTest.map((f) => f.displayName).join(", ")}`);
  console.log(`Endpoints: ${config.endpoints.join(", ")}`);
  console.log("");

  // Ensure results directory exists
  if (!existsSync(RESULTS_DIR)) {
    mkdirSync(RESULTS_DIR, { recursive: true });
  }

  const allResults: FrameworkResults[] = [];
  const timestamp = new Date().toISOString();

  for (const framework of frameworksToTest) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Testing: ${framework.displayName} (${framework.runtime})`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    let proc: Subprocess | null = null;

    try {
      console.log(`  Starting server on port ${framework.port}...`);
      proc = await startServer(framework);
      console.log(`  Server started ✓`);

      const endpointResults: Record<string, BenchmarkResult> = {};

      for (const endpoint of config.endpoints) {
        const url = `http://localhost:${framework.port}${endpoint}`;
        process.stdout.write(`  Benchmarking ${endpoint}... `);

        const result = await runBenchmark(url, config);
        endpointResults[endpoint] = result;

        console.log(`${Math.round(result.rps).toLocaleString()} req/s (${result.latencyAvg.toFixed(2)}ms avg)`);
      }

      allResults.push({
        name: framework.name,
        displayName: framework.displayName,
        runtime: framework.runtime,
        endpoints: endpointResults,
        timestamp,
      });
    } catch (error) {
      console.error(`  Error testing ${framework.name}:`, error);
    } finally {
      if (proc) {
        stopServer(proc);
        console.log(`  Server stopped ✓`);
      }
      // Wait a bit before starting next server
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  // Save results
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const timeStr = new Date().toISOString().slice(11, 19).replace(/:/g, "");

  const run: BenchmarkRun = {
    timestamp,
    config,
    environment: {
      os: process.platform,
      arch: process.arch,
      bunVersion: Bun.version,
      nodeVersion: process.version,
    },
    results: allResults,
  };

  // Save JSON results
  const jsonFile = join(RESULTS_DIR, `comparison_${dateStr}_${timeStr}.json`);
  writeFileSync(jsonFile, JSON.stringify(run, null, 2));
  console.log(`\n✓ Results saved to: ${jsonFile}`);

  // Generate and save markdown report
  if (!isCi) {
    const mdReport = generateMarkdownReport(run);
    const mdFile = join(RESULTS_DIR, "COMPARISON.md");
    writeFileSync(mdFile, mdReport);
    console.log(`✓ Report saved to: ${mdFile}`);
  }

  // Print summary
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║                    BENCHMARK COMPLETE                     ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  // Sort by JSON RPS
  const sorted = [...allResults].sort(
    (a, b) => (b.endpoints["/json"]?.rps || 0) - (a.endpoints["/json"]?.rps || 0)
  );

  console.log("JSON Response Performance:");
  sorted.forEach((fw, i) => {
    const rps = fw.endpoints["/json"]?.rps || 0;
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "  ";
    console.log(`  ${medal} ${fw.displayName.padEnd(10)} ${Math.round(rps).toLocaleString().padStart(8)} req/s`);
  });

  // CI mode: output JSON for parsing
  if (isCi) {
    console.log("\n__CI_OUTPUT_START__");
    console.log(JSON.stringify(run, null, 2));
    console.log("__CI_OUTPUT_END__");
  }
}

main().catch(console.error);
