/**
 * ChallengeData — All skill-based challenges.
 *
 * Each challenge defines constraints and win conditions.
 * Stars are awarded based on performance (1-3).
 *
 * v2 adds: daily/featured selection, unlock chains, star thresholds,
 * and 6 new challenges covering combo, bank, position, clearance.
 */

export const CHALLENGE_TYPE = {
  MULTI_POCKET: 'multi_pocket',
  CUSHION_SHOT: 'cushion_shot',
  POWER_LIMIT: 'power_limit',
  TIME_ATTACK: 'time_attack',
  LONG_SHOT: 'long_shot',
  SPIN_REQUIRED: 'spin_required',
  BREAK_SHOT: 'break_shot',
  NO_FOUL: 'no_foul',
  // v2 new types
  COMBO_SHOT: 'combo_shot',
  BANK_SHOT: 'bank_shot',
  POSITION_PLAY: 'position_play',
  CONSECUTIVE_POCKETS: 'consecutive_pockets',
  FLAWLESS_CLEAR: 'flawless_clear',
};

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function starDesc(thresholds, unit = '') {
  // thresholds: [1★, 2★, 3★] — ascending difficulty
  return `★ ${thresholds[0]}${unit}　★★ ${thresholds[1]}${unit}　★★★ ${thresholds[2]}${unit}`;
}

function powerDesc(maxPower, thresholds) {
  return `★ ≤${thresholds[0]}%　★★ ≤${thresholds[1]}%　★★★ ≤${thresholds[2]}%　(上限 ${maxPower}%)`;
}

function distDesc(minDist, thresholds) {
  return `★ ≥${thresholds[0]}cm　★★ ≥${thresholds[1]}cm　★★★ ≥${thresholds[2]}cm`;
}

function timeDesc(limit, thresholds) {
  return `★ ≤${thresholds[0]}s　★★ ≤${thresholds[1]}s　★★★ ≤${thresholds[2]}s　(上限 ${limit}s)`;
}

// ------------------------------------------------------------------
// Challenges
// ------------------------------------------------------------------

