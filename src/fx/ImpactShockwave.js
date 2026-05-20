/**
 * ImpactShockwave — Expanding ring effect at cue-ball impact.
 *
 * Creates a translucent coloured ring that blooms outward from the
 * impact point.  Colour and speed scale with shot power so a gentle
 * tap gives a subtle blue ripple while a power-break produces a
 * bold orange-red blast.
 */
import * as THREE from 'three';
import { SHOT } from '../config.js';
import { fxAnimMs } from '../core/AnimSpeed.js';

const COLOR_LOW = new THREE.Color(0x4ecdc4);   // teal
const COLOR_MID = new THREE.Color(0xffd93d);   // yellow
const COLOR_HIGH = new THREE.Color(0xff6b35);  // orange-red

export class ImpactShockwave {
  constructor(scene) {
    this.scene = scene;
    this.active = [];
  }

  /**
   * Spawn a new shockwave ring.
   * @param {THREE.Vector3} position — world-space origin
   * @param {number} power — shot power (0 … SHOT.maxPower)
   */
  spawn(position, power) {
    if (!position || !position.isVector3) return;
    if (!Number.isFinite(power) || power <= 0) return;
    const maxPower = SHOT.maxPower;
    const t = Math.min(power / maxPower, 1.0);

    // Pick colour based on power tier
    const color = new THREE.Color();
    if (t < 0.4) {
      color.lerpColors(COLOR_LOW, COLOR_MID, t / 0.4);
    } else {
      color.lerpColors(COLOR_MID, COLOR_HIGH, (t - 0.4) / 0.6);
    }

    // Geometry: thin ring facing up
    const geometry = new THREE.RingGeometry(0.5, 1.2, 48);
    const material = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y += 0.2; // slightly above felt
    this.scene.add(mesh);

    const duration = fxAnimMs((0.35 + t * 0.35) * 1000) / 1000; // 0.35s … 0.7s, scaled by fxAnimSpeed
    const maxRadius = 18 + t * 55;    // 18 … 73

    this.active.push({
      mesh,
      material,
      geometry,
      age: 0,
      duration,
      maxRadius,
      baseOuter: 1.2,
    });
  }

  /**
   * Update all active shockwaves. Call every frame.
   * @param {number} dt — delta time in seconds
   */
  update(dt) {
    const safeDt = Math.max(0, Math.min(Number.isFinite(dt) ? dt : 0, 0.05));
    for (let i = this.active.length - 1; i >= 0; i--) {
      const wave = this.active[i];
      wave.age += safeDt;
      const p = Math.min(wave.age / wave.duration, 1.0);

      // Ease-out expansion
      const ease = 1 - Math.pow(1 - p, 3);
      const scale = ease * wave.maxRadius / wave.baseOuter;
      wave.mesh.scale.set(scale, scale, 1);

      // Fade opacity
      wave.material.opacity = 0.65 * (1 - p * p);

      if (p >= 1.0) {
        this.scene.remove(wave.mesh);
        wave.geometry.dispose();
        wave.material.dispose();
        this.active.splice(i, 1);
      }
    }
  }

  clear() {
    for (const wave of this.active) {
      this.scene.remove(wave.mesh);
      wave.geometry.dispose();
      wave.material.dispose();
    }
    this.active.length = 0;
  }

  dispose() {
    this.clear();
  }
}
