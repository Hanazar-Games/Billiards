import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { TABLE, BALL, POCKET } from '../config.js';

export class Table {
  constructor(physics) {
    this.physics = physics;
    this.meshGroup = new THREE.Group();
    this.bodies = [];

    this.createPlayingSurface();
    this.createCushions();
    this.createPockets();
    this.createRails();
    this.createLegs();
  }

  addToScene(scene) {
    scene.add(this.meshGroup);
    for (const body of this.bodies) {
      this.physics.addBody(body);
    }
  }

  createPlayingSurface() {
    const geometry = new THREE.BoxGeometry(TABLE.width, TABLE.height, TABLE.depth);
    const material = new THREE.MeshStandardMaterial({
      color: TABLE.feltColor,
      roughness: 0.95,
      metalness: 0.0,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = -TABLE.height / 2;
    mesh.receiveShadow = true;
    this.meshGroup.add(mesh);
  }

  createCushions() {
    const halfW = TABLE.width / 2;
    const halfD = TABLE.depth / 2;
    const cw = TABLE.cushionWidth;
    // Cushion vertical center aligned with ball center
    const cy = BALL.radius;
    const ch = BALL.radius; // half-height = ball radius => total height = 2*radius

    const cushionGap = BALL.radius * 3.5; // gap for corner pockets

    // Top cushion (short side with center pocket gap)
    this.addCushion(
      new THREE.BoxGeometry((TABLE.width - cushionGap * 2) / 2, ch * 2, cw),
      new CANNON.Box(new CANNON.Vec3((TABLE.width - cushionGap * 2) / 4, ch, cw / 2)),
      -(TABLE.width / 4 + cushionGap / 4), cy, -halfD + cw / 2
    );
    this.addCushion(
      new THREE.BoxGeometry((TABLE.width - cushionGap * 2) / 2, ch * 2, cw),
      new CANNON.Box(new CANNON.Vec3((TABLE.width - cushionGap * 2) / 4, ch, cw / 2)),
      (TABLE.width / 4 + cushionGap / 4), cy, -halfD + cw / 2
    );

    // Bottom cushion
    this.addCushion(
      new THREE.BoxGeometry((TABLE.width - cushionGap * 2) / 2, ch * 2, cw),
      new CANNON.Box(new CANNON.Vec3((TABLE.width - cushionGap * 2) / 4, ch, cw / 2)),
      -(TABLE.width / 4 + cushionGap / 4), cy, halfD - cw / 2
    );
    this.addCushion(
      new THREE.BoxGeometry((TABLE.width - cushionGap * 2) / 2, ch * 2, cw),
      new CANNON.Box(new CANNON.Vec3((TABLE.width - cushionGap * 2) / 4, ch, cw / 2)),
      (TABLE.width / 4 + cushionGap / 4), cy, halfD - cw / 2
    );

    // Left cushion (long side, no center pocket gap needed visually but keep uniform)
    this.addCushion(
      new THREE.BoxGeometry(cw, ch * 2, TABLE.depth - cushionGap * 2),
      new CANNON.Box(new CANNON.Vec3(cw / 2, ch, (TABLE.depth - cushionGap * 2) / 2)),
      -halfW + cw / 2, cy, 0
    );

    // Right cushion
    this.addCushion(
      new THREE.BoxGeometry(cw, ch * 2, TABLE.depth - cushionGap * 2),
      new CANNON.Box(new CANNON.Vec3(cw / 2, ch, (TABLE.depth - cushionGap * 2) / 2)),
      halfW - cw / 2, cy, 0
    );
  }

  addCushion(geo, shape, x, y, z) {
    const mat = new THREE.MeshStandardMaterial({
      color: TABLE.cushionColor,
      roughness: 0.7,
      metalness: 0.0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.meshGroup.add(mesh);

    const body = new CANNON.Body({
      mass: 0,
      material: this.physics.cushionMaterial,
    });
    body.addShape(shape);
    body.position.set(x, y, z);
    this.bodies.push(body);
  }

  createPockets() {
    const pocketMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 1.0 });

    const halfW = TABLE.width / 2;
    const halfD = TABLE.depth / 2;
    const positions = [
      [-halfW, 0, -halfD],
      [0, 0, -halfD],
      [halfW, 0, -halfD],
      [-halfW, 0, halfD],
      [0, 0, halfD],
      [halfW, 0, halfD],
    ];

    this.pocketPositions = [];

    for (const [x, y, z] of positions) {
      // Pocket hole (dark cylinder going down)
      const pocketGeo = new THREE.CylinderGeometry(POCKET.radius, POCKET.radius, TABLE.height + 4, 24);
      const mesh = new THREE.Mesh(pocketGeo, pocketMat);
      mesh.position.set(x, y - 2, z);
      mesh.receiveShadow = true;
      this.meshGroup.add(mesh);
      this.pocketPositions.push(new THREE.Vector3(x, y, z));
    }
  }

  createRails() {
    const railMat = new THREE.MeshStandardMaterial({
      color: TABLE.woodColor,
      roughness: 0.5,
      metalness: 0.1,
    });
    const railH = 8;
    const railW = 12;
    const halfW = TABLE.width / 2;
    const halfD = TABLE.depth / 2;

    // Top rail
    const rail1 = new THREE.Mesh(new THREE.BoxGeometry(TABLE.width + railW * 2, railH, railW), railMat);
    rail1.position.set(0, railH / 2, -halfD - railW / 2);
    rail1.castShadow = true;
    this.meshGroup.add(rail1);

    // Bottom rail
    const rail2 = new THREE.Mesh(new THREE.BoxGeometry(TABLE.width + railW * 2, railH, railW), railMat);
    rail2.position.set(0, railH / 2, halfD + railW / 2);
    rail2.castShadow = true;
    this.meshGroup.add(rail2);

    // Left rail
    const rail3 = new THREE.Mesh(new THREE.BoxGeometry(railW, railH, TABLE.depth), railMat);
    rail3.position.set(-halfW - railW / 2, railH / 2, 0);
    rail3.castShadow = true;
    this.meshGroup.add(rail3);

    // Right rail
    const rail4 = new THREE.Mesh(new THREE.BoxGeometry(railW, railH, TABLE.depth), railMat);
    rail4.position.set(halfW + railW / 2, railH / 2, 0);
    rail4.castShadow = true;
    this.meshGroup.add(rail4);
  }

  createLegs() {
    const legMat = new THREE.MeshStandardMaterial({
      color: TABLE.woodColor,
      roughness: 0.6,
      metalness: 0.05,
    });
    const legH = 60;
    const legSize = 10;
    const halfW = TABLE.width / 2 + 4;
    const halfD = TABLE.depth / 2 + 4;

    const positions = [
      [-halfW, -legH / 2 - TABLE.height, -halfD],
      [halfW, -legH / 2 - TABLE.height, -halfD],
      [-halfW, -legH / 2 - TABLE.height, halfD],
      [halfW, -legH / 2 - TABLE.height, halfD],
    ];

    for (const [x, y, z] of positions) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(legSize, legH, legSize), legMat);
      leg.position.set(x, y, z);
      leg.castShadow = true;
      leg.receiveShadow = true;
      this.meshGroup.add(leg);
    }
  }

  getPocketPositions() {
    return this.pocketPositions;
  }
}
