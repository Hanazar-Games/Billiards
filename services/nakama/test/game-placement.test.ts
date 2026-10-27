// The ball in hand where the real sim leaves it alone (final review of F4-A, R17): a cue ball
// placed on the edge of what isCueBallPlacementValid allows touches no cushion and no other ball,
// so a tiny nudge only moves it by the nudge itself (nothing launches it, nothing pockets it), and
// one placement quantum (0.01 cm) beyond the edge is refused. The online table's bound comes from
// the cushion geometry of the sim (onlineConfig), so these tests run the sim itself.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isCueBallPlacementValid } from '@billiards/modes';
import type { TableState } from '@billiards/modes';
import { OP } from '@billiards/protocol';
import { getPocketPositions, simulateShot } from '@billiards/sim';
import { TABLE_PROFILES } from '@billiards/sim/constants';
import { ONLINE_TABLE, onlineConfig } from '../src/game/state.ts';
import { message, startedGame } from './fakes.ts';

const geometry = onlineConfig().table;
const R = geometry.ballRadius;
const profile = TABLE_PROFILES[ONLINE_TABLE];
/** A nudge: the cue ball gets 0.001 / 0.17 kg ≈ 0.006 cm/s. */
const NUDGE = 0.001;
/** The four directions along the rails: +x, +z, −x, −z (toward and away from any rail). */
const DIRECTIONS = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

const onlyCueBall = (x: number, z: number): TableState => ({ tableProfileId: ONLINE_TABLE, balls: [{ id: 0, x, z, pocketed: false }] });

/** The largest value of `coordinate` that the check allows (bisection over the check itself, to well below 1e-9 cm). */
function largestAllowed(coordinate: 'x' | 'z'): number {
  const table = onlyCueBall(0, 0);
  let inside = 0;
  let outside = coordinate === 'x' ? geometry.width : geometry.depth;
  for (let i = 0; i < 80; i++) {
    const middle = (inside + outside) / 2;
    const at = coordinate === 'x' ? { x: middle, z: 0 } : { x: 0, z: middle };
    if (isCueBallPlacementValid(table, at, geometry)) inside = middle;
    else outside = middle;
  }
  return inside;
}

const X_MAX = largestAllowed('x');
const Z_MAX = largestAllowed('z');

/** Where the cue ball ends after a nudge from (x, z) along `angle`, and the events of the shot. */
function nudge(table: TableState, x: number, z: number, angle: number) {
  const result = simulateShot(table, { angle, power: NUDGE, spin: { x: 0, y: 0 }, cueBall: { x, z } });
  const cue = result.final.balls.find((b) => b.id === 0)!;
  return { moved: Math.hypot(cue.x - x, cue.z - z), pocketed: cue.pocketed, events: result.events };
}

test('bola na mão no limite: nenhuma tabela lança a branca e nenhuma caçapa a engole', () => {
  const xs = [X_MAX, -X_MAX];
  const zs = [Z_MAX, -Z_MAX];
  const spots = [
    // Along the long rails, next to the side pockets (z = 0 and the ends of the cushion segments) and further on.
    ...xs.flatMap((x) => [0, 7.9, 8.5, 30, -60, 100, 110.6, -111].map((z) => ({ x, z }))),
    // Along the short rails, from the middle to the ends of the cushion.
    ...zs.flatMap((z) => [0, 25, -47.1, 48].map((x) => ({ x, z }))),
    // The four corners of the allowed rectangle.
    ...xs.flatMap((x) => zs.map((z) => ({ x, z }))),
  ];
  for (const { x, z } of spots) {
    assert.equal(isCueBallPlacementValid(onlyCueBall(0, 0), { x, z }, geometry), true, `(${x}, ${z}) is allowed`);
    for (const angle of DIRECTIONS) {
      const { moved, pocketed, events } = nudge(onlyCueBall(0, 0), x, z, angle);
      const where = `from (${x.toFixed(4)}, ${z.toFixed(4)}) along ${angle.toFixed(3)}`;
      assert.equal(pocketed, false, `pocketed ${where}`);
      // A cushion launch moves the ball by centimeters; the nudge alone, by about 1e-4 cm.
      assert.ok(moved < 0.01, `moved ${moved} cm ${where}`);
      assert.deepEqual(events, [], `contacts ${where}`);
    }
  }
});

test('o limite é o da tabela do sim: 0,05 cm além dele a branca já encosta na tabela', () => {
  for (const [x, z, away] of [[X_MAX + 0.05, 40, Math.PI], [-X_MAX - 0.05, -40, 0], [20, Z_MAX + 0.05, -Math.PI / 2], [-20, -Z_MAX - 0.05, Math.PI / 2]]) {
    const { events } = nudge(onlyCueBall(0, 0), x, z, away);
    assert.ok(events.some((e) => e.type === 'ball_cushion'), `no cushion contact at (${x}, ${z}): the bound is looser than needed`);
  }
});

