import * as THREE from 'three';
import { BALL, TABLE } from '../config.js';
import { CUE_THEMES, applyCueTheme } from './CueThemes.js';

const CUE_LENGTH = 160; // tip-to-butt in local Y units
const CUE_RADIUS = 1.5; // approx max butt radius for collision margin

export class Cue {
  constructor() {
    this.visible = true;

    const group = new THREE.Group();

    this._materials = {};

    this._materials.shaft  = new THREE.MeshStandardMaterial({ color: 0xc58d55, roughness: 0.42, metalness: 0.04 });
    this._materials.ferrule = new THREE.MeshStandardMaterial({ color: 0xf1eadc, roughness: 0.28, metalness: 0.02 });
    this._materials.tip    = new THREE.MeshStandardMaterial({ color: 0x2c1b12, roughness: 0.72 });
    this._materials.wrap   = new THREE.MeshStandardMaterial({ color: 0x111316, roughness: 0.55, metalness: 0.08 });
    this._materials.ring   = new THREE.MeshStandardMaterial({ color: 0xc9b483, roughness: 0.22, metalness: 0.55 });
    this._materials.butt   = new THREE.MeshStandardMaterial({ color: 0x5a301b, roughness: 0.36, metalness: 0.08 });
    this._materials.inlay  = new THREE.MeshStandardMaterial({ color: 0xe6d7ad, roughness: 0.24, metalness: 0.18 });

    const addSegment = (name, radiusTop, radiusBottom, length, y, mat, radialSegments = 28) => {
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(radiusTop, radiusBottom, length, radialSegments),
        mat
      );
      mesh.name = name;
      mesh.position.y = y;
      group.add(mesh);
      return mesh;
    };

    // Pool cues are about 58 in long, roughly 25.8 ball diameters. With the
    // game ball scale, that makes a full cue about 147 units.
    addSegment('leather-tip', 0.42, 0.48, 1.6, 0.8, this._materials.tip, 28);
    addSegment('ivory-ferrule', 0.5, 0.54, 4.4, 3.8, this._materials.ferrule, 32);
    addSegment('pro-taper-shaft', 0.52, 0.72, 76, 44.0, this._materials.shaft, 36);
    addSegment('joint-collar-front', 0.78, 0.88, 1.4, 82.7, this._materials.ring, 36);
    addSegment('joint-pin-band', 0.9, 0.94, 1.0, 83.9, this._materials.ferrule, 36);
    addSegment('joint-collar-back', 0.94, 1.0, 1.4, 85.1, this._materials.ring, 36);
    addSegment('forearm', 1.02, 1.18, 25, 98.3, this._materials.butt, 36);
    addSegment('wrap', 1.18, 1.25, 29, 125.3, this._materials.wrap, 36);
    addSegment('butt-sleeve', 1.25, 1.36, 17, 148.3, this._materials.butt, 36);
    addSegment('butt-cap-ring', 1.36, 1.4, 1.4, 157.5, this._materials.ring, 36);
    addSegment('rubber-bumper', 1.36, 1.42, 2.2, 159.3, this._materials.tip, 36);

    for (const y of [91, 97, 103, 144, 151]) {
      const ring = addSegment('decorative-inlay', 1.205, 1.215, 0.45, y, this._materials.inlay, 36);
      ring.scale.x = 1.01;
      ring.scale.z = 1.01;
    }

    this.mesh = group;
    this.mesh.visible = true;
    this._localAxis = new THREE.Vector3(0, 1, 0);
    this._worldAxis = new THREE.Vector3();
    this._quat = new THREE.Quaternion();
  }

  setAim(ballPosition, direction, pullback = 0) {
    if (!this.visible) return;

    const aim = this._worldAxis.copy(direction).setY(0);
    if (aim.lengthSq() < 0.0001) return;
    aim.normalize();

    // Base offset: tip sits just outside the ball (about 1 ball-diameter gap).
    const baseTipGap = BALL.radius * 2.0;
    let offset = BALL.radius + baseTipGap;
    const minOffset = BALL.radius * 1.02;

    // Clamp base offset so the cue butt does not clip through rails.
    // Butt world position = ballPosition - aim * (offset + CUE_LENGTH).
    const halfW = TABLE.width / 2;
    const halfD = TABLE.depth / 2;
    const margin = CUE_RADIUS + 4;
    const minX = -halfW - 18 + margin;
    const maxX = halfW + 18 - margin;
    const minZ = -halfD - 18 + margin;
    const maxZ = halfD + 18 - margin;

    if (aim.x > 0.001) {
      const maxOff = (ballPosition.x - minX) / aim.x - CUE_LENGTH;
      offset = Math.min(offset, maxOff);
    } else if (aim.x < -0.001) {
      const maxOff = (maxX - ballPosition.x) / (-aim.x) - CUE_LENGTH;
      offset = Math.min(offset, maxOff);
    }
    if (aim.z > 0.001) {
      const maxOff = (ballPosition.z - minZ) / aim.z - CUE_LENGTH;
      offset = Math.min(offset, maxOff);
    } else if (aim.z < -0.001) {
      const maxOff = (maxZ - ballPosition.z) / (-aim.z) - CUE_LENGTH;
      offset = Math.min(offset, maxOff);
    }
    offset = Math.max(offset, minOffset);

    // Apply pullback AFTER rail clamp so the cue visibly moves backward.
    offset += pullback;

    const pos = ballPosition.clone().addScaledVector(aim, -offset);
    // Lift cue slightly and tilt upward to avoid clipping through the table.
    pos.y = ballPosition.y + 2.5;

    this.mesh.position.copy(pos);
    this._applyTilt(aim);
    this.mesh.quaternion.copy(this._quat);
  }

  _applyTilt(aim) {
    this._quat.setFromUnitVectors(this._localAxis, aim.clone().negate());
    const tiltAxis = new THREE.Vector3().crossVectors(aim, new THREE.Vector3(0, 1, 0)).normalize();
    if (tiltAxis.lengthSq() > 0.001) {
      const tiltQuat = new THREE.Quaternion().setFromAxisAngle(tiltAxis, -0.06);
      this._quat.premultiply(tiltQuat);
    }
  }

  hide() {
    this.visible = false;
    this.mesh.visible = false;
  }

  show() {
    this.visible = true;
    this.mesh.visible = true;
  }

  applyTheme(themeId = 'default') {
    const theme = CUE_THEMES[themeId] || CUE_THEMES.default;
    applyCueTheme(this._materials, theme);
  }

  /**
   * Snap the cue tip to the ball surface for a "strike" visual frame.
   * Call immediately after applyImpulse; the cue will appear to have just hit the ball.
   */
  strikeSnap(ballPosition, direction) {
    if (!this.visible) return;
    const aim = this._worldAxis.copy(direction).setY(0);
    if (aim.lengthSq() < 0.0001) return;
    aim.normalize();
    const tipAtSurface = ballPosition.clone().addScaledVector(aim, -BALL.radius * 1.02);
    tipAtSurface.y = ballPosition.y + 2.5;
    this.mesh.position.copy(tipAtSurface);
    this._applyTilt(aim);
    this.mesh.quaternion.copy(this._quat);
  }

  dispose() {
    this.mesh.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
  }
}
