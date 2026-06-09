/**
 * Highlight system tests — data detection, storage lifecycle, deduplication.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  detectHighlight,
  getHighlightTitle,
  HIGHLIGHT_CATEGORIES,
} from '../src/highlight/HighlightData.js';
import { HighlightStore } from '../src/highlight/HighlightStore.js';

// Shim localStorage for Node test environment
const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => storage.get(k) ?? null,
  setItem: (k, v) => storage.set(k, v),
  removeItem: (k) => storage.delete(k),
};

describe('HighlightData.detectHighlight', () => {
  it('returns null for unremarkable shots', () => {
    const meta = {
      maxPower: 30, pocketedIds: [], collisionCount: 0, cushionCount: 0,
      spinUsed: false, firstHitDistance: 40, isBank: false, score: 0,
    };
    expect(detectHighlight(meta)).toBeNull();
  });

  it('detects a power shot', () => {
    const meta = {
      maxPower: 85, pocketedIds: [1], collisionCount: 0, cushionCount: 0,
      spinUsed: false, firstHitDistance: 50, isBank: false, score: 0,
    };
    const h = detectHighlight(meta);
    expect(h).not.toBeNull();
    expect(h.tags).toContain(HIGHLIGHT_CATEGORIES.POWER_SHOT);
    expect(h.starRating).toBeGreaterThanOrEqual(1);
  });

  it('detects a bank shot with higher stars', () => {
    const meta = {
      maxPower: 50, pocketedIds: [2], collisionCount: 1, cushionCount: 2,
      spinUsed: false, firstHitDistance: 60, isBank: true, score: 10,
    };
    const h = detectHighlight(meta);
    expect(h).not.toBeNull();
    expect(h.tags).toContain(HIGHLIGHT_CATEGORIES.BANK_SHOT);
    expect(h.starRating).toBeGreaterThanOrEqual(2);
  });

  it('detects multi-pocket shots', () => {
    const meta = {
      maxPower: 55, pocketedIds: [1, 3, 5], collisionCount: 2, cushionCount: 0,
      spinUsed: false, firstHitDistance: 80, isBank: false, score: 20,
    };
    const h = detectHighlight(meta);
    expect(h).not.toBeNull();
    expect(h.tags).toContain(HIGHLIGHT_CATEGORIES.MULTI_POCKET);
    expect(h.starRating).toBe(3);
  });

  it('detects clutch win context', () => {
    const meta = {
      maxPower: 45, pocketedIds: [8], collisionCount: 0, cushionCount: 0,
      spinUsed: false, firstHitDistance: 70, isBank: false, score: 5,
    };
    const h = detectHighlight(meta, { isGameWinner: true });
    expect(h).not.toBeNull();
    expect(h.tags).toContain(HIGHLIGHT_CATEGORIES.CLUTCH_WIN);
    expect(h.starRating).toBeGreaterThanOrEqual(2);
  });

  it('detects break run via consecutive pockets context', () => {
    const meta = {
      maxPower: 40, pocketedIds: [1], collisionCount: 0, cushionCount: 0,
      spinUsed: false, firstHitDistance: 55, isBank: false, score: 0,
    };
    const h = detectHighlight(meta, { consecutivePockets: 4 });
    expect(h).not.toBeNull();
    expect(h.tags).toContain(HIGHLIGHT_CATEGORIES.BREAK_RUN);
    expect(h.starRating).toBe(2);
  });

  it('caps star rating at 3', () => {
    const meta = {
      maxPower: 95, pocketedIds: [1, 2, 3, 4, 5], collisionCount: 8,
      cushionCount: 4, spinUsed: true, firstHitDistance: 220, isBank: true,
      score: 90,
    };
    const h = detectHighlight(meta, { isGameWinner: true, consecutivePockets: 6 });
    expect(h.starRating).toBe(3);
  });

  it('detects thin cut from score + low collision heuristic', () => {
    const meta = {
      maxPower: 45, pocketedIds: [3], collisionCount: 0, cushionCount: 0,
      spinUsed: false, firstHitDistance: 80, isBank: false, score: 72,
    };
    const h = detectHighlight(meta);
    expect(h).not.toBeNull();
    expect(h.tags).toContain(HIGHLIGHT_CATEGORIES.THIN_CUT);
  });

  it('returns null for shots with NaN metadata', () => {
    expect(detectHighlight(null)).toBeNull();
  });
});

describe('HighlightData.getHighlightTitle', () => {
  it('returns default title for null highlight', () => {
    expect(getHighlightTitle(null, {})).toBe('精彩击球');
  });

  it('uses primary tag for title', () => {
    const h = { tags: [HIGHLIGHT_CATEGORIES.BANK_SHOT] };
    const title = getHighlightTitle(h, {});
    expect(title).toContain('翻袋');
  });
});

describe('HighlightStore', () => {
  let store;

  beforeEach(() => {
    storage.clear();
    store = new HighlightStore();
  });

  it('saves a remarkable shot', () => {
    const replay = {
      metadata: {
        maxPower: 85, pocketedIds: [1], collisionCount: 0, cushionCount: 0,
        spinUsed: false, firstHitDistance: 50, isBank: false, score: 10,
      },
      frames: [], frameCount: 10, score: 10,
    };
    const entry = store.save(replay, { mode: 'vsai' });
    expect(entry).not.toBeNull();
    expect(entry.starRating).toBeGreaterThanOrEqual(1);
    expect(store.getCount()).toBe(1);
  });

  it('does not save unremarkable shots', () => {
    const replay = {
      metadata: {
        maxPower: 20, pocketedIds: [], collisionCount: 0, cushionCount: 0,
        spinUsed: false, firstHitDistance: 30, isBank: false, score: 0,
      },
      frames: [], frameCount: 10, score: 0,
    };
    expect(store.save(replay)).toBeNull();
    expect(store.getCount()).toBe(0);
  });

  it('deduplicates rapid identical saves', () => {
    const replay = {
      metadata: {
        maxPower: 85, pocketedIds: [1], collisionCount: 0, cushionCount: 0,
        spinUsed: false, firstHitDistance: 50, isBank: false, score: 10,
      },
      frames: [], frameCount: 10, score: 10,
    };
    store.save(replay, { mode: 'vsai' });
    store.save(replay, { mode: 'vsai' });
    expect(store.getCount()).toBe(1);
  });

  it('allows different tags through dedup window', () => {
    const r1 = {
      metadata: {
        maxPower: 85, pocketedIds: [1], collisionCount: 0, cushionCount: 0,
        spinUsed: false, firstHitDistance: 50, isBank: false, score: 10,
      },
      frames: [], frameCount: 10, score: 10,
    };
    const r2 = {
      metadata: {
        maxPower: 40, pocketedIds: [1], collisionCount: 0, cushionCount: 0,
        spinUsed: false, firstHitDistance: 50, isBank: true, score: 10,
      },
      frames: [], frameCount: 10, score: 10,
    };
    store.save(r1);
    store.save(r2);
    expect(store.getCount()).toBe(2);
  });

  it('deletes by id', () => {
    const replay = {
      metadata: {
        maxPower: 85, pocketedIds: [1], collisionCount: 0, cushionCount: 0,
        spinUsed: false, firstHitDistance: 50, isBank: false, score: 10,
      },
      frames: [], frameCount: 10, score: 10,
    };
    const entry = store.save(replay);
    expect(store.delete(entry.id)).toBe(true);
    expect(store.getCount()).toBe(0);
    expect(store.delete('nonexistent')).toBe(false);
  });

  it('clears all highlights', () => {
    const replay = {
      metadata: {
        maxPower: 85, pocketedIds: [1], collisionCount: 0, cushionCount: 0,
        spinUsed: false, firstHitDistance: 50, isBank: false, score: 10,
      },
      frames: [], frameCount: 10, score: 10,
    };
    store.save(replay);
    store.save(replay); // second deduped
    store.clear();
    expect(store.getCount()).toBe(0);
  });

  it('returns stats correctly', () => {
    const replay = {
      metadata: {
        maxPower: 85, pocketedIds: [1], collisionCount: 0, cushionCount: 0,
        spinUsed: false, firstHitDistance: 50, isBank: false, score: 10,
      },
      frames: [], frameCount: 10, score: 10,
    };
    store.save(replay);
    const stats = store.getStats();
    expect(stats.total).toBe(1);
    expect(Number(stats.avgStars)).toBeGreaterThanOrEqual(1);
  });

  it('respects max limit with FIFO eviction', () => {
    for (let i = 0; i < 55; i++) {
      const replay = {
        metadata: {
          maxPower: 85 + i, pocketedIds: [1], collisionCount: i, cushionCount: 0,
          spinUsed: false, firstHitDistance: 50 + i, isBank: i % 2 === 0, score: 10 + i,
        },
        frames: [], frameCount: 10, score: 10 + i,
      };
      // Sleep 1ms to avoid dedup
      store.save(replay);
    }
    expect(store.getCount()).toBe(50);
  });

  it('returns newest first from getAll', () => {
    const r1 = {
      metadata: { maxPower: 85, pocketedIds: [1], collisionCount: 0, cushionCount: 0,
        spinUsed: false, firstHitDistance: 50, isBank: false, score: 10 },
      frames: [], frameCount: 10, score: 10,
    };
    const r2 = {
      metadata: { maxPower: 90, pocketedIds: [1], collisionCount: 1, cushionCount: 0,
        spinUsed: false, firstHitDistance: 60, isBank: true, score: 15 },
      frames: [], frameCount: 10, score: 15,
    };
    const e1 = store.save(r1);
    const e2 = store.save(r2);
    const all = store.getAll();
    expect(all[0].id).toBe(e2.id);
    expect(all[1].id).toBe(e1.id);
  });
});
