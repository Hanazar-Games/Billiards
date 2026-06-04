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

    this._hiddenHudDisplays = new Map();
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

    // Disable orbit controls so CameraDirector has sole authority
    if (this.renderer?.controls) {
      this._originalControlsEnabled = this.renderer.controls.enabled;
      this.renderer.controls.enabled = false;
    }

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
    this._originalUpdateCamera = null;

    // Restore orbit controls
    if (this.renderer?.controls && this._originalControlsEnabled !== undefined) {
      this.renderer.controls.enabled = this._originalControlsEnabled;
      this._originalControlsEnabled = undefined;
    }

    this.camera.reset();
    this.ui.destroy();
    this.commentary.reset();
    this._restoreDefaultHUD();
  }

  _hideDefaultHUD() {
    const hide = (el) => {
      if (!el || this._hiddenHudDisplays.has(el)) return;
      this._hiddenHudDisplays.set(el, el.style.display);
      el.style.display = 'none';
    };

    hide(document.getElementById('top-bar'));
    hide(document.getElementById('power-bar-container'));
    hide(document.getElementById('turn-timer'));
    hide(document.getElementById('version-tag'));
    hide(document.getElementById('bottom-hud'));
    hide(document.querySelector('.table-minimap'));
  }

  _restoreDefaultHUD() {
    for (const [el, display] of this._hiddenHudDisplays.entries()) {
      if (el && el.style) el.style.display = display;
    }
    this._hiddenHudDisplays.clear();
  }

  update(dt) {
    if (!this.active || !this.game) return;

    const game = this.game;
    const state = game.state;

    // Do not fight with Instant Replay camera director
    if (state === 'REPLAYING') return;

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
    const isBank = game._shotIsBank || false;

    this.commentary.onPocket(
      ballId,
      game.currentPlayer,
      isDifficult,
      isLong,
      isBank,
      this.commentary._comboCount >= 1
    );

    // Show pocket close-up on broadcast camera
    if (game.table) {
      const pockets = game.table.getPocketPositions?.() || [];
      // Try to find which pocket the ball went into (approximate)
      const ball = game.ballsManager?.getBall?.(ballId);
      if (ball && ball.mesh && pockets.length > 0) {
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
    // Heuristic: blend randomness with geometric difficulty
    const cueBall = game.ballsManager?.getCueBall?.();
    if (!cueBall || !cueBall.mesh) return Math.random() < 0.15;
    const pockets = game.table?.getPocketPositions?.() || [];
    if (pockets.length === 0) return Math.random() < 0.15;

    const cbPos = cueBall.mesh.position;
    // Find closest pocket distance
    let closestPocketDistSq = Infinity;
    for (const p of pockets) {
      const dx = p.x - cbPos.x;
      const dz = p.z - cbPos.z;
      const d = dx * dx + dz * dz;
      if (d < closestPocketDistSq) closestPocketDistSq = d;
    }
    const profile = game.tableProfile;
    const diagonalSq = ((profile?.width ?? 2.5) ** 2 + (profile?.depth ?? 1.25) ** 2);
    const distRatio = closestPocketDistSq / diagonalSq;
    // Higher distance = more difficult; base chance 10%, up to +20% for long shots
    const chance = 0.10 + Math.min(distRatio, 0.20);
    return Math.random() < chance;
  }

  _isLongShot(game) {
    const cueBall = game.ballsManager?.getCueBall?.();
    if (!cueBall || !cueBall.mesh) return false;
    const pockets = game.table?.getPocketPositions?.() || [];
    if (pockets.length === 0) return false;

    const cbPos = cueBall.mesh.position;
    let maxDistSq = 0;
    for (const p of pockets) {
      const dx = p.x - cbPos.x;
      const dz = p.z - cbPos.z;
      maxDistSq = Math.max(maxDistSq, dx * dx + dz * dz);
    }
    const profile = game.tableProfile;
    const diagonalSq = ((profile?.width ?? 2.5) ** 2 + (profile?.depth ?? 1.25) ** 2);
    // Long shot if cue ball is > 50% of table diagonal from the pocket
    return maxDistSq > diagonalSq * 0.25;
  }

  /** Public: trigger a foul comment. Called from Game if needed. */
  onFoul(playerNum, isScratch) {
    if (!this.active) return;
    this.commentary.onFoul(playerNum, isScratch);
    if (isScratch) {
      this.ui.showEventBadge('母球落袋', 2500);
    } else {
      this.ui.showEventBadge('犯规', 2000);
    }
  }

  /** Public: trigger a miss comment. */
  onMiss(playerNum) {
    if (!this.active) return;
    this.commentary.onMiss(playerNum);
  }

  /** Public: trigger a safety comment. */
  onSafety(playerNum) {
    if (!this.active) return;
    this.commentary.onSafety(playerNum);
  }

  dispose() {
    this.stop();
    this.camera.dispose();
    this.commentary.dispose();
    this.game = null;
    this.renderer = null;
    this._hiddenHudDisplays.clear();
    this._originalUpdateCamera = null;
    this._originalControlsEnabled = undefined;
  }
}
