// Trajectory sampled at 30 Hz of simulated time.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getPocketPositions, getTableProfile, simulateShot } from '../src/index.js';
import { CORPUS } from './corpus.js';
const run = name => { const c = CORPUS.find(x => x.name === name); return { c, r: simulateShot(c.table, c.shot) }; };

test('quadros densos em múltiplos de 1/30 s até o fim', () => {
  const { r } = run('break');
  assert.equal(r.frames.length, Math.floor(r.steps / 12));
  r.frames.forEach((f, i) => assert.equal(f.t, (i + 1) * 12 / 360));
});
test('bolas paradas não aparecem; a branca aparece no primeiro quadro', () => {
  const { r } = run('soft');
  assert.ok(r.frames[0].balls.some(b => b.id === 0));
  assert.ok(!r.frames[0].balls.some(b => b.id === 15));
});
test('última amostra de cada bola fica a menos de 0,5 cm do estado final', () => {
  const { r } = run('medium');
  const lastSeen = new Map();
  for (const f of r.frames) for (const b of f.balls) lastSeen.set(b.id, b);
  assert.ok(lastSeen.size >= 2, 'a abertura média move várias bolas');
  for (const fb of r.final.balls.filter(b => !b.pocketed)) {
    const s = lastSeen.get(fb.id); if (!s) continue;
    assert.ok(Math.hypot(s.x - fb.x, s.z - fb.z) < 0.5, `ball ${fb.id}`);
  }
});
test('quatérnios normalizados', () => {
  const sampled = run('english').r.frames.flatMap(f => f.balls);
  assert.ok(sampled.length > 0);
  for (const b of sampled) assert.ok(Math.abs(Math.hypot(...b.q) - 1) < 1e-9);
});
test('bola encaçapada aparece pela última vez na boca da caçapa, no quadro do encaçape', () => {
  const { r } = run('pot-side');
  const pe = r.events.find(e => e.type === 'pocket' && e.ball === 1);
  const pocket = getPocketPositions(getTableProfile('pool9ft'))[pe.pocket];
  const withBall = r.frames.filter(f => f.balls.some(b => b.id === 1));
  const last = withBall[withBall.length - 1];
  assert.equal(last.t, r.frames.find(f => f.t >= pe.t).t);
  const s = last.balls.find(b => b.id === 1);
  assert.ok(Math.hypot(s.x - pocket.x, s.z - pocket.z) < pocket.radius + 5, `(${s.x}, ${s.z})`);
});
test('estado final traz o quatérnio de todas as bolas', () => {
  const { r } = run('break');
  for (const b of r.final.balls) assert.ok(Math.abs(Math.hypot(...b.q) - 1) < 1e-9, `ball ${b.id}`);
});
