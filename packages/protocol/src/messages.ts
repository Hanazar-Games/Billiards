// Match messages of protocol v1 (D055, spec §6.2): operation codes, readers for the client
// messages, shot quantization and the types of the server headers. Runs in the Nakama runtime
// (goja) too, so it keeps no dependencies: ShotRequest is redeclared from packages/modes, and the
// match state and the table are generic parameters.

export const PROTOCOL_VERSION = 1;
export const SIM_VERSION = 1;

/** C→S operations are below 100, S→C above. 4 and 6 are reserved (UNSUPPORTED_OP) until F4-B or F5. */
export const OP = Object.freeze({
  AIM_UPDATE: 1, SHOT_REQUEST: 2, BALL_IN_HAND_MOVE: 3, EMOTE: 4, CONCEDE: 5, REMATCH_VOTE: 6, PUSH_OUT_CHOICE: 7,
  MATCH_SNAPSHOT: 101, AIM_RELAY: 102, SHOT_ACCEPTED: 103, SHOT_REJECTED: 104, SHOT_RESULT: 105,
  SEAT_UPDATE: 106, MATCH_END: 107, ERROR: 108, BALL_IN_HAND_RELAY: 109,
});

/** The server's reasons for a shot_rejected, besides the modes' RejectReason. */
export const SERVER_REJECT_REASONS = [
  'BAD_MESSAGE', 'NOT_AWAITING_SHOT', 'TURN_MISMATCH', 'NO_CHOICE_PENDING', 'CUE_BALL_INVALID',
] as const;
export type ServerRejectReason = (typeof SERVER_REJECT_REASONS)[number];

/** Same shape as ShotRequest in packages/modes. */
export interface ShotRequest {
  angle: number;
  power: number;
  spin: { x: number; y: number };
  cueBall?: { x: number; z: number };
  pushOut?: boolean;
}

// --- C→S messages ---

export interface ShotRequestMessage extends ShotRequest { turnId: number; seq: number }
export interface AimUpdateMessage { turnId: number; angle: number; spin: { x: number; y: number }; power?: number }
export interface BallInHandMoveMessage { turnId: number; x: number; z: number }
export interface PushOutChoiceMessage { turnId: number; accept: boolean }

const MAX_INT31 = 2147483647;
/** The readers reject any angle, power, spin or position above this, so quantizing never overflows to Infinity. */
export const MAX_ABS_NUMBER = 1e6;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A finite number within ±MAX_ABS_NUMBER. */
function isWireNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= MAX_ABS_NUMBER;
}

function isCounter(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_INT31;
}

function readPair<A extends string, B extends string>(value: unknown, a: A, b: B): ({ [K in A | B]: number }) | null {
  if (!isRecord(value) || !isWireNumber(value[a]) || !isWireNumber(value[b])) return null;
  return { [a]: value[a], [b]: value[b] } as { [K in A | B]: number };
}

/** Each reader returns a new object with the known fields only, or null for anything else. */
export function parseShotRequest(raw: unknown): ShotRequestMessage | null {
  if (!isRecord(raw)) return null;
  const spin = readPair(raw.spin, 'x', 'y');
  if (!isCounter(raw.turnId) || !isCounter(raw.seq) || !isWireNumber(raw.angle) || !isWireNumber(raw.power) || !spin) return null;
  const message: ShotRequestMessage = { turnId: raw.turnId, seq: raw.seq, angle: raw.angle, power: raw.power, spin };
  if (raw.cueBall !== undefined) {
    const cueBall = readPair(raw.cueBall, 'x', 'z');
    if (!cueBall) return null;
    message.cueBall = cueBall;
  }
  if (raw.pushOut !== undefined) {
    if (typeof raw.pushOut !== 'boolean') return null;
    message.pushOut = raw.pushOut;
  }
  return message;
}

export function parseAimUpdate(raw: unknown): AimUpdateMessage | null {
  if (!isRecord(raw)) return null;
  const spin = readPair(raw.spin, 'x', 'y');
  if (!isCounter(raw.turnId) || !isWireNumber(raw.angle) || !spin) return null;
  const message: AimUpdateMessage = { turnId: raw.turnId, angle: raw.angle, spin };
  if (raw.power !== undefined) {
    if (!isWireNumber(raw.power)) return null;
    message.power = raw.power;
  }
  return message;
}

export function parseBallInHandMove(raw: unknown): BallInHandMoveMessage | null {
  if (!isRecord(raw) || !isCounter(raw.turnId) || !isWireNumber(raw.x) || !isWireNumber(raw.z)) return null;
  return { turnId: raw.turnId, x: raw.x, z: raw.z };
}

