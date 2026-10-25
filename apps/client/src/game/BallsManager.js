import { Ball } from './Ball.js';
import { BALL, BALL_COLORS, getBallType, BALL_TYPE } from '../config.js';
import { getDefaultTableProfile } from './TableProfiles.js';
import { resolveDrillPositions } from '../trainer/DrillData.js';

export class BallsManager {
  constructor(tableProfile = null) {
    this.profile = tableProfile || getDefaultTableProfile();
    this.balls = [];
  }

  addToScene(scene) {
    for (const ball of this.balls) {
      if (ball.pocketed) continue;
      if (ball.mesh.parent !== scene) {
        scene.add(ball.mesh);
      }
    }
  }

  createBalls() {
    if (this.balls.length > 0) return; // prevent double-create
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
    const halfD = this.profile.depth / 2;

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
    const halfD = this.profile.depth / 2;

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

  /**
   * Setup a specific drill layout.
   * Places balls at preset positions and removes unused balls.
   */
  setupDrill(drill, profile) {
    if (this.balls.length === 0) {
      this.createBalls();
    }

    const { positions, idealZone } = resolveDrillPositions(drill, profile);
    const usedIds = new Set(Object.keys(drill.ballPositions).map(Number));

    // Place used balls
    for (const [ballIdStr, pos] of Object.entries(positions)) {
      const ballId = parseInt(ballIdStr, 10);
      this._placeBall(ballId, pos.x, BALL.radius, pos.z);
    }

    // Remove unused balls (hide them from play)
    for (const ball of this.balls) {
      if (!usedIds.has(ball.id)) {
        ball.remove();
      }
    }

    return { idealZone };
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

  /**
   * The table as the simulation sees it, read from the meshes (the meshes are
   * where each ball is; the shot playback moves them).
   * @param {string} tableProfileId
   * @returns {import('@billiards/sim').TableState}
   */
  toTableState(tableProfileId) {
    return {
      tableProfileId,
      balls: this.balls.map(ball => {
        const p = ball.mesh.position;
        const q = ball.mesh.quaternion;
        return { id: ball.id, x: p.x, z: p.z, q: [q.x, q.y, q.z, q.w], pocketed: ball.pocketed };
      }),
    };
  }

  /**
   * Puts the balls where `state` says. A pocketed ball leaves the table; the
   * others are placed on the cloth at rest.
   * @param {import('@billiards/sim').TableState} state
   */
  applyTableState(state) {
    for (const s of state.balls) {
      const ball = this.getBall(s.id);
      if (!ball) continue;
      if (s.pocketed) {
        if (!ball.pocketed) ball.remove();
        continue;
      }
      ball.pocketed = false;
      ball.mesh.visible = true;
      ball.mesh.position.set(s.x, BALL.radius, s.z);
      if (s.q) ball.mesh.quaternion.set(s.q[0], s.q[1], s.q[2], s.q[3]);
      ball.speed = 0;
    }
  }

  resetCueBallIfPocketed(preferredX = 0, preferredZ = null) {
    const cue = this.balls[0];
    if (!cue.pocketed) return { x: cue.mesh.position.x, z: cue.mesh.position.z };

    const r = BALL.radius;
    const z = preferredZ ?? -this.profile.depth / 2 * 0.55;

    // Stay inside the playing surface, away from cushion faces
    const halfW = this.profile.width / 2 - this.profile.cushionWidth - BALL.radius;
    const halfD = this.profile.depth / 2 - this.profile.cushionWidth - BALL.radius;

    const checkClear = (x, z) => {
      if (x < -halfW || x > halfW || z < -halfD || z > halfD) return false;
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
