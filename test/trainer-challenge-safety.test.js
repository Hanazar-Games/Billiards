/**
 * Trainer & Challenge Data Safety Audit Tests
 *
 * Covers:
 *   - localStorage corruption / old schema fallback
 *   - NaN / negative / out-of-range star values
 *   - Non-object entries (string, number, array)
 *   - UI repeat() crash prevention on bad star counts
 *   - Unknown drillId / challengeId graceful handling
 *   - ChallengeData null-guard on challenge lookups
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';

// Minimal DOM mock for Node environment (panels may import DOM-touching modules)
if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    documentElement: { classList: { toggle() {}, contains() { return false; } }, style: { setProperty() {} } },
    createElement: (tag) => ({
      tagName: tag, style: {}, className: '', textContent: '', innerHTML: '',
      parentNode: null, children: [], dataset: {},
      appendChild(c) { this.children.push(c); return c; },
      removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; },
      addEventListener() {}, removeEventListener() {},
      querySelectorAll: () => [], querySelector: () => null,
      setAttribute() {}, getAttribute() { return null; },
    }),
    body: { appendChild() {}, removeChild() {} },
    head: { appendChild() {}, removeChild() {} },
    addEventListener() {}, removeEventListener() {},
    getElementById: () => null,
    querySelectorAll: () => [], querySelector: () => null,
  };
  globalThis.window = {
    addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
    innerWidth: 1920, innerHeight: 1080,
  };
}

// Mock localStorage
const storage = new Map();
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = {
    getItem(k) { return storage.has(k) ? storage.get(k) : null; },
    setItem(k, v) { storage.set(k, String(v)); },
    removeItem(k) { storage.delete(k); },
    clear() { storage.clear(); },
  };
}

function clearStorage() {
  storage.clear();
}

// ── DrillManager ───────────────────────────────────────────────────────────

describe('DrillManager data safety', () => {
  test('_sanitizeEntry clamps stars to [0,3] and rejects NaN', async () => {
    const { DrillManager } = await import('../src/trainer/DrillManager.js');
    assert.deepStrictEqual(DrillManager._sanitizeEntry({ stars: 5 }), { stars: 3, attempts: 0, completions: 0, bestPowerError: null, bestPowerErrorStars: 0, lastPlayed: null });
    assert.deepStrictEqual(DrillManager._sanitizeEntry({ stars: -2 }), { stars: 0, attempts: 0, completions: 0, bestPowerError: null, bestPowerErrorStars: 0, lastPlayed: null });
    assert.deepStrictEqual(DrillManager._sanitizeEntry({ stars: NaN }), { stars: 0, attempts: 0, completions: 0, bestPowerError: null, bestPowerErrorStars: 0, lastPlayed: null });
    assert.deepStrictEqual(DrillManager._sanitizeEntry({ stars: 2.7 }), { stars: 2, attempts: 0, completions: 0, bestPowerError: null, bestPowerErrorStars: 0, lastPlayed: null });
  });

  test('_sanitizeEntry rejects non-object entries', async () => {
    const { DrillManager } = await import('../src/trainer/DrillManager.js');
    assert.deepStrictEqual(DrillManager._sanitizeEntry(null), { stars: 0, attempts: 0, completions: 0, bestPowerError: null, bestPowerErrorStars: 0, lastPlayed: null });
    assert.deepStrictEqual(DrillManager._sanitizeEntry('string'), { stars: 0, attempts: 0, completions: 0, bestPowerError: null, bestPowerErrorStars: 0, lastPlayed: null });
    assert.deepStrictEqual(DrillManager._sanitizeEntry(42), { stars: 0, attempts: 0, completions: 0, bestPowerError: null, bestPowerErrorStars: 0, lastPlayed: null });
    assert.deepStrictEqual(DrillManager._sanitizeEntry([1, 2, 3]), { stars: 0, attempts: 0, completions: 0, bestPowerError: null, bestPowerErrorStars: 0, lastPlayed: null });
  });

  test('_sanitizeEntry clamps attempts/completions to non-negative', async () => {
    const { DrillManager } = await import('../src/trainer/DrillManager.js');
    const r = DrillManager._sanitizeEntry({ attempts: -5, completions: -1 });
    assert.strictEqual(r.attempts, 0);
    assert.strictEqual(r.completions, 0);
  });

  test('_sanitizeEntry filters negative bestPowerError', async () => {
    const { DrillManager } = await import('../src/trainer/DrillManager.js');
    assert.strictEqual(DrillManager._sanitizeEntry({ bestPowerError: -1 }).bestPowerError, null);
    assert.strictEqual(DrillManager._sanitizeEntry({ bestPowerError: 2.5 }).bestPowerError, 2.5);
    assert.strictEqual(DrillManager._sanitizeEntry({ bestPowerError: NaN }).bestPowerError, null);
  });

  test('_loadBest survives corrupted localStorage', async () => {
    clearStorage();
    localStorage.setItem('billiards_trainer_v1', 'not-json');
    const { DrillManager } = await import('../src/trainer/DrillManager.js');
    const dm = new DrillManager('straight_shot');
    assert.strictEqual(dm.best.stars, 0);
    dm.best = null; // avoid referencing stale import cache
  });

  test('_loadBest sanitizes old string entry', async () => {
    clearStorage();
    localStorage.setItem('billiards_trainer_v1', JSON.stringify({ straight_shot: 'bad-data' }));
    const { DrillManager } = await import('../src/trainer/DrillManager.js');
    const dm = new DrillManager('straight_shot');
    assert.strictEqual(dm.best.stars, 0);
    assert.strictEqual(dm.best.attempts, 0);
  });

  test('_saveBest does not write NaN stars', async () => {
    clearStorage();
    const { DrillManager } = await import('../src/trainer/DrillManager.js');
    const dm = new DrillManager('straight_shot');
    dm.start();
    dm.completed = true;
    dm.stars = 2;
    dm._saveBest({ stars: NaN, powerError: 3.0 });
    const all = JSON.parse(localStorage.getItem('billiards_trainer_v1'));
    const entry = all['straight_shot'];
    assert.strictEqual(Number.isFinite(entry.stars), true);
    assert.strictEqual(entry.stars >= 0, true);
  });

  test('getAllBest returns {} when storage holds an array', async () => {
    clearStorage();
    localStorage.setItem('billiards_trainer_v1', JSON.stringify([1, 2, 3]));
    const { DrillManager } = await import('../src/trainer/DrillManager.js');
    const all = DrillManager.getAllBest();
    assert.deepStrictEqual(all, {});
  });

  test('getProgress returns null for unknown drillId', async () => {
    const { DrillManager } = await import('../src/trainer/DrillManager.js');
    assert.strictEqual(DrillManager.getProgress('nonexistent'), null);
  });

  test('getProgress returns clamped data for corrupted entry', async () => {
    clearStorage();
    localStorage.setItem('billiards_trainer_v1', JSON.stringify({ straight_shot: { stars: -1, attempts: NaN, completions: 99.9 } }));
    const { DrillManager } = await import('../src/trainer/DrillManager.js');
    const p = DrillManager.getProgress('straight_shot');
    assert.strictEqual(p.stars, 0);
    assert.strictEqual(p.attempts, 0);
    assert.strictEqual(p.completions, 99);
  });

  test('isUnlocked returns false for unknown drillId', async () => {
    const { DrillManager } = await import('../src/trainer/DrillManager.js');
    assert.strictEqual(DrillManager.isUnlocked('nonexistent'), false);
  });

  test('getUnlockRequirement returns empty string for unknown drillId', async () => {
    const { DrillManager } = await import('../src/trainer/DrillManager.js');
    assert.strictEqual(DrillManager.getUnlockRequirement('nonexistent'), '');
  });
});

// ── ChallengeManager ───────────────────────────────────────────────────────

describe('ChallengeManager data safety', () => {
  test('_sanitizeEntry clamps stars to [0,3]', async () => {
    const { ChallengeManager } = await import('../src/challenges/ChallengeManager.js');
    assert.deepStrictEqual(ChallengeManager._sanitizeEntry({ stars: 10 }), { stars: 3, attempts: 0, completions: 0, prevStars: 0 });
    assert.deepStrictEqual(ChallengeManager._sanitizeEntry({ stars: -3 }), { stars: 0, attempts: 0, completions: 0, prevStars: 0 });
    assert.deepStrictEqual(ChallengeManager._sanitizeEntry({ stars: NaN }), { stars: 0, attempts: 0, completions: 0, prevStars: 0 });
  });

  test('_sanitizeEntry rejects non-object entries', async () => {
    const { ChallengeManager } = await import('../src/challenges/ChallengeManager.js');
    assert.deepStrictEqual(ChallengeManager._sanitizeEntry(null), { stars: 0, attempts: 0, completions: 0, prevStars: 0 });
    assert.deepStrictEqual(ChallengeManager._sanitizeEntry(123), { stars: 0, attempts: 0, completions: 0, prevStars: 0 });
    assert.deepStrictEqual(ChallengeManager._sanitizeEntry([1, 2]), { stars: 0, attempts: 0, completions: 0, prevStars: 0 });
  });

  test('_saveBest does not propagate NaN stars', async () => {
    clearStorage();
    const { ChallengeManager } = await import('../src/challenges/ChallengeManager.js');
    const cm = new ChallengeManager('soft_touch');
    cm.start();
    cm.completed = true;
    cm.stars = 2;
    cm._saveBest(NaN, false);
    const all = JSON.parse(localStorage.getItem('billiards_challenges_v1'));
    const entry = all['soft_touch'];
    assert.strictEqual(Number.isNaN(entry.stars), false);
    assert.strictEqual(entry.stars >= 0, true);
  });

  test('getResultStats survives NaN in best', async () => {
    clearStorage();
    const { ChallengeManager } = await import('../src/challenges/ChallengeManager.js');
    const cm = new ChallengeManager('soft_touch');
    cm.best = { stars: NaN, prevStars: NaN };
    const stats = cm.getResultStats();
    assert.strictEqual(Number.isNaN(stats.bestStars), false);
    assert.strictEqual(stats.isNewRecord, false);
  });

  test('getAllBest returns {} when storage holds an array', async () => {
    clearStorage();
    localStorage.setItem('billiards_challenges_v1', JSON.stringify(['bad']));
    const { ChallengeManager } = await import('../src/challenges/ChallengeManager.js');
    assert.deepStrictEqual(ChallengeManager.getAllBest(), {});
  });

  test('constructor throws for unknown challengeId', async () => {
    const { ChallengeManager } = await import('../src/challenges/ChallengeManager.js');
    assert.throws(() => new ChallengeManager('nonexistent'), /Unknown challenge/);
  });
});

// ── ChallengeData ──────────────────────────────────────────────────────────

describe('ChallengeData lookup safety', () => {
  test('isUnlocked returns false for null challenge', async () => {
    const { isUnlocked } = await import('../src/challenges/ChallengeData.js');
    assert.strictEqual(isUnlocked(null, {}), false);
    assert.strictEqual(isUnlocked(undefined, {}), false);
    assert.strictEqual(isUnlocked('string', {}), false);
  });

  test('getUnlockRequirement returns empty string for null challenge', async () => {
    const { getUnlockRequirement } = await import('../src/challenges/ChallengeData.js');
    assert.strictEqual(getUnlockRequirement(null), '');
    assert.strictEqual(getUnlockRequirement(undefined), '');
  });

  test('getStarConditions returns empty string for null challenge', async () => {
    const { getStarConditions } = await import('../src/challenges/ChallengeData.js');
    assert.strictEqual(getStarConditions(null), '');
    assert.strictEqual(getStarConditions({}), '');
  });

  test('getProgress clamps negative/NaN stars', async () => {
    const { getProgress } = await import('../src/challenges/ChallengeData.js');
    const p = getProgress({ soft_touch: { stars: -5 } });
    assert.strictEqual(p.earned, 0);
    const p2 = getProgress({ soft_touch: { stars: NaN } });
    assert.strictEqual(p2.earned, 0);
    const p3 = getProgress({ soft_touch: { stars: 2.9 } });
    assert.strictEqual(p3.earned, 2);
  });

  test('getProgress survives non-object bestData', async () => {
    const { getProgress, CHALLENGES } = await import('../src/challenges/ChallengeData.js');
    const pNull = getProgress(null);
    assert.strictEqual(pNull.earned, 0);
    assert.strictEqual(pNull.max, CHALLENGES.length * 3);
    assert.strictEqual(pNull.percent, 0);
    assert.strictEqual(pNull.completed, 0);
    assert.strictEqual(typeof pNull.total, 'number');
    const pStr = getProgress('string');
    assert.strictEqual(pStr.earned, 0);
    assert.strictEqual(pStr.max, CHALLENGES.length * 3);
    assert.strictEqual(pStr.percent, 0);
    assert.strictEqual(pStr.completed, 0);
    assert.strictEqual(typeof pStr.total, 'number');
  });
});

// ── UI repeat() safety ─────────────────────────────────────────────────────

describe('UI star-repeat safety', () => {
  test('ChallengeResult.show does not crash on NaN stars', async () => {
    if (typeof globalThis.document === 'undefined') {
      // Re-use mock from top
    }
    const { ChallengeResult } = await import('../src/challenges/ChallengeResult.js');
    const cr = new ChallengeResult(() => {}, () => {});
    cr.show('Test', true, NaN, { bestStars: NaN });
    // If we reach here without RangeError, the test passes
    assert.strictEqual(cr._shown, true);
    cr.destroy();
  });

  test('TrainerResult.show does not crash on NaN stars', async () => {
    const { TrainerResult } = await import('../src/trainer/TrainerResult.js');
    const tr = new TrainerResult(() => {}, () => {});
    tr.show('Test', true, NaN, {});
    assert.strictEqual(tr._shown, true);
    tr.destroy();
  });
});
