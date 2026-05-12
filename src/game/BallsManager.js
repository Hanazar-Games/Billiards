import { Ball } from './Ball.js';
import { BALL, BALL_COLORS, TABLE, POCKET, getBallType, BALL_TYPE } from '../config.js';

export class BallsManager {
  constructor(physics) {
    this.physics = physics;
    this.balls = [];
    this.previousPositions = new Map();
    this.onManualBallContact = null;
    this.onManualCushionContact = null;
  }

  addToScene(scene) {
    for (const ball of this.balls) {
      scene.add(ball.mesh);
      ball.setPhysicsMaterial(this.physics.ballMaterial);
      this.physics.addBody(ball.body);
    }
  }

  createBalls() {
    for (let i = 0; i <= 15; i++) {
      const type = getBallType(i);
      const ball = new Ball(i, BALL_COLORS[i], type);
      this.balls.push(ball);
    }
  }

  rackBalls(mode = '8ball') {
    if (this.balls.length === 0) {
      this.createBalls();
    }

    if (mode === '9ball') {
      this._rackNineBall();
    } else {
      this._rackEightBall();
    }
  }

  _rackEightBall() {
    const r = BALL.radius;
    const d = r * 2.02;
    const halfD = TABLE.depth / 2;

    // Cue ball: head spot
    this._placeBall(0, 0, r, -halfD * 0.55);

    // Rack at foot spot
    const rackZ = halfD * 0.55;
    const startX = 0;

    const rackOrder = [
      1, 9, 10, 2, 8, 3, 11, 4, 5, 12, 6, 13, 7, 14, 15,
    ];
    const positions = [
      [0, 1], [-0.5, 2], [0.5, 2], [-1, 3], [0, 3], [1, 3],
      [-1.5, 4], [-0.5, 4], [0.5, 4], [1.5, 4],
      [-2, 5], [-1, 5], [0, 5], [1, 5], [2, 5],
    ];

    for (let i = 0; i < positions.length; i++) {
      const [col, row] = positions[i];
      const ballId = rackOrder[i];
      const x = startX + col * d;
      const z = rackZ + (row - 1) * d * Math.sin(Math.PI / 3);
      this._placeBall(ballId, x, r, z);
    }
  }

  _rackNineBall() {
    const r = BALL.radius;
    const d = r * 2.02;
    const halfD = TABLE.depth / 2;

    // Cue ball: head spot (behind head string)
    this._placeBall(0, 0, r, -halfD * 0.55);

    // 9-ball only uses the cue ball plus balls 1-9.
    for (let id = 10; id <= 15; id++) {
      this._removeBallFromRack(id);
    }

    // Rack at foot spot (bottom of table)
    const rackZ = halfD * 0.55;

    // Diamond rack for 9-ball
    // Row 1: 1-ball (apex)
    // Row 2: 2-ball, 3-ball
    // Row 3: 4-ball, 9-ball (center), 5-ball
    // Row 4: 6-ball, 7-ball
    // Row 5: 8-ball (bottom)
    const diamondOrder = [
      1,            // row 1 (apex)
      2, 3,         // row 2
      4, 9, 5,      // row 3 (9 in center)
      6, 7,         // row 4
      8,            // row 5 (bottom)
    ];

    const positions = [
      [0, 0],           // row 1
      [-0.5, 1], [0.5, 1],  // row 2
      [-1, 2], [0, 2], [1, 2],  // row 3
      [-0.5, 3], [0.5, 3],  // row 4
      [0, 4],           // row 5
    ];

    for (let i = 0; i < positions.length; i++) {
      const [col, row] = positions[i];
      const ballId = diamondOrder[i];
      const x = col * d;
      const z = rackZ + row * d * Math.sin(Math.PI / 3);
      this._placeBall(ballId, x, r, z);
    }
  }

  _placeBall(id, x, y, z) {
    const ball = this.balls[id];
    ball.pocketed = false;
    ball.mesh.visible = true;
    ball.setPosition(x, y, z);
  }

  _removeBallFromRack(id) {
    const ball = this.balls[id];
    if (ball) ball.remove();
  }

  getCueBall() {
    return this.balls[0];
  }

