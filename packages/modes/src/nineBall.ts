// 9-ball, ported from apps/client/src/game/NineBallRules.js (frozen in
// test/legacy/, D046): lowest ball first, push-out after the break and the
// three-foul loss. The push-out is declared on the shot (ShotRequest.pushOut)
// and answered with applyChoice (D045).
import { shotFacts } from './facts.ts';
import { ballInHandFor, rack, removeSeatFromState, ruling, teamOf, validateCommon } from './shared.ts';
import { createTurnState, endTurn } from './turns.ts';
import type { FoulCode, GameMode, MatchConfig, Message, ModeStateBase, Ruling, ShotRequest, SimEvent, TableState } from './types.ts';

export interface NineBallState extends ModeStateBase {
  modeId: '9ball';
  /** Balls 1–9 off the table. */
  pocketed: number[];
  /** Consecutive fouls by seat. */
  fouls: number[];
  /** `seat` is the seat that pushed out (kept after the answer, like the legacy `pushOutPlayer`). */
  pushOut: { available: boolean; pending: boolean; seat: number | null };
  threeFoulLoss: boolean;
}

/** The lowest ball on the table (the legacy `_currentTarget`). */
function target(pocketed: number[]): number {
  let ball = 1;
  while (ball <= 9 && pocketed.includes(ball)) ball++;
  return ball > 9 ? 9 : ball;
}

export function nineBallStatus(state: NineBallState): { targetBall: number } {
  return { targetBall: target(state.pocketed) };
}

/** The legacy `trackPocketedBalls`. */
function track(pocketed: number[], ids: number[]): number[] {
  const out = [...pocketed];
  for (const id of ids) if (id >= 1 && id <= 9 && !out.includes(id)) out.push(id);
  return out;
}

/**
 * The legacy `_applyConsecutiveFouls`: a foul counts for the seat, the second
 * in a row warns and the third loses; a legal shot resets the count.
 */
function settle(state: NineBallState, seat: number, next: Partial<NineBallState>, foul: FoulCode | null,
  messages: Message[], respot: number[]): Ruling<NineBallState> {
  const fouls = [...state.fouls];
  const settled: NineBallState = { ...state, ...next, fouls };
  if (!foul) {
    fouls[seat] = 0;
    return ruling(settled, [], messages, respot);
  }
  fouls[seat]++;
  if (state.threeFoulLoss && fouls[seat] >= 3) {
    const opponentTeam = teamOf(state, endTurn(state.turn).currentSeat);
    return ruling({ ...settled, ballInHand: null, winnerTeam: opponentTeam }, [foul], [{ code: 'THREE_FOUL_LOSS', params: { seat } }]);
  }
  if (state.threeFoulLoss && fouls[seat] === 2) messages = [{ code: 'THREE_FOUL_WARNING' }, ...messages];
  return ruling(settled, [foul], messages, respot);
}

const RACK_ORDER = [1, 2, 3, 4, 9, 5, 6, 7, 8];
const RACK_POSITIONS: [number, number][] = [[0, 0], [-0.5, 1], [0.5, 1], [-1, 2], [0, 2], [1, 2], [-0.5, 3], [0.5, 3], [0, 4]];

