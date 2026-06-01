/**
 * TournamentStore — Persistent storage for tournament history.
 *
 * Keeps a rolling log of completed tournaments so players can browse
 * their past performances, trophies, and favourite match-ups.
 */

const STORAGE_KEY = 'billiards_tournament_history_v1';
const MAX_HISTORY = 20;

export class TournamentStore {
  constructor() {
    this.history = this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('TournamentStore: failed to load', e);
    }
    return [];
  }

  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.history));
      return true;
    } catch (e) {
      console.warn('TournamentStore: failed to save', e);
      return false;
    }
  }

  /** Append a finished tournament to history. Evicts oldest if over limit. */
  record(engineState) {
    if (!engineState || engineState.status !== 'finished') return false;

    const summary = {
      id: engineState.id,
      createdAt: engineState.createdAt,
      finishedAt: Date.now(),
      playerName: engineState.player?.name,
      playerColor: engineState.player?.color,
      mode: engineState.mode,
      champion: engineState.champion,
      trophy: engineState.trophy,
      rounds: engineState.rounds.map((round) =>
        round.map((m) => ({
          round: m.round,
          p1Name: m.player1?.name,
          p2Name: m.player2?.name,
          p1Score: m.p1Score,
          p2Score: m.p2Score,
          winnerName: m.winner?.name,
          winnerIsPlayer: m.winner?.isPlayer,
          played: m.played,
        }))
      ),
    };

    this.history.push(summary);
    if (this.history.length > MAX_HISTORY) {
      this.history = this.history.slice(-MAX_HISTORY);
    }
    return this._save();
  }

  getAll() {
    return [...this.history].reverse();
  }

  getById(id) {
    return this.history.find((h) => h.id === id) || null;
  }

  clear() {
    this.history = [];
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  }
}