  getBall(id) {
    return this.balls[id];
  }

  getActiveBalls() {
    return this.balls.filter(b => !b.pocketed);
  }

  sync() {
    for (const ball of this.balls) {
      if (!ball.pocketed) {
        ball.sync();
      }
    }
  }

  updatePhysicsGuards(dt, pocketPositions = []) {
    for (const ball of this.balls) {
      if (ball.pocketed) continue;
      ball.applySpinPhysics(dt);
      ball.applyLowSpeedBrake(dt);
      // Single safety clamp per frame (not inside every physics routine)
      ball.limitSpeed();
      this._enforceTableBounds(ball, pocketPositions);
    }
    this._resolveSweptBallContacts(pocketPositions);
    this._resolveBallOverlaps(pocketPositions);
    this._storePreviousPositions();
  }

  _storePreviousPositions() {
    for (const ball of this.balls) {
      if (ball.pocketed) {
        this.previousPositions.delete(ball.id);
      } else {
        this.previousPositions.set(ball.id, {
          x: ball.body.position.x,
          z: ball.body.position.z,
        });
      }
    }
  }

  _resolveSweptBallContacts(pocketPositions = []) {
    const contactDist = BALL.radius * 2 * BALL.sweepContactScale;
    const contactDistSq = contactDist * contactDist;
    const maxFrameMove = BALL.maxSpeed * 0.08;
    const maxFrameMoveSq = maxFrameMove * maxFrameMove;

    for (let i = 0; i < this.balls.length; i++) {
      const a = this.balls[i];
      if (a.pocketed) continue;
      const a0 = this.previousPositions.get(a.id);
      if (!a0) continue;

      for (let j = i + 1; j < this.balls.length; j++) {
        const b = this.balls[j];
        if (b.pocketed) continue;
        const b0 = this.previousPositions.get(b.id);
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

        this._resolveBallCollisionVelocity(a, b, nx, nz);
        this._notifyManualBallContact(a, b, Math.abs(relNormalSpeed));
        this._separateContactPair(a, b, nx, nz, contactDist);
        this._enforceTableBounds(a, pocketPositions);
        this._enforceTableBounds(b, pocketPositions);
        a.body.wakeUp();
        b.body.wakeUp();
        a.sync();
        b.sync();
      }
    }
  }

  _resolveBallOverlaps(pocketPositions = []) {
    const minDist = BALL.radius * 2 * 0.98;
    const minDistSq = minDist * minDist;

    for (let pass = 0; pass < BALL.overlapIterations; pass++) {
      for (let i = 0; i < this.balls.length; i++) {
        const a = this.balls[i];
        if (a.pocketed) continue;

        for (let j = i + 1; j < this.balls.length; j++) {
          const b = this.balls[j];
          if (b.pocketed) continue;

          const dx = b.body.position.x - a.body.position.x;
          const dz = b.body.position.z - a.body.position.z;
          const distSq = dx * dx + dz * dz;
          if (distSq >= minDistSq) continue;

          const dist = Math.sqrt(distSq) || 0.0001;
          const nx = distSq > 0.000001 ? dx / dist : 1;
          const nz = distSq > 0.000001 ? dz / dist : 0;
          this._separateContactPair(a, b, nx, nz, minDist);
          const relNormalSpeed = this._resolveBallCollisionVelocity(a, b, nx, nz);
          if (relNormalSpeed < -0.05) {
            this._notifyManualBallContact(a, b, Math.abs(relNormalSpeed));
          }

          this._enforceTableBounds(a, pocketPositions);
          this._enforceTableBounds(b, pocketPositions);
          a.body.wakeUp();
          b.body.wakeUp();
          a.sync();
          b.sync();
        }
      }
    }
  }

