// TrajectoryPlayer: plays a simulated shot back at any frame rate. Pure data in,
// poses and timed events out, so it all runs in Node without Three.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulateShot } from '@billiards/sim';
import { encodeTrajectory, decodeTrajectory } from '@billiards/protocol';
import { CORPUS } from '../../../packages/sim/test/corpus.js';
import { TrajectoryPlayer } from '../src/sim/TrajectoryPlayer.js';

// Simulates a corpus case and plays it back the way the game does: frames go
// through the wire format first.
const play = (c) => {
  const r = simulateShot(c.table, c.shot);
  return { r, p: new TrajectoryPlayer({ initial: c.table, ...r, frames: decodeTrajectory(encodeTrajectory(r.frames)) }) };
};
const byName = (n) => CORPUS.find(c => c.name === n);

test('interpola posição e rotação entre amostras', () => {
  const q90 = [0, Math.SQRT1_2, 0, Math.SQRT1_2];
  const p = new TrajectoryPlayer({
    initial: { tableProfileId: 'pool9ft', balls: [{ id: 0, x: 0, z: 0, q: [0, 0, 0, 1], pocketed: false }] },
    frames: [{ t: 1 / 30, balls: [{ id: 0, x: 3, z: 0, q: q90 }] }],
    events: [],
    final: { tableProfileId: 'pool9ft', balls: [{ id: 0, x: 3, z: 0, q: q90, pocketed: false }] },
    simSeconds: 1 / 30
  });
  const { poses } = p.advance(1 / 60);
  assert.ok(Math.abs(poses[0].x - 1.5) < 1e-9);
  assert.ok(Math.abs(Math.hypot(...poses[0].q) - 1) < 1e-12);
  assert.ok(Math.abs(poses[0].q[1] - Math.sin(Math.PI / 8)) < 1e-3); // about half of 90° around y
});

test('a rotação segue o arco curto quando o quatérnio vem com o sinal oposto', () => {
  const q90 = [0, Math.SQRT1_2, 0, Math.SQRT1_2];
  const minus = q90.map(v => -v); // the same rotation as q90
  const p = new TrajectoryPlayer({
    initial: { tableProfileId: 'pool9ft', balls: [{ id: 0, x: 0, z: 0, pocketed: false }] }, // no q: identity
    frames: [{ t: 1 / 30, balls: [{ id: 0, x: 3, z: 0, q: minus }] }],
    events: [],
    final: { tableProfileId: 'pool9ft', balls: [{ id: 0, x: 3, z: 0, q: minus, pocketed: false }] },
    simSeconds: 1 / 30
  });
  const { q } = p.advance(1 / 60).poses[0];
  assert.ok(Math.abs(q[1] - Math.sin(Math.PI / 8)) < 1e-3);
  assert.ok(Math.abs(q[3] - Math.cos(Math.PI / 8)) < 1e-3);
});

test('bola ausente num quadro fica parada até a amostra seguinte', () => {
  const q = [0, 0, 0, 1];
  const ball = (id, x) => ({ id, x, z: 0, q, pocketed: false });
  // Ball 0 moves in every frame. Ball 1 is in frames 1 and 3 only.
  const p = new TrajectoryPlayer({
    initial: { tableProfileId: 'pool9ft', balls: [ball(0, 0), ball(1, 8)] },
    frames: [
      { t: 1 / 30, balls: [{ id: 0, x: 1, z: 0, q }, { id: 1, x: 10, z: 0, q }] },
      { t: 2 / 30, balls: [{ id: 0, x: 2, z: 0, q }] },
      { t: 3 / 30, balls: [{ id: 0, x: 3, z: 0, q }, { id: 1, x: 13, z: 0, q }] }
    ],
    events: [],
    final: { tableProfileId: 'pool9ft', balls: [ball(0, 3), ball(1, 13)] },
    simSeconds: 3 / 30
  });
  const x1 = (poses) => poses.find(b => b.id === 1).x;
  assert.ok(Math.abs(x1(p.advance(1.5 / 30).poses) - 10) < 1e-9, 'between frames 1 and 2 it stays at frame 1');
  assert.ok(Math.abs(x1(p.advance(1 / 30).poses) - 11.5) < 1e-9, 'between frames 2 and 3 it goes from frame 1 to frame 3');
});

test('eventos saem uma vez e em ordem, com qualquer divisão de dt', () => {
  const { r, p } = play(byName('break'));
  const dts = [1 / 144, 0.1, 1 / 60, 1 / 240, 0.033];
  const seen = []; let out; let i = 0;
  do { out = p.advance(dts[i++ % dts.length]); seen.push(...out.events); } while (!out.done);
  assert.deepEqual(seen, r.events);
});

test('no fim, as poses são exatamente o estado final', () => {
  const { r, p } = play(byName('break'));
  let out; do { out = p.advance(1 / 60); } while (!out.done);
  assert.deepEqual(out.poses, r.final.balls.filter(b => !b.pocketed).map(({ id, x, z, q }) => ({ id, x, z, q })));
  assert.equal(p.time, p.duration);
});

test('dt enorme termina a tacada num avanço só, com todos os eventos', () => {
  const { r, p } = play(byName('break'));
  const out = p.advance(100);
  assert.equal(out.done, true); assert.deepEqual(out.events, r.events);
});

test('bola encaçapada some no instante do evento e não vai para (0, 0)', () => {
  const { r, p } = play(byName('pot-corner'));
  const tPocket = r.events.find(e => e.type === 'pocket' && e.ball === 1).t;
  let out; let last1 = null;
  do {
    out = p.advance(1 / 120);
    const b1 = out.poses.find(b => b.id === 1);
    if (p.time < tPocket) { assert.ok(b1); last1 = b1; } else assert.equal(b1, undefined);
  } while (!out.done);
  assert.ok(Math.hypot(last1.x, last1.z) > 10);
});

test('tacada vazia termina no primeiro avanço', () => {
  const t = byName('soft').table;
  const out = new TrajectoryPlayer({ initial: t, frames: [], events: [], final: t, simSeconds: 0 }).advance(1 / 60);
  assert.equal(out.done, true); assert.equal(out.poses.length, t.balls.filter(b => !b.pocketed).length);
});

test('dt inválido não avança', () => {
  const { p } = play(byName('break'));
  for (const dt of [NaN, -1, 0]) assert.deepEqual(p.advance(dt).events, []);
  assert.equal(p.time, 0);
});
