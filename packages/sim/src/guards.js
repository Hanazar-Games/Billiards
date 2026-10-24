// @ts-check
// Custom physics around the cannon-es step: the guard section of
// apps/client/src/game/BallsManager.js (updatePhysicsGuards and the routines it
// calls, applyCushionSpin, allStopped, checkPockets) without sync(). Same
// arithmetic, same order, so the results are bit-identical to the legacy ones.
import { BALL } from './constants.js';
import {
  applyLowSpeedBrake,
  applySpinPhysics,
  limitAngularSpeed,
  limitSpeed,
  removeBall,
} from './ball.js';

/** @import { SimBall } from './ball.js' */
/** @import { SimWorld } from './world.js' */

/**
 * Notified when the guards themselves resolve a contact (the swept and
 * overlap passes, or the table-bounds rescue), which cannon never sees.
 * @typedef {{
 *   onBallContact?: (a: SimBall, b: SimBall, speed: number) => void,
 *   onCushionContact?: (ball: SimBall) => void,
 * }} GuardHooks
 */

/**
 * @typedef {{
 *   update: (dt: number) => void,
 *   checkPockets: () => { id: number, pocketIndex: number, x: number, z: number }[],
 *   allStopped: () => boolean,
 *   applyCushionSpin: (ball: SimBall) => void,
 * }} Guards
 */

/**
 * @param {SimWorld} simWorld
 * @param {SimBall[]} balls balls in play, in id order
 * @param {GuardHooks} [hooks]
 * @returns {Guards}
 */
