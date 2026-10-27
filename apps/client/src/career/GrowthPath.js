/**
 * GrowthPath — Connects career weaknesses to concrete drills & challenges.
 *
 * Pure data analysis; no DOM dependencies.
 * Uses ShotProfiler + CareerStore to detect weaknesses and maps them
 * to specific Drill IDs and Challenge IDs.
 */

import { getDrill } from '../trainer/DrillData.js';
import { getChallenge, isUnlocked } from '../challenges/ChallengeData.js';
import { DrillManager } from '../trainer/DrillManager.js';

// ------------------------------------------------------------------
// Weakness → Recommendations mapping
// Each weakness yields up to 2 candidates (drill + challenge).
// ------------------------------------------------------------------

const WEAKNESS_MAP = {
  powerHeavy: [
    { type: 'drill', id: 'soft_touch', priority: 3, reason: '你的击球力度偏大，建议通过轻推练习建立细腻控制' },
    { type: 'challenge', id: 'feather_touch', priority: 3, reason: '挑战 ≤10% 力度进球，训练极致发力控制' },
  ],
  powerLight: [
    { type: 'drill', id: 'soft_touch', priority: 2, reason: '你的击球力度偏小，继续精进轻推可以提升走位精度' },
    { type: 'challenge', id: 'soft_touch', priority: 2, reason: '在 ≤15% 力度限制下完成进球，巩固轻推手感' },
  ],
  spinWeak: [
    { type: 'drill', id: 'position_play', priority: 3, reason: '旋转使用较少，走位练习能帮助你理解杆法价值' },
    { type: 'challenge', id: 'spin_win', priority: 3, reason: '挑战必须使用旋转进球并获胜' },
  ],
  longShotWeak: [
    { type: 'drill', id: 'long_shot', priority: 3, reason: '长台命中率偏低，建议针对性练习长距离进球' },
    { type: 'challenge', id: 'sniper', priority: 2, reason: '从超远距离进球，强化长台信心' },
  ],
  thinCutWeak: [
    { type: 'drill', id: 'thin_cut', priority: 3, reason: '薄球成功率有提升空间，建议练习极限薄球' },
    { type: 'challenge', id: 'combo_king', priority: 1, reason: '通过组合球练习角度计算' },
  ],
  bankWeak: [
    { type: 'drill', id: 'bank_shot', priority: 2, reason: '库边球命中率偏低，建议练习翻袋技巧' },
    { type: 'challenge', id: 'bank_easy', priority: 2, reason: '通过碰库反弹后进袋，建立翻袋感觉' },
  ],
  foulHigh: [
    { type: 'drill', id: 'straight_shot', priority: 3, reason: '犯规率偏高，回归基本功有助于稳定发挥' },
    { type: 'challenge', id: 'no_foul_win', priority: 2, reason: '整局无犯规获胜，培养稳健心态' },
  ],
  pocketLow: [
    { type: 'drill', id: 'straight_shot', priority: 2, reason: '进球率偏低，建议从直线球开始重建信心' },
    { type: 'challenge', id: 'multi_3', priority: 1, reason: '尝试一杆进多球，提升进攻效率' },
  ],
};

const FALLBACK_RECOMMENDATIONS = [
  { type: 'drill', id: 'cut_shot_easy', priority: 1, reason: '推荐练习简单角度球，拓展进攻手段' },
  { type: 'drill', id: 'position_play', priority: 1, reason: '推荐练习走位，提升母球控制能力' },
  { type: 'challenge', id: 'long_shot', priority: 1, reason: '尝试长台神射，建立远距离进球信心' },
];

