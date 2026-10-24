// Compares final ball positions between stepping models (legacy60 vs legacy144,
// fixed vs legacy60) for each corpus shot; writes results/compare.json.
import { writeFileSync } from 'node:fs';
import { installEnv } from './src/env.js';
installEnv({ seed: 7 });
const { createWorld } = await import('./src/world.js');
const { runShot } = await import('./src/run-shot.js');
const { CORPUS } = await import('./src/corpus.js');
const now = () => performance.now();
const go = (shot, opts) => { installEnv({ seed: 7 }); return runShot(createWorld({}), shot, { ...opts, now }); };
const diff = (a, b) => {
  let max = 0, sumsq = 0, n = 0;
  for (let i = 0; i < a.final.length; i++) {
    if (a.final[i].pocketed || b.final[i].pocketed) continue;
    const d = Math.hypot(a.final[i].x - b.final[i].x, a.final[i].z - b.final[i].z);
    max = Math.max(max, d); sumsq += d * d; n++;
  }
  const pa = [...a.pocketed].sort((x, y) => x - y).join(','), pb = [...b.pocketed].sort((x, y) => x - y).join(',');
  return { maxCm: +max.toFixed(2), rmsCm: +Math.sqrt(sumsq / Math.max(n, 1)).toFixed(2), samePocketed: pa === pb, pocketedA: pa || '-', pocketedB: pb || '-' };
};
const rows = [];
for (const { name, shot } of CORPUS) {
  const f = go(shot, { model: 'fixed' }), l60 = go(shot, { model: 'legacy', fps: 60 }), l144 = go(shot, { model: 'legacy', fps: 144 });
  rows.push({ name, pair: 'legacy60×legacy144', ...diff(l60, l144) });
  rows.push({ name, pair: 'fixed×legacy60', ...diff(f, l60) });
}
writeFileSync(new URL('./results/compare.json', import.meta.url), JSON.stringify(rows, null, 2) + '\n');
console.table(rows);
