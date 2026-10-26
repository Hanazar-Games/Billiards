// The authoritative "billiards" match (spec §7.2–7.5, F4-A): the lobby fills,
// the match starts, messages come in and the room ends. The game itself lives in
// game/; this handler builds a GameEnv on every call and wires the pieces. The
// label is JSON so rooms can be found by code (spec §7.5).
import { OP, PROTOCOL_VERSION } from '@billiards/protocol';
import { GRPC, rpcError, type Context, type Logger, type MatchHandler, type Nakama } from './nakama.ts';
import { handleMessage } from './game/intake.ts';
import { sendJson } from './game/send.ts';
import { handleJoin, handleLeave } from './game/seats.ts';
import { SECONDS, TICK_RATE, createGameState, matchLabel, presenceList, seatOf } from './game/state.ts';
import type { GameEnv, GameState } from './game/state.ts';

/** Lobby ends: a public lobby nobody fills in time is aborted; any room ends once empty for long enough. */
function roomEnded(env: GameEnv, state: GameState, tick: number): boolean {
  if (state.phase === 'LOBBY' && !state.private && tick - state.createdTick >= SECONDS.fill * TICK_RATE) {
    // F4-03 moves this into endMatch.
    state.phase = 'ENDED';
    state.end = { winnerTeam: null, reason: 'ABORTED', summary: { turns: 0, shots: 0 } };
    sendJson(env.dispatcher, OP.MATCH_END, state.end);
    return true;
  }
  if (presenceList(state).length > 0) {
    state.emptyTicks = 0;
    return false;
  }
  state.emptyTicks++;
  return state.emptyTicks >= SECONDS.empty * TICK_RATE;
}

export const billiardsMatch: MatchHandler<GameState> = {
  matchInit(_ctx, _logger, _nk, params) {
    const state = createGameState(params);
    return { state, tickRate: TICK_RATE, label: matchLabel(state) };
  },

  matchJoinAttempt(_ctx, _logger, _nk, _dispatcher, _tick, state, presence, metadata) {
    if (Number(metadata?.protocolVersion) !== PROTOCOL_VERSION) return { state, accept: false, rejectMessage: 'PROTOCOL_MISMATCH' };
    if (state.phase === 'ENDED') return { state, accept: false, rejectMessage: 'MATCH_ENDED' };
    // Once started, only the match's players come back; in the lobby, a seated player may join again
    // (a new connection replaces the old one).
    const known = state.match ? seatOf(state, presence.userId) !== null : Boolean(state.presences[presence.userId]);
    if (!known && (state.match || presenceList(state).length >= state.seats)) return { state, accept: false, rejectMessage: 'ROOM_FULL' };
    return { state, accept: true };
  },

  matchJoin(ctx, logger, nk, dispatcher, tick, state, presences) {
    state.emptyTicks = 0;
    handleJoin({ ctx, logger, nk, dispatcher }, state, presences, tick);
    return { state };
  },

  matchLeave(ctx, logger, nk, dispatcher, tick, state, presences) {
    const env: GameEnv = { ctx, logger, nk, dispatcher };
    for (const presence of presences) handleLeave(env, state, presence, tick);
    return { state };
  },

  matchLoop(ctx, logger, nk, dispatcher, tick, state, messages) {
    const env: GameEnv = { ctx, logger, nk, dispatcher };
    // F4-03 runs the clock here, before the messages: a shot that arrives on the deadline tick is late.
    for (const message of messages) handleMessage(env, state, message, tick);
    return roomEnded(env, state, tick) ? null : { state };
  },

  matchTerminate(_ctx, _logger, _nk, _dispatcher, _tick, state) {
    return { state };
  },

  matchSignal(_ctx, _logger, _nk, _dispatcher, _tick, state) {
    return { state, data: '' };
  },
};

/**
 * Before ListMatches: refused. The label of a private room carries its code, so a
 * client listing would expose every room; rooms are found with join_by_code.
 * Live-match listing for spectators (§7.6, F7) will allow public labels only.
 */
export function beforeListMatches(_ctx: Context, _logger: Logger, _nk: Nakama, _data: unknown): never {
  throw rpcError('MATCH_LISTING_DISABLED', GRPC.PERMISSION_DENIED);
}
