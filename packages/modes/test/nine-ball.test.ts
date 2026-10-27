// 9-ball in packages/modes: the 9-ball tests ported from apps/client/test/rules.test.js
// (names kept), new tests, and a differential test against the frozen legacy NineBallRules.js (D046).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nineBall, type NineBallState, type Ruling, type SimEvent } from '../src/index.ts';
import { ev, mulberry32, config9, FINAL, SHOT } from './helpers.ts';
// @ts-ignore frozen legacy JavaScript, not type-checked
import { NineBallRules } from './legacy/game/NineBallRules.js';

const fresh = (options?: { threeFoulLoss?: boolean }) =>
  nineBall.createInitialState(options ? { ...config9, options } : config9, mulberry32(1));
const codes = (r: Ruling<NineBallState>) => [...r.fouls, ...r.messages.map((m) => m.code)];
/** The legacy `startShot(p)` puts player p at the table whatever the turn order says. */
const at = (s: NineBallState, seat: number): NineBallState => ({ ...s, turn: { ...s.turn, currentSeat: seat } });
const open = (s: NineBallState): NineBallState => ({ ...s, breakShot: false });
const shoot = (s: NineBallState, seat: number, events: SimEvent[], pushOut = false) =>
  nineBall.resolveShot(at(s, seat), seat, events, FINAL, { ...SHOT, pushOut });

// ── Ported from rules.test.js ──

test('legal break with pocketed ball', () => {
  const r = shoot(fresh(), 0, ev({ first: 1, pocketed: [2] }));
  assert.equal(r.fouls.length, 0);
  assert.equal(r.nextSeat, 0);
  assert.equal(r.state.breakShot, false);
});

test('legal break with no pocket but 4 balls to rail', () => {
  const r = shoot(fresh(), 0, ev({ first: 1, cushions: [2, 3, 4, 5] }));
  assert.equal(r.fouls.length, 0);
  assert.equal(r.nextSeat, 1);
});

test('illegal break: fewer than 4 balls hit rail', () => {
  const r = shoot(fresh(), 0, ev({ first: 1, cushions: [2, 3] }));
  assert.ok(r.fouls.length > 0);
  assert.equal(r.ballInHand?.seat, r.nextSeat);
  assert.ok(codes(r).includes('ILLEGAL_BREAK'));
  assert.equal(r.nextSeat, 1);
});

test('illegal break: first hit not 1-ball', () => {
  const r = shoot(fresh(), 0, ev({ first: 2 }));
  assert.ok(r.fouls.length > 0);
  assert.equal(r.ballInHand?.seat, r.nextSeat);
  assert.ok(codes(r).includes('WRONG_FIRST_HIT'));
  assert.equal(r.nextSeat, 1);
});

test('9-ball pocketed on break = win', () => {
  const r = shoot(fresh(), 0, ev({ first: 1, pocketed: [9] }));
  assert.equal(r.winnerTeam, 0);
  assert.ok(codes(r).includes('NINE_ON_BREAK_WIN'));
});

test('break scratch', () => {
  const r = shoot(fresh(), 0, ev({ cue: true }));
  assert.ok(r.fouls.length > 0);
  assert.ok(r.fouls.includes('SCRATCH'));
  assert.equal(r.ballInHand?.seat, r.nextSeat);
  assert.ok(codes(r).includes('SCRATCH'));
  assert.equal(r.nextSeat, 1);
});

test('normal shot wrong first hit', () => {
  const r = shoot(open(fresh()), 0, ev({ first: 2 }));
  assert.ok(r.fouls.length > 0);
  assert.equal(r.ballInHand?.seat, r.nextSeat);
  assert.ok(codes(r).includes('WRONG_FIRST_HIT'));
  assert.equal(r.nextSeat, 1);
});

test('legal 9-ball win', () => {
  const r = shoot({ ...open(fresh()), pocketed: [1, 2, 3, 4, 5, 6, 7, 8] }, 0, ev({ first: 9, pocketed: [9] }));
  assert.equal(r.winnerTeam, 0);
  assert.ok(codes(r).includes('LEGAL_NINE_WIN'));
});

test('second consecutive foul shows warning', () => {
  let r = shoot(open(fresh()), 0, ev({ cue: true }));
  assert.equal(r.state.fouls[0], 1);
  r = shoot(r.state, 0, ev({ cue: true }));
  assert.equal(r.state.fouls[0], 2);
  r = shoot(r.state, 0, ev({ cue: true }));
  assert.equal(r.state.fouls[0], 3);
  assert.equal(r.winnerTeam, 1);
  assert.ok(codes(r).includes('THREE_FOUL_LOSS'));
});

test('third consecutive foul = loss', () => {
  let r = shoot(open(fresh()), 0, ev({ cue: true }));
  r = shoot(r.state, 0, ev({ cue: true }));
  assert.equal(r.messages[0].code, 'THREE_FOUL_WARNING');
  r = shoot(r.state, 0, ev({ cue: true }));
  assert.equal(r.winnerTeam, 1);
  assert.ok(codes(r).includes('THREE_FOUL_LOSS'));
});

