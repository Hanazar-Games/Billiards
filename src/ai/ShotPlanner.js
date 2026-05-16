import * as THREE from 'three';
import { BALL, getBallType, BALL_TYPE, SHOT } from '../config.js';
import { getDefaultTableProfile } from '../game/TableProfiles.js';

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();

export class ShotPlanner {
  constructor() {}

  /**
   * Find all possible shots for the current player.
   * Returns array of candidate shots sorted by score (best first).
   */
  findAllShots(balls, cueBall, pocketPositions, playerGroup, isBreak = false, targetBallId = null, enableBank = false, tableProfile = null) {
    const candidates = [];
    const r = BALL.radius;
    const cuePos = cueBall.mesh.position;

    for (const target of balls) {
      if (target.pocketed || target.id === 0) continue;
      if (targetBallId !== null && target.id !== targetBallId) continue;

      const targetType = getBallType(target.id);

      // 8-ball is never a valid target during break
      if (targetType === BALL_TYPE.EIGHT && targetBallId === null) continue;

      // After break, only own group balls are valid targets
      if (!isBreak && playerGroup) {
        const ownGroup = playerGroup === 'solid' ? BALL_TYPE.SOLID : BALL_TYPE.STRIPE;
        const hasCleared = this.hasClearedGroup(balls, playerGroup);

        if (targetType !== ownGroup) {
          continue; // can't hit opponent's ball first
        }
      }

      for (let pi = 0; pi < pocketPositions.length; pi++) {
        const pocket = pocketPositions[pi];
        const shot = this.evaluateShot(cuePos, target, pocket, balls, pi, tableProfile);
        if (shot) {
          candidates.push(shot);
        }
      }
    }

    // Also consider 8-ball shot if player has cleared their group (and not on break)
    if (!isBreak && playerGroup) {
      const hasCleared = this.hasClearedGroup(balls, playerGroup);
      if (hasCleared) {
        const eightBall = balls.find(b => b.id === 8 && !b.pocketed);
        if (eightBall) {
          for (let pi = 0; pi < pocketPositions.length; pi++) {
            const pocket = pocketPositions[pi];
            const shot = this.evaluateShot(cuePos, eightBall, pocket, balls, pi, tableProfile);
            if (shot) {
              // Boost 8-ball shot score slightly so AI prioritizes it
              shot.score += 15;
              candidates.push(shot);
            }
          }
        }
      }
    }

    // Bank shots for expanded options (only when enabled)
    if (enableBank) {
      const bankShots = this.findBankShots(
        balls, cueBall, pocketPositions, playerGroup, isBreak, targetBallId
      );
      candidates.push(...bankShots);
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);
    return candidates;
  }

  /**
   * Find all one-cushion bank shots.
   */
  findBankShots(balls, cueBall, pocketPositions, playerGroup, isBreak = false, targetBallId = null) {
    const candidates = [];
    const cuePos = cueBall.mesh.position;
    const cushions = ['top', 'bottom', 'left', 'right'];

    for (const target of balls) {
      if (target.pocketed || target.id === 0) continue;
      if (targetBallId !== null && target.id !== targetBallId) continue;

      const targetType = getBallType(target.id);
      if (targetType === BALL_TYPE.EIGHT && targetBallId === null) continue;
      if (!isBreak && playerGroup) {
        const ownGroup = playerGroup === 'solid' ? BALL_TYPE.SOLID : BALL_TYPE.STRIPE;
        if (targetType !== ownGroup) continue;
      }

      for (let pi = 0; pi < pocketPositions.length; pi++) {
        const pocket = pocketPositions[pi];
        for (const cushion of cushions) {
          const shot = this.evaluateBankShot(cuePos, target, pocket, balls, pi, cushion);
          if (shot) candidates.push(shot);
        }
      }
    }

    if (!isBreak && playerGroup) {
      const hasCleared = this.hasClearedGroup(balls, playerGroup);
      if (hasCleared) {
        const eightBall = balls.find(b => b.id === 8 && !b.pocketed);
        if (eightBall) {
          for (let pi = 0; pi < pocketPositions.length; pi++) {
            const pocket = pocketPositions[pi];
            for (const cushion of cushions) {
              const shot = this.evaluateBankShot(cuePos, eightBall, pocket, balls, pi, cushion);
              if (shot) {
                shot.score += 10;
                candidates.push(shot);
              }
            }
          }
        }
      }
    }

    return candidates;
  }

