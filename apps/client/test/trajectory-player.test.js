// TrajectoryPlayer: plays a simulated shot back at any frame rate. Pure data in,
// poses and timed events out, so it all runs in Node without Three.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BALL, simulateShot } from '@billiards/sim';
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

// Quaternions as [x, y, z, w]: the product a·b and the inverse of a unit one.
const mul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]
];
const inverse = (q) => [-q[0], -q[1], -q[2], q[3]];
const aboutX = (angle) => [Math.sin(angle / 2), 0, 0, Math.cos(angle / 2)];
// The world-frame turn from `from` to `to` (the sim turns a ball by
// q' = rot · q), as the axis scaled by sin(angle / 2), angle in [0, π].
const turn = (from, to) => {
  const r = mul(to, inverse(from));
  return r[3] < 0 ? [-r[0], -r[1], -r[2]] : [r[0], r[1], r[2]];
};

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

test('cada evento sai só no avanço que alcança o seu t, inclusive quando o tempo cai exatamente nele', () => {
  const q = [0, 0, 0, 1];
  const ball = (id, x) => ({ id, x, z: 0, q, pocketed: false });
  const ev0 = { t: 0, type: 'ball_cushion', ball: 0, speed: 1 };
  const ev1 = { t: 1 / 30, type: 'ball_ball', a: 0, b: 1, speed: 2 };
  const ev2 = { t: 0.04, type: 'ball_cushion', ball: 1, speed: 3 };
  const p = new TrajectoryPlayer({
    initial: { tableProfileId: 'pool9ft', balls: [ball(0, 0), ball(1, 5)] },
    frames: [
      { t: 1 / 30, balls: [{ id: 0, x: 1, z: 0, q }] },
      { t: 2 / 30, balls: [{ id: 0, x: 2, z: 0, q }] }
    ],
    events: [ev0, ev1, ev2],
    final: { tableProfileId: 'pool9ft', balls: [ball(0, 3), ball(1, 5)] },
    simSeconds: 3 / 30
  });
  assert.deepEqual(p.advance(1 / 60).events, [ev0], 'the first advance gets t = 0 and nothing later');
  // 1/60 + 1/60 is 1/30 with no rounding, so this advance lands exactly on ev1.t.
  const onEvent = p.advance(1 / 60);
  assert.equal(p.time, 1 / 30);
  assert.deepEqual(onEvent.events, [ev1], 'an event at exactly the new time is included');
  assert.deepEqual(p.advance(1 / 300).events, [], 'a window with no event stays empty');
  assert.equal(p.time < 0.04, true);
  assert.deepEqual(p.advance(0.02).events, [ev2], 'the window that crosses 0.04 gets it');
  assert.deepEqual(p.advance(0.01).events, [], 'nothing repeats');
  assert.deepEqual(p.advance(100).events, [], 'nothing is left at the end');
});

test('bola encaçapada depois do último quadro fica na última pose até o evento, sem ir para o (0, 0) do estado final', () => {
  const q = [0, 0, 0, 1];
  const live = (id, x, z) => ({ id, x, z, q, pocketed: false });
  const pocket = { t: 0.08, type: 'pocket', ball: 1, pocket: 0 }; // after the last frame (2/30), before the end (3/30)
  const p = new TrajectoryPlayer({
    initial: { tableProfileId: 'pool9ft', balls: [live(0, 0, 0), live(1, 20, 10)] },
    frames: [
      { t: 1 / 30, balls: [{ id: 1, x: 22, z: 10, q }] },
      { t: 2 / 30, balls: [{ id: 1, x: 24, z: 10, q }] }
    ],
    events: [pocket],
    // Where the sim parks a ball it pockets.
    final: { tableProfileId: 'pool9ft', balls: [live(0, 0, 0), { id: 1, x: 0, z: 0, q, pocketed: true }] },
    simSeconds: 3 / 30
  });
  const at = (poses) => poses.find(b => b.id === 1);
  const before = at(p.advance(0.079).poses);
  assert.deepEqual([before.x, before.z], [24, 10], 'still at the last frame pose, not on its way to (0, 0)');
  const out = p.advance(0.002); // now at 0.081
  assert.deepEqual(out.events, [pocket]);
  assert.equal(at(out.poses), undefined, 'gone from the pocket event on');
  assert.equal(at(p.advance(1).poses), undefined, 'and not in the final state either');
});

