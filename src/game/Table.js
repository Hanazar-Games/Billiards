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
    this.createRailBevels();
    this.createApron();
    this.createPocketDetails();
    this.createPocketJaws();
    this.createRailSights();
    this.createCornerCaps();
    this.createLegs();
  }

  addToScene(scene) {
    this.physics.createTableBody();
    scene.add(this.meshGroup);
    for (const body of this.bodies) {
      this.physics.addBody(body);
    }
  }

  createPlayingSurface() {
    const geometry = new THREE.BoxGeometry(TABLE.width, TABLE.height, TABLE.depth);
    const material = new THREE.MeshStandardMaterial({
      color: TABLE.feltColor,
      roughness: 0.88,
      metalness: 0.0,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = -TABLE.height / 2;
    mesh.receiveShadow = true;
    this.meshGroup.add(mesh);

    const napGeo = new THREE.PlaneGeometry(TABLE.width - 20, TABLE.depth - 20, 1, 1);
    const napMat = new THREE.MeshStandardMaterial({
      color: 0x116b45,
      roughness: 1.0,
      metalness: 0.0,
      transparent: true,
      opacity: 0.32,
    });
    const nap = new THREE.Mesh(napGeo, napMat);
    nap.rotation.x = -Math.PI / 2;
    nap.position.y = 0.06;
    nap.receiveShadow = true;
    this.meshGroup.add(nap);

    const edgeMat = new THREE.MeshStandardMaterial({
      color: 0x083a25,
      roughness: 0.95,
      metalness: 0.0,
    });
    const edgeInset = 7;
    const edgeParts = [
      [0, 0.09, -TABLE.depth / 2 + edgeInset, TABLE.width - 18, 0.12, 1.2],
      [0, 0.09, TABLE.depth / 2 - edgeInset, TABLE.width - 18, 0.12, 1.2],
      [-TABLE.width / 2 + edgeInset, 0.09, 0, 1.2, 0.12, TABLE.depth - 18],
      [TABLE.width / 2 - edgeInset, 0.09, 0, 1.2, 0.12, TABLE.depth - 18],
    ];
    for (const [x, y, z, w, h, d] of edgeParts) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), edgeMat);
      edge.position.set(x, y, z);
      this.meshGroup.add(edge);
    }
  }

  createCushions() {
    const halfW = TABLE.width / 2;
    const halfD = TABLE.depth / 2;
    const cw = TABLE.cushionWidth;
    // Cushion vertical center aligned with ball center
    const cy = BALL.radius;
    const ch = BALL.radius; // half-height = ball radius => total height = 2*radius

    const cornerGap = POCKET.radius * 2.25;
    const sideGap = POCKET.radius * 2.65;

    // Short rails: one segment each, with only corner pocket gaps.
    const shortRailLen = TABLE.width - cornerGap * 2;
    this.addCushion(
      new THREE.BoxGeometry(shortRailLen, ch * 2, cw),
      new CANNON.Box(new CANNON.Vec3(shortRailLen / 2, ch, cw / 2)),
      0, cy, -halfD + cw / 2
    );
    this.addCushion(
      new THREE.BoxGeometry(shortRailLen, ch * 2, cw),
      new CANNON.Box(new CANNON.Vec3(shortRailLen / 2, ch, cw / 2)),
      0, cy, halfD - cw / 2
    );

    // Long rails: split around the side pockets and leave corner gaps.
    const longRailSegLen = (TABLE.depth - sideGap - cornerGap * 2) / 2;
    const zOffset = sideGap / 2 + longRailSegLen / 2;

    this.addCushion(
      new THREE.BoxGeometry(cw, ch * 2, longRailSegLen),
      new CANNON.Box(new CANNON.Vec3(cw / 2, ch, longRailSegLen / 2)),
      -halfW + cw / 2, cy, -zOffset
    );
    this.addCushion(
      new THREE.BoxGeometry(cw, ch * 2, longRailSegLen),
      new CANNON.Box(new CANNON.Vec3(cw / 2, ch, longRailSegLen / 2)),
      -halfW + cw / 2, cy, zOffset
    );
    this.addCushion(
      new THREE.BoxGeometry(cw, ch * 2, longRailSegLen),
      new CANNON.Box(new CANNON.Vec3(cw / 2, ch, longRailSegLen / 2)),
      halfW - cw / 2, cy, -zOffset
    );
    this.addCushion(
      new THREE.BoxGeometry(cw, ch * 2, longRailSegLen),
      new CANNON.Box(new CANNON.Vec3(cw / 2, ch, longRailSegLen / 2)),
      halfW - cw / 2, cy, zOffset
    );
  }

  addCushion(geo, shape, x, y, z) {
    const mat = new THREE.MeshStandardMaterial({
      color: TABLE.cushionColor,
      roughness: 0.78,
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
    const pocketMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1.0 });

    const halfW = TABLE.width / 2;
    const halfD = TABLE.depth / 2;
    const positions = [
      [-halfW, 0, -halfD],
      [halfW, 0, -halfD],
      [-halfW, 0, 0],
      [halfW, 0, 0],
      [-halfW, 0, halfD],
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
      color: 0x4a2a14,
      roughness: 0.42,
      metalness: 0.12,
    });
    const railH = 8;
    const railW = 12;
    const halfW = TABLE.width / 2;
    const halfD = TABLE.depth / 2;

    const cornerGap = POCKET.radius * 2.9;
    const shortRailLen = TABLE.width - cornerGap * 2;

    // Top rail
    const rail1 = new THREE.Mesh(new THREE.BoxGeometry(shortRailLen, railH, railW), railMat);
    rail1.position.set(0, railH / 2, -halfD - railW / 2);
    rail1.castShadow = true;
    this.meshGroup.add(rail1);

    // Bottom rail
    const rail2 = new THREE.Mesh(new THREE.BoxGeometry(shortRailLen, railH, railW), railMat);
    rail2.position.set(0, railH / 2, halfD + railW / 2);
    rail2.castShadow = true;
    this.meshGroup.add(rail2);

    // Side rails are split around the middle pockets so balls do not appear
    // to pass through wood when they fall into a side pocket.
    const sideGap = POCKET.radius * 3.05;
    const sideRailLen = (TABLE.depth - sideGap) / 2;
    const sideZ = sideGap / 2 + sideRailLen / 2;
    const sideX = [-halfW - railW / 2, halfW + railW / 2];
    for (const x of sideX) {
      for (const z of [-sideZ, sideZ]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(railW, railH, sideRailLen), railMat);
        rail.position.set(x, railH / 2, z);
        rail.castShadow = true;
        this.meshGroup.add(rail);
      }
    }
  }

  createRailBevels() {
    const bevelMat = new THREE.MeshStandardMaterial({
      color: 0x9c5e26,
      roughness: 0.34,
      metalness: 0.16,
    });
    const halfW = TABLE.width / 2;
    const halfD = TABLE.depth / 2;
    const cornerGap = POCKET.radius * 3.0;
    const shortLen = TABLE.width - cornerGap * 2;
    const sideGap = POCKET.radius * 3.1;
    const sideLen = (TABLE.depth - sideGap) / 2;
    const sideZ = sideGap / 2 + sideLen / 2;

    const bevels = [
      [0, 9.4, -halfD - 0.8, shortLen, 1.4, 2.2],
      [0, 9.4, halfD + 0.8, shortLen, 1.4, 2.2],
    ];
    for (const z of [-sideZ, sideZ]) {
      bevels.push([-halfW - 0.8, 9.4, z, 2.2, 1.4, sideLen]);
      bevels.push([halfW + 0.8, 9.4, z, 2.2, 1.4, sideLen]);
    }

    for (const [x, y, z, w, h, d] of bevels) {
      const bevel = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bevelMat);
      bevel.position.set(x, y, z);
      bevel.castShadow = true;
      this.meshGroup.add(bevel);
    }
  }

  createApron() {
    const apronMat = new THREE.MeshStandardMaterial({
      color: 0x2a160b,
      roughness: 0.48,
      metalness: 0.08,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xb87935,
      roughness: 0.35,
      metalness: 0.18,
    });
    const halfW = TABLE.width / 2;
    const halfD = TABLE.depth / 2;

    const parts = [
      [0, -13, -halfD - 10, TABLE.width + 26, 16, 8],
      [0, -13, halfD + 10, TABLE.width + 26, 16, 8],
      [-halfW - 10, -13, 0, 8, 16, TABLE.depth + 18],
      [halfW + 10, -13, 0, 8, 16, TABLE.depth + 18],
    ];

    for (const [x, y, z, w, h, d] of parts) {
      const apron = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), apronMat);
      apron.position.set(x, y, z);
      apron.castShadow = true;
      apron.receiveShadow = true;
      this.meshGroup.add(apron);
    }

    const trims = [
      [0, 7.5, -halfD - 7, TABLE.width + 18, 2.2, 2.4],
      [0, 7.5, halfD + 7, TABLE.width + 18, 2.2, 2.4],
      [-halfW - 7, 7.5, 0, 2.4, 2.2, TABLE.depth + 14],
      [halfW + 7, 7.5, 0, 2.4, 2.2, TABLE.depth + 14],
    ];

    for (const [x, y, z, w, h, d] of trims) {
      const trim = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), trimMat);
      trim.position.set(x, y, z);
      trim.castShadow = true;
      this.meshGroup.add(trim);
    }
  }

  createPocketDetails() {
    const linerMat = new THREE.MeshStandardMaterial({
      color: 0x090909,
      roughness: 0.78,
      metalness: 0.05,
    });
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x101010,
      roughness: 0.45,
      metalness: 0.35,
    });
    const cupMat = new THREE.MeshStandardMaterial({
      color: 0x030303,
      roughness: 0.9,
      metalness: 0.02,
    });

    for (const pocket of this.pocketPositions) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(POCKET.radius * 1.12, 1.65, 12, 48),
        ringMat
      );
      ring.position.set(pocket.x, 1.1, pocket.z);
      ring.rotation.x = Math.PI / 2;
      ring.castShadow = true;
      this.meshGroup.add(ring);

      const drop = new THREE.Mesh(
        new THREE.CylinderGeometry(POCKET.radius * 0.96, POCKET.radius * 0.7, 18, 36),
        linerMat
      );
      drop.position.set(pocket.x, -7, pocket.z);
      drop.receiveShadow = true;
      this.meshGroup.add(drop);

      const cup = new THREE.Mesh(
        new THREE.CylinderGeometry(POCKET.radius * 0.7, POCKET.radius * 0.52, 8, 32),
        cupMat
      );
      cup.position.set(pocket.x, -18, pocket.z);
      cup.receiveShadow = true;
      this.meshGroup.add(cup);
    }
  }

  createPocketJaws() {
    const jawMat = new THREE.MeshStandardMaterial({
      color: 0x050505,
      roughness: 0.62,
      metalness: 0.18,
    });
    const halfW = TABLE.width / 2;
    const halfD = TABLE.depth / 2;

    const addJaw = (x, z, angle, length = 12) => {
      const jaw = new THREE.Mesh(new THREE.BoxGeometry(length, 2.4, 3.2), jawMat);
      jaw.position.set(x, 4.8, z);
      jaw.rotation.y = angle;
      jaw.castShadow = true;
      this.meshGroup.add(jaw);
    };

    const inset = POCKET.radius * 0.95;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        addJaw(sx * (halfW - inset * 0.55), sz * (halfD + 2.2), 0, 11);
        addJaw(sx * (halfW + 2.2), sz * (halfD - inset * 0.55), Math.PI / 2, 11);
      }
    }

    for (const sx of [-1, 1]) {
      addJaw(sx * (halfW + 2.2), -POCKET.radius * 1.28, Math.PI / 2, 13);
      addJaw(sx * (halfW + 2.2), POCKET.radius * 1.28, Math.PI / 2, 13);
    }
  }

  createRailSights() {
    const sightMat = new THREE.MeshStandardMaterial({
      color: 0xf3e6c7,
      roughness: 0.18,
      metalness: 0.05,
      emissive: 0x1c1408,
      emissiveIntensity: 0.15,
    });
    const halfW = TABLE.width / 2;
    const halfD = TABLE.depth / 2;
    const positions = [];

    for (const x of [-halfW * 0.66, -halfW * 0.33, 0, halfW * 0.33, halfW * 0.66]) {
      positions.push([x, halfD + 6, Math.PI / 2]);
      positions.push([x, -halfD - 6, Math.PI / 2]);
    }
    for (const z of [-halfD * 0.5, 0, halfD * 0.5]) {
      positions.push([halfW + 6, z, 0]);
      positions.push([-halfW - 6, z, 0]);
    }

    for (const [x, z, rot] of positions) {
      const sight = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.45, 20), sightMat);
      sight.position.set(x, 8.2, z);
      sight.rotation.z = rot;
      this.meshGroup.add(sight);
    }
  }

  createCornerCaps() {
    const capMat = new THREE.MeshStandardMaterial({
      color: 0x171717,
      roughness: 0.28,
      metalness: 0.65,
    });
    const halfW = TABLE.width / 2;
    const halfD = TABLE.depth / 2;
    const capPositions = [
      [-halfW - 7, 7, -halfD - 7],
      [halfW + 7, 7, -halfD - 7],
      [-halfW - 7, 7, halfD + 7],
      [halfW + 7, 7, halfD + 7],
    ];

    for (const [x, y, z] of capPositions) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 3, 28), capMat);
      cap.position.set(x, y, z);
      cap.castShadow = true;
      this.meshGroup.add(cap);
    }
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

  dispose() {
    // Remove Three.js meshes
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

    // Remove physics bodies
    if (this.physics) {
      for (const body of this.bodies) {
        this.physics.removeBody(body);
      }
    }
    this.bodies = [];
  }
}
