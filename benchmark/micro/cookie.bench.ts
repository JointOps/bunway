import { BunRequest } from "../../src/core/request";
import { cookieParser } from "../../src/middleware/cookie-parser";
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

const cookieHeader = "session=abc123; user=alice; theme=dark; flag=true; token=xyz";
const rawReq = new Request("http://localhost:3000/cookies", {
  headers: { cookie: cookieHeader },
});

group("cookies", () => {
  bench("BunRequest cookies", () => {
    const req = new BunRequest(rawReq, "/cookies");
    req.cookies;
  });

  bench("cookieParser middleware", () => {
    const req = new BunRequest(rawReq, "/cookies");
    const res = new BunResponse();
    cookieParser()(req, res, () => {});
  });
});

run();
