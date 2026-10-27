// 8-ball, ported from apps/client/src/game/Rules.js (frozen in test/legacy/,
// D046). "The player" is the team of the seat at the table, "the opponent" is
// the next seat in turn order, and groups belong to teams (spec §7.2).
import { shotFacts } from './facts.ts';
import { ballInHandFor, rack, removeSeatFromState, ruling, teamOf, validateCommon } from './shared.ts';
import { createTurnState, endTurn } from './turns.ts';
import type { FoulCode, GameMode, MatchConfig, Message, ModeStateBase, Ruling, ShotRequest, SimEvent, TableState } from './types.ts';

export type Group = 'solid' | 'stripe';

export interface EightBallState extends ModeStateBase {
  modeId: '8ball';
  /** By team; null while the table is open. */
  groups: (Group | null)[];
  /** Solids and stripes off the table (the legacy `pocketedBalls`). */
  pocketed: number[];
}

function kind(id: number | null): Group | 'eight' | 'cue' | null {
  if (id === 0) return 'cue';
  if (id === 8) return 'eight';
  if (id !== null && id >= 1 && id <= 7) return 'solid';
  if (id !== null && id >= 9 && id <= 15) return 'stripe';
  return null;
}

const count = (ids: number[], group: Group) => ids.filter((id) => kind(id) === group).length;

export function eightBallStatus(state: EightBallState): { groups: (Group | null)[]; remaining: number[] } {
  return { groups: [...state.groups], remaining: state.groups.map((g) => (g ? 7 - count(state.pocketed, g) : 7)) };
}

const RACK_ORDER = [1, 9, 10, 2, 8, 3, 11, 4, 5, 12, 6, 13, 7, 14, 15];
const RACK_POSITIONS: [number, number][] = [
  [0, 1], [-0.5, 2], [0.5, 2], [-1, 3], [0, 3], [1, 3],
  [-1.5, 4], [-0.5, 4], [0.5, 4], [1.5, 4],
  [-2, 5], [-1, 5], [0, 5], [1, 5], [2, 5],
];

