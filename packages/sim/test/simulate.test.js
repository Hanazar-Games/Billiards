// packages/sim/test/simulate.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulateShot, SHOT } from '../src/index.js';
import { CORPUS, rack8 } from './corpus.js';
const shot = (o = {}) => ({ angle: Math.PI / 2, power: 50, spin: { x: 0, y: 0 }, ...o });
const deepFreeze = o => { Object.values(o).forEach(v => typeof v === 'object' && v && deepFreeze(v)); return Object.freeze(o); };

test('não altera o estado de entrada', () => {
  const t = deepFreeze(rack8());
  assert.doesNotThrow(() => simulateShot(t, shot()));
});
test('números inválidos lançam RangeError', () => {
  for (const bad of [{ angle: NaN }, { power: Infinity }, { power: 0 }, { power: -5 }, { spin: { x: NaN, y: 0 } }]) {
    assert.throws(() => simulateShot(rack8(), shot(bad)), RangeError, JSON.stringify(bad));
  }
});
test('estado sem branca ativa ou com ids repetidos lança Error', () => {
  const t = rack8(); t.balls.find(b => b.id === 0).pocketed = true;
  assert.throws(() => simulateShot(t, shot()), /cue ball/);
  const d = rack8(); d.balls.push({ ...d.balls[1] });
  assert.throws(() => simulateShot(d, shot()), /duplicate ball id/);
});
test('bolas encaçapadas na entrada continuam encaçapadas e fora da física', () => {
  const t = rack8(); t.balls.find(b => b.id === 5).pocketed = true;
  const r = simulateShot(t, shot({ power: 110 }));
  assert.equal(r.final.balls.find(b => b.id === 5).pocketed, true);
  for (const b of r.final.balls) assert.ok(Number.isFinite(b.x) && Number.isFinite(b.z));
});
test('potência acima do máximo é limitada a SHOT.maxPower', () => {
  assert.deepEqual(simulateShot(rack8(), shot({ power: 500 })).final, simulateShot(rack8(), shot({ power: SHOT.maxPower })).final);
});
test('efeito com comprimento > 1 é normalizado', () => {
  const a = simulateShot(rack8(), shot({ spin: { x: 2, y: 0 } })).final;
  const b = simulateShot(rack8(), shot({ spin: { x: 1, y: 0 } })).final;
  assert.deepEqual(a, b);
});
test('limite de tempo simulado marca capped', () => {
  const r = simulateShot(rack8(), shot({ power: 110 }), { maxSimSeconds: 0.5 });
  assert.equal(r.capped, true); assert.equal(r.steps, 180); assert.equal(r.simSeconds, 0.5);
});
test('cueBall posiciona a branca antes da tacada', () => {
  const t = { tableProfileId: 'pool9ft', balls: [{ id: 0, x: 0, z: 0, pocketed: false }] };
  const r = simulateShot(t, shot({ power: 5, cueBall: { x: 20, z: -30 } }));
  assert.ok(Math.abs(r.final.balls[0].x - 20) < 0.01);
});
test('encaçapes do corpus caem como esperado', () => {
  for (const c of CORPUS.filter(c => c.expectPocketed)) {
    const pocketed = simulateShot(c.table, c.shot).final.balls.filter(b => b.pocketed && c.table.balls.find(x => x.id === b.id && !x.pocketed)).map(b => b.id);
    assert.deepEqual(pocketed, c.expectPocketed, c.name);
  }
});
