import { FastMatcher } from "../../src/core/fast-matcher";
import type { Handler } from "../../src";

type BenchCase = { name: string; fn: () => void };
const cases: BenchCase[] = [];

function group(name: string, fn: () => void): void {
  console.log(name);
  fn();
}

function bench(name: string, fn: () => void): void {
  cases.push({ name, fn });
}

function run(): void {
  for (const c of cases) {
    const end = performance.now() + 500;
    let iterations = 0;
    while (performance.now() < end) {
      c.fn();
      iterations++;
    }
    console.log(`  ${c.name}: ${Math.round(iterations * 2).toLocaleString()} ops/sec`);
  }
}

const noop: Handler = (_req, _res, next) => {
  next();
};

group("static routes - 100 registered", () => {
  const m = new FastMatcher();
  for (let i = 0; i < 100; i++) m.add("GET", `/r${i}`, [noop]);

  bench("match first", () => m.match("GET", "/r0"));
  bench("match middle", () => m.match("GET", "/r49"));
  bench("match last", () => m.match("GET", "/r99"));
  bench("miss", () => m.match("GET", "/notfound"));
});

group("dynamic routes - 100 registered", () => {
  const m = new FastMatcher();
  for (let i = 0; i < 100; i++) m.add("GET", `/r${i}/:id`, [noop]);

  bench("match first", () => m.match("GET", "/r0/abc"));
  bench("match middle", () => m.match("GET", "/r49/abc"));
  bench("match last", () => m.match("GET", "/r99/abc"));
});

group("route registration", () => {
  bench("add 1 static", () => {
    const m = new FastMatcher();
    m.add("GET", "/test", [noop]);
  });

  bench("add 100 mixed", () => {
    const m = new FastMatcher();
    for (let i = 0; i < 50; i++) m.add("GET", `/s${i}`, [noop]);
    for (let i = 0; i < 50; i++) m.add("GET", `/d${i}/:id`, [noop]);
  });
});

run();
