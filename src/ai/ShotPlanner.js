import * as THREE from 'three';
import { BALL, getBallType, BALL_TYPE, SHOT } from '../config.js';
import { getDefaultTableProfile } from '../game/TableProfiles.js';

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();

export class ShotPlanner {
  constructor() {}

  findAllShots(balls, cueBall, pocketPositions, playerGroup, isBreak = false, targetBallId = null, enableBank = false, tableProfile = null) {
    const candidates = [];
    const r = BALL.radius;
    if (!cueBall || !cueBall.mesh) return candidates;
    const cuePos = cueBall.mesh.position;

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
        const shot = this.evaluateShot(cuePos, target, pocket, balls, pi, tableProfile);
        if (shot) candidates.push(shot);
      }
    }

    if (!isBreak && playerGroup) {
      const hasCleared = this.hasClearedGroup(balls, playerGroup);
      if (hasCleared) {
        const eightBall = balls.find(b => b.id === 8 && !b.pocketed);
        if (eightBall) {
          for (let pi = 0; pi < pocketPositions.length; pi++) {
            const pocket = pocketPositions[pi];
            const shot = this.evaluateShot(cuePos, eightBall, pocket, balls, pi, tableProfile);
            if (shot) {
              shot.score += 15;
              candidates.push(shot);
            }
          }
        }
      }
    }

    if (enableBank) {
      const bankShots = this.findBankShots(
        balls, cueBall, pocketPositions, playerGroup, isBreak, targetBallId, tableProfile
      );
      candidates.push(...bankShots);
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates;
  }

  findBankShots(balls, cueBall, pocketPositions, playerGroup, isBreak = false, targetBallId = null, tableProfile = null) {
    const candidates = [];
    if (!cueBall || !cueBall.mesh) return candidates;
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
    if (!targetBall || !targetBall.mesh) return null;
    const targetPos = targetBall.mesh.position;
    const halfW = profile.width / 2;
    const halfD = profile.depth / 2;

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

    const ghostPos = _v2.copy(targetPos).addScaledVector(_v1, -2 * r);
    const ghostPosClone = ghostPos.clone();

    const margin = r * 2;
    if (Math.abs(ghostPos.x) > halfW - margin || Math.abs(ghostPos.z) > halfD - margin) return null;

    // FIX: use array instead of Set for excludedIds (isPathBlocked expects array with .includes)
    if (this.isPathBlocked(cuePos, ghostPos, allBalls, [0, targetBall.id])) return null;

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

    const cushionMargin = profile.pocketRadius * 1.6;
    if (cushionSide === 'top' || cushionSide === 'bottom') {
      if (Math.abs(bouncePoint.x) > halfW - cushionMargin) return null;
    } else {
      if (Math.abs(bouncePoint.z) > halfD - cushionMargin) return null;
    }

    if (this.isPathBlocked(targetPos, bouncePoint, allBalls, [targetBall.id])) return null;
    if (this.isPathBlocked(bouncePoint, pocketPos, allBalls, [targetBall.id])) return null;

    const distCueToGhost = cuePos.distanceTo(ghostPos);
    const distTargetToPocket = targetPos.distanceTo(pocketPos);
    const distTargetToBounce = targetPos.distanceTo(bouncePoint);
    const distBounceToPocket = bouncePoint.distanceTo(pocketPos);

    let score = 78;
    score -= distCueToGhost * 0.12;
    score -= distTargetToPocket * 0.07;

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

  evaluateShot(cuePos, targetBall, pocketPos, allBalls, pocketIndex, tableProfile = null) {
    const r = BALL.radius;
    if (!targetBall || !targetBall.mesh) return null;
    const targetPos = targetBall.mesh.position;

    _v1.subVectors(pocketPos, targetPos);
    const distToPocket = _v1.length();
    if (distToPocket < r) return null;

    _v1.normalize();

    const ghostPos = _v2.copy(targetPos).addScaledVector(_v1, -2 * r);
    const ghostPosClone = ghostPos.clone();

    const profile = tableProfile || getDefaultTableProfile();
    const margin = r * 2;
    const halfW = profile.width / 2 - margin;
    const halfD = profile.depth / 2 - margin;
    if (Math.abs(ghostPos.x) > halfW || Math.abs(ghostPos.z) > halfD) {
      return null;
    }

    _v3.subVectors(ghostPos, cuePos);
    const distCueToGhost = _v3.length();
    if (distCueToGhost < r * 0.5) return null;

    _v3.normalize();

    if (this.isPathBlocked(cuePos, ghostPos, allBalls, [0, targetBall.id])) {
      return null;
    }

    if (this.isPathBlocked(targetPos, pocketPos, allBalls, [targetBall.id])) {
      return null;
    }

    let score = 100;
    score -= distCueToGhost * 0.08;
    score -= distToPocket * 0.03;

    const impactAngle = Math.acos(THREE.MathUtils.clamp(_v3.dot(_v1), -1, 1));
    const angleDeg = (impactAngle * 180) / Math.PI;
    score += (angleDeg / 180) * 30;

    score += (1 - Math.min(distToPocket / 150, 1)) * 20;

    let power = Math.max(SHOT.minPower, distCueToGhost * 0.35 + distToPocket * 0.15);
    power = Math.min(power, SHOT.maxPower * 0.85);

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

  isPathBlocked(a, b, allBalls, excludedIds = []) {
    const r = BALL.radius * 2.05;
    const abx = b.x - a.x;
    const abz = b.z - a.z;
    const abLenSq = abx * abx + abz * abz;

    if (abLenSq < 0.001) {
      // Degenerate path: check if any non-excluded ball sits at point a
      for (const ball of allBalls) {
        if (ball.pocketed) continue;
        if (excludedIds.includes(ball.id)) continue;
        const dx = ball.mesh.position.x - a.x;
        const dz = ball.mesh.position.z - a.z;
        if (dx * dx + dz * dz < r * r) return true;
      }
      return false;
    }

    for (const ball of allBalls) {
      if (ball.pocketed) continue;
      if (excludedIds.includes(ball.id)) continue;

      const acx = ball.mesh.position.x - a.x;
      const acz = ball.mesh.position.z - a.z;
      const t = (acx * abx + acz * abz) / abLenSq;

      if (t < -0.1 || t > 1.1) continue;

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

  findSafetyShot(balls, cueBall, pocketPositions, targetBallId = null, tableProfile = null) {
    if (!cueBall || !cueBall.mesh) return null;
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

  _scoreSafety(cuePos, pocketPositions, balls, halfW, halfD, r) {
    let score = 50;

    let minPocketDist = Infinity;
    for (const pocket of pocketPositions) {
      minPocketDist = Math.min(minPocketDist, cuePos.distanceTo(pocket));
    }
    score += Math.min(minPocketDist / 10, 25);

    const cushionDist = Math.min(
      halfW - Math.abs(cuePos.x),
      halfD - Math.abs(cuePos.z)
    );
    if (cushionDist < r * 3) score += 15;
    else if (cushionDist < r * 6) score += 8;

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