test('legal shot resets consecutive fouls', () => {
  let r = shoot(open(fresh()), 0, ev({ cue: true }));
  assert.equal(r.state.fouls[0], 1);
  r = shoot(r.state, 1, ev({ first: 1, pocketed: [2] }));
  assert.equal(r.state.fouls[1], 0);
  r = shoot(r.state, 0, ev({ cue: true }));
  assert.equal(r.state.fouls[0], 2);
  assert.equal(r.winnerTeam, null);
});

test('threeFoulLoss disabled does not end game', () => {
  let s = open(fresh({ threeFoulLoss: false }));
  for (let i = 0; i < 3; i++) s = shoot(s, 0, ev({ cue: true })).state;
  assert.equal(s.winnerTeam, null);
  assert.equal(s.fouls[0], 3);
});

test('push-out available after legal break', () => {
  assert.equal(shoot(fresh(), 0, ev({ first: 1, pocketed: [2] })).state.pushOut.available, true);
});

test('declarePushOut succeeds when available', () => {
  const s = { ...open(fresh()), pushOut: { available: true, pending: false, seat: null } };
  assert.deepEqual(nineBall.validateShot(s, 0, { ...SHOT, pushOut: true }), { ok: true });
  assert.equal(shoot(s, 0, ev({ first: 1 }), true).state.pushOut.available, false);
});

test('declarePushOut fails when not available', () => {
  assert.deepEqual(nineBall.validateShot(fresh(), 0, { ...SHOT, pushOut: true }), { ok: false, reason: 'PUSH_OUT_UNAVAILABLE' });
});

const pushable = () => ({ ...open(fresh()), pushOut: { available: true, pending: false, seat: null } });

test('push-out shot does not require lowest ball', () => {
  const r = shoot(pushable(), 0, ev({ first: 2 }), true);
  assert.equal(r.fouls.length, 0);
  assert.equal(r.state.pushOut.pending, true);
});

test('push-out shot does not require rail contact', () => {
  const r = shoot(pushable(), 0, ev({ first: 1 }), true);
  assert.equal(r.fouls.length, 0);
  assert.equal(r.state.pushOut.pending, true);
});

test('push-out scratch is still a foul', () => {
  const r = shoot(pushable(), 0, ev({ cue: true }), true);
  assert.ok(r.fouls.length > 0);
  assert.ok(r.fouls.includes('SCRATCH'));
  assert.equal(r.state.pushOut.pending, false);
});

test('push-out enters pending state after shot', () => {
  const r = shoot(pushable(), 0, ev({ first: 1 }), true);
  assert.ok(codes(r).includes('PUSH_OUT_PENDING'));
  assert.equal(r.state.pushOut.pending, true);
  assert.equal(r.state.pushOut.seat, 0);
});

test('9-ball pocketed on push-out is spotted, not a win', () => {
  const r = shoot(pushable(), 0, ev({ first: 1, pocketed: [9] }), true);
  assert.equal(r.winnerTeam, null);
  assert.equal(r.state.pushOut.pending, true);
  assert.ok(r.respot.includes(9));
  assert.equal(r.state.pocketed.includes(9), false);
});

const pending = (): NineBallState => at({ ...open(fresh()), pushOut: { available: false, pending: true, seat: 0 } }, 1);

test('acceptPushOut gives turn to opponent', () => {
  const r = nineBall.applyChoice(pending(), 1, { kind: 'push_out', accept: true });
  assert.equal(r.nextSeat, 1);
  assert.equal(r.state.pushOut.pending, false);
});

test('passPushOut gives turn back to original player', () => {
  const r = nineBall.applyChoice(pending(), 1, { kind: 'push_out', accept: false });
  assert.equal(r.nextSeat, 0);
  assert.equal(r.state.pushOut.pending, false);
});

test('serializer round-trips 9-ball state', () => {
  const s = { ...open(fresh()), pocketed: [1, 2, 3], fouls: [2, 1], pushOut: { available: true, pending: false, seat: null } };
  const copy = JSON.parse(JSON.stringify(s));
  assert.deepEqual(copy, s);
  const events = ev({ first: 4, cushions: [4], pocketed: [4] });
  assert.deepEqual(nineBall.resolveShot(copy, 0, events, FINAL, SHOT), nineBall.resolveShot(s, 0, events, FINAL, SHOT));
});

// ── New ──

test('validateShot: push-out pendente bloqueia a tacada até a escolha', () => {
  assert.deepEqual(nineBall.validateShot(pending(), 1, SHOT), { ok: false, reason: 'PUSH_OUT_PENDING' });
});

test('tempo esgotado conta como falta seguida e limpa o push-out pendente', () => {
  const r = nineBall.resolveTimeout(pending(), 1);
  assert.deepEqual(r.fouls, ['TIMEOUT']);
  assert.equal(r.state.fouls[1], 1);
  assert.equal(r.state.pushOut.pending, false);
  assert.equal(r.nextSeat, 0);
  assert.deepEqual(r.ballInHand, { seat: 0, zone: 'anywhere' });
});

