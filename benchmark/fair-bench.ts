#!/usr/bin/env bun
/**
 * Fair & Accurate Benchmark Suite for bunWay
 *
 * Usage:
 *   bun benchmark/fair-bench.ts
 *   bun benchmark/fair-bench.ts --quick
 *   bun benchmark/fair-bench.ts --tool=oha
 *   bun benchmark/fair-bench.ts --ci-output
 *   bun benchmark/fair-bench.ts --baseline
 *   bun benchmark/fair-bench.ts --quick --check-regression
 */

import { spawn, type Subprocess } from "bun";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";

const BENCHMARK_DIR = dirname(import.meta.path);
const RESULTS_DIR = join(BENCHMARK_DIR, "results");
const SERVERS_DIR = join(BENCHMARK_DIR, "servers");

interface EndpointConfig {
  path: string;
  method?: "GET" | "POST";
  body?: string;
  contentType?: string;
  label?: string;
}

interface BenchmarkConfig {
  duration: number;
  warmupDuration: number;
  connections: number;
  runs: number;
  endpoints: EndpointConfig[];
  concurrencyLadder?: number[];
}

const QUICK_CONFIG: BenchmarkConfig = {
  duration: 10,
  warmupDuration: 3,
  connections: 100,
  runs: 2,
  endpoints: [
    { path: "/json" },
    { path: "/plaintext" },
    { path: "/params/42", label: "/params/:id" },
    { path: "/route50/123", label: "/route50/:id" },
  ],
};

