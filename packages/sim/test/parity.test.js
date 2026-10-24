// packages/sim/test/parity.test.js — bit a bit contra o legado no mesmo ritmo
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installEnv } from './legacy/env.js';
installEnv({ seed: 1 });
const { createLegacyWorld } = await import('./legacy/legacy-world.js');
const { runLegacy } = await import('./legacy/legacy-run.js');
const { simulateShot, TUNING_LEGACY } = await import('../src/index.js');
const { CORPUS } = await import('./corpus.js');
const { hashFinal } = await import('./util/hash.js');

for (const name of ['break', 'medium', 'english', 'soft', 'draw-rack']) {
  test(`paridade com o legado a 60 Hz fixo: ${name}`, () => {
    const c = CORPUS.find(x => x.name === name);
    const sim = simulateShot(c.table, c.shot, { tuning: TUNING_LEGACY });
    const legacy = runLegacy(createLegacyWorld({ tableProfileId: 'pool9ft' }),
      { dir: { x: Math.cos(c.shot.angle), z: Math.sin(c.shot.angle) }, force: c.shot.power, spin: c.shot.spin },
      { cadence: 'fixed60' });
    assert.equal(sim.steps, legacy.steps);
    assert.equal(hashFinal(sim.final.balls), hashFinal(legacy.final));
  });
}
