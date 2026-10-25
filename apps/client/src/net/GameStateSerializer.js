import { settings } from '../core/SettingsStore.js';
import { UIText } from '../core/UIText.js';

/**
 * GameStateSerializer — Serialize and deserialize game state for network sync.
 *
 * Host sends stateSnapshot every frame during shooting;
 * clients apply it to update visual positions without simulating.
 * Balls travel as mesh poses (position + quaternion): the host plays each
 * shot back from its trajectory, so the meshes are where the balls are.
 */
export class GameStateSerializer {
  /**
   * Extract a compact snapshot from a Game instance.
   * @param {Game} game
   * @returns {object}
   */
  static serializeGameState(game) {
    const balls = [];
    if (game.ballsManager) {
      for (const ball of game.ballsManager.balls) {
        const p = ball.mesh.position;
        const q = ball.mesh.quaternion;
        balls.push({
          id: ball.id,
          x: p.x,
          y: p.y,
          z: p.z,
          qx: q.x,
          qy: q.y,
          qz: q.z,
          qw: q.w,
          pocketed: ball.pocketed,
          visible: ball.mesh.visible,
        });
      }
    }

    const rules = game.rules ? {
      player1Group: game.rules.player1Group,
      player2Group: game.rules.player2Group,
      player1Pocketed: game.rules.player1Pocketed,
      player2Pocketed: game.rules.player2Pocketed,
      breakShot: game.rules.breakShot,
      gameOver: game.rules.gameOver,
      winner: game.rules.winner,
      foul: game.rules.foul,
      pocketedBalls: game.rules.pocketedBalls || [],
      player1ConsecutiveFouls: game.rules.player1ConsecutiveFouls,
      player2ConsecutiveFouls: game.rules.player2ConsecutiveFouls,
      pushOutAvailable: game.rules.pushOutAvailable,
      pushOutDeclared: game.rules.pushOutDeclared,
      pushOutPending: game.rules.pushOutPending,
      pushOutPlayer: game.rules.pushOutPlayer,
    } : null;

    return {
      mode: game.mode,
      tableProfileId: game.tableProfileId || 'pool9ft',
      state: game.state,
      rackId: game._rackId ?? 0,
      currentPlayer: game.currentPlayer,
      ballInHand: game.ballInHand,
      ballInHandBehindLine: game.ballInHandBehindLine || false,
      paused: Boolean(game.paused),
      turnTimer: { enabled: Boolean(game._turnTimerEnabled), max: game._turnTimerMax || 0,
        remaining: game._turnTimerRemaining || 0 },
      shotPower: game._lastShotPower || 0,
      stats: game.statsTracker?.getSummary(game.rules?.winner) || null,
      balls,
      rules,
      message: game.ui?._lastMessage || '',
      player1Name: game.networkPlayer1Name || '玩家 1',
      player2Name: game.networkPlayer2Name || '玩家 2',
      timestamp: performance.now(),
      fairness: game._hostFairness || {
        trajectoryEnabled: settings.get('trajectoryEnabled'),
        minimapEnabled: settings.get('minimapEnabled'),
        turnTimer: settings.get('turnTimer'),
        shotPowerSens: settings.get('shotPowerSens'),
        showCrosshair: settings.get('showCrosshair'),
      },
    };
  }

