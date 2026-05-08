import { Ball } from './Ball.js';
import { BALL, BALL_COLORS, TABLE, POCKET, getBallType, BALL_TYPE } from '../config.js';
import * as THREE from 'three';

export class BallsManager {
  constructor(physics) {
    this.physics = physics;
    this.balls = [];
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

  rackBalls() {
    if (this.balls.length === 0) {
      this.createBalls();
    }

    const r = BALL.radius;
    const d = r * 2.02; // slight gap to prevent explosion on spawn
    const halfD = TABLE.depth / 2;

    // Cue ball: head spot (top of table, near player)
    this.balls[0].setPosition(0, r, -halfD * 0.55);

    // Rack at foot spot (bottom of table)
    const rackZ = halfD * 0.55;
    const startX = 0;

    // Triangle rack: 5 rows, apex pointing to foot (positive Z)
    // Standard 8-ball rack rules:
    // - 8-ball must be in center of row 3
    // - One solid and one stripe must be at each bottom corner (row 5)
    // - Others can be any, but we alternate for visual balance
    const rackOrder = [
      1,                    // row 1 (apex)
      9, 10,                // row 2 (stripe, stripe)
      2, 8, 3,              // row 3 (solid, 8-ball, solid)
      11, 4, 5, 12,         // row 4 (stripe, solid, solid, stripe)
      13, 6, 7, 14, 15,     // row 5 (stripe, solid, solid, stripe, stripe)
    ];
    // Row 5 corners: 13(stripe) and 15(stripe) -- WRONG! Need one solid corner.
    // Let me fix: 6(solid) and 15(stripe) as corners.
    const rackOrderFixed = [
      1,                    // row 1
      9, 10,                // row 2
      2, 8, 3,              // row 3
      11, 4, 5, 12,         // row 4
      6, 13, 7, 14, 15,     // row 5: corners 6(solid) and 15(stripe)
    ];

    // Grid positions: col offset, row index (1-based)
    const positions = [
      [0, 1],
      [-0.5, 2], [0.5, 2],
      [-1, 3], [0, 3], [1, 3],
      [-1.5, 4], [-0.5, 4], [0.5, 4], [1.5, 4],
      [-2, 5], [-1, 5], [0, 5], [1, 5], [2, 5],
    ];

    for (let i = 0; i < positions.length; i++) {
      const [col, row] = positions[i];
      const ballId = rackOrderFixed[i];
      const x = startX + col * d;
      const z = rackZ + (row - 1) * d * Math.sin(Math.PI / 3);
      this.balls[ballId].setPosition(x, r, z);
    }
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

  allStopped() {
    for (const ball of this.balls) {
      if (!ball.pocketed && ball.getSpeed() > BALL.sleepSpeedLimit) {
        return false;
      }
    }
    return true;
  }

  checkPockets(pocketPositions) {
    const pocketedIds = [];
    const detectDist = POCKET.radius + POCKET.detectMargin;

    for (const ball of this.balls) {
      if (ball.pocketed) continue;
      for (const pocket of pocketPositions) {
        const dx = ball.mesh.position.x - pocket.x;
        const dz = ball.mesh.position.z - pocket.z;
        const distSq = dx * dx + dz * dz;
        if (distSq < detectDist * detectDist) {
          ball.remove();
          pocketedIds.push(ball.id);
          break;
        }
      }
    }
    return pocketedIds;
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
    return { x: finalX, z };
  }
}
