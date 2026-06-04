/**
 * CareerStore — Persistent player career statistics & shot history.
 *
 * Records every shot and game outcome for long-term profiling.
 * Storage key: `billiards_career_v1`
 */

const STORAGE_KEY = 'billiards_career_v1';
const MAX_RECENT_GAMES = 50;

const DEFAULTS = {
  version: 1,
  gamesPlayed: 0,
  gamesWon: 0,
  gamesLost: 0,
  shotsTaken: 0,

  byMode: {
    vsai:    { played: 0, won: 0, lost: 0, byDifficulty: { easy: { played: 0, won: 0, lost: 0 }, normal: { played: 0, won: 0, lost: 0 }, hard: { played: 0, won: 0, lost: 0 } } },
    local2p: { played: 0, won: 0, lost: 0 },
    '9ball': { played: 0, won: 0, lost: 0 },
    freeplay:{ played: 0 },
    trainer: { played: 0 },
    challenge:{ played: 0, completed: 0 },
  },

  shotStyle: {
    // Power distribution in 5 buckets: 0-20, 20-40, 40-60, 60-80, 80-100
    powerBuckets: [0, 0, 0, 0, 0],
    // Spin usage counts
    spin: { top: 0, bottom: 0, left: 0, right: 0, center: 0 },
    // Special shot tracking
    thinCutAttempts: 0,
    thinCutSuccess: 0,
    longShotAttempts: 0,
    longShotSuccess: 0,
    bankAttempts: 0,
    bankSuccess: 0,
    breakShots: 0,
    breakPocketedTotal: 0,
  },

  records: {
    maxConsecutivePockets: 0,
    maxConsecutivePocketsInGame: 0,
    fastestWinSeconds: null,
    highestBallsInOneTurn: 0,
    mostCollisionsInOneShot: 0,
    mostCushionsInOneShot: 0,
    highestShotPower: 0,
  },

  // Recent games for trend analysis (circular buffer, newest last)
  recentGames: [],

  // Aggregate totals
  totals: {
    ballsPocketed: 0,
    fouls: 0,
    scratches: 0,
    ballCollisions: 0,
    cushionCollisions: 0,
    totalShotPower: 0,
  },
};

