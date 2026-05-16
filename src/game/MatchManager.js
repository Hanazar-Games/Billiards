/**
 * MatchManager — Higher-level match coordinator that wraps MatchEngine
 * and owns the match-score HUD updates.
 *
 * Previously this logic was scattered between MenuSystem (orchestration),
 * MatchEngine (scoring), and Game.js (HUD rendering in the update loop).
 * MatchManager brings the HUD responsibility into one place so Game.js
 * does not need to know about match scores.
 */

import { MatchEngine } from '../core/MatchEngine.js';

export class MatchManager {
  constructor(config) {
    this.engine = new MatchEngine(config);
    this._onGameEnd = null;
  }

  startGame() {
    this.engine.startGame();
  }

  recordWinner(player) {
    this.engine.recordWinner(player);
  }

  isMatchOver() {
    return this.engine.isMatchOver();
  }

  getStatus() {
    return this.engine.getStatus();
  }

  reset() {
    this.engine.reset();
  }

  /** Called by Game.js each frame to keep the match HUD in sync. */
  updateHUD(ui, networkPlayer1Name, networkPlayer2Name) {
    const status = this.engine.getStatus();
    if (!status || !ui) return;
    const hash = `${networkPlayer1Name ?? ''}|${networkPlayer2Name ?? ''}|${status.p1Score}|${status.p2Score}|${status.currentGame}|${status.gamesNeeded}`;
    if (this._lastHUDHash === hash) return;
    this._lastHUDHash = hash;
    ui.setMatchScore({
      p1Name: networkPlayer1Name || status.p1Name || '玩家 1',
      p2Name: networkPlayer2Name || status.p2Name || '玩家 2',
      p1Score: status.p1Score,
      p2Score: status.p2Score,
      currentGame: status.currentGame,
      gamesNeeded: status.gamesNeeded,
      visible: true,
    });
  }

  /** Called by MenuSystem to register the callback Game.js will invoke on game end. */
  setOnGameEnd(cb) {
    this._onGameEnd = cb;
  }

  /** Called by Game.js when an individual game ends. */
  onGameEnd(winner) {
    if (this._onGameEnd) this._onGameEnd(winner);
  }
}
