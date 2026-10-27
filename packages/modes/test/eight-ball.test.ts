// 8-ball in packages/modes: the 8-ball tests ported from apps/client/test/rules.test.js
// (names kept), new tests, and a differential test against the frozen legacy Rules.js (D046).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eightBall, shotFacts, type EightBallState, type Ruling, type SimEvent } from '../src/index.ts';
import { ev, mulberry32, config8, FINAL, SHOT } from './helpers.ts';
// @ts-ignore frozen legacy JavaScript, not type-checked
import { Rules } from './legacy/game/Rules.js';

const fresh = () => eightBall.createInitialState(config8, mulberry32(1));
const codes = (r: Ruling<EightBallState>) => [...r.fouls, ...r.messages.map((m) => m.code)];
const SOLIDS = [1, 2, 3, 4, 5, 6, 7];

// ── Ported from rules.test.js ──

test('scratch on normal shot', () => {
  const s = { ...fresh(), breakShot: false, groups: ['solid', null] as EightBallState['groups'] };
  const r = eightBall.resolveShot(s, 0, ev({ first: 1, cue: true }), FINAL, SHOT);
  assert.ok(r.fouls.length > 0);
  assert.ok(r.fouls.includes('SCRATCH'));
  assert.equal(r.ballInHand?.seat, r.nextSeat);
  assert.ok(codes(r).includes('SCRATCH'));
  assert.equal(r.nextSeat, 1);
});

test('early eight = loss', () => {
  const s = { ...fresh(), breakShot: false, groups: ['solid', null] as EightBallState['groups'], pocketed: SOLIDS.slice(0, 6) };
  const r = eightBall.resolveShot(s, 0, ev({ first: 8, pocketed: [8] }), FINAL, SHOT);
  assert.equal(r.winnerTeam, 1);
  assert.ok(r.fouls.length > 0);
  assert.ok(codes(r).includes('EARLY_EIGHT'));
});

test('8-ball on break is respotted', () => {
  const r = eightBall.resolveShot(fresh(), 0, ev({ first: 1, pocketed: [8] }), FINAL, SHOT);
  assert.equal(r.fouls.length, 0);
  assert.ok(r.respot.includes(8));
  assert.ok(codes(r).includes('EIGHT_ON_BREAK_RESPOT'));
  assert.equal(r.nextSeat, 0);
});

test('legal 8-ball win', () => {
  const s = { ...fresh(), breakShot: false, groups: ['solid', null] as EightBallState['groups'], pocketed: SOLIDS };
  const r = eightBall.resolveShot(s, 0, ev({ first: 8, pocketed: [8] }), FINAL, SHOT);
  assert.equal(r.winnerTeam, 0);
  assert.ok(codes(r).includes('LEGAL_EIGHT_WIN'));
});

test('serializer round-trips 8-ball state', () => {
  const s = { ...fresh(), breakShot: false, groups: ['solid', 'stripe'] as EightBallState['groups'], pocketed: [1, 2, 3, 9, 10] };
  const copy = JSON.parse(JSON.stringify(s));
  assert.deepEqual(copy, s);
  const events = ev({ first: 4, cushions: [4], pocketed: [4] });
  assert.deepEqual(eightBall.resolveShot(copy, 0, events, FINAL, SHOT), eightBall.resolveShot(s, 0, events, FINAL, SHOT));
});

// ── New ──

test('fatos: tabela antes do primeiro contato não conta como "depois do contato"', () => {
  assert.equal(shotFacts(ev({ first: 1, cushionsBeforeFirst: [0] })).railAfterFirstHit, false);
  assert.equal(shotFacts(ev({ first: 1, cushions: [0] })).railAfterFirstHit, true);
  assert.deepEqual(shotFacts(ev({ first: 3, cushions: [0, 5, 5, 6], pocketed: [3, 3], cue: true })),
    { firstHit: 3, railAfterFirstHit: true, breakRailBalls: [5, 6], pocketed: [3], cuePocketed: true });
});

test('2×2: o grupo é da equipe e a bola na mão vai para o próximo lugar da ordem', () => {
  let s: EightBallState = { ...eightBall.createInitialState({ ...config8, format: { kind: '2v2' } }, mulberry32(1)), breakShot: false };
  s = { ...s, groups: ['solid', 'stripe'] };
  let r = eightBall.resolveShot(s, 0, ev({ first: 1, cue: true }), FINAL, SHOT);         // A1 scratches
  assert.equal(r.nextSeat, 1);
  assert.deepEqual(r.ballInHand, { seat: 1, zone: 'anywhere' });
  r = eightBall.resolveShot(r.state, 1, ev({ first: 9, cushions: [9], pocketed: [9] }), FINAL, { ...SHOT, cueBall: { x: 0, z: -100 } });   // B1 pockets a stripe
  assert.equal(r.nextSeat, 1);
  r = eightBall.resolveShot(r.state, 1, ev({ first: 10, cushions: [10] }), FINAL, SHOT);  // B1 misses
  assert.equal(r.nextSeat, 2);
  assert.deepEqual(r.state.groups, ['solid', 'stripe']);
});

test('rackLayout repete a arrumação de hoje', () => {
  const layout = eightBall.rackLayout(fresh());
  const d = 2.8575 * 2.02;
  const at = (id: number) => layout.find((b) => b.id === id);
  assert.equal(layout.length, 16);
  const foot = 254 / 2 * 0.55;   // BallsManager: halfD * 0.55
  assert.deepEqual(at(0), { id: 0, x: 0, z: -foot });
  assert.deepEqual(at(1), { id: 1, x: 0, z: foot });
  assert.deepEqual(at(15), { id: 15, x: 2 * d, z: foot + 4 * d * Math.sin(Math.PI / 3) });
});