test('rackLayout repete o losango de hoje', () => {
  const layout = nineBall.rackLayout(fresh());
  const d = 2.8575 * 2.02;
  const foot = 254 / 2 * 0.55;
  const ball = (id: number) => layout.find((b) => b.id === id);
  assert.equal(layout.length, 10);
  assert.deepEqual(ball(0), { id: 0, x: 0, z: -foot });
  assert.deepEqual(ball(1), { id: 1, x: 0, z: foot });
  assert.deepEqual(ball(9), { id: 9, x: 0, z: foot + 2 * d * Math.sin(Math.PI / 3) });
});

test('diferencial: 3000 tacadas aleatórias decidem como o NineBallRules.js congelado', () => {
  const rng = mulberry32(99);
  const chance = (p: number) => rng() < p;
  const pick = <T>(xs: T[]): T => xs[Math.floor(rng() * xs.length)];
  let shots = 0;
  while (shots < 3000) {
    const legacy = new NineBallRules();
    let s = fresh();
    for (let n = 0; n < 60 && s.winnerTeam === null && shots < 3000; n++, shots++) {
      const seat = s.turn.currentSeat;
      const other = seat === 0 ? 2 : 1;
      let r: Ruling<NineBallState>;
      let l: any;
      if (s.pushOut.pending) {
        const accept = chance(0.5);
        l = accept ? legacy.acceptPushOut() : legacy.passPushOut();
        r = nineBall.applyChoice(s, seat, { kind: 'push_out', accept });
      } else if (chance(0.1)) {
        // Game._onTurnTimerExpired (apps/client/src/game/Game.js:1476-1495) on the legacy rules.
        legacy.startShot(seat + 1);
        legacy.foul = true;
        legacy.foulReason = 'TIMEOUT';
        l = legacy._applyConsecutiveFouls({ nextPlayer: other, foul: true, scratch: false, ballInHand: true, reasonCode: 'TIMEOUT' }, other);
        r = nineBall.resolveTimeout(s, seat);
      } else {
        const onTable = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((id) => !s.pocketed.includes(id));
        const target = onTable[0];
        const first = chance(0.05) ? null : chance(0.6) ? target : pick(onTable);
        const before: number[] = []; const after: number[] = [];
        for (let k = Math.floor(rng() * 6); k > 0; k--) (first !== null && chance(0.6) ? after : before).push(pick([0, ...onTable]));
        const pocketed = [...new Set(Array.from({ length: Math.floor(rng() * 3) }, () => pick(onTable)))];
        const pushOut = s.pushOut.available && chance(0.3);
        if (pushOut) legacy.declarePushOut();
        const events: SimEvent[] = ev({ first, cushionsBeforeFirst: before, cushions: after, pocketed, cue: chance(0.1) });
        // The legacy rules fed exactly as the F1-B Game did (events in order, turnPocketedIds with the cue ball).
        legacy.startShot(seat + 1);
        const ids: number[] = [];
        for (const e of events) {
          if (e.type === 'first_contact') legacy.recordFirstHit(e.ball);
          else if (e.type === 'ball_cushion') legacy.recordCushionHit(e.ball);
          else if (e.type === 'pocket' && !ids.includes(e.ball)) ids.push(e.ball);
        }
        l = legacy.resolveShot(ids, ids.includes(0));
        r = nineBall.resolveShot(s, seat, events, FINAL, { ...SHOT, pushOut });
      }
      const detail = `shot ${shots} (seat ${seat}): legacy ${JSON.stringify(l)} vs modes ${JSON.stringify({ ...r, state: undefined })}`;
      if (l.gameOver) {
        assert.equal(r.winnerTeam, l.winner - 1, detail);
      } else {
        assert.equal(r.winnerTeam, null, detail);
        assert.equal(r.nextSeat, l.nextPlayer - 1, detail);
        assert.equal(r.fouls.length > 0, !!l.foul, detail);
        assert.equal(!!r.ballInHand, !!l.ballInHand, detail);
        assert.equal(r.respot.includes(9), !!l.respotNineBall, detail);
      }
      assert.deepEqual([...r.state.pocketed].sort((a, b) => a - b), [...legacy.pocketedBalls].sort((a: number, b: number) => a - b), detail);
      assert.deepEqual(r.state.fouls, [legacy.player1ConsecutiveFouls, legacy.player2ConsecutiveFouls], detail);
      assert.equal(r.state.pushOut.available, legacy.pushOutAvailable, detail);
      assert.equal(r.state.pushOut.pending, legacy.pushOutPending, detail);
      if (legacy.pushOutPending) assert.equal(r.state.pushOut.seat, legacy.pushOutPlayer - 1, detail);
      assert.equal(r.state.breakShot, legacy.breakShot, detail);
      s = r.state;
    }
  }
});
