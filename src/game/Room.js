/**
 * Room — Environmental geometry surrounding the pool table.
 *
 * Creates:
 *  - Floor (dark wood)
 *  - 4 walls with subtle texture
 *  - Ceiling with a hanging lamp fixture
 *  - Baseboards along walls
 */
import * as THREE from 'three';
import { TABLE } from '../config.js';

export class Room {
  constructor() {
    this.meshGroup = new THREE.Group();
    this.createFloor();
    this.createWalls();
    this.createCeilingLamp();
  }

  addToScene(scene) {
    scene.add(this.meshGroup);
  }

  createFloor() {
    const width = TABLE.width * 3;
    const depth = TABLE.depth * 3;
    const geometry = new THREE.PlaneGeometry(width, depth);
    const material = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.9,
      metalness: 0.05,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = -TABLE.height - 60; // below table legs
    mesh.receiveShadow = true;
    this.meshGroup.add(mesh);
  }

  createWalls() {
    const wallH = 200;
    const wallThickness = 5;
    const roomW = TABLE.width * 2.5;
    const roomD = TABLE.depth * 2.5;
    const floorY = -TABLE.height - 60;

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x2a2a2a,
      roughness: 0.95,
      metalness: 0.0,
    });

    // Back wall (negative Z)
    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(roomW, wallH, wallThickness),
      wallMat
    );
    backWall.position.set(0, floorY + wallH / 2, -roomD / 2);
    backWall.receiveShadow = true;
    this.meshGroup.add(backWall);

    // Front wall (positive Z)
    const frontWall = new THREE.Mesh(
      new THREE.BoxGeometry(roomW, wallH, wallThickness),
      wallMat
    );
    frontWall.position.set(0, floorY + wallH / 2, roomD / 2);
    frontWall.receiveShadow = true;
    this.meshGroup.add(frontWall);

    // Left wall
    const leftWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, wallH, roomD),
      wallMat
    );
    leftWall.position.set(-roomW / 2, floorY + wallH / 2, 0);
    leftWall.receiveShadow = true;
    this.meshGroup.add(leftWall);

    // Right wall
    const rightWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, wallH, roomD),
      wallMat
    );
    rightWall.position.set(roomW / 2, floorY + wallH / 2, 0);
    rightWall.receiveShadow = true;
    this.meshGroup.add(rightWall);

    // Baseboards
    const baseH = 12;
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.8 });

    [
      [0, floorY + baseH / 2, -roomD / 2 + wallThickness / 2, roomW, baseH, wallThickness],
      [0, floorY + baseH / 2, roomD / 2 - wallThickness / 2, roomW, baseH, wallThickness],
      [-roomW / 2 + wallThickness / 2, floorY + baseH / 2, 0, wallThickness, baseH, roomD],
      [roomW / 2 - wallThickness / 2, floorY + baseH / 2, 0, wallThickness, baseH, roomD],
    ].forEach(([x, y, z, w, h, d]) => {
      const base = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), baseMat);
      base.position.set(x, y, z);
      this.meshGroup.add(base);
    });
  }

  createCeilingLamp() {
    const lampY = 180;
    const roomW = TABLE.width * 2.5;
    const roomD = TABLE.depth * 2.5;

    // Ceiling plane
    const ceilingGeo = new THREE.PlaneGeometry(roomW, roomD);
    const ceilingMat = new THREE.MeshStandardMaterial({
      color: 0x222222,
      roughness: 0.9,
      side: THREE.DoubleSide,
    });
    const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = lampY + 20;
    this.meshGroup.add(ceiling);

    // Lamp fixture (simple box)
    const fixtureMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.4,
      metalness: 0.6,
    });
    const fixture = new THREE.Mesh(
      new THREE.BoxGeometry(80, 8, 140),
      fixtureMat
    );
    fixture.position.set(0, lampY, 0);
    fixture.castShadow = true;
    this.meshGroup.add(fixture);

    // Warm point light from lamp
    const lampLight = new THREE.PointLight(0xffddaa, 0.8, 500);
    lampLight.position.set(0, lampY - 10, 0);
    lampLight.castShadow = true;
    lampLight.shadow.mapSize.width = 1024;
    lampLight.shadow.mapSize.height = 1024;
    this.meshGroup.add(lampLight);
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