  /**
   * Apply a remote snapshot to a Game instance (client-side).
   * Does NOT simulate a shot or resolve rules — only updates visuals and UI.
   * @param {Game} game
   * @param {object} snapshot
   */
  static applyGameState(game, snapshot) {
    if (!game.ballsManager) return;
    const previousState = game.state;
    const hadBallInHand = game.ballInHand;
    const newRack = Number.isInteger(snapshot.rackId) && snapshot.rackId !== (game._rackId ?? 0);
    if (newRack) {
      game._rackId = snapshot.rackId;
      game._pendingShotNumber = null;
      game.paused = false;
      game._pausedAt = null;
      game._settingsOpen = false;
      game.inGameSettings?.hide();
      game.ui?.hidePauseMenu?.();
      game.ui?.hideResetButton?.();
      game.ui?.clearMessage?.();
      game.statsPanel?.reset?.();
      game.recorder?.reset();
      game.trails?.clear();
      game.particles?.clear();
      game.shockwaves?.clear();
      game.screenShake?.cancel();
      game.cueTipOffset = { x: 0, y: 0 };
      game._updateCueTipPicker?.();
    }
    const keepPlacement = !newRack && hadBallInHand && snapshot.ballInHand &&
      game.currentPlayer === game.localPlayerId && snapshot.currentPlayer === game.currentPlayer && !snapshot.paused;
    const keepCharge = !newRack && game.state === 'CHARGING' && snapshot.state === 'AIM' &&
      snapshot.currentPlayer === game.currentPlayer && game.currentPlayer === game.localPlayerId &&
      !snapshot.ballInHand && !snapshot.paused;

    // Guard against table profile mismatches in networked games.
    // The host's choice is authoritative; if we somehow initialised
    // with a different profile, warn so the dev can investigate.
    if (snapshot.tableProfileId && game.tableProfileId &&
        snapshot.tableProfileId !== game.tableProfileId) {
      console.warn(
        '[GameStateSerializer] Table profile mismatch: host=%s client=%s',
        snapshot.tableProfileId, game.tableProfileId
      );
    }

    // Update ball poses (a pocketed ball is hidden where it is)
    for (const bs of snapshot.balls) {
      const ball = game.ballsManager.getBall(bs.id);
      if (!ball) continue;
      if (bs.id === 0 && keepPlacement) continue;

      ball.pocketed = bs.pocketed;
      ball.mesh.visible = bs.visible;

      if (!bs.pocketed) {
        ball.mesh.position.set(bs.x, bs.y, bs.z);
        ball.mesh.quaternion.set(bs.qx, bs.qy, bs.qz, bs.qw);
      }
    }

    // Update game state fields
    const ALLOWED_STATES = new Set(['AIM','CHARGING','SHOOTING','AI_THINKING','GAME_OVER','REPLAYING','BALL_IN_HAND','DISPOSED']);
    const pendingShot = !newRack && game.state === 'SHOOTING' && snapshot.state === 'AIM' &&
      game.currentPlayer === game.localPlayerId && snapshot.currentPlayer === game.currentPlayer &&
      !snapshot.ballInHand && !snapshot.paused && snapshot.stats?.totalTurns < game._pendingShotNumber;
    if (!pendingShot) game._pendingShotNumber = null;
    if (!keepCharge && !pendingShot && snapshot.state !== undefined && ALLOWED_STATES.has(snapshot.state)) {
      game.state = snapshot.state;
      if (newRack || previousState !== game.state) {
        game.charging = false;
        game.dragStart = null;
        game.directPullAim = false;
        game.power = 0;
        game.ui?.setPower?.(0);
      }
    }
    if (snapshot.currentPlayer !== undefined) {
      game.currentPlayer = snapshot.currentPlayer;
      if (game.rules) game.rules.currentPlayer = snapshot.currentPlayer;
      game.ui?.setPlayerTurn(snapshot.currentPlayer);
    }
    if (snapshot.ballInHand !== undefined) {
      if (snapshot.ballInHand && !game.ballInHand) game.ballInHandValid = false;
      game.ballInHand = snapshot.ballInHand;
    }
    if (snapshot.ballInHandBehindLine !== undefined) {
      game.ballInHandBehindLine = snapshot.ballInHandBehindLine;
    }
    game._hostPaused = Boolean(snapshot.paused);
    if (snapshot.turnTimer) {
      game._turnTimerEnabled = snapshot.turnTimer.enabled === true;
      game._turnTimerMax = Math.max(0, snapshot.turnTimer.max);
      game._turnTimerRemaining = Math.max(0, Math.min(game._turnTimerMax, snapshot.turnTimer.remaining));
    }
    game.ui?.setHUDState?.(game.ballInHand ? 'BALL_IN_HAND' : game.state);

    // Update rules state
    if (snapshot.rules && game.rules) {
      const rs = snapshot.rules;
      if (rs.player1Group !== undefined) game.rules.player1Group = rs.player1Group;
      if (rs.player2Group !== undefined) game.rules.player2Group = rs.player2Group;
      if (rs.player1Pocketed !== undefined) game.rules.player1Pocketed = rs.player1Pocketed;
      if (rs.player2Pocketed !== undefined) game.rules.player2Pocketed = rs.player2Pocketed;
      if (rs.breakShot !== undefined) game.rules.breakShot = rs.breakShot;
      if (rs.gameOver !== undefined) game.rules.gameOver = rs.gameOver;
      if (rs.winner !== undefined) game.rules.winner = rs.winner;
      if (rs.foul !== undefined) game.rules.foul = rs.foul;
      if (rs.pocketedBalls !== undefined) game.rules.pocketedBalls = rs.pocketedBalls;
      if (rs.player1ConsecutiveFouls !== undefined) game.rules.player1ConsecutiveFouls = rs.player1ConsecutiveFouls;
      if (rs.player2ConsecutiveFouls !== undefined) game.rules.player2ConsecutiveFouls = rs.player2ConsecutiveFouls;
      if (rs.pushOutAvailable !== undefined) game.rules.pushOutAvailable = rs.pushOutAvailable;
      if (rs.pushOutDeclared !== undefined) game.rules.pushOutDeclared = rs.pushOutDeclared;
      if (rs.pushOutPending !== undefined) game.rules.pushOutPending = rs.pushOutPending;
      if (rs.pushOutPlayer !== undefined) game.rules.pushOutPlayer = rs.pushOutPlayer;
    }

    // Update UI labels for networked names
    if (snapshot.player1Name) game.networkPlayer1Name = snapshot.player1Name;
    if (snapshot.player2Name) game.networkPlayer2Name = snapshot.player2Name;

    // Refresh player stats / groups HUD
    game._updatePlayerStats?.();

    if (snapshot.stats && game.statsTracker) {
      const stats = snapshot.stats;
      game.statsTracker.playerStats = { 1: stats.player1, 2: stats.player2 };
      game.statsTracker.totalTurns = stats.totalTurns;
      game.statsTracker.matchStats = stats.match;
      game.statsTracker.gameStartTime = performance.now() - stats.duration * 1000;
      game.statsTracker.gameEndTime = game.state === 'GAME_OVER' ? performance.now() : null;
      game.gameStartTime = game.statsTracker.gameStartTime;
      game.statsPanel?.update(game.statsTracker.getLiveStats());
    }
    if (game.state !== previousState && game.state === 'SHOOTING') {
      game.audio?.playCueHit(snapshot.shotPower);
    }
    if (game.state === 'GAME_OVER' && previousState !== 'GAME_OVER') {
      if (snapshot.rules?.winner === game.localPlayerId) game.audio?.playWin();
      else game.audio?.playFoul();
      if (snapshot.stats) game.statsPanel?.showGameOver(snapshot.stats, false);
      game.ui?.showResetButton?.(() => game._onResetButtonClicked(), UIText.gameOverResetLabel);
    } else if (game.ballInHand && !hadBallInHand) {
      game.audio?.playFoul();
    }

    // Show message if changed
    const message = snapshot.paused ? '房主已暂停，等待继续…' : (snapshot.message || '');
    if (game.ui && message !== game.ui._lastMessage) {
      game.ui.clearMessage?.();
      game.ui.setMessage?.(message, 0, game.state === 'GAME_OVER' ? 3 : 1);
    }

    // Update cue visibility based on state
    if (game.ballInHand) {
      game.cue?.hide();
    } else if (game.state === 'AIM' || game.state === 'CHARGING') {
      game.cue?.show();
    } else if (game.state === 'SHOOTING' || game.state === 'GAME_OVER') {
      game.cue?.hide();
    }

    // Camera follow update
    if (game.cameraMode === 'follow' && game.ballsManager) {
      game._updateCamera?.();
    }
  }
}
