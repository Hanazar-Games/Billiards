import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';

test('bundle IIFE produz os mesmos hashes do código ESM', async () => {
  execFileSync('node', ['build.mjs'], { cwd: new URL('..', import.meta.url) });
  const ctx = vm.createContext({});
  vm.runInContext(readFileSync(new URL('../dist/sim-bench.iife.js', import.meta.url), 'utf8'), ctx);
  const payload = { runs: 1, warmup: 0, seed: 7, models: ['fixed'] };
  const fromBundle = ctx.SimBench.run(payload, () => Date.now());
  const { run } = await import('../src/bench.js');
  const fromEsm = run(payload, () => performance.now());
  // Array.from copies the vm-realm array into this realm; deepStrictEqual compares prototypes.
  assert.deepEqual(Array.from(fromBundle.results, r => r.hash), fromEsm.results.map(r => r.hash));
});
