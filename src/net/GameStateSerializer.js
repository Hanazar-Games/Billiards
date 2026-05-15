import * as CANNON from 'cannon-es';

/**
 * GameStateSerializer — Serialize and deserialize game state for network sync.
 *
 * Host sends stateSnapshot every frame during shooting;
 * clients apply it to update visual positions without running physics.
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
        const b = ball.body;
        balls.push({
          id: ball.id,
          x: b.position.x,
          y: b.position.y,
          z: b.position.z,
          vx: b.velocity.x,
          vy: b.velocity.y,
          vz: b.velocity.z,
          qx: b.quaternion.x,
          qy: b.quaternion.y,
          qz: b.quaternion.z,
          qw: b.quaternion.w,
          pocketed: ball.pocketed,
          visible: ball.mesh.visible,
        });
      }
    }

    const rules = game.rules ? {
      player1Group: game.rules.player1Group,
      player2Group: game.rules.player2Group,
      breakShot: game.rules.breakShot,
      gameOver: game.rules.gameOver,
      winner: game.rules.winner,
      pocketedBalls: game.rules.pocketedBalls || [],
    } : null;

    return {
      mode: game.mode,
      state: game.state,
      currentPlayer: game.currentPlayer,
      ballInHand: game.ballInHand,
      ballInHandBehindLine: game.ballInHandBehindLine || false,
      balls,
      rules,
      message: game.ui?._lastMessage || '',
      player1Name: game.networkPlayer1Name || '玩家 1',
      player2Name: game.networkPlayer2Name || '玩家 2',
      timestamp: performance.now(),
    };
  }

  /**
   * Apply a remote snapshot to a Game instance (client-side).
   * Does NOT step physics or resolve rules — only updates visuals and UI.
   * @param {Game} game
   * @param {object} snapshot
   */
  static applyGameState(game, snapshot) {
    if (!game.ballsManager) return;

    // Update ball positions / velocities / rotations
    for (const bs of snapshot.balls) {
      const ball = game.ballsManager.getBall(bs.id);
      if (!ball) continue;

      ball.pocketed = bs.pocketed;
      ball.mesh.visible = bs.visible;

      if (!bs.pocketed) {
        ball.body.position.set(bs.x, bs.y, bs.z);
        ball.body.velocity.set(bs.vx, bs.vy, bs.vz);
        ball.body.quaternion.set(bs.qx, bs.qy, bs.qz, bs.qw);
        ball.sync();
      } else {
        // Keep pocketed balls out of the way
        ball.body.position.set(0, -1000, 0);
        ball.body.velocity.set(0, 0, 0);
        ball.body.angularVelocity.set(0, 0, 0);
      }
    }

    // Update game state fields
    if (snapshot.state !== undefined) {
      game.state = snapshot.state;
    }
    if (snapshot.currentPlayer !== undefined) {
      game.currentPlayer = snapshot.currentPlayer;
      game.ui?.setPlayerTurn(snapshot.currentPlayer);
    }
    if (snapshot.ballInHand !== undefined) {
      game.ballInHand = snapshot.ballInHand;
    }
    if (snapshot.ballInHandBehindLine !== undefined) {
      game.ballInHandBehindLine = snapshot.ballInHandBehindLine;
    }

    // Update rules state
    if (snapshot.rules && game.rules) {
      const rs = snapshot.rules;
      if (rs.player1Group !== undefined) game.rules.player1Group = rs.player1Group;
      if (rs.player2Group !== undefined) game.rules.player2Group = rs.player2Group;
      if (rs.breakShot !== undefined) game.rules.breakShot = rs.breakShot;
      if (rs.gameOver !== undefined) game.rules.gameOver = rs.gameOver;
      if (rs.winner !== undefined) game.rules.winner = rs.winner;
      if (rs.pocketedBalls !== undefined) game.rules.pocketedBalls = rs.pocketedBalls;
    }

    // Update UI labels for networked names
    if (snapshot.player1Name) game.networkPlayer1Name = snapshot.player1Name;
    if (snapshot.player2Name) game.networkPlayer2Name = snapshot.player2Name;

    // Refresh player stats / groups HUD
    game._updatePlayerStats?.();

    // Show message if changed
    if (snapshot.message && game.ui && snapshot.message !== game.ui._lastMessage) {
      game.ui.setMessage(snapshot.message);
    }

    // Update cue visibility based on state
    if (game.state === 'AIM' || game.state === 'CHARGING') {
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