const FULL_CONFIG: BenchmarkConfig = {
  duration: 30,
  warmupDuration: 5,
  connections: 100,
  runs: 3,
  endpoints: [
    { path: "/json" },
    { path: "/plaintext" },
    { path: "/params/42", label: "/params/:id" },
    { path: "/params/a/b/c", label: "/params/:a/:b/:c" },
    { path: "/db" },
    {
      path: "/body",
      method: "POST",
      body: '{"key":"value","n":42}',
      contentType: "application/json",
      label: "POST /body",
    },
    { path: "/mw5" },
    { path: "/mw10" },
    { path: "/route50/123", label: "/route50/:id" },
    { path: "/nonexistent", label: "/nonexistent (404)" },
  ],
  concurrencyLadder: [10, 50, 100, 500],
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

type BenchmarkTool = "oha" | "wrk" | "bombardier" | "internal";

interface ToolResult {
  rps: number;
  latencyAvg: number;
  latencyP50: number;
  latencyP75: number;
  latencyP99: number;
  latencyP999: number;
  errors: number;
  totalRequests: number;
}

interface OhaOutput {
  summary?: { requestsPerSec?: number; average?: number };
  latencyPercentiles?: { p50?: number; p75?: number; p99?: number; p999?: number };
  errorDistribution?: Record<string, number>;
  statusCodeDistribution?: Record<string, number>;
}

interface BombardierOutput {
  result?: {
    rps?: { mean?: number };
    latency?: {
      mean?: number;
      percentiles?: Record<string, number>;
    };
    errors?: number;
    req1xx?: number;
    req2xx?: number;
    req3xx?: number;
    req4xx?: number;
    req5xx?: number;
  };
}

async function checkToolAvailable(tool: string): Promise<boolean> {
  try {
    const proc = spawn({ cmd: ["which", tool], stdout: "pipe", stderr: "pipe" });
    return (await proc.exited) === 0;
  } catch {
    return false;
  }
}

async function detectBestTool(): Promise<BenchmarkTool> {
  if (await checkToolAvailable("oha")) return "oha";
  if (await checkToolAvailable("wrk")) return "wrk";
  if (await checkToolAvailable("bombardier")) return "bombardier";
  return "internal";
}

function printInstallInstructions(): void {
  console.log(`
BENCHMARK TOOL INSTALLATION

For accurate benchmarks of fast servers (>50k req/s), install one of:

1. OHA (recommended)
   brew install oha
   cargo install oha

2. WRK
   brew install wrk
   apt-get install wrk

3. BOMBARDIER
   brew install bombardier
   go install github.com/codesenberg/bombardier@latest
`);
}

function endpointLabel(endpoint: EndpointConfig): string {
  return endpoint.label || endpoint.path;
}

function emptyToolResult(): ToolResult {
  return {
    rps: 0,
    latencyAvg: 0,
    latencyP50: 0,
    latencyP75: 0,
    latencyP99: 0,
    latencyP999: 0,
    errors: 0,
    totalRequests: 0,
  };
}

async function runOha(
  url: string,
  duration: number,
  connections: number,
  endpoint: EndpointConfig = { path: "" }
): Promise<ToolResult> {
  const cmd: string[] = [
    "oha",
    "-z",
    `${duration}s`,
    "-c",
    String(connections),
    "--no-tui",
    "--output-format",
    "json",
  ];

  if (endpoint.method === "POST") {
    cmd.push("-m", "POST");
    if (endpoint.body) cmd.push("-d", endpoint.body);
    if (endpoint.contentType) cmd.push("-H", `Content-Type: ${endpoint.contentType}`);
  }

  cmd.push(url);

  const proc = spawn({ cmd, stdout: "pipe", stderr: "pipe" });
  const output = await new Response(proc.stdout).text();
  await proc.exited;

  try {
    const data = JSON.parse(output) as OhaOutput;
    let errorCount = 0;
    if (data.errorDistribution) {
      for (const count of Object.values(data.errorDistribution)) errorCount += count;
    }

    let totalRequests = 0;
    if (data.statusCodeDistribution) {
      for (const count of Object.values(data.statusCodeDistribution)) totalRequests += count;
    }

    return {
      rps: data.summary?.requestsPerSec || 0,
      latencyAvg: (data.summary?.average || 0) * 1000,
      latencyP50: (data.latencyPercentiles?.p50 || 0) * 1000,
      latencyP75: (data.latencyPercentiles?.p75 || 0) * 1000,
      latencyP99: (data.latencyPercentiles?.p99 || 0) * 1000,
      latencyP999: (data.latencyPercentiles?.p999 || 0) * 1000,
      errors: errorCount,
      totalRequests: totalRequests + errorCount,
    };
  } catch {
    throw new Error("Failed to parse oha output");
  }
}

async function runWrk(
  url: string,
  duration: number,
  connections: number,
  endpoint: EndpointConfig = { path: "" },
  log: (message: string) => void = console.log
): Promise<ToolResult> {
  if (endpoint.method === "POST") {
    log("    wrk does not support POST cleanly here; skipping POST endpoint");
    return emptyToolResult();
  }

  const proc = spawn({
    cmd: ["wrk", "-t", "4", "-c", String(connections), "-d", `${duration}s`, "--latency", url],
    stdout: "pipe",
    stderr: "pipe",
  });

  const output = await new Response(proc.stdout).text();
  await proc.exited;

  const rpsMatch = output.match(/Requests\/sec:\s+([\d.]+)/);
  const latencyMatch = output.match(/Latency\s+([\d.]+)(us|ms|s)/);
  const p50Match = output.match(/50%\s+([\d.]+)(us|ms|s)/);
  const p75Match = output.match(/75%\s+([\d.]+)(us|ms|s)/);
  const p99Match = output.match(/99%\s+([\d.]+)(us|ms|s)/);
  const requestsMatch = output.match(/(\d+) requests in/);
  const errorsMatch = output.match(/Socket errors:.*read (\d+)/);

  const parseLatency = (value: string, unit: string): number => {
    const v = parseFloat(value);
    if (unit === "us") return v / 1000;
    if (unit === "s") return v * 1000;
    return v;
  };

  const latencyP99 = p99Match ? parseLatency(p99Match[1]!, p99Match[2]!) : 0;

  return {
    rps: rpsMatch ? parseFloat(rpsMatch[1]!) : 0,
    latencyAvg: latencyMatch ? parseLatency(latencyMatch[1]!, latencyMatch[2]!) : 0,
    latencyP50: p50Match ? parseLatency(p50Match[1]!, p50Match[2]!) : 0,
    latencyP75: p75Match ? parseLatency(p75Match[1]!, p75Match[2]!) : 0,
    latencyP99,
    latencyP999: latencyP99,
    errors: errorsMatch ? parseInt(errorsMatch[1]!, 10) : 0,
    totalRequests: requestsMatch ? parseInt(requestsMatch[1]!, 10) : 0,
  };
}

async function runBombardier(
  url: string,
  duration: number,
  connections: number,
  endpoint: EndpointConfig = { path: "" }
): Promise<ToolResult> {
  const cmd = [
    "bombardier",
    "-c",
    String(connections),
    "-d",
    `${duration}s`,
    "-p",
    "r",
    "-o",
    "json",
  ];

  if (endpoint.method === "POST") {
    cmd.push("-m", "POST");
    if (endpoint.body) cmd.push("-b", endpoint.body);
    if (endpoint.contentType) cmd.push("-H", `Content-Type: ${endpoint.contentType}`);
  }

  cmd.push(url);

  const proc = spawn({ cmd, stdout: "pipe", stderr: "pipe" });
  const output = await new Response(proc.stdout).text();
  await proc.exited;

  try {
    const data = JSON.parse(output) as BombardierOutput;
    const latency = data.result?.latency;
    const percentiles = latency?.percentiles;
    return {
      rps: data.result?.rps?.mean || 0,
      latencyAvg: (latency?.mean || 0) / 1e6,
      latencyP50: (percentiles?.["50"] || 0) / 1e6,
      latencyP75: (percentiles?.["75"] || 0) / 1e6,
      latencyP99: (percentiles?.["99"] || 0) / 1e6,
      latencyP999: (percentiles?.["99.9"] || percentiles?.["99"] || 0) / 1e6,
      errors: data.result?.errors || 0,
      totalRequests:
        (data.result?.req1xx || 0) +
        (data.result?.req2xx || 0) +
        (data.result?.req3xx || 0) +
        (data.result?.req4xx || 0) +
        (data.result?.req5xx || 0),
    };
  } catch {
    throw new Error("Failed to parse bombardier output");
  }
}

async function runInternalBenchmark(
  url: string,
  duration: number,
  connections: number,
  endpoint: EndpointConfig = { path: "" }
): Promise<ToolResult> {
  const endTime = Date.now() + duration * 1000;
  const latencies: number[] = [];
  let errors = 0;
  let completed = 0;
  const workers: Promise<void>[] = [];

  for (let i = 0; i < connections; i++) {
    workers.push(
      (async () => {
        while (Date.now() < endTime) {
          const start = performance.now();
          try {
            const res = await fetch(url, {
              method: endpoint.method || "GET",
              body: endpoint.body,
              headers: endpoint.contentType ? { "content-type": endpoint.contentType } : undefined,
            });
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

  latencies.sort((a, b) => a - b);
  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p75 = latencies[Math.floor(latencies.length * 0.75)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
  const p999 = latencies[Math.floor(latencies.length * 0.999)] || 0;

  return {
    rps: completed / duration,
    latencyAvg: avg,
    latencyP50: p50,
    latencyP75: p75,
    latencyP99: p99,
    latencyP999: p999,
    errors,
    totalRequests: completed,
  };
}

async function runBenchmarkWithTool(
  tool: BenchmarkTool,
  url: string,
  duration: number,
  connections: number,
  endpoint: EndpointConfig,
  log: (message: string) => void = console.log
): Promise<ToolResult> {
  switch (tool) {
    case "oha":
      return runOha(url, duration, connections, endpoint);
    case "wrk":
      return runWrk(url, duration, connections, endpoint, log);
    case "bombardier":
      return runBombardier(url, duration, connections, endpoint);
    case "internal":
      return runInternalBenchmark(url, duration, connections, endpoint);
  }
}

interface RunStatistics {
  samples: number[];
  mean: number;
  median: number;
  min: number;
  max: number;
  stdDev: number;
  cv: number;
  isReliable: boolean;
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

  return { samples, mean, median, min, max, stdDev, cv, isReliable: cv < 10 };
}

async function startServer(framework: FrameworkConfig): Promise<Subprocess> {
  const serverPath = join(SERVERS_DIR, framework.serverFile);
  if (!existsSync(serverPath)) throw new Error(`Server file not found: ${serverPath}`);

  const cmd = framework.runtime === "bun" ? ["bun", "run", serverPath] : ["node", serverPath];
  const proc = spawn({
    cmd,
    env: { ...process.env, PORT: String(framework.port) },
    stdout: "pipe",
    stderr: "pipe",
  });

  const maxWait = 15000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    try {
      const res = await fetch(`http://localhost:${framework.port}/json`);
      if (res.ok) {
        for (let i = 0; i < 100; i++) await fetch(`http://localhost:${framework.port}/json`);
        return proc;
      }
    } catch {
      // Server is still warming up.
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
    // Process may already be dead.
  }
}

interface EndpointResult {
  rps: RunStatistics;
  latencyAvg: RunStatistics;
  latencyP50: RunStatistics;
  latencyP75: RunStatistics;
  latencyP99: RunStatistics;
  latencyP999: RunStatistics;
  errors: number;
  totalRequests: number;
}

interface ConcurrencyPoint {
  connections: number;
  rps: number;
  latencyP99: number;
}

interface FrameworkResults {
  name: string;
  displayName: string;
  runtime: "bun" | "node";
  endpoints: Record<string, EndpointResult>;
  timestamp: string;
  concurrencyLadder?: ConcurrencyPoint[];
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

async function runConcurrencyLadder(
  framework: FrameworkConfig,
  tool: BenchmarkTool,
  levels: number[],
  log: (message: string) => void,
  write: (message: string) => void
): Promise<ConcurrencyPoint[]> {
  const endpoint: EndpointConfig = { path: "/json" };
  const url = `http://localhost:${framework.port}/json`;
  const results: ConcurrencyPoint[] = [];

  for (const c of levels) {
    write(`    c=${c}... `);
    const result = await runBenchmarkWithTool(tool, url, 10, c, endpoint, log);
    results.push({ connections: c, rps: result.rps, latencyP99: result.latencyP99 });
    log(`${Math.round(result.rps).toLocaleString()} req/s  p99=${result.latencyP99.toFixed(1)}ms`);
  }

  return results;
}

function resultFor(fw: FrameworkResults | undefined, label: string): EndpointResult | undefined {
  return fw?.endpoints[label];
}

function formatRps(value: number | undefined): string {
  return Math.round(value || 0).toLocaleString();
}

function generateFairReport(run: FairBenchmarkRun): string {
  const { bunResults, nodeResults, timestamp, config, tool, environment } = run;
  const sortedBun = [...bunResults].sort((a, b) => (b.endpoints["/json"]?.rps.mean || 0) - (a.endpoints["/json"]?.rps.mean || 0));
  const sortedNode = [...nodeResults].sort((a, b) => (b.endpoints["/json"]?.rps.mean || 0) - (a.endpoints["/json"]?.rps.mean || 0));
  const bunway = sortedBun.find((fw) => fw.name === "bunway");
  const hono = sortedBun.find((fw) => fw.name === "hono");
  const express = sortedNode.find((fw) => fw.name === "express");
  const fastify = sortedNode.find((fw) => fw.name === "fastify");
  const bunwayJson = bunway?.endpoints["/json"]?.rps.mean || 0;
  const honoJson = hono?.endpoints["/json"]?.rps.mean || 0;
  const expressJson = express?.endpoints["/json"]?.rps.mean || 0;
  const honoRatio = honoJson > 0 ? ((bunwayJson / honoJson) * 100).toFixed(1) : "n/a";
  const expressRatio = expressJson > 0 ? (bunwayJson / expressJson).toFixed(1) : "n/a";

  let md = `# bunWay Performance Report - ${new Date(timestamp).toLocaleString()}

## Executive Summary
bunWay achieves **${formatRps(bunwayJson)} req/s** on JSON - **${honoRatio}% of Hono** and **${expressRatio}x Express**.

## TechEmpower-Style Results (Bun runtime, c=${config.connections}, ${config.duration}s x ${config.runs} runs)

| Endpoint | bunWay | Hono | Elysia | bunWay/Hono |
|----------|--------|------|--------|-------------|
`;

  for (const endpoint of config.endpoints) {
    const label = endpointLabel(endpoint);
    const bunwayRps = resultFor(bunway, label)?.rps.mean || 0;
    const honoRps = resultFor(hono, label)?.rps.mean || 0;
    const elysiaRps = resultFor(sortedBun.find((fw) => fw.name === "elysia"), label)?.rps.mean || 0;
    const ratio = honoRps > 0 ? `${((bunwayRps / honoRps) * 100).toFixed(1)}%` : "n/a";
    md += `| ${label} | ${formatRps(bunwayRps)} | ${formatRps(honoRps)} | ${formatRps(elysiaRps)} | ${ratio} |\n`;
  }

  md += `
## Bun Framework Ranking

| Rank | Framework | ${config.endpoints.map(endpointLabel).join(" | ")} | bunWay/Hono |
|------|-----------|${config.endpoints.map(() => "--------").join("|")}|-------------|
`;

  for (const [index, fw] of sortedBun.entries()) {
    const values = config.endpoints.map((endpoint) => formatRps(fw.endpoints[endpointLabel(endpoint)]?.rps.mean));
    const ratio = honoJson > 0 ? `${(((fw.endpoints["/json"]?.rps.mean || 0) / honoJson) * 100).toFixed(1)}%` : "n/a";
    md += `| ${index + 1} | ${fw.displayName} | ${values.join(" | ")} | ${ratio} |\n`;
  }

  md += `
## Latency Percentiles - /json, c=${config.connections}

| Framework | p50 | p75 | p99 | p999 |
|-----------|-----|-----|-----|------|
`;

  for (const fw of sortedBun) {
    const ep = fw.endpoints["/json"];
    if (!ep) continue;
    md += `| ${fw.displayName} | ${ep.latencyP50.mean.toFixed(2)}ms | ${ep.latencyP75.mean.toFixed(2)}ms | ${ep.latencyP99.mean.toFixed(2)}ms | ${ep.latencyP999.mean.toFixed(2)}ms |\n`;
  }

  md += `
## Concurrency Saturation - bunWay /json

| Connections | RPS | p99 |
|-------------|-----|-----|
`;

  for (const point of bunway?.concurrencyLadder || []) {
    md += `| c=${point.connections} | ${formatRps(point.rps)} | ${point.latencyP99.toFixed(2)}ms |\n`;
  }

  md += `
## Node.js Frameworks (Node.js ${environment.nodeVersion}, c=${config.connections}, ${config.duration}s x ${config.runs} runs)

| Endpoint | Express | Fastify | bunWay/Fastify |
|----------|---------|---------|----------------|
`;

  for (const endpoint of config.endpoints) {
    const label = endpointLabel(endpoint);
    const expressRps = resultFor(express, label)?.rps.mean || 0;
    const fastifyRps = resultFor(fastify, label)?.rps.mean || 0;
    const bunwayRps = resultFor(bunway, label)?.rps.mean || 0;
    const ratio = fastifyRps > 0 ? `${((bunwayRps / fastifyRps) * 100).toFixed(1)}%` : "n/a";
    md += `| ${label} | ${formatRps(expressRps)} | ${formatRps(fastifyRps)} | ${ratio} |\n`;
  }

  md += `
## Detailed Statistics

`;

  for (const fw of [...sortedBun, ...sortedNode]) {
    md += `### ${fw.displayName} (${fw.runtime === "bun" ? "Bun" : "Node.js"})\n\n`;
    md += `| Endpoint | Mean RPS | Median | Min | Max | StdDev | CV% | Reliable | Errors |\n`;
    md += `|----------|----------|--------|-----|-----|--------|-----|----------|--------|\n`;
    for (const [label, result] of Object.entries(fw.endpoints)) {
      md += `| ${label} | ${formatRps(result.rps.mean)} | ${formatRps(result.rps.median)} | ${formatRps(result.rps.min)} | ${formatRps(result.rps.max)} | ${formatRps(result.rps.stdDev)} | ${result.rps.cv.toFixed(1)}% | ${result.rps.isReliable ? "yes" : "no"} | ${result.errors} |\n`;
    }
    md += "\n";
  }

  md += `## Run Metadata

- Tool: ${tool}
- OS: ${environment.os} (${environment.arch})
- Bun: ${environment.bunVersion}
- Node: ${environment.nodeVersion}
`;

  return md;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--install") || args.includes("-i")) {
    printInstallInstructions();
    return;
  }

  const isQuick = args.includes("--quick") || args.includes("-q");
  const isCiOutput = args.includes("--ci-output");
  const isBaseline = args.includes("--baseline");
  const checkRegress = args.includes("--check-regression");
  const threshold = parseFloat(args.find((a) => a.startsWith("--threshold="))?.split("=")[1] ?? "5");
  const forceTool = args.find((a) => a.startsWith("--tool="))?.split("=")[1] as BenchmarkTool | undefined;
  const config = isQuick ? QUICK_CONFIG : FULL_CONFIG;
  const log = (message: string): void => {
    if (!isCiOutput) console.log(message);
  };
  const write = (message: string): void => {
    if (!isCiOutput) process.stdout.write(message);
  };

  let tool: BenchmarkTool;
  if (forceTool) {
    if (forceTool === "internal") {
      tool = forceTool;
    } else if (await checkToolAvailable(forceTool)) {
      tool = forceTool;
    } else {
      console.error(`Error: Tool '${forceTool}' is not installed.`);
      printInstallInstructions();
      process.exit(1);
    }
  } else {
    tool = await detectBestTool();
  }

  log("\nbunWay Fair Benchmark Suite (TechEmpower-style)\n");
  log(`Mode:        ${isQuick ? "Quick" : "Full"}`);
  log(`Tool:        ${tool}${tool === "internal" ? " (install oha/wrk for better accuracy)" : ""}`);
  log(`Duration:    ${config.duration}s per endpoint`);
  log(`Warmup:      ${config.warmupDuration}s (discarded)`);
  log(`Runs:        ${config.runs} independent runs`);
  log(`Connections: ${config.connections}`);
  log(`Endpoints:   ${config.endpoints.map(endpointLabel).join(", ")}`);

  if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true });

  const bunResults: FrameworkResults[] = [];
  const nodeResults: FrameworkResults[] = [];
  const timestamp = new Date().toISOString();

  for (const framework of FRAMEWORKS) {
    log(`\n${framework.displayName} (${framework.runtime === "bun" ? "Bun" : "Node.js"})`);
    let proc: Subprocess | null = null;

    try {
      log(`  Starting server on port ${framework.port}...`);
      proc = await startServer(framework);
      log("  Server ready\n");

      const endpointResults: Record<string, EndpointResult> = {};

      for (const endpoint of config.endpoints) {
        const label = endpointLabel(endpoint);
        const url = `http://localhost:${framework.port}${endpoint.path}`;
        log(`  Benchmarking ${label}:`);

        write(`    Warmup (${config.warmupDuration}s)... `);
        await runBenchmarkWithTool(tool, url, config.warmupDuration, config.connections, endpoint, log);
        log("done");

        const rpsSamples: number[] = [];
        const latencyAvgSamples: number[] = [];
        const latencyP50Samples: number[] = [];
        const latencyP75Samples: number[] = [];
        const latencyP99Samples: number[] = [];
        const latencyP999Samples: number[] = [];
        let totalErrors = 0;
        let totalRequests = 0;

        for (let i = 1; i <= config.runs; i++) {
          write(`    Run ${i}/${config.runs} (${config.duration}s)... `);
          const result = await runBenchmarkWithTool(tool, url, config.duration, config.connections, endpoint, log);

          rpsSamples.push(result.rps);
          latencyAvgSamples.push(result.latencyAvg);
          latencyP50Samples.push(result.latencyP50);
          latencyP75Samples.push(result.latencyP75);
          latencyP99Samples.push(result.latencyP99);
          latencyP999Samples.push(result.latencyP999);
          totalErrors += result.errors;
          totalRequests += result.totalRequests;

          log(`${Math.round(result.rps).toLocaleString()} req/s`);
          await new Promise((r) => setTimeout(r, 1000));
        }

        const rpsStats = calculateStatistics(rpsSamples);
        log(`    Mean: ${Math.round(rpsStats.mean).toLocaleString()} req/s (CV: ${rpsStats.cv.toFixed(1)}%)\n`);

        endpointResults[label] = {
          rps: rpsStats,
          latencyAvg: calculateStatistics(latencyAvgSamples),
          latencyP50: calculateStatistics(latencyP50Samples),
          latencyP75: calculateStatistics(latencyP75Samples),
          latencyP99: calculateStatistics(latencyP99Samples),
          latencyP999: calculateStatistics(latencyP999Samples),
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

      if (!isQuick && config.concurrencyLadder && framework.runtime === "bun") {
        log("\n  Concurrency ladder for /json:");
        frameworkResult.concurrencyLadder = await runConcurrencyLadder(framework, tool, config.concurrencyLadder, log, write);
      }

      if (framework.runtime === "bun") bunResults.push(frameworkResult);
      else nodeResults.push(frameworkResult);
    } catch (error) {
      console.error(`  Error testing ${framework.name}:`, error);
    } finally {
      if (proc) {
        stopServer(proc);
        log("  Server stopped");
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

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

  if (isCiOutput) {
    process.stdout.write(JSON.stringify(run) + "\n");
    process.exit(0);
  }

  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const timeStr = new Date().toISOString().slice(11, 19).replace(/:/g, "");
  const jsonFile = join(RESULTS_DIR, `fair_comparison_${dateStr}_${timeStr}.json`);
  writeFileSync(jsonFile, JSON.stringify(run, null, 2));
  log(`\nResults saved to: ${jsonFile}`);

  const mdReport = generateFairReport(run);
  const mdFile = join(RESULTS_DIR, "FAIR_COMPARISON.md");
  writeFileSync(mdFile, mdReport);
  log(`Report saved to: ${mdFile}`);

  if (isBaseline) {
    const baselines: Record<string, Record<string, number>> = {};
    for (const fw of [...bunResults, ...nodeResults]) {
      baselines[fw.name] = {};
      for (const [label, result] of Object.entries(fw.endpoints)) {
        baselines[fw.name]![label] = result.rps.mean;
      }
    }
    const baselinesFile = join(RESULTS_DIR, "baselines.json");
    writeFileSync(baselinesFile, JSON.stringify({ version: 1, timestamp, tool, results: baselines }, null, 2));
    log(`Baselines saved -> ${baselinesFile}`);
  }

  if (checkRegress) {
    const baselinesFile = join(RESULTS_DIR, "baselines.json");
    if (!existsSync(baselinesFile)) {
      console.error("ERROR: No baselines.json found. Run with --baseline first.");
      process.exit(1);
    }

    const baselines = JSON.parse(readFileSync(baselinesFile, "utf8")) as {
      results: Record<string, Record<string, number>>;
    };
    let failed = false;

    for (const fw of [...bunResults, ...nodeResults]) {
      const base = baselines.results[fw.name];
      if (!base) continue;
      for (const [label, result] of Object.entries(fw.endpoints)) {
        const baseRps = base[label];
        if (baseRps == null) continue;
        const ratio = (result.rps.mean / baseRps) * 100;
        if (ratio < 100 - threshold) {
          console.error(
            `REGRESSION: ${fw.name} ${label}: ${Math.round(result.rps.mean)} req/s ` +
              `vs baseline ${Math.round(baseRps)} (${ratio.toFixed(1)}% - below ${(100 - threshold).toFixed(0)}% threshold)`
          );
          failed = true;
        }
      }
    }

    if (failed) process.exit(1);
    log(`All endpoints within ${threshold}% of baselines - OK`);
  }

  log("\nFAIR BENCHMARK COMPLETE\n");

  const sortedBun = [...bunResults].sort((a, b) => (b.endpoints["/json"]?.rps.mean || 0) - (a.endpoints["/json"]?.rps.mean || 0));
  for (const fw of sortedBun) {
    const rps = fw.endpoints["/json"]?.rps.mean || 0;
    const cv = fw.endpoints["/json"]?.rps.cv || 0;
    log(`  ${fw.displayName.padEnd(10)} ${Math.round(rps).toLocaleString().padStart(10)} req/s (CV: ${cv.toFixed(1)}%)`);
  }

  const bunway = bunResults.find((fw) => fw.name === "bunway");
  const hono = bunResults.find((fw) => fw.name === "hono");
  const bunwayRps = bunway?.endpoints["/json"]?.rps.mean || 0;
  const honoRps = hono?.endpoints["/json"]?.rps.mean || 0;
  if (bunwayRps > 0 && honoRps > 0) {
    log(`\nbunWay/Hono: ${((bunwayRps / honoRps) * 100).toFixed(1)}%`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
