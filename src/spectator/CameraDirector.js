import * as THREE from 'three';
import { animMs } from '../core/AnimSpeed.js';
import { CAMERA } from '../config.js';

/**
 * CameraDirector — Cinematic broadcast camera system for Spectator Mode.
 *
 * Provides multiple camera angles with smooth auto-switching based on game state:
 *   - broadcast   : auto-picks the best angle for current phase
 *   - overhead    : top-down tactical view
 *   - follow-ball : tracks the cue ball
 *   - pocket      : close-up on target pocket (used for predicted shots)
 *   - free        : dramatic orbit around the table
 *   - player      : behind-the-shoulder of current player
 */

export const CAMERA_MODE = {
  BROADCAST: 'broadcast',
  OVERHEAD: 'overhead',
  FOLLOW_BALL: 'follow-ball',
  POCKET: 'pocket',
  FREE: 'free',
  PLAYER: 'player',
};

export class CameraDirector {
  constructor(renderer) {
    this.renderer = renderer;
    this.camera = renderer.camera;
    this.scene = renderer.scene;

    this.mode = CAMERA_MODE.BROADCAST;
    this._targetPos = new THREE.Vector3();
    this._targetLook = new THREE.Vector3();
    this._currentPos = new THREE.Vector3().copy(this.camera.position);
    this._currentLook = new THREE.Vector3(0, 0, 0);
    this._transitionSpeed = 2.5; // lerp factor per second
    this._modeTimer = 0;
    this._phase = 'idle'; // idle | aim | shooting | resolving

    // Pocket close-up state
    this._pocketTarget = null;
    this._pocketTimer = 0;

    // Free orbit state
    this._freeAngle = 0;
    this._freeRadius = 350;
    this._freeHeight = 160;

    // Cached table dimensions (set externally)
    this.tableHalfWidth = 127;
    this.tableHalfDepth = 254;

    // Smoothing
    this._velocityPos = new THREE.Vector3();
    this._velocityLook = new THREE.Vector3();
    this._smoothTime = 0.35;

    this._tmpVec3 = new THREE.Vector3();
    this._tmpVec3b = new THREE.Vector3();
    this._tmpVec3c = new THREE.Vector3();
  }

  setTableDimensions(halfWidth, halfDepth) {
    this.tableHalfWidth = halfWidth;
    this.tableHalfDepth = halfDepth;
  }

  /** Called when game phase changes. */
  setPhase(phase, data = {}) {
    if (this._phase === phase) return;
    this._phase = phase;
    this._modeTimer = 0;

    if (this.mode === CAMERA_MODE.BROADCAST) {
      this._pickBroadcastMode(phase, data);
    }
  }

  _pickBroadcastMode(phase, data) {
    switch (phase) {
      case 'aim':
        // 70% player-view, 30% overhead
        this._setInternalMode(Math.random() < 0.7 ? CAMERA_MODE.PLAYER : CAMERA_MODE.OVERHEAD);
        break;
      case 'shooting':
        this._setInternalMode(CAMERA_MODE.FOLLOW_BALL);
        break;
      case 'resolving':
        if (data.pocketIndex !== undefined && data.pocketIndex >= 0) {
          this._setInternalMode(CAMERA_MODE.POCKET, data);
        } else {
          this._setInternalMode(CAMERA_MODE.OVERHEAD);
        }
        break;
      case 'idle':
      default:
        this._setInternalMode(CAMERA_MODE.FREE);
        break;
    }
  }

  _setInternalMode(mode, data = {}) {
    this._internalMode = mode;
    if (mode === CAMERA_MODE.POCKET && data.pocketIndex !== undefined) {
      this._pocketTarget = data.pocketIndex;
      this._pocketTimer = 2.5;
    }
  }

