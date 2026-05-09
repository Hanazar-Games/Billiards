import * as THREE from 'three';
import { BALL } from '../config.js';

export class Cue {
  constructor() {
    this.visible = true;

    const group = new THREE.Group();

    const woodMat = new THREE.MeshStandardMaterial({ color: 0xc58d55, roughness: 0.42, metalness: 0.04 });
    const ferruleMat = new THREE.MeshStandardMaterial({ color: 0xf1eadc, roughness: 0.28, metalness: 0.02 });
    const tipMat = new THREE.MeshStandardMaterial({ color: 0x2c1b12, roughness: 0.72 });
    const wrapMat = new THREE.MeshStandardMaterial({ color: 0x111316, roughness: 0.55, metalness: 0.08 });
    const ringMat = new THREE.MeshStandardMaterial({ color: 0xc9b483, roughness: 0.22, metalness: 0.55 });
    const buttMat = new THREE.MeshStandardMaterial({ color: 0x5a301b, roughness: 0.36, metalness: 0.08 });

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

    // Local Y starts at the leather tip face, so setAim can keep the cue clear
    // of the cue ball with a precise endpoint offset.
    addSegment('leather-tip', 0.42, 0.48, 1.4, 0.7, tipMat, 24);
    addSegment('ferrule', 0.5, 0.54, 3.2, 3.0, ferruleMat, 28);
    addSegment('tapered-shaft', 0.54, 0.82, 42, 25.6, woodMat, 32);
    addSegment('collar-ring-a', 0.9, 0.92, 0.7, 47.0, ringMat, 32);
    addSegment('wrap', 0.94, 1.05, 14, 54.35, wrapMat, 32);
    addSegment('collar-ring-b', 1.06, 1.08, 0.8, 61.8, ringMat, 32);
    addSegment('butt-sleeve', 1.08, 1.22, 11, 67.7, buttMat, 32);
    addSegment('butt-cap', 1.22, 1.26, 1.6, 74.0, ringMat, 32);

    this.mesh = group;
    this.mesh.visible = true;
  }

  setAim(ballPosition, direction, pullback = 0) {
    if (!this.visible) return;

    // Position the cue tip just outside the ball, then pull the whole cue back.
    const offset = BALL.radius + 2.5 + pullback;
    const pos = ballPosition.clone().add(direction.clone().multiplyScalar(-offset));
    pos.y = ballPosition.y + BALL.radius * 0.18;

    this.mesh.position.copy(pos);

    // Rotate to point at ball
    const target = ballPosition.clone();
    this.mesh.lookAt(target);

    // Cylinder default is Y-up, lookAt points Z-forward, so rotate
    this.mesh.rotateX(Math.PI / 2);
  }

  hide() {
    this.visible = false;
    this.mesh.visible = false;
  }

  show() {
    this.visible = true;
    this.mesh.visible = true;
  }
}
