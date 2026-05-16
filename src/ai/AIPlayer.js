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

    // Difficulty settings
    this.settings = this.getSettings(difficulty);
  }

  getSettings(difficulty) {
    switch (difficulty) {
      case AI_DIFFICULTY.EASY:
        return {
          angleNoise: 0.055,     // ~3.2° — poor aim
          powerNoise: 0.20,      // 20% power variance
          thinkTimeMin: 1400,
          thinkTimeMax: 3500,
          missChance: 0.25,      // often perturbs chosen shot
          safetyAwareness: 0.05,
          positionPlayWeight: 0,
          spinSkill: 0.15,
          topShotPickRate: 0.65,
          bankShotEnable: false,
        };
      case AI_DIFFICULTY.HARD:
        return {
          angleNoise: 0.003,     // ~0.17° — near-perfect aim
          powerNoise: 0.012,     // 1.2% power variance
          thinkTimeMin: 400,
          thinkTimeMax: 1000,
          missChance: 0.0,
          safetyAwareness: 0.80,
          positionPlayWeight: 0.7,
          spinSkill: 1.0,
          topShotPickRate: 1.0,
          bankShotEnable: true,
        };
      default: // NORMAL
        return {
          angleNoise: 0.025,     // ~1.4°
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

  /**
   * Execute AI turn. Returns a Promise that resolves when shot is ready.
   */
  async takeTurn(game) {
    if (this.thinking) return;
    this.thinking = true;

    try {
      const { ballsManager, table, rules } = game;
      const cueBall = ballsManager.getCueBall();
      const pocketPositions = table.getPocketPositions();
      const status = rules.getStatus();
      const playerGroup = typeof rules.getPlayerGroup === 'function'
        ? rules.getPlayerGroup(2) // AI is always player 2
        : null;
      const targetBallId = Number.isInteger(status.targetBall) ? status.targetBall : null;
      const isBreak = status.breakShot;

      // Thinking delay
      const thinkTime = this.settings.thinkTimeMin + Math.random() * (this.settings.thinkTimeMax - this.settings.thinkTimeMin);
      await this.delay(thinkTime);

      // Game may have been disposed during thinking delay
      if (!game.ballsManager || game.state === 'DISPOSED' || !this.thinking) {
        return null;
      }

      // Find shots
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
        // No direct shot: try safety or random hit
        chosenShot = this.planner.findSafetyShot(ballsManager.balls, cueBall, pocketPositions, targetBallId, tableProfile);
        if (!chosenShot) {
          chosenShot = this.findDesperateShot(ballsManager.balls, cueBall, targetBallId);
        }
      } else {
        // Difficulty-based shot selection
        chosenShot = this._selectShot(allShots);

        // If the chosen shot is very poor (e.g. perturbed miss), strong AI may switch to safety
        const s = this.settings;
        if (chosenShot.score < 35 && s.safetyAwareness > 0 &&
            Math.random() < s.safetyAwareness * 0.6) {
          const safety = this.planner.findSafetyShot(ballsManager.balls, cueBall, pocketPositions, targetBallId, tableProfile);
          if (safety) chosenShot = safety;
        }
      }

      if (!chosenShot) {
        // Absolute fallback
        chosenShot = {
          aimDirection: { x: 0, z: 1 },
          power: SHOT.minPower * 2,
        };
      }

      // Apply noise based on difficulty
      const finalAim = this.applyNoise(chosenShot.aimDirection);
      const finalPower = this.applyPowerNoise(chosenShot.power);

      // Cue-tip offset (spin) — strategic for HARD, semi-random for easier
      const cueTipOffset = this._computeSpin(chosenShot, finalPower, ballsManager);

      // Charge animation delay
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
   * EASY: often picks non-best shots, misses easy ones.
   * NORMAL: usually picks good shots, occasionally makes mistakes.
   * HARD: always picks the optimal shot, considers position play.
   */
  _selectShot(allShots) {
    if (!allShots || allShots.length === 0) return null;
    const s = this.settings;

    // HARD: evaluate position play for top candidates and re-sort
    if (this.difficulty === AI_DIFFICULTY.HARD && s.positionPlayWeight > 0) {
      const scored = allShots.map((shot) => ({
        ...shot,
        combinedScore: shot.score + this._evaluatePositionPlay(shot, tableProfile) * s.positionPlayWeight,
      }));
      scored.sort((a, b) => b.combinedScore - a.combinedScore);
      allShots = scored;
    }

    // Pick based on difficulty
    let chosen;
    if (Math.random() < s.topShotPickRate) {
      chosen = { ...allShots[0] };
    } else {
      // Pick from top N depending on difficulty
      const poolSize = this.difficulty === AI_DIFFICULTY.EASY
        ? Math.min(5, allShots.length)
        : Math.min(3, allShots.length);
      chosen = { ...allShots[Math.floor(Math.random() * poolSize)] };
    }

    // Miss chance: perturb the chosen shot
    if (Math.random() < s.missChance) {
      chosen = this._perturbShot(chosen);
    }

    return chosen;
  }

  /** Rough position-play evaluation for HARD AI. Rewards shots that leave cue ball near cushions or far from target balls. */
  _evaluatePositionPlay(shot, tableProfile = null) {
    if (!shot.ghostPos) return 0;
    let score = 0;
    const profile = tableProfile || getDefaultTableProfile();
    // Near a cushion is good (harder for opponent)
    const cushionX = Math.abs(shot.ghostPos.x) / (profile.width / 2);
    const cushionZ = Math.abs(shot.ghostPos.z) / (profile.depth / 2);
    if (cushionX > 0.75 || cushionZ > 0.75) score += 12;
    else if (cushionX > 0.55 || cushionZ > 0.55) score += 6;
    return score;
  }

  applyNoise(dir) {
    const noise = this.settings.angleNoise;
    const angle = Math.atan2(dir.z, dir.x) + (Math.random() - 0.5) * noise * 2;
    return {
      x: Math.cos(angle),
      z: Math.sin(angle),
    };
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
    perturbed.isPerturbed = true;
    return perturbed;
  }

  /**
   * Compute spin based on difficulty and shot context.
   * EASY: mostly random, sometimes way off.
   * NORMAL: slight random, occasionally intentional.
   * HARD: always intentional - draw, follow, side spin for position.
   */
  _computeSpin(shot, power, ballsManager) {
    const skill = this.settings.spinSkill;
    const powerRatio = power / SHOT.maxPower;
    let x = 0, y = 0;

    if (this.difficulty === AI_DIFFICULTY.EASY) {
      // Poor spin control: random and often excessive
      const amount = 0.6 + Math.random() * 0.4;
      x = (Math.random() * 2 - 1) * amount;
      y = (Math.random() * 2 - 1) * amount * 0.7;
      return { x, y };
    }

    if (this.difficulty === AI_DIFFICULTY.HARD) {
      // Strategic spin
      if (powerRatio > 0.5) {
        // Draw to stop cue ball or bring it back
        y = -0.2 - Math.random() * 0.2;
      } else if (powerRatio < 0.3) {
        // Follow for gentle roll forward
        y = 0.12 + Math.random() * 0.12;
      }

      // Side spin when approaching a pocket at a shallow angle
      if (shot.pocketIndex !== undefined && shot.pocketIndex >= 0) {
        const pocketX = shot.aimDirection.x;
        const isNearSide = Math.abs(pocketX) > 0.85;
        if (isNearSide) {
          // Add opposite-side spin to help the cue ball avoid the pocket
          x = pocketX > 0 ? -0.08 - Math.random() * 0.08 : 0.08 + Math.random() * 0.08;
        }
      }

      // Safety or desperate: use spin to try to control cue ball
      if (shot.isSafety || shot.isDesperate) {
        x = (Math.random() > 0.5 ? 1 : -1) * (0.05 + Math.random() * 0.08);
      }
      return { x, y };
    }

    // NORMAL: mix of slight intentional spin and random
    if (Math.random() < skill) {
      // Occasionally intentional
      if (powerRatio > 0.55) y = -0.15 - Math.random() * 0.15;
      else if (powerRatio < 0.3) y = 0.1 + Math.random() * 0.1;
    } else {
      // Otherwise slight random
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
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 0.001) return null;

    return {
      aimDirection: { x: dx / dist, z: dz / dist },
      power: Math.min(SHOT.maxPower * 0.5, 30),
      targetBallId: closest.id,
      pocketIndex: -1,
      score: 5,
      isDesperate: true,
    };
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
