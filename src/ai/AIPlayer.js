import { ShotPlanner } from './ShotPlanner.js';
import { SHOT } from '../config.js';
import { getDefaultTableProfile } from '../game/TableProfiles.js';

export const AI_DIFFICULTY = {
  EASY: 'easy',
  NORMAL: 'normal',
  HARD: 'hard',
};

export class AIPlayer {
  constructor(difficulty = AI_DIFFICULTY.NORMAL) {
    this.difficulty = difficulty;
    this.planner = new ShotPlanner();
    this.thinking = false;
    this.settings = this.getSettings(difficulty);
  }

  getSettings(difficulty) {
    switch (difficulty) {
      case AI_DIFFICULTY.EASY:
        return {
          angleNoise: 0.055,
          powerNoise: 0.20,
          thinkTimeMin: 1400,
          thinkTimeMax: 3500,
          missChance: 0.25,
          safetyAwareness: 0.05,
          positionPlayWeight: 0,
          spinSkill: 0.15,
          topShotPickRate: 0.65,
          bankShotEnable: false,
        };
      case AI_DIFFICULTY.HARD:
        return {
          angleNoise: 0.003,
          powerNoise: 0.012,
          thinkTimeMin: 400,
          thinkTimeMax: 1000,
          missChance: 0.0,
          safetyAwareness: 0.80,
          positionPlayWeight: 0.7,
          spinSkill: 1.0,
          topShotPickRate: 1.0,
          bankShotEnable: true,
        };
      default:
        return {
          angleNoise: 0.025,
          powerNoise: 0.10,
          thinkTimeMin: 900,
          thinkTimeMax: 2200,
          missChance: 0.10,
          safetyAwareness: 0.35,
          positionPlayWeight: 0.25,
          spinSkill: 0.55,
          topShotPickRate: 0.88,
          bankShotEnable: true,
        };
    }
  }

  async takeTurn(game) {
    if (this.thinking) return;
    this.thinking = true;

    try {
      const { ballsManager, table, rules } = game;
      if (!ballsManager || !table) {
        return null;
      }
      const cueBall = ballsManager.getCueBall();
      const pocketPositions = table.getPocketPositions();
      const status = rules?.getStatus?.() || { breakShot: false, targetBall: null };
      const playerGroup = typeof rules.getPlayerGroup === 'function'
        ? rules.getPlayerGroup(2)
        : null;
      const targetBallId = Number.isInteger(status.targetBall) ? status.targetBall : null;
      const isBreak = status.breakShot;

      const thinkTime = this.settings.thinkTimeMin + Math.random() * (this.settings.thinkTimeMax - this.settings.thinkTimeMin);
      await this.delay(thinkTime);

      if (!game.ballsManager || game.state === 'DISPOSED' || !this.thinking) {
        return null;
      }

      const tableProfile = game.tableProfile || getDefaultTableProfile();
      const allShots = this.planner.findAllShots(
        ballsManager.balls,
        cueBall,
        pocketPositions,
        playerGroup,
        isBreak,
        targetBallId,
        this.settings.bankShotEnable,
        tableProfile
      );

      let chosenShot = null;

      if (allShots.length === 0) {
        chosenShot = this.planner.findSafetyShot(ballsManager.balls, cueBall, pocketPositions, targetBallId, tableProfile);
        if (!chosenShot) {
          chosenShot = this.findDesperateShot(ballsManager.balls, cueBall, targetBallId);
        }
      } else {
        chosenShot = this._selectShot(allShots, ballsManager.balls, cueBall, pocketPositions, tableProfile);

        const s = this.settings;
        if (chosenShot.compositeScore < 35 && s.safetyAwareness > 0 &&
            Math.random() < s.safetyAwareness * 0.6) {
          const safety = this.planner.findSafetyShot(ballsManager.balls, cueBall, pocketPositions, targetBallId, tableProfile);
          if (safety) chosenShot = safety;
        }
      }

      if (!chosenShot) {
        chosenShot = {
          aimDirection: { x: 0, z: 1 },
          power: SHOT.minPower * 2,
        };
      }

      const finalAim = this.applyNoise(chosenShot.aimDirection);
      const finalPower = this.applyPowerNoise(chosenShot.power);
      const cueTipOffset = this._computeSpin(chosenShot, finalPower, ballsManager);
      const chargeTime = (finalPower / SHOT.maxPower) * 1200 + 300;

      return {
        aimDirection: finalAim,
        power: finalPower,
        chargeTime,
        cueTipOffset,
        originalShot: chosenShot,
      };
    } finally {
      this.thinking = false;
    }
  }

