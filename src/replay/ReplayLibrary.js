/**
 * ReplayLibrary — Persistent storage for recorded shot replays.
 *
 * Uses localStorage with automatic eviction when quota is exceeded.
 * Stores up to replayMaxSaved replays (default 50), evicting lowest-score replays first.
 */
import { settings } from '../core/SettingsStore.js';

const STORAGE_KEY = 'billiards_replays_v1';
const DEFAULT_MAX_REPLAYS = 50;
const MIN_SCORE_TO_SAVE = 25; // only save shots with score >= 25

function _getMaxReplays() {
  const v = settings.get('replayMaxSaved');
  return (typeof v === 'number' && v > 0) ? Math.min(v, 200) : DEFAULT_MAX_REPLAYS;
}

export class ReplayLibrary {
  constructor() {
    this.replays = this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('ReplayLibrary: failed to load', e);
    }
    return [];
  }

  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.replays));
      return true;
    } catch (e) {
      // Quota exceeded — evict lowest score replays and retry
      if (e.name === 'QuotaExceededError') {
        this._evictLowest();
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(this.replays));
          return true;
        } catch (e2) {
          console.warn('ReplayLibrary: quota exceeded even after eviction');
          return false;
        }
      } else {
        console.warn('ReplayLibrary: failed to save', e);
        return false;
      }
    }
  }

  _evictLowest() {
    if (this.replays.length === 0) return;
    // Sort by score ascending, remove first half
    this.replays.sort((a, b) => (a.score || 0) - (b.score || 0));
    this.replays = this.replays.slice(Math.floor(this.replays.length / 2));
  }

  /** Try to save a replay. Returns true if saved, false if score too low or auto-save disabled. */
  save(replayData) {
    if (settings.get('autoSaveReplays') === false) return false;
    if (!replayData || !replayData.frames || replayData.frameCount < 5) return false;
    if ((replayData.score || 0) < MIN_SCORE_TO_SAVE) return false;

    const entry = {
      id: this._generateId(),
      savedAt: Date.now(),
      name: replayData.name || '',
      score: replayData.score,
      frameCount: replayData.frameCount,
      frames: replayData.frames,
      metadata: replayData.metadata,
    };

    this.replays.push(entry);

    // Evict if over limit (remove lowest score)
    const maxReplays = _getMaxReplays();
    if (this.replays.length > maxReplays) {
      this.replays.sort((a, b) => (a.score || 0) - (b.score || 0));
      this.replays = this.replays.slice(-maxReplays);
    }

    return this._save();
  }

  /** Get all replays sorted by score (highest first). */
  getAll() {
    return [...this.replays].sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  /** Get a replay by ID. */
  getById(id) {
    return this.replays.find((r) => r.id === id) || null;
  }

  /** Delete a replay by ID. */
  delete(id) {
    const idx = this.replays.findIndex((r) => r.id === id);
    if (idx >= 0) {
      this.replays.splice(idx, 1);
      this._save();
      return true;
    }
    return false;
  }

  /** Get count of saved replays. */
  getCount() {
    return this.replays.length;
  }

  /** Get current max replays limit (from settings). */
  getMaxReplays() {
    return _getMaxReplays();
  }

  /** Update replay name. */
  updateName(id, name) {
    const replay = this.replays.find((r) => r.id === id);
    if (replay) {
      replay.name = String(name || '').trim();
      this._save();
      return true;
    }
    return false;
  }

  /** Export all replays as JSON string. */
  exportAll() {
    return JSON.stringify(this.replays);
  }

  /** Import replays from JSON string. Returns number imported. */
  importAll(json) {
    try {
      const data = JSON.parse(json);
      if (!Array.isArray(data)) return 0;
      let count = 0;
      const seenIds = new Set(this.replays.map((r) => r.id));
      for (const item of data) {
        if (!item || typeof item !== 'object') continue;
        if (!Array.isArray(item.frames) || typeof item.frameCount !== 'number' || item.frameCount < 2) continue;
        if (typeof item.score !== 'number') continue;
        // Ensure ID uniqueness (both existing and within this batch)
        if (seenIds.has(item.id)) {
          item.id = this._generateId();
        }
        seenIds.add(item.id);
        this.replays.push(item);
        count++;
      }
      // Enforce limit
      const maxReplays = _getMaxReplays();
      if (this.replays.length > maxReplays) {
        this.replays.sort((a, b) => (a.score || 0) - (b.score || 0));
        this.replays = this.replays.slice(-maxReplays);
      }
      this._save();
      return count;
    } catch (e) {
      console.warn('ReplayLibrary: import failed', e);
      return 0;
    }
  }

  /** Clear all replays. */
  clear() {
    this.replays = [];
    this._save();
  }

  _generateId() {
    return 'r_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  }
}
