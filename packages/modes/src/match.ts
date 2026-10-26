// Match state (spec §7.2, D045): connections, turn id and phase. Seats, teams
// and the seat to play live in the mode state (`mode.turn`), the single source
// of the turn order.
import type { GameMode, MatchConfig, ModeStateBase, Rng, Ruling } from './types.ts';

export interface SeatSlot { index: number; userId: string | null; connected: boolean; timeouts: number }

export type MatchPhase = 'LOBBY' | 'AWAITING_SHOT' | 'SIMULATING' | 'PLAYBACK' | 'ENDED';

export interface MatchState<S extends ModeStateBase = ModeStateBase> {
  seats: SeatSlot[];
  turnId: number;
  phase: MatchPhase;
  mode: S;
}

/** A new match on its break; seats start empty (offline) and connected. */
export function createMatch<S extends ModeStateBase>(mode: GameMode<S>, cfg: MatchConfig, rng: Rng, firstSeat = 0): MatchState<S> {
  const state = mode.createInitialState(cfg, rng, firstSeat);
  return {
    seats: state.turn.seats.map((seat) => ({ index: seat.index, userId: null, connected: true, timeouts: 0 })),
    turnId: 0,
    phase: 'AWAITING_SHOT',
    mode: state,
  };
}

/** Takes the mode state the ruling carries; a winner ends the match. */
export function applyRuling<S extends ModeStateBase>(match: MatchState<S>, ruling: Ruling<S>): MatchState<S> {
  return {
    seats: match.seats.map((seat) => ({ ...seat })),
    turnId: match.turnId + 1,
    phase: ruling.winnerTeam !== null ? 'ENDED' : 'AWAITING_SHOT',
    mode: ruling.state,
  };
}

/**
 * A seat leaves (concession or abandonment, §7.4); the last team standing wins.
 * The turn id advances (D058), so no shot request sent before is accepted.
 */
export function removeMatchSeat<S extends ModeStateBase>(match: MatchState<S>, mode: GameMode<S>, seat: number): MatchState<S> {
  const state = mode.onSeatRemoved(match.mode, seat);
  return {
    ...match,
    seats: match.seats.map((s) => ({ ...s })),
    turnId: match.turnId + 1,
    phase: state.winnerTeam !== null ? 'ENDED' : match.phase,
    mode: state,
  };
}

/** The seat to play, or null once the match ended. */
export function currentSeat(match: MatchState): number | null {
  return match.phase === 'ENDED' ? null : match.mode.turn.currentSeat;
}