  _separateContactPair(a, b, nx, nz, targetDist) {
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

  _resolveBallCollisionVelocity(a, b, nx, nz) {
    const av = a.body.velocity;
    const bv = b.body.velocity;
    const aav = a.body.angularVelocity;
    const bav = b.body.angularVelocity;
    const relX = bv.x - av.x;
    const relZ = bv.z - av.z;
    const relNormalSpeed = relX * nx + relZ * nz;
    if (relNormalSpeed >= 0) return relNormalSpeed;

    // Equal-mass elastic collision: split impulse 50/50
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
    // BUG FIX: was subtracting spin term; must ADD it.
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

    a.limitSpeed();
    b.limitSpeed();
    return relNormalSpeed;
  }

  _notifyManualBallContact(a, b, relativeSpeed) {
    if (typeof this.onManualBallContact === 'function') {
      this.onManualBallContact(a, b, relativeSpeed);
    }
  }

  _enforceTableBounds(ball, pocketPositions) {
    if (this._isNearPocketMouth(ball, pocketPositions)) return;

    const halfW = TABLE.width / 2;
    const halfD = TABLE.depth / 2;
    // Escape limit: ball must have clearly left the table surface to trigger rescue.
    // Rail limit: place the ball just inside the cushion face.
    const cushionHalf = TABLE.cushionWidth;
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

      ball.body.wakeUp();
      ball.sync();
      this._notifyManualCushionContact(ball);
    }
  }

  _notifyManualCushionContact(ball) {
    if (typeof this.onManualCushionContact === 'function') {
      this.onManualCushionContact(ball);
    }
  }

  _isNearPocketMouth(ball, pocketPositions) {
    const pos = ball.body.position;
    const pocketPassRadius = POCKET.radius + POCKET.detectMargin * 0.95;
    const passSq = pocketPassRadius * pocketPassRadius;

    for (const pocket of pocketPositions) {
      const dx = pos.x - pocket.x;
      const dz = pos.z - pocket.z;
      if (dx * dx + dz * dz <= passSq) {
        return true;
      }
    }
    return false;
  }

  allStopped() {
    for (const ball of this.balls) {
      if (ball.pocketed) continue;
      if (ball.getSpeed() > BALL.sleepSpeedLimit) {
        return false;
      }
      if (ball.body.angularVelocity.length() > BALL.sleepAngularSpeedLimit) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check for pocketed balls. Returns array of {id, pocketIndex} objects
   * so callers know exactly which pocket each ball fell into.
   */
  checkPockets(pocketPositions) {
    const pocketed = [];
    const detectDist = POCKET.radius + POCKET.detectMargin;

    for (const ball of this.balls) {
      if (ball.pocketed) continue;
      for (let pi = 0; pi < pocketPositions.length; pi++) {
        const pocket = pocketPositions[pi];
        const dx = ball.mesh.position.x - pocket.x;
        const dz = ball.mesh.position.z - pocket.z;
        const distSq = dx * dx + dz * dz;
        if (distSq < detectDist * detectDist) {
          ball.remove();
          // Remove from physics world so it stops consuming simulation time
          this.physics.removeBody(ball.body);
          pocketed.push({ id: ball.id, pocketIndex: pi });
          break;
        }
      }
    }
    return pocketed;
  }

  resetCueBallIfPocketed(preferredX = 0, preferredZ = null) {
    const cue = this.balls[0];
    if (!cue.pocketed) return { x: cue.mesh.position.x, z: cue.mesh.position.z };

    const r = BALL.radius;
    const z = preferredZ ?? -TABLE.depth / 2 * 0.55;

    // Check if position is clear of other balls
    const checkClear = (x, z) => {
      for (const ball of this.balls) {
        if (ball.id === 0 || ball.pocketed) continue;
        const dx = ball.mesh.position.x - x;
        const dz = ball.mesh.position.z - z;
        if (dx * dx + dz * dz < (BALL.radius * 2.2) ** 2) {
          return false;
        }
      }
      return true;
    };

    // Try preferred position, then offset along X
    let finalX = preferredX;
    if (!checkClear(finalX, z)) {
      for (let offset = 1; offset <= 10; offset++) {
        if (checkClear(preferredX + offset * BALL.radius * 2, z)) {
          finalX = preferredX + offset * BALL.radius * 2;
          break;
        }
        if (checkClear(preferredX - offset * BALL.radius * 2, z)) {
          finalX = preferredX - offset * BALL.radius * 2;
          break;
        }
      }
    }

    cue.reset(finalX, r, z);
    // Re-add to physics world if it was removed during pocketing
    this.physics.addBody(cue.body);
    return { x: finalX, z };
  }
}
