// @ts-check
// Per-ball physics: the CANNON side of apps/client/src/game/Ball.js (body
// setup, applyImpulse, limitSpeed, limitAngularSpeed, applyLowSpeedBrake,
// applySpinPhysics, remove) without the mesh. Same arithmetic, same order, so
// the bodies evolve bit-identically to the legacy ones.
import * as CANNON from 'cannon-es';
import { BALL } from './constants.js';

/** @import { Tuning } from './constants.js' */
/** @import { SimWorld } from './world.js' */

/**
 * @typedef {{
 *   id: number,
 *   pocketed: boolean,
 *   body: CANNON.Body,
 * }} SimBall
 */

/**
 * Ball body as the legacy Ball constructor builds it. The body starts with the
 * identity orientation: its world inertia is computed here, once, and cannon
 * never updates it again because a sphere's inertia is isotropic.
 * @param {number} id
 * @param {Tuning} tuning
 * @returns {SimBall}
 */
export function createBall(id, tuning) {
  const body = new CANNON.Body({
    mass: BALL.mass,
    linearDamping: tuning.damping,
    angularDamping: tuning.angularDamping,
  });
  body.addShape(new CANNON.Sphere(BALL.radius));
  body.allowSleep = true;
  body.sleepSpeedLimit = BALL.sleepSpeedLimit;
  body.sleepTimeLimit = BALL.sleepTimeLimit;

  // Lock Y position (balls shouldn't fly or sink into table)
  body.linearFactor = new CANNON.Vec3(1, 0, 1);
  body.angularFactor = new CANNON.Vec3(1, 1, 1);

  return { id, pocketed: false, body };
}

/**
 * Cue stroke (legacy Ball.applyImpulse): linear impulse at the center plus the
 * spin and squirt of an off-center cue tip hit.
 * @param {SimBall} ball
 * @param {number} x impulse along X
 * @param {number} y impulse along Y
 * @param {number} z impulse along Z
 * @param {number} [cueTipOffsetX] horizontal cue tip offset (-1..1)
 * @param {number} [cueTipOffsetY] vertical cue tip offset (-1..1)
 */
export function applyCueImpulse(ball, x, y, z, cueTipOffsetX = 0, cueTipOffsetY = 0) {
  ball.body.wakeUp();
  const shotSpeed = Math.hypot(x, z);
  const dirX = shotSpeed > 0.001 ? x / shotSpeed : 0;
  const dirZ = shotSpeed > 0.001 ? z / shotSpeed : 1;

  // Apply linear impulse at ball centre (relative to body COM)
  ball.body.applyImpulse(new CANNON.Vec3(x, y, z), new CANNON.Vec3(0, 0, 0));

  // Compute spin from off-centre cue tip hit using physical torque.
  const e = cueTipOffsetX;
  const h = cueTipOffsetY;

  if ((Math.abs(e) > 0.001 || Math.abs(h) > 0.001) && shotSpeed > 0.001) {
    const R = BALL.radius;

    // Right-hand perpendicular direction in XZ plane
    const nX = dirZ;
    const nZ = -dirX;

    // Hit point relative to ball centre (world coords)
    const hitX = e * R * nX;
    const hitY = h * R;
    const hitZ = e * R * nZ;

    // Angular impulse = r × J
    const Jx = x;
    const Jz = z;
    const angImpulseX = hitY * Jz - hitZ * 0;
    const angImpulseY = hitZ * Jx - hitX * Jz;
    const angImpulseZ = hitX * 0 - hitY * Jx;

    // Solid sphere: I = (2/5) * m * R²
    const invI = 5 / (2 * BALL.mass * R * R);

    ball.body.angularVelocity.x += angImpulseX * invI;
    ball.body.angularVelocity.y += angImpulseY * invI;
    ball.body.angularVelocity.z += angImpulseZ * invI;

    // Squirt: horizontal offset deflects cue ball slightly sideways.
    if (Math.abs(e) > 0.001) {
      const squirt = shotSpeed * BALL.cueSquirt * e;
      ball.body.velocity.x -= nX * squirt;
      ball.body.velocity.z -= nZ * squirt;
    }
  }

  limitSpeed(ball);
  limitAngularSpeed(ball);
}

/** @param {SimBall} ball */
export function limitSpeed(ball) {
  const v = ball.body.velocity;
  const speedSq = v.x * v.x + v.z * v.z;
  const maxSq = BALL.maxSpeed * BALL.maxSpeed;
  if (speedSq > maxSq) {
    const scale = BALL.maxSpeed / Math.sqrt(speedSq);
    v.x *= scale;
    v.z *= scale;
  }
  v.y = 0;
}

