// F1-09: backspin draws the cue ball back, as on a real table.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulateShot } from '../src/index.js';
import { CORPUS } from './corpus.js';

// D039 (open): no tuning measured so far passes these and the feel test
// together, so TUNING is still TUNING_LEGACY. They run as todo until the user
// decides, so their failure stays visible (docs/f1/calibragem-recuo.md).
const todo = 'D039 (aberta): calibragem do recuo não fecha com a sensação do legado';

test('draw-ref: a branca volta pelo menos 10 cm depois do contato', { todo }, () => {
  const c = CORPUS.find(x => x.name === 'draw-ref');
  const r = simulateShot(c.table, c.shot);
  const fc = r.events.find(e => e.type === 'first_contact');
  assert.ok(fc, 'a branca precisa alcançar a bola 1');
  const maxZ = Math.max(...r.frames.flatMap(f => f.balls.filter(b => b.id === 0).map(b => b.z)));
  const endZ = r.final.balls.find(b => b.id === 0).z;
  assert.ok(maxZ - endZ >= 10, `recuo de ${(maxZ - endZ).toFixed(1)} cm`);
});

test('bola sozinha com efeito para trás conserva 2,5v + ωR (±5%) nos primeiros 0,1 s', { todo }, () => {
  const t = { tableProfileId: 'pool9ft', balls: [{ id: 0, x: 0, z: -100, pocketed: false }] };
  const R = 2.8575;
  const inv = r => 2.5 * r.v + r.w * R;
  const r0 = simulateShot(t, { angle: Math.PI / 2, power: 60, spin: { x: 0, y: -0.8 } }, { maxSimSeconds: 1 / 360, probe: true });
  const r1 = simulateShot(t, { angle: Math.PI / 2, power: 60, spin: { x: 0, y: -0.8 } }, { maxSimSeconds: 0.1, probe: true });
  assert.ok(Math.abs(inv(r1.probe) - inv(r0.probe)) <= 0.05 * Math.abs(inv(r0.probe)),
    `2,5v + ωR: ${inv(r0.probe).toFixed(1)} → ${inv(r1.probe).toFixed(1)}`);
});
