// The state of an online match (spec §7.2–7.4, plan F4-A): room, players, the
// authoritative match and table, clocks, limits and the end. Between calls the
// runtime hands it to Go and back, so it is plain JSON only: no typed arrays (the
// last trajectory is kept as base64), no reliance on key order, and a stored array
// is copied before it changes. Every function of game/ that talks to Nakama takes a GameEnv.
import { MODES } from '@billiards/modes';
import type { GameMode, MatchConfig, MatchState, ModeStateBase, TableState } from '@billiards/modes';
import type { MatchEnd, ShotRequest, ShotResultHeader } from '@billiards/protocol';
import { BALL, SHOT, TABLE_PROFILES } from '@billiards/sim/constants';
import type { Context, Logger, MatchDispatcher, Nakama, Presence } from '../nakama.ts';

/** Match loop ticks per second (D056). */
export const TICK_RATE = 10;

/** Durations in seconds: the turn, a seat's reconnection reserve, an empty room, a public lobby to fill, playback slack, the end. */
export const SECONDS = { turn: 45, reconnect: 60, empty: 60, fill: 30, playbackGrace: 1, endLinger: 10 };

export const LIMITS = {
  /** More than this many invalid shots within the window removes the connection. */
  invalidShots: 5,
  invalidWindowSeconds: 10,
  /** aim_update and ball_in_hand_move per connection and second. */
  relayPerSecond: 15,
  /** Every other message per connection and second. */
  otherPerSecond: 5,
  simTimeoutMs: 3000,
  simAttempts: 2,
  /** Sim failures that abort the match. */
  simFailures: 3,
};

/** The table every online match is played on. */
export const ONLINE_TABLE = 'pool9ft';

/** 1×1 on the online table: its size, the ball radius and the strongest shot come from the sim. */
export function onlineConfig(): MatchConfig {
  const profile = TABLE_PROFILES[ONLINE_TABLE];
  return { format: { kind: '1v1' }, table: { width: profile.width, depth: profile.depth, ballRadius: BALL.radius }, maxPower: SHOT.maxPower };
}

export interface GameEnv {
  ctx: Context;
  logger: Logger;
  nk: Nakama;
  dispatcher: MatchDispatcher;
}

/** The table with each ball's orientation once the sim has moved it. */
export interface GameTable extends TableState {
  balls: { id: number; x: number; z: number; pocketed: boolean; q?: [number, number, number, number] }[];
}

export type GamePhase = 'LOBBY' | 'AWAITING_SHOT' | 'ENDED';

export interface GameState {
  mode: string;
  format: string;
  code: string;
  private: boolean;
  seats: number;
  /** By userId: the player's newest connection. */
  presences: Record<string, Presence>;
  /**
   * The lobby's userIds in join order. The runtime hands the state to Go and back
   * between calls, and objects come back with their keys in any order: only arrays keep it.
   */
  joinOrder: string[];
  /** By seat, fixed when the match starts. */
  players: { userId: string; username: string }[];
  phase: GamePhase;
  match: MatchState | null;
  table: GameTable | null;
  /** The seat that breaks, drawn by the server. */
  firstSeat: number;
  createdTick: number;
  /** Wall-clock time the match started (Date.now()), for the history record; 0 while in the lobby. */
  startedAt: number;
  emptyTicks: number;
  /** The tick the current turn times out. */
  deadlineTick: number;
  /** The last shot_result: its header, its trajectory in base64, the tick it went out and its playback in ticks. */
  lastResult: { header: ShotResultHeader<MatchState, GameTable>; trajectory: string; tick: number; durationTicks: number } | null;
  /** By seat: the last shot request accepted, to recognize a resend. */
  lastAccepted: Record<number, { turnId: number; seq: number }>;
  /** By seat: the tick the player's connection left. */
  disconnectedAt: Record<number, number>;
  /** By userId: ticks of the recent invalid shots. */
  invalid: Record<string, number[]>;
  /** By sessionId: messages counted in the current second. */
  rate: Record<string, { second: number; relay: number; other: number }>;
  simFailures: number;
  shots: { turnId: number; seat: number; shot: ShotRequest }[];
  end: MatchEnd | null;
  endTick: number;
  historyWritten: boolean;
}

const SEATS: Record<string, number> = { '1v1': 2, '2v2': 4 };

/** From the matchCreate params { mode, format, code?, private? }; created at tick 0. */
export function createGameState(params: Record<string, unknown>): GameState {
  const format = String(params.format);
  return {
    mode: String(params.mode),
    format,
    code: typeof params.code === 'string' ? params.code : '',
    private: params.private === true,
    seats: SEATS[format] ?? 2,
    presences: {},
    joinOrder: [],
    players: [],
    phase: 'LOBBY',
    match: null,
    table: null,
    firstSeat: 0,
    createdTick: 0,
    startedAt: 0,
    emptyTicks: 0,
    deadlineTick: 0,
    lastResult: null,
    lastAccepted: {},
    disconnectedAt: {},
    invalid: {},
    rate: {},
    simFailures: 0,
    shots: [],
    end: null,
    endTick: 0,
    historyWritten: false,
  };
}

export function modeOf(state: GameState): GameMode<ModeStateBase> {
  return MODES[state.mode as keyof typeof MODES] as unknown as GameMode<ModeStateBase>;
}

/** The player's seat, or null for anyone else. */
export function seatOf(state: GameState, userId: string): number | null {
  const seat = state.players.findIndex((p) => p.userId === userId);
  return seat < 0 ? null : seat;
}

export function presenceList(state: GameState): Presence[] {
  return Object.keys(state.presences).map((userId) => state.presences[userId]);
}

/** The label rooms are found by (spec §7.5): open while the lobby has a free seat. */
export function matchLabel(state: GameState): string {
  const started = state.match !== null;
  const open = state.phase === 'LOBBY' && presenceList(state).length < state.seats;
  return JSON.stringify({ mode: state.mode, format: state.format, code: state.code, private: state.private, open, started });
}
