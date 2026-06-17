import { BunRequest } from "../../src/core/request";

type BenchCase = { name: string; fn: () => unknown };
const cases: BenchCase[] = [];

function group(name: string, fn: () => void): void {
  console.log(name);
  fn();
}

function bench(name: string, fn: () => unknown): void {
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

const rawReq = new Request("http://localhost:3000/users/42?page=1&limit=10", {
  headers: {
    "content-type": "application/json",
    accept: "application/json",
    cookie: "session=abc; user=xyz",
  },
});

group("BunRequest - construction", () => {
  bench("new BunRequest(req)", () => new BunRequest(rawReq));
  bench("new BunRequest(req, pathname)", () => new BunRequest(rawReq, "/users/42"));
});

group("BunRequest - property access", () => {
  const req = new BunRequest(rawReq, "/users/42");
  bench("method", () => req.method);
  bench("pathname", () => req.pathname);
  bench("query", () => req.query);
  bench("cookies", () => req.cookies);
  bench("ip", () => req.ip);
  bench("get header", () => req.get("content-type"));
});

run();
