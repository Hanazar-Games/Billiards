import { CameraDirector, CAMERA_MODE } from './CameraDirector.js';
import { CommentarySystem } from './CommentarySystem.js';
import { BroadcastUI } from './BroadcastUI.js';

/**
 * SpectatorMode — Orchestrates the AI-vs-AI broadcast experience.
 *
 * Hooks into a running Game instance and adds:
 *   - Automatic cinematic camera switching
 *   - Real-time commentary generation
 *   - Broadcast-style HUD overlay
 *
 * Does NOT modify game physics or rules — purely observational.
 */

export class SpectatorMode {
  constructor(renderer, game) {
    this.renderer = renderer;
    this.game = game;
    this.active = false;

    this.camera = new CameraDirector(renderer);
    this.commentary = new CommentarySystem();
    this.ui = new BroadcastUI();

    this._totalShots = 0;
    this._lastState = null;
    this._lastPlayer = 1;
    this._lastPocketCount = 0;
    this._eightBallAnnounced = false;
    this._gameOverHandled = false;

    this._onGameEvent = this._onGameEvent.bind(this);
    this._tmpPocketed = [];
  }

  start() {
    if (this.active) return;
    this.active = true;
    this._gameOverHandled = false;
    this._eightBallAnnounced = false;
    this._totalShots = 0;

    // Set table dimensions for camera
    if (this.game.tableProfile) {
      this.camera.setTableDimensions(
        this.game.tableProfile.width / 2,
        this.game.tableProfile.depth / 2
      );
    }

    // Mount UI into the app container (above canvas, below menus)
    const app = document.getElementById('app');
    if (app) this.ui.mount(app);

    // Set player names
    const p1Name = this.game.networkPlayer1Name || 'AI Alpha';
    const p2Name = this.game.networkPlayer2Name || 'AI Beta';
    this.ui.setPlayerNames(p1Name, p2Name);
    this.commentary.onMatchStart(p1Name, p2Name);

    this.ui.show();
    this.ui.setActivePlayer(this.game.currentPlayer || 1);

    // Override game's camera update so we control it
    this._originalUpdateCamera = this.game._updateCamera?.bind(this.game);
    this.game._updateCamera = () => {}; // no-op

    // Hide default game HUD elements that conflict with broadcast UI
    this._hideDefaultHUD();
  }

  stop() {
    if (!this.active) return;
    this.active = false;

    // Restore original camera update
    if (this._originalUpdateCamera && this.game) {
      this.game._updateCamera = this._originalUpdateCamera;
    }

    this.camera.reset();
    this.ui.destroy();
    this.commentary.reset();
    this._restoreDefaultHUD();
  }

  _hideDefaultHUD() {
    // Hide the default top bar player badges and message
    const topBar = document.getElementById('top-bar');
    if (topBar) topBar.style.display = 'none';
    const powerBar = document.getElementById('power-bar-container');
    if (powerBar) powerBar.style.display = 'none';
    const turnTimer = document.getElementById('turn-timer');
    if (turnTimer) turnTimer.style.display = 'none';
    const versionTag = document.getElementById('version-tag');
    if (versionTag) versionTag.style.display = 'none';

    // Hide bottom HUD
    const bottomHud = document.getElementById('bottom-hud');
    if (bottomHud) bottomHud.style.display = 'none';

    // Hide minimap canvas
    const minimap = document.querySelector('.table-minimap');
    if (minimap) minimap.style.display = 'none';
  }

  _restoreDefaultHUD() {
    const topBar = document.getElementById('top-bar');
    if (topBar) topBar.style.display = '';
    const powerBar = document.getElementById('power-bar-container');
    if (powerBar) powerBar.style.display = '';
    const turnTimer = document.getElementById('turn-timer');
    if (turnTimer) turnTimer.style.display = '';
    const versionTag = document.getElementById('version-tag');
    if (versionTag) versionTag.style.display = '';
    const bottomHud = document.getElementById('bottom-hud');
    if (bottomHud) bottomHud.style.display = '';

    // Restore minimap canvas
    const minimap = document.querySelector('.table-minimap');
    if (minimap) minimap.style.display = '';
  }

  update(dt) {
    if (!this.active || !this.game) return;

    const game = this.game;
    const state = game.state;

    // Camera update
    this.camera.update(dt, game);

    // Commentary typewriter update
    this.commentary.update(dt);
    this.ui.setCommentary(
      this.commentary.getDisplayedText(),
      this.commentary.isTyping()
    );

    // UI timer update
    this.ui.update(dt);

    // Detect state transitions to trigger commentary / camera
    this._detectStateChanges(state, game);

    this._lastState = state;
    this._lastPlayer = game.currentPlayer;
  }

