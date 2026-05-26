import { getPathname } from "../../src/utils/url";

type BenchCase = { name: string; fn: () => string };
const cases: BenchCase[] = [];

function group(name: string, fn: () => void): void {
  console.log(name);
  fn();
}

function bench(name: string, fn: () => string): void {
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

group("getPathname", () => {
  bench("simple /users", () => getPathname("http://localhost:3000/users"));
  bench("with query /users?page=1", () => getPathname("http://localhost:3000/users?page=1"));
  bench("vs new URL().pathname", () => new URL("http://localhost:3000/users?page=1").pathname);
});

run();
