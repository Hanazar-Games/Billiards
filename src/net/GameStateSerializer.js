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
          avx: b.angularVelocity.x,
          avy: b.angularVelocity.y,
          avz: b.angularVelocity.z,
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
      player1Pocketed: game.rules.player1Pocketed,
      player2Pocketed: game.rules.player2Pocketed,
      breakShot: game.rules.breakShot,
      gameOver: game.rules.gameOver,
      winner: game.rules.winner,
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
        ball.body.angularVelocity.set(bs.avx ?? 0, bs.avy ?? 0, bs.avz ?? 0);
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
      if (rs.player1Pocketed !== undefined) game.rules.player1Pocketed = rs.player1Pocketed;
      if (rs.player2Pocketed !== undefined) game.rules.player2Pocketed = rs.player2Pocketed;
      if (rs.breakShot !== undefined) game.rules.breakShot = rs.breakShot;
      if (rs.gameOver !== undefined) game.rules.gameOver = rs.gameOver;
      if (rs.winner !== undefined) game.rules.winner = rs.winner;
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
