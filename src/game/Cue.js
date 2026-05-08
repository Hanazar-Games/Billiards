import * as THREE from 'three';

export class Cue {
  constructor() {
    this.visible = true;

    const group = new THREE.Group();

    // Shaft (main stick)
    const shaftGeo = new THREE.CylinderGeometry(0.6, 0.8, 40, 16);
    const shaftMat = new THREE.MeshStandardMaterial({ color: 0xd2a679 });
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    shaft.position.y = 20;
    shaft.castShadow = true;
    group.add(shaft);

    // Tip
    const tipGeo = new THREE.CylinderGeometry(0.55, 0.6, 2, 16);
    const tipMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f });
    const tip = new THREE.Mesh(tipGeo, tipMat);
    tip.position.y = 1;
    group.add(tip);

    // Butt
    const buttGeo = new THREE.CylinderGeometry(0.9, 1.2, 15, 16);
    const buttMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
    const butt = new THREE.Mesh(buttGeo, buttMat);
    butt.position.y = 48;
    butt.castShadow = true;
    group.add(butt);

    this.mesh = group;
    this.mesh.visible = true;
  }

  setAim(ballPosition, direction) {
    if (!this.visible) return;

    // Position cue behind ball
    const offset = 8; // distance from ball center
    const pos = ballPosition.clone().add(direction.clone().multiplyScalar(-offset));
    pos.y = ballPosition.y;

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
