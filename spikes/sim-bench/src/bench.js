// Benchmark entry point; bundled as the global SimBench for Node and goja.
import './default-env.js';
import { installEnv, SHIMS_USED } from './env.js';
import { createWorld } from './world.js';
import { runShot } from './run-shot.js';
import { CORPUS } from './corpus.js';

const MODELS = {
  fixed: { model: 'fixed' },
  legacy60: { model: 'legacy', fps: 60 },
  legacy144: { model: 'legacy', fps: 144 },
};

export function run({ runs, warmup, seed, models, runtime = 'unknown' }, now) {
  const results = [];
  for (const { name, shot } of CORPUS) {
    for (const key of models) {
      const times = [];
      let last;
      for (let i = 0; i < warmup + runs; i++) {
        installEnv({ seed });
        last = runShot(createWorld({}), shot, { ...MODELS[key], now });
        if (i >= warmup) times.push(last.wallMs);
      }
      results.push({
        name,
        model: key,
        medianMs: percentile(times, 50),
        p95Ms: percentile(times, 95),
        steps: last.steps,
        simSeconds: last.simSeconds,
        capped: last.capped,
        hash: last.hash,
      });
    }
  }
  const bannerShims = globalThis.__SIM_BENCH_SHIMS__ || [];
  return { runtime, shimsUsed: [...bannerShims, ...SHIMS_USED], results };
}

// Nearest-rank percentile.
function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)];
}