function _deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export class CareerStore {
  constructor() {
    this._data = _deepClone(DEFAULTS);
    this._saveTimer = null;
    this._load();
  }

  /* ── Persistence ── */

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        // Merge loaded data over defaults (handles schema migration)
        this._data = this._mergeDeep(_deepClone(DEFAULTS), parsed);
        // Sanitize after merge to fix type mismatches from old/corrupted data
        this._sanitizeData(this._data);
      }
    } catch (e) {
      console.warn('[CareerStore] Load failed, using defaults');
    }
  }

  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._data));
    } catch (e) {
      console.warn('[CareerStore] Save failed:', e.message);
    }
  }

  _mergeDeep(target, source) {
    for (const key of Object.keys(source)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
      if (!Object.prototype.hasOwnProperty.call(target, key)) continue;
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) {
          target[key] = {};
        }
        this._mergeDeep(target[key], source[key]);
      } else {
        // Type guard: only overwrite if types match, or target default is falsy
        const srcVal = source[key];
        const tgtVal = target[key];
        const srcType = typeof srcVal;
        const tgtType = typeof tgtVal;
        if (srcType === tgtType || tgtVal == null || tgtVal === 0 || tgtVal === '') {
          target[key] = srcVal;
        } else if (tgtType === 'number' && srcType === 'string') {
          const parsed = Number(srcVal);
          if (Number.isFinite(parsed)) target[key] = parsed;
        } else if (Array.isArray(tgtVal) && Array.isArray(srcVal)) {
          target[key] = srcVal;
        }
        // Otherwise keep default (type mismatch from corrupted data)
      }
    }
    return target;
  }

  /** Sanitize data structure to fix type mismatches from old/corrupted storage. */
  _sanitizeData(d) {
    // Ensure numeric totals are actually numbers
    if (typeof d.gamesPlayed !== 'number') d.gamesPlayed = Number(d.gamesPlayed) || 0;
    if (typeof d.gamesWon !== 'number') d.gamesWon = Number(d.gamesWon) || 0;
    if (typeof d.gamesLost !== 'number') d.gamesLost = Number(d.gamesLost) || 0;
    if (typeof d.shotsTaken !== 'number') d.shotsTaken = Number(d.shotsTaken) || 0;

    // Ensure arrays
    if (!Array.isArray(d.recentGames)) d.recentGames = [];
    if (!Array.isArray(d.shotStyle?.powerBuckets)) {
      d.shotStyle = d.shotStyle || {};
      d.shotStyle.powerBuckets = [0, 0, 0, 0, 0];
    } else {
      // Ensure exactly 5 numeric buckets
      d.shotStyle.powerBuckets = d.shotStyle.powerBuckets.map((v) => Number.isFinite(v) ? v : 0);
      while (d.shotStyle.powerBuckets.length < 5) d.shotStyle.powerBuckets.push(0);
      if (d.shotStyle.powerBuckets.length > 5) d.shotStyle.powerBuckets = d.shotStyle.powerBuckets.slice(0, 5);
    }

    // Ensure spin counts are numbers
    const spin = d.shotStyle?.spin || {};
    for (const k of ['top', 'bottom', 'left', 'right', 'center']) {
      if (typeof spin[k] !== 'number') spin[k] = Number(spin[k]) || 0;
    }

    // Ensure records are numbers or null
    const rec = d.records || {};
    for (const k of ['maxConsecutivePockets', 'maxConsecutivePocketsInGame', 'highestBallsInOneTurn', 'mostCollisionsInOneShot', 'mostCushionsInOneShot', 'highestShotPower']) {
      if (typeof rec[k] !== 'number') rec[k] = Number(rec[k]) || 0;
    }
    if (rec.fastestWinSeconds != null && !Number.isFinite(rec.fastestWinSeconds)) rec.fastestWinSeconds = null;

    // Ensure totals are numbers
    const tot = d.totals || {};
    for (const k of ['ballsPocketed', 'fouls', 'scratches', 'ballCollisions', 'cushionCollisions', 'totalShotPower']) {
      if (typeof tot[k] !== 'number') tot[k] = Number(tot[k]) || 0;
    }

    // Clean recentGames: remove entries with invalid structure
    d.recentGames = d.recentGames.filter((g) => g && typeof g === 'object');
  }

  /* ── Public getters ── */

  getAll() {
    return _deepClone(this._data);
  }

  getGamesPlayed() { return this._data.gamesPlayed; }
  getGamesWon() { return this._data.gamesWon; }
  getGamesLost() { return this._data.gamesLost; }
  getShotsTaken() { return this._data.shotsTaken; }
  getWinRate() {
    const decisive = this._data.gamesWon + this._data.gamesLost;
    return decisive > 0 ? this._data.gamesWon / decisive : 0;
  }
  getByMode(mode) {
    return _deepClone(this._data.byMode[mode] || { played: 0, won: 0, lost: 0, byDifficulty: {}, completed: 0 });
  }
  getShotStyle() { return _deepClone(this._data.shotStyle); }
  getRecords() { return _deepClone(this._data.records); }
  getRecentGames() { return _deepClone(this._data.recentGames); }
  getTotals() { return _deepClone(this._data.totals); }

  /* ── Shot recording ── */

  /**
   * Record a single shot's data.
   * @param {Object} params
   * @param {number} params.power — shot power 0-100
   * @param {{x:number,y:number}} params.spin — cue tip offset
   * @param {number} params.pocketedCount — balls pocketed this shot
   * @param {number} params.collisions — ball-ball collisions
   * @param {number} params.cushions — cushion hits
   * @param {boolean} params.isBreak — was this the break shot
   * @param {boolean} params.isFoul — was this a foul
   * @param {boolean} params.isScratch — was this a scratch
   * @param {number} params.durationMs — shot duration
   * @param {string} params.mode — game mode
   * @param {boolean} params.isLongShot — shot distance > 150cm
   * @param {boolean} params.isThinCut — cut angle > 70 deg
   * @param {boolean} params.isBank — bank shot
   */
  recordShot(params = {}) {
    const d = this._data;
    d.shotsTaken++;

    // Power bucket
    const power = Math.max(0, Math.min(100, Number(params.power) || 0));
    const bucket = Math.min(4, Math.floor(power / 20));
    d.shotStyle.powerBuckets[bucket]++;
    // Defensive: ensure totalShotPower is numeric before adding (protect against string concatenation from corrupted data)
    if (typeof d.totals.totalShotPower !== 'number') d.totals.totalShotPower = Number(d.totals.totalShotPower) || 0;
    d.totals.totalShotPower += power;

    // Records
    if (power > d.records.highestShotPower) d.records.highestShotPower = power;
    if ((params.collisions || 0) > d.records.mostCollisionsInOneShot) {
      d.records.mostCollisionsInOneShot = params.collisions || 0;
    }
    if ((params.cushions || 0) > d.records.mostCushionsInOneShot) {
      d.records.mostCushionsInOneShot = params.cushions || 0;
    }

    // Spin — use dominant direction only to avoid double-counting diagonal spins
    const sx = params.spin?.x ?? 0;
    const sy = params.spin?.y ?? 0;
    if (Math.abs(sx) < 0.1 && Math.abs(sy) < 0.1) {
      d.shotStyle.spin.center++;
    } else {
      const absX = Math.abs(sx);
      const absY = Math.abs(sy);
      if (absY >= absX) {
        // Vertical dominant
        if (sy > 0.1) d.shotStyle.spin.top++;
        else if (sy < -0.1) d.shotStyle.spin.bottom++;
      } else {
        // Horizontal dominant
        // sx > 0 means cue tip is to the right → right english (右塞)
        // sx < 0 means cue tip is to the left → left english (左塞)
        if (sx > 0.1) d.shotStyle.spin.right++;
        else if (sx < -0.1) d.shotStyle.spin.left++;
      }
    }

    // Special shots
    // Clamp all count inputs to non-negative
    const pocketed = Math.max(0, Number.isFinite(params.pocketedCount) ? params.pocketedCount : 0);
    const collisions = Math.max(0, Number.isFinite(params.collisions) ? params.collisions : 0);
    const cushions = Math.max(0, Number.isFinite(params.cushions) ? params.cushions : 0);

    if (params.isBreak) {
      d.shotStyle.breakShots++;
      d.shotStyle.breakPocketedTotal += pocketed;
    }
    if (params.isLongShot) {
      d.shotStyle.longShotAttempts++;
      if (pocketed > 0) d.shotStyle.longShotSuccess++;
    }
    if (params.isThinCut) {
      d.shotStyle.thinCutAttempts++;
      if (pocketed > 0) d.shotStyle.thinCutSuccess++;
    }
    if (params.isBank) {
      d.shotStyle.bankAttempts++;
      if (pocketed > 0) d.shotStyle.bankSuccess++;
    }

    // Totals
    d.totals.ballsPocketed += pocketed;
    if (params.isFoul) d.totals.fouls++;
    if (params.isScratch) d.totals.scratches++;
    d.totals.ballCollisions += collisions;
    d.totals.cushionCollisions += cushions;

    // Pocketed record
    const pocketedCount = Math.max(0, Number.isFinite(params.pocketedCount) ? params.pocketedCount : 0);
    if (pocketedCount > d.records.highestBallsInOneTurn) {
      d.records.highestBallsInOneTurn = pocketedCount;
    }

    this._scheduleSave();
  }

  /**
   * Record consecutive pocket streak.
   * @param {number} count — consecutive pockets in current streak
   * @param {boolean} endOfGame — whether this is the final game tally
   */
  recordStreak(count, endOfGame = false) {
    const d = this._data;
    const safeCount = Math.max(0, Number.isFinite(count) ? count : 0);
    if (safeCount > d.records.maxConsecutivePockets) {
      d.records.maxConsecutivePockets = safeCount;
    }
    if (endOfGame && safeCount > d.records.maxConsecutivePocketsInGame) {
      d.records.maxConsecutivePocketsInGame = safeCount;
    }
    this._scheduleSave();
  }

  /**
   * Record end of a game.
   * @param {Object} params
   * @param {string} params.mode — game mode
   * @param {'win'|'loss'|'draw'|null} params.result — game result (null for freeplay/trainer)
   * @param {number} params.durationSeconds
   * @param {string} params.difficulty — AI difficulty (for vsai)
   * @param {number} params.myPockets — balls I pocketed
   * @param {number} params.myShots — shots I took
   * @param {number} params.maxStreak — max consecutive pockets this game
   */
  recordGame(params = {}) {
    const d = this._data;
    const mode = d.byMode[params.mode] ? params.mode : 'freeplay';
    const result = params.result; // 'win' | 'loss' | 'draw' | null

    d.gamesPlayed++;
    if (result === 'win') d.gamesWon++;
    else if (result === 'loss') d.gamesLost++;

    // Mode stats
    const modeStats = d.byMode[mode];
    if (modeStats) {
      modeStats.played++;
      if (result === 'win' && 'won' in modeStats) modeStats.won++;
      if (result === 'loss' && 'lost' in modeStats) modeStats.lost++;

      if (mode === 'vsai' && params.difficulty && modeStats.byDifficulty?.[params.difficulty]) {
        const diff = modeStats.byDifficulty[params.difficulty];
        diff.played++;
        if (result === 'win') diff.won++;
        if (result === 'loss') diff.lost++;
      }
      if (mode === 'challenge' && 'completed' in modeStats) {
        if (result === 'win') modeStats.completed++;
      }
    }

    // Streak record
    const safeStreak = Math.max(0, Number.isFinite(params.maxStreak) ? params.maxStreak : 0);
    if (safeStreak > d.records.maxConsecutivePocketsInGame) {
      d.records.maxConsecutivePocketsInGame = safeStreak;
    }

    // Fastest win
    const dur = params.durationSeconds;
    if (result === 'win' && Number.isFinite(dur) && dur > 0) {
      const current = d.records.fastestWinSeconds;
      if (current === null || dur < current) {
        d.records.fastestWinSeconds = dur;
      }
    }

    // Recent games buffer
    if (!Array.isArray(d.recentGames)) d.recentGames = [];
    d.recentGames.push({
      mode,
      result,
      duration: Number.isFinite(params.durationSeconds) ? params.durationSeconds : 0,
      myPockets: Number.isFinite(params.myPockets) ? params.myPockets : 0,
      myShots: Number.isFinite(params.myShots) ? params.myShots : 0,
      maxStreak: safeStreak,
      timestamp: Date.now(),
    });
    if (d.recentGames.length > MAX_RECENT_GAMES) {
      d.recentGames.shift();
    }

    this._save();
  }

  _scheduleSave() {
    if (this._saveTimer) return;
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      this._save();
    }, 800);
  }

  /* ── Reset ── */

  reset() {
    const backup = _deepClone(this._data);
    this._data = _deepClone(DEFAULTS);
    try {
      this._save();
    } catch (e) {
      this._data = backup;
      throw e;
    }
  }
}

export const careerStore = new CareerStore();