/** @param {SimBall} ball */
export function limitAngularSpeed(ball) {
  const av = ball.body.angularVelocity;
  const max = BALL.maxAngularSpeed || 180;
  const speed = av.length();
  if (speed > max) {
    const scale = max / speed;
    av.x *= scale;
    av.y *= scale;
    av.z *= scale;
  }
}

/**
 * Cloth rolling resistance, low-speed braking, spin decay and the final stop.
 * @param {SimBall} ball
 * @param {number} dt
 * @param {Tuning} tuning
 */
export function applyLowSpeedBrake(ball, dt, tuning) {
  if (ball.pocketed) return;

  const v = ball.body.velocity;
  const av = ball.body.angularVelocity;
  let speed = Math.sqrt(v.x * v.x + v.z * v.z);
  let angularSpeed = av.length();

  // Rolling resistance: near-constant deceleration from cloth
  if (speed > 0) {
    const rollingDrop = Math.min(speed, tuning.rollingResistance * dt);
    const rollingFactor = (speed - rollingDrop) / speed;
    v.x *= rollingFactor;
    v.z *= rollingFactor;
    speed = Math.sqrt(v.x * v.x + v.z * v.z);
  }

  // Gentle braking as speed approaches zero
  if (speed > 0 && speed < BALL.slowBrakeSpeed) {
    const t = 1 - speed / BALL.slowBrakeSpeed;
    const brake = BALL.slowBrakeStrength * t * t;
    const factor = Math.max(0, Math.exp(-brake * dt));
    v.x *= factor;
    v.z *= factor;
    av.x *= factor;
    av.y *= factor;
    av.z *= factor;
    speed = Math.sqrt(v.x * v.x + v.z * v.z);
    angularSpeed = av.length();
  }

  // Cloth-friction spin decay. Rolling axes (x/z) should survive much
  // longer than side spin; otherwise balls visually slide after contact and
  // spin shots die before they can affect the next cushion.
  if (angularSpeed > 0) {
    const isNearlyStopped = speed < BALL.stopSpeedLimit * 2.5;
    const rollFriction = isNearlyStopped ? 2.4 : tuning.rollingSpinFriction;
    const sideFriction = isNearlyStopped ? 3.0 : tuning.sideSpinFriction;
    const rollFactor = Math.max(0, Math.exp(-rollFriction * dt));
    const sideFactor = Math.max(0, Math.exp(-sideFriction * dt));
    av.x *= rollFactor;
    av.y *= sideFactor;
    av.z *= rollFactor;
    angularSpeed = av.length();
  }

  if (speed < BALL.stopSpeedLimit && angularSpeed < BALL.sleepAngularSpeedLimit) {
    v.set(0, 0, 0);
    av.set(0, 0, 0);
    ball.body.sleep();
  }
}

/**
 * Roll coupling: drives the translational velocity toward pure rolling.
 * @param {SimBall} ball
 * @param {number} dt
 * @param {Tuning} tuning
 */
export function applySpinPhysics(ball, dt, tuning) {
  if (ball.pocketed) return;

  const v = ball.body.velocity;
  const av = ball.body.angularVelocity;
  const speed = Math.sqrt(v.x * v.x + v.z * v.z);

  // Roll coupling: drive translational velocity toward pure-rolling velocity
  const rollVx = -av.z * BALL.radius;
  const rollVz = av.x * BALL.radius;
  const rollSpeed = Math.sqrt(rollVx * rollVx + rollVz * rollVz);

  if (speed > 0.01 || rollSpeed > 0.01) {
    const coupling = 1 - Math.exp(-tuning.rollCoupling * dt);
    const slipX = rollVx - v.x;
    const slipZ = rollVz - v.z;

    const isNearlyStopped = speed < BALL.stopSpeedLimit;
    if (!isNearlyStopped) {
      v.x += slipX * coupling;
      v.z += slipZ * coupling;
    }

    av.z += (slipX / BALL.radius) * coupling * 2.5;
    av.x -= (slipZ / BALL.radius) * coupling * 2.5;
  }

  limitAngularSpeed(ball);
}

/**
 * Pockets a ball: legacy Ball.remove() parks the body below the table, then
 * BallsManager.checkPockets takes it out of the physics world.
 * @param {SimWorld} simWorld
 * @param {SimBall} ball
 */
export function removeBall(simWorld, ball) {
  ball.pocketed = true;
  ball.body.velocity.set(0, 0, 0);
  ball.body.angularVelocity.set(0, 0, 0);
  ball.body.position.set(0, -1000, 0);
  simWorld.world.removeBody(ball.body);
}
