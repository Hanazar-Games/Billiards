// Game mode interface (spec §7.1, extended by D045) and the shapes it shares
// with the match layer. Everything here is plain JSON: no Set, Map or class.

/** Random source in [0, 1). */
export type Rng = () => number;

/** ffa takes 3 to 5 seats. */
export type MatchFormat = { kind: '1v1' } | { kind: '2v2' } | { kind: 'ffa'; seats: number };

/**
 * Playing surface size and ball radius, in cm. `cushionInset` is how far from the
 * edge (width / 2, depth / 2) the center of a ball touching a cushion is; it bounds
 * the ball in hand, and without it the bound is the edge less the radius.
 */
export interface TableGeometry { width: number; depth: number; ballRadius: number; cushionInset?: number }

export interface MatchConfig {
  format: MatchFormat;
  table: TableGeometry;
  maxPower: number;
  options?: { threeFoulLoss?: boolean };
}

export interface Seat { index: number; team: number; eliminated: boolean }

/** `nextMember` is the seat that plays the team's next turn. */
export interface Team { index: number; members: number[]; nextMember: number }

/** Turn order; the mode owns it (D013, D045). */
export interface TurnState { seats: Seat[]; teams: Team[]; currentSeat: number }

/** `kitchen` is behind the head string (z ≤ −depth/2 · 0.55). */
export interface BallInHand { seat: number; zone: 'anywhere' | 'kitchen' }

export interface ModeStateBase {
  modeId: string;
  config: MatchConfig;
  turn: TurnState;
  breakShot: boolean;
  ballInHand: BallInHand | null;
  winnerTeam: number | null;
}

/** The sim's timed shot events (packages/sim/src/types.js), redeclared here. */
export type SimEvent =
  | { t: number; type: 'ball_ball'; a: number; b: number; speed: number }
  | { t: number; type: 'ball_cushion'; ball: number; speed: number }
  | { t: number; type: 'pocket'; ball: number; pocket: number }
  | { t: number; type: 'first_contact'; ball: number };

export interface TableState {
  tableProfileId: string;
  balls: { id: number; x: number; z: number; pocketed: boolean }[];
}

/** `cueBall` places the cue ball with ball in hand; `pushOut` declares a 9-ball push-out. */
export interface ShotRequest {
  angle: number;
  power: number;
  spin: { x: number; y: number };
  cueBall?: { x: number; z: number };
  pushOut?: boolean;
}

export type RejectReason = 'GAME_OVER' | 'NOT_YOUR_TURN' | 'BAD_INPUT' | 'PUSH_OUT_PENDING' | 'PUSH_OUT_UNAVAILABLE'
  | 'CUE_BALL_NOT_ALLOWED' | 'CUE_BALL_OUTSIDE_KITCHEN';

export type Validation = { ok: true } | { ok: false; reason: RejectReason };

export type FoulCode = 'SCRATCH' | 'NO_BALL_HIT' | 'NO_RAIL_AFTER_CONTACT' | 'WRONG_FIRST_HIT' | 'ILLEGAL_BREAK'
  | 'EARLY_EIGHT' | 'TIMEOUT';

/** Texts are resolved by the client (spec §7.1). */
export type MessageCode = 'BREAK_FOUL' | 'ILLEGAL_BREAK' | 'BREAK_NO_POCKET' | 'BREAK_LEGAL' | 'EIGHT_ON_BREAK_RESPOT'
  | 'EARLY_EIGHT' | 'LEGAL_EIGHT_WIN' | 'NINE_ON_BREAK_WIN' | 'LEGAL_NINE_WIN' | 'NINE_ON_FOUL_RESPOT' | 'FOUL' | 'NO_POCKET'
  | 'POCKETED' | 'PUSH_OUT_PENDING' | 'PUSH_OUT_ACCEPTED' | 'PUSH_OUT_PASSED' | 'THREE_FOUL_WARNING' | 'THREE_FOUL_LOSS'
  | 'TIMEOUT';

export interface Message { code: MessageCode; params?: Record<string, number | string> }

/** `respot` lists the balls to put back on the table (D045). */
export interface Ruling<S> {
  state: S;
  fouls: FoulCode[];
  ballInHand: BallInHand | null;
  nextSeat: number | null;
  eliminatedSeats: number[];
  winnerTeam: number | null;
  respot: number[];
  messages: Message[];
}

export type Choice = { kind: 'push_out'; accept: boolean };

export interface BallPlacement { id: number; x: number; z: number }

export interface GameMode<S extends ModeStateBase> {
  id: string;
  formats: MatchFormat['kind'][];
  tableProfiles: string[];
  createInitialState(cfg: MatchConfig, rng: Rng, firstSeat?: number): S;
  rackLayout(state: S): BallPlacement[];
  validateShot(state: S, seat: number, shot: ShotRequest): Validation;
  resolveShot(state: S, seat: number, events: SimEvent[], final: TableState, shot: ShotRequest): Ruling<S>;
  resolveTimeout(state: S, seat: number): Ruling<S>;
  applyChoice(state: S, seat: number, choice: Choice): Ruling<S>;
  onSeatRemoved(state: S, seat: number): S;
}
