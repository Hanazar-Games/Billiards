// D033/D038: the sim's feel stays inside the legacy envelope (14 frame rates).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { simulateShot } from '../src/index.js';
import { CORPUS } from './corpus.js';
import { computeMetrics, withinEnvelope } from './feel/metrics.js';
const ref = JSON.parse(readFileSync(new URL('./feel/legacy-reference.json', import.meta.url), 'utf8'));

for (const c of CORPUS.filter(c => c.kind !== 'calibration')) {
  test(`sensação dentro do envelope do legado: ${c.name}`, () => {
    const r = simulateShot(c.table, c.shot);
    const m = computeMetrics(c.kind, [c.table, ...r.frames], r.final);
    assert.deepEqual(Object.keys(m).sort(), Object.keys(ref[c.name]['60']).sort());
    for (const [key, value] of Object.entries(m)) {
      assert.ok(withinEnvelope(value, Object.fromEntries(Object.entries(ref[c.name]).map(([fps, mm]) => [fps, mm[key]])), key, ref[c.name]['60']),
        `${c.name}.${key} = ${JSON.stringify(value)} fora de ${JSON.stringify(ref[c.name])}`);
    }
  });
}
