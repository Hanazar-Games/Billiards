// Bundles the benchmark into one IIFE script (global SimBench) and a Nakama
// JS runtime module (the same script plus global InitModule/RPC functions).
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const banner = `var __SIM_BENCH_SHIMS__ = [];
if (typeof globalThis === 'undefined') { this.globalThis = this; __SIM_BENCH_SHIMS__.push('globalThis'); }
if (typeof console === 'undefined') { globalThis.console = { log() {}, info() {}, warn() {}, error() {}, debug() {} }; __SIM_BENCH_SHIMS__.push('console'); }
if (typeof performance === 'undefined') { globalThis.performance = { now: function () { return Date.now(); } }; __SIM_BENCH_SHIMS__.push('performance'); }`;

const nakamaGlue = `
function InitModule(ctx, logger, nk, initializer) {
  initializer.registerRpc('sim_bench', rpcSimBench);
}
function rpcSimBench(ctx, logger, nk, payload) {
  return JSON.stringify(SimBench.run(JSON.parse(payload), function () { return Date.now(); }));
}
`;

await build({
  entryPoints: ['src/bench.js'],
  bundle: true,
  format: 'iife',
  globalName: 'SimBench',
  platform: 'neutral',
  target: 'es2017',
  mainFields: ['module', 'main'],
  banner: { js: banner },
  outfile: 'dist/sim-bench.iife.js',
  logLevel: 'warning',
});

mkdirSync('dist/nakama', { recursive: true });
writeFileSync('dist/nakama/index.js', readFileSync('dist/sim-bench.iife.js', 'utf8') + nakamaGlue);