  /**
   * Difficulty-aware shot selection.
   * EASY: strongly prefers straight, close shots; dislikes thin cuts.
   * NORMAL: balances makeability with basic position and scratch avoidance.
   * HARD: values position play, next-ball availability, and can play thin cuts.
   */
  _selectShot(allShots, balls, cueBall, pocketPositions, tableProfile) {
    if (!allShots || allShots.length === 0) return null;
    const s = this.settings;

    const scored = allShots.map((shot) => {
      let compositeScore = shot.score;

      if (this.difficulty === AI_DIFFICULTY.EASY) {
        // Prefer straight shots (impactAngle near 180)
        if (shot.impactAngle > 150) compositeScore += 18;
        else if (shot.impactAngle > 120) compositeScore += 10;
        else if (shot.impactAngle < 60) compositeScore -= 15;

        // Penalize long cue-to-target and target-to-pocket distances
        if (shot.distCueToGhost > 100) compositeScore -= 12;
        if (shot.distToPocket > 120) compositeScore -= 10;

        // Slight anti-scratch instinct
        compositeScore += this._evaluateScratchRisk(shot, pocketPositions) * 0.2;
      } else if (this.difficulty === AI_DIFFICULTY.NORMAL) {
        // Moderate position awareness
        compositeScore += this._evaluatePositionPlay(shot, balls, cueBall, pocketPositions, tableProfile) * s.positionPlayWeight;
        compositeScore += this._evaluateScratchRisk(shot, pocketPositions) * s.safetyAwareness;
      } else if (this.difficulty === AI_DIFFICULTY.HARD) {
        // Full strategic evaluation
        compositeScore += this._evaluatePositionPlay(shot, balls, cueBall, pocketPositions, tableProfile) * s.positionPlayWeight;
        compositeScore += this._evaluateNextBall(shot, balls, cueBall, pocketPositions, tableProfile) * s.positionPlayWeight * 0.8;
        compositeScore += this._evaluateScratchRisk(shot, pocketPositions) * s.safetyAwareness * 0.5;
        // Skilled players embrace thin cuts when they lead to better position
        if (shot.impactAngle < 45) compositeScore += 8;
      }

      return { ...shot, compositeScore };
    });

    scored.sort((a, b) => b.compositeScore - a.compositeScore);

    let chosen;
    if (Math.random() < s.topShotPickRate) {
      chosen = { ...scored[0] };
    } else {
      const poolSize = this.difficulty === AI_DIFFICULTY.EASY
        ? Math.min(5, scored.length)
        : Math.min(3, scored.length);
      chosen = { ...scored[Math.floor(Math.random() * poolSize)] };
    }

    if (Math.random() < s.missChance) {
      chosen = this._perturbShot(chosen);
    }

    return chosen;
  }

  /** Enhanced position-play evaluation. Scores resulting cue ball position. */
  _evaluatePositionPlay(shot, balls, cueBall, pocketPositions, tableProfile) {
    if (!shot.ghostPos) return 0;

    const profile = tableProfile || getDefaultTableProfile();
    const halfW = profile.width / 2;
    const halfD = profile.depth / 2;
    const r = 2.8575; // BALL.radius
    const endX = shot.ghostPos.x;
    const endZ = shot.ghostPos.z;

    let score = 0;

    // Near a cushion (harder for opponent to attack)
    const cnx = Math.abs(endX) / halfW;
    const cnz = Math.abs(endZ) / halfD;
    if (cnx > 0.82 || cnz > 0.82) score += 18;
    else if (cnx > 0.65 || cnz > 0.65) score += 10;
    else if (cnx > 0.5 || cnz > 0.5) score += 4;

    // Far from pockets (anti-scratch)
    let minPocketDist = Infinity;
    for (const p of pocketPositions) {
      const d = Math.hypot(endX - p.x, endZ - p.z);
      if (d < minPocketDist) minPocketDist = d;
    }
    if (minPocketDist < r * 4) score -= 20;
    else if (minPocketDist < r * 8) score -= 8;
    else if (minPocketDist > r * 15) score += 8;

    // Is there a next shot available from the estimated cue position?
    for (const ball of balls) {
      if (ball.pocketed || ball.id === 0 || ball.id === shot.targetBallId) continue;
      const d = Math.hypot(ball.mesh.position.x - endX, ball.mesh.position.z - endZ);
      if (d < 70 && d > r * 3) {
        score += 6;
        break;
      }
    }

    return score;
  }

  /** Evaluate how many follow-up shots will be available after this shot. */
  _evaluateNextBall(shot, balls, cueBall, pocketPositions, tableProfile) {
    if (!shot.ghostPos) return 0;

    const r = 2.8575;
    const cueEnd = shot.ghostPos;
    let count = 0;

    for (const ball of balls) {
      if (ball.pocketed || ball.id === 0 || ball.id === shot.targetBallId) continue;

      for (const pocket of pocketPositions) {
        const dx = pocket.x - ball.mesh.position.x;
        const dz = pocket.z - ball.mesh.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist < r) continue;

        const gbx = ball.mesh.position.x - (dx / dist) * 2 * r;
        const gbz = ball.mesh.position.z - (dz / dist) * 2 * r;

        const cdx = gbx - cueEnd.x;
        const cdz = gbz - cueEnd.z;
        const cdist = Math.hypot(cdx, cdz);
        if (cdist < r) continue;

        let blocked = false;
        for (const other of balls) {
          if (other.pocketed || other.id === 0 || other.id === ball.id) continue;
          const ox = other.mesh.position.x - cueEnd.x;
          const oz = other.mesh.position.z - cueEnd.z;
          const dot = (ox * cdx + oz * cdz) / (cdist * cdist);
          if (dot < 0 || dot > 1) continue;
          const px = cueEnd.x + dot * cdx;
          const pz = cueEnd.z + dot * cdz;
          if (Math.hypot(other.mesh.position.x - px, other.mesh.position.z - pz) < r * 2.2) {
            blocked = true;
            break;
          }
        }

        if (!blocked) {
          count++;
          break;
        }
      }
    }

