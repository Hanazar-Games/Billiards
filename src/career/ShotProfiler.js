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

  /* ── Training Tips (Coach System) ── */

  /**
   * Generate 3-5 personalized training tips based on career data.
   * Returns empty array when insufficient data.
   */
  getTrainingTips() {
    const tips = [];
    const style = this.store.getShotStyle();
    const totals = this.store.getTotals();
    const shots = this.store.getShotsTaken() || 0;
    const games = this.store.getGamesPlayed() || 0;
    const avgPower = parseFloat(this.getAveragePower());
    const pocketRate = parseFloat(this.getPocketRate());
    const foulRate = parseFloat(this.getFoulRate());

    // Need some baseline data
    if (shots < 5 && games < 2) return [];

    // 1. Power preference
    if (shots >= 10) {
      const heavy = (style.powerBuckets[3] || 0) + (style.powerBuckets[4] || 0);
      const light = (style.powerBuckets[0] || 0) + (style.powerBuckets[1] || 0);
      const heavyRatio = heavy / shots;
      const lightRatio = light / shots;

      if (heavyRatio > 0.5) {
        tips.push({
          category: '力度',
          icon: '💪',
          title: '降低平均发力',
          text: `你 ${(heavyRatio * 100).toFixed(0)}% 的击球使用大/暴杆，母球容易失控。尝试在 40-60% 力度区间多加练习，提升走位精度。`,
          priority: 3,
        });
      } else if (lightRatio > 0.5) {
        tips.push({
          category: '力度',
          icon: '💪',
          title: '适当增加发力',
          text: `你 ${(lightRatio * 100).toFixed(0)}% 的击球偏轻推，进攻范围受限。适当练习中等力度击球，扩大得分手段。`,
          priority: 3,
        });
      } else if (avgPower >= 35 && avgPower <= 65) {
        tips.push({
          category: '力度',
          icon: '💪',
          title: '力度控制均衡',
          text: '你的力度分布较为均衡，轻重结合得当。继续保持，针对不同球型灵活调整。',
          priority: 1,
        });
      }
    }

    // 2. Spin usage
    if (shots >= 10) {
      const spinTotal = (style.spin.top + style.spin.bottom + style.spin.left + style.spin.right);
      const spinRatio = spinTotal / shots;
      const centerRatio = (style.spin.center || 0) / shots;

      if (centerRatio > 0.7) {
        tips.push({
          category: '旋转',
          icon: '🔄',
          title: '尝试更多杆法',
          text: `你 ${(centerRatio * 100).toFixed(0)}% 使用中杆，走位手段较单一。练习高杆跟进、低杆缩回，可以大幅改善母球控制。`,
          priority: 3,
        });
      } else if (spinRatio < 0.15) {
        tips.push({
          category: '旋转',
          icon: '🔄',
          title: '增加旋转使用',
          text: '旋转使用比例偏低。适当加入塞球可以帮助母球到达理想位置，减少后续难度。',
          priority: 2,
        });
      } else {
        tips.push({
          category: '旋转',
          icon: '🔄',
          title: '杆法运用良好',
          text: '你的杆法选择较为丰富，能够根据球型使用不同旋转。继续精进旋转与力度的配合。',
          priority: 1,
        });
      }
    }

    // 3. Long shot accuracy
    if (style.longShotAttempts >= 5) {
      const rate = style.longShotSuccess / style.longShotAttempts;
      if (rate < 0.3) {
        tips.push({
          category: '长台',
          icon: '🎯',
          title: '强化长台稳定性',
          text: `长台命中率 ${(rate * 100).toFixed(0)}% 偏低。建议在训练模式反复练习长距离直球，建立稳定的出杆节奏。`,
          priority: 3,
        });
      } else if (rate >= 0.5) {
        tips.push({
          category: '长台',
          icon: '🎯',
          title: '长台手感出色',
          text: `长台命中率 ${(rate * 100).toFixed(0)}%，值得信任。可以在实战中更自信地选择长台进攻。`,
          priority: 1,
        });
      }
    }

    // 4. Thin cut accuracy
    if (style.thinCutAttempts >= 5) {
      const rate = style.thinCutSuccess / style.thinCutAttempts;
      if (rate < 0.25) {
        tips.push({
          category: '薄球',
          icon: '✨',
          title: '提升薄球成功率',
          text: `薄球成功率 ${(rate * 100).toFixed(0)}% 有提升空间。练习薄球时放慢节奏，注意力集中在大力区与薄边的交界处。`,
          priority: 3,
        });
      } else if (rate >= 0.4) {
        tips.push({
          category: '薄球',
          icon: '✨',
          title: '薄球值得信赖',
          text: `薄球成功率 ${(rate * 100).toFixed(0)}%，技术扎实。在复杂球型中，你的薄球能力可以创造更多机会。`,
          priority: 1,
        });
      }
    }

    // 5. Mode weakness
    const modeTips = this._analyzeModeWeakness();
    if (modeTips) tips.push(modeTips);

    // 6. Foul control
    if (shots >= 10 && foulRate > 12) {
      tips.push({
        category: '纪律',
        icon: '🛡️',
        title: '控制犯规率',
        text: `当前犯规率 ${foulRate.toFixed(1)}% 偏高。注意避免母球落袋和先碰非目标球，提升击球前的规划。`,
        priority: 3,
      });
    }

    // 7. Pocket efficiency
    if (shots >= 10 && pocketRate < 30) {
      tips.push({
        category: '效率',
        icon: '⚡',
        title: '提高进球率',
        text: `进球率 ${pocketRate.toFixed(1)}% 有提升空间。充分利用轨迹线确认瞄准，优先选择成功率更高的球路。`,
        priority: 2,
      });
    }

    // Sort by priority (higher = more important), then shuffle stable by category
    tips.sort((a, b) => b.priority - a.priority);

    // Return 3-5 tips; if fewer than 3 meaningful tips, return empty (not enough data)
    if (tips.length < 2) return [];
    return tips.slice(0, 5);
  }

  _analyzeModeWeakness() {
    const modes = [
      { key: 'vsai', label: 'VS AI' },
      { key: 'local2p', label: '本地对战' },
      { key: '9ball', label: '9球' },
      { key: 'challenge', label: '挑战' },
    ];
    let weakest = null;
    let lowestRate = Infinity;

    for (const m of modes) {
      const s = this.store.getByMode(m.key);
      const decisive = (s.won || 0) + (s.lost || 0);
      if (decisive >= 3) {
        const rate = (s.won || 0) / decisive;
        if (rate < lowestRate) {
          lowestRate = rate;
          weakest = { mode: m.label, won: s.won || 0, lost: s.lost || 0, played: decisive, rate };
        }
      }
    }

    if (weakest && weakest.rate < 0.45) {
      return {
        category: '模式',
        icon: '🎮',
        title: `${weakest.mode} 胜率待提升`,
        text: `${weakest.mode} 模式 ${weakest.played} 战 ${weakest.won} 胜，胜率 ${(weakest.rate * 100).toFixed(0)}%。建议针对性练习该模式的规则和策略。`,
        priority: 3,
      };
    }
    return null;
  }
}
