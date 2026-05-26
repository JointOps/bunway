import { generateSessionId, generateToken, sign, unsign } from "../../src/utils/crypto";

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

group("crypto operations", () => {
  const secret = "test-secret-key";
  const value = "session-id-abc123def456";
  const signed = sign(value, secret);

  bench("sign", () => sign(value, secret));
  bench("unsign (valid)", () => unsign(signed, [secret]));
  bench("generateSessionId", () => generateSessionId());
  bench("generateToken(32)", () => generateToken(32));
});

run();
