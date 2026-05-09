/**
 * AchievementSystem — Detects and unlocks achievements based on gameplay events.
 *
 * Wires into Game.js lifecycle:
 *   - onShot()       — shot taken
 *   - onPocket()     — ball pocketed
 *   - onCollision()  — ball-ball or ball-cushion collision
 *   - onTurnEnd()    — turn resolved (win/lose/foul)
 *   - onGameEnd()    — match ended
 *
 * Each detector receives current game context and checks unlock conditions.
 */
import { ACHIEVEMENTS } from './AchievementData.js';
import { AchievementStore } from './AchievementStore.js';

export class AchievementSystem {
  constructor() {
    this.store = new AchievementStore();
    this.onUnlock = null; // callback(achievementId)

    // Per-shot tracking (reset each shot)
    this._shotReset();

    // Per-game tracking
    this._wasBehind = false;
    this._pocketsP1 = 0;
    this._pocketsP2 = 0;
  }

  _shotReset() {
    this.shotPocketedIds = [];
    this.shotCollisions = 0;
    this.shotCushionHits = 0;
    this.shotMaxDistance = 0;
    this.shotStartPos = null;
    this.shotPower = 0;
    this.shotUsedSpin = false;
    this.shotStartTime = 0;
  }

  // ── Event hooks called by Game.js ──

  /** Call when a shot begins (cue ball struck) */
  onShot(cueBall, power, spin, currentPlayer) {
    this._shotReset();
    this.shotStartPos = cueBall.mesh.position.clone();
    this.shotPower = power;
    this.shotUsedSpin = Math.abs(spin.x) > 0.05 || Math.abs(spin.z) > 0.05;
    this.shotStartTime = performance.now();
    this.currentPlayer = currentPlayer;

    this.store.incrementStat('totalShots', 1);

    // Check cumulative shot achievements
    this._checkCareer('shots_100', () => this.store.getStat('totalShots') >= 100);
    this._checkCareer('shots_500', () => this.store.getStat('totalShots') >= 500);

    // Spin shot
    if (this.shotUsedSpin) {
      this.store.incrementStat('spinShots', 1);
    }
  }

