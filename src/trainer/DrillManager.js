/**
 * DrillManager — Manages a single drill session in Shot Trainer mode.
 *
 * Evaluates the player's shot against the drill objective and awards stars.
 * Tracks best scores in localStorage.
 */
import { getDrill, DRILL_TYPE } from './DrillData.js';

const STORAGE_KEY = 'billiards_trainer_v1';

export class DrillManager {
  constructor(drillId) {
    this.drill = getDrill(drillId);
    if (!this.drill) throw new Error('Unknown drill: ' + drillId);

    this.active = false;
    this.completed = false;
    this.failed = false;
    this.stars = 0;

    // Per-shot tracking
    this.shotPower = 0;
    this.shotUsedSpin = false;
    this.targetBallPocketed = false;
    this.cueBallRestPos = null;

    // Position-play tracking
    this.cueBallStartPos = null;

    this.best = this._loadBest(drillId);
  }

  start() {
    this.active = true;
    this.completed = false;
    this.failed = false;
    this.stars = 0;
    this.targetBallPocketed = false;
    this.cueBallRestPos = null;
    this.cueBallStartPos = null;
  }

  resetDrill() {
    this.start();
  }

  // ── Event hooks (called by Game.js) ──

  onShot(cueBall, power, spin) {
    this.shotPower = power;
    this.shotUsedSpin = Math.abs(spin.x) > 0.05 || Math.abs(spin.y) > 0.05;
    this.targetBallPocketed = false;
    this.cueBallRestPos = null;
    this.cueBallStartPos = cueBall.mesh.position.clone();
  }

  onPocket(ballId) {
    // In drills we only care about the primary target ball (usually ball 1)
    const targetIds = Object.keys(this.drill.ballPositions).map(Number).filter((id) => id !== 0);
    if (targetIds.includes(ballId)) {
      this.targetBallPocketed = true;
    }
  }

  onBallsStopped(cueBall) {
    this.cueBallRestPos = cueBall.mesh.position.clone();
    this._evaluate();
  }

  // ── Internal evaluation ──

  _evaluate() {
    if (!this.active || this.completed || this.failed) return;

    const { type, idealCueZone } = this.drill;

    // Base requirement: target ball must be pocketed
    if (!this.targetBallPocketed) {
      // Target ball not pocketed — no score, but player can retry
      return;
    }

    if (type === DRILL_TYPE.POSITION && idealCueZone) {
      // Position play: score based on how close cue ball lands to ideal zone
      const dx = this.cueBallRestPos.x - idealCueZone.x;
      const dz = this.cueBallRestPos.z - idealCueZone.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist <= idealCueZone.radius * 0.4) {
        this._complete(3);
      } else if (dist <= idealCueZone.radius * 0.75) {
        this._complete(2);
      } else if (dist <= idealCueZone.radius) {
        this._complete(1);
      } else {
        // Made the ball but missed the zone — still 1 star for pocketing
        this._complete(1);
      }
    } else {
      // Non-position drills: 3 stars for pocketing the target ball
      // (The difficulty is in the layout, not in post-shot positioning)
      this._complete(3);
    }
  }

  _complete(stars) {
    if (this.completed || this.failed) return;
    this.completed = true;
    this.stars = stars;
    this._saveBest(Math.max(stars, this.best.stars || 0));
  }

  _fail() {
    if (this.completed || this.failed) return;
    this.failed = true;
  }

  // ── HUD data ──

  getHUDData() {
    const { name, type, idealCueZone, hintPower } = this.drill;
    let progress = '';

    if (type === DRILL_TYPE.POSITION && idealCueZone && this.cueBallRestPos) {
      const dx = this.cueBallRestPos.x - idealCueZone.x;
      const dz = this.cueBallRestPos.z - idealCueZone.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const pct = Math.max(0, Math.min(100, Math.round((1 - dist / idealCueZone.radius) * 100)));
      progress = `走位精度: ${pct}%`;
    } else if (this.completed) {
      progress = '✓ 完成';
    } else if (!this.targetBallPocketed && this.cueBallRestPos) {
      progress = '未进球 — 再试一次';
    } else {
      progress = `建议力度: ${hintPower}%`;
    }

    return {
      name,
      progress,
      completed: this.completed,
      failed: this.failed,
      stars: this.stars,
      targetPocketed: this.targetBallPocketed,
    };
  }

  // ── Persistence ──

  _loadBest(id) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : {};
      return data[id] || { stars: 0, attempts: 0 };
    } catch (e) {
      return { stars: 0, attempts: 0 };
    }
  }

  _saveBest(stars) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : {};
      const existing = data[this.drill.id] || { stars: 0, attempts: 0 };
      existing.stars = Math.max(existing.stars, stars);
      existing.attempts = (existing.attempts || 0) + 1;
      data[this.drill.id] = existing;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      // ignore quota errors
    }
  }

  static getAllBest() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  /**
   * Check if a drill is unlocked.
   * Basic drills are always unlocked.
   * Intermediate drills unlock after any 2 BASIC drills are completed.
   * Advanced drills unlock after any 2 INTERMEDIATE drills are completed.
   */
  static isUnlocked(drillId) {
    const drill = getDrill(drillId);
    if (!drill) return false;
    if (drill.category === 'BASIC') return true;

    const best = DrillManager.getAllBest();
    const completedBasic = DRILLS.filter(
      (d) => d.category === 'BASIC' && (best[d.id]?.stars || 0) >= 1
    ).length;
    const completedIntermediate = DRILLS.filter(
      (d) => d.category === 'INTERMEDIATE' && (best[d.id]?.stars || 0) >= 1
    ).length;

    if (drill.category === 'INTERMEDIATE') {
      return completedBasic >= 2;
    }
    if (drill.category === 'ADVANCED') {
      return completedIntermediate >= 2;
    }
    return true;
  }
}