test('validateShot recusa bola na mão fora da cozinha', () => {
  const s: EightBallState = { ...fresh(), breakShot: false, ballInHand: { seat: 0, zone: 'kitchen' } };
  assert.deepEqual(eightBall.validateShot(s, 0, { ...SHOT, cueBall: { x: 0, z: 0 } }), { ok: false, reason: 'CUE_BALL_OUTSIDE_KITCHEN' });
  assert.deepEqual(eightBall.validateShot(s, 0, { ...SHOT, cueBall: { x: 0, z: -100 } }), { ok: true });
  // The line itself is in the kitchen, also as the server quantizes it (−69.85 is 1e-14 above −254 / 2 · 0.55).
  assert.deepEqual(eightBall.validateShot(s, 0, { ...SHOT, cueBall: { x: 0, z: -254 / 2 * 0.55 } }), { ok: true });
  assert.deepEqual(eightBall.validateShot(s, 0, { ...SHOT, cueBall: { x: 0, z: -69.85 } }), { ok: true });
  assert.deepEqual(eightBall.validateShot(s, 0, { ...SHOT, cueBall: { x: 0, z: -69.84 } }), { ok: false, reason: 'CUE_BALL_OUTSIDE_KITCHEN' });
  assert.deepEqual(eightBall.validateShot(s, 1, SHOT), { ok: false, reason: 'NOT_YOUR_TURN' });
  assert.deepEqual(eightBall.validateShot(fresh(), 0, { ...SHOT, cueBall: { x: 0, z: -100 } }), { ok: false, reason: 'CUE_BALL_NOT_ALLOWED' });
  assert.deepEqual(eightBall.validateShot(fresh(), 0, { ...SHOT, pushOut: true }), { ok: false, reason: 'PUSH_OUT_UNAVAILABLE' });
  assert.deepEqual(eightBall.validateShot(fresh(), 0, { ...SHOT, power: 111 }), { ok: false, reason: 'BAD_INPUT' });
});

test('tempo esgotado é falta com bola na mão e não gasta a abertura', () => {
  const r = eightBall.resolveTimeout(fresh(), 0);
  assert.deepEqual(r.fouls, ['TIMEOUT']);
  assert.equal(r.nextSeat, 1);
  assert.deepEqual(r.ballInHand, { seat: 1, zone: 'anywhere' });
  assert.equal(r.state.breakShot, true);
});

test('diferencial: 3000 tacadas aleatórias decidem como o Rules.js congelado', () => {
  const rng = mulberry32(42);
  const chance = (p: number) => rng() < p;
  const pick = <T>(xs: T[]): T => xs[Math.floor(rng() * xs.length)];
  let shots = 0;
  while (shots < 3000) {
    const legacy = new Rules();
    let s = fresh();
    for (let n = 0; n < 60 && s.winnerTeam === null && shots < 3000; n++, shots++) {
      const seat = s.turn.currentSeat;
      const where = `shot ${shots} (seat ${seat})`;
      let r: Ruling<EightBallState>;
      let l: any;
      if (chance(0.1)) {
        // Game._onTurnTimerExpired (apps/client/src/game/Game.js:1476-1495) on the legacy rules.
        legacy.startShot(seat + 1);
        legacy.foul = true;
        legacy.foulReason = 'TIMEOUT';
        l = { nextPlayer: seat === 0 ? 2 : 1, foul: true, scratch: false, ballInHand: true, reasonCode: 'TIMEOUT' };
        r = eightBall.resolveTimeout(s, seat);
      } else {
        const onTable = [...Array(15).keys()].map((i) => i + 1).filter((id) => !s.pocketed.includes(id));
        const first = chance(0.05) ? null : pick(onTable);
        const before: number[] = []; const after: number[] = [];
        for (let k = Math.floor(rng() * 5); k > 0; k--) (first !== null && chance(0.6) ? after : before).push(pick([0, ...onTable]));
        const pocketed = [...new Set(Array.from({ length: Math.floor(rng() * 4) }, () => pick(onTable.filter((id) => id !== 8))))];
        if (chance(0.08)) pocketed.push(8);
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
        r = eightBall.resolveShot(s, seat, events, FINAL, SHOT);
      }
      const detail = `${where}: legacy ${JSON.stringify(l)} vs modes ${JSON.stringify({ ...r, state: undefined })}`;
      if (l.gameOver) {
        assert.equal(r.winnerTeam, l.winner - 1, detail);
      } else {
        assert.equal(r.winnerTeam, null, detail);
        assert.equal(r.nextSeat, l.nextPlayer - 1, detail);
        assert.equal(r.fouls.length > 0, !!l.foul, detail);
        assert.equal(!!r.ballInHand, !!l.ballInHand, detail);
        assert.equal(r.ballInHand?.zone === 'kitchen', !!l.ballInHandBehindLine, detail);
        assert.equal(r.respot.includes(8), !!l.respotEightBall, detail);
      }
      assert.deepEqual(r.state.groups, [legacy.player1Group, legacy.player2Group], detail);
      assert.deepEqual([...r.state.pocketed].sort((a, b) => a - b), [...legacy.pocketedBalls].sort((a: number, b: number) => a - b), detail);
      assert.equal(r.state.breakShot, legacy.breakShot, detail);
      s = r.state;
    }
  }
});
