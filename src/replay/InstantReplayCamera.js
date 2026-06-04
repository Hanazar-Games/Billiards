import * as THREE from 'three';
import { settings } from '../core/SettingsStore.js';

const _TMP = new THREE.Vector3();
const _TMP2 = new THREE.Vector3();
const _TMP3 = new THREE.Vector3();

/**
 * InstantReplayCamera — Cinematic camera director for instant replays.
 *
 * Automatically switches between cinematic angles based on playback progress
 * and shot metadata (pockets, collisions, cushions).
 *
 * Phases:
 *   1. Impact    (0-5%)   — dramatic close-up behind cue ball
 *   2. Action    (5-30%)  — follow cue ball; collision-aware side angles
 *   3. Target    (30-60%) — track the first-hit object ball
 *   4. Pocket    (60-85%) — close-up on pocket if a ball is sinking
 *   5. Settle    (85-100%)— wide angle showing final layout
 *
 * Respects reducedMotion: fewer cuts, gentler movement.
 */
export class InstantReplayCamera {
  constructor(camera) {
    this.camera = camera;
    this._targetPos = new THREE.Vector3();
    this._targetLook = new THREE.Vector3();
    this._currentPos = new THREE.Vector3();
    this._currentLook = new THREE.Vector3();
    this._initialized = false;
    this._metadata = null;
    this._reducedMotion = false;
    // Cached analysis
    this._hasPockets = false;
    this._hasCollisions = false;
    this._hasCushions = false;
    this._pocketedBallIds = [];
  }

  /** Provide replay metadata so camera can plan dramatic moments. */
  setReplayData(replayData) {
    this._metadata = replayData?.metadata || null;
    this._reducedMotion = !!settings.get('reducedMotion');
    this._hasPockets = (this._metadata?.pocketedIds?.length || 0) > 0;
    this._hasCollisions = (this._metadata?.collisionCount || 0) > 0;
    this._hasCushions = (this._metadata?.cushionCount || 0) > 0;
    this._pocketedBallIds = this._metadata?.pocketedIds?.filter(id => id !== 0) || [];
  }

  reset() {
    this._initialized = false;
    this._metadata = null;
    this._pocketedBallIds = [];
  }

  update(progress, duration, ballsManager) {
    if (!this.camera || !ballsManager) return;

    this._chooseTarget(progress, duration, ballsManager);

    if (!this._initialized) {
      this._currentPos.copy(this.camera.position);
      this._currentLook.copy(this._getCurrentLook());
      this._initialized = true;
    }

    // reducedMotion: slower, gentler camera work
    const baseLerp = this._reducedMotion ? 0.04 : 0.08;
    const lerpFactor = Math.min(baseLerp + 0.04, baseLerp + progress * 0.04);
    this._currentPos.lerp(this._targetPos, lerpFactor);
    this._currentLook.lerp(this._targetLook, lerpFactor);

    this.camera.position.copy(this._currentPos);
    this.camera.lookAt(this._targetLook);
  }

  _chooseTarget(progress, duration, ballsManager) {
    const cueBall = ballsManager.getCueBall?.();
    const cuePos = (cueBall && cueBall.mesh)
      ? cueBall.mesh.position
      : _TMP.set(0, 0, 0);

    if (this._reducedMotion) {
      // Stable, minimal cuts: overhead + occasional follow
      this._reducedMotionPhase(progress, cuePos, ballsManager);
      return;
    }

    // Normal cinematic switching
    if (progress < 0.05) {
      this._impactPhase(cuePos, ballsManager);
    } else if (progress < 0.30) {
      this._actionPhase(progress, cuePos, ballsManager);
    } else if (progress < 0.60) {
      this._targetBallPhase(progress, ballsManager);
    } else if (progress < 0.85) {
      this._pocketPhase(progress, ballsManager);
    } else {
      this._settlePhase(ballsManager);
    }
  }

  /* ─── Reduced-motion variant ─── */
  _reducedMotionPhase(progress, cuePos, ballsManager) {
    if (progress < 0.15) {
      // Start behind cue ball, then gently pull back
      this._targetPos.set(cuePos.x, cuePos.y + 22, cuePos.z - 35);
      this._targetLook.copy(cuePos);
    } else if (progress < 0.70) {
      // Stable overhead
      this._overheadPhase(ballsManager);
    } else if (this._hasPockets && progress < 0.90) {
      // Gentle pocket close-up
      this._pocketPhase(progress, ballsManager);
    } else {
      this._settlePhase(ballsManager);
    }
  }

  /* ─── Normal cinematic phases ─── */

  _impactPhase(cuePos, ballsManager) {
    // Dramatic low close-up from behind cue ball
    this._targetPos.set(cuePos.x, cuePos.y + 4, cuePos.z - 12);
    this._targetLook.set(cuePos.x, cuePos.y + 1, cuePos.z + 6);
  }

