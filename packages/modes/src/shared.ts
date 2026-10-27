// Pieces both modes share: shot validation, ball in hand, table geometry and
// the ruling builder.
import { activeTeams, removeSeat } from './turns.ts';
import type { BallInHand, BallPlacement, Message, ModeStateBase, Ruling, ShotRequest, Validation, FoulCode } from './types.ts';

/** z of the head string (the client's `-depth / 2 * 0.55`). */
export function headStringZ(state: ModeStateBase): number {
  return -state.config.table.depth / 2 * 0.55;
}

export function teamOf(state: ModeStateBase, seat: number): number {
  return state.turn.seats[seat].team;
}

/** Checks shared by every mode; `pushOutAllowed` and `pushOutPending` come from the mode. */
export function validateCommon(state: ModeStateBase, seat: number, shot: ShotRequest,
  { pushOutAllowed, pushOutPending }: { pushOutAllowed: boolean; pushOutPending: boolean }): Validation {
  if (state.winnerTeam !== null) return { ok: false, reason: 'GAME_OVER' };
  if (seat !== state.turn.currentSeat) return { ok: false, reason: 'NOT_YOUR_TURN' };
  const numbers = [shot.angle, shot.power, shot.spin?.x, shot.spin?.y];
  if (shot.cueBall) numbers.push(shot.cueBall.x, shot.cueBall.z);
  if (!numbers.every(Number.isFinite) || shot.power < 0 || shot.power > state.config.maxPower
    || Math.hypot(shot.spin.x, shot.spin.y) > 1 + 1e-9) {
    return { ok: false, reason: 'BAD_INPUT' };
  }
  if (pushOutPending) return { ok: false, reason: 'PUSH_OUT_PENDING' };
  if (shot.pushOut && !pushOutAllowed) return { ok: false, reason: 'PUSH_OUT_UNAVAILABLE' };
  if (shot.cueBall) {
    if (!state.ballInHand || state.ballInHand.seat !== seat) return { ok: false, reason: 'CUE_BALL_NOT_ALLOWED' };
    // The line is in the kitchen. 1e-6 lets in the line as the server quantizes it (to 0.01 cm):
    // −254 / 2 · 0.55 is −69.85000000000001, and −69.85 is just above it.
    if (state.ballInHand.zone === 'kitchen' && shot.cueBall.z > headStringZ(state) + 1e-6) {
      return { ok: false, reason: 'CUE_BALL_OUTSIDE_KITCHEN' };
    }
  }
  return { ok: true };
}

/** A ruling whose state already carries the turn, ball in hand and winner it reports. */
export function ruling<S extends ModeStateBase>(state: S, fouls: FoulCode[], messages: Message[], respot: number[] = []): Ruling<S> {
  return {
    state,
    fouls,
    ballInHand: state.ballInHand,
    nextSeat: state.winnerTeam === null ? state.turn.currentSeat : null,
    eliminatedSeats: [],
    winnerTeam: state.winnerTeam,
    respot,
    messages,
  };
}

export function ballInHandFor(seat: number, zone: BallInHand['zone']): BallInHand {
  return { seat, zone };
}

/** The seat leaves (abandonment or concession); the last team standing wins. */
export function removeSeatFromState<S extends ModeStateBase>(state: S, seat: number): S {
  const turn = removeSeat(state.turn, seat);
  const teams = activeTeams(turn);
  const ballInHand = state.ballInHand && state.ballInHand.seat === seat
    ? { ...state.ballInHand, seat: turn.currentSeat } : state.ballInHand;
  return { ...state, turn, ballInHand, winnerTeam: state.winnerTeam ?? (teams.length === 1 ? teams[0] : null) };
}

/** Rack rows as [column, row] in ball diameters (BallsManager), placed at the foot spot. */
export function rack(state: ModeStateBase, order: number[], positions: [number, number][], rowOffset: number): BallPlacement[] {
  const r = state.config.table.ballRadius;
  const d = r * 2.02;
  const footZ = state.config.table.depth / 2 * 0.55;
  const layout: BallPlacement[] = [{ id: 0, x: 0, z: headStringZ(state) }];
  positions.forEach(([col, row], i) => {
    layout.push({ id: order[i], x: col * d, z: footZ + (row - rowOffset) * d * Math.sin(Math.PI / 3) });
  });
  return layout;
}
