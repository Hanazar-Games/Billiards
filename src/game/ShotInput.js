/**
 * ShotInput — Unified shot input representation for local creation
 * and remote application.  Extracted from Game.js to prepare for
 * networked play where the same input must be sent over the wire.
 */

import { UIText } from '../core/UIText.js';
import { BALL, SHOT } from '../config.js';

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
  if (game.networkMode && input.fromPlayer !== game.currentPlayer) return false;

  // State guards: only accept input during valid gameplay states
  if (game.state === 'GAME_OVER' || game.state === 'DISPOSED') return false;
  if (game.paused || !['AIM', 'CHARGING'].includes(game.state)) return false;
  if (game._turnTimerEnabled && game._turnTimerRemaining <= 0) return false;

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
      if (!Number.isFinite(pos.x) || !Number.isFinite(pos.z)) return false;
      const isLegal = game.isCueBallPlacementLegal(
        pos.x, pos.z, game.ballInHandBehindLine
      );
      if (isLegal) {
        cueBall.setPosition(pos.x, BALL.radius, pos.z);
        game._endBallInHand();
      } else {
        game.ui?.setMessage('对手自由球位置无效，已拒绝。', 2000);
        return false;
      }
    }
    game._broadcastSnapshot();
    return true;
  }

  // Normal shot — guard against push-out pending and wrong state
  if (game.ballInHand) return false;
  if (game.rules?.pushOutPending) {
    game.ui?.setMessage(UIText.pushOutMustChoose, 2000);
    return false;
  }
  if (game.state !== 'AIM' && game.state !== 'CHARGING') return false;

  const aim = input.aimDirection;
  const sx = input.cueTipOffset?.x ?? 0;
  const sy = input.cueTipOffset?.y ?? 0;
  if (!aim || ![aim.x, aim.z, input.power, sx, sy].every(Number.isFinite)) return false;
  const length = Math.hypot(aim.x, aim.z);
  if (!Number.isFinite(length) || length === 0 || input.power <= 0) return false;
  game.aimDirection.set(aim.x / length, 0, aim.z / length);
  const spinLength = Math.max(1, Math.hypot(sx, sy));
  game.cueTipOffset = { x: sx / spinLength, y: sy / spinLength };
  game.power = Math.min(SHOT.maxPower, input.power);
  game.lockedAimDirection.copy(game.aimDirection);

  const cueBall = game.ballsManager?.getCueBall();
  if (cueBall) {
    game.cue?.setAim(cueBall.mesh.position, game.aimDirection);
  }
  game.state = 'SHOOTING';
  game.ui?.setHUDState?.('SHOOTING');
  game._shotStartTime = performance.now();
  game.shoot();
  return true;
}
