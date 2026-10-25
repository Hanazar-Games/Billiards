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

  /**
   * Racks from a layout (packages/modes rackLayout): the listed balls go on
   * the table at y = BALL.radius, the others leave it (9-ball has no 10–15).
   * @param {{ id: number, x: number, z: number }[]} layout
   */
  applyLayout(layout) {
    if (this.balls.length === 0) {
      this.createBalls();
    }
    const listed = new Set(layout.map((b) => b.id));
    for (const { id, x, z } of layout) this._placeBall(id, x, BALL.radius, z);
    for (const ball of this.balls) {
      if (!listed.has(ball.id)) this._removeBallFromRack(ball.id);
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