test('o limite fica longe das caçapas: nenhum ponto permitido está no raio em que o sim encaçapa', () => {
  for (const pocket of getPocketPositions(profile)) {
    // The point of the allowed rectangle nearest the pocket.
    const x = Math.max(-X_MAX, Math.min(X_MAX, pocket.x));
    const z = Math.max(-Z_MAX, Math.min(Z_MAX, pocket.z));
    const detect = pocket.radius + profile.pocketDetectMargin;
    assert.ok(Math.hypot(x - pocket.x, z - pocket.z) > detect, `(${x}, ${z}) is within ${detect} cm of the pocket at (${pocket.x}, ${pocket.z})`);
  }
});

test('um quantum além do limite é recusado, nos quatro lados', () => {
  const table = onlyCueBall(0, 0);
  for (const at of [{ x: X_MAX + 0.01, z: 0 }, { x: -X_MAX - 0.01, z: 0 }, { x: 0, z: Z_MAX + 0.01 }, { x: 0, z: -Z_MAX - 0.01 }]) {
    assert.equal(isCueBallPlacementValid(table, at, geometry), false, JSON.stringify(at));
  }
});

test('o servidor aceita a branca quantizada até 52,89 e 116,39, e recusa 52,90 e 116,40 (CUE_BALL_INVALID)', () => {
  const game = startedGame();
  game.state.match!.mode.ballInHand = { seat: game.seat, zone: 'anywhere' };
  const request = (seq: number, cueBall: { x: number; z: number }) =>
    message(game.shooter, OP.SHOT_REQUEST, { turnId: 0, seq, angle: 0.5, power: 0, spin: { x: 0, y: 0 }, cueBall });
  game.loop(1, [request(1, { x: 52.90, z: 0 })]);
  game.loop(2, [request(2, { x: -20, z: -116.40 })]);
  game.loop(3, [request(3, { x: -52.89, z: -116.39 })]);
  const out = game.out();
  assert.deepEqual(out.filter((m) => m.op === OP.SHOT_REJECTED).map((m) => m.body),
    [{ seq: 1, reason: 'CUE_BALL_INVALID' }, { seq: 2, reason: 'CUE_BALL_INVALID' }]);
  assert.deepEqual(out.find((m) => m.op === OP.SHOT_ACCEPTED)!.body.shot.cueBall, { x: -52.89, z: -116.39 });
});

test('a branca a 2R de outra bola é recusada; a 2R + 0,01 cm vale, e a tacada para longe não toca nela', () => {
  const eight = { x: 10, z: 40 };
  const table: TableState = { tableProfileId: ONLINE_TABLE, balls: [{ id: 0, x: -30, z: 0, pocketed: false }, { id: 8, ...eight, pocketed: false }] };
  /** The cue ball `distance` from the 8 on the ray at `angle`, struck along the ray (away from the 8), softly. */
  const awayFromEight = (angle: number, distance: number) => {
    const cueBall = { x: eight.x + Math.cos(angle) * distance, z: eight.z + Math.sin(angle) * distance };
    const events = simulateShot(table, { angle, power: 1, spin: { x: 0, y: 0 }, cueBall }).events;
    return { cueBall, contacts: events.filter((e) => e.type === 'ball_ball' || e.type === 'first_contact') };
  };

  // At 2R (the computed distance rounds to a hair under it) the sim reports a first contact with
  // the 8 although the cue ball moves away from it: a phantom first hit. So it is refused.
  const touching = awayFromEight(2.5, 2 * R);
  assert.deepEqual(touching.contacts.map((e) => e.type), ['ball_ball', 'first_contact'], 'the phantom contact the clearance avoids');
  assert.equal(isCueBallPlacementValid(table, touching.cueBall, geometry), false, 'touching the 8');
  assert.equal(isCueBallPlacementValid(table, awayFromEight(-Math.PI / 2, 2 * R + 0.005).cueBall, geometry), false, 'half a quantum is not enough');

  // One placement quantum further, in any direction: allowed, and nothing touches the 8.
  for (const angle of [-Math.PI / 2, 0, Math.PI / 5, 2.5, -2]) {
    const clear = awayFromEight(angle, 2 * R + 0.01);
    assert.equal(isCueBallPlacementValid(table, clear.cueBall, geometry), true, `2R + 0.01 cm at ${angle}`);
    assert.deepEqual(clear.contacts, [], `contact at ${angle}`);
  }
});