  _detectStateChanges(state, game) {
    const last = this._lastState;

    // Detect turn change
    if (game.currentPlayer !== this._lastPlayer && last !== null) {
      this.ui.setActivePlayer(game.currentPlayer);
      this.commentary.onTurnChange(
        game.currentPlayer,
        game.ballInHand
      );
      this.camera.setPhase('idle');
    }

    // Detect AI thinking start
    if (state === 'AI_THINKING' && last !== 'AI_THINKING') {
      this.commentary.onThinking(game.currentPlayer);
      this.camera.setPhase('aim');
    }

    // Detect shot start
    if (state === 'SHOOTING' && last !== 'SHOOTING') {
      this._totalShots++;
      this.ui.setShotCount(this._totalShots);
      this._lastPocketCount = game.turnPocketedIds?.length || 0;
      this.commentary.onAimStart();
      this.camera.setPhase('shooting');

      // Check if this is break shot
      if (game._isBreakShot) {
        this.ui.showEventBadge('开球', 2000);
      }
    }

    // Detect turn end (balls stopped, resolveTurn called)
    if (state === 'AIM' && last === 'SHOOTING') {
      this._handleTurnEnd(game);
      this.camera.setPhase('idle');
    }

    // Detect return to AIM from other states (turn change without shooting, e.g. foul/auto)
    if (state === 'AIM' && last !== 'AIM' && last !== null && last !== 'SHOOTING') {
      this.camera.setPhase('idle');
    }

    // Detect game over
    if (state === 'GAME_OVER' && !this._gameOverHandled) {
      this._gameOverHandled = true;
      // Determine winner from game rules state
      let winner = 1;
      try {
        const status = game.rules?.getStatus?.();
        if (status && status.winner) winner = status.winner;
      } catch (e) {
        // fallback: current player lost if game over on their turn
        winner = game.currentPlayer === 1 ? 2 : 1;
      }
      this.commentary.onGameWin(winner);
      const winnerName = winner === 1 ? (this.game.networkPlayer1Name || 'AI Alpha') : (this.game.networkPlayer2Name || 'AI Beta');
      this.ui.showEventBadge(`🏆 ${winnerName} 获胜！`, 6000);
      this.camera.setPhase('idle');
    }

    // Detect pocket events during SHOOTING / RESOLVING
    if ((state === 'SHOOTING' || state === 'RESOLVING') && game.turnPocketedIds) {
      const currentCount = game.turnPocketedIds.length;
      if (currentCount > this._lastPocketCount) {
        const newlyPocketed = game.turnPocketedIds.slice(this._lastPocketCount);
        for (const ballId of newlyPocketed) {
          this._onBallPocketed(ballId, game);
        }
        this._lastPocketCount = currentCount;
      }
    }

    // Check for 8-ball approach (once per game)
    if (!this._eightBallAnnounced && game.rules) {
      try {
        const status = game.rules.getStatus?.();
        if (status && status.eightBallActive) {
          this._eightBallAnnounced = true;
          this.commentary.onEightBallApproach();
          this.ui.showEventBadge('黑八时刻', 3000);
        }
      } catch (e) {
        // ignore
      }
    }
  }

  _handleTurnEnd(game) {
    const rules = game.rules;
    if (!rules) return;

    try {
      const result = rules.getStatus?.();
      // We don't have direct turn result here, infer from state changes
      // Instead rely on pocket/foul detection during the turn
    } catch (e) {
      // ignore
    }
  }

  _onBallPocketed(ballId, game) {
    const isDifficult = this._isDifficultShot(game);
    const isLong = this._isLongShot(game);
    const isBank = false; // TODO: detect bank shots

    this.commentary.onPocket(
      ballId,
      game.currentPlayer,
      isDifficult,
      isLong,
      isBank,
      false
    );

    // Show pocket close-up on broadcast camera
    if (game.table) {
      const pockets = game.table.getPocketPositions?.() || [];
      // Try to find which pocket the ball went into (approximate)
      const ball = game.ballsManager?.getBall?.(ballId);
      if (ball && pockets.length > 0) {
        let closestIdx = 0;
        let closestDist = Infinity;
        for (let i = 0; i < pockets.length; i++) {
          const p = pockets[i];
          const dx = p.x - ball.mesh.position.x;
          const dz = p.z - ball.mesh.position.z;
          const dist = dx * dx + dz * dz;
          if (dist < closestDist) {
            closestDist = dist;
            closestIdx = i;
          }
        }
        this.camera.showPocketCloseUp(closestIdx);
      }
    }
  }

  _isDifficultShot(game) {
    // Heuristic: if aim direction is at a shallow angle to the pocket
    // For now, use random factor weighted by AI difficulty
    return Math.random() < 0.15;
  }

  _isLongShot(game) {
    // Heuristic: cue ball far from target
    const cueBall = game.ballsManager?.getCueBall?.();
    if (!cueBall) return false;
    const aim = game.aimDirection;
    // Raycast approx: check if target is far
    return false; // Simplified
  }

  /** Public: trigger a foul comment. Called from Game if needed. */
  onFoul(playerNum, isScratch) {
    this.commentary.onFoul(playerNum, isScratch);
    if (isScratch) {
      this.ui.showEventBadge('母球落袋', 2500);
    } else {
      this.ui.showEventBadge('犯规', 2000);
    }
  }

  /** Public: trigger a miss comment. */
  onMiss(playerNum) {
    this.commentary.onMiss(playerNum);
  }

  /** Public: trigger a safety comment. */
  onSafety(playerNum) {
    this.commentary.onSafety(playerNum);
  }

  dispose() {
    this.stop();
    this.camera.dispose();
    this.commentary.dispose();
    this.ui.destroy();
    this.game = null;
    this.renderer = null;
  }
}
