/**
 * Highlight system tests — data detection, storage lifecycle, deduplication.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
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
    assert.equal(detectHighlight(meta), null);
  });

  it('detects a power shot', () => {
    const meta = {
      maxPower: 85, pocketedIds: [1], collisionCount: 0, cushionCount: 0,
      spinUsed: false, firstHitDistance: 50, isBank: false, score: 0,
    };
    const h = detectHighlight(meta);
    assert.notEqual(h, null);
    assert.ok(h.tags.includes(HIGHLIGHT_CATEGORIES.POWER_SHOT));
    assert.ok(h.starRating >= 1);
  });

  it('detects a bank shot with higher stars', () => {
    const meta = {
      maxPower: 50, pocketedIds: [2], collisionCount: 1, cushionCount: 2,
      spinUsed: false, firstHitDistance: 60, isBank: true, score: 10,
    };
    const h = detectHighlight(meta);
    assert.notEqual(h, null);
    assert.ok(h.tags.includes(HIGHLIGHT_CATEGORIES.BANK_SHOT));
    assert.ok(h.starRating >= 2);
  });

  it('detects multi-pocket shots', () => {
    const meta = {
      maxPower: 55, pocketedIds: [1, 3, 5], collisionCount: 2, cushionCount: 0,
      spinUsed: false, firstHitDistance: 80, isBank: false, score: 20,
    };
    const h = detectHighlight(meta);
    assert.notEqual(h, null);
    assert.ok(h.tags.includes(HIGHLIGHT_CATEGORIES.MULTI_POCKET));
    assert.equal(h.starRating, 3);
  });

  it('detects clutch win context', () => {
    const meta = {
      maxPower: 45, pocketedIds: [8], collisionCount: 0, cushionCount: 0,
      spinUsed: false, firstHitDistance: 70, isBank: false, score: 5,
    };
    const h = detectHighlight(meta, { isGameWinner: true });
    assert.notEqual(h, null);
    assert.ok(h.tags.includes(HIGHLIGHT_CATEGORIES.CLUTCH_WIN));
    assert.ok(h.starRating >= 2);
  });

  it('detects break run via consecutive pockets context', () => {
    const meta = {
      maxPower: 40, pocketedIds: [1], collisionCount: 0, cushionCount: 0,
      spinUsed: false, firstHitDistance: 55, isBank: false, score: 0,
    };
    const h = detectHighlight(meta, { consecutivePockets: 4 });
    assert.notEqual(h, null);
    assert.ok(h.tags.includes(HIGHLIGHT_CATEGORIES.BREAK_RUN));
    assert.equal(h.starRating, 2);
  });

  it('caps star rating at 3', () => {
    const meta = {
      maxPower: 95, pocketedIds: [1, 2, 3, 4, 5], collisionCount: 8,
      cushionCount: 4, spinUsed: true, firstHitDistance: 220, isBank: true,
      score: 90,
    };
    const h = detectHighlight(meta, { isGameWinner: true, consecutivePockets: 6 });
    assert.equal(h.starRating, 3);
  });

  it('detects thin cut from score + low collision heuristic', () => {
    const meta = {
      maxPower: 45, pocketedIds: [3], collisionCount: 0, cushionCount: 0,
      spinUsed: false, firstHitDistance: 80, isBank: false, score: 72,
    };
    const h = detectHighlight(meta);
    assert.notEqual(h, null);
    assert.ok(h.tags.includes(HIGHLIGHT_CATEGORIES.THIN_CUT));
  });

  it('returns null for shots with NaN metadata', () => {
    assert.equal(detectHighlight(null), null);
  });
});

describe('HighlightData.getHighlightTitle', () => {
  it('returns default title for null highlight', () => {
    assert.equal(getHighlightTitle(null, {}), '精彩击球');
  });

  it('uses primary tag for title', () => {
    const h = { tags: [HIGHLIGHT_CATEGORIES.BANK_SHOT] };
    const title = getHighlightTitle(h, {});
    assert.ok(title.includes('翻袋'));
  });
});

describe('HighlightStore', () => {
  let store;

  beforeEach(() => {
    storage.clear();
    store = new HighlightStore();
  });

  it('rejects broken replay frames before saving', () => {
    assert.equal(store.save({ metadata: { maxPower: 85 }, frames: [], frameCount: 10 }), null);
  });

  it('does not call a missed bank or spin shot a pocket', () => {
    const result = detectHighlight({ maxPower: 0, isBank: true, spinUsed: true, pocketedIds: [] });
    assert.equal(result, null);
  });

  it('saves a remarkable shot', () => {
    const replay = {
      metadata: {
        maxPower: 85, pocketedIds: [1], collisionCount: 0, cushionCount: 0,
        spinUsed: false, firstHitDistance: 50, isBank: false, score: 10,
      },
      frames: new Array(320).fill(1), frameCount: 10, score: 10,
    };
    const entry = store.save(replay, { mode: 'vsai' });
    assert.notEqual(entry, null);
    assert.ok(entry.starRating >= 1);
    assert.equal(store.getCount(), 1);
  });

  it('does not save unremarkable shots', () => {
    const replay = {
      metadata: {
        maxPower: 20, pocketedIds: [], collisionCount: 0, cushionCount: 0,
        spinUsed: false, firstHitDistance: 30, isBank: false, score: 0,
      },
      frames: new Array(320).fill(1), frameCount: 10, score: 0,
    };
    assert.equal(store.save(replay), null);
    assert.equal(store.getCount(), 0);
  });

  it('deduplicates rapid identical saves', () => {
    const replay = {
      metadata: {
        maxPower: 85, pocketedIds: [1], collisionCount: 0, cushionCount: 0,
        spinUsed: false, firstHitDistance: 50, isBank: false, score: 10,
      },
      frames: new Array(320).fill(1), frameCount: 10, score: 10,
    };
    store.save(replay, { mode: 'vsai' });
    store.save(replay, { mode: 'vsai' });
    assert.equal(store.getCount(), 1);
  });

  it('allows different tags through dedup window', () => {
    const r1 = {
      metadata: {
        maxPower: 85, pocketedIds: [1], collisionCount: 0, cushionCount: 0,
        spinUsed: false, firstHitDistance: 50, isBank: false, score: 10,
      },
      frames: new Array(320).fill(1), frameCount: 10, score: 10,
    };
    const r2 = {
      metadata: {
        maxPower: 40, pocketedIds: [1], collisionCount: 0, cushionCount: 0,
        spinUsed: false, firstHitDistance: 50, isBank: true, score: 10,
      },
      frames: new Array(320).fill(1), frameCount: 10, score: 10,
    };
    store.save(r1);
    store.save(r2);
    assert.equal(store.getCount(), 2);
  });

  it('deletes by id', () => {
    const replay = {
      metadata: {
        maxPower: 85, pocketedIds: [1], collisionCount: 0, cushionCount: 0,
        spinUsed: false, firstHitDistance: 50, isBank: false, score: 10,
      },
      frames: new Array(320).fill(1), frameCount: 10, score: 10,
    };
    const entry = store.save(replay);
    assert.equal(store.delete(entry.id), true);
    assert.equal(store.getCount(), 0);
    assert.equal(store.delete('nonexistent'), false);
  });

  it('clears all highlights', () => {
    const replay = {
      metadata: {
        maxPower: 85, pocketedIds: [1], collisionCount: 0, cushionCount: 0,
        spinUsed: false, firstHitDistance: 50, isBank: false, score: 10,
      },
      frames: new Array(320).fill(1), frameCount: 10, score: 10,
    };
    store.save(replay);
    store.save(replay); // second deduped
    store.clear();
    assert.equal(store.getCount(), 0);
  });

  it('returns stats correctly', () => {
    const replay = {
      metadata: {
        maxPower: 85, pocketedIds: [1], collisionCount: 0, cushionCount: 0,
        spinUsed: false, firstHitDistance: 50, isBank: false, score: 10,
      },
      frames: new Array(320).fill(1), frameCount: 10, score: 10,
    };
    store.save(replay);
    const stats = store.getStats();
    assert.equal(stats.total, 1);
    assert.ok(Number(stats.avgStars) >= 1);
  });

  it('respects max limit with FIFO eviction', () => {
    for (let i = 0; i < 55; i++) {
      const replay = {
        metadata: {
          maxPower: 85 + i, pocketedIds: [1], collisionCount: i, cushionCount: 0,
          spinUsed: false, firstHitDistance: 50 + i, isBank: i % 2 === 0, score: 10 + i,
        },
        frames: new Array(320).fill(1), frameCount: 10, score: 10 + i,
      };
      // Sleep 1ms to avoid dedup
      store.save(replay);
    }
    assert.equal(store.getCount(), 50);
  });

  it('returns newest first from getAll', () => {
    const r1 = {
      metadata: { maxPower: 85, pocketedIds: [1], collisionCount: 0, cushionCount: 0,
        spinUsed: false, firstHitDistance: 50, isBank: false, score: 10 },
      frames: new Array(320).fill(1), frameCount: 10, score: 10,
    };
    const r2 = {
      metadata: { maxPower: 90, pocketedIds: [1], collisionCount: 1, cushionCount: 0,
        spinUsed: false, firstHitDistance: 60, isBank: true, score: 15 },
      frames: new Array(320).fill(1), frameCount: 10, score: 15,
    };
    const e1 = store.save(r1);
    const e2 = store.save(r2);
    const all = store.getAll();
    assert.equal(all[0].id, e2.id);
    assert.equal(all[1].id, e1.id);
  });
});
