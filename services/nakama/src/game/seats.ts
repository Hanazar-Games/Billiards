// Seats (spec §7.4): the match starts when the seats fill, and a player who
// leaves is marked disconnected. The reconnection reserve, the second tab and
// the walkover arrive with F4-04 and F4-05.
import { createMatch, rackTable } from '@billiards/modes';
import { OP } from '@billiards/protocol';
import type { Presence } from '../nakama.ts';
import { sendJson, sendSnapshot } from './send.ts';
import { ONLINE_TABLE, SECONDS, TICK_RATE, matchLabel, modeOf, onlineConfig, presenceList, seatOf } from './state.ts';
import type { GameEnv, GameState } from './state.ts';

/** Seats in join order; the server draws who breaks, racks the table and sends each presence its snapshot. */
export function startGame(env: GameEnv, state: GameState, tick: number): void {
  state.players = Object.keys(state.presences).slice(0, state.seats)
    .map((userId) => ({ userId, username: state.presences[userId].username }));
  state.firstSeat = Math.floor(Math.random() * 2);
  const mode = modeOf(state);
  const match = createMatch(mode, onlineConfig(), Math.random, state.firstSeat);
  state.players.forEach((player, seat) => { match.seats[seat].userId = player.userId; });
  state.match = match;
  state.table = rackTable(mode.rackLayout(match.mode), ONLINE_TABLE);
  state.phase = 'AWAITING_SHOT';
  state.deadlineTick = tick + SECONDS.turn * TICK_RATE;
  env.dispatcher.matchLabelUpdate(matchLabel(state));
  sendSnapshot(env.dispatcher, state, presenceList(state), tick);
}

/**
 * A connection left. Only the player's current connection counts: a newer one
 * keeps the seat. In the lobby the seat frees up; in a match the seat is kept,
 * marked disconnected, and the others are told.
 */
export function handleLeave(env: GameEnv, state: GameState, presence: Presence, tick: number): void {
  delete state.rate[presence.sessionId];
  const current = state.presences[presence.userId];
  if (!current || current.sessionId !== presence.sessionId) return;
  delete state.presences[presence.userId];
  if (!state.match) {
    env.dispatcher.matchLabelUpdate(matchLabel(state));
    return;
  }
  const seat = seatOf(state, presence.userId);
  if (seat === null || state.phase === 'ENDED') return;
  state.match.seats[seat].connected = false;
  state.disconnectedAt[seat] = tick;
  sendJson(env.dispatcher, OP.SEAT_UPDATE, { seat, connected: false }, presenceList(state));
}
