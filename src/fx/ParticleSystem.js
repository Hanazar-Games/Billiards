/**
 * ParticleSystem - Visual effects using Three.js Points.
 *
 * Effects:
 *  - Chalk dust: blue-white cloud at cue-ball impact
 *  - Collision sparks: colorful burst on ball-ball hits
 *  - Pocket flash: golden ring when a ball drops in
 *
 * Performance: each effect is a separate THREE.Points mesh that gets
 * cleaned up when all particles expire. Maximum ~300 particles alive.
 */
import * as THREE from 'three';
import { settings } from '../core/SettingsStore.js';
import { fxAnimMs } from '../core/AnimSpeed.js';

const CHALK_COLOR = 0xa8d8ea;
const SPARK_COLORS = [0xffd700, 0xff6b6b, 0x4ecdc4, 0xffe66d, 0xffffff];
const FLASH_COLOR = 0xffd700;

// Colours for the pocket-fountain effect keyed by ball ID.
const FOUNTAIN_COLORS = {
  0: 0xffffff, // cue
  1: 0xffd700, 2: 0x0000ff, 3: 0xff0000, 4: 0x800080,
  5: 0xff8c00, 6: 0x006400, 7: 0x8b0000,
  8: 0x111111,
  9: 0xffd700, 10: 0x0000ff, 11: 0xff0000, 12: 0x800080,
  13: 0xff8c00, 14: 0x006400, 15: 0x8b0000,
};

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.enabled = true;
    this.systems = [];
  }

  setEnabled(v) {
    this.enabled = v;
  }

  /**
   * Spawn chalk dust particles at the cue ball impact point.
   * @param {THREE.Vector3} position - impact position
   * @param {THREE.Vector3} direction - shot direction (normalized)
   * @param {number} power - shot power (0-100)
   */
  _getIntensityMult() {
    return Math.max(0.2, settings.get('particleIntensity') ?? 1.0);
  }

  spawnChalkDust(position, direction, power) {
    if (!this.enabled) return;
    const mult = this._getIntensityMult();
    const count = Math.min(Math.floor((10 + power / 6) * mult), Math.floor(40 * mult));
    const data = this._allocParticleData(count);

    for (let i = 0; i < count; i++) {
      // Position: slightly scattered around impact
      data.positions[i * 3] = position.x + (Math.random() - 0.5) * 2.5;
      data.positions[i * 3 + 1] = position.y + Math.random() * 1.5;
      data.positions[i * 3 + 2] = position.z + (Math.random() - 0.5) * 2.5;

      // Velocity: mostly forward with spread
      const spread = 0.25 + power * 0.004;
      const speed = 15 + Math.random() * 25 + power * 0.15;
      data.velocities.push({
        x: direction.x * speed + (Math.random() - 0.5) * spread * speed,
        y: Math.random() * 8 + 3,
        z: direction.z * speed + (Math.random() - 0.5) * spread * speed,
      });

      data.lifetimes.push(fxAnimMs((0.25 + Math.random() * 0.35) * 1000) / 1000);
      data.maxLifetimes.push(data.lifetimes[i]);
      // size is handled by PointsMaterial.size, not per-particle
    }

    const material = new THREE.PointsMaterial({
      color: CHALK_COLOR,
      size: 2.0,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this._spawnPoints(data, material, 'chalk');
  }

  /**
   * Spawn collision sparks at ball-ball contact point.
   * @param {THREE.Vector3} position - contact position
   * @param {number} intensity - collision velocity magnitude
   */
  spawnCollisionSparks(position, intensity) {
    if (!this.enabled) return;
    const mult = this._getIntensityMult();
    const count = Math.min(Math.floor((6 + intensity * 2) * mult), Math.floor(30 * mult));
    if (count <= 0) return;

    const data = this._allocParticleData(count);

    for (let i = 0; i < count; i++) {
      data.positions[i * 3] = position.x;
      data.positions[i * 3 + 1] = position.y;
      data.positions[i * 3 + 2] = position.z;

      const angle = Math.random() * Math.PI * 2;
      const up = Math.random() * 0.6 + 0.2;
      const speed = 10 + Math.random() * 20 + intensity * 1.5;
      data.velocities.push({
        x: Math.cos(angle) * speed,
        y: up * speed * 0.5,
        z: Math.sin(angle) * speed,
      });

      data.lifetimes.push(fxAnimMs((0.15 + Math.random() * 0.2) * 1000) / 1000);
      data.maxLifetimes.push(data.lifetimes[i]);
    }

    // Random color per spark burst
    const burstColor = SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)];
    const material = new THREE.PointsMaterial({
      color: burstColor,
      size: 1.5,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this._spawnPoints(data, material, 'spark');
  }

  /**
   * Spawn a golden pocket flash when a ball is pocketed.
   * @param {THREE.Vector3} position - pocket center
   */
  spawnPocketFlash(position) {
    if (!this.enabled) return;
    const mult = this._getIntensityMult();
    const count = Math.max(6, Math.floor(24 * mult));
    const data = this._allocParticleData(count);

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const radius = 3 + Math.random() * 4;
      data.positions[i * 3] = position.x + Math.cos(angle) * radius;
      data.positions[i * 3 + 1] = position.y + Math.random() * 2;
      data.positions[i * 3 + 2] = position.z + Math.sin(angle) * radius;

      data.velocities.push({
        x: Math.cos(angle) * (2 + Math.random() * 4),
        y: Math.random() * 3,
        z: Math.sin(angle) * (2 + Math.random() * 4),
      });

      data.lifetimes.push(fxAnimMs((0.4 + Math.random() * 0.3) * 1000) / 1000);
      data.maxLifetimes.push(data.lifetimes[i]);
      // size is handled by PointsMaterial.size, not per-particle
    }

    const material = new THREE.PointsMaterial({
      color: FLASH_COLOR,
      size: 2.5,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this._spawnPoints(data, material, 'flash');
  }

  /**
   * Spawn a coloured fountain when a ball drops into a pocket.
   * Particles erupt upward and then fall back under gravity,
   * tinted to match the pocketed ball.
   * @param {THREE.Vector3} position - pocket centre
   * @param {number} ballId - pocketed ball id (0-15)
   */
  spawnPocketFountain(position, ballId) {
    if (!this.enabled) return;
    const mult = this._getIntensityMult();
    const color = FOUNTAIN_COLORS[ballId] ?? FLASH_COLOR;
    const count = Math.max(6, Math.floor((18 + Math.random() * 10) * mult));
    const data = this._allocParticleData(count);

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spread = Math.random() * 3.5;
      data.positions[i * 3] = position.x + Math.cos(angle) * spread;
      data.positions[i * 3 + 1] = position.y + 1;
      data.positions[i * 3 + 2] = position.z + Math.sin(angle) * spread;

      const speed = 5 + Math.random() * 14;
      data.velocities.push({
        x: Math.cos(angle) * (1 + Math.random() * 3),
        y: speed,
        z: Math.sin(angle) * (1 + Math.random() * 3),
      });

      data.lifetimes.push(fxAnimMs((0.5 + Math.random() * 0.4) * 1000) / 1000);
      data.maxLifetimes.push(data.lifetimes[i]);
    }

    const material = new THREE.PointsMaterial({
      color,
      size: 2.2,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this._spawnPoints(data, material, 'fountain');
  }

  _allocParticleData(count) {
    return {
      positions: new Float32Array(count * 3),
      velocities: [],
      lifetimes: [],
      maxLifetimes: [],
    };
  }

  _spawnPoints(data, material, type) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    this.scene.add(points);

    this.systems.push({
      mesh: points,
      velocities: data.velocities,
      lifetimes: data.lifetimes,
      maxLifetimes: data.maxLifetimes,
      type,
    });
  }

  /** Update all particle systems. Call once per frame. */
  update(dt) {
    if (this.systems.length === 0) return;

    // Clamp dt to prevent explosion on frame drops
    const safeDt = Math.max(0, Math.min(Number.isFinite(dt) ? dt : 0, 0.05));
    if (safeDt === 0) return;

    for (let i = this.systems.length - 1; i >= 0; i--) {
      const sys = this.systems[i];
      const positions = sys.mesh.geometry.attributes.position.array;
      let aliveCount = 0;
      let totalLife = 0;
      let totalMaxLife = 0;

      for (let j = 0; j < sys.lifetimes.length; j++) {
        sys.lifetimes[j] -= safeDt;

        if (sys.lifetimes[j] > 0) {
          aliveCount++;
          totalLife += sys.lifetimes[j];
          totalMaxLife += sys.maxLifetimes[j];

          positions[j * 3] += sys.velocities[j].x * safeDt;
          positions[j * 3 + 1] += sys.velocities[j].y * safeDt;
          positions[j * 3 + 2] += sys.velocities[j].z * safeDt;

          // Gravity for chalk dust and pocket fountains
          if (sys.type === 'chalk' || sys.type === 'fountain') {
            sys.velocities[j].y -= 14 * safeDt;
          }
        } else {
          // Move dead particles off-screen
          positions[j * 3] = 99999;
        }
      }

      sys.mesh.geometry.attributes.position.needsUpdate = true;

      // Fade opacity based on average remaining life
      if (aliveCount > 0 && totalMaxLife > 0) {
        const lifeRatio = totalLife / totalMaxLife;
        sys.mesh.material.opacity = Math.max(0, Math.min(1, lifeRatio * 1.2));
      }

      if (aliveCount === 0) {
        this.scene.remove(sys.mesh);
        sys.mesh.geometry.dispose();
        sys.mesh.material.dispose();
        this.systems.splice(i, 1);
      }
    }
  }

  /** Remove all active particles immediately. */
  clear() {
    for (const sys of this.systems) {
      this.scene.remove(sys.mesh);
      sys.mesh.geometry.dispose();
      sys.mesh.material.dispose();
    }
    this.systems = [];
  }

  dispose() {
    this.clear();
  }
}
