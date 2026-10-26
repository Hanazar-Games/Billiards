// What the server sends (D055): match_snapshot and shot_result go in the binary
// envelope, as an ArrayBuffer of exactly its bytes; every other message is JSON text.
import { currentSeat } from '@billiards/modes';
import type { MatchState } from '@billiards/modes';
import { OP, PROTOCOL_VERSION, SIM_VERSION, encodeEnvelope } from '@billiards/protocol';
import type { SnapshotHeader } from '@billiards/protocol';
import type { MatchDispatcher, Presence } from '../nakama.ts';
import { TICK_RATE, seatOf } from './state.ts';
import type { GameState, GameTable } from './state.ts';

/** An ArrayBuffer of exactly `bytes` (the runtime sends the whole buffer). */
function arrayBufferOf(bytes: Uint8Array): ArrayBuffer {
  if (bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength) return bytes.buffer as ArrayBuffer;
  return bytes.slice().buffer as ArrayBuffer;
}

/** An envelope to everyone in the match. */
export function broadcastEnvelope(dispatcher: MatchDispatcher, op: number, header: unknown, payload?: Uint8Array): void {
  dispatcher.broadcastMessage(op, arrayBufferOf(encodeEnvelope(header, payload)), null);
}

/** JSON to `presences`, or to everyone without them. An empty list sends nothing (never everyone). */
export function sendJson(dispatcher: MatchDispatcher, op: number, body: unknown, presences?: Presence[] | null): void {
  if (presences && presences.length === 0) return;
  dispatcher.broadcastMessage(op, JSON.stringify(body), presences ?? null);
}

/** The full state as `seat` sees it at `tick`. */
export function snapshotHeader(state: GameState, seat: number | null, tick: number): SnapshotHeader<MatchState, GameTable> {
  const match = state.match;
  return {
    protocolVersion: PROTOCOL_VERSION,
    simVersion: SIM_VERSION,
    mode: state.mode,
    format: state.format,
    phase: state.phase,
    you: { seat },
    seats: match ? state.players.map((player, i) => ({
      seat: i, userId: player.userId, username: player.username, connected: match.seats[i].connected, timeouts: match.seats[i].timeouts,
    })) : [],
    turnId: match ? match.turnId : 0,
    match,
    table: state.table,
    turn: match && state.phase === 'AWAITING_SHOT'
      ? { seat: currentSeat(match) as number, turnId: match.turnId, deadlineInMs: Math.max(0, state.deadlineTick - tick) * (1000 / TICK_RATE) }
      : null,
    playback: null,
    end: state.end,
  };
}

/** One match_snapshot per presence, each with that presence's seat. */
export function sendSnapshot(dispatcher: MatchDispatcher, state: GameState, presences: Presence[], tick: number): void {
  for (const presence of presences) {
    const header = snapshotHeader(state, seatOf(state, presence.userId), tick);
    dispatcher.broadcastMessage(OP.MATCH_SNAPSHOT, arrayBufferOf(encodeEnvelope(header)), [presence]);
  }
}
