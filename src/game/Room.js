/**
 * Room — Environmental geometry surrounding the pool table.
 *
 * Creates an open studio floor and a row of table lights.
 */
import * as THREE from 'three';
import { TABLE } from '../config.js';

export class Room {
  constructor() {
    this.meshGroup = new THREE.Group();
    this.createFloor();
    this.createTableLights();
  }

  addToScene(scene) {
    scene.add(this.meshGroup);
  }

  createFloor() {
    const width = TABLE.width * 4.2;
    const depth = TABLE.depth * 4.2;
    const geometry = new THREE.PlaneGeometry(width, depth);
    const material = new THREE.MeshStandardMaterial({
      color: 0x141414,
      roughness: 0.72,
      metalness: 0.05,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = -TABLE.height - 60; // below table legs
    mesh.receiveShadow = true;
    this.meshGroup.add(mesh);

    this.createFloorLines(width, depth);
  }

  createFloorLines(width, depth) {
    const lineMat = new THREE.MeshStandardMaterial({
      color: 0x262626,
      roughness: 0.8,
      metalness: 0.0,
    });

    for (let x = -width / 2; x <= width / 2; x += 48) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.2, depth), lineMat);
      line.position.set(x, -TABLE.height - 59.85, 0);
      this.meshGroup.add(line);
    }

    for (let z = -depth / 2; z <= depth / 2; z += 48) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(width, 0.2, 0.8), lineMat);
      line.position.set(0, -TABLE.height - 59.8, z);
      this.meshGroup.add(line);
    }
  }

  createTableLights() {
    // Raised higher so the lamps are well above the player sight line
    const railY = 235;
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0xfff1cc,
      emissive: 0xffd98a,
      emissiveIntensity: 1.8,
      roughness: 0.2,
      transparent: true,
      opacity: 1.0,
    });

    const crossbarMat = new THREE.MeshStandardMaterial({
      color: 0x2b2418,
      emissive: 0x4a3214,
      emissiveIntensity: 0.35,
      roughness: 0.45,
      metalness: 0.25,
      transparent: true,
      opacity: 1.0,
    });
    const crossbar = new THREE.Mesh(new THREE.BoxGeometry(4, 3, TABLE.depth * 0.68), crossbarMat);
    crossbar.position.set(0, railY + 14, 0);
    this.meshGroup.add(crossbar);

    this._lampDiffusers = [];
    this._lampLights = [];
    const lampZs = [-TABLE.depth * 0.3, 0, TABLE.depth * 0.3];
    for (const z of lampZs) {
      const diffuser = new THREE.Mesh(new THREE.CylinderGeometry(13, 13, 1.5, 32), glowMat.clone());
      diffuser.position.set(0, railY - 8.5, z);
      this.meshGroup.add(diffuser);
      this._lampDiffusers.push(diffuser);

      const spot = new THREE.SpotLight(0xffe4b0, 1.25, 420, Math.PI / 4.8, 0.55, 1.4);
      spot.position.set(0, railY - 8, z);
      spot.target.position.set(0, 0, z * 0.18);
      spot.castShadow = false;
      spot.shadow.mapSize.width = 1024;
      spot.shadow.mapSize.height = 1024;
      this.meshGroup.add(spot);
      this.meshGroup.add(spot.target);
      this._lampLights.push(spot);
    }

    // Store crossbar material for opacity control
    this._lampCrossbarMat = crossbarMat;
  }

  /**
   * Call every frame from the game loop.  Fades lamp meshes when they sit
   * between the camera and the table playing surface.
   */
  updateLampOpacity(camera) {
    if (!this._lampDiffusers || this._lampDiffusers.length === 0) return;

    const camPos = camera.position;
    const tableCenter = new THREE.Vector3(0, BALL.radius, 0);
    const toTable = new THREE.Vector3().subVectors(tableCenter, camPos);
    const distToTable = toTable.length();
    toTable.normalize();

    for (const diffuser of this._lampDiffusers) {
      const toLamp = new THREE.Vector3().subVectors(diffuser.position, camPos);
      const distToLamp = toLamp.length();
      toLamp.normalize();

      // Dot product tells us how close the lamp is to the camera→table ray
      const alignment = toLamp.dot(toTable);

      // When the lamp is between camera and table (distToLamp < distToTable)
      // AND aligned with the sight line (alignment near 1), fade it out.
      let targetOpacity = 1.0;
      if (distToLamp < distToTable && alignment > 0.88) {
        // Sharper fade as alignment increases
        const fade = Math.max(0, (alignment - 0.88) / (1.0 - 0.88));
        targetOpacity = 1.0 - fade * 0.82; // down to ~0.18 opacity
      }

      const mat = diffuser.material;
      if (Math.abs(mat.opacity - targetOpacity) > 0.01) {
        mat.opacity += (targetOpacity - mat.opacity) * 0.12;
      }
    }

    // Same logic for crossbar — use the max alignment across all lamps
    if (this._lampCrossbarMat) {
      let maxFade = 0;
      for (const diffuser of this._lampDiffusers) {
        const toLamp = new THREE.Vector3().subVectors(diffuser.position, camera.position);
        const distToLamp = toLamp.length();
        toLamp.normalize();
        const alignment = toLamp.dot(toTable);
        if (distToLamp < distToTable && alignment > 0.88) {
          maxFade = Math.max(maxFade, (alignment - 0.88) / 0.12);
        }
      }
      const targetCross = Math.max(0.18, 1.0 - maxFade * 0.82);
      if (Math.abs(this._lampCrossbarMat.opacity - targetCross) > 0.01) {
        this._lampCrossbarMat.opacity += (targetCross - this._lampCrossbarMat.opacity) * 0.12;
      }
    }
  }

  dispose() {
    if (this.meshGroup && this.meshGroup.parent) {
      this.meshGroup.parent.remove(this.meshGroup);
    }
    this.meshGroup.traverse((child) => {
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
