// Runs the bundled benchmark on Node and writes results/node.json. The bundle
// runs in the main context: a vm.createContext sandbox slows global lookups
// (Math, ...) about 5x and would distort the timings.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import vm from 'node:vm';

vm.runInThisContext(readFileSync(new URL('./dist/sim-bench.iife.js', import.meta.url), 'utf8'));

const payload = {
  runs: 20,
  warmup: 3,
  seed: 7,
  models: ['fixed', 'legacy60', 'legacy144'],
  runtime: `node ${process.versions.node}`,
};
const report = JSON.parse(JSON.stringify(globalThis.SimBench.run(payload, () => performance.now())));
report.cpu = `${os.cpus()[0]?.model} x${os.cpus().length}`;

mkdirSync(new URL('./results/', import.meta.url), { recursive: true });
writeFileSync(new URL('./results/node.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.table(report.results);
