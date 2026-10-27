// packages/sim/test/table.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { installEnv } from './legacy/env.js';
installEnv({ seed: 1 });
const { createLegacyWorld } = await import('./legacy/legacy-world.js');
const { createWorld, cushionContactInset, getTableProfile, getPocketPositions, simulateShot, TUNING_LEGACY } = await import('../src/index.js');
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
        assert.deepEqual(b.shapeOrientations[j].toArray(), l.shapeOrientations[j].toArray(), `${id} ${i}.${j} orientation`);
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

test('cushionContactInset: a bola encosta na tabela a essa distância da borda, em todos os perfis', () => {
  // A nudge (0.001: ~0.006 cm/s) from a ball at rest, along each axis direction.
  const nudge = (id, x, z, angle) => simulateShot({ tableProfileId: id, balls: [{ id: 0, x, z, pocketed: false }] },
    { angle, power: 0.001, spin: { x: 0, y: 0 } }).events.filter(e => e.type === 'ball_cushion');
  const angles = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  assert.ok(Math.abs(cushionContactInset(getTableProfile('pool9ft')) - 10.594) < 0.001);
  for (const id of PROFILES) {
    const profile = getTableProfile(id);
    const inset = cushionContactInset(profile);
    const x = profile.width / 2 - inset;
    const z = profile.depth / 2 - inset;
    // The middle of each rail's cushion: [x, z, the direction away from the rail].
    for (const [cx, cz, away] of [[x, profile.depth / 4, Math.PI], [-x, -profile.depth / 4, 0], [0, z, -Math.PI / 2], [0, -z, Math.PI / 2]]) {
      const inside = [cx - Math.sign(cx) * 0.001, cz - Math.sign(cz) * 0.001];
      for (const angle of angles) assert.deepEqual(nudge(id, inside[0], inside[1], angle), [], `${id} (${inside}) along ${angle}`);
      const beyond = [cx + Math.sign(cx) * 0.02, cz + Math.sign(cz) * 0.02];
      assert.equal(nudge(id, beyond[0], beyond[1], away).length, 1, `${id} (${beyond}) touches the cushion`);
    }
  }
});

test('perfil desconhecido lança erro', () => {
  assert.throws(() => getTableProfile('xyz'), /unknown table profile: xyz/);
});

test('materiais e solver iguais ao PhysicsWorld legado', () => {
  const legacy = createLegacyWorld({ tableProfileId: 'pool9ft' }).physics.world;
  // TUNING (D041) has no ball-table friction; the legacy world is TUNING_LEGACY.
  const sim = createWorld(getTableProfile('pool9ft'), TUNING_LEGACY).world;
  const view = w => w.contactmaterials.map(c => [c.friction, c.restitution, c.contactEquationStiffness, c.contactEquationRelaxation]);
  assert.deepEqual(view(sim), view(legacy));
  assert.equal(sim.solver.iterations, legacy.solver.iterations);
  assert.equal(sim.solver.tolerance, legacy.solver.tolerance);
});

test('src não importa three nem usa APIs de navegador ou aleatoriedade', () => {
  const dir = new URL('../src/', import.meta.url);
  for (const f of readdirSync(dir).filter(f => f.endsWith('.js'))) {
    const code = readFileSync(new URL(f, dir), 'utf8');
    assert.doesNotMatch(code, /from ['"]three['"]|import\s*\(?\s*['"]three['"]|\bdocument\.|\bwindow\.|localStorage|\bperformance\b|Date\.now|Math\.random/, f);
    assert.match(code, /^\/\/ @ts-check/, `${f} sem // @ts-check`);
  }
});

test('mundo igual ao PhysicsWorld legado: corpos, pares de materiais e flags', () => {
  const bodyView = b => ({
    type: b.type,
    mass: b.mass,
    material: b.material.name,
    position: b.position.toArray(),
    quaternion: b.quaternion.toArray(),
    shapes: b.shapes.map(s => s.type),
    allowSleep: b.allowSleep,
    collisionResponse: b.collisionResponse,
  });
  for (const id of PROFILES) {
    const legacy = createLegacyWorld({ tableProfileId: id }).physics.world;
    const sim = createWorld(getTableProfile(id));
    // Legacy world.bodies = [plane, 6 cushions, balls...]; the sim has no balls yet.
    assert.deepEqual(sim.world.bodies.slice(0, 7).map(bodyView), legacy.bodies.slice(0, 7).map(bodyView), id);
    assert.equal(sim.world.bodies[0], sim.planeBody, id);
    assert.equal(sim.tableBodies.length, 6, id);
    sim.tableBodies.forEach((b, i) => assert.equal(b, sim.world.bodies[i + 1], `${id} tableBodies[${i}] is world.bodies[${i + 1}]`));
    assert.deepEqual(
      sim.world.contactmaterials.map(c => c.materials.map(m => m.name)),
      legacy.contactmaterials.map(c => c.materials.map(m => m.name)),
      id,
    );
    assert.deepEqual(sim.world.gravity.toArray(), legacy.gravity.toArray(), id);
    assert.equal(sim.world.allowSleep, legacy.allowSleep, id);
    assert.equal(sim.world.broadphase.constructor.name, legacy.broadphase.constructor.name, id);
    assert.equal(sim.world.solver.constructor.name, legacy.solver.constructor.name, id);
    assert.equal(sim.world.quatNormalizeSkip, legacy.quatNormalizeSkip, id);
    assert.equal(sim.world.quatNormalizeFast, legacy.quatNormalizeFast, id);
    for (const p of sim.pockets) assert.equal(p.y, 0, `${id} pocket y`);
  }
});
