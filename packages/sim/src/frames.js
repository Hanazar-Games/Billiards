// @ts-check
// Shot trajectory at 30 Hz of simulated time (one frame every 12 steps).
// Frames are dense in time (one per 1/30 s, possibly empty) and sparse in
// balls: a ball enters a frame only when it moved more than 0.005 cm or turned
// more than 0.01 rad since its last sample. A ball pocketed since the previous
// frame appears once more, where it was taken out, and never again.

/** @import { SimBall } from './ball.js' */
/** @import { Frame, Quat } from './types.js' */

const STEPS_PER_SECOND = 360;
const MIN_MOVE = 0.005;
const MIN_TURN = 0.01;

/**
 * @param {SimBall[]} balls balls in play, in id order, already placed
 */
export function createFrameSampler(balls) {
  /** @type {Map<number, { x: number, z: number, q: Quat }>} last sample by id */
  const last = new Map();
  for (const ball of balls) {
    last.set(ball.id, { x: ball.body.position.x, z: ball.body.position.z, q: quatOf(ball) });
  }
  /** @type {Map<number, { x: number, z: number }>} where pocketed balls left the table */
  const pocketedAt = new Map();
  /** @type {Set<number>} balls already shown pocketed */
  const gone = new Set();
  /** @type {Frame[]} */
  const frames = [];

  return {
    /**
     * Records where a ball was when it was pocketed (its body is parked off the
     * table right after).
     * @param {number} id
     * @param {number} x
     * @param {number} z
     */
    pocketed(id, x, z) {
      pocketedAt.set(id, { x, z });
    },

    /** @param {number} step */
    sample(step) {
      /** @type {Frame['balls']} */
      const moving = [];
      for (const ball of balls) {
        if (gone.has(ball.id)) continue;
        let { x, z } = ball.body.position;
        if (ball.pocketed) {
          gone.add(ball.id);
          ({ x, z } = /** @type {{ x: number, z: number }} */ (pocketedAt.get(ball.id)));
        }
        const q = quatOf(ball);
        const prev = /** @type {{ x: number, z: number, q: Quat }} */ (last.get(ball.id));
        if (Math.hypot(x - prev.x, z - prev.z) <= MIN_MOVE && turnAngle(q, prev.q) <= MIN_TURN) continue;
        last.set(ball.id, { x, z, q });
        moving.push({ id: ball.id, x, z, q });
      }
      frames.push({ t: step / STEPS_PER_SECOND, balls: moving });
    },

    frames,
  };
}

/**
 * @param {SimBall} ball
 * @returns {Quat}
 */
export function quatOf(ball) {
  const q = ball.body.quaternion;
  return [q.x, q.y, q.z, q.w];
}

/**
 * Rotation angle between two unit quaternions, in radians.
 * @param {Quat} a
 * @param {Quat} b
 */
function turnAngle(a, b) {
  const dot = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
  return 2 * Math.acos(Math.min(1, dot));
}