const BEGINNER_RECOMMENDATIONS = [
  { type: 'drill', id: 'straight_shot', priority: 1, reason: '从基本功开始：掌握稳定的直线球是一切技术的基础' },
  { type: 'drill', id: 'soft_touch', priority: 1, reason: '练习力度控制：学习如何用不同力度处理球' },
  { type: 'challenge', id: 'soft_touch', priority: 1, reason: '挑战轻推进球：在限制力度下完成进球' },
];

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function _detectWeaknesses(profiler, store) {
  const weaknesses = [];
  const style = store.getShotStyle();
  const shots = Math.max(0, store.getShotsTaken() || 0);
  const avgPower = parseFloat(profiler.getAveragePower()) || 0;
  const pocketRate = parseFloat(profiler.getPocketRate()) || 0;
  const foulRate = parseFloat(profiler.getFoulRate()) || 0;

  if (shots >= 10) {
    const heavy = (Number(style.powerBuckets?.[3]) || 0) + (Number(style.powerBuckets?.[4]) || 0);
    const light = (Number(style.powerBuckets?.[0]) || 0) + (Number(style.powerBuckets?.[1]) || 0);
    const heavyRatio = heavy / shots;
    const lightRatio = light / shots;

    if (heavyRatio > 0.5) {
      weaknesses.push({ key: 'powerHeavy', priority: 3 });
    } else if (lightRatio > 0.5) {
      weaknesses.push({ key: 'powerLight', priority: 2 });
    } else if (avgPower > 70) {
      weaknesses.push({ key: 'powerHeavy', priority: 2 });
    } else if (avgPower < 25) {
      weaknesses.push({ key: 'powerLight', priority: 2 });
    }
  }

  if (shots >= 10) {
    const centerRatio = (Number(style.spin?.center) || 0) / shots;
    const spinTotal = (Number(style.spin?.top) || 0) + (Number(style.spin?.bottom) || 0)
      + (Number(style.spin?.left) || 0) + (Number(style.spin?.right) || 0);
    const spinRatio = spinTotal / shots;

    if (centerRatio > 0.7) {
      weaknesses.push({ key: 'spinWeak', priority: 3 });
    } else if (spinRatio < 0.15) {
      weaknesses.push({ key: 'spinWeak', priority: 2 });
    }
  }

  const longAttempts = Number(style.longShotAttempts) || 0;
  if (longAttempts >= 5) {
    const rate = (Number(style.longShotSuccess) || 0) / longAttempts;
    if (rate < 0.3) weaknesses.push({ key: 'longShotWeak', priority: 3 });
  }

  const thinAttempts = Number(style.thinCutAttempts) || 0;
  if (thinAttempts >= 5) {
    const rate = (Number(style.thinCutSuccess) || 0) / thinAttempts;
    if (rate < 0.25) weaknesses.push({ key: 'thinCutWeak', priority: 3 });
  }

  const bankAttempts = Number(style.bankAttempts) || 0;
  if (bankAttempts >= 5) {
    const rate = (Number(style.bankSuccess) || 0) / bankAttempts;
    if (rate < 0.25) weaknesses.push({ key: 'bankWeak', priority: 2 });
  }

  if (shots >= 10 && foulRate > 12) {
    weaknesses.push({ key: 'foulHigh', priority: 3 });
  }

  if (shots >= 10 && pocketRate < 30) {
    weaknesses.push({ key: 'pocketLow', priority: 2 });
  }

  // Sort by priority descending
  weaknesses.sort((a, b) => b.priority - a.priority);
  return weaknesses;
}

function _fillMeta(item) {
  if (item.type === 'drill') {
    const drill = getDrill(item.id);
    if (drill) {
      item.name = drill.name;
      item.difficulty = drill.difficulty;
      item.category = drill.category;
    } else {
      item.name = item.id;
      item.difficulty = 1;
      item.category = 'BASIC';
    }
  } else {
    const ch = getChallenge(item.id);
    if (ch) {
      item.name = ch.name;
      item.difficulty = ch.difficulty;
    } else {
      item.name = item.id;
      item.difficulty = 1;
    }
  }
  return item;
}

function _checkUnlocked(item, drillBest, challengeBest) {
  if (item.type === 'drill') {
    return DrillManager.isUnlocked(item.id);
  }
  const ch = getChallenge(item.id);
  if (!ch) return false;
  return isUnlocked(ch, challengeBest);
}

// ------------------------------------------------------------------
// Public API
// ------------------------------------------------------------------

export class GrowthPath {
  constructor(shotProfiler) {
    this.profiler = shotProfiler;
  }

  /**
   * Analyze player weaknesses and return up to 3 concrete recommendations.
   *
   * @param {Object} drillBest — DrillManager.getAllBest() result (optional)
   * @param {Object} challengeBest — ChallengeManager.getAllBest() result (optional)
   * @returns {Array<{type:'drill'|'challenge',id,name,difficulty,priority,reason,unlocked}>}
   */
  analyze(drillBest = {}, challengeBest = {}) {
    const store = this.profiler.store;
    const shots = Math.max(0, store.getShotsTaken() || 0);
    const games = Math.max(0, store.getGamesPlayed() || 0);

    // Insufficient data → beginner recommendations
    if (shots < 5 && games < 2) {
      return this._finalize(BEGINNER_RECOMMENDATIONS, drillBest, challengeBest);
    }

    const weaknesses = _detectWeaknesses(this.profiler, store);
    if (weaknesses.length === 0) {
      // Enough data but no clear weakness → suggest general improvement path
      return this._finalize(FALLBACK_RECOMMENDATIONS, drillBest, challengeBest);
    }

    // Flatten candidates from weaknesses, preserving priority
    const candidates = [];
    for (const w of weaknesses) {
      const list = WEAKNESS_MAP[w.key];
      if (!list) continue;
      for (const c of list) {
        candidates.push({ ...c, priority: Math.max(c.priority, w.priority) });
      }
    }

    // Sort by priority desc, then prefer drills slightly (stable tie-break)
    candidates.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.type === 'drill' ? -1 : 1;
    });

    // Deduplicate by id, keeping highest-priority occurrence
    const seen = new Set();
    const deduped = [];
    for (const c of candidates) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      deduped.push(c);
    }

    // If fewer than 3, append fallbacks (excluding already-present ids)
    if (deduped.length < 3) {
      for (const f of FALLBACK_RECOMMENDATIONS) {
        if (seen.has(f.id)) continue;
        deduped.push({ ...f });
        seen.add(f.id);
        if (deduped.length >= 3) break;
      }
    }

    return this._finalize(deduped.slice(0, 3), drillBest, challengeBest);
  }

  _finalize(list, drillBest, challengeBest) {
    return list.map((item) => {
      const copy = { ...item };
      _fillMeta(copy);
      copy.unlocked = _checkUnlocked(copy, drillBest, challengeBest);
      return copy;
    });
  }
}
