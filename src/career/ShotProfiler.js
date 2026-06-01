/**
 * ShotProfiler — Analyzes career data to produce player-style labels & insights.
 *
 * Pure data analysis; no DOM or Three.js dependencies.
 */

const STYLE_LABELS = {
  powerHitter:    { id: 'powerHitter',    label: '重炮手',      desc: '偏好大力击球，出杆果断' },
  touchPlayer:    { id: 'touchPlayer',    label: '触感型',      desc: '擅长轻推细控，走位精准' },
  spinArtist:     { id: 'spinArtist',     label: '旋转艺术家',  desc: '频繁使用杆法，母球控制出色' },
  straightShooter:{ id: 'straightShooter',label: '直球型',      desc: '喜欢中心击球，线路简洁' },
  longRange:      { id: 'longRange',      label: '长台杀手',    desc: '长距离进球率高' },
  thinCutMaster:  { id: 'thinCutMaster',  label: '薄球大师',    desc: '高难度薄球成功率惊人' },
  bankSpecialist: { id: 'bankSpecialist', label: '库边专家',    desc: '善于利用库边创造机会' },
  breaker:        { id: 'breaker',        label: '开球机器',    desc: '开球进球率极高' },
  steady:         { id: 'steady',         label: '稳健型',      desc: '失误率低，发挥稳定' },
  aggressive:     { id: 'aggressive',     label: '激进型',      desc: '进攻欲望强烈，敢于冒险' },
};

export class ShotProfiler {
  constructor(careerStore) {
    this.store = careerStore;
  }

  /* ── Style analysis ── */

