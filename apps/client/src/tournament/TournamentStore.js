/**
 * TournamentStore — Persistent storage for tournament history & season stats.
 *
 * Keeps a rolling log of completed tournaments and aggregates season-level
 * statistics (entries, championships, rival records, best round, etc).
 *
 * Schema v2 adds:
 *   - seasonStats object
 *   - per-tournament opponentSnapshots for richer history cards
 *   - backward-compatible load from v1 (plain array)
 */

const STORAGE_KEY = 'billiards_tournament_history_v2';
const V1_KEY = 'billiards_tournament_history_v1';
const MAX_HISTORY = 20;

const DEFAULT_SEASON_STATS = {
  totalEntered: 0,
  championships: 0,
  bestRound: -1, // -1 = none, 0 = quarter, 1 = semi, 2 = final
  totalWins: 0,
  totalLosses: 0,
  rivalWins: {}, // { opponentName: winCount }
  favoriteMode: null,
  modeCounts: {}, // { mode: count }
  currentStreak: 0,
  bestStreak: 0,
};

function _deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export class TournamentStore {
  constructor() {
    const loaded = this._load();
    this.history = loaded.history || [];
    this.seasonStats = loaded.seasonStats || _deepClone(DEFAULT_SEASON_STATS);
  }

  _load() {
    try {
      // Try v2 key first
      let raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        // Migrate from v1 if present
        const v1Raw = localStorage.getItem(V1_KEY);
        if (v1Raw) {
          const v1Parsed = JSON.parse(v1Raw);
          if (Array.isArray(v1Parsed)) {
            const migrated = {
              version: 2,
              history: v1Parsed,
              seasonStats: _deepClone(DEFAULT_SEASON_STATS),
            };
            // Compute season stats from existing history
            this._rebuildSeasonStats(migrated);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
            return migrated;
          }
        }
      }
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          if (!parsed.version) parsed.version = 2;
          if (!Array.isArray(parsed.history)) parsed.history = [];
          if (!parsed.seasonStats || typeof parsed.seasonStats !== 'object') {
            parsed.seasonStats = _deepClone(DEFAULT_SEASON_STATS);
            this._rebuildSeasonStats(parsed);
          } else {
            // Sanitize nested objects in case of corruption
            this._sanitizeSeasonStats(parsed.seasonStats);
          }
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[TournamentStore] Load failed, using defaults', e);
    }
    return { version: 2, history: [], seasonStats: _deepClone(DEFAULT_SEASON_STATS) };
  }

  _save() {
    try {
      const payload = {
        version: 2,
        history: this.history,
        seasonStats: this.seasonStats,
      };
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      }
      return true;
    } catch (e) {
      console.warn('[TournamentStore] Save failed', e);
      return true; // Memory state is still valid; persistence is best-effort
    }
  }

  _sanitizeSeasonStats(s) {
    if (typeof s.totalEntered !== 'number') s.totalEntered = 0;
    if (typeof s.championships !== 'number') s.championships = 0;
    if (typeof s.bestRound !== 'number') s.bestRound = -1;
    if (typeof s.totalWins !== 'number') s.totalWins = 0;
    if (typeof s.totalLosses !== 'number') s.totalLosses = 0;
    if (!s.rivalWins || typeof s.rivalWins !== 'object') s.rivalWins = {};
    if (!s.modeCounts || typeof s.modeCounts !== 'object') s.modeCounts = {};
    if (typeof s.currentStreak !== 'number') s.currentStreak = 0;
    if (typeof s.bestStreak !== 'number') s.bestStreak = 0;
  }

  _rebuildSeasonStats(data) {
    const stats = _deepClone(DEFAULT_SEASON_STATS);
    for (const h of (data.history || [])) {
      stats.totalEntered++;
      const mode = h.mode || '8ball';
      stats.modeCounts[mode] = (stats.modeCounts[mode] || 0) + 1;

      const isChampion = h.champion?.name === h.playerName;
      if (isChampion) {
        stats.championships++;
        stats.currentStreak++;
        stats.bestStreak = Math.max(stats.bestStreak, stats.currentStreak);
      } else {
        stats.currentStreak = 0;
      }

      // Derive best round from trophy or rounds depth
      let roundReached = 0;
      if (h.rounds && Array.isArray(h.rounds)) {
        for (let r = h.rounds.length - 1; r >= 0; r--) {
          const round = h.rounds[r];
          if (Array.isArray(round)) {
            const played = round.filter((m) => m.played && (m.winnerName === h.playerName || m.p1Name === h.playerName || m.p2Name === h.playerName));
            if (played.length > 0) {
              roundReached = r;
              break;
            }
          }
        }
      }
      if (isChampion) roundReached = 2;
      stats.bestRound = Math.max(stats.bestRound, roundReached);

      // Count wins/losses and rival records
      if (h.rounds && Array.isArray(h.rounds)) {
        for (const round of h.rounds) {
          if (!Array.isArray(round)) continue;
          for (const m of round) {
            if (!m.played) continue;
            const isPlayerP1 = m.p1Name === h.playerName;
            const playerWon = m.winnerName === h.playerName;
            if (playerWon) {
              stats.totalWins++;
              const opponentName = isPlayerP1 ? m.p2Name : m.p1Name;
              if (opponentName) {
                stats.rivalWins[opponentName] = (stats.rivalWins[opponentName] || 0) + 1;
              }
            } else if (m.winnerName) {
              stats.totalLosses++;
            }
          }
        }
      }
    }
    // Favorite mode
    let maxCount = 0;
    let favMode = null;
    for (const [mode, count] of Object.entries(stats.modeCounts)) {
      if (count > maxCount) {
        maxCount = count;
        favMode = mode;
      }
    }
    stats.favoriteMode = favMode;
    data.seasonStats = stats;
  }

  /** Append a finished tournament to history and update season stats. */
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
          p1Title: m.player1?.title,
          p2Title: m.player2?.title,
          p1Style: m.player1?.style,
          p2Style: m.player2?.style,
          p1Score: m.p1Score,
          p2Score: m.p2Score,
          winnerName: m.winner?.name,
          winnerIsPlayer: m.winner?.isPlayer,
          played: m.played,
        }))
      ),
      opponentSnapshots: engineState.rounds
        .flat()
        .filter((m) => m.played && (m.player1?.isPlayer || m.player2?.isPlayer))
        .map((m) => {
          const opponent = m.player1?.isPlayer ? m.player2 : m.player1;
          return {
            name: opponent?.name,
            title: opponent?.title,
            style: opponent?.style,
            round: m.round,
            playerWon: !!(m.winner?.isPlayer),
          };
        }),
    };

    this.history.push(summary);
    if (this.history.length > MAX_HISTORY) {
      this.history = this.history.slice(-MAX_HISTORY);
    }

    this._updateSeasonStats(engineState, summary);
    return this._save();
  }

  _updateSeasonStats(engineState, summary) {
    const s = this.seasonStats;
    s.totalEntered++;

    const mode = engineState.mode || '8ball';
    s.modeCounts[mode] = (s.modeCounts[mode] || 0) + 1;

    const isChampion = engineState.champion?.name === engineState.player?.name;
    if (isChampion) {
      s.championships++;
      s.currentStreak++;
      s.bestStreak = Math.max(s.bestStreak, s.currentStreak);
      s.bestRound = Math.max(s.bestRound, 2);
    } else {
      s.currentStreak = 0;
      // Determine round reached
      const lastMatch = summary.opponentSnapshots?.[summary.opponentSnapshots.length - 1];
      const roundReached = lastMatch ? lastMatch.round : 0;
      s.bestRound = Math.max(s.bestRound, roundReached);
    }

    // Update wins/losses and rival records from opponentSnapshots
    if (summary.opponentSnapshots) {
      for (const snap of summary.opponentSnapshots) {
        if (snap.playerWon) {
          s.totalWins++;
          if (snap.name) {
            s.rivalWins[snap.name] = (s.rivalWins[snap.name] || 0) + 1;
          }
        } else {
          s.totalLosses++;
        }
      }
    }

    // Favorite mode
    let maxCount = 0;
    let favMode = null;
    for (const [m, count] of Object.entries(s.modeCounts)) {
      if (count > maxCount) {
        maxCount = count;
        favMode = m;
      }
    }
    s.favoriteMode = favMode;
  }

  getAll() {
    return [...this.history].reverse();
  }

  getById(id) {
    return this.history.find((h) => h.id === id) || null;
  }

  getSeasonStats() {
    return _deepClone(this.seasonStats);
  }

  clear() {
    this.history = [];
    this.seasonStats = _deepClone(DEFAULT_SEASON_STATS);
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(V1_KEY);
    } catch (e) {}
  }
}
