/**
 * ChallengeManager — Manages a single active challenge session.
 *
 * Observes Game events and evaluates win/lose conditions.
 * Tracks best scores in localStorage.
 */
import { getChallenge, CHALLENGE_TYPE } from './ChallengeData.js';

const STORAGE_KEY = 'billiards_challenges_v1';

export class ChallengeManager {
  constructor(challengeId) {
    this.challenge = getChallenge(challengeId);
    if (!this.challenge) throw new Error('Unknown challenge: ' + challengeId);

    this.active = false;
    this.completed = false;
    this.failed = false;
    this.startTime = 0;

    // Per-shot tracking
    this.shotPocketedIds = [];
    this.shotCushionHits = 0;
    this.shotPower = 0;
    this.shotUsedSpin = false;
    this.shotMaxDistance = 0;
    this.shotStartPos = null;

    // Match-level tracking
    this.totalFouls = 0;
    this.spinPocketCount = 0;
    this.breakPocketedCount = 0;
    this.gameDuration = 0;

    this.best = this._loadBest(challengeId);
  }

  start() {
    this.active = true;
    this.completed = false;
    this.failed = false;
    this.startTime = performance.now();
    this._resetMatch();
  }

  resetMatch() {
    this._resetMatch();
  }

  _resetMatch() {
    this._shotReset();
    this.totalFouls = 0;
    this.spinPocketCount = 0;
    this.breakPocketedCount = 0;
    this.completed = false;
    this.failed = false;
  }

  // ── Event hooks (called by Game.js) ──

  onShot(cueBall, power, spin) {
    this._shotReset();
    this.shotPower = power;
    this.shotUsedSpin = Math.abs(spin.x) > 0.05 || Math.abs(spin.y) > 0.05;
    this.shotStartPos = cueBall.mesh.position.clone();
  }

  onPocket(ballId) {
    this.shotPocketedIds.push(ballId);
    if (this.shotUsedSpin && ballId !== 0) {
      this.spinPocketCount++;
    }
  }

  onCushionHit() {
    this.shotCushionHits++;
  }

  onBreakShot(pocketedIds) {
    this.breakPocketedCount = pocketedIds.filter((id) => id !== 0).length;
    this._checkBreakShot();
  }

  onTurnEnd(result) {
    if (result.foul) {
      this.totalFouls++;
      this._checkNoFoul();
    }
    this._checkPerShotConditions();
    this._shotReset();
  }

  onShotUpdate(cueBall) {
    if (!this.shotStartPos) return;
    const dx = cueBall.mesh.position.x - this.shotStartPos.x;
    const dz = cueBall.mesh.position.z - this.shotStartPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > this.shotMaxDistance) this.shotMaxDistance = dist;
  }

  onGameEnd(winner) {
    this.gameDuration = (performance.now() - this.startTime) / 1000;
    this._checkMatchConditions(winner);
  }

  // ── Internal checks ──

  _shotReset() {
    this.shotPocketedIds = [];
    this.shotCushionHits = 0;
    this.shotPower = 0;
    this.shotUsedSpin = false;
    this.shotMaxDistance = 0;
    this.shotStartPos = null;
  }

  _checkPerShotConditions() {
    const { type, params } = this.challenge;
    const nonCue = this.shotPocketedIds.filter((id) => id !== 0);

    switch (type) {
      case CHALLENGE_TYPE.MULTI_POCKET:
        if (nonCue.length >= params.minPockets) {
          this._complete(3);
        }
        break;
      case CHALLENGE_TYPE.CUSHION_SHOT:
        if (nonCue.length > 0 && this.shotCushionHits >= params.minCushions) {
          this._complete(3);
        }
        break;
      case CHALLENGE_TYPE.POWER_LIMIT:
        if (nonCue.length > 0 && this.shotPower <= params.maxPower) {
          const ratio = this.shotPower / params.maxPower;
          const stars = ratio <= 0.3 ? 3 : ratio <= 0.6 ? 2 : 1;
          this._complete(stars);
        }
        break;
      case CHALLENGE_TYPE.LONG_SHOT:
        if (nonCue.length > 0 && this.shotMaxDistance >= params.minDistance) {
          this._complete(3);
        }
        break;
    }
  }

  _checkBreakShot() {
    if (this.challenge.type === CHALLENGE_TYPE.BREAK_SHOT) {
      if (this.breakPocketedCount >= this.challenge.params.minPockets) {
        this._complete(3);
      }
    }
  }

  _checkNoFoul() {
    if (this.challenge.type === CHALLENGE_TYPE.NO_FOUL) {
      this._fail();
    }
  }

  _checkMatchConditions(winner) {
    const { type, params } = this.challenge;

    switch (type) {
      case CHALLENGE_TYPE.TIME_ATTACK:
        if (winner === 1 && this.gameDuration <= params.timeLimit) {
          const stars = this.gameDuration <= params.timeLimit * 0.5 ? 3 : this.gameDuration <= params.timeLimit * 0.75 ? 2 : 1;
          this._complete(stars);
        } else if (winner !== 1) {
          this._fail();
        } else {
          this._fail();
        }
        break;
      case CHALLENGE_TYPE.SPIN_REQUIRED:
        if (winner === 1 && this.spinPocketCount >= 1) {
          const stars = this.spinPocketCount >= 3 ? 3 : this.spinPocketCount >= 2 ? 2 : 1;
          this._complete(stars);
        } else {
          this._fail();
        }
        break;
      case CHALLENGE_TYPE.NO_FOUL:
        if (winner === 1 && this.totalFouls === 0) {
          this._complete(3);
        } else {
          this._fail();
        }
        break;
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
    const { name, type, params } = this.challenge;
    let progress = '';
    switch (type) {
      case CHALLENGE_TYPE.MULTI_POCKET:
        progress = `进球: ${this.shotPocketedIds.filter((id) => id !== 0).length} / ${params.minPockets}`;
        break;
      case CHALLENGE_TYPE.CUSHION_SHOT:
        progress = `库边: ${this.shotCushionHits} / ${params.minCushions}`;
        break;
      case CHALLENGE_TYPE.POWER_LIMIT:
        progress = `力度: ${Math.round(this.shotPower)}% / ${params.maxPower}%`;
        break;
      case CHALLENGE_TYPE.TIME_ATTACK:
        progress = `时间: ${Math.round(this.gameDuration || (performance.now() - this.startTime) / 1000)}s / ${params.timeLimit}s`;
        break;
      case CHALLENGE_TYPE.LONG_SHOT:
        progress = `距离: ${Math.round(this.shotMaxDistance)}cm / ${params.minDistance}cm`;
        break;
      case CHALLENGE_TYPE.SPIN_REQUIRED:
        progress = `旋转进球: ${this.spinPocketCount}`;
        break;
      case CHALLENGE_TYPE.BREAK_SHOT:
        progress = `开球进袋: ${this.breakPocketedCount} / ${params.minPockets}`;
        break;
      case CHALLENGE_TYPE.NO_FOUL:
        progress = `犯规: ${this.totalFouls} / 0`;
        break;
    }
    return { name, progress, completed: this.completed, failed: this.failed };
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
      const existing = data[this.challenge.id] || { stars: 0, attempts: 0 };
      existing.stars = Math.max(existing.stars, stars);
      existing.attempts = (existing.attempts || 0) + 1;
      data[this.challenge.id] = existing;
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
}