  _actionPhase(progress, cuePos, ballsManager) {
    const t = (progress - 0.05) / 0.25; // 0~1 within this phase

    if (this._hasCollisions && this._metadata.collisionCount >= 4 && t < 0.5) {
      // Dramatic side angle for heavy collision shots
      const side = 1; // fixed side for stability within a single phase
      this._targetPos.set(cuePos.x + side * 55, cuePos.y + 28, cuePos.z);
      this._targetLook.copy(cuePos);
    } else {
      // Rising follow-cam tracking cue ball
      const height = 16 + t * 24;
      const back = 14 + t * 32;
      this._targetPos.set(cuePos.x, cuePos.y + height, cuePos.z - back);
      this._targetLook.copy(cuePos);
    }
  }

  _targetBallPhase(progress, ballsManager) {
    // Try to track the object ball that was first hit (heuristic: most moved non-cue)
    const target = this._findFirstHitBall(ballsManager);
    if (target && target.mesh) {
      const pos = target.mesh.position;
      // Slightly elevated tracking from behind the moving ball
      const vel = _TMP2.set(
        pos.x - (target._lastX ?? pos.x),
        0,
        pos.z - (target._lastZ ?? pos.z)
      );
      const speed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
      const backOffset = speed > 0.01 ? vel.normalize().multiplyScalar(28) : _TMP2.set(0, 0, -28);
      this._targetPos.set(pos.x - backOffset.x, pos.y + 26, pos.z - backOffset.z);
      this._targetLook.copy(pos);
      target._lastX = pos.x;
      target._lastZ = pos.z;
    } else {
      this._overheadPhase(ballsManager);
    }
  }

  _pocketPhase(progress, ballsManager) {
    // If we know a ball was pocketed, do a close-up on the pocket
    if (this._pocketedBallIds.length > 0) {
      const targetBall = this._findPocketedBall(ballsManager);
      if (targetBall && targetBall.mesh) {
        const pos = targetBall.mesh.position;
        this._targetPos.set(pos.x, pos.y + 18, pos.z - 20);
        this._targetLook.set(pos.x, pos.y + 2, pos.z + 5);
        return;
      }
    }
    // Fallback: active ball or overhead
    const active = this._findMostActiveBall(ballsManager);
    if (active && active.mesh) {
      const pos = active.mesh.position;
      this._targetPos.set(pos.x, pos.y + 22, pos.z - 22);
      this._targetLook.copy(pos);
    } else {
      this._overheadPhase(ballsManager);
    }
  }

  _overheadPhase(ballsManager) {
    // High overhead centered on table
    this._targetPos.set(0, 100, 0.1);
    this._targetLook.set(0, 0, 0);
  }

  _settlePhase(ballsManager) {
    // Wide side angle showing the final table state
    // Alternate side based on cue ball position for variety
    const cueBall = ballsManager.getCueBall?.();
    const side = (cueBall && cueBall.mesh && cueBall.mesh.x > 0) ? -1 : 1;
    this._targetPos.set(side * 65, 40, 0);
    this._targetLook.set(0, 0, 0);
  }

  /* ─── Helpers ─── */

  _findMostActiveBall(ballsManager) {
    let furthest = null;
    let maxDist = 0;
    const balls = ballsManager.balls || [];
    for (const ball of balls) {
      if (!ball || !ball.mesh || !ball.mesh.visible) continue;
      const pos = ball.mesh.position;
      const dist = pos.x * pos.x + pos.z * pos.z;
      if (dist > maxDist) {
        maxDist = dist;
        furthest = ball;
      }
    }
    return furthest;
  }

  /** Heuristic: the non-cue ball that has moved furthest from its likely rack position. */
  _findFirstHitBall(ballsManager) {
    let best = null;
    let maxDist = 0;
    const balls = ballsManager.balls || [];
    for (const ball of balls) {
      if (!ball || ball.id === 0 || !ball.mesh || !ball.mesh.visible) continue;
      const pos = ball.mesh.position;
      const dist = pos.x * pos.x + pos.z * pos.z;
      if (dist > maxDist) {
        maxDist = dist;
        best = ball;
      }
    }
    return best;
  }

  _findPocketedBall(ballsManager) {
    if (!this._pocketedBallIds.length) return null;
    // Try to find the first pocketed ball that is still visible (not yet hidden)
    for (const id of this._pocketedBallIds) {
      const ball = ballsManager.getBall?.(id);
      if (ball && ball.mesh && ball.mesh.visible) return ball;
    }
    // Fallback: last pocketed ball
    return ballsManager.getBall?.(this._pocketedBallIds[this._pocketedBallIds.length - 1]);
  }

  _getCurrentLook() {
    const dir = _TMP.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    return _TMP3.copy(this.camera.position).add(dir.multiplyScalar(60));
  }
}
