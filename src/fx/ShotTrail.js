/**
 * ShotTrailSystem - Visual trail recorder for the cue ball.
 *
 * Records the cue ball's path during a shot and renders it as a glowing
 * line that fades out over time. Helps players learn ball control and
 * makes spectacular shots more satisfying to watch.
 *
 * Features:
 *  - Real-time "growth" animation during the shot
 *  - Smooth fade-out after the shot completes
 *  - Automatic cleanup of old trails (max 3 retained)
 *  - Distance-based point deduplication (no clutter when stationary)
 *  - Speed threshold to ignore tiny jitters
 */
import * as THREE from 'three';
import { BALL } from '../config.js';
import { settings } from '../core/SettingsStore.js';

const TRAIL_COLOR = 0xa8d8ea;      // Cyan — matches chalk dust theme
const TRAIL_Y_OFFSET = BALL.radius + 1.0; // Upper hemisphere, clearly visible from most angles
const MIN_POINT_DIST = BALL.radius * 0.25; // ~0.7 cm-scale units
const MIN_SPEED = 0.15;            // Ignore sub-threshold micro-movements
const MAX_POINTS = 500;            // ~8 seconds of recording at 60fps
const MAX_TRAILS = 3;              // Maximum simultaneous trail lines

function _fadeDuration() {
  const v = settings.get('trailFadeDuration');
  return Number.isFinite(v) && v > 0 ? v : 5.0;
}

export class ShotTrailSystem {
  constructor(scene) {
    this.scene = scene;
    this.enabled = true;
    this.trails = [];      // All trail objects: recording + fading
    this.currentTrail = null; // The actively-recording trail
  }

  setEnabled(v) {
    this.enabled = v;
    if (!v) this.clear();
  }

  /**
   * Begin recording a new trail for the given ball.
   * If a trail is already being recorded, it is finalised first.
   */
  startRecording(ball) {
    if (!this.enabled || !ball || ball.pocketed) return;

    // Finalise any in-progress trail before starting a new one
    if (this.currentTrail) {
      this._finishTrail(this.currentTrail);
      this.currentTrail = null;
    }

    // Enforce max trail count: remove oldest fading trails
    while (this.trails.length >= MAX_TRAILS) {
      this._removeTrail(this.trails[0]);
    }

    const trail = this._createTrail();
    this.currentTrail = trail;
    this.trails.push(trail);
  }

  /**
   * Record the ball's current position into the active trail.
   * Points are only added when the ball is moving fast enough and
   * has travelled at least MIN_POINT_DIST from the previous point.
   */
  recordPoint(ball) {
    if (!this.enabled || !this.currentTrail || !ball) return;
    if (ball.pocketed || !ball.mesh || !ball.mesh.visible) return;

    const pos = ball.mesh.position;
    // Sanity guard: removed balls are teleported to y = -1000
    if (pos.y < -50) return;

    const speed = typeof ball.getSpeed === 'function' ? ball.getSpeed() : 0;
    if (speed < MIN_SPEED) return;

    const trail = this.currentTrail;

    // Distance check against last recorded point
    if (trail.recordedCount > 0) {
      const lastIdx = (trail.recordedCount - 1) * 3;
      const dx = pos.x - trail.points[lastIdx];
      const dz = pos.z - trail.points[lastIdx + 2];
      const distSq = dx * dx + dz * dz;
      if (distSq < MIN_POINT_DIST * MIN_POINT_DIST) return;
    }

    // Append point
    const idx = trail.recordedCount * 3;
    if (idx + 2 >= trail.points.length) {
      // Buffer full — gracefully stop recording
      this._finishTrail(trail);
      this.currentTrail = null;
      return;
    }

    trail.points[idx] = pos.x;
    trail.points[idx + 1] = TRAIL_Y_OFFSET;
    trail.points[idx + 2] = pos.z;
    trail.recordedCount++;

    // Update draw range so the line "grows" in real time
    trail.geometry.setDrawRange(0, trail.recordedCount);
    trail.geometry.attributes.position.needsUpdate = true;
  }

  /**
   * Stop recording the current trail. The trail enters fade mode.
   */
  stopRecording() {
    if (!this.currentTrail) return;
    this._finishTrail(this.currentTrail);
    this.currentTrail = null;
  }

  /**
   * Update fading trails. Call once per frame.
   */
  update(dt) {
    if (this.trails.length === 0) return;

    const safeDt = Math.max(0, Math.min(Number.isFinite(dt) ? dt : 0, 0.05));
    if (safeDt === 0) return;

    for (let i = this.trails.length - 1; i >= 0; i--) {
      const trail = this.trails[i];
      if (trail.state !== 'fading') continue;

      trail.fadeAge += safeDt;
      const progress = trail.fadeAge / _fadeDuration();

      if (progress >= 1) {
        this._removeTrail(trail);
      } else {
        // Ease-out cubic for smoother visual disappearance
        const eased = 1 - (progress * progress * progress);
        trail.material.opacity = Math.max(0, eased);
      }
    }
  }

  /** Remove every trail immediately. */
  clear() {
    for (const trail of this.trails) {
      this.scene.remove(trail.line);
      trail.geometry.dispose();
      trail.material.dispose();
    }
    this.trails = [];
    this.currentTrail = null;
  }

  dispose() {
    this.clear();
  }

  // -----------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------

  _createTrail() {
    const points = new Float32Array(MAX_POINTS * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
    geometry.setDrawRange(0, 0);

    const material = new THREE.LineBasicMaterial({
      color: TRAIL_COLOR,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
    });

    const line = new THREE.Line(geometry, material);
    line.frustumCulled = false; // bounding sphere is wrong due to sparse buffer
    line.renderOrder = 10;      // draw on top of most transparent objects
    this.scene.add(line);

    return {
      line,
      geometry,
      material,
      points,
      recordedCount: 0,
      state: 'recording',
      fadeAge: 0,
    };
  }

  _finishTrail(trail) {
    if (trail.state !== 'recording') return;
    trail.state = 'fading';
    trail.fadeAge = 0;
  }

  _removeTrail(trail) {
    const idx = this.trails.indexOf(trail);
    if (idx >= 0) this.trails.splice(idx, 1);
    if (this.currentTrail === trail) this.currentTrail = null;
    this.scene.remove(trail.line);
    trail.geometry.dispose();
    trail.material.dispose();
  }
}