    return Math.min(count * 8, 40);
  }

  /** Penalize shots where the cue ball might scratch. */
  _evaluateScratchRisk(shot, pocketPositions) {
    if (!shot.ghostPos) return 0;
    let risk = 0;
    for (const p of pocketPositions) {
      const dist = Math.hypot(p.x - shot.ghostPos.x, p.z - shot.ghostPos.z);
      if (dist < 2.8575 * 5) risk += 15;
      else if (dist < 2.8575 * 10) risk += 6;
    }
    return -risk;
  }

  applyNoise(dir) {
    const noise = this.settings.angleNoise;
    const angle = Math.atan2(dir.z, dir.x) + (Math.random() - 0.5) * noise * 2;
    return { x: Math.cos(angle), z: Math.sin(angle) };
  }

  applyPowerNoise(power) {
    const noise = this.settings.powerNoise;
    const factor = 1 + (Math.random() - 0.5) * noise * 2;
    return Math.max(SHOT.minPower, Math.min(SHOT.maxPower, power * factor));
  }

  _perturbShot(shot) {
    const perturbed = { ...shot };
    const angle = Math.atan2(shot.aimDirection.z, shot.aimDirection.x);
    const noise = this.settings.angleNoise * (0.5 + Math.random());
    perturbed.aimDirection = {
      x: Math.cos(angle + (Math.random() - 0.5) * noise * 2),
      z: Math.sin(angle + (Math.random() - 0.5) * noise * 2),
    };
    perturbed.power = Math.max(SHOT.minPower, shot.power * (1 + (Math.random() - 0.5) * this.settings.powerNoise));
    perturbed.score = (shot.score || 80) * 0.7;
    perturbed.compositeScore = (shot.compositeScore || shot.score || 80) * 0.7;
    perturbed.isPerturbed = true;
    return perturbed;
  }

  _computeSpin(shot, power, ballsManager) {
    const skill = this.settings.spinSkill;
    const powerRatio = power / SHOT.maxPower;
    let x = 0, y = 0;

    if (this.difficulty === AI_DIFFICULTY.EASY) {
      const amount = 0.6 + Math.random() * 0.4;
      x = (Math.random() * 2 - 1) * amount;
      y = (Math.random() * 2 - 1) * amount * 0.7;
      return { x, y };
    }

    if (this.difficulty === AI_DIFFICULTY.HARD) {
      if (powerRatio > 0.5) {
        y = -0.2 - Math.random() * 0.2;
      } else if (powerRatio < 0.3) {
        y = 0.12 + Math.random() * 0.12;
      }
      if (shot.pocketIndex !== undefined && shot.pocketIndex >= 0) {
        const pocketX = shot.aimDirection.x;
        const isNearSide = Math.abs(pocketX) > 0.85;
        if (isNearSide) {
          x = pocketX > 0 ? -0.08 - Math.random() * 0.08 : 0.08 + Math.random() * 0.08;
        }
      }
      if (shot.isSafety || shot.isDesperate) {
        x = (Math.random() > 0.5 ? 1 : -1) * (0.05 + Math.random() * 0.08);
      }
      return { x, y };
    }

    if (Math.random() < skill) {
      if (powerRatio > 0.55) y = -0.15 - Math.random() * 0.15;
      else if (powerRatio < 0.3) y = 0.1 + Math.random() * 0.1;
    } else {
      x = (Math.random() * 2 - 1) * 0.2;
      y = (Math.random() * 2 - 1) * 0.15;
    }
    return { x, y };
  }

  findDesperateShot(balls, cueBall, targetBallId = null) {
    const cuePos = cueBall.mesh.position;
    let closest = null;
    let closestDist = Infinity;

    for (const ball of balls) {
      if (ball.pocketed || ball.id === 0) continue;
      if (targetBallId !== null && ball.id !== targetBallId) continue;
      const d = cuePos.distanceTo(ball.mesh.position);
      if (d < closestDist) {
        closestDist = d;
        closest = ball;
      }
    }

    if (!closest) return null;

    const dx = closest.mesh.position.x - cuePos.x;
    const dz = closest.mesh.position.z - cuePos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.001) return null;

    return {
      aimDirection: { x: dx / dist, z: dz / dist },
      power: Math.min(SHOT.maxPower * 0.5, 30),
      targetBallId: closest.id,
      pocketIndex: -1,
      score: 5,
      compositeScore: 5,
      isDesperate: true,
    };
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
