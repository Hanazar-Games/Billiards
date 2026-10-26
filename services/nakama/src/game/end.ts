// The end of a match (spec §7.4, §9.1): a concession, the phase, the result and
// match_end to everyone, and the match's record in match_history. The record is
// written once, with version '*' (create only), for every ending but ABORTED.
import { removeMatchSeat } from '@billiards/modes';
import type { MatchState } from '@billiards/modes';
import { OP, PROTOCOL_VERSION, SIM_VERSION } from '@billiards/protocol';
import type { MatchEnd } from '@billiards/protocol';
import { sendJson } from './send.ts';
import { modeOf } from './state.ts';
import type { GameEnv, GameState } from './state.ts';

/** The owner of the records the server writes for itself. */
export const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Ends the match: the phase, the result, match_end to everyone and, but for an
 * abort, the history record. Does nothing if the match already ended. Also ends
 * a lobby that never started (no match: no turns, no shots).
 */
export function endMatch(env: GameEnv, state: GameState, tick: number, winnerTeam: number | null, reason: MatchEnd['reason']): void {
  if (state.phase === 'ENDED') return;
  state.phase = 'ENDED';
  state.end = { winnerTeam, reason, summary: { turns: state.match ? state.match.turnId : 0, shots: state.shots.length } };
  state.endTick = tick;
  sendJson(env.dispatcher, OP.MATCH_END, state.end);
  if (reason !== 'ABORTED') writeHistory(env, state);
}

/**
 * A player of the started match gives up (op 5, no content); the other team
 * wins. From anyone else, before the start or after the end, it does nothing.
 */
export function concede(env: GameEnv, state: GameState, seat: number, tick: number): void {
  if (state.phase !== 'AWAITING_SHOT' || !state.match) return;
  state.match = removeMatchSeat(state.match, modeOf(state), seat);
  endMatch(env, state, tick, state.match.mode.winnerTeam, 'CONCEDE');
}

/**
 * The match's record in match_history, owned by the system, public to read and
 * written only by the server. Version '*' makes Nakama refuse to replace a record
 * that exists; that, like any failed write, is logged and the match goes on.
 */
export function writeHistory(env: GameEnv, state: GameState): void {
  if (state.historyWritten) return;
  state.historyWritten = true;
  const match = state.match as MatchState;
  const end = state.end as MatchEnd;
  const matchId = env.ctx.matchId as string;
  const value = {
    matchId,
    mode: state.mode,
    format: state.format,
    private: state.private,
    players: state.players.map((player, seat) => ({
      seat, team: match.mode.turn.seats[seat].team, userId: player.userId, username: player.username,
    })),
    firstSeat: state.firstSeat,
    rack: 'fixed',
    simVersion: SIM_VERSION,
    protocolVersion: PROTOCOL_VERSION,
    shots: state.shots,
    winnerTeam: end.winnerTeam,
    reason: end.reason,
    turns: match.turnId,
    startedAt: state.startedAt,
    endedAt: Date.now(),
  };
  try {
    env.nk.storageWrite([{ collection: 'match_history', key: matchId, userId: SYSTEM_USER_ID, value, version: '*', permissionRead: 2, permissionWrite: 0 }]);
  } catch (err) {
    env.logger.warn('match history not written: matchId=%v error=%v', matchId, String(err));
  }
}
