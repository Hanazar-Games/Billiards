// Messages from the clients (D055, spec §6.2): the per-connection rate limit,
// the sender, reading, the relays of the aim and the ball in hand, and the
// refusals of a shot_request. More than LIMITS.invalidShots refusals within
// LIMITS.invalidWindowSeconds remove the connection (spec §9).
import { currentSeat, isCueBallPlacementValid } from '@billiards/modes';
import { OP, parseAimUpdate, parseBallInHandMove, parseShotRequest, quantizeShot } from '@billiards/protocol';
import type { ShotRequest } from '@billiards/protocol';
import type { MatchMessage, Presence } from '../nakama.ts';
import { sendJson, sendSnapshot } from './send.ts';
import { LIMITS, TICK_RATE, modeOf, presenceList, seatOf } from './state.ts';
import type { GameEnv, GameState } from './state.ts';

/** The largest seq the reader accepts (a 31-bit counter). */
const MAX_SEQ = 2147483647;

export function handleMessage(env: GameEnv, state: GameState, message: MatchMessage, tick: number): void {
  const sender = message.sender;
  if (!withinRate(state, sender.sessionId, message.opCode, tick)) return;
  const seat = seatOf(state, sender.userId);
  const current = state.presences[sender.userId];
  if (seat === null || !current || current.sessionId !== sender.sessionId) return;

  let raw: unknown;
  try {
    raw = JSON.parse(env.nk.binaryToString(message.data));
  } catch {
    reject(env, state, sender, null, 'BAD_MESSAGE', tick);
    return;
  }

  switch (message.opCode) {
    case OP.AIM_UPDATE:
      relay(env, state, sender, seat, OP.AIM_RELAY, parseAimUpdate(raw));
      return;
    case OP.BALL_IN_HAND_MOVE:
      relay(env, state, sender, seat, OP.BALL_IN_HAND_RELAY, parseBallInHandMove(raw));
      return;
    case OP.SHOT_REQUEST:
      handleShotRequest(env, state, sender, raw, tick);
      return;
    default:
      // emote (4) and rematch_vote (6) are reserved; concede (5) and push_out_choice (7) arrive with F4-06 and F4-03.
      sendJson(env.dispatcher, OP.ERROR, { code: 'UNSUPPORTED_OP' }, [sender]);
  }
}

/**
 * Counts the message in the sender's current second: aim_update and
 * ball_in_hand_move share one budget, every other message another. Over budget,
 * the message is dropped without an answer.
 */
function withinRate(state: GameState, sessionId: string, op: number, tick: number): boolean {
  const second = Math.floor(tick / TICK_RATE);
  let rate = state.rate[sessionId];
  if (!rate || rate.second !== second) rate = state.rate[sessionId] = { second, relay: 0, other: 0 };
  if (op === OP.AIM_UPDATE || op === OP.BALL_IN_HAND_MOVE) return ++rate.relay <= LIMITS.relayPerSecond;
  return ++rate.other <= LIMITS.otherPerSecond;
}

/** The seat to play's aim or ball in hand, for its current turn, goes to the others with its seat; anything else is dropped. */
function relay(env: GameEnv, state: GameState, sender: Presence, seat: number, op: number, body: { turnId: number } | null): void {
  const match = state.match;
  if (!body || !match || state.phase !== 'AWAITING_SHOT' || seat !== currentSeat(match) || body.turnId !== match.turnId) return;
  const others = presenceList(state).filter((p) => p.userId !== sender.userId);
  sendJson(env.dispatcher, op, Object.assign({ seat }, body), others);
}

/** The refusals, in order; a shot that passes them all is accepted. */
export function handleShotRequest(env: GameEnv, state: GameState, presence: Presence, raw: unknown, tick: number): void {
  const request = parseShotRequest(raw);
  if (!request) return reject(env, state, presence, seqOf(raw), 'BAD_MESSAGE', tick);
  const seat = seatOf(state, presence.userId) as number;

  // A resend of the shot already accepted (a lost acknowledgment): the sender gets the state again.
  const last = state.lastAccepted[seat];
  if (last && last.turnId === request.turnId && last.seq === request.seq) {
    sendSnapshot(env.dispatcher, state, [presence], tick);
    return;
  }

  const match = state.match;
  if (!match || state.phase !== 'AWAITING_SHOT') return reject(env, state, presence, request.seq, 'NOT_AWAITING_SHOT', tick);
  if (seat !== currentSeat(match)) return reject(env, state, presence, request.seq, 'NOT_YOUR_TURN', tick);
  if (request.turnId !== match.turnId) {
    // D058: the snapshot gives the client the current turn id, so it can send the shot again.
    reject(env, state, presence, request.seq, 'TURN_MISMATCH', tick);
    sendSnapshot(env.dispatcher, state, [presence], tick);
    return;
  }

  const shot = quantizeShot(shotOf(request));
  const validation = modeOf(state).validateShot(match.mode, seat, shot);
  if (!validation.ok) return reject(env, state, presence, request.seq, validation.reason, tick);
  if (shot.cueBall && !isCueBallPlacementValid(state.table!, shot.cueBall, match.mode.config.table)) {
    return reject(env, state, presence, request.seq, 'CUE_BALL_INVALID', tick);
  }
  acceptShot(env, state, seat, shot, request.seq, tick);
}

/**
 * The shot passed every check. F4-03 (Task 5) fills this in: record the
 * request, shot_accepted, the sim, the rules and shot_result.
 */
function acceptShot(_env: GameEnv, _state: GameState, _seat: number, _shot: ShotRequest, _seq: number, _tick: number): void {}

/** The shot alone: no turnId, seq or unknown fields. */
function shotOf(request: ShotRequest): ShotRequest {
  const shot: ShotRequest = { angle: request.angle, power: request.power, spin: request.spin };
  if (request.cueBall) shot.cueBall = request.cueBall;
  if (request.pushOut !== undefined) shot.pushOut = request.pushOut;
  return shot;
}

/** The seq of a request the reader refused, when it has a usable one. */
function seqOf(raw: unknown): number | null {
  const seq = typeof raw === 'object' && raw !== null ? (raw as { seq?: unknown }).seq : undefined;
  return typeof seq === 'number' && Number.isInteger(seq) && seq >= 0 && seq <= MAX_SEQ ? seq : null;
}

/** shot_rejected to the sender, counted as an invalid shot. */
function reject(env: GameEnv, state: GameState, presence: Presence, seq: number | null, reason: string, tick: number): void {
  sendJson(env.dispatcher, OP.SHOT_REJECTED, { seq, reason }, [presence]);
  const window = LIMITS.invalidWindowSeconds * TICK_RATE;
  const recent = (state.invalid[presence.userId] || []).filter((at) => at > tick - window);
  recent.push(tick);
  if (recent.length > LIMITS.invalidShots) {
    env.dispatcher.matchKick([presence]);
    delete state.invalid[presence.userId];
  } else {
    state.invalid[presence.userId] = recent;
  }
}
