/**
 * ChallengeManager — Manages a single active challenge session.
 *
 * Observes Game events and evaluates win/lose conditions.
 * Tracks best scores in localStorage.
 * v2 adds: combo/bank/position tracking, failure reasons, completions.
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
    this.stars = 0;
    this.failureReason = '';
    this.startTime = 0;

    // Per-shot tracking
    this.shotPocketedIds = [];
    this.shotCushionHits = 0;
    this.shotPower = 0;
    this.shotUsedSpin = false;
    this.shotMaxDistance = 0;
    this.shotStartPos = null;
    this.shotFinalCuePos = null;

    // v2 per-shot granular tracking
    this.firstHitBallId = null;           // first object ball struck by cue ball
    this.ballCushionHits = new Map();     // ballId -> cushion hit count this shot
    this.pocketedByCombo = new Set();     // ballIds pocketed via combo this shot

    // Match-level tracking
    this.totalFouls = 0;
    this.totalShots = 0;
    this.spinPocketCount = 0;
    this.breakPocketedCount = 0;
    this.gameDuration = 0;
    this.consecutivePocketShots = 0;
    this.maxConsecutivePocketShots = 0;
    this.totalBallsPocketed = 0;

    this.best = this._loadBest(challengeId);
  }

  start() {
    this.active = true;
    this.completed = false;
    this.failed = false;
    this.stars = 0;
    this.failureReason = '';
    this.startTime = performance.now();
    this._resetMatch();
  }

  resetMatch() {
    this._resetMatch();
  }

  _resetMatch() {
    this._shotReset();
    this.totalFouls = 0;
    this.totalShots = 0;
    this.spinPocketCount = 0;
    this.breakPocketedCount = 0;
    this.consecutivePocketShots = 0;
    this.maxConsecutivePocketShots = 0;
    this.totalBallsPocketed = 0;
    this.completed = false;
    this.failed = false;
    this.stars = 0;
    this.failureReason = '';
  }

  // ── Event hooks (called by Game.js) ──

  onShot(cueBall, power, spin) {
    this._shotReset();
    this.shotPower = power;
    this.shotUsedSpin = Math.abs(spin.x) > 0.05 || Math.abs(spin.y) > 0.05;
    this.shotStartPos = cueBall.mesh.position.clone();
    this.totalShots++;
  }

  onPocket(ballId) {
    this.shotPocketedIds.push(ballId);
    if (this.shotUsedSpin && ballId !== 0) {
      this.spinPocketCount++;
    }
    if (ballId !== 0) {
      this.totalBallsPocketed++;
      // Combo detection: pocketed ball was not the first ball struck by cue ball
      if (this.firstHitBallId !== null && ballId !== this.firstHitBallId) {
        this.pocketedByCombo.add(ballId);
      }
    }
  }

  onCushionHit(ballId) {
    this.shotCushionHits++;
    if (ballId !== undefined && ballId !== null) {
      const prev = this.ballCushionHits.get(ballId) || 0;
      this.ballCushionHits.set(ballId, prev + 1);
    }
  }

  onBallCollision(ballA, ballB) {
    // Track first hit for combo detection
    if (this.firstHitBallId !== null) return;
    if (ballA.id === 0 && ballB.id !== 0) {
      this.firstHitBallId = ballB.id;
    } else if (ballB.id === 0 && ballA.id !== 0) {
      this.firstHitBallId = ballA.id;
    }
  }

  onBreakShot(pocketedIds) {
    this.breakPocketedCount = pocketedIds.filter((id) => id !== 0).length;
    this._checkBreakShot();
  }

  onTurnEnd(result) {
    const nonCue = this.shotPocketedIds.filter((id) => id !== 0);
    const hadPocket = nonCue.length > 0;

    if (result.foul) {
      this.totalFouls++;
      this._checkNoFoul();
      this.consecutivePocketShots = 0;
    } else if (hadPocket) {
      this.consecutivePocketShots++;
      if (this.consecutivePocketShots > this.maxConsecutivePocketShots) {
        this.maxConsecutivePocketShots = this.consecutivePocketShots;
      }
    } else {
      this.consecutivePocketShots = 0;
    }

    // Capture final cue ball position for position-play evaluation
    if (result.cueBallPos) {
      this.shotFinalCuePos = result.cueBallPos;
    }

    this._checkPerShotConditions();
    this._checkConsecutivePockets();
    this._checkFlawlessClear();
    this._shotReset();
  }

  onShotUpdate(cueBall) {
    if (!this.shotStartPos) return;
    const dx = cueBall.mesh.position.x - this.shotStartPos.x;
    const dz = cueBall.mesh.position.z - this.shotStartPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > this.shotMaxDistance) this.shotMaxDistance = dist;
    this.shotFinalCuePos = { x: cueBall.mesh.position.x, z: cueBall.mesh.position.z };
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
    this.shotFinalCuePos = null;
    this.firstHitBallId = null;
    this.ballCushionHits.clear();
    this.pocketedByCombo.clear();
  }

  _assignStars(metric, thresholds) {
    // thresholds: [1★, 2★, 3★] — metric must be >= threshold for that star level
    if (metric >= thresholds[2]) return 3;
    if (metric >= thresholds[1]) return 2;
    if (metric >= thresholds[0]) return 1;
    return 1; // fallback if base condition already met
  }

  _assignStarsLowerBetter(metric, thresholds) {
    // thresholds: [1★ max, 2★ max, 3★ max] — metric must be <= threshold
    if (metric <= thresholds[2]) return 3;
    if (metric <= thresholds[1]) return 2;
    return 1;
  }

  _checkPerShotConditions() {
    const { type, params } = this.challenge;
    const nonCue = this.shotPocketedIds.filter((id) => id !== 0);
    const t = params.starThresholds || [1, 2, 3];

    switch (type) {
      case CHALLENGE_TYPE.MULTI_POCKET:
        if (nonCue.length >= params.minPockets) {
          this._complete(this._assignStars(nonCue.length, t));
        }
        break;
      case CHALLENGE_TYPE.CUSHION_SHOT:
        if (nonCue.length > 0 && this.shotCushionHits >= params.minCushions) {
          this._complete(this._assignStars(this.shotCushionHits, t));
        }
        break;
      case CHALLENGE_TYPE.POWER_LIMIT:
        if (nonCue.length > 0 && this.shotPower <= params.maxPower) {
          this._complete(this._assignStarsLowerBetter(this.shotPower, t));
        }
        break;
      case CHALLENGE_TYPE.LONG_SHOT:
        if (nonCue.length > 0 && this.shotMaxDistance >= params.minDistance) {
          this._complete(this._assignStars(this.shotMaxDistance, t));
        }
        break;
      case CHALLENGE_TYPE.BANK_SHOT: {
        // Did any pocketed ball hit a cushion during this shot?
        let maxBanks = 0;
        for (const id of nonCue) {
          const banks = this.ballCushionHits.get(id) || 0;
          if (banks > maxBanks) maxBanks = banks;
        }
        if (maxBanks >= params.minBanks) {
          this._complete(this._assignStars(maxBanks, t));
        }
        break;
      }
      case CHALLENGE_TYPE.COMBO_SHOT:
        if (this.pocketedByCombo.size >= params.minCombos) {
          this._complete(this._assignStars(this.pocketedByCombo.size, t));
        }
        break;
      case CHALLENGE_TYPE.POSITION_PLAY: {
        if (nonCue.length === 0 || !this.shotFinalCuePos) break;
        // Table center is (0,0) in xz plane
        const dx = this.shotFinalCuePos.x;
        const dz = this.shotFinalCuePos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist <= params.zoneRadius) {
          this._complete(this._assignStarsLowerBetter(dist, t));
        }
        break;
      }
    }
  }

  _checkConsecutivePockets() {
    const { type, params } = this.challenge;
    if (type !== CHALLENGE_TYPE.CONSECUTIVE_POCKETS) return;
    const t = params.starThresholds || [params.count, params.count + 1, params.count + 2];
    if (this.maxConsecutivePocketShots >= params.count) {
      this._complete(this._assignStars(this.maxConsecutivePocketShots, t));
    }
  }

  _checkFlawlessClear() {
    const { type, params } = this.challenge;
    if (type !== CHALLENGE_TYPE.FLAWLESS_CLEAR) return;
    // Standard 8-ball rack has 15 object balls
    if (this.totalBallsPocketed >= 15 && this.totalFouls === 0) {
      const t = params.starThresholds || [20, 14, 8];
      this._complete(this._assignStarsLowerBetter(this.totalShots, t));
    }
  }

  _checkBreakShot() {
    if (this.challenge.type === CHALLENGE_TYPE.BREAK_SHOT) {
      const t = this.challenge.params.starThresholds || [4, 5, 6];
      if (this.breakPocketedCount >= this.challenge.params.minPockets) {
        this._complete(this._assignStars(this.breakPocketedCount, t));
      }
    }
  }

  _checkNoFoul() {
    if (this.challenge.type === CHALLENGE_TYPE.NO_FOUL) {
      this._fail('犯规导致挑战失败');
    }
  }

  _checkMatchConditions(winner) {
    const { type, params } = this.challenge;
    const t = params.starThresholds || [1, 2, 3];

    switch (type) {
      case CHALLENGE_TYPE.TIME_ATTACK:
        if (winner === 1 && this.gameDuration <= params.timeLimit) {
          const stars = this._assignStarsLowerBetter(this.gameDuration, [
            params.timeLimit,
            Math.floor(params.timeLimit * 0.75),
            Math.floor(params.timeLimit * 0.5),
          ]);
          this._complete(stars);
        } else if (winner !== 1) {
          this._fail('对手获胜');
        } else {
          this._fail(`超时 (${Math.round(this.gameDuration)}s > ${params.timeLimit}s)`);
        }
        break;
      case CHALLENGE_TYPE.SPIN_REQUIRED:
        if (winner === 1 && this.spinPocketCount >= 1) {
          this._complete(this._assignStars(this.spinPocketCount, t));
        } else if (winner !== 1) {
          this._fail('对手获胜');
        } else {
          this._fail('未使用旋转进球');
        }
        break;
      case CHALLENGE_TYPE.NO_FOUL:
        if (winner === 1 && this.totalFouls === 0) {
          this._complete(3);
        } else if (winner !== 1) {
          this._fail('对手获胜');
        } else {
          this._fail('比赛中出现犯规');
        }
        break;
    }
  }

  _complete(stars) {
    if (this.completed || this.failed) return;
    this.completed = true;
    this.stars = stars;
    const isNewRecord = stars > (this.best.stars || 0);
    this._saveBest(Math.max(stars, this.best.stars || 0), isNewRecord);
  }

  _fail(reason) {
    if (this.completed || this.failed) return;
    this.failed = true;
    this.failureReason = reason || '未达到挑战条件';
    this._saveBest(this.best.stars || 0, false);
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
      case CHALLENGE_TYPE.COMBO_SHOT:
        progress = `组合球: ${this.pocketedByCombo.size} / ${params.minCombos}`;
        break;
      case CHALLENGE_TYPE.BANK_SHOT:
        progress = `碰库: ${this.shotCushionHits} / ${params.minBanks}`;
        break;
      case CHALLENGE_TYPE.POSITION_PLAY:
        progress = this.shotFinalCuePos
          ? `母球距中心: ${Math.round(Math.sqrt(this.shotFinalCuePos.x ** 2 + this.shotFinalCuePos.z ** 2))}cm`
          : '走位: 等待击球结束';
        break;
      case CHALLENGE_TYPE.CONSECUTIVE_POCKETS:
        progress = `连击: ${this.maxConsecutivePocketShots} / ${params.count}`;
        break;
      case CHALLENGE_TYPE.FLAWLESS_CLEAR:
        progress = `进球: ${this.totalBallsPocketed}/15　杆数: ${this.totalShots}`;
        break;
    }
    return { name, progress, completed: this.completed, failed: this.failed };
  }

  // ── Result helpers ──

  getResultStats() {
    const safeStars = Number.isFinite(this.best.stars) ? this.best.stars : 0;
    const safePrev = Number.isFinite(this.best.prevStars) ? this.best.prevStars : 0;
    return {
      duration: Number.isFinite(this.gameDuration) ? this.gameDuration : 0,
      fouls: this.totalFouls,
      totalShots: this.totalShots,
      spinPockets: this.spinPocketCount,
      breakPocketed: this.breakPocketedCount,
      consecutivePockets: this.maxConsecutivePocketShots,
      totalBallsPocketed: this.totalBallsPocketed,
      bestStars: safeStars,
      isNewRecord: this.completed && this.stars > safePrev,
      powerError: null, // reserved
    };
  }

  // ── Persistence ──

  _loadBest(id) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : {};
      const entry = (data && typeof data === 'object' && !Array.isArray(data)) ? data[id] : {};
      return ChallengeManager._sanitizeEntry(entry);
    } catch (e) {
      return { stars: 0, attempts: 0, completions: 0, prevStars: 0 };
    }
  }

  static _sanitizeEntry(raw) {
    const entry = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
    const stars = Number.isFinite(entry.stars) ? Math.max(0, Math.min(3, Math.floor(entry.stars))) : 0;
    const attempts = Number.isFinite(entry.attempts) ? Math.max(0, Math.floor(entry.attempts)) : 0;
    const completions = Number.isFinite(entry.completions) ? Math.max(0, Math.floor(entry.completions)) : 0;
    const prevStars = Number.isFinite(entry.prevStars) ? Math.max(0, Math.min(3, Math.floor(entry.prevStars))) : 0;
    return { stars, attempts, completions, prevStars };
  }

  _saveBest(stars, isNewRecord) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      let data = raw ? JSON.parse(raw) : {};
      if (!data || typeof data !== 'object' || Array.isArray(data)) data = {};
      const existing = ChallengeManager._sanitizeEntry(data[this.challenge.id]);
      existing.prevStars = existing.stars;
      const clampedStars = Number.isFinite(stars) ? Math.max(0, Math.min(3, Math.floor(stars))) : existing.stars;
      existing.stars = Math.max(existing.stars, clampedStars);
      existing.attempts = existing.attempts + 1;
      if (this.completed && clampedStars > 0) {
        existing.completions = existing.completions + 1;
      }
      data[this.challenge.id] = existing;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      // Keep in-memory best in sync so getResultStats() reports accurate prevStars
      this.best = existing;
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
}