  /** Call each frame during a shot to track distance */
  onShotUpdate(cueBall) {
    if (!this.shotStartPos) return;
    const dx = cueBall.mesh.position.x - this.shotStartPos.x;
    const dz = cueBall.mesh.position.z - this.shotStartPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > this.shotMaxDistance) {
      this.shotMaxDistance = dist;
    }
  }

  /** Call when a ball is pocketed during a shot */
  onPocket(ballId, pocketPos, mode) {
    this.shotPocketedIds.push(ballId);
    this.store.incrementStat('totalPockets', 1);

    // Track per-player pocket counts for comeback detection
    if (this.currentPlayer === 1) this._pocketsP1++;
    else if (this.currentPlayer === 2) this._pocketsP2++;

    // Check cumulative pocket achievements
    this._checkCareer('pockets_50', () => this.store.getStat('totalPockets') >= 50);
    this._checkCareer('pockets_200', () => this.store.getStat('totalPockets') >= 200);

    // Spin shot achievement
    if (this.shotUsedSpin) {
      this._checkUnlock('spin_shot', () => true);
    }
  }

  /** Call on ball-ball collision */
  onBallCollision(relVel) {
    this.shotCollisions++;
    this.store.incrementStat('totalCollisions', 1);

    // Combo achievement
    this._checkUnlock('combo_3', () => this.shotCollisions >= 3);
  }

  /** Call on ball-cushion collision */
  onCushionCollision() {
    this.shotCushionHits++;

    // Cushion dancer
    this._checkUnlock('cushion_master', () => this.shotCushionHits >= 4);
  }

  /** Call when a turn ends (all balls stopped) */
  onTurnEnd(result, pocketedIds, mode) {
    // Multi-pocket achievements
    const nonCuePocketed = pocketedIds.filter((id) => id !== 0);
    this._checkUnlock('multi_pocket_3', () => nonCuePocketed.length >= 3);
    this._checkUnlock('multi_pocket_4', () => nonCuePocketed.length >= 4);

    // Long shot (if any ball pocketed and distance > 200cm = 200 units)
    if (nonCuePocketed.length > 0 && this.shotMaxDistance > 200) {
      this._checkUnlock('long_shot', () => true);
    }

    // Max power
    if (nonCuePocketed.length > 0 && this.shotPower >= 98) {
      this._checkUnlock('max_power', () => true);
    }

    // Bank shot (simplified: a cushion was hit before at least one ball dropped)
    if (nonCuePocketed.length > 0 && this.shotCushionHits > 0) {
      this._checkUnlock('bank_shot', () => true);
    }

    // Soft touch
    if (nonCuePocketed.length > 0 && this.shotPower <= 10) {
      this._checkUnlock('soft_touch', () => true);
    }

    // Trail beauty
    if (this.shotMaxDistance > 150) {
      this._checkUnlock('trail_beauty', () => true);
    }

    // Comeback tracking: record pocket counts per player after each turn
    if (result.nextPlayer) {
      const current = this.currentPlayer === 1 ? this._pocketsP1 : this._pocketsP2;
      const other = this.currentPlayer === 1 ? this._pocketsP2 : this._pocketsP1;
      if (current < other) {
        this._wasBehind = true;
      }
    }
  }

  /** Call when a match ends */
  onGameEnd(winner, player, mode, difficulty, durationSeconds, stats) {
    this.store.incrementStat('totalGames', 1);

    // Record mode win
    if (winner === player) {
      this.store.recordModeWin(mode);
      this.store.incrementStat('totalWins', 1);

      // Streak tracking
      this.store.setStat('currentStreak', this.store.getStat('currentStreak') + 1);
      const streak = this.store.getStat('currentStreak');
      if (streak > this.store.getStat('bestStreak')) {
        this.store.setStat('bestStreak', streak);
      }

      // First win
      this._checkUnlock('first_win', () => this.store.getStat('totalWins') === 1);

      // Wins achievements
      this._checkCareer('wins_10', () => this.store.getStat('totalWins') >= 10);
      this._checkCareer('wins_50', () => this.store.getStat('totalWins') >= 50);

      // Streak
      this._checkUnlock('streak_5', () => streak >= 5);

      // AI wins
      if (mode === 'vsai') {
        this._checkUnlock('vs_ai_win', () => true);
        if (difficulty === 'hard') {
          this._checkUnlock('vs_ai_hard', () => true);
        }
      }

      // Perfect match (no fouls in this game)
      const totalFouls = stats
        ? (stats.player1?.fouls || 0) + (stats.player2?.fouls || 0)
        : null;
      if (totalFouls === 0) {
        this._checkUnlock('no_foul_win', () => true);
      }

      // Shutout (opponent pocketed 0 balls)
      const opponent = winner === 1 ? 2 : 1;
      const opponentPocketed = stats && stats.opponentPocketed ? stats.opponentPocketed[opponent] : null;
      if (opponentPocketed === 0) {
        this._checkUnlock('shutout', () => true);
      }

      // Speed demon (game finished in < 30 seconds)
      if (durationSeconds < 30) {
        this._checkUnlock('speed_demon', () => true);
      }

      // 8-ball perfect finish
      const winnerStats = winner === 1 ? (stats && stats.player1) : (stats && stats.player2);
      const isEightBallMode = mode === 'local2p' || mode === 'vsai';
      if (isEightBallMode && winnerStats && winnerStats.eightBallPocketed) {
        this._checkUnlock('eight_ball_perfect', () => true);
      }

      // Comeback (was behind but won)
      if (this._wasBehind) {
        this._checkUnlock('comeback', () => true);
      }
    } else {
      // Reset streak on loss
      this.store.setStat('currentStreak', 0);
    }

    // Reset per-game tracking
    this._wasBehind = false;
    this._pocketsP1 = 0;
    this._pocketsP2 = 0;

    // All modes
    const modesWon = this.store.getModesWon();
    const requiredWinModes = ['local2p', 'vsai', '9ball'];
    this._checkUnlock('all_modes', () => requiredWinModes.every((mode) => modesWon.includes(mode)));

    // Collector (20 achievements)
    this._checkUnlock('collector', () => this.store.getUnlockedCount() >= 20);

    // Games played
    this._checkCareer('games_20', () => this.store.getStat('totalGames') >= 20);
  }

  /** Call on break shot */
  onBreakShot(pocketedIds, mode) {
    if (pocketedIds.length >= 4) {
      this._checkUnlock('perfect_break', () => true);
    }
    if (mode === '9ball' && pocketedIds.includes(9)) {
      this._checkUnlock('nine_ball_break', () => true);
    }
  }

  /** Call when a foul occurs */
  onFoul() {
    this.store.incrementStat('foulCount', 1);
  }

  // ── Internal helpers ──

  _checkUnlock(id, conditionFn) {
    if (this.store.isUnlocked(id)) return;
    if (conditionFn()) {
      const newlyUnlocked = this.store.unlock(id);
      if (newlyUnlocked && this.onUnlock) {
        this.onUnlock(id);
      }
    }
  }

  _checkCareer(id, conditionFn) {
    this._checkUnlock(id, conditionFn);
  }

  /** Get all achievements with unlock status */
  getAllAchievements() {
    return ACHIEVEMENTS.map((a) => ({
      ...a,
      unlocked: this.store.isUnlocked(a.id),
      unlockedAt: this.store.getUnlockTime(a.id),
    }));
  }

  /** Get unlocked achievements */
  getUnlockedAchievements() {
    return this.getAllAchievements().filter((a) => a.unlocked);
  }

  /** Reset all progress (for testing) */
  resetAll() {
    this.store.reset();
  }
}
