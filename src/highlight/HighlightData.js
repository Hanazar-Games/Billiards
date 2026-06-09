/**
 * HighlightData — Shot highlight detection engine & type definitions.
 *
 * Automatically identifies memorable shots from replay metadata and assigns
 * a star rating (1–3) and category tags. Pure data logic, zero DOM.
 */

export const HIGHLIGHT_CATEGORIES = {
  LONG_SHOT: 'longShot',
  THIN_CUT: 'thinCut',
  BANK_SHOT: 'bankShot',
  POWER_SHOT: 'powerShot',
  SPIN_SHOT: 'spinShot',
  MULTI_POCKET: 'multiPocket',
  CLUTCH_WIN: 'clutchWin',
  BREAK_RUN: 'breakRun',
  HIGH_COLLISION: 'highCollision',
  PERFECT_LEAVE: 'perfectLeave',
};

export const CATEGORY_META = {
  [HIGHLIGHT_CATEGORIES.LONG_SHOT]: { icon: '📏', label: '长台', color: '#4ecdc4' },
  [HIGHLIGHT_CATEGORIES.THIN_CUT]: { icon: '🔪', label: '薄球', color: '#ff6b6b' },
  [HIGHLIGHT_CATEGORIES.BANK_SHOT]: { icon: '🏦', label: '翻袋', color: '#ffd93d' },
  [HIGHLIGHT_CATEGORIES.POWER_SHOT]: { icon: '💥', label: '重炮', color: '#ff8a5c' },
  [HIGHLIGHT_CATEGORIES.SPIN_SHOT]: { icon: '🌀', label: '旋转', color: '#a78bfa' },
  [HIGHLIGHT_CATEGORIES.MULTI_POCKET]: { icon: '🔢', label: '多球', color: '#6bcb77' },
  [HIGHLIGHT_CATEGORIES.CLUTCH_WIN]: { icon: '🏆', label: '决胜', color: '#d8b15f' },
  [HIGHLIGHT_CATEGORIES.BREAK_RUN]: { icon: '⚡', label: '连杆', color: '#f9ca24' },
  [HIGHLIGHT_CATEGORIES.HIGH_COLLISION]: { icon: '💢', label: '碰撞', color: '#ff9ff3' },
  [HIGHLIGHT_CATEGORIES.PERFECT_LEAVE]: { icon: '✨', label: '走位', color: '#54a0ff' },
};

/**
 * Analyze a single shot and return highlight metadata if it is memorable.
 * @param {Object} meta — from ShotRecorder (power, spin, pocketedIds, collisionCount, cushionCount, isBreak, firstHitDistance, isBank, score)
 * @param {Object} context — { mode, isGameWinner, isBreakShot, consecutivePockets }
 * @returns {Object|null} highlight descriptor or null if unremarkable
 */
export function detectHighlight(meta, context = {}) {
  if (!meta) return null;

  const tags = [];
  let starRating = 0;
  const reasons = [];

  const power = Number.isFinite(meta.maxPower) ? meta.maxPower : 0;
  const pocketed = Array.isArray(meta.pocketedIds) ? meta.pocketedIds.filter(id => id !== 0) : [];
  const collisions = Number.isFinite(meta.collisionCount) ? meta.collisionCount : 0;
  const cushions = Number.isFinite(meta.cushionCount) ? meta.cushionCount : 0;
  const spinUsed = meta.spinUsed || false;
  const distance = Number.isFinite(meta.firstHitDistance) ? meta.firstHitDistance : 0;
  const isBank = meta.isBank || false;
  const score = Number.isFinite(meta.score) ? meta.score : 0;

  // ── Category detection ──

  if (distance > 160) {
    tags.push(HIGHLIGHT_CATEGORIES.LONG_SHOT);
    reasons.push(`长台进攻 ${Math.round(distance)}cm`);
    starRating = Math.max(starRating, distance > 200 ? 2 : 1);
  }

  if (isBank) {
    tags.push(HIGHLIGHT_CATEGORIES.BANK_SHOT);
    reasons.push('翻袋进球');
    starRating = Math.max(starRating, 2);
  }

  if (power > 75) {
    tags.push(HIGHLIGHT_CATEGORIES.POWER_SHOT);
    reasons.push(`大力击球 ${Math.round(power)}%`);
    starRating = Math.max(starRating, power > 90 ? 2 : 1);
  }

  if (spinUsed) {
    tags.push(HIGHLIGHT_CATEGORIES.SPIN_SHOT);
    reasons.push('旋转进球');
    starRating = Math.max(starRating, 1);
  }

  if (pocketed.length >= 2) {
    tags.push(HIGHLIGHT_CATEGORIES.MULTI_POCKET);
    reasons.push(`单杆 ${pocketed.length} 球`);
    starRating = Math.max(starRating, pocketed.length >= 3 ? 3 : 2);
  }

  if (collisions >= 4) {
    tags.push(HIGHLIGHT_CATEGORIES.HIGH_COLLISION);
    reasons.push(`${collisions} 次碰撞`);
    starRating = Math.max(starRating, collisions >= 6 ? 2 : 1);
  }

  if (context.isGameWinner) {
    tags.push(HIGHLIGHT_CATEGORIES.CLUTCH_WIN);
    reasons.push('制胜球');
    starRating = Math.max(starRating, 2);
  }

  if (context.consecutivePockets && context.consecutivePockets >= 3) {
    tags.push(HIGHLIGHT_CATEGORIES.BREAK_RUN);
    reasons.push(`${context.consecutivePockets} 连杆`);
    starRating = Math.max(starRating, context.consecutivePockets >= 5 ? 3 : 2);
  }

  if (score >= 70) {
    starRating = Math.max(starRating, score >= 85 ? 3 : 2);
    if (!tags.includes(HIGHLIGHT_CATEGORIES.PERFECT_LEAVE)) {
      tags.push(HIGHLIGHT_CATEGORIES.PERFECT_LEAVE);
    }
    reasons.push(`评分 ${Math.round(score)}`);
  }

  // Thin cut heuristic: high score + low collision + moderate distance
  if (score >= 60 && collisions <= 1 && distance < 100 && pocketed.length === 1 && !isBank) {
    tags.push(HIGHLIGHT_CATEGORIES.THIN_CUT);
    reasons.push('精准薄球');
    starRating = Math.max(starRating, 2);
  }

  // Minimum threshold: must have at least 1 tag and 1 star
  if (tags.length === 0 || starRating < 1) return null;

  // Cap at 3 stars
  starRating = Math.min(3, starRating);

  return {
    tags,
    starRating,
    reasons,
    summary: reasons.join(' · '),
  };
}

/**
 * Generate a human-readable title for a highlight.
 */
export function getHighlightTitle(highlight, meta) {
  if (!highlight) return '精彩击球';
  const primary = highlight.tags[0];
  const cat = CATEGORY_META[primary];
  const pocketed = Array.isArray(meta?.pocketedIds) ? meta.pocketedIds.filter(id => id !== 0).length : 0;
  const base = cat ? `${cat.icon} ${cat.label}击球` : '精彩击球';
  return pocketed > 1 ? `${base} · ${pocketed}球` : base;
}