export const CHALLENGES = [
  // ── BASIC (difficulty 1-2) ──
  {
    id: 'soft_touch',
    name: '蜻蜓点水',
    desc: '使用 ≤15% 力度进球',
    type: CHALLENGE_TYPE.POWER_LIMIT,
    params: { maxPower: 15, starThresholds: [15, 10, 5] },
    difficulty: 2,
    gameMode: 'freeplay',
  },
  {
    id: 'long_shot',
    name: '长台神射',
    desc: '从台面另一端 (>180cm) 进球',
    type: CHALLENGE_TYPE.LONG_SHOT,
    params: { minDistance: 180, starThresholds: [180, 210, 240] },
    difficulty: 2,
    gameMode: 'freeplay',
  },
  {
    id: 'bank_easy',
    name: '翻袋入门',
    desc: '通过碰库反弹后进袋',
    type: CHALLENGE_TYPE.BANK_SHOT,
    params: { minBanks: 1, starThresholds: [1, 1, 2] },
    difficulty: 2,
    gameMode: 'freeplay',
  },

  // ── INTERMEDIATE (difficulty 3-4) ──
  {
    id: 'multi_3',
    name: '一杆双响',
    desc: '单次击球进袋 3 个球',
    type: CHALLENGE_TYPE.MULTI_POCKET,
    params: { minPockets: 3, starThresholds: [3, 4, 5] },
    difficulty: 3,
    gameMode: 'freeplay',
  },
  {
    id: 'combo_king',
    name: '组合王者',
    desc: '通过组合球进球（非首击目标球）',
    type: CHALLENGE_TYPE.COMBO_SHOT,
    params: { minCombos: 1, starThresholds: [1, 2, 3] },
    difficulty: 3,
    gameMode: 'freeplay',
  },
  {
    id: 'position_pro',
    name: '走位专家',
    desc: '进球后将母球停在中心区域',
    type: CHALLENGE_TYPE.POSITION_PLAY,
    params: { zoneRadius: 35, starThresholds: [35, 22, 12] },
    difficulty: 3,
    gameMode: 'freeplay',
  },
  {
    id: 'cushion_master',
    name: '库边舞者',
    desc: '单次击球中球碰库边 4+ 次后进袋',
    type: CHALLENGE_TYPE.CUSHION_SHOT,
    params: { minCushions: 4, starThresholds: [4, 5, 6] },
    difficulty: 4,
    gameMode: 'freeplay',
  },
  {
    id: 'sniper',
    name: '狙击射手',
    desc: '从超远距离 (>200cm) 进球',
    type: CHALLENGE_TYPE.LONG_SHOT,
    params: { minDistance: 200, starThresholds: [200, 230, 260] },
    difficulty: 4,
    gameMode: 'freeplay',
  },
  {
    id: 'streak_3',
    name: '三连击',
    desc: '连续 3 杆进球（无犯规）',
    type: CHALLENGE_TYPE.CONSECUTIVE_POCKETS,
    params: { count: 3, starThresholds: [3, 4, 5] },
    difficulty: 4,
    gameMode: 'freeplay',
  },
  {
    id: 'spin_win',
    name: '旋转大师',
    desc: '必须使用旋转进球并获胜',
    type: CHALLENGE_TYPE.SPIN_REQUIRED,
    params: { starThresholds: [1, 2, 3] },
    difficulty: 4,
    gameMode: 'local2p',
  },

  // ── ADVANCED (difficulty 5) ──
  {
    id: 'feather_touch',
    name: '羽毛轻抚',
    desc: '使用 ≤10% 力度进球',
    type: CHALLENGE_TYPE.POWER_LIMIT,
    params: { maxPower: 10, starThresholds: [10, 7, 4] },
    difficulty: 5,
    gameMode: 'freeplay',
  },
  {
    id: 'speed_demon',
    name: '速战速决',
    desc: '60 秒内完成一局对战',
    type: CHALLENGE_TYPE.TIME_ATTACK,
    params: { timeLimit: 60, starThresholds: [60, 45, 30] },
    difficulty: 5,
    gameMode: 'local2p',
  },
  {
    id: 'perfect_break',
    name: '完美开球',
    desc: '开球进袋 4+ 球',
    type: CHALLENGE_TYPE.BREAK_SHOT,
    params: { minPockets: 4, starThresholds: [4, 5, 6] },
    difficulty: 5,
    gameMode: 'local2p',
  },
  {
    id: 'flawless_clear',
    name: '一杆清台',
    desc: '清光所有球且零犯规',
    type: CHALLENGE_TYPE.FLAWLESS_CLEAR,
    params: { maxShots: 20, starThresholds: [20, 14, 8] },
    difficulty: 5,
    gameMode: 'freeplay',
  },
  {
    id: 'no_foul_win',
    name: '完美比赛',
    desc: '整局无犯规获胜',
    type: CHALLENGE_TYPE.NO_FOUL,
    params: { starThresholds: [1, 1, 1] },
    difficulty: 5,
    gameMode: 'local2p',
  },
];

// ------------------------------------------------------------------
// Lookups
// ------------------------------------------------------------------

export function getChallenge(id) {
  return CHALLENGES.find((c) => c.id === id);
}

export function getChallengesByDifficulty(difficulty) {
  if (!difficulty) return CHALLENGES;
  return CHALLENGES.filter((c) => c.difficulty === difficulty);
}

// ------------------------------------------------------------------
// Star condition descriptions
// ------------------------------------------------------------------

