/**
 * MatchEngine — Tracks score and match state for local tournament play.
 *
 * Lifecycle:
 *   1. new MatchEngine({ p1Name, p2Name, mode, gamesNeeded })
 *   2. startGame()       — call before each individual game
 *   3. recordWinner(1|2) — call when a game ends
 *   4. isMatchOver()     — check if the tournament is finished
 *   5. getStatus()       — get current score, game number, leader, etc.
 */
export class MatchEngine {
  constructor({ p1Name, p2Name, mode, gamesNeeded }) {
    this.p1Name = p1Name || '玩家 1';
    this.p2Name = p2Name || '玩家 2';
    this.mode = mode || '8ball'; // '8ball' | '9ball'
    this.gamesNeeded = gamesNeeded || 1; // 1 | 3 | 5
    this.p1Score = 0;
    this.p2Score = 0;
    this.currentGame = 0;
    this.winner = null; // 1 | 2 | null
    this.finished = false;
  }

  startGame() {
    this.currentGame++;
  }

  recordWinner(player) {
    if (this.finished) return;
    if (player === 1) this.p1Score++;
    else if (player === 2) this.p2Score++;

    const half = Math.ceil(this.gamesNeeded / 2);
    if (this.p1Score >= half) {
      this.winner = 1;
      this.finished = true;
    } else if (this.p2Score >= half) {
      this.winner = 2;
      this.finished = true;
    }
  }

  isMatchOver() {
    return this.finished;
  }

  getStatus() {
    const half = Math.ceil(this.gamesNeeded / 2);
    return {
      p1Name: this.p1Name,
      p2Name: this.p2Name,
      p1Score: this.p1Score,
      p2Score: this.p2Score,
      currentGame: this.currentGame,
      gamesNeeded: this.gamesNeeded,
      winsNeeded: half,
      mode: this.mode,
      finished: this.finished,
      winner: this.winner,
      leader: this.p1Score > this.p2Score ? 1 : (this.p2Score > this.p1Score ? 2 : null),
    };
  }

  reset() {
    this.p1Score = 0;
    this.p2Score = 0;
    this.currentGame = 0;
    this.winner = null;
    this.finished = false;
  }
}
