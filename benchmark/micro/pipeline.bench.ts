type Next = (error?: unknown) => void;
type PipelineRequest = { locals: Record<string, number> };
type PipelineResponse = { _sent?: boolean };
type PipelineHandler = (req: PipelineRequest, res: PipelineResponse, next: Next) => void;
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

function runSyncPipeline(depth: number, syncMw: PipelineHandler, handler: PipelineHandler): void {
  const req: PipelineRequest = { locals: {} };
  const res: PipelineResponse = {};
  const pipeline: PipelineHandler[] = [];
  for (let i = 0; i < depth - 1; i++) pipeline.push(syncMw);
  pipeline.push(handler);

  let idx = 0;
  const next: Next = (error?: unknown) => {
    if (error !== undefined) throw error;
    const fn = pipeline[idx++];
    if (!fn || res._sent) return;
    fn(req, res, next);
  };

  next();
}

group("pipeline - sync handlers", () => {
  const syncMw: PipelineHandler = (_req, _res, next) => next();
  const handler: PipelineHandler = (_req, res) => {
    res._sent = true;
  };

  bench("1 handler", () => runSyncPipeline(1, syncMw, handler));
  bench("5 handlers", () => runSyncPipeline(5, syncMw, handler));
  bench("10 handlers", () => runSyncPipeline(10, syncMw, handler));
});

run();