export const nineBall: GameMode<NineBallState> = {
  id: '9ball',
  formats: ['1v1'],
  tableProfiles: ['pool9ft', 'bar7ft'],

  createInitialState(cfg: MatchConfig, _rng, firstSeat = 0): NineBallState {
    if (!this.formats.includes(cfg.format.kind)) throw new RangeError(`9-ball does not support ${cfg.format.kind}`);
    const turn = createTurnState(cfg.format, firstSeat);
    return {
      modeId: '9ball', config: structuredClone(cfg), turn, breakShot: true, ballInHand: null, winnerTeam: null,
      pocketed: [], fouls: turn.seats.map(() => 0), pushOut: { available: false, pending: false, seat: null },
      threeFoulLoss: cfg.options?.threeFoulLoss ?? true,
    };
  },

  rackLayout: (state) => rack(state, RACK_ORDER, RACK_POSITIONS, 0),

  validateShot: (state, seat, shot) => validateCommon(state, seat, shot,
    { pushOutAllowed: state.pushOut.available, pushOutPending: state.pushOut.pending }),

  resolveShot(state: NineBallState, seat: number, events: SimEvent[], _final: TableState, shot: ShotRequest): Ruling<NineBallState> {
    if (state.winnerTeam !== null) return ruling(state, [], []);
    const facts = shotFacts(events);
    const isPushOut = !!shot.pushOut;
    const team = teamOf(state, seat);
    const passed = endTurn(state.turn);
    const nine = facts.pocketed.includes(9);
    // A shot spends the push-out chance (used or not) and clears a pending choice.
    const pushOut = { ...state.pushOut, available: false, pending: false };
    const handTo = (zone: 'anywhere') => ballInHandFor(passed.currentSeat, zone);

    if (state.breakShot) {
      const base = { breakShot: false, pushOut };
      const breakFoul = (reason: FoulCode) => settle(state, seat,
        { ...base, turn: passed, ballInHand: handTo('anywhere'), pocketed: track(state.pocketed.filter((id) => id !== 9), facts.pocketed.filter((id) => id !== 9)) },
        reason, [{ code: 'BREAK_FOUL', params: { reason } }], nine ? [9] : []);
      if (facts.cuePocketed) return breakFoul('SCRATCH');
      if (facts.firstHit === null) return breakFoul('NO_BALL_HIT');
      if (facts.firstHit !== 1) return breakFoul('WRONG_FIRST_HIT');
      if (nine) return settle(state, seat, { ...base, ballInHand: null, winnerTeam: team }, null, [{ code: 'NINE_ON_BREAK_WIN' }], []);
      const pocketed = track(state.pocketed, facts.pocketed);
      if (facts.pocketed.length === 0) {
        if (facts.breakRailBalls.length < 4) {
          return settle(state, seat, { ...base, turn: passed, ballInHand: handTo('anywhere'), pocketed }, 'ILLEGAL_BREAK', [{ code: 'ILLEGAL_BREAK' }], []);
        }
        return settle(state, seat, { ...base, pushOut: { ...pushOut, available: true }, turn: passed, ballInHand: null, pocketed },
          null, [{ code: 'BREAK_NO_POCKET' }], []);
      }
      return settle(state, seat, { ...base, pushOut: { ...pushOut, available: true }, ballInHand: null, pocketed },
        null, [{ code: 'BREAK_LEGAL' }], []);
    }

    let foul: FoulCode | null = facts.cuePocketed ? 'SCRATCH' : null;
    // A push-out skips the lowest-ball and rail checks; a scratch or no contact still count.
    if (!isPushOut && !facts.cuePocketed && facts.firstHit !== null && facts.firstHit !== target(state.pocketed)) foul = 'WRONG_FIRST_HIT';
    if (!facts.cuePocketed && facts.firstHit === null) foul = 'NO_BALL_HIT';
    if (!isPushOut && !foul && facts.firstHit !== null && facts.pocketed.length === 0 && !facts.railAfterFirstHit) foul = 'NO_RAIL_AFTER_CONTACT';

    if (foul) {
      // WPA: balls pocketed on a foul stay down, except the 9, which is spotted.
      const pocketed = track(state.pocketed.filter((id) => id !== 9), facts.pocketed.filter((id) => id !== 9));
      const message: Message = nine ? { code: 'NINE_ON_FOUL_RESPOT', params: { reason: foul } } : { code: 'FOUL', params: { reason: foul } };
      return settle(state, seat, { breakShot: false, pushOut, turn: passed, ballInHand: handTo('anywhere'), pocketed }, foul, [message], nine ? [9] : []);
    }

    let pocketed = track(state.pocketed, facts.pocketed);
    if (nine && !isPushOut) {
      return settle(state, seat, { breakShot: false, pushOut, ballInHand: null, winnerTeam: team, pocketed }, null, [{ code: 'LEGAL_NINE_WIN' }], []);
    }
    if (isPushOut) {
      // The 9 pocketed on a push-out is spotted (WPA).
      if (nine) pocketed = pocketed.filter((id) => id !== 9);
      return settle(state, seat, { breakShot: false, pushOut: { ...pushOut, pending: true, seat }, turn: passed, ballInHand: null, pocketed },
        null, [{ code: 'PUSH_OUT_PENDING' }], nine ? [9] : []);
    }
    if (facts.pocketed.length > 0) {
      return settle(state, seat, { breakShot: false, pushOut, ballInHand: null, pocketed }, null,
        [{ code: 'POCKETED', params: { count: facts.pocketed.length } }], []);
    }
    return settle(state, seat, { breakShot: false, pushOut, turn: passed, ballInHand: null, pocketed }, null, [{ code: 'NO_POCKET' }], []);
  },

  resolveTimeout(state, seat) {
    if (state.winnerTeam !== null) return ruling(state, [], []);
    // Game._onTurnTimerExpired: a counted foul, ball in hand for the next seat;
    // startShot cleared a pending push-out, and the push-out chance stays.
    const turn = endTurn(state.turn);
    return settle(state, seat, { turn, ballInHand: ballInHandFor(turn.currentSeat, 'anywhere'), pushOut: { ...state.pushOut, pending: false } },
      'TIMEOUT', [{ code: 'TIMEOUT', params: { seat, next: turn.currentSeat } }], []);
  },

  applyChoice(state, _seat, choice) {
    if (choice.kind !== 'push_out' || !state.pushOut.pending || state.pushOut.seat === null) throw new Error('no push-out to answer');
    // Accepting plays from where the ball stopped; passing hands the shot back to the pusher.
    const pusher = state.pushOut.seat;
    const opponent = endTurn({ ...state.turn, currentSeat: pusher }).currentSeat;
    const want = choice.accept ? opponent : pusher;
    const turn = state.turn.currentSeat === want ? state.turn : { ...endTurn(state.turn), currentSeat: want };
    return ruling({ ...state, turn, pushOut: { ...state.pushOut, pending: false } }, [],
      [{ code: choice.accept ? 'PUSH_OUT_ACCEPTED' : 'PUSH_OUT_PASSED', params: { seat: want } }]);
  },

  onSeatRemoved: (state, seat) => removeSeatFromState(state, seat),
};