export const eightBall: GameMode<EightBallState> = {
  id: '8ball',
  formats: ['1v1', '2v2'],
  tableProfiles: ['pool9ft', 'pool8ft', 'bar7ft', 'chinese8'],

  createInitialState(cfg: MatchConfig, _rng, firstSeat = 0): EightBallState {
    if (!this.formats.includes(cfg.format.kind)) throw new RangeError(`8-ball does not support ${cfg.format.kind}`);
    const turn = createTurnState(cfg.format, firstSeat);
    return {
      modeId: '8ball', config: JSON.parse(JSON.stringify(cfg)), turn, breakShot: true, ballInHand: null, winnerTeam: null,
      groups: turn.teams.map(() => null), pocketed: [],
    };
  },

  rackLayout: (state) => rack(state, RACK_ORDER, RACK_POSITIONS, 1),

  validateShot: (state, seat, shot) => validateCommon(state, seat, shot, { pushOutAllowed: false, pushOutPending: false }),

  resolveShot(state: EightBallState, seat: number, events: SimEvent[], _final: TableState, _shot: ShotRequest): Ruling<EightBallState> {
    if (state.winnerTeam !== null) return ruling(state, [], []);
    const facts = shotFacts(events);
    const team = teamOf(state, seat);
    const passed = endTurn(state.turn);
    const opponentTeam = teamOf(state, passed.currentSeat);
    const wasOpenTable = state.groups.every((g) => g === null);
    let currentGroup = state.groups[team];
    const clearedBeforeShot = currentGroup !== null && count(state.pocketed, currentGroup) >= 7;
    const pocketed = [...new Set([...state.pocketed, ...facts.pocketed])].filter((id) => kind(id) === 'solid' || kind(id) === 'stripe');
    let groups = [...state.groups];

    let pocketedOwn = 0;
    let pocketedEight = false;
    for (const id of facts.pocketed) {
      const k = kind(id);
      if (k === 'eight') pocketedEight = true;
      else if (k === currentGroup) pocketedOwn++;
    }

    const passTurn = (fouls: FoulCode[], messages: Message[], zone: 'anywhere' | 'kitchen' | null, respot: number[] = []) =>
      ruling({ ...state, turn: passed, breakShot: false, groups, pocketed,
        ballInHand: zone ? ballInHandFor(passed.currentSeat, zone) : null }, fouls, messages, respot);
    const keepTurn = (messages: Message[], respot: number[] = []) =>
      ruling({ ...state, breakShot: false, groups, pocketed, ballInHand: null }, [], messages, respot);
    const finish = (winner: number, fouls: FoulCode[], messages: Message[]) =>
      ruling({ ...state, breakShot: false, groups, pocketed, ballInHand: null, winnerTeam: winner }, fouls, messages);

    if (state.breakShot) {
      if (facts.cuePocketed || facts.firstHit === null) {
        const reason: FoulCode = facts.cuePocketed ? 'SCRATCH' : 'NO_BALL_HIT';
        return passTurn([reason], [{ code: 'BREAK_FOUL', params: { reason } }], 'kitchen', pocketedEight ? [8] : []);
      }
      // WPA: the 8 pocketed on the break is spotted, not a loss; the table stays open.
      if (pocketedEight) return keepTurn([{ code: 'EIGHT_ON_BREAK_RESPOT' }], [8]);
      if (facts.pocketed.length === 0 && facts.breakRailBalls.length < 4) {
        return passTurn(['ILLEGAL_BREAK'], [{ code: 'ILLEGAL_BREAK' }], 'kitchen');
      }
      if (facts.pocketed.length === 0) return passTurn([], [{ code: 'BREAK_NO_POCKET' }], null);
      return keepTurn([{ code: 'BREAK_LEGAL' }]);
    }

    let foul: FoulCode | null = facts.cuePocketed ? 'SCRATCH' : null;
    if (!facts.cuePocketed && facts.firstHit === null) foul = 'NO_BALL_HIT';
    if (!foul && facts.firstHit !== null && facts.pocketed.length === 0 && !facts.railAfterFirstHit) foul = 'NO_RAIL_AFTER_CONTACT';

    // Groups are assigned on the first legal pocket after the break; solids and
    // stripes on the same shot keep the table open (WPA).
    if (currentGroup === null && facts.pocketed.length > 0 && !foul && facts.firstHit !== null && facts.firstHit !== 8) {
      const hasSolid = facts.pocketed.some((id) => kind(id) === 'solid');
      const hasStripe = facts.pocketed.some((id) => kind(id) === 'stripe');
      if (hasSolid !== hasStripe) {
        currentGroup = hasSolid ? 'solid' : 'stripe';
        const other: Group = hasSolid ? 'stripe' : 'solid';
        groups = groups.map((_, i) => (i === team ? currentGroup : other));
        pocketedOwn = count(facts.pocketed, currentGroup);
      }
    }

    if (!facts.cuePocketed) {
      const firstKind = kind(facts.firstHit);
      // Hitting the 8 first is a foul until the group is cleared.
      if (firstKind === 'eight' && !clearedBeforeShot) foul = 'WRONG_FIRST_HIT';
      // The own group must be hit first once the table was closed before this shot.
      if (!wasOpenTable && currentGroup && firstKind !== null && firstKind !== currentGroup && firstKind !== 'eight') {
        foul = 'WRONG_FIRST_HIT';
      }
    }

    if (pocketedEight) {
      if (!clearedBeforeShot || foul) {
        return finish(opponentTeam, [...(foul ? [foul] : []), 'EARLY_EIGHT'], [{ code: 'EARLY_EIGHT' }]);
      }
      return finish(team, [], [{ code: 'LEGAL_EIGHT_WIN' }]);
    }

    if (foul) return passTurn([foul], [{ code: 'FOUL', params: { reason: foul } }], 'anywhere');
    const continueTurn = pocketedOwn > 0 || (wasOpenTable && facts.pocketed.length > 0);
    if (!continueTurn) return passTurn([], [{ code: 'NO_POCKET' }], null);
    return keepTurn([{ code: 'POCKETED', params: { count: pocketedOwn } }]);
  },

  resolveTimeout(state, seat) {
    if (state.winnerTeam !== null) return ruling(state, [], []);
    // Game._onTurnTimerExpired: a foul, ball in hand for the next seat; the break is not spent.
    const turn = endTurn(state.turn);
    return ruling({ ...state, turn, ballInHand: ballInHandFor(turn.currentSeat, 'anywhere') }, ['TIMEOUT'],
      [{ code: 'TIMEOUT', params: { seat, next: turn.currentSeat } }]);
  },

  applyChoice() {
    throw new Error('8-ball has no choices');
  },

  onSeatRemoved: (state, seat) => removeSeatFromState(state, seat),
};