  evaluateBankShot(cuePos, targetBall, pocketPos, allBalls, pocketIndex, cushionSide, tableProfile = null) {
    const profile = tableProfile || getDefaultTableProfile();
    const r = BALL.radius;
    const targetPos = targetBall.mesh.position;
    const halfW = profile.width / 2;
    const halfD = profile.depth / 2;

    // Virtual pocket via mirror across cushion
    let virtualPocket;
    switch (cushionSide) {
      case 'top':    virtualPocket = new THREE.Vector3(pocketPos.x, pocketPos.y, -halfD * 2 - pocketPos.z); break;
      case 'bottom': virtualPocket = new THREE.Vector3(pocketPos.x, pocketPos.y,  halfD * 2 - pocketPos.z); break;
      case 'left':   virtualPocket = new THREE.Vector3(-halfW * 2 - pocketPos.x, pocketPos.y, pocketPos.z); break;
      case 'right':  virtualPocket = new THREE.Vector3( halfW * 2 - pocketPos.x, pocketPos.y, pocketPos.z); break;
    }

    _v1.subVectors(virtualPocket, targetPos);
    const distTargetToVirtual = _v1.length();
    if (distTargetToVirtual < r) return null;
    _v1.normalize();

    // Ghost ball for bank shot
    const ghostPos = _v2.copy(targetPos).addScaledVector(_v1, -2 * r);
    const ghostPosClone = ghostPos.clone();

    const margin = r * 2;
    if (Math.abs(ghostPos.x) > halfW - margin || Math.abs(ghostPos.z) > halfD - margin) return null;

    // Cue to ghost path
    if (this.isPathBlocked(cuePos, ghostPos, allBalls, new Set([0, targetBall.id]), 2.05, tableProfile)) return null;

    // Bounce point on cushion
    let bouncePoint;
    let t;
    switch (cushionSide) {
      case 'top':
        if (_v1.z >= -0.001) return null;
        t = (-halfD - targetPos.z) / _v1.z;
        break;
      case 'bottom':
        if (_v1.z <= 0.001) return null;
        t = (halfD - targetPos.z) / _v1.z;
        break;
      case 'left':
        if (_v1.x >= -0.001) return null;
        t = (-halfW - targetPos.x) / _v1.x;
        break;
      case 'right':
        if (_v1.x <= 0.001) return null;
        t = (halfW - targetPos.x) / _v1.x;
        break;
    }
    if (t <= r || t > distTargetToVirtual + r) return null;
    bouncePoint = targetPos.clone().addScaledVector(_v1, t);

    // Bounce point must be on cushion face, away from pocket mouths
    const cushionMargin = profile.pocketRadius * 1.6;
    if (cushionSide === 'top' || cushionSide === 'bottom') {
      if (Math.abs(bouncePoint.x) > halfW - cushionMargin) return null;
    } else {
      if (Math.abs(bouncePoint.z) > halfD - cushionMargin) return null;
    }

    // Target to bounce path
    if (this.isPathBlocked(targetPos, bouncePoint, allBalls, new Set([targetBall.id]), 2.05, tableProfile)) return null;
    // Bounce to pocket path
    if (this.isPathBlocked(bouncePoint, pocketPos, allBalls, new Set([targetBall.id]), 2.05, tableProfile)) return null;

    const distCueToGhost = cuePos.distanceTo(ghostPos);
    const distTargetToPocket = targetPos.distanceTo(pocketPos);
    const distTargetToBounce = targetPos.distanceTo(bouncePoint);
    const distBounceToPocket = bouncePoint.distanceTo(pocketPos);

    let score = 78; // lower base than direct shot
    score -= distCueToGhost * 0.12;
    score -= distTargetToPocket * 0.07;

    // Bounce angle quality: closer to perpendicular is better
    let normal;
    switch (cushionSide) {
      case 'top':    normal = new THREE.Vector3(0, 0, 1); break;
      case 'bottom': normal = new THREE.Vector3(0, 0, -1); break;
      case 'left':   normal = new THREE.Vector3(1, 0, 0); break;
      case 'right':  normal = new THREE.Vector3(-1, 0, 0); break;
    }
    const approachDot = Math.abs(_v1.dot(normal));
    const approachDeg = (Math.acos(THREE.MathUtils.clamp(approachDot, 0, 1)) * 180) / Math.PI;
    score += (approachDeg / 90) * 20;

    // Impact angle quality
    _v3.subVectors(ghostPos, cuePos).normalize();
    const impactAngle = Math.acos(THREE.MathUtils.clamp(_v3.dot(_v1), -1, 1));
    const angleDeg = (impactAngle * 180) / Math.PI;
    score += (angleDeg / 180) * 22;

    const totalDist = distCueToGhost + distTargetToBounce + distBounceToPocket;
    let power = Math.max(SHOT.minPower, totalDist * 0.20);
    power = Math.min(power, SHOT.maxPower * 0.88);

    return {
      targetBallId: targetBall.id,
      pocketIndex,
      ghostPos: ghostPosClone,
      aimDirection: _v3.clone(),
      power,
      score: Math.max(score, 5),
      distCueToGhost,
      distToPocket: distTargetToPocket,
      impactAngle: angleDeg,
      isBank: true,
    };
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
  evaluateShot(cuePos, targetBall, pocketPos, allBalls, pocketIndex, tableProfile = null) {
    const r = BALL.radius;
    const targetPos = targetBall.mesh.position;

    // Direction from target to pocket
    _v1.subVectors(pocketPos, targetPos);
    const distToPocket = _v1.length();
    if (distToPocket < r) return null;

    _v1.normalize();

    // Ghost ball position: where cue ball needs to be to pocket target
    const ghostPos = _v2.copy(targetPos).addScaledVector(_v1, -2 * r);
      const ghostPosClone = ghostPos.clone();

    // Check ghost ball is on the table (with cushion margin)
    const profile = tableProfile || getDefaultTableProfile();
    const margin = r * 2;
    const halfW = profile.width / 2 - margin;
    const halfD = profile.depth / 2 - margin;
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
      ghostPos: ghostPosClone,
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
   * Considers cue ball position after hit: far from pockets,
   * near cushions, and ideally blocked from hitting target balls.
   */
  findSafetyShot(balls, cueBall, pocketPositions, targetBallId = null, tableProfile = null) {
    const cuePos = cueBall.mesh.position;
    let best = null;
    let bestScore = -Infinity;
    const profile = tableProfile || getDefaultTableProfile();
    const r = BALL.radius;
    const halfW = profile.width / 2 - profile.cushionWidth;
    const halfD = profile.depth / 2 - profile.cushionWidth;

    for (const target of balls) {
      if (target.pocketed || target.id === 0) continue;
      if (targetBallId !== null && target.id !== targetBallId) continue;

      const targetPos = target.mesh.position;
      _v1.subVectors(targetPos, cuePos).normalize();
      const ghostPos = _v2.copy(targetPos).addScaledVector(_v1, -2 * r);
      const ghostPosClone = ghostPos.clone();

      if (this.isPathBlocked(cuePos, ghostPos, balls, [0, target.id])) continue;

      // Estimate where cue ball will end up after the hit (very rough: along reflection)
      const cueReflection = _v3.copy(_v1).negate();
      const estimatedCuePos = _v2.copy(ghostPos).addScaledVector(cueReflection, r * 4);

      const score = this._scoreSafety(estimatedCuePos, pocketPositions, balls, halfW, halfD, r);
      if (score > bestScore) {
        bestScore = score;
        best = {
          targetBallId: target.id,
          pocketIndex: -1,
          ghostPos: ghostPosClone,
          aimDirection: _v1.clone(),
          power: Math.min(SHOT.maxPower * 0.35, 22),
          score,
          isSafety: true,
        };
      }
    }

    return best;
  }

  /**
   * Score a safety position. Higher = better safety.
   * Rewards: far from pockets, near cushions, blocked from target balls.
   */
  _scoreSafety(cuePos, pocketPositions, balls, halfW, halfD, r) {
    let score = 50;

    // Far from any pocket (don't scratch)
    let minPocketDist = Infinity;
    for (const pocket of pocketPositions) {
      minPocketDist = Math.min(minPocketDist, cuePos.distanceTo(pocket));
    }
    score += Math.min(minPocketDist / 10, 25);

    // Near a cushion (harder for opponent to attack)
    const cushionDist = Math.min(
      halfW - Math.abs(cuePos.x),
      halfD - Math.abs(cuePos.z)
    );
    if (cushionDist < r * 3) score += 15;
    else if (cushionDist < r * 6) score += 8;

    // Blocked from hitting most target balls (good)
    let blockedCount = 0;
    for (const ball of balls) {
      if (ball.pocketed || ball.id === 0) continue;
      if (this.isPathBlocked(cuePos, ball.mesh.position, balls, [0, ball.id])) {
        blockedCount++;
      }
    }
    score += blockedCount * 3;

    return Math.min(score, 100);
  }

}
