import * as THREE from 'three';

const _TMP = new THREE.Vector3();
const _TMP2 = new THREE.Vector3();
const _TMP3 = new THREE.Vector3();

/**
 * InstantReplayCamera — Cinematic camera director for instant replays.
 *
 * Automatically switches between 5 camera angles based on playback progress:
 *   1. Impact (0-8%)   — close-up behind cue ball
 *   2. Action (8-35%)  — elevated follow-cam tracking cue ball
 *   3. Spread (35-65%) — overhead showing full table
 *   4. Active (65-88%) — follow the most dynamic ball
 *   5. Settle (88-100%)— wide side angle showing final layout
 */
export class InstantReplayCamera {
  constructor(camera) {
    this.camera = camera;
    this._targetPos = new THREE.Vector3();
    this._targetLook = new THREE.Vector3();
    this._currentPos = new THREE.Vector3();
    this._currentLook = new THREE.Vector3();
    this._initialized = false;
  }

  reset() {
    this._initialized = false;
  }

  update(progress, duration, ballsManager) {
    if (!this.camera || !ballsManager) return;

    this._chooseTarget(progress, duration, ballsManager);

    if (!this._initialized) {
      this._currentPos.copy(this.camera.position);
      this._currentLook.copy(this._getCurrentLook());
      this._initialized = true;
    }

    // Adaptive lerp: faster at start of phase, slower near end
    const lerpFactor = Math.min(0.12, 0.06 + progress * 0.04);
    this._currentPos.lerp(this._targetPos, lerpFactor);
    this._currentLook.lerp(this._targetLook, lerpFactor);

    this.camera.position.copy(this._currentPos);
    this.camera.lookAt(this._currentLook);
  }

  _chooseTarget(progress, duration, ballsManager) {
    const cueBall = ballsManager.getCueBall?.();
    const cuePos = (cueBall && cueBall.mesh)
      ? cueBall.mesh.position
      : _TMP.set(0, 0, 0);

    if (progress < 0.08) {
      this._impactPhase(cuePos, ballsManager);
    } else if (progress < 0.35) {
      this._actionPhase(progress, cuePos, ballsManager);
    } else if (progress < 0.65) {
      this._overheadPhase(ballsManager);
    } else if (progress < 0.88) {
      this._activePhase(progress, ballsManager);
    } else {
      this._settlePhase(ballsManager);
    }
  }

  _impactPhase(cuePos, ballsManager) {
    // Close-up from behind the cue ball, slightly elevated
    this._targetPos.set(cuePos.x, cuePos.y + 6, cuePos.z - 14);
    this._targetLook.set(cuePos.x, cuePos.y, cuePos.z + 8);
  }

  _actionPhase(progress, cuePos, ballsManager) {
    // Rising follow-cam: starts low behind cue ball, rises and pulls back
    const t = (progress - 0.08) / 0.27; // 0~1 within this phase
    const height = 18 + t * 22;
    const back = 16 + t * 28;
    this._targetPos.set(cuePos.x, cuePos.y + height, cuePos.z - back);
    this._targetLook.copy(cuePos);
  }

  _overheadPhase(ballsManager) {
    // High overhead centered on table
    this._targetPos.set(0, 100, 0.1);
    this._targetLook.set(0, 0, 0);
  }

  _activePhase(progress, ballsManager) {
    // Follow the ball that has moved furthest from center (most interesting)
    const active = this._findMostActiveBall(ballsManager);
    if (active && active.mesh) {
      const pos = active.mesh.position;
      this._targetPos.set(pos.x, pos.y + 30, pos.z - 25);
      this._targetLook.copy(pos);
    } else {
      this._overheadPhase(ballsManager);
    }
  }

  _settlePhase(ballsManager) {
    // Wide side angle showing the final table state
    this._targetPos.set(55, 35, 0);
    this._targetLook.set(0, 0, 0);
  }

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

  _getCurrentLook() {
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    return _TMP3.copy(this.camera.position).add(dir.multiplyScalar(60));
  }
}
