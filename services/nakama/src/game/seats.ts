// Seats (spec §7.4): players join, the match starts when the seats fill, a
// player who leaves is marked disconnected and keeps the seat for
// SECONDS.reconnect, and comes back (or opens a second tab) with a new
// connection that replaces the old one. A seat whose reserve runs out loses by
// walkover; with every other seat away too, the match ends without a winner.
import { createMatch, rackTable, removeMatchSeat } from '@billiards/modes';
import type { MatchState } from '@billiards/modes';
import { OP } from '@billiards/protocol';
import type { Presence } from '../nakama.ts';
import { endMatch } from './end.ts';
import { sendJson, sendRejoinSnapshot, sendSnapshot } from './send.ts';
import { ONLINE_TABLE, SECONDS, TICK_RATE, matchLabel, modeOf, onlineConfig, presenceList, seatOf } from './state.ts';
import type { GameEnv, GameState } from './state.ts';

const RESERVE_TICKS = SECONDS.reconnect * TICK_RATE;

/**
 * New connections. Once the match started, each is a player coming back
 * (handleRejoin). In the lobby a connection replaces the player's older one (a
 * second tab), which is removed like in a rejoin; a new player takes the next
 * seat in join order, and the match starts once the seats fill.
 */
export function handleJoin(env: GameEnv, state: GameState, presences: Presence[], tick: number): void {
  if (state.match) {
    for (const presence of presences) handleRejoin(env, state, presence, tick);
    return;
  }
  for (const presence of presences) {
    // The old connection's leave then comes from another session and is ignored (handleLeave).
    const old = state.presences[presence.userId];
    if (old && old.sessionId !== presence.sessionId) env.dispatcher.matchKick([old]);
    state.presences[presence.userId] = presence;
    if (state.joinOrder.indexOf(presence.userId) < 0) {
      // A copy first: the stored array comes back from the runtime as a Go slice.
      const order = state.joinOrder.slice();
      order.push(presence.userId);
      state.joinOrder = order;
    }
  }
  if (presenceList(state).length >= state.seats) startGame(env, state, tick);
  else env.dispatcher.matchLabelUpdate(matchLabel(state));
}

/** Seats in join order; the server draws who breaks, racks the table and sends each presence its snapshot. */
export function startGame(env: GameEnv, state: GameState, tick: number): void {
  state.players = state.joinOrder.slice(0, state.seats)
    .map((userId) => ({ userId, username: state.presences[userId].username }));
  state.firstSeat = Math.floor(Math.random() * 2);
  const mode = modeOf(state);
  const match = createMatch(mode, onlineConfig(), Math.random, state.firstSeat);
  state.players.forEach((player, seat) => { match.seats[seat].userId = player.userId; });
  state.match = match;
  state.table = rackTable(mode.rackLayout(match.mode), ONLINE_TABLE);
  state.phase = 'AWAITING_SHOT';
  state.startedAt = Date.now();
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
    state.joinOrder = state.joinOrder.filter((userId) => userId !== presence.userId);
    env.dispatcher.matchLabelUpdate(matchLabel(state));
    return;
  }
  const seat = seatOf(state, presence.userId);
  if (seat === null || state.phase === 'ENDED') return;
  state.match.seats[seat].connected = false;
  state.disconnectedAt[seat] = tick;
  sendJson(env.dispatcher, OP.SEAT_UPDATE, { seat, connected: false }, presenceList(state));
}

/**
 * A player of the started match connects again (matchJoinAttempt admits only
 * them). A connection of theirs still in the match (a second tab) is removed;
 * its leave then comes from another session and is ignored. The new connection
 * takes the seat back and gets the snapshot, with the shot still playing if
 * any, and the others are told.
 */
export function handleRejoin(env: GameEnv, state: GameState, presence: Presence, tick: number): void {
  const seat = seatOf(state, presence.userId);
  if (seat === null) return;
  const old = state.presences[presence.userId];
  if (old && old.sessionId !== presence.sessionId) env.dispatcher.matchKick([old]);
  state.presences[presence.userId] = presence;
  (state.match as MatchState).seats[seat].connected = true;
  delete state.disconnectedAt[seat];
  sendRejoinSnapshot(env.dispatcher, state, presence, tick);
  const others = presenceList(state).filter((p) => p.userId !== presence.userId);
  sendJson(env.dispatcher, OP.SEAT_UPDATE, { seat, connected: true }, others);
}

/**
 * The reconnection reserves, in seat index order, while the match is played (a
 * turn that ran out on this tick may have just ended it). The first seat away
 * for RESERVE_TICKS ends the match: it loses by walkover, or, with every other
 * seat away too, the match is aborted without a winner.
 */
export function checkReserves(env: GameEnv, state: GameState, tick: number): void {
  if (state.phase !== 'AWAITING_SHOT') return;
  for (let seat = 0; seat < state.players.length; seat++) {
    const at = state.disconnectedAt[seat];
    if (at === undefined || tick - at < RESERVE_TICKS) continue;
    const match = state.match as MatchState;
    if (match.seats.every((s, i) => i === seat || !s.connected)) {
      endMatch(env, state, tick, null, 'ABORTED');
    } else {
      state.match = removeMatchSeat(match, modeOf(state), seat);
      endMatch(env, state, tick, state.match.mode.winnerTeam, 'ABANDON');
    }
    return;
  }
}
