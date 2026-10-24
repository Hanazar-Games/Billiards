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
 * Trajectory sample at t = k / 30 s. Empty until F1-A Task 5.
 * @typedef {{
 *   t: number,
 *   balls: { id: number, x: number, z: number, q: Quat }[],
 * }} Frame
 */

/**
 * Timed shot event (t = step / 360). Empty until F1-A Task 4.
 * @typedef {{ t: number, type: string }} SimEvent
 */

/**
 * @typedef {{
 *   tuning?: Tuning,
 *   maxSimSeconds?: number,
 * }} SimulateOptions
 */

/**
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
