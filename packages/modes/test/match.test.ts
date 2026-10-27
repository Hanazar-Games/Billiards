// MatchState (spec §7.2) and the invariant of spec §9.3: until the end there is
// always a seat to play, it is active, and every ruling points at it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MODES, createMatch, applyRuling, removeMatchSeat, currentSeat, activeTeams, eightBall,
  type GameMode, type MatchFormat, type MatchState, type ModeStateBase, type Ruling,
} from '../src/index.ts';
import { ev, mulberry32, config8, FINAL, SHOT } from './helpers.ts';

function checkSeat(match: MatchState, where: string) {
  assert.equal(match.phase === 'ENDED', match.mode.winnerTeam !== null, where);
  if (match.phase === 'ENDED') {
    assert.equal(currentSeat(match), null, where);
    return;
  }
  const seat = currentSeat(match);
  assert.ok(seat !== null, where);
  assert.equal(match.mode.turn.seats[seat].eliminated, false, where);
  assert.ok(activeTeams(match.mode.turn).includes(match.mode.turn.seats[seat].team), where);
  assert.ok(activeTeams(match.mode.turn).length >= 2, where);
  assert.deepEqual(JSON.parse(JSON.stringify(match)), match, where);
}

test('invariante: até o fim sempre há um lugar da vez, ativo, e a decisão aponta para ele', () => {
  const cases: [string, MatchFormat, number][] = [['8ball', { kind: '1v1' }, 15], ['8ball', { kind: '2v2' }, 15], ['9ball', { kind: '1v1' }, 9]];
  for (const [id, format, balls] of cases) {
    const mode = MODES[id as keyof typeof MODES] as unknown as GameMode<ModeStateBase & { pocketed: number[]; pushOut?: { available: boolean; pending: boolean } }>;
    const rng = mulberry32(id.length * 7 + (format.kind === '2v2' ? 3 : 1));
    const chance = (p: number) => rng() < p;
    const pick = <T>(xs: T[]): T => xs[Math.floor(rng() * xs.length)];
    for (let game = 0; game < 300; game++) {
      let match = createMatch(mode, { ...config8, format }, rng) as MatchState<any>;
      for (let action = 0; action < 200 && match.phase !== 'ENDED'; action++) {
        const where = `${id} ${format.kind} game ${game} action ${action}`;
        const seat = currentSeat(match)!;
        const state = match.mode;
        let r: Ruling<any> | null = null;
        if (state.pushOut?.pending) {
          r = mode.applyChoice(state, seat, { kind: 'push_out', accept: chance(0.5) });
        } else if (chance(0.02)) {
          const active = state.turn.seats.filter((s: { eliminated: boolean }) => !s.eliminated).map((s: { index: number }) => s.index);
          match = removeMatchSeat(match, mode, pick(active));
        } else if (chance(0.1)) {
          r = mode.resolveTimeout(state, seat);
        } else {
          const onTable = Array.from({ length: balls }, (_, i) => i + 1).filter((b) => !state.pocketed.includes(b));
          const first = chance(0.05) ? null : pick(onTable);
          const cushions = Array.from({ length: Math.floor(rng() * 5) }, () => pick([0, ...onTable]));
          const pocketed = [...new Set(Array.from({ length: Math.floor(rng() * 3) }, () => pick(onTable)))];
          const pushOut = !!state.pushOut?.available && chance(0.3);
          r = mode.resolveShot(state, seat, ev({ first, cushions, pocketed, cue: chance(0.1) }), FINAL, { ...SHOT, pushOut });
        }
        if (r) {
          match = applyRuling(match, r);
          if (match.phase !== 'ENDED') {
            assert.equal(r.nextSeat, currentSeat(match), where);
            if (r.ballInHand) assert.equal(r.ballInHand.seat, r.nextSeat, where);
          } else {
            assert.equal(r.nextSeat, null, where);
          }
        }
        checkSeat(match, where);
      }
    }
  }
});

test('desistência em 1×1 dá a vitória à outra equipe e encerra a partida', () => {
  const m = removeMatchSeat(createMatch(eightBall, config8, mulberry32(1)), eightBall, 0);
  assert.equal(m.phase, 'ENDED');
  assert.equal(m.mode.winnerTeam, 1);
  assert.equal(currentSeat(m), null);
});

test('applyRuling avança o turnId e encerra com vencedor', () => {
  const m = createMatch(eightBall, config8, mulberry32(1));
  assert.deepEqual([m.turnId, m.phase, m.seats.length], [0, 'AWAITING_SHOT', 2]);
  const r = eightBall.resolveShot(m.mode, 0, ev({ first: 1, pocketed: [2] }), FINAL, SHOT);
  assert.deepEqual([applyRuling(m, r).turnId, applyRuling(m, r).phase], [1, 'AWAITING_SHOT']);
});

test('removeMatchSeat avança o turnId (D058), com a partida seguindo ou terminando', () => {
  const ends = removeMatchSeat(createMatch(eightBall, config8, mulberry32(1)), eightBall, 0);
  assert.deepEqual([ends.turnId, ends.phase], [1, 'ENDED']);
  const goesOn = removeMatchSeat(createMatch(eightBall, { ...config8, format: { kind: '2v2' } }, mulberry32(1)), eightBall, 0);
  assert.deepEqual([goesOn.turnId, goesOn.phase], [1, 'AWAITING_SHOT']);
});

test('createInitialState não depende de structuredClone (o goja não tem)', () => {
  const saved = globalThis.structuredClone;
  // @ts-expect-error removed on purpose, as in the Nakama runtime
  delete globalThis.structuredClone;
  try {
    for (const mode of Object.values(MODES)) assert.ok((mode as GameMode<ModeStateBase>).createInitialState(config8, mulberry32(1)));
  } finally {
    globalThis.structuredClone = saved;
  }
});
