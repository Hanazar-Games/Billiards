// F1-08 (D034): the break in packages/sim against the spike's fixed-step model
// (spikes/sim-bench), alternating in one process with gc() before each shot.
// The spike times only its shot loop (its own wallMs); the sim is timed around
// the whole simulateShot call, world creation and frames included.
// Prints { spikeMedianMs, simMedianMs, ratio, simP95Ms }; exits 1 below 1.3×.
import { installEnv } from '../../../spikes/sim-bench/src/env.js';
import { simulateShot } from '../src/index.js';
import { CORPUS } from '../test/corpus.js';

const RUNS = 20;
const WARMUP = 3;
const MIN_RATIO = 1.3;
const SEED = 7;

if (typeof globalThis.gc !== 'function') throw new Error('run with node --expose-gc');
installEnv({ seed: SEED });
const { createWorld } = await import('../../../spikes/sim-bench/src/world.js');
const { runShot } = await import('../../../spikes/sim-bench/src/run-shot.js');
const { CORPUS: SPIKE_CORPUS } = await import('../../../spikes/sim-bench/src/corpus.js');

const spikeShot = SPIKE_CORPUS.find((c) => c.name === 'break').shot;
const brk = CORPUS.find((c) => c.name === 'break');
const now = () => performance.now();

const spikeMs = [];
const simMs = [];
for (let i = 0; i < WARMUP + RUNS; i++) {
  globalThis.gc();
  installEnv({ seed: SEED });
  const spike = runShot(createWorld({}), spikeShot, { model: 'fixed', now });
  globalThis.gc();
  const start = now();
  simulateShot(brk.table, brk.shot);
  const sim = now() - start;
  if (i >= WARMUP) {
    spikeMs.push(spike.wallMs);
    simMs.push(sim);
  }
}

const spikeMedianMs = percentile(spikeMs, 50);
const simMedianMs = percentile(simMs, 50);
const result = {
  spikeMedianMs: round(spikeMedianMs),
  simMedianMs: round(simMedianMs),
  ratio: round(spikeMedianMs / simMedianMs),
  simP95Ms: round(percentile(simMs, 95)),
};
console.log(JSON.stringify(result));
if (result.ratio < MIN_RATIO) {
  console.error(`ratio ${result.ratio} < ${MIN_RATIO}`);
  process.exitCode = 1;
}

/**
 * @param {number[]} values
 * @param {number} p
 */
function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

/** @param {number} v */
function round(v) {
  return Math.round(v * 100) / 100;
}