test('bola que rola mais de meia volta entre amostras gira pelo arco do rolamento, não pelo arco curto', () => {
  // 4.2 rad of roll along +z (12 cm over the radius) in one sample: rolling
  // along +z turns the ball about +x. The samples alone also fit 2π − 4.2 rad
  // about −x, the short arc.
  const rolled = 4.2;
  const q1 = aboutX(rolled);
  const shot = (extra) => new TrajectoryPlayer({
    initial: { tableProfileId: 'pool9ft', balls: [{ id: 0, x: 0, z: 0, q: [0, 0, 0, 1], pocketed: false }] },
    frames: [{ t: 1 / 30, balls: [{ id: 0, x: 0, z: rolled * BALL.radius, q: q1 }] }],
    events: [],
    final: { tableProfileId: 'pool9ft', balls: [{ id: 0, x: 0, z: rolled * BALL.radius, q: q1, pocketed: false }] },
    simSeconds: 1 / 30,
    ...extra
  });
  const mid = (p) => p.advance(1 / 60).poses[0].q;

  const rolling = mid(shot({ ballRadius: BALL.radius }));
  assert.ok(Math.abs(Math.hypot(...rolling) - 1) < 1e-12);
  const half = aboutX(rolled / 2);
  for (let i = 0; i < 4; i++) assert.ok(Math.abs(rolling[i] - half[i]) < 1e-9, `half of the roll about +x: ${rolling}`);

  // Without the radius the player cannot tell: short arc, as before.
  const short = mid(shot({}));
  const back = aboutX(-(2 * Math.PI - rolled) / 2);
  for (let i = 0; i < 4; i++) assert.ok(Math.abs(short[i] - back[i]) < 1e-3, `short arc about −x: ${short}`);
});

test('bola que rola menos de meia volta entre amostras segue o arco curto, mesmo com o raio', () => {
  // The same turn as above, but the ball moves only 3 cm: under half a turn
  // of roll, so the spin is not the roll's (draw, english) and stays as sampled.
  const q1 = aboutX(4.2);
  const p = new TrajectoryPlayer({
    initial: { tableProfileId: 'pool9ft', balls: [{ id: 0, x: 0, z: 0, q: [0, 0, 0, 1], pocketed: false }] },
    frames: [{ t: 1 / 30, balls: [{ id: 0, x: 0, z: 3, q: q1 }] }],
    events: [],
    final: { tableProfileId: 'pool9ft', balls: [{ id: 0, x: 0, z: 3, q: q1, pocketed: false }] },
    simSeconds: 1 / 30,
    ballRadius: BALL.radius
  });
  const q = p.advance(1 / 60).poses[0].q;
  const back = aboutX(-(2 * Math.PI - 4.2) / 2);
  for (let i = 0; i < 4; i++) assert.ok(Math.abs(q[i] - back[i]) < 1e-3, `short arc about −x: ${q}`);
});

test('na abertura e na long-stun, a branca rápida gira para o lado em que rola', () => {
  // `follow` is not here: its cue ball turns more than half a turn per sample
  // with less than half a turn of roll (topspin), which the displacement does
  // not reveal (D044).
  const checked = {};
  const wrong = {};
  for (const name of ['break', 'long-stun']) {
    checked[name] = 0;
    wrong[name] = [];
    const c = byName(name);
    const r = simulateShot(c.table, c.shot);
    const frames = decodeTrajectory(encodeTrajectory(r.frames));
    const p = new TrajectoryPlayer({ initial: c.table, ...r, frames, ballRadius: BALL.radius });
    const cue = c.table.balls.find(b => b.id === 0);
    let from = { t: 0, x: cue.x, z: cue.z, q: cue.q ?? [0, 0, 0, 1] };
    for (const f of frames) {
      if (f.t >= r.simSeconds) break;
      const b = f.balls.find(ball => ball.id === 0);
      const to = b ? { t: f.t, x: b.x, z: b.z, q: b.q ?? from.q } : { ...from, t: f.t };
      const dx = to.x - from.x;
      const dz = to.z - from.z;
      if (Math.hypot(dx, dz) / BALL.radius > Math.PI) {
        checked[name]++;
        const mid = p.advance((from.t + to.t) / 2 - p.time).poses.find(ball => ball.id === 0);
        const axis = turn(from.q, mid.q);
        // Rolling along (dx, dz) turns the ball about up × d = (dz, 0, −dx).
        if (!(axis[0] * dz - axis[2] * dx > 0)) wrong[name].push(Number(from.t.toFixed(3)));
      }
      from = to;
    }
  }
  for (const name in checked) assert.ok(checked[name] > 0, `${name}: the cue ball never rolls more than half a turn between samples`);
  // Start times (s) of the samples where the cue ball turns against its roll.
  assert.deepEqual(wrong, { break: [], 'long-stun': [] });
});