export function createGuards(simWorld, balls, hooks = {}) {
  const { profile, pockets: pocketPositions, tuning } = simWorld;
  /** @type {Map<number, { x: number, z: number }>} */
  const previousPositions = new Map();

  /** @param {number} dt */
  function update(dt) {
    for (const ball of balls) {
      if (ball.pocketed) continue;
      applySpinPhysics(ball, dt, tuning);
      applyLowSpeedBrake(ball, dt, tuning);
      // Single safety clamp per frame (not inside every physics routine)
      limitSpeed(ball);
      enforceTableBounds(ball);
    }
    resolveSweptBallContacts();
    resolveBallOverlaps();
    storePreviousPositions();
  }

  function storePreviousPositions() {
    for (const ball of balls) {
      if (ball.pocketed) {
        previousPositions.delete(ball.id);
      } else {
        previousPositions.set(ball.id, {
          x: ball.body.position.x,
          z: ball.body.position.z,
        });
      }
    }
  }

  // Catches pairs that crossed each other between two guard updates: finds the
  // first time of contact along the straight paths and resolves it there.
  function resolveSweptBallContacts() {
    const contactDist = BALL.radius * 2 * BALL.sweepContactScale;
    const contactDistSq = contactDist * contactDist;
    const maxFrameMove = BALL.maxSpeed * 0.08;
    const maxFrameMoveSq = maxFrameMove * maxFrameMove;

    for (let i = 0; i < balls.length; i++) {
      const a = balls[i];
      if (a.pocketed) continue;
      const a0 = previousPositions.get(a.id);
      if (!a0) continue;

      for (let j = i + 1; j < balls.length; j++) {
        const b = balls[j];
        if (b.pocketed) continue;
        const b0 = previousPositions.get(b.id);
        if (!b0) continue;

        const aMoveX = a.body.position.x - a0.x;
        const aMoveZ = a.body.position.z - a0.z;
        const bMoveX = b.body.position.x - b0.x;
        const bMoveZ = b.body.position.z - b0.z;
        if (aMoveX * aMoveX + aMoveZ * aMoveZ > maxFrameMoveSq) continue;
        if (bMoveX * bMoveX + bMoveZ * bMoveZ > maxFrameMoveSq) continue;

        const currentDx = b.body.position.x - a.body.position.x;
        const currentDz = b.body.position.z - a.body.position.z;
        if (currentDx * currentDx + currentDz * currentDz <= contactDistSq) continue;

        const startDx = b0.x - a0.x;
        const startDz = b0.z - a0.z;
        const relMoveX = bMoveX - aMoveX;
        const relMoveZ = bMoveZ - aMoveZ;
        const aCoef = relMoveX * relMoveX + relMoveZ * relMoveZ;
        if (aCoef < 0.000001) continue;

        const bCoef = 2 * (startDx * relMoveX + startDz * relMoveZ);
        const cCoef = startDx * startDx + startDz * startDz - contactDistSq;
        if (cCoef <= 0 || bCoef >= 0) continue;

        const disc = bCoef * bCoef - 4 * aCoef * cCoef;
        if (disc < 0) continue;

        const t = (-bCoef - Math.sqrt(disc)) / (2 * aCoef);
        if (t < 0 || t > 1) continue;

        const contactDx = startDx + relMoveX * t;
        const contactDz = startDz + relMoveZ * t;
        const contactLen = Math.sqrt(contactDx * contactDx + contactDz * contactDz) || contactDist;
        const nx = contactDx / contactLen;
        const nz = contactDz / contactLen;
        const relNormalSpeed = (b.body.velocity.x - a.body.velocity.x) * nx +
          (b.body.velocity.z - a.body.velocity.z) * nz;
        if (relNormalSpeed >= 0) continue;

        a.body.position.x = a0.x + aMoveX * t;
        a.body.position.z = a0.z + aMoveZ * t;
        b.body.position.x = b0.x + bMoveX * t;
        b.body.position.z = b0.z + bMoveZ * t;
        a.body.position.y = BALL.radius;
        b.body.position.y = BALL.radius;

        resolveBallCollisionVelocity(a, b, nx, nz);
        hooks.onBallContact?.(a, b, Math.abs(relNormalSpeed));
        separateContactPair(a, b, nx, nz, contactDist);
        enforceTableBounds(a);
        enforceTableBounds(b);
        a.body.wakeUp();
        b.body.wakeUp();
      }
    }
  }

  function resolveBallOverlaps() {
    const minDist = BALL.radius * 2 * 0.98;
    const minDistSq = minDist * minDist;

    for (let pass = 0; pass < BALL.overlapIterations; pass++) {
      for (let i = 0; i < balls.length; i++) {
        const a = balls[i];
        if (a.pocketed) continue;

        for (let j = i + 1; j < balls.length; j++) {
          const b = balls[j];
          if (b.pocketed) continue;

          const dx = b.body.position.x - a.body.position.x;
          const dz = b.body.position.z - a.body.position.z;
          const distSq = dx * dx + dz * dz;
          if (distSq >= minDistSq) continue;

          const dist = Math.sqrt(distSq) || 0.0001;
          const nx = distSq > 0.000001 ? dx / dist : 1;
          const nz = distSq > 0.000001 ? dz / dist : 0;
          separateContactPair(a, b, nx, nz, minDist);
          const relNormalSpeed = resolveBallCollisionVelocity(a, b, nx, nz);
          if (relNormalSpeed < -0.05) {
            hooks.onBallContact?.(a, b, Math.abs(relNormalSpeed));
          }

          enforceTableBounds(a);
          enforceTableBounds(b);
          a.body.wakeUp();
          b.body.wakeUp();
        }
      }
    }
  }

  /**
   * @param {SimBall} a
   * @param {SimBall} b
   * @param {number} nx
   * @param {number} nz
   * @param {number} targetDist
   */
  function separateContactPair(a, b, nx, nz, targetDist) {
    const dx = b.body.position.x - a.body.position.x;
    const dz = b.body.position.z - a.body.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz) || 0.0001;
    const overlap = targetDist - dist;
    if (overlap <= 0) return;

    const correction = overlap * 0.5;
    a.body.position.x -= nx * correction;
    a.body.position.z -= nz * correction;
    b.body.position.x += nx * correction;
    b.body.position.z += nz * correction;
    a.body.position.y = BALL.radius;
    b.body.position.y = BALL.radius;
  }

  /**
   * @param {SimBall} a
   * @param {SimBall} b
   * @param {number} nx
   * @param {number} nz
   * @returns {number} relative normal speed before the impulse
   */
  function resolveBallCollisionVelocity(a, b, nx, nz) {
    const av = a.body.velocity;
    const bv = b.body.velocity;
    const aav = a.body.angularVelocity;
    const bav = b.body.angularVelocity;
    const relX = bv.x - av.x;
    const relZ = bv.z - av.z;
    const relNormalSpeed = relX * nx + relZ * nz;
    if (relNormalSpeed >= 0) return relNormalSpeed;

    // Equal-mass inelastic collision: split impulse 50/50.  Restitution below
    // 1 intentionally dissipates speed on impact, which makes clusters stop
    // feeding unrealistically lively rebounds back into the table.
    const normalImpulse = -(1 + BALL.collisionRestitution) * relNormalSpeed * 0.5;
    av.x -= nx * normalImpulse;
    av.z -= nz * normalImpulse;
    bv.x += nx * normalImpulse;
    bv.z += nz * normalImpulse;

    const tx = -nz;
    const tz = nx;

    // Tangential relative velocity INCLUDING surface spin contribution.
    // Surface speed from ω_y at contact point = ±ω_y·r in tangent direction.
    // Relative surface tangent speed = (ω_a + ω_b) * r.
    const tangentSpeed = relX * tx + relZ * tz +
      (aav.y + bav.y) * BALL.radius;
    const maxTangentImpulse = Math.abs(normalImpulse) * BALL.collisionTangentialFriction;
    // Effective mass in tangent direction for equal spheres includes
    // rotational inertia: equivalent mass = 7·m/2, so impulse factor ≈ 1/7.
    const tangentImpulse = Math.max(
      -maxTangentImpulse,
      Math.min(maxTangentImpulse, -tangentSpeed / 7)
    );
    av.x -= tx * tangentImpulse;
    av.z -= tz * tangentImpulse;
    bv.x += tx * tangentImpulse;
    bv.z += tz * tangentImpulse;

    // Angular velocity update from friction torque at contact.
    // For solid sphere I = (2/5)·m·r², torque impulse = r × F = r·jt (about Y)
    // The tangential impulse here is already a velocity change (Δv), so:
    // Δω_y = (5/2) · Δv / r
    const dOmegaY = (5 * tangentImpulse) / (2 * BALL.radius);
    aav.y += dOmegaY;
    bav.y += dOmegaY;

    // Real contacts bleed a little spin and rolling energy. Keep this small:
    // it removes arcade-like endless side spin without killing planned english.
    const impactT = Math.min(1, Math.abs(relNormalSpeed) / 140);
    const rollSpinLoss = 1 - BALL.collisionSpinLoss * impactT;
    const sideSpinLoss = 1 - BALL.collisionSpinLoss * 0.35 * impactT;
    aav.x *= rollSpinLoss;
    aav.z *= rollSpinLoss;
    aav.y *= sideSpinLoss;
    bav.x *= rollSpinLoss;
    bav.z *= rollSpinLoss;
    bav.y *= sideSpinLoss;

    limitSpeed(a);
    limitAngularSpeed(a);
    limitSpeed(b);
    limitAngularSpeed(b);
    return relNormalSpeed;
  }

  /**
   * Cushion friction on the rebound: tangential impulse, side-spin "grab" and
   * spin loss. Called on cannon cushion contacts and on table-bounds rescues.
   * @param {SimBall} ball
   */
  function applyCushionSpin(ball) {
    if (!ball || ball.pocketed) return;

    const pos = ball.body.position;
    const vel = ball.body.velocity;
    const av = ball.body.angularVelocity;
    const halfW = profile.width / 2;
    const halfD = profile.depth / 2;

    let nx = 0;
    let nz = 0;
    const xPen = Math.abs(pos.x) / Math.max(1, halfW);
    const zPen = Math.abs(pos.z) / Math.max(1, halfD);
    if (xPen > zPen) {
      nx = pos.x > 0 ? -1 : 1;
    } else {
      nz = pos.z > 0 ? -1 : 1;
    }

    const tx = -nz;
    const tz = nx;
    const velNormal = vel.x * nx + vel.z * nz;
    const normalSpeed = Math.max(0.1, Math.abs(velNormal));
    const tangentSpeed = vel.x * tx + vel.z * tz + av.y * BALL.radius;

    const maxTangent = normalSpeed * BALL.cushionTangentialFriction;
    const tangentImpulse = Math.max(
      -maxTangent,
      Math.min(maxTangent, -tangentSpeed * 0.32)
    );

    vel.x += tx * tangentImpulse;
    vel.z += tz * tangentImpulse;
    av.y += (5 * tangentImpulse) / (2 * BALL.radius);

    // A side-spinning ball "grabs" the cushion and slightly changes the
    // rebound tangent. Scale by impact speed so soft rail touches stay subtle.
    const transfer = Math.min(1, normalSpeed / 90) * BALL.cushionSideSpinTransfer;
    vel.x += tx * av.y * BALL.radius * transfer;
    vel.z += tz * av.y * BALL.radius * transfer;

    const spinLoss = 1 - Math.min(BALL.cushionSpinLoss, BALL.cushionSpinLoss * normalSpeed / 120);
    av.x *= spinLoss;
    av.z *= spinLoss;
    av.y *= 1 - (1 - spinLoss) * 0.45;

    limitSpeed(ball);
    limitAngularSpeed(ball);
  }

  /**
   * Rescues a ball that escaped through a cushion (outside the pocket mouths).
   * @param {SimBall} ball
   */
  function enforceTableBounds(ball) {
    if (isNearPocketMouth(ball)) return;

    const halfW = profile.width / 2;
    const halfD = profile.depth / 2;
    // Escape limit: ball must have clearly left the table surface to trigger rescue.
    // Rail limit: place the ball just inside the cushion face.
    const cushionHalf = profile.cushionWidth;
    const railLimitX = halfW - cushionHalf - BALL.radius * 0.05;
    const railLimitZ = halfD - cushionHalf - BALL.radius * 0.05;
    const escapeLimitX = halfW + BALL.radius * 0.25;
    const escapeLimitZ = halfD + BALL.radius * 0.25;

    const pos = ball.body.position;
    const vel = ball.body.velocity;
    let corrected = false;

    if (pos.x > escapeLimitX) {
      pos.x = railLimitX;
      vel.x = -Math.abs(vel.x) * BALL.boundaryRestitution;
      corrected = true;
    } else if (pos.x < -escapeLimitX) {
      pos.x = -railLimitX;
      vel.x = Math.abs(vel.x) * BALL.boundaryRestitution;
      corrected = true;
    }

    if (pos.z > escapeLimitZ) {
      pos.z = railLimitZ;
      vel.z = -Math.abs(vel.z) * BALL.boundaryRestitution;
      corrected = true;
    } else if (pos.z < -escapeLimitZ) {
      pos.z = -railLimitZ;
      vel.z = Math.abs(vel.z) * BALL.boundaryRestitution;
      corrected = true;
    }

    if (corrected) {
      pos.y = BALL.radius;
      vel.y = 0;

      const av = ball.body.angularVelocity;
      // Cushion hit dampens forward/back spin (ω_x, ω_z) more than side spin (ω_y)
      av.x *= 0.75;
      av.z *= 0.75;
      // Side spin is largely preserved on cushion contact
      applyCushionSpin(ball);

      ball.body.wakeUp();
      hooks.onCushionContact?.(ball);
    }
  }

  /** @param {SimBall} ball */
  function isNearPocketMouth(ball) {
    const pos = ball.body.position;

    for (const pocket of pocketPositions) {
      const pocketPassRadius = pocket.radius + profile.pocketDetectMargin;
      const dx = pos.x - pocket.x;
      const dz = pos.z - pocket.z;
      if (dx * dx + dz * dz <= pocketPassRadius * pocketPassRadius) {
        return true;
      }
    }
    return false;
  }

  function allStopped() {
    for (const ball of balls) {
      if (ball.pocketed) continue;
      if (ball.body.velocity.length() > BALL.sleepSpeedLimit) {
        return false;
      }
      if (ball.body.angularVelocity.length() > BALL.sleepAngularSpeedLimit) {
        return false;
      }
    }
    return true;
  }

  /**
   * Pockets every ball inside a pocket's detection radius and takes it out of
   * the physics world. `x`, `z` is where the ball was when detected.
   * @returns {{ id: number, pocketIndex: number, x: number, z: number }[]}
   */
  function checkPockets() {
    /** @type {{ id: number, pocketIndex: number, x: number, z: number }[]} */
    const pocketed = [];

    for (const ball of balls) {
      if (ball.pocketed) continue;
      for (let pi = 0; pi < pocketPositions.length; pi++) {
        const pocket = pocketPositions[pi];
        const detectDist = pocket.radius + profile.pocketDetectMargin;
        const dx = ball.body.position.x - pocket.x;
        const dz = ball.body.position.z - pocket.z;
        const distSq = dx * dx + dz * dz;
        if (distSq < detectDist * detectDist) {
          const { x, z } = ball.body.position;
          removeBall(simWorld, ball);
          pocketed.push({ id: ball.id, pocketIndex: pi, x, z });
          break;
        }
      }
    }
    return pocketed;
  }

  return { update, checkPockets, allStopped, applyCushionSpin };
}
