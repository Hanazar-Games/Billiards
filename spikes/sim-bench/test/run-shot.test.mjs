import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installEnv } from '../src/env.js';
installEnv({ seed: 7 });
const { createWorld } = await import('../src/world.js');
const { runShot } = await import('../src/run-shot.js');
const { CORPUS } = await import('../src/corpus.js');
const now = () => performance.now();
const brk = CORPUS.find(c => c.name === 'break').shot;

test('modelo fixo é determinístico com a mesma semente', () => {
  installEnv({ seed: 7 }); const a = runShot(createWorld({}), brk, { model: 'fixed', now });
  installEnv({ seed: 7 }); const b = runShot(createWorld({}), brk, { model: 'fixed', now });
  assert.equal(a.hash, b.hash);
});

test('abertura termina antes do limite e mantém bolas na mesa', () => {
  const w = createWorld({});
  const r = runShot(w, brk, { model: 'fixed', now });
  assert.equal(r.capped, false);
  assert.ok(r.simSeconds > 0.5 && r.simSeconds < 20);
  const { width, depth } = w.table.profile; // TABLE_PROFILES.pool9ft: width 127, depth 254 (cm)
  for (const f of r.final.filter(f => !f.pocketed)) {
    assert.ok(Math.abs(f.x) <= width / 2 && Math.abs(f.z) <= depth / 2);
  }
});

test('modelo legado roda a 60 e 144 fps', () => {
  for (const fps of [60, 144]) {
    const r = runShot(createWorld({}), brk, { model: 'legacy', fps, now });
    assert.ok(r.steps > 0 && r.simSeconds <= 20);
  }
});
