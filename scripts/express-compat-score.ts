#!/usr/bin/env bun

const proc = Bun.spawn(["bun", "test", "tests/express-compat/"], {
  stdout: "pipe",
  stderr: "pipe",
});

const stdoutText = await new Response(proc.stdout).text();
const stderrText = await new Response(proc.stderr).text();
const output = stdoutText + stderrText;
await proc.exited;

const passMatch = output.match(/(\d+)\s+pass/);
const failMatch = output.match(/(\d+)\s+fail/);

const passed = passMatch ? parseInt(passMatch[1], 10) : 0;
const failed = failMatch ? parseInt(failMatch[1], 10) : 0;
const total = passed + failed;

const score = total > 0 ? Math.round((passed / total) * 100) : 0;

console.log(`\n📊 Express Compatibility Score: ${score}%`);
console.log(`   ✅ ${passed} passing`);
if (failed > 0) {
  console.log(`   ❌ ${failed} failing`);
}
console.log(`   📝 ${total} total tests\n`);

if (score === 100) {
  console.log("🎉 Perfect Express compatibility!\n");
} else if (score >= 95) {
  console.log("✨ Excellent Express compatibility!\n");
} else if (score >= 90) {
  console.log("👍 Very good Express compatibility!\n");
} else if (score >= 75) {
  console.log("📈 Good Express compatibility, but room for improvement.\n");
} else {
  console.log("⚠️  Significant compatibility gaps detected.\n");
}

process.exit(proc.exitCode || 0);
