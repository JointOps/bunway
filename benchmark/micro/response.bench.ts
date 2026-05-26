import { BunResponse } from "../../src/core/response";

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

group("BunResponse - json", () => {
  bench("json() small", () => {
    const r = new BunResponse();
    r.json({ message: "Hello, World!" });
    r.toResponse();
  });

  bench("json() medium 1kb", () => {
    const r = new BunResponse();
    r.json({ data: "x".repeat(1000) });
    r.toResponse();
  });

  bench("json() large 10kb", () => {
    const r = new BunResponse();
    r.json({ data: "x".repeat(10000) });
    r.toResponse();
  });

  bench("text()", () => {
    const r = new BunResponse();
    r.text("Hello, World!");
    r.toResponse();
  });

  bench("status().json()", () => {
    const r = new BunResponse();
    r.status(201).json({ id: 42 });
    r.toResponse();
  });
});

group("BunResponse - header operations", () => {
  bench("set 1 header", () => {
    const r = new BunResponse();
    r.set("X-Custom", "value");
    r.toResponse();
  });

  bench("set 5 headers", () => {
    const r = new BunResponse();
    r.set("A", "1");
    r.set("B", "2");
    r.set("C", "3");
    r.set("D", "4");
    r.set("E", "5");
    r.toResponse();
  });
});

run();