export function parsePushOutChoice(raw: unknown): PushOutChoiceMessage | null {
  if (!isRecord(raw) || !isCounter(raw.turnId) || typeof raw.accept !== 'boolean') return null;
  return { turnId: raw.turnId, accept: raw.accept };
}

// --- Quantization (D055) ---

const ANGLE_SCALE = 1e5;
const POWER_SCALE = 1e3;
const POSITION_SCALE = 100;
const SPIN_SCALE = 1e3;
const SPIN_LENGTH_TOLERANCE = 1e-9; // the modes accept spins up to 1 + 1e-9
const FLOOR_SLACK = 1e-6; // against floating-point error: 0.009 / length * 1000 comes out as 8.999999999999998

/** Rounds to a multiple of 1 / scale. Dividing by the scale gives the double nearest to the step, so 12346 / 1e5 === 0.12346. */
function round(value: number, scale: number): number {
  const rounded = Math.round(value * scale) / scale;
  return rounded === 0 ? 0 : rounded; // no negative zero
}

function truncate(value: number): number {
  const magnitude = Math.floor(Math.abs(value) * SPIN_SCALE + FLOOR_SLACK) / SPIN_SCALE;
  return value < 0 && magnitude > 0 ? -magnitude : magnitude;
}

function quantizeSpin(spin: { x: number; y: number }): { x: number; y: number } {
  const x = round(spin.x, SPIN_SCALE);
  const y = round(spin.y, SPIN_SCALE);
  if (Math.hypot(x, y) <= 1 + SPIN_LENGTH_TOLERANCE) return { x, y };
  // Rounding pushed the spin out of the unit disc: scale the original to length 1 and round toward zero.
  const length = Math.hypot(spin.x, spin.y);
  return { x: truncate(spin.x / length), y: truncate(spin.y / length) };
}

/**
 * The shot the server simulates and records: angle to 1e-5 rad, power to 1e-3, cue ball to 0.01 cm
 * and each spin component to 1e-3, never above length 1. Idempotent. Expects a shot the mode has
 * already validated; other fields of `shot` are kept as they are.
 */
export function quantizeShot<T extends ShotRequest>(shot: T): T {
  const quantized: T = Object.assign({}, shot);
  quantized.angle = round(shot.angle, ANGLE_SCALE);
  quantized.power = round(shot.power, POWER_SCALE);
  quantized.spin = quantizeSpin(shot.spin);
  if (shot.cueBall) quantized.cueBall = { x: round(shot.cueBall.x, POSITION_SCALE), z: round(shot.cueBall.z, POSITION_SCALE) };
  return quantized;
}

// --- S→C headers ---
// `M` is the match state (packages/modes MatchState) and `T` the table (TableState); the server
// fills both, the protocol only carries them. Events, fouls and messages are loosely typed on
// purpose: their exact types live in packages/modes.

export type MatchPhase = 'LOBBY' | 'AWAITING_SHOT' | 'SIMULATING' | 'ENDED';

export interface SeatInfo { seat: number; userId: string; username: string; connected: boolean; timeouts: number }

export interface TurnInfo { seat: number; turnId: number; deadlineInMs: number }

export interface MatchEnd {
  winnerTeam: number | null;
  reason: 'WIN' | 'CONCEDE' | 'ABANDON' | 'ABORTED';
  summary: { turns: number; shots: number };
}

export interface ShotResultHeader<M, T> {
  kind: 'shot' | 'timeout' | 'choice';
  turnId: number;
  seq: number | null;
  seat: number;
  shot: ShotRequest | null;
  events: unknown[];
  final: T;
  table: T;
  ruling: {
    fouls: string[];
    ballInHand: unknown;
    nextSeat: number | null;
    winnerTeam: number | null;
    respot: number[];
    messages: { code: string; params?: Record<string, number | string> }[];
  };
  match: M;
  durationMs: number;
  capped: boolean;
  nextTurn: TurnInfo | null;
}

export interface SnapshotHeader<M, T> {
  protocolVersion: number;
  simVersion: number;
  mode: string;
  format: string;
  phase: MatchPhase;
  you: { seat: number | null };
  seats: SeatInfo[];
  turnId: number;
  match: M | null;
  table: T | null;
  turn: TurnInfo | null;
  playback: { result: ShotResultHeader<M, T>; offsetMs: number } | null;
  end: MatchEnd | null;
}
