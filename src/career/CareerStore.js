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
    this._load();
  }

  /* ── Persistence ── */

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        // Merge loaded data over defaults (handles schema migration)
        this._data = this._mergeDeep(_deepClone(DEFAULTS), parsed);
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
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key] || typeof target[key] !== 'object') target[key] = {};
        this._mergeDeep(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
    return target;
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
    return _deepClone(this._data.byMode[mode] || { played: 0, won: 0, lost: 0 });
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
    d.totals.totalShotPower += power;

    // Records
    if (power > d.records.highestShotPower) d.records.highestShotPower = power;
    if ((params.collisions || 0) > d.records.mostCollisionsInOneShot) {
      d.records.mostCollisionsInOneShot = params.collisions || 0;
    }
    if ((params.cushions || 0) > d.records.mostCushionsInOneShot) {
      d.records.mostCushionsInOneShot = params.cushions || 0;
    }

    // Spin
    const sx = params.spin?.x ?? 0;
    const sy = params.spin?.y ?? 0;
    if (Math.abs(sx) < 0.1 && Math.abs(sy) < 0.1) {
      d.shotStyle.spin.center++;
    } else {
      if (sy > 0.1) d.shotStyle.spin.top++;
      if (sy < -0.1) d.shotStyle.spin.bottom++;
      if (sx > 0.1) d.shotStyle.spin.left++;
      if (sx < -0.1) d.shotStyle.spin.right++;
    }

    // Special shots
    if (params.isBreak) {
      d.shotStyle.breakShots++;
      d.shotStyle.breakPocketedTotal += params.pocketedCount || 0;
    }
    if (params.isLongShot) {
      d.shotStyle.longShotAttempts++;
      if ((params.pocketedCount || 0) > 0) d.shotStyle.longShotSuccess++;
    }
    if (params.isThinCut) {
      d.shotStyle.thinCutAttempts++;
      if ((params.pocketedCount || 0) > 0) d.shotStyle.thinCutSuccess++;
    }
    if (params.isBank) {
      d.shotStyle.bankAttempts++;
      if ((params.pocketedCount || 0) > 0) d.shotStyle.bankSuccess++;
    }

    // Totals
    d.totals.ballsPocketed += params.pocketedCount || 0;
    if (params.isFoul) d.totals.fouls++;
    if (params.isScratch) d.totals.scratches++;
    d.totals.ballCollisions += params.collisions || 0;
    d.totals.cushionCollisions += params.cushions || 0;

    // Pocketed record
    if ((params.pocketedCount || 0) > d.records.highestBallsInOneTurn) {
      d.records.highestBallsInOneTurn = params.pocketedCount;
    }

    this._save();
  }

  /**
   * Record consecutive pocket streak.
   * @param {number} count — consecutive pockets in current streak
   * @param {boolean} endOfGame — whether this is the final game tally
   */
  recordStreak(count, endOfGame = false) {
    const d = this._data;
    if (count > d.records.maxConsecutivePockets) {
      d.records.maxConsecutivePockets = count;
    }
    if (endOfGame && count > d.records.maxConsecutivePocketsInGame) {
      d.records.maxConsecutivePocketsInGame = count;
    }
    this._save();
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
    const mode = params.mode || 'freeplay';
    const result = params.result; // 'win' | 'loss' | 'draw' | null

    d.gamesPlayed++;
    if (result === 'win') d.gamesWon++;
    else if (result === 'loss') d.gamesLost++;

    // Mode stats
    const modeStats = d.byMode[mode];
    if (modeStats) {
      modeStats.played++;
      if (result === 'win') modeStats.won++;
      if (result === 'loss') modeStats.lost++;

      if (mode === 'vsai' && params.difficulty && modeStats.byDifficulty?.[params.difficulty]) {
        const diff = modeStats.byDifficulty[params.difficulty];
        diff.played++;
        if (result === 'win') diff.won++;
        if (result === 'loss') diff.lost++;
      }
      if (mode === 'challenge') {
        if (result === 'win') modeStats.completed++;
      }
    }

    // Streak record
    if ((params.maxStreak || 0) > d.records.maxConsecutivePocketsInGame) {
      d.records.maxConsecutivePocketsInGame = params.maxStreak || 0;
    }

    // Fastest win
    if (result === 'win' && params.durationSeconds > 0) {
      const current = d.records.fastestWinSeconds;
      if (current === null || params.durationSeconds < current) {
        d.records.fastestWinSeconds = params.durationSeconds;
      }
    }

    // Recent games buffer
    d.recentGames.push({
      mode,
      result,
      duration: params.durationSeconds || 0,
      myPockets: params.myPockets || 0,
      myShots: params.myShots || 0,
      maxStreak: params.maxStreak || 0,
      timestamp: Date.now(),
    });
    if (d.recentGames.length > MAX_RECENT_GAMES) {
      d.recentGames.shift();
    }

    this._save();
  }

  /* ── Reset ── */

  reset() {
    this._data = _deepClone(DEFAULTS);
    this._save();
  }
}

export const careerStore = new CareerStore();
