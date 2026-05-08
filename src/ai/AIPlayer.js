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

    const { ballsManager, table, rules } = game;
    const cueBall = ballsManager.getCueBall();
    const pocketPositions = table.getPocketPositions();
    const status = rules.getStatus();
    const playerGroup = rules.getPlayerGroup(2); // AI is always player 2
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
      isBreak
    );

    let chosenShot = null;

    if (allShots.length === 0) {
      // No direct shot: try safety or random hit
      chosenShot = this.planner.findSafetyShot(ballsManager.balls, cueBall, pocketPositions, playerGroup, isBreak);
      if (!chosenShot) {
        // Desperate: just hit the closest ball
        chosenShot = this.findDesperateShot(ballsManager.balls, cueBall);
      }
    } else {
      // Pick best shot, sometimes pick 2nd best (mistake)
      if (Math.random() < this.settings.missChance && allShots.length > 1) {
        chosenShot = allShots[1 + Math.floor(Math.random() * (allShots.length - 1))];
      } else {
        chosenShot = allShots[0];
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

    // Charge animation delay
    const chargeTime = (finalPower / SHOT.maxPower) * 1200 + 300;

    this.thinking = false;

    return {
      aimDirection: finalAim,
      power: finalPower,
      chargeTime,
      originalShot: chosenShot,
    };
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

  findDesperateShot(balls, cueBall) {
    const cuePos = cueBall.mesh.position;
    let closest = null;
    let closestDist = Infinity;

    for (const ball of balls) {
      if (ball.pocketed || ball.id === 0) continue;
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
