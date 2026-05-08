import * as THREE from 'three';
import { BALL, TABLE, getBallType, BALL_TYPE, SHOT } from '../config.js';

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();

export class ShotPlanner {
  constructor() {}

  /**
   * Find all possible shots for the current player.
   * Returns array of candidate shots sorted by score (best first).
   */
  findAllShots(balls, cueBall, pocketPositions, playerGroup, isBreak = false) {
    const candidates = [];
    const r = BALL.radius;
    const cuePos = cueBall.mesh.position;

    for (const target of balls) {
      if (target.pocketed || target.id === 0) continue;

      const targetType = getBallType(target.id);

      // During break, any ball except 8-ball is valid target for planning
      // After break, only own group or 8-ball (if cleared)
      if (!isBreak && playerGroup) {
        const ownGroup = playerGroup === 'solid' ? BALL_TYPE.SOLID : BALL_TYPE.STRIPE;
        const hasCleared = this.hasClearedGroup(balls, playerGroup);

        if (targetType === BALL_TYPE.EIGHT) {
          if (!hasCleared) continue; // can't hit 8-ball yet
        } else if (targetType !== ownGroup) {
          continue; // can't hit opponent's ball first
        }
      }

      for (let pi = 0; pi < pocketPositions.length; pi++) {
        const pocket = pocketPositions[pi];
        const shot = this.evaluateShot(cuePos, target, pocket, balls, pi);
        if (shot) {
          candidates.push(shot);
        }
      }
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);
    return candidates;
  }

  hasClearedGroup(balls, group) {
    const targetType = group === 'solid' ? BALL_TYPE.SOLID : BALL_TYPE.STRIPE;
    for (const ball of balls) {
      if (ball.pocketed) continue;
      if (getBallType(ball.id) === targetType) return false;
    }
    return true;
  }

  /**
   * Evaluate a single shot: cue -> target -> pocket
   */
  evaluateShot(cuePos, targetBall, pocketPos, allBalls, pocketIndex) {
    const r = BALL.radius;
    const targetPos = targetBall.mesh.position;

    // Direction from target to pocket
    _v1.subVectors(pocketPos, targetPos);
    const distToPocket = _v1.length();
    if (distToPocket < r) return null;

    _v1.normalize();

    // Ghost ball position: where cue ball needs to be to pocket target
    const ghostPos = _v2.copy(targetPos).addScaledVector(_v1, -2 * r);

    // Check ghost ball is on the table (with cushion margin)
    const margin = r * 2;
    const halfW = TABLE.width / 2 - margin;
    const halfD = TABLE.depth / 2 - margin;
    if (Math.abs(ghostPos.x) > halfW || Math.abs(ghostPos.z) > halfD) {
      return null;
    }

    // Direction from cue to ghost ball
    _v3.subVectors(ghostPos, cuePos);
    const distCueToGhost = _v3.length();
    if (distCueToGhost < r * 0.5) return null;

    _v3.normalize();

    // Check cue ball path to ghost ball is clear
    if (this.isPathBlocked(cuePos, ghostPos, allBalls, [0, targetBall.id])) {
      return null;
    }

    // Check target ball path to pocket is clear
    if (this.isPathBlocked(targetPos, pocketPos, allBalls, [targetBall.id])) {
      return null;
    }

    // Calculate score
    let score = 100;

    // Distance penalty: closer shots are easier
    score -= distCueToGhost * 0.08;
    score -= distToPocket * 0.03;

    // Angle quality: how "full" is the contact
    // Ideal: cue-ghost-target forms 180 degrees (straight line)
    const impactAngle = Math.acos(THREE.MathUtils.clamp(_v3.dot(_v1), -1, 1));
    const angleDeg = (impactAngle * 180) / Math.PI;
    // 180 = full contact (best), 0 = glance (worst)
    score += (angleDeg / 180) * 30;

    // Pocket proximity: closer pockets are easier
    score += (1 - Math.min(distToPocket / 150, 1)) * 20;

    // Calculate power needed
    let power = Math.max(SHOT.minPower, distCueToGhost * 0.35 + distToPocket * 0.15);
    power = Math.min(power, SHOT.maxPower * 0.85); // AI doesn't usually max power

    return {
      targetBallId: targetBall.id,
      pocketIndex,
      ghostPos: ghostPos.clone(),
      aimDirection: _v3.clone(),
      power,
      score: Math.max(score, 10),
      distCueToGhost,
      distToPocket,
      impactAngle: angleDeg,
    };
  }

  /**
   * Check if line segment A->B is blocked by any ball.
   * excludedIds: ball IDs to ignore in check.
   */
  isPathBlocked(a, b, allBalls, excludedIds = []) {
    const r = BALL.radius * 2.05; // slightly more than 2r for safety
    const abx = b.x - a.x;
    const abz = b.z - a.z;
    const abLenSq = abx * abx + abz * abz;

    if (abLenSq < 0.001) return false;

    for (const ball of allBalls) {
      if (ball.pocketed) continue;
      if (excludedIds.includes(ball.id)) continue;

      // Project ball center onto line AB
      const acx = ball.mesh.position.x - a.x;
      const acz = ball.mesh.position.z - a.z;
      const t = (acx * abx + acz * abz) / abLenSq;

      if (t < -0.1 || t > 1.1) continue; // outside segment (small margin)

      // Closest point on segment
      const closestX = a.x + t * abx;
      const closestZ = a.z + t * abz;

      const dx = ball.mesh.position.x - closestX;
      const dz = ball.mesh.position.z - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < r * r) {
        return true;
      }
    }

    return false;
  }

  /**
   * Find a safety shot when no direct pocket is available.
   * Just hits the best positioned opponent ball toward a cushion.
   */
  findSafetyShot(balls, cueBall, pocketPositions) {
    const cuePos = cueBall.mesh.position;
    let best = null;
    let bestScore = -Infinity;

    for (const target of balls) {
      if (target.pocketed || target.id === 0) continue;

      const targetPos = target.mesh.position;
      _v1.subVectors(targetPos, cuePos).normalize();
      const ghostPos = _v2.copy(targetPos).addScaledVector(_v1, -2 * BALL.radius);

      if (this.isPathBlocked(cuePos, ghostPos, balls, [0, target.id])) continue;

      // Score: distance to pocket after hit (don't want to accidentally pocket)
      let minPocketDist = Infinity;
      for (const pocket of pocketPositions) {
        const d = targetPos.distanceTo(pocket);
        if (d < minPocketDist) minPocketDist = d;
      }

      const score = minPocketDist; // farther from pockets is better for safety
      if (score > bestScore) {
        bestScore = score;
        best = {
          targetBallId: target.id,
          pocketIndex: -1,
          ghostPos: ghostPos.clone(),
          aimDirection: _v1.clone(),
          power: Math.min(SHOT.maxPower * 0.4, 25),
          score: 50,
          isSafety: true,
        };
      }
    }

    return best;
  }
}
