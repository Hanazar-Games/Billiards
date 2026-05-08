/**
 * StatsTracker - Comprehensive match statistics tracker.
 * Records every shot, pocket, foul, collision, and streak.
 * Pure data logic, no Three.js or DOM dependencies.
 */
export class StatsTracker {
  constructor() {
    this.reset();
  }

  reset() {
    this.gameStartTime = performance.now();
    this.gameEndTime = null;
    this.totalTurns = 0;
    this.currentTurnStart = null;

    this.playerStats = {
      1: this._createPlayerStats(),
      2: this._createPlayerStats(),
    };

    this.matchStats = {
      longestStreak: { player: null, count: 0 },
      currentStreak: { player: null, count: 0 },
      totalBallCollisions: 0,
      totalCushionCollisions: 0,
    };
  }

  _createPlayerStats() {
    return {
      shots: 0,
      ballsPocketed: 0,
      fouls: 0,
      scratches: 0,
      totalPower: 0,
      maxPower: 0,
      ballCollisions: 0,
      cushionCollisions: 0,
      consecutivePockets: 0,
      maxConsecutivePockets: 0,
    };
  }

  _validatePlayer(player) {
    if (player !== 1 && player !== 2) {
      console.warn('StatsTracker: invalid player', player);
      return false;
    }
    return true;
  }

  /** Call when a player begins their turn (start of aiming). */
  startTurn(player) {
    if (!this._validatePlayer(player)) return;
    this.currentTurnStart = performance.now();
    this.totalTurns++;
  }

  /** Call when a shot is actually taken (ball struck). */
  recordShot(player, power) {
    if (!this._validatePlayer(player)) return;
    if (!Number.isFinite(power) || power < 0) {
      console.warn('StatsTracker: invalid power', power);
      return;
    }
    const stats = this.playerStats[player];
    stats.shots++;
    stats.totalPower += power;
    if (power > stats.maxPower) {
      stats.maxPower = power;
    }
  }

  /** Call for each ball pocketed during a turn. */
  recordPocket(player, ballId) {
    if (!this._validatePlayer(player)) return;
    const stats = this.playerStats[player];
    stats.ballsPocketed++;
    stats.consecutivePockets++;

    if (stats.consecutivePockets > stats.maxConsecutivePockets) {
      stats.maxConsecutivePockets = stats.consecutivePockets;
    }

    // Update match streak
    const streak = this.matchStats.currentStreak;
    if (streak.player === player) {
      streak.count++;
    } else {
      streak.player = player;
      streak.count = 1;
    }

    if (streak.count > this.matchStats.longestStreak.count) {
      this.matchStats.longestStreak = { player: streak.player, count: streak.count };
    }
  }

  /** Call when a turn ends with no balls pocketed (not a foul). */
  recordMiss(player) {
    if (!this._validatePlayer(player)) return;
    this.playerStats[player].consecutivePockets = 0;
    this.matchStats.currentStreak = { player: null, count: 0 };
  }

  /** Call when a foul occurs. */
  recordFoul(player, isScratch = false) {
    if (!this._validatePlayer(player)) return;
    const stats = this.playerStats[player];
    stats.fouls++;
    if (isScratch) {
      stats.scratches++;
    }
    stats.consecutivePockets = 0;
    this.matchStats.currentStreak = { player: null, count: 0 };
  }

  /** Call on ball-ball collision. */
  recordBallCollision(player) {
    if (!this._validatePlayer(player)) return;
    this.matchStats.totalBallCollisions++;
    this.playerStats[player].ballCollisions++;
  }

  /** Call on ball-cushion collision. */
  recordCushionCollision(player) {
    if (!this._validatePlayer(player)) return;
    this.matchStats.totalCushionCollisions++;
    this.playerStats[player].cushionCollisions++;
  }

  /** Call when the match ends. */
  endGame(winner) {
    this.gameEndTime = performance.now();
    return this.getSummary(winner);
  }

  /** Get full summary (useful for end-of-game display). */
  getSummary(winner) {
    const duration = this.gameEndTime
      ? (this.gameEndTime - this.gameStartTime) / 1000
      : (performance.now() - this.gameStartTime) / 1000;

    const p1 = this.playerStats[1];
    const p2 = this.playerStats[2];

    return {
      duration,
      totalTurns: this.totalTurns,
      winner,
      player1: {
        ...p1,
        avgPower: p1.shots > 0 ? p1.totalPower / p1.shots : 0,
        pocketRate: p1.shots > 0 ? Math.min(100, (p1.ballsPocketed / p1.shots) * 100) : 0,
      },
      player2: {
        ...p2,
        avgPower: p2.shots > 0 ? p2.totalPower / p2.shots : 0,
        pocketRate: p2.shots > 0 ? Math.min(100, (p2.ballsPocketed / p2.shots) * 100) : 0,
      },
      match: { ...this.matchStats },
    };
  }

  /** Get lightweight live stats for in-game HUD updates. */
  getLiveStats() {
    const duration = (performance.now() - this.gameStartTime) / 1000;
    const p1 = this.playerStats[1];
    const p2 = this.playerStats[2];

    const fmt = (n) => (n > 0 ? n.toFixed(1) : '0.0');
    const fmtPct = (n) => (n > 0 ? Math.round(n) + '%' : '0%');

    return {
      duration: this._formatDuration(duration),
      totalTurns: this.totalTurns,
      player1: {
        shots: p1.shots,
        pocketed: p1.ballsPocketed,
        fouls: p1.fouls,
        scratches: p1.scratches,
        avgPower: fmt(p1.shots > 0 ? p1.totalPower / p1.shots : 0),
        maxPower: Math.round(p1.maxPower),
        pocketRate: fmtPct(p1.shots > 0 ? Math.min(100, (p1.ballsPocketed / p1.shots) * 100) : 0),
        streak: p1.maxConsecutivePockets,
      },
      player2: {
        shots: p2.shots,
        pocketed: p2.ballsPocketed,
        fouls: p2.fouls,
        scratches: p2.scratches,
        avgPower: fmt(p2.shots > 0 ? p2.totalPower / p2.shots : 0),
        maxPower: Math.round(p2.maxPower),
        pocketRate: fmtPct(p2.shots > 0 ? Math.min(100, (p2.ballsPocketed / p2.shots) * 100) : 0),
        streak: p2.maxConsecutivePockets,
      },
      longestStreak: { ...this.matchStats.longestStreak },
      totalCollisions: this.matchStats.totalBallCollisions + this.matchStats.totalCushionCollisions,
    };
  }

  _formatDuration(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}
