// Private rooms (spec §7.5): create_private_match gives a 6-character code kept
// in the match label; join_by_code finds the match by that label.
import { MODES } from '@billiards/modes';
import { generateRoomCode, parseMatchConfig, parseRoomCode } from '@billiards/protocol';
import { GRPC, rpcError, type Context, type Logger, type Nakama } from './nakama.ts';

/** Attempts at a code no open room uses before giving up. */
const CODE_ATTEMPTS = 5;

function parsePayload(payload: string): unknown {
  try {
    return JSON.parse(payload || '{}');
  } catch {
    throw rpcError('PAYLOAD_INVALID', GRPC.INVALID_ARGUMENT);
  }
}

/** Size bounds for the listing: null may reach the runtime as 0 and hide rooms with players. */
const MAX_ROOM_SIZE = 64;

function roomsWithCode(nk: Nakama, code: string) {
  return nk.matchList(10, true, null, 0, MAX_ROOM_SIZE, `+label.code:${code}`);
}

/** RPC create_private_match { mode, format } → { matchId, code }. */
export function rpcCreatePrivateMatch(_ctx: Context, _logger: Logger, nk: Nakama, payload: string): string {
  const config = parseMatchConfig(parsePayload(payload), MODES);
  if (!config) throw rpcError('MODE_INVALID', GRPC.INVALID_ARGUMENT);
  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
    const code = generateRoomCode(Math.random);
    if (roomsWithCode(nk, code).length > 0) continue;
    const matchId = nk.matchCreate('billiards', { mode: config.mode, format: config.format, code, private: true });
    return JSON.stringify({ matchId, code });
  }
  throw rpcError('ROOM_CODE_EXHAUSTED', GRPC.RESOURCE_EXHAUSTED);
}

/** RPC join_by_code { code } → { matchId } of the open room with that code. */
export function rpcJoinByCode(_ctx: Context, _logger: Logger, nk: Nakama, payload: string): string {
  const input = parsePayload(payload) as { code?: unknown } | null;
  const code = parseRoomCode(input?.code);
  if (!code) throw rpcError('CODE_INVALID', GRPC.INVALID_ARGUMENT);
  const rooms = roomsWithCode(nk, code);
  if (rooms.length === 0) throw rpcError('ROOM_NOT_FOUND', GRPC.NOT_FOUND);
  const open = rooms.find((room) => JSON.parse(room.label).open);
  if (!open) throw rpcError('ROOM_FULL', GRPC.FAILED_PRECONDITION);
  return JSON.stringify({ matchId: open.matchId });
}
