/**
 * AchievementStore — Persistent storage for unlocked achievements.
 *
 * Uses localStorage to survive across sessions.
 * Stores:
 *   - unlocked: { [achievementId]: timestamp }
 *   - stats: cumulative counters (shots, pockets, wins, etc.)
 *   - modesWon: set of game modes the player has won in
 */
const STORAGE_KEY = 'billiards_achievements_v1';

export class AchievementStore {
  constructor() {
    this.data = this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('AchievementStore: failed to load', e);
    }
    return {
      unlocked: {},
      stats: {
        totalShots: 0,
        totalPockets: 0,
        totalWins: 0,
        totalGames: 0,
        totalCollisions: 0,
        currentStreak: 0,
        bestStreak: 0,
        foulCount: 0,
        spinShots: 0,
      },
      modesWon: [],
      firstUnlockTime: null,
    };
  }

  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('AchievementStore: failed to save', e);
    }
  }

  /** Check if an achievement is unlocked */
  isUnlocked(id) {
    return !!this.data.unlocked[id];
  }

  /** Unlock an achievement. Returns true if newly unlocked, false if already unlocked. */
  unlock(id) {
    if (this.isUnlocked(id)) return false;
    this.data.unlocked[id] = Date.now();
    if (!this.data.firstUnlockTime) {
      this.data.firstUnlockTime = Date.now();
    }
    this._save();
    return true;
  }

  /** Get unlock timestamp (or null) */
  getUnlockTime(id) {
    return this.data.unlocked[id] || null;
  }

  /** Get number of unlocked achievements */
  getUnlockedCount() {
    return Object.keys(this.data.unlocked).length;
  }

  /** Increment a stat counter */
  incrementStat(key, amount = 1) {
    if (this.data.stats[key] !== undefined) {
      this.data.stats[key] += amount;
      this._save();
    }
  }

  /** Set a stat value */
  setStat(key, value) {
    if (this.data.stats[key] !== undefined) {
      this.data.stats[key] = value;
      this._save();
    }
  }

  /** Get a stat value */
  getStat(key) {
    return this.data.stats[key] || 0;
  }

  /** Record a win in a specific mode */
  recordModeWin(mode) {
    if (!this.data.modesWon.includes(mode)) {
      this.data.modesWon.push(mode);
      this._save();
    }
  }

  /** Check if player has won in a mode */
  hasWonMode(mode) {
    return this.data.modesWon.includes(mode);
  }

  /** Get all won modes */
  getModesWon() {
    return [...this.data.modesWon];
  }

  /** Reset all progress (for testing) */
  reset() {
    this.data = {
      unlocked: {},
      stats: {
        totalShots: 0,
        totalPockets: 0,
        totalWins: 0,
        totalGames: 0,
        totalCollisions: 0,
        currentStreak: 0,
        bestStreak: 0,
        foulCount: 0,
        spinShots: 0,
      },
      modesWon: [],
      firstUnlockTime: null,
    };
    this._save();
  }
}
