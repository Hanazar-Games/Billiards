/**
 * ScreenShake — Camera shake on powerful shots.
 *
 * Applies a short-duration positional jitter to the camera based on
 * shot power.  The shake vector is mostly perpendicular to the shot
 * direction so it feels like the table is rattling rather than sliding.
 *
 * Design: we compute an offset every frame and ADD it to the current
 * camera position.  When the shake ends we smoothly decay the offset
 * to zero rather than snapping back to a stale original position.
 */
import * as THREE from 'three';
import { settings } from '../core/SettingsStore.js';

const _UP = new THREE.Vector3(0, 1, 0);

export class ScreenShake {
  constructor(camera) {
    this.camera = camera;
    this.active = false;
    this.age = 0;
    this.duration = 0;
    this.intensity = 0;
    this._currentOffset = new THREE.Vector3();
    this._tmpOffset = new THREE.Vector3();
    this._perpA = new THREE.Vector3();
    this._perpB = new THREE.Vector3();
  }

  /**
   * Trigger a camera shake.
   * @param {number} power — shot power (0 … SHOT.maxPower)
   * @param {THREE.Vector3} direction — shot direction (normalized)
   */
  trigger(power, direction) {
    const maxPower = 82;
    const t = Math.min(power / maxPower, 1.0);

    const shakeScale = settings.get('screenShakeIntensity') ?? 1.0;
    // Prevent drift: subtract any existing offset before starting a new shake
    if (this.active) {
      this.camera.position.sub(this._currentOffset);
    }
    this.active = true;
    this.age = 0;
    this.duration = (0.18 + t * 0.35) * shakeScale; // 0.18s … 0.53s
    this.intensity = (0.3 + t * 2.2) * shakeScale;  // 0.3 … 2.5 units
    this._currentOffset.set(0, 0, 0);

    // Build two perpendicular axes for shake
    this._perpA.copy(direction).cross(_UP).normalize();
    if (this._perpA.lengthSq() < 0.001) {
      this._perpA.set(1, 0, 0);
    }
    this._perpB.crossVectors(this._perpA, direction).normalize();
  }

  /**
   * Update shake. Call every frame.
   * @param {number} dt — delta time in seconds
   */
  update(dt) {
    if (!this.active || !this.camera) return;

    this.age += dt;
    if (this.duration <= 0 || !isFinite(this.duration)) {
      this.active = false;
      this.camera.position.sub(this._currentOffset);
      this._currentOffset.set(0, 0, 0);
      return;
    }
    const p = this.age / this.duration;

    if (p >= 1.0) {
      this.active = false;
      // Remove any remaining offset smoothly by letting the caller
      // (Game._updateCamera) decay it.  We zero it immediately
      // because the camera position already includes it.
      this.camera.position.sub(this._currentOffset);
      this._currentOffset.set(0, 0, 0);
      return;
    }

    // Decaying envelope: sharp attack, exponential decay
    const envelope = Math.exp(-p * 4.5) * Math.sin(p * Math.PI * 2.5);
    const amp = this.intensity * envelope;

    // Random-ish offset using sin/cos of time (deterministic but noisy)
    const t = this.age * 32;
    const offX = Math.sin(t * 1.13) * Math.cos(t * 2.71) * amp;
    const offY = Math.cos(t * 1.73) * Math.sin(t * 3.17) * amp * 0.6;
    const offZ = Math.sin(t * 2.31) * Math.cos(t * 1.47) * amp;

    this._tmpOffset.copy(this._perpA).multiplyScalar(offX);
    this._tmpOffset.addScaledVector(this._perpB, offY);
    this._tmpOffset.y += offZ;

    // Apply delta: remove old offset, add new offset
    this.camera.position.sub(this._currentOffset).add(this._tmpOffset);
    this._currentOffset.copy(this._tmpOffset);
  }

  /**
   * Call when the camera is intentionally moved (e.g. mode switch)
   * so the shake doesn't fight the new placement.
   */
  cancel() {
    if (this.active) {
      this.active = false;
      this.camera.position.sub(this._currentOffset);
      this._currentOffset.set(0, 0, 0);
    }
  }
}
