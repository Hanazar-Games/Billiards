import { Ball } from './Ball.js';
import { BALL, BALL_COLORS, TABLE, POCKET, getBallType, BALL_TYPE } from '../config.js';

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

  allStopped() {
    for (const ball of this.balls) {
      if (!ball.pocketed && ball.getSpeed() > BALL.sleepSpeedLimit) {
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
    return { x: finalX, z };
  }
}
