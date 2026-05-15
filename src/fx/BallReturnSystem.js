import * as THREE from 'three';
import { BALL } from '../config.js';
import { fxAnimMs } from '../core/AnimSpeed.js';

/**
 * BallReturnSystem — visual ball-return animation.
 *
 * When a ball is pocketed, instead of vanishing instantly, a cloned mesh
 * drops through the pocket, slides along an invisible track beneath the
 * table, and settles into a collection tray at the head end.  The tray
 * is a real 3D object attached to the table underside.
 *
 * This is purely cosmetic — physics removal and game logic are untouched.
 */
export class BallReturnSystem {
  constructor(scene) {
    this.scene = scene;
    this.active = []; // { mesh, stage, age, dur, start, drop, slide, target, rotAxis, rotSpeed }
    this.settled = []; // { mesh } — balls resting in the tray
    this.trayGroup = new THREE.Group();
    this.scene.add(this.trayGroup);
    this._buildTray();
  }

  /* ------------------------------------------------------------------ */
  /*  Tray geometry                                                      */
  /* ------------------------------------------------------------------ */
  _buildTray() {
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x1c1410,
      roughness: 0.5,
      metalness: 0.14,
    });
    const feltMat = new THREE.MeshStandardMaterial({
      color: 0x0d0a08,
      roughness: 0.8,
      metalness: 0.02,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x8a7260,
      roughness: 0.35,
      metalness: 0.45,
    });

    const w = 88;
    const h = 3.2;
    const d = 26;
    const x = 0;
    const y = -20;
    const z = -144;

    // Bottom slab
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), woodMat);
    bottom.position.set(x, y, z);
    bottom.receiveShadow = true;
    this.trayGroup.add(bottom);

    // Inner felt cushion
    const cushion = new THREE.Mesh(
      new THREE.BoxGeometry(w - 3, 0.7, d - 3),
      feltMat
    );
    cushion.position.set(x, y + h / 2 + 0.35, z);
    cushion.receiveShadow = true;
    this.trayGroup.add(cushion);

    // Back wall (facing away from table)
    const back = new THREE.Mesh(new THREE.BoxGeometry(w, 9, 1.6), woodMat);
    back.position.set(x, y + 3, z - d / 2 + 0.8);
    back.castShadow = true;
    back.receiveShadow = true;
    this.trayGroup.add(back);

    // Side walls
    for (const sx of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(1.6, 9, d), woodMat);
      side.position.set(x + sx * (w / 2 - 0.8), y + 3, z);
      side.castShadow = true;
      side.receiveShadow = true;
      this.trayGroup.add(side);
    }

    // Decorative metal trim along the top edge of the front opening
    const trim = new THREE.Mesh(new THREE.BoxGeometry(w, 0.6, 0.8), trimMat);
    trim.position.set(x, y + 5.2, z + d / 2 - 0.4);
    trim.castShadow = true;
    this.trayGroup.add(trim);

    // Small front lip (low, so balls are visible from the front)
    const lip = new THREE.Mesh(new THREE.BoxGeometry(w, 2.2, 0.8), woodMat);
    lip.position.set(x, y + 1.1, z + d / 2 - 0.4);
    lip.castShadow = true;
    this.trayGroup.add(lip);
  }

  /* ------------------------------------------------------------------ */
  /*  Spawn a return animation                                           */
  /* ------------------------------------------------------------------ */
  animateBallReturn(ballMesh, pocketPosition) {
    const settledCount = this.settled.length;
    const target = this._computeTraySlot(settledCount);

    // Clone the ball mesh so the original can be hidden/disposed independently.
    const clone = ballMesh.clone();
    clone.position.copy(pocketPosition);
    clone.visible = true;
    this.scene.add(clone);

    // Rotation axis + speed for the tumble animation
    const rotAxis = new THREE.Vector3(
      Math.random() - 0.5,
      Math.random() - 0.5,
      Math.random() - 0.5
    ).normalize();
    const rotSpeed = 3 + Math.random() * 4;

    const start = pocketPosition.clone();
    const drop = new THREE.Vector3(pocketPosition.x, -9, pocketPosition.z);
    const slide = new THREE.Vector3(target.x, -10, target.z);

    this.active.push({
      mesh: clone,
      stage: 0, // 0 = drop, 1 = slide, 2 = settle
      age: 0,
      dropDur: fxAnimMs(220) / 1000,
      slideDur: fxAnimMs(520) / 1000,
      settleDur: fxAnimMs(180) / 1000,
      start,
      drop,
      slide,
      target,
      rotAxis,
      rotSpeed,
    });
  }

  /** Compute a grid position inside the tray with slight jitter. */
  _computeTraySlot(index) {
    const cols = 8;
    const spacing = 6.5;
    const col = index % cols;
    const row = Math.floor(index / cols);
    const jitter = 0.4;
    return new THREE.Vector3(
      -22.75 + col * spacing + (Math.random() - 0.5) * jitter,
      -14.84, // cushion top (-17.7) + ball radius (2.8575) ≈ -14.84
      -148 + row * spacing * 0.85 + (Math.random() - 0.5) * jitter
    );
  }

  /* ------------------------------------------------------------------ */
  /*  Per-frame update                                                   */
  /* ------------------------------------------------------------------ */
  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const a = this.active[i];
      a.age += dt;

      if (a.stage === 0) {
        // Drop: accelerate downward (ease-in quad)
        const p = Math.min(a.age / a.dropDur, 1);
        const t = p * p;
        a.mesh.position.lerpVectors(a.start, a.drop, t);
        this._rotate(a, dt);
        if (p >= 1) {
          a.stage = 1;
          a.age = 0;
        }
      } else if (a.stage === 1) {
        // Slide: move horizontally toward tray (ease-out cubic)
        const p = Math.min(a.age / a.slideDur, 1);
        const t = 1 - Math.pow(1 - p, 3);
        a.mesh.position.lerpVectors(a.drop, a.slide, t);
        this._rotate(a, dt);
        if (p >= 1) {
          a.stage = 2;
          a.age = 0;
        }
      } else if (a.stage === 2) {
        // Settle: slight overshoot bounce then lock
        const p = Math.min(a.age / a.settleDur, 1);
        const t = p * p * (3 - 2 * p); // smoothstep
        a.mesh.position.lerpVectors(a.slide, a.target, t);
        // Dampen rotation
        a.rotSpeed *= 0.92;
        this._rotate(a, dt);
        if (p >= 1) {
          a.mesh.position.copy(a.target);
          this.settled.push({ mesh: a.mesh });
          this.active.splice(i, 1);
        }
      }
    }
  }

  _rotate(a, dt) {
    if (a.rotSpeed < 0.1) return;
    a.mesh.rotateOnWorldAxis(a.rotAxis, a.rotSpeed * dt);
  }

  /* ------------------------------------------------------------------ */
  /*  Lifecycle                                                          */
  /* ------------------------------------------------------------------ */
  reset() {
    // Remove all active animations
    for (const a of this.active) {
      if (a.mesh) this.scene.remove(a.mesh);
    }
    this.active = [];
    // Remove settled balls from tray
    for (const s of this.settled) {
      if (s.mesh) this.scene.remove(s.mesh);
    }
    this.settled = [];
  }

  dispose() {
    this.reset();
    this.scene.remove(this.trayGroup);
    this.trayGroup.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }
}