  /** Returns an array of { label, desc, score } sorted by relevance. */
  analyzeStyle() {
    const style = this.store.getShotStyle();
    const totals = this.store.getTotals();
    const records = this.store.getRecords();
    const shots = this.store.getShotsTaken() || 1;

    const scores = [];

    // Power hitter vs touch player (based on power distribution)
    const heavyPower = (style.powerBuckets[3] || 0) + (style.powerBuckets[4] || 0);
    const lightPower = (style.powerBuckets[0] || 0) + (style.powerBuckets[1] || 0);
    const powerRatio = heavyPower / Math.max(1, shots);
    const touchRatio = lightPower / Math.max(1, shots);

    if (powerRatio > 0.45) {
      scores.push({ ...STYLE_LABELS.powerHitter, score: powerRatio });
    }
    if (touchRatio > 0.4) {
      scores.push({ ...STYLE_LABELS.touchPlayer, score: touchRatio });
    }

    // Spin artist vs straight shooter
    const spinTotal = (style.spin.top + style.spin.bottom + style.spin.left + style.spin.right);
    const spinRatio = spinTotal / Math.max(1, shots);
    const centerRatio = (style.spin.center || 0) / Math.max(1, shots);

    if (spinRatio > 0.35) {
      scores.push({ ...STYLE_LABELS.spinArtist, score: spinRatio });
    }
    if (centerRatio > 0.6) {
      scores.push({ ...STYLE_LABELS.straightShooter, score: centerRatio });
    }

    // Long range
    if (style.longShotAttempts >= 5) {
      const rate = style.longShotSuccess / style.longShotAttempts;
      if (rate > 0.35) {
        scores.push({ ...STYLE_LABELS.longRange, score: rate });
      }
    }

    // Thin cut master
    if (style.thinCutAttempts >= 5) {
      const rate = style.thinCutSuccess / style.thinCutAttempts;
      if (rate > 0.3) {
        scores.push({ ...STYLE_LABELS.thinCutMaster, score: rate });
      }
    }

    // Bank specialist
    if (style.bankAttempts >= 5) {
      const rate = style.bankSuccess / style.bankAttempts;
      if (rate > 0.25) {
        scores.push({ ...STYLE_LABELS.bankSpecialist, score: rate });
      }
    }

    // Breaker
    if (style.breakShots >= 5) {
      const breakRate = style.breakPocketedTotal / style.breakShots;
      if (breakRate > 0.8) {
        scores.push({ ...STYLE_LABELS.breaker, score: Math.min(1, breakRate / 2) });
      }
    }

    // Steady vs aggressive (based on foul rate and power variance)
    const foulRate = (totals.fouls + totals.scratches) / Math.max(1, shots);
    if (foulRate < 0.08 && shots > 20) {
      scores.push({ ...STYLE_LABELS.steady, score: 1 - foulRate * 5 });
    }
    if (powerRatio > 0.35 && foulRate > 0.12) {
      scores.push({ ...STYLE_LABELS.aggressive, score: powerRatio });
    }

    // Sort by score descending, cap at 3 labels
    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, 3);
  }

  /* ── Derived stats ── */

  getAveragePower() {
    const totals = this.store.getTotals();
    const shots = this.store.getShotsTaken();
    return shots > 0 ? (totals.totalShotPower / shots).toFixed(1) : '0.0';
  }

  getPocketRate() {
    const totals = this.store.getTotals();
    const shots = this.store.getShotsTaken();
    return shots > 0 ? ((totals.ballsPocketed / shots) * 100).toFixed(1) : '0.0';
  }

  getFoulRate() {
    const totals = this.store.getTotals();
    const shots = this.store.getShotsTaken();
    return shots > 0 ? (((totals.fouls + totals.scratches) / shots) * 100).toFixed(1) : '0.0';
  }

  getSpinPreference() {
    const style = this.store.getShotStyle();
    const total = style.spin.top + style.spin.bottom + style.spin.left + style.spin.right + style.spin.center;
    if (total === 0) return [];
    return [
      { name: '高杆', count: style.spin.top, pct: (style.spin.top / total * 100).toFixed(0) },
      { name: '低杆', count: style.spin.bottom, pct: (style.spin.bottom / total * 100).toFixed(0) },
      { name: '左塞', count: style.spin.left, pct: (style.spin.left / total * 100).toFixed(0) },
      { name: '右塞', count: style.spin.right, pct: (style.spin.right / total * 100).toFixed(0) },
      { name: '中杆', count: style.spin.center, pct: (style.spin.center / total * 100).toFixed(0) },
    ].sort((a, b) => b.count - a.count);
  }

  /** Win rate trend over recent games (array of 0-1 values). */
  getWinTrend(windowSize = 10) {
    const recent = this.store.getRecentGames();
    if (recent.length === 0) return [];

    const trend = [];
    for (let i = 0; i < recent.length; i++) {
      const start = Math.max(0, i - windowSize + 1);
      const slice = recent.slice(start, i + 1);
      const decisive = slice.filter(g => g.result === 'win' || g.result === 'loss');
      if (decisive.length === 0) {
        trend.push(null);
      } else {
        const wins = decisive.filter(g => g.result === 'win').length;
        trend.push(wins / decisive.length);
      }
    }
    return trend;
  }

  /** Recent games grouped by mode for a bar chart. */
  getModeBreakdown() {
    const modes = ['vsai', 'local2p', '9ball', 'freeplay', 'trainer', 'challenge'];
    const labels = { vsai: 'VS AI', local2p: '本地对战', '9ball': '9球', freeplay: '练习', trainer: '训练', challenge: '挑战' };
    return modes.map(key => {
      const s = this.store.getByMode(key);
      return {
        mode: key,
        label: labels[key] || key,
        played: s.played || 0,
        won: s.won || 0,
        lost: s.lost || 0,
        winRate: s.played > 0 ? ((s.won || 0) / s.played * 100).toFixed(0) : '0',
      };
    }).filter(m => m.played > 0);
  }

  /** Special shot accuracy summary. */
  getSpecialShots() {
    const style = this.store.getShotStyle();
    const items = [];

    if (style.longShotAttempts > 0) {
      items.push({
        name: '长台进攻',
        attempts: style.longShotAttempts,
        success: style.longShotSuccess,
        rate: (style.longShotSuccess / style.longShotAttempts * 100).toFixed(1),
      });
    }
    if (style.thinCutAttempts > 0) {
      items.push({
        name: '薄球',
        attempts: style.thinCutAttempts,
        success: style.thinCutSuccess,
        rate: (style.thinCutSuccess / style.thinCutAttempts * 100).toFixed(1),
      });
    }
    if (style.bankAttempts > 0) {
      items.push({
        name: '库边球',
        attempts: style.bankAttempts,
        success: style.bankSuccess,
        rate: (style.bankSuccess / style.bankAttempts * 100).toFixed(1),
      });
    }
    if (style.breakShots > 0) {
      items.push({
        name: '开球',
        attempts: style.breakShots,
        success: style.breakPocketedTotal,
        rate: (style.breakPocketedTotal / style.breakShots).toFixed(1),
      });
    }
    return items;
  }

  /** Overall career summary for the top cards. */
  getSummary() {
    const games = this.store.getGamesPlayed();
    const won = this.store.getGamesWon();
    const lost = this.store.getGamesLost();
    const shots = this.store.getShotsTaken();
    const records = this.store.getRecords();
    const totals = this.store.getTotals();

    return {
      games,
      won,
      lost,
      winRate: games > 0 ? ((won / games) * 100).toFixed(1) : '0.0',
      shots,
      avgPower: this.getAveragePower(),
      pocketRate: this.getPocketRate(),
      foulRate: this.getFoulRate(),
      ballsPocketed: totals.ballsPocketed,
      maxConsecutive: records.maxConsecutivePockets,
      maxConsecutiveInGame: records.maxConsecutivePocketsInGame,
      fastestWin: records.fastestWinSeconds,
      highestPower: records.highestShotPower,
      labels: this.analyzeStyle(),
    };
  }
}
