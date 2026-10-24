// @ts-check
// Public data shapes of @billiards/sim (JSDoc only, no runtime code).

/** @import { Tuning } from './constants.js' */

/** @typedef {[x: number, y: number, z: number, w: number]} Quat */

/**
 * One ball on the table, in centimeters on the XZ plane (Y is up). A ball that
 * is pocketed in the input stays out of the physics world and keeps its x/z;
 * a ball pocketed during the shot reports where its body was parked by
 * `removeBall` (x = 0, z = 0), as the legacy `Ball.remove()` does.
 * @typedef {{
 *   id: number,
 *   x: number,
 *   z: number,
 *   q?: Quat,
 *   pocketed: boolean,
 * }} BallState
 */

/**
 * @typedef {{
 *   tableProfileId: string,
 *   balls: BallState[],
 * }} TableState
 */

/**
 * A shot: direction `(cos angle, sin angle)` on the XZ plane, `power` in the
 * legacy impulse units (clamped to `SHOT.maxPower`), cue-tip offset `spin`
 * (normalized when its length exceeds 1) and an optional cue-ball placement
 * applied before the stroke.
 * @typedef {{
 *   angle: number,
 *   power: number,
 *   spin: { x: number, y: number },
 *   cueBall?: { x: number, z: number },
 * }} ShotInput
 */

/**
 * Trajectory sample at t = k / 30 s (every 12 steps), with only the balls
 * that moved or turned since their previous sample. A ball pocketed since the
 * previous frame appears once more, where it was detected in the pocket.
 * @typedef {{
 *   t: number,
 *   balls: { id: number, x: number, z: number, q: Quat }[],
 * }} Frame
 */

/**
 * Timed shot event, `t = step / 360`, in step order.
 * - `ball_ball`: one per contact start, `a < b`; `speed` is the magnitude of
 *   the relative velocity before the impact (for contacts the guards resolve,
 *   its normal component).
 * - `ball_cushion`: one per contact start; `speed` is the ball's speed.
 * - `pocket`: `pocket` is the index in `getPocketPositions`.
 * - `first_contact`: goes out with the first `ball_ball` of the cue ball.
 * @typedef {(
 *   { t: number, type: 'ball_ball', a: number, b: number, speed: number } |
 *   { t: number, type: 'ball_cushion', ball: number, speed: number } |
 *   { t: number, type: 'pocket', ball: number, pocket: number } |
 *   { t: number, type: 'first_contact', ball: number }
 * )} SimEvent
 */

/**
 * @typedef {{
 *   tuning?: Tuning,
 *   maxSimSeconds?: number,
 * }} SimulateOptions
 */

/**
 * `final.balls` is sorted by id and carries every ball's `q` (identity for a
 * ball pocketed in the input without one). `frames` stop at the last multiple
 * of 12 steps; `final` covers the rest.
 * `steps` counts 1/360 s physics steps; `simSeconds = steps / 360`; `capped`
 * is true when the time limit ended the shot before every ball stopped.
 * @typedef {{
 *   frames: Frame[],
 *   events: SimEvent[],
 *   final: TableState,
 *   steps: number,
 *   simSeconds: number,
 *   capped: boolean,
 * }} ShotResult
 */

export {};
