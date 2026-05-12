/**
 * ScreenShake — Camera shake on powerful shots.
 *
 * Applies a short-duration positional jitter to the camera based on
 * shot power.  The shake vector is mostly perpendicular to the shot
 * direction so it feels like the table is rattling rather than sliding.
 */
import * as THREE from 'three';

export class ScreenShake {
  constructor(camera) {
    this.camera = camera;
    this.active = false;
    this.age = 0;
    this.duration = 0;
    this.intensity = 0;
    this._originalPos = new THREE.Vector3();
    this._shakeOffset = new THREE.Vector3();
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

    this.active = true;
    this.age = 0;
    this.duration = 0.18 + t * 0.35; // 0.18s … 0.53s
    this.intensity = 0.3 + t * 2.2;  // 0.3 … 2.5 units
    this._originalPos.copy(this.camera.position);

    // Build two perpendicular axes for shake
    this._perpA.copy(direction).cross(new THREE.Vector3(0, 1, 0)).normalize();
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
    if (!this.active) return;

    this.age += dt;
    const p = this.age / this.duration;

    if (p >= 1.0) {
      this.active = false;
      // Ensure we end exactly at original position
      this.camera.position.copy(this._originalPos);
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

    this._shakeOffset
      .copy(this._perpA).multiplyScalar(offX)
      .addScaledVector(this._perpB, offY);
    this._shakeOffset.y += offZ;

    this.camera.position.copy(this._originalPos).add(this._shakeOffset);
  }

  /**
   * Call when the camera is intentionally moved (e.g. mode switch)
   * so the shake doesn't snap it back to an old position.
   */
  cancel() {
    if (this.active) {
      this.active = false;
    }
  }

  /**
   * Call when the camera position is externally updated to keep
   * the shake reference point in sync.
   */
  syncOriginal() {
    if (!this.active) {
      this._originalPos.copy(this.camera.position);
    }
  }
}