export function getStarConditions(challenge) {
  if (!challenge || !challenge.params) return '';
  const { type, params } = challenge;
  const t = Array.isArray(params.starThresholds) ? params.starThresholds : [1, 2, 3];
  switch (type) {
    case CHALLENGE_TYPE.POWER_LIMIT:
      return powerDesc(params.maxPower, t);
    case CHALLENGE_TYPE.LONG_SHOT:
      return distDesc(params.minDistance, t);
    case CHALLENGE_TYPE.TIME_ATTACK:
      return timeDesc(params.timeLimit, t);
    case CHALLENGE_TYPE.CUSHION_SHOT:
      return starDesc(t, ' 次碰库');
    case CHALLENGE_TYPE.MULTI_POCKET:
      return starDesc(t, ' 球进袋');
    case CHALLENGE_TYPE.BREAK_SHOT:
      return starDesc(t, ' 球进袋');
    case CHALLENGE_TYPE.BANK_SHOT:
      return starDesc(t, ' 次碰库反弹');
    case CHALLENGE_TYPE.COMBO_SHOT:
      return starDesc(t, ' 颗组合球');
    case CHALLENGE_TYPE.POSITION_PLAY:
      return `★ ≤${t[0]}cm　★★ ≤${t[1]}cm　★★★ ≤${t[2]}cm　距台面中心`;
    case CHALLENGE_TYPE.CONSECUTIVE_POCKETS:
      return starDesc(t, ' 连击');
    case CHALLENGE_TYPE.FLAWLESS_CLEAR:
      return `★ ≤${t[0]}杆　★★ ≤${t[1]}杆　★★★ ≤${t[2]}杆　清台`;
    case CHALLENGE_TYPE.SPIN_REQUIRED:
      return starDesc(t, ' 次旋转进球');
    case CHALLENGE_TYPE.NO_FOUL:
      return '★★★ 整局无犯规获胜';
    default:
      return '';
  }
}

// ------------------------------------------------------------------
// Unlock logic
// ------------------------------------------------------------------

export function getTotalStars(bestData) {
  bestData = bestData || {};
  let total = 0;
  for (const c of CHALLENGES) {
    total += bestData[c.id]?.stars || 0;
  }
  return total;
}

export function isUnlocked(challenge, bestData) {
  if (!challenge || typeof challenge !== 'object') return false;
  if (challenge.difficulty <= 2) return true;
  const total = getTotalStars(bestData);
  if (challenge.difficulty <= 4) return total >= 3;
  return total >= 8;
}

export function getUnlockRequirement(challenge) {
  if (!challenge || typeof challenge !== 'object') return '';
  if (challenge.difficulty <= 2) return null;
  if (challenge.difficulty <= 4) return '需要获得 3 颗总星级以解锁中级挑战';
  return '需要获得 8 颗总星级以解锁高级挑战';
}

// ------------------------------------------------------------------
// Daily / Featured
// ------------------------------------------------------------------

export function getDailyChallengeId() {
  const d = new Date();
  const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  const idx = seed % CHALLENGES.length;
  return CHALLENGES[idx].id;
}

export function getFeaturedChallengeId(bestData) {
  bestData = bestData || {};
  // Prefer highest-difficulty challenge not yet 3-starred
  const candidates = CHALLENGES.filter((c) => {
    if (!isUnlocked(c, bestData)) return false;
    return (bestData[c.id]?.stars || 0) < 3;
  });
  if (candidates.length === 0) {
    // All done — pick random unlocked
    const unlocked = CHALLENGES.filter((c) => isUnlocked(c, bestData));
    return unlocked[Math.floor(Math.random() * unlocked.length)]?.id || CHALLENGES[0].id;
  }
  candidates.sort((a, b) => b.difficulty - a.difficulty);
  return candidates[0].id;
}

// ------------------------------------------------------------------
// Progress helpers
// ------------------------------------------------------------------

export function getProgress(bestData) {
  bestData = bestData || {};
  let earned = 0;
  let max = 0;
  let completed = 0;
  for (const c of CHALLENGES) {
    const raw = bestData[c.id];
    const s = (raw && typeof raw === 'object' && Number.isFinite(raw.stars))
      ? Math.max(0, Math.min(3, Math.floor(raw.stars)))
      : 0;
    earned += s;
    max += 3;
    if (s >= 1) completed++;
  }
  return { earned, max, percent: max > 0 ? Math.round((earned / max) * 100) : 0, completed, total: CHALLENGES.length };
}

export function getDifficultyLabel(d) {
  const map = { 1: '入门', 2: '简单', 3: '中等', 4: '困难', 5: '大师' };
  return map[d] || '未知';
}
