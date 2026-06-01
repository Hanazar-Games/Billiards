/**
 * TournamentEngine — Core logic for single-elimination bracket management.
 *
 * Stateless pure functions + a small mutable state wrapper.
 * All mutations go through this engine so the UI layer stays simple.
 */

import {
  generateOpponents,
  generateBracket,
  createPlayerCharacter,
  getNextMatch,
  getWinnerSlot,
  ROUND_DIFFICULTY,
  TROPHY_TIERS,
} from './TournamentData.js';

export class TournamentEngine {
  constructor() {
    this.state = null;
  }

  /** Start a brand new tournament. */
  create(playerName, playerColorIndex, mode = '8ball', tableProfileId = null) {
    const player = createPlayerCharacter(playerName, playerColorIndex);
    const opponents = generateOpponents(7);
    const rounds = generateBracket(player, opponents, mode, tableProfileId);

    this.state = {
      id: `tour_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      createdAt: Date.now(),
      player,
      mode,
      tableProfileId,
      status: 'active',
      currentRound: 0,
      currentMatchIndex: 0,
      rounds,
      champion: null,
      trophy: null,
    };

    // Find the player's first match
    this._findPlayerNextMatch();
    return this.state;
  }

  /** Resume from a saved state object. */
  load(savedState) {
    this.state = savedState;
    return this.state;
  }

  /** Export current state for persistence. */
  export() {
    return this.state ? { ...this.state } : null;
  }

  /** Return the currently active match (the one the player should play next). */
  getCurrentMatch() {
    if (!this.state) return null;
    const { currentRound, currentMatchIndex, rounds } = this.state;
    if (currentRound >= rounds.length) return null;
    const match = rounds[currentRound][currentMatchIndex];
    if (!match || match.played) return null;
    return match;
  }

  /** Is the player involved in the current active match? */
  isPlayerTurn() {
    const match = this.getCurrentMatch();
    if (!match) return false;
    return match.player1?.isPlayer || match.player2?.isPlayer;
  }

  /** Record the result of a finished game (called by MenuSystem after a game ends). */
  recordGameResult(playerWon) {
    if (!this.state) return { finished: false, tournamentOver: false };
    const match = this.getCurrentMatch();
    if (!match) return { finished: false, tournamentOver: false };

    match.played = true;
    match.endTime = Date.now();

    const isP1Player = !!match.player1?.isPlayer;
    const winner = playerWon ? (isP1Player ? match.player1 : match.player2)
                              : (isP1Player ? match.player2 : match.player1);
    const loser = playerWon ? (isP1Player ? match.player2 : match.player1)
                            : (isP1Player ? match.player1 : match.player2);

    match.winner = winner;
    if (isP1Player) {
      match.p1Score = playerWon ? match.gamesNeeded : 0;
      match.p2Score = playerWon ? 0 : match.gamesNeeded;
    } else {
      match.p1Score = playerWon ? 0 : match.gamesNeeded;
      match.p2Score = playerWon ? match.gamesNeeded : 0;
    }

    // If player lost, tournament ends for them
    if (!playerWon) {
      this.state.status = 'finished';
      this._assignTrophy('eliminated');
      return { finished: true, tournamentOver: true, won: false, round: match.round };
    }

    // Advance winner to next round
    const next = getNextMatch(match.round, match.index);
    if (next) {
      const slot = getWinnerSlot(match.round, match.index);
      const nextMatch = this.state.rounds[next.round][next.index];
      nextMatch[slot] = winner;
      this.state.currentRound = next.round;
      this.state.currentMatchIndex = next.index;
      this._findPlayerNextMatch();
    } else {
      // Champion!
      this.state.status = 'finished';
      this.state.champion = winner;
      this._assignTrophy('champion');
      return { finished: true, tournamentOver: true, won: true, champion: winner };
    }

    return { finished: true, tournamentOver: false, won: true, nextMatch: this.getCurrentMatch() };
  }

  /** Get a flat list of all matches for rendering the bracket. */
  getAllMatches() {
    if (!this.state) return [];
    return this.state.rounds.flat();
  }

  /** Get human-readable round name. */
  static getRoundName(roundIndex) {
    const names = ['八强赛', '半决赛', '决赛'];
    return names[roundIndex] || `第 ${roundIndex + 1} 轮`;
  }

  /** Get AI difficulty for the current opponent. */
  getOpponentDifficulty() {
    const match = this.getCurrentMatch();
    if (!match) return null;
    const opponent = match.player1?.isPlayer ? match.player2 : match.player1;
    if (!opponent) return null;
    const roundDiffs = ROUND_DIFFICULTY[match.round] || [null, null];
    // Use the non-player slot's difficulty
    const isP1Player = !!match.player1?.isPlayer;
    return isP1Player ? roundDiffs[1] : roundDiffs[0];
  }

  /** Build a modeConfig object for Game.init() based on current match. */
  getModeConfigForCurrentMatch() {
    const match = this.getCurrentMatch();
    if (!match) return null;
    const difficulty = this.getOpponentDifficulty() || 'normal';
    const mode = match.mode === '9ball' ? 'nineball' : 'vsai';
    const config = {
      mode,
      aiEnabled: true,
      aiDifficulty: difficulty,
    };
    if (match.tableProfileId) {
      config.tableProfileId = match.tableProfileId;
    }
    return config;
  }

  _findPlayerNextMatch() {
    if (!this.state) return;
    for (let r = 0; r < this.state.rounds.length; r++) {
      for (let m = 0; m < this.state.rounds[r].length; m++) {
        const match = this.state.rounds[r][m];
        if (!match.played && (match.player1?.isPlayer || match.player2?.isPlayer)) {
          this.state.currentRound = r;
          this.state.currentMatchIndex = m;
          return;
        }
      }
    }
  }

  _assignTrophy(outcome) {
    if (!this.state) return;
    if (outcome === 'champion') {
      this.state.trophy = TROPHY_TIERS.gold;
    } else {
      const match = this.getCurrentMatch() || this._getLastPlayedMatch();
      const round = match ? match.round : 0;
      if (round >= 2) {
        this.state.trophy = TROPHY_TIERS.silver;
      } else if (round >= 1) {
        this.state.trophy = TROPHY_TIERS.bronze;
      } else {
        this.state.trophy = null;
      }
    }
  }

  _getLastPlayedMatch() {
    if (!this.state) return null;
    for (let r = this.state.rounds.length - 1; r >= 0; r--) {
      for (let m = this.state.rounds[r].length - 1; m >= 0; m--) {
        if (this.state.rounds[r][m].played) return this.state.rounds[r][m];
      }
    }
    return null;
  }
}
