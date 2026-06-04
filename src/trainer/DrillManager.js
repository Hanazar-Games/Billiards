/**
 * DrillManager — Manages a single drill session in Shot Trainer mode.
 *
 * Evaluates the player's shot against the drill objective and awards stars.
 * Tracks best scores in localStorage.
 */
import { getDrill, DRILL_TYPE, DRILLS } from './DrillData.js';

const STORAGE_KEY = 'billiards_trainer_v1';

export class DrillManager {
  constructor(drillId, idealZoneAbsolute = null) {
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

    // Absolute ideal zone (passed from Game.js after resolveDrillPositions)
    this.idealZone = idealZoneAbsolute;

    // Progress tracking for this session
    this.isNewBestStars = false;
    this.isNewBestPowerError = false;
    this.powerError = null;

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
    this.isNewBestStars = false;
    this.isNewBestPowerError = false;
    this.powerError = null;
  }

  resetDrill() {
    this.start();
  }

  // ── Event hooks (called by Game.js) ──

  onShot(cueBall, power, spin) {
    this.shotPower = power;
    const s = spin || { x: 0, y: 0 };
    this.shotUsedSpin = Math.abs(s.x) > 0.05 || Math.abs(s.y) > 0.05;
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

    if (type === DRILL_TYPE.POSITION && this.idealZone) {
      // Position play: score based on how close cue ball lands to ideal zone
      const dx = this.cueBallRestPos.x - this.idealZone.x;
      const dz = this.cueBallRestPos.z - this.idealZone.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist <= this.idealZone.radius * 0.4) {
        this._complete(3);
      } else if (dist <= this.idealZone.radius * 0.75) {
        this._complete(2);
      } else if (dist <= this.idealZone.radius) {
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

    // Calculate power error (absolute difference from recommended power)
    const hintPower = this.drill.hintPower || 0;
    this.powerError = hintPower > 0 ? Math.abs(this.shotPower - hintPower) : null;

    const prevStars = this.best.stars || 0;
    const prevPowerError = this.best.bestPowerError ?? Infinity;
    const currentPowerError = this.powerError ?? Infinity;

    this.isNewBestStars = stars > prevStars;
    this.isNewBestPowerError = stars >= prevStars && currentPowerError < prevPowerError;

    this._saveBest({
      stars: Math.max(stars, prevStars),
      powerError: this.powerError,
      powerErrorStars: this.powerError !== null ? stars : (this.best.bestPowerErrorStars || 0),
    });
  }

  _fail() {
    if (this.completed || this.failed) return;
    this.failed = true;
  }

  // ── HUD data ──

  getHUDData() {
    const { name, type, hintPower } = this.drill;
    let progress = '';

    if (type === DRILL_TYPE.POSITION && this.idealZone && this.cueBallRestPos) {
      const dx = this.cueBallRestPos.x - this.idealZone.x;
      const dz = this.cueBallRestPos.z - this.idealZone.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const pct = Math.max(0, Math.min(100, Math.round((1 - dist / this.idealZone.radius) * 100)));
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
      powerError: this.powerError,
      isNewBestStars: this.isNewBestStars,
      isNewBestPowerError: this.isNewBestPowerError,
    };
  }

  // ── Persistence ──

  _loadBest(id) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : {};
      const entry = (data && typeof data === 'object' && !Array.isArray(data)) ? data[id] : {};
      return DrillManager._sanitizeEntry(entry);
    } catch (e) {
      return { stars: 0, attempts: 0, completions: 0, bestPowerError: null, bestPowerErrorStars: 0, lastPlayed: null };
    }
  }

  static _sanitizeEntry(raw) {
    const entry = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
    const stars = Number.isFinite(entry.stars) ? Math.max(0, Math.min(3, Math.floor(entry.stars))) : 0;
    const attempts = Number.isFinite(entry.attempts) ? Math.max(0, Math.floor(entry.attempts)) : 0;
    const completions = Number.isFinite(entry.completions) ? Math.max(0, Math.floor(entry.completions)) : 0;
    const bestPowerError = Number.isFinite(entry.bestPowerError) && entry.bestPowerError >= 0 ? entry.bestPowerError : null;
    const bestPowerErrorStars = Number.isFinite(entry.bestPowerErrorStars) ? Math.max(0, Math.min(3, Math.floor(entry.bestPowerErrorStars))) : 0;
    const lastPlayed = typeof entry.lastPlayed === 'string' ? entry.lastPlayed : null;
    return { stars, attempts, completions, bestPowerError, bestPowerErrorStars, lastPlayed };
  }

  _saveBest(updates) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      let data = raw ? JSON.parse(raw) : {};
      if (!data || typeof data !== 'object' || Array.isArray(data)) data = {};
      const existing = DrillManager._sanitizeEntry(data[this.drill.id]);

      const newStars = Number.isFinite(updates.stars) ? Math.max(0, Math.min(3, Math.floor(updates.stars))) : existing.stars;
      existing.stars = newStars;
      existing.attempts = existing.attempts + 1;

      if (this.completed) {
        existing.completions = existing.completions + 1;
      }

      if (updates.powerError !== null && updates.powerError !== undefined && Number.isFinite(updates.powerError) && updates.powerError >= 0) {
        const prevErr = existing.bestPowerError ?? Infinity;
        if (updates.powerError < prevErr) {
          existing.bestPowerError = updates.powerError;
          existing.bestPowerErrorStars = Number.isFinite(updates.powerErrorStars) ? Math.max(0, Math.min(3, Math.floor(updates.powerErrorStars))) : this.stars;
        }
      }

      existing.lastPlayed = new Date().toISOString();
      data[this.drill.id] = existing;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      // ignore quota errors
    }
  }

  static getAllBest() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : {};
      if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
      return data;
    } catch (e) {
      return {};
    }
  }

  /**
   * Get structured progress data for a specific drill.
   */
  static getProgress(drillId) {
    const drill = getDrill(drillId);
    if (!drill) return null;
    const all = DrillManager.getAllBest();
    const entry = DrillManager._sanitizeEntry(all[drillId]);
    return {
      stars: entry.stars,
      attempts: entry.attempts,
      completions: entry.completions,
      bestPowerError: entry.bestPowerError,
      bestPowerErrorStars: entry.bestPowerErrorStars,
      lastPlayed: entry.lastPlayed,
      unlocked: DrillManager.isUnlocked(drillId),
    };
  }

  /**
   * Get category-level progress summary.
   */
  static getCategoryProgress() {
    const result = {};
    for (const cat of ['BASIC', 'INTERMEDIATE', 'ADVANCED']) {
      const drills = DRILLS.filter((d) => d.category === cat);
      let completed = 0;
      let totalStars = 0;
      for (const d of drills) {
        const p = DrillManager.getProgress(d.id);
        if (p && p.stars >= 1) completed++;
        if (p) totalStars += p.stars;
      }
      const maxStars = drills.length * 3;
      result[cat] = { completed, total: drills.length, totalStars, maxStars };
    }
    return result;
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

  /**
   * Get a human-readable unlock requirement message.
   */
  static getUnlockRequirement(drillId) {
    const drill = getDrill(drillId);
    if (!drill) return '';
    if (drill.category === 'BASIC') return '';
    if (drill.category === 'INTERMEDIATE') {
      const best = DrillManager.getAllBest();
      const completed = DRILLS.filter(
        (d) => d.category === 'BASIC' && (best[d.id]?.stars || 0) >= 1
      ).length;
      return `完成 ${Math.max(0, 2 - completed)} 个基础练习以解锁`;
    }
    if (drill.category === 'ADVANCED') {
      const best = DrillManager.getAllBest();
      const completed = DRILLS.filter(
        (d) => d.category === 'INTERMEDIATE' && (best[d.id]?.stars || 0) >= 1
      ).length;
      return `完成 ${Math.max(0, 2 - completed)} 个进阶练习以解锁`;
    }
    return '';
  }
}
