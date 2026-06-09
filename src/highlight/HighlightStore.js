/**
 * HighlightStore — Persistent local storage for memorable shots.
 *
 * Schema v1:
 *   {
 *     version: 1,
 *     highlights: [
 *       {
 *         id: string (timestamp-random),
 *         savedAt: number,
 *         title: string,
 *         tags: string[],
 *         starRating: 1|2|3,
 *         summary: string,
 *         replayData: object,   // full ShotRecorder output
 *         tableProfileId: string,
 *         mode: string,
 *         opponentName: string|null,
 *       }
 *     ]
 *   }
 *
 * Limits:
 *   - Max 50 highlights (FIFO eviction when exceeded)
 *   - Auto-deduplication within 5s window (prevents double-save)
 */

import { detectHighlight, getHighlightTitle } from './HighlightData.js';

const STORE_KEY = 'billiards_highlights_v1';
const MAX_HIGHLIGHTS = 50;
const DEDUP_WINDOW_MS = 5000;

export class HighlightStore {
  constructor() {
    this._data = { version: 1, highlights: [] };
    this._lastSaveAt = 0;
    this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.highlights)) {
          this._data = parsed;
          // Sanitize
          this._data.highlights = this._data.highlights.filter(h => this._isValid(h));
        }
      }
    } catch (e) {
      console.warn('[HighlightStore] load failed, using defaults');
      this._data = { version: 1, highlights: [] };
    }
  }

  _save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(this._data));
    } catch (e) {
      console.warn('[HighlightStore] save failed');
    }
  }

  _isValid(h) {
    return h && typeof h.id === 'string' && typeof h.savedAt === 'number' &&
           Number.isFinite(h.starRating) && h.starRating >= 1 && h.starRating <= 3 &&
           Array.isArray(h.tags) && h.tags.length > 0;
  }

  /**
   * Attempt to save a highlight from replay metadata.
   * @returns {Object|null} the saved highlight or null if not remarkable / duplicate
   */
  save(replayData, context = {}) {
    if (!replayData || !replayData.metadata) return null;

    const highlight = detectHighlight(replayData.metadata, context);
    if (!highlight) return null;

    // Deduplication: don't save within 5s of last save
    const now = Date.now();
    if (now - this._lastSaveAt < DEDUP_WINDOW_MS) {
      // Also check if the last highlight has identical pocketed count and tags
      const last = this._data.highlights[this._data.highlights.length - 1];
      if (last && now - last.savedAt < DEDUP_WINDOW_MS) {
        const sameTags = highlight.tags.length === last.tags.length &&
          highlight.tags.every(t => last.tags.includes(t));
        if (sameTags) return null;
      }
    }
    this._lastSaveAt = now;

    const entry = {
      id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
      savedAt: now,
      title: getHighlightTitle(highlight, replayData.metadata),
      tags: highlight.tags,
      starRating: highlight.starRating,
      summary: highlight.summary,
      replayData,
      tableProfileId: context.tableProfileId || null,
      mode: context.mode || 'unknown',
      opponentName: context.opponentName || null,
    };

    this._data.highlights.push(entry);

    // FIFO eviction
    if (this._data.highlights.length > MAX_HIGHLIGHTS) {
      this._data.highlights = this._data.highlights.slice(-MAX_HIGHLIGHTS);
    }

    this._save();
    return entry;
  }

  getAll() {
    // Return newest first
    return [...this._data.highlights].reverse();
  }

  getById(id) {
    return this._data.highlights.find(h => h.id === id) || null;
  }

  delete(id) {
    const before = this._data.highlights.length;
    this._data.highlights = this._data.highlights.filter(h => h.id !== id);
    if (this._data.highlights.length < before) {
      this._save();
      return true;
    }
    return false;
  }

  clear() {
    this._data.highlights = [];
    this._save();
  }

  getCount() {
    return this._data.highlights.length;
  }

  getStats() {
    const all = this._data.highlights;
    const counts = {};
    let totalStars = 0;
    for (const h of all) {
      for (const t of h.tags) {
        counts[t] = (counts[t] || 0) + 1;
      }
      totalStars += h.starRating;
    }
    return {
      total: all.length,
      byTag: counts,
      avgStars: all.length > 0 ? (totalStars / all.length).toFixed(1) : '0.0',
      threeStarCount: all.filter(h => h.starRating === 3).length,
    };
  }
}

export const highlightStore = new HighlightStore();
