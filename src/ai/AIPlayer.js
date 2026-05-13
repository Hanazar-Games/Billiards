import { ShotPlanner } from './ShotPlanner.js';
import { SHOT } from '../config.js';

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
          angleNoise: 0.12,      // radians
          powerNoise: 0.25,      // fraction of power
          thinkTimeMin: 1200,
          thinkTimeMax: 2500,
          missChance: 0.25,      // chance to pick suboptimal shot
          safetyAwareness: 0.1,
        };
      case AI_DIFFICULTY.HARD:
        return {
          angleNoise: 0.02,
          powerNoise: 0.06,
          thinkTimeMin: 800,
          thinkTimeMax: 1800,
          missChance: 0.02,
          safetyAwareness: 0.6,
        };
      default: // NORMAL
        return {
          angleNoise: 0.06,
          powerNoise: 0.14,
          thinkTimeMin: 1000,
          thinkTimeMax: 2200,
          missChance: 0.10,
          safetyAwareness: 0.35,
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

      // Find shots
      const allShots = this.planner.findAllShots(
        ballsManager.balls,
        cueBall,
        pocketPositions,
        playerGroup,
        isBreak,
        targetBallId
      );

      let chosenShot = null;

      if (allShots.length === 0) {
        // No direct shot: try safety or random hit
        chosenShot = this.planner.findSafetyShot(ballsManager.balls, cueBall, pocketPositions, targetBallId);
        if (!chosenShot) {
          // Desperate: just hit the closest legal ball
          chosenShot = this.findDesperateShot(ballsManager.balls, cueBall, targetBallId);
        }
      } else {
        // Pick best shot, sometimes make a mistake (perturb angle/power)
        chosenShot = allShots[0];
        if (Math.random() < this.settings.missChance) {
          // Perturb the best shot instead of picking a random terrible one
          chosenShot = this._perturbShot(chosenShot);
        }
        // Safety play: if best shot is poor and safety awareness is high, play safe
        if (this.settings.safetyAwareness > 0 && allShots[0].score < 60 &&
            Math.random() < this.settings.safetyAwareness) {
          const safety = this.planner.findSafetyShot(ballsManager.balls, cueBall, pocketPositions, targetBallId);
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

      // Cue-tip offset (spin) — strategic for HARD, random for easier
      const cueTipOffset = this._computeSpin(chosenShot, finalPower);

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
    // Create a slightly-worse version of the best shot rather than abandoning it
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

  _computeSpin(shot, power) {
    if (this.difficulty !== AI_DIFFICULTY.HARD) {
      // Easy/Normal: random spin
      const spinAmount = this.difficulty === AI_DIFFICULTY.EASY ? 0.70 : 0.45;
      return {
        x: (Math.random() * 2 - 1) * spinAmount,
        y: (Math.random() * 2 - 1) * spinAmount * 0.6,
      };
    }
    // Hard: strategic spin
    // Draw (bottom spin) for powerful shots to control cue ball
    // Follow (top spin) for soft shots needing forward roll
    // Side spin minimal unless needed for position
    let x = 0, y = 0;
    const powerRatio = power / SHOT.maxPower;
    if (powerRatio > 0.55) {
      // Powerful shot: use draw to stop cue ball or bring it back
      y = -0.25 - Math.random() * 0.15;
    } else if (powerRatio < 0.25) {
      // Soft shot: follow for gentle roll
      y = 0.15 + Math.random() * 0.1;
    }
    // Tiny side spin to avoid straight-in scratches
    if (shot.isDesperate || (shot.score && shot.score < 50)) {
      x = (Math.random() > 0.5 ? 1 : -1) * (0.1 + Math.random() * 0.1);
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

    return {
      aimDirection: { x: dx / dist, z: dz / dist },
      power: Math.min(SHOT.maxPower * 0.5, 30),
      score: 5,
      isDesperate: true,
    };
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
