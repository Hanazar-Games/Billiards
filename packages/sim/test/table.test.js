// packages/sim/test/table.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { installEnv } from './legacy/env.js';
installEnv({ seed: 1 });
const { createLegacyWorld } = await import('./legacy/legacy-world.js');
const { createWorld, getTableProfile, getPocketPositions } = await import('../src/index.js');
const PROFILES = ['pool9ft', 'pool8ft', 'bar7ft', 'chinese8'];

test('corpos das tabelas idênticos ao Table.js em todos os perfis', () => {
  for (const id of PROFILES) {
    const legacy = createLegacyWorld({ tableProfileId: id }).table.bodies;
    const sim = createWorld(getTableProfile(id)).tableBodies;
    assert.equal(sim.length, legacy.length, id);
    sim.forEach((b, i) => {
      const l = legacy[i];
      assert.deepEqual(b.position.toArray(), l.position.toArray(), `${id} body ${i} position`);
      assert.equal(b.shapes.length, l.shapes.length);
      b.shapes.forEach((s, j) => {
        assert.deepEqual(s.halfExtents.toArray(), l.shapes[j].halfExtents.toArray());
        assert.deepEqual(b.shapeOffsets[j].toArray(), l.shapeOffsets[j].toArray());
        const q = b.shapeOrientations[j], lq = l.shapeOrientations[j];
        for (const k of ['x', 'y', 'z', 'w']) assert.ok(Math.abs(q[k] - lq[k]) < 1e-12, `${id} ${i}.${j}.${k}`);
      });
    });
  }
});

test('caçapas idênticas ao legado', () => {
  for (const id of PROFILES) {
    const legacy = createLegacyWorld({ tableProfileId: id }).pockets;
    const sim = getPocketPositions(getTableProfile(id));
    assert.deepEqual(sim.map(p => [p.x, p.z, p.radius, p.type]), legacy.map(p => [p.x, p.z, p.radius, p.type]));
  }
});

test('perfil desconhecido lança erro', () => {
  assert.throws(() => getTableProfile('xyz'), /unknown table profile: xyz/);
});

test('materiais e solver iguais ao PhysicsWorld legado', () => {
  const legacy = createLegacyWorld({ tableProfileId: 'pool9ft' }).physics.world;
  const sim = createWorld(getTableProfile('pool9ft')).world;
  const view = w => w.contactmaterials.map(c => [c.friction, c.restitution, c.contactEquationStiffness, c.contactEquationRelaxation]);
  assert.deepEqual(view(sim), view(legacy));
  assert.equal(sim.solver.iterations, legacy.solver.iterations);
  assert.equal(sim.solver.tolerance, legacy.solver.tolerance);
});

test('src não importa three nem usa APIs de navegador ou aleatoriedade', () => {
  const dir = new URL('../src/', import.meta.url);
  for (const f of readdirSync(dir)) {
    const code = readFileSync(new URL(f, dir), 'utf8');
    assert.doesNotMatch(code, /from ['"]three['"]|\bdocument\.|\bwindow\.|localStorage|performance\.now|Date\.now|Math\.random/, f);
    assert.match(code, /^\/\/ @ts-check/, `${f} sem // @ts-check`);
  }
});
