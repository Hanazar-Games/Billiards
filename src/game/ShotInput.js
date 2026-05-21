/**
 * ShotInput — Unified shot input representation for local creation
 * and remote application.  Extracted from Game.js to prepare for
 * networked play where the same input must be sent over the wire.
 */

import { UIText } from '../core/UIText.js';

export function createShotInput(game) {
  return {
    aimDirection: {
      x: game.aimDirection.x,
      y: game.aimDirection.y,
      z: game.aimDirection.z,
    },
    power: game.power,
    cueTipOffset: { x: game.cueTipOffset.x, y: game.cueTipOffset.y },
  };
}

/**
 * Applies a remote shot input to a Game instance.
 * This is the host-side entry point for executing a shot that was
 * originally created on a client.
 */
export function applyShotInput(game, input) {
  if (!input || typeof input !== 'object') return false;

  // State guards: only accept input during valid gameplay states
  if (game.state === 'GAME_OVER' || game.state === 'DISPOSED') return false;

  // Reset request
  if (input.requestReset) {
    game._onResetButtonClicked();
    return true;
  }

  // Ball placement (free ball)
  if (input.ballPlacement) {
    if (!game.ballInHand) {
      game.ui?.setMessage('Invalid: not ball-in-hand', 2000);
      return false;
    }
    const cueBall = game.ballsManager?.getCueBall();
    if (cueBall) {
      const pos = input.ballPlacement;
      const isLegal = game.isCueBallPlacementLegal(
        pos.x, pos.z, game.ballInHandBehindLine
      );
      if (isLegal) {
        cueBall.setPosition(pos.x, pos.y, pos.z);
        game._endBallInHand();
      } else {
        game.ui?.setMessage('对手自由球位置无效，已拒绝。', 2000);
      }
    }
    game._broadcastSnapshot();
    return true;
  }

  // Normal shot — guard against push-out pending and wrong state
  if (game.rules?.pushOutPending) {
    game.ui?.setMessage(UIText.pushOutMustChoose, 2000);
    return false;
  }
  if (game.state !== 'AIM' && game.state !== 'CHARGING') return false;

  // Turn validation for networked games
  if (input.fromPlayer && input.fromPlayer !== game.currentPlayer) return false;

  if (input.aimDirection) {
    game.aimDirection
      .set(input.aimDirection.x || 0, 0, input.aimDirection.z || 0)
      .normalize();
  }
  game.cueTipOffset = {
    x: input.cueTipOffset?.x || 0,
    y: input.cueTipOffset?.y || 0,
  };
  game.power = input.power || 0;
  game.lockedAimDirection.copy(game.aimDirection);

  const cueBall = game.ballsManager?.getCueBall();
  if (cueBall) {
    game.cue?.setAim(cueBall.mesh.position, game.aimDirection);
  }
  game.state = 'SHOOTING';
  game._shotStartTime = performance.now();
  game.shoot();
  return true;
}
