import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installEnv } from '../src/env.js';
installEnv({ seed: 1 });
const { createWorld } = await import('../src/world.js');
const { BALL } = await import('../../../src/config.js');

test('mundo 8-ball pool9ft tem 16 bolas, 6 caçapas e corpos de tabela', () => {
  const w = createWorld({});
  assert.equal(w.balls.balls.length, 16);
  assert.equal(w.pockets.length, 6);
  assert.ok(w.table.bodies.length > 0);
  assert.ok(w.physics.world.bodies.length >= 16 + w.table.bodies.length);
  for (const b of w.balls.balls) assert.ok(Math.abs(b.body.position.y - BALL.radius) < 0.01);
});
