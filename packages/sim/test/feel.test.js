// D033/D038: the sim's feel stays inside the legacy envelope (14 frame rates).
// D041: long-stun, pot-corner and pot-side changed on purpose with the draw
// calibration; their reference is the calibrated sim, with the same margins.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulateShot } from '../src/index.js';
import { CORPUS } from './corpus.js';
import { computeMetrics, withinEnvelope } from './feel/metrics.js';
import { feelReference, SIM_REFERENCE_SHOTS } from './feel/reference.js';

test('D041: só long-stun, pot-corner e pot-side usam o sim calibrado como referência', () => {
  assert.deepEqual([...SIM_REFERENCE_SHOTS].sort(), ['long-stun', 'pot-corner', 'pot-side']);
  const sources = CORPUS.filter(c => c.kind !== 'calibration').map(c => [c.name, feelReference(c.name).source]);
  assert.deepEqual(sources.filter(([, s]) => s === 'D041').map(([n]) => n).sort(), ['long-stun', 'pot-corner', 'pot-side']);
  assert.equal(sources.filter(([, s]) => s === 'legado').length, 8);
});

for (const c of CORPUS.filter(c => c.kind !== 'calibration')) {
  const { source, byFps: ref } = feelReference(c.name);
  test(`sensação dentro do envelope ${source === 'D041' ? 'aceito na D041' : 'do legado'}: ${c.name}`, () => {
    const r = simulateShot(c.table, c.shot);
    const m = computeMetrics(c.kind, [c.table, ...r.frames], r.final);
    assert.deepEqual(Object.keys(m).sort(), Object.keys(ref['60']).sort());
    for (const [key, value] of Object.entries(m)) {
      assert.ok(withinEnvelope(value, Object.fromEntries(Object.entries(ref).map(([fps, mm]) => [fps, mm[key]])), key, ref['60']),
        `${c.name}.${key} = ${JSON.stringify(value)} fora de ${JSON.stringify(ref)}`);
    }
  });
}