  /** Update camera position based on current mode and game state. */
  update(dt, game) {
    if (!game || !game.ballsManager) return;
    this._modeTimer += dt;

    const cueBall = game.ballsManager.getCueBall();
    const cueBallPos = cueBall ? cueBall.mesh.position : this._tmpVec3.set(0, 0, 0);

    // Compute desired position and look-at based on mode
    const desiredPos = this._tmpVec3b;
    const desiredLook = this._tmpVec3c;
    desiredLook.set(0, 0, 0);

    const activeMode = this.mode === CAMERA_MODE.BROADCAST ? (this._internalMode || CAMERA_MODE.FREE) : this.mode;

    switch (activeMode) {
      case CAMERA_MODE.OVERHEAD:
        desiredPos.set(0, Math.max(this.tableHalfDepth * 1.2, 280), 0);
        desiredLook.set(0, 0, 0);
        break;

      case CAMERA_MODE.FOLLOW_BALL: {
        const target = cueBallPos;
        const height = 45;
        const backOffset = 80;
        const sideOffset = 30;
        desiredPos.set(
          target.x + sideOffset,
          target.y + height,
          target.z + backOffset
        );
        desiredLook.copy(target);
        break;
      }

      case CAMERA_MODE.POCKET: {
        const pockets = game.table?.getPocketPositions?.() || [];
        const idx = this._pocketTarget ?? 0;
        const pocket = pockets[idx] || { x: 0, y: 0, z: 0 };
        const height = 60;
        const offset = 50;
        // Position slightly above and offset from pocket center
        desiredPos.set(pocket.x + offset, pocket.y + height, pocket.z + offset);
        desiredLook.set(pocket.x, pocket.y + 5, pocket.z);
        this._pocketTimer -= dt;
        if (this._pocketTimer <= 0 && this.mode === CAMERA_MODE.BROADCAST) {
          this._setInternalMode(CAMERA_MODE.FREE);
        }
        break;
      }

      case CAMERA_MODE.PLAYER: {
        // Behind-the-shoulder of the cue ball, looking down the aim direction
        const aimDir = game.aimDirection || new THREE.Vector3(0, 0, 1);
        const behind = aimDir.clone().negate().multiplyScalar(90);
        const height = 35;
        desiredPos.set(
          cueBallPos.x + behind.x,
          cueBallPos.y + height,
          cueBallPos.z + behind.z
        );
        desiredLook.set(
          cueBallPos.x + aimDir.x * 60,
          cueBallPos.y,
          cueBallPos.z + aimDir.z * 60
        );
        break;
      }

      case CAMERA_MODE.FREE:
      default: {
        this._freeAngle += dt * 0.15;
        const radius = this._freeRadius + Math.sin(this._freeAngle * 0.7) * 40;
        const height = this._freeHeight + Math.sin(this._freeAngle * 0.5) * 30;
        desiredPos.set(
          Math.cos(this._freeAngle) * radius,
          height,
          Math.sin(this._freeAngle) * radius
        );
        desiredLook.set(0, 0, 0);
        break;
      }
    }

    // Smooth damping toward desired position (spring-like)
    this._smoothDampVector(this._currentPos, desiredPos, this._velocityPos, this._smoothTime, dt);
    this._smoothDampVector(this._currentLook, desiredLook, this._velocityLook, this._smoothTime * 0.8, dt);

    // Apply
    this.camera.position.copy(this._currentPos);
    this.camera.lookAt(this._currentLook);

    // Update renderer matrices
    this.camera.updateMatrixWorld();
  }

  _smoothDampVector(current, target, velocity, smoothTime, dt) {
    const omega = 2.0 / Math.max(smoothTime, 0.001);
    const x = omega * dt;
    const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    const dx = current.x - target.x;
    const dy = current.y - target.y;
    const dz = current.z - target.z;
    const vx = velocity.x;
    const vy = velocity.y;
    const vz = velocity.z;

    const changeX = (vx + omega * dx) * dt;
    const changeY = (vy + omega * dy) * dt;
    const changeZ = (vz + omega * dz) * dt;

    velocity.x = (vx - omega * changeX) * exp;
    velocity.y = (vy - omega * changeY) * exp;
    velocity.z = (vz - omega * changeZ) * exp;

    current.x = target.x + (dx + changeX) * exp;
    current.y = target.y + (dy + changeY) * exp;
    current.z = target.z + (dz + changeZ) * exp;
  }

  /** Trigger a pocket close-up (for broadcast mode). */
  showPocketCloseUp(pocketIndex) {
    if (this.mode !== CAMERA_MODE.BROADCAST) return;
    this._setInternalMode(CAMERA_MODE.POCKET, { pocketIndex });
    this._modeTimer = 0;
  }

  /** Reset to free orbit when returning to menu. */
  reset() {
    this._velocityPos.set(0, 0, 0);
    this._velocityLook.set(0, 0, 0);
    this._freeAngle = 0;
    this._pocketTarget = null;
  }

  dispose() {
    this.reset();
  }
}
