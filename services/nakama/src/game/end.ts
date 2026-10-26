// The end of a match (spec §7.4): the phase, the result and match_end to everyone.
// F4-06 adds the guard against a second end, the history record and concession.
import { OP } from '@billiards/protocol';
import type { MatchEnd } from '@billiards/protocol';
import { sendJson } from './send.ts';
import type { GameEnv, GameState } from './state.ts';

/** Also ends a lobby that never started (no match: no turns, no shots). */
export function endMatch(env: GameEnv, state: GameState, tick: number, winnerTeam: number | null, reason: MatchEnd['reason']): void {
  state.phase = 'ENDED';
  state.end = { winnerTeam, reason, summary: { turns: state.match ? state.match.turnId : 0, shots: state.shots.length } };
  state.endTick = tick;
  sendJson(env.dispatcher, OP.MATCH_END, state.end);
}
