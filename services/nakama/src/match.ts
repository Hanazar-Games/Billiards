// The authoritative "billiards" match, in its F3 lobby form: seats, joining,
// leaving and the end of an empty room. The game itself (shots, turns, timer)
// arrives in F4. The label is JSON so rooms can be found by code (spec §7.5).
import { GRPC, rpcError, type Context, type Logger, type MatchDispatcher, type MatchHandler, type Nakama, type Presence } from './nakama.ts';

export interface LobbyState {
  mode: string;
  format: string;
  code: string;
  private: boolean;
  seats: number;
  presences: Record<string, Presence>;
  emptyTicks: number;
}

/** Ticks (1 per second) an empty room lives before it ends. */
export const EMPTY_TICKS_LIMIT = 60;

const SEATS: Record<string, number> = { '1v1': 2, '2v2': 4 };

function label(state: LobbyState): string {
  const open = Object.keys(state.presences).length < state.seats;
  return JSON.stringify({ mode: state.mode, format: state.format, code: state.code, private: state.private, open });
}

function relabel(dispatcher: MatchDispatcher, state: LobbyState): void {
  dispatcher.matchLabelUpdate(label(state));
}

export const billiardsMatch: MatchHandler<LobbyState> = {
  matchInit(_ctx, _logger, _nk, params) {
    const format = String(params.format);
    const state: LobbyState = {
      mode: String(params.mode),
      format,
      code: typeof params.code === 'string' ? params.code : '',
      private: params.private === true,
      seats: SEATS[format] ?? 2,
      presences: {},
      emptyTicks: 0,
    };
    return { state, tickRate: 1, label: label(state) };
  },

  matchJoinAttempt(_ctx, _logger, _nk, _dispatcher, _tick, state, presence) {
    // A player already seated may join again (a new connection replaces the old one).
    if (!state.presences[presence.userId] && Object.keys(state.presences).length >= state.seats) {
      return { state, accept: false, rejectMessage: 'ROOM_FULL' };
    }
    return { state, accept: true };
  },

  matchJoin(_ctx, _logger, _nk, dispatcher, _tick, state, presences) {
    for (const presence of presences) state.presences[presence.userId] = presence;
    state.emptyTicks = 0;
    relabel(dispatcher, state);
    return { state };
  },

  matchLeave(_ctx, _logger, _nk, dispatcher, _tick, state, presences) {
    // A player's newer connection keeps the seat when the older one leaves (§7.4).
    for (const presence of presences) {
      if (state.presences[presence.userId]?.sessionId === presence.sessionId) delete state.presences[presence.userId];
    }
    relabel(dispatcher, state);
    return { state };
  },

  matchLoop(_ctx, _logger, _nk, _dispatcher, _tick, state) {
    if (Object.keys(state.presences).length > 0) {
      state.emptyTicks = 0;
      return { state };
    }
    state.emptyTicks++;
    return state.emptyTicks >= EMPTY_TICKS_LIMIT ? null : { state };
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
