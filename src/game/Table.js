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
    this.createPocketNets();
    this.createPocketJaws();
    this.createTournamentCastings();
    this.createApronPanelDetails();
    this.createHiddenStretcher();
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

    // Slate bed edge — the exposed grey stone under the cloth.
    // Real pool tables show a thin band of slate around the perimeter.
    const slateMat = new THREE.MeshStandardMaterial({
      color: 0x6e7068,
      roughness: 0.6,
      metalness: 0.02,
    });
    const slateH = 2.2;
    const slateOverhang = 1.5;
    // Shift slate down by 0.5 to avoid z-fighting with the playing surface (y=0)
    const slateY = -slateH / 2 - 0.5;
    const slateParts = [
      [0, slateY, -TABLE.depth / 2 - slateOverhang / 2, TABLE.width + 4, slateH, slateOverhang],
      [0, slateY, TABLE.depth / 2 + slateOverhang / 2, TABLE.width + 4, slateH, slateOverhang],
      [-TABLE.width / 2 - slateOverhang / 2, slateY, 0, slateOverhang, slateH, TABLE.depth + 4],
      [TABLE.width / 2 + slateOverhang / 2, slateY, 0, slateOverhang, slateH, TABLE.depth + 4],
    ];
    for (const [x, y, z, w, h, d] of slateParts) {
      const slate = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), slateMat);
      slate.position.set(x, y, z);
      slate.receiveShadow = true;
      this.meshGroup.add(slate);
    }
  }

  createCushions() {
    const halfW = TABLE.width / 2;
    const halfD = TABLE.depth / 2;
    const cw = TABLE.cushionWidth;
    const cy = BALL.radius;
    const ch = BALL.radius;

    const cornerGap = POCKET.radius * 2.25;
    const sideGap = POCKET.radius * 2.65;

    const shortRailLen = TABLE.width - cornerGap * 2;
    this.addCushion(
      new THREE.BoxGeometry(shortRailLen, ch * 2, cw),
      new CANNON.Box(new CANNON.Vec3(shortRailLen / 2, ch, cw / 2)),
      0, cy, -halfD + cw / 2, 0, 1
    );
    this.addCushion(
      new THREE.BoxGeometry(shortRailLen, ch * 2, cw),
      new CANNON.Box(new CANNON.Vec3(shortRailLen / 2, ch, cw / 2)),
      0, cy, halfD - cw / 2, 0, -1
    );

    const longRailSegLen = (TABLE.depth - sideGap - cornerGap * 2) / 2;
    const zOffset = sideGap / 2 + longRailSegLen / 2;

    this.addCushion(
      new THREE.BoxGeometry(cw, ch * 2, longRailSegLen),
      new CANNON.Box(new CANNON.Vec3(cw / 2, ch, longRailSegLen / 2)),
      -halfW + cw / 2, cy, -zOffset, 1, 0
    );
    this.addCushion(
      new THREE.BoxGeometry(cw, ch * 2, longRailSegLen),
      new CANNON.Box(new CANNON.Vec3(cw / 2, ch, longRailSegLen / 2)),
      -halfW + cw / 2, cy, zOffset, 1, 0
    );
    this.addCushion(
      new THREE.BoxGeometry(cw, ch * 2, longRailSegLen),
      new CANNON.Box(new CANNON.Vec3(cw / 2, ch, longRailSegLen / 2)),
      halfW - cw / 2, cy, -zOffset, -1, 0
    );
    this.addCushion(
      new THREE.BoxGeometry(cw, ch * 2, longRailSegLen),
      new CANNON.Box(new CANNON.Vec3(cw / 2, ch, longRailSegLen / 2)),
      halfW - cw / 2, cy, zOffset, -1, 0
    );
  }

  addCushion(geo, shape, x, y, z, bevelNx, bevelNz) {
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

    // Sloped inner face — the angled surface that faces the playing area.
    // Real cushions are triangular in cross-section, not rectangular boxes.
    if (bevelNx !== 0 || bevelNz !== 0) {
      this._addCushionBevel(x, y, z, geo, bevelNx, bevelNz);
    }

    const body = new CANNON.Body({
      mass: 0,
      material: this.physics.cushionMaterial,
    });
    body.addShape(shape);
    body.position.set(x, y, z);
    this.bodies.push(body);
  }

  _addCushionBevel(cx, cy, cz, geo, nx, nz) {
    const h = BALL.radius * 2;
    const inset = TABLE.cushionWidth / 2;
    const overhang = 3.2;

    let width, len;
    if (Math.abs(nx) > 0.5) {
      // Long rail — geometry runs along Z
      len = geo.parameters.depth;
      width = len;
    } else {
      // Short rail — geometry runs along X
      len = geo.parameters.width;
      width = len;
    }

    // 4 corners of the sloped quad
    const v = [];
    if (Math.abs(nx) > 0.5) {
      // Long rail: bevel extends along X (nx direction)
      v.push(cx + nx * inset, h, cz - width / 2);
      v.push(cx + nx * inset, h, cz + width / 2);
      v.push(cx + nx * (inset + overhang), 0, cz - width / 2);
      v.push(cx + nx * (inset + overhang), 0, cz + width / 2);
    } else {
      // Short rail: bevel extends along Z (nz direction)
      v.push(cx - width / 2, h, cz + nz * inset);
      v.push(cx + width / 2, h, cz + nz * inset);
      v.push(cx - width / 2, 0, cz + nz * (inset + overhang));
      v.push(cx + width / 2, 0, cz + nz * (inset + overhang));
    }

    const bevelGeo = new THREE.BufferGeometry();
    const positions = new Float32Array([
      v[0], v[1], v[2],  v[3], v[4], v[5],  v[6], v[7], v[8],
      v[3], v[4], v[5],  v[9], v[10], v[11],  v[6], v[7], v[8],
    ]);
    bevelGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    bevelGeo.computeVertexNormals();

    const bevelMat = new THREE.MeshStandardMaterial({
      color: 0x0b5c32,
      roughness: 0.85,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });
    const bevelMesh = new THREE.Mesh(bevelGeo, bevelMat);
    bevelMesh.castShadow = true;
    bevelMesh.receiveShadow = true;
    this.meshGroup.add(bevelMesh);
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
      color: 0x221a16,
      roughness: 0.36,
      metalness: 0.18,
    });
    const topInsertMat = new THREE.MeshStandardMaterial({
      color: 0x604328,
      roughness: 0.32,
      metalness: 0.08,
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
    this._addRailTopInsert(0, railH + 1.0, -halfD - railW / 2, shortRailLen - 12, 1.2, railW * 0.62, topInsertMat);

    // Bottom rail
    const rail2 = new THREE.Mesh(new THREE.BoxGeometry(shortRailLen, railH, railW), railMat);
    rail2.position.set(0, railH / 2, halfD + railW / 2);
    rail2.castShadow = true;
    this.meshGroup.add(rail2);
    this._addRailTopInsert(0, railH + 1.0, halfD + railW / 2, shortRailLen - 12, 1.2, railW * 0.62, topInsertMat);

    // Rail top round-over — a thin tube along the outer top edge of each rail
    const roundMat = new THREE.MeshStandardMaterial({
      color: 0x2e231d,
      roughness: 0.3,
      metalness: 0.22,
    });
    const roundTubeR = 0.9;
    const roundShort = new THREE.Mesh(
      new THREE.CylinderGeometry(roundTubeR, roundTubeR, shortRailLen, 14, 1, false, 0, Math.PI),
      roundMat
    );
    roundShort.rotation.z = Math.PI / 2;
    roundShort.position.set(0, railH + roundTubeR, -halfD - railW / 2 + roundTubeR);
    roundShort.castShadow = true;
    this.meshGroup.add(roundShort);

    const roundShort2 = roundShort.clone();
    roundShort2.position.set(0, railH + roundTubeR, halfD + railW / 2 - roundTubeR);
    this.meshGroup.add(roundShort2);

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
        this._addRailTopInsert(x, railH + 1.0, z, railW * 0.62, 1.2, sideRailLen - 10, topInsertMat);
      }
    }

    // Side rail top round-overs
    for (const x of sideX) {
      for (const z of [-sideZ, sideZ]) {
        const roundSide = new THREE.Mesh(
          new THREE.CylinderGeometry(roundTubeR, roundTubeR, sideRailLen, 14, 1, false, 0, Math.PI),
          roundMat
        );
        roundSide.rotation.x = Math.PI / 2;
        const nx = x < 0 ? 1 : -1;
        roundSide.position.set(x + nx * roundTubeR, railH + roundTubeR, z);
        roundSide.castShadow = true;
        this.meshGroup.add(roundSide);
      }
    }
  }

  _addRailTopInsert(x, y, z, w, h, d, material) {
    const insert = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    insert.position.set(x, y, z);
    insert.castShadow = true;
    insert.receiveShadow = true;
    this.meshGroup.add(insert);
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
      [0, 10.2, -halfD - 0.8, shortLen, 1.0, 2.2],
      [0, 10.2, halfD + 0.8, shortLen, 1.0, 2.2],
    ];
    for (const z of [-sideZ, sideZ]) {
      bevels.push([-halfW - 0.8, 10.2, z, 2.2, 1.0, sideLen]);
      bevels.push([halfW + 0.8, 10.2, z, 2.2, 1.0, sideLen]);
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
      color: 0x151313,
      roughness: 0.42,
      metalness: 0.14,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xb9aaa0,
      roughness: 0.22,
      metalness: 0.62,
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

    // Trims sit on top of rails, not inside them
    const trims = [
      [0, 8.2, -halfD - 7, TABLE.width + 18, 0.5, 2.4],
      [0, 8.2, halfD + 7, TABLE.width + 18, 0.5, 2.4],
      [-halfW - 7, 8.2, 0, 2.4, 0.5, TABLE.depth + 14],
      [halfW + 7, 8.2, 0, 2.4, 0.5, TABLE.depth + 14],
    ];

    for (const [x, y, z, w, h, d] of trims) {
      const trim = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), trimMat);
      trim.position.set(x, y, z);
      trim.castShadow = true;
      this.meshGroup.add(trim);
    }

    // Apron corner decorative brackets — cast-metal L-shaped plates
    const bracketMat = new THREE.MeshStandardMaterial({
      color: 0x8a8078,
      roughness: 0.22,
      metalness: 0.72,
    });
    const bracketPositions = [
      [-halfW - 5, -2, -halfD - 5],
      [halfW + 5, -2, -halfD - 5],
      [-halfW - 5, -2, halfD + 5],
      [halfW + 5, -2, halfD + 5],
    ];
    for (const [x, y, z] of bracketPositions) {
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 5), bracketMat);
      bracket.position.set(x, y, z);
      bracket.castShadow = true;
      this.meshGroup.add(bracket);

      const bolt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.6, 0.6, 0.8, 12),
        bracketMat
      );
      bolt.position.set(x, y + 1.9, z);
      this.meshGroup.add(bolt);
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
    const leatherMat = new THREE.MeshStandardMaterial({
      color: 0x3d2314,
      roughness: 0.62,
      metalness: 0.04,
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

      // Leather pocket facing — the wide leather ring around the mouth
      const facing = new THREE.Mesh(
        new THREE.TorusGeometry(POCKET.radius * 1.32, 2.4, 10, 48),
        leatherMat
      );
      facing.position.set(pocket.x, 0.35, pocket.z);
      facing.rotation.x = Math.PI / 2;
      facing.castShadow = true;
      this.meshGroup.add(facing);

      const drop = new THREE.Mesh(
        new THREE.CylinderGeometry(POCKET.radius * 0.96, POCKET.radius * 0.7, 16, 36),
        linerMat
      );
      drop.position.set(pocket.x, -8, pocket.z);
      drop.receiveShadow = true;
      this.meshGroup.add(drop);

      const cup = new THREE.Mesh(
        new THREE.CylinderGeometry(POCKET.radius * 0.7, POCKET.radius * 0.52, 8, 32),
        cupMat
      );
      cup.position.set(pocket.x, -19, pocket.z);
      cup.receiveShadow = true;
      this.meshGroup.add(cup);
    }
  }

  createPocketNets() {
    // Leather pocket nets — a series of shrinking rings below each pocket.
    const netMat = new THREE.MeshStandardMaterial({
      color: 0x1a1208,
      roughness: 0.72,
      metalness: 0.08,
    });
    const chainMat = new THREE.MeshStandardMaterial({
      color: 0x3a2e1e,
      roughness: 0.45,
      metalness: 0.35,
    });

    for (const pocket of this.pocketPositions) {
      const count = 5;
      for (let i = 0; i < count; i++) {
        const t = (i + 1) / (count + 1);
        const radius = POCKET.radius * (0.85 - t * 0.45);
        const y = -2 - t * 14;
        const tube = 0.7 - t * 0.35;

        const link = new THREE.Mesh(
          new THREE.TorusGeometry(radius, Math.max(0.25, tube), 10, 32),
          i % 2 === 0 ? netMat : chainMat
        );
        link.position.set(pocket.x, y, pocket.z);
        link.rotation.x = Math.PI / 2 + (Math.random() - 0.5) * 0.06;
        this.meshGroup.add(link);
      }
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
      const jaw = new THREE.Mesh(new THREE.BoxGeometry(length, 1.5, 3.2), jawMat);
      jaw.position.set(x, 5.7 + 0.75, z);
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

  createTournamentCastings() {
    const nickelMat = new THREE.MeshStandardMaterial({
      color: 0xb8b0a6,
      roughness: 0.18,
      metalness: 0.78,
    });
    const blackInsetMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a0b,
      roughness: 0.32,
      metalness: 0.28,
    });
    const halfW = TABLE.width / 2;
    const halfD = TABLE.depth / 2;
    const railTopY = 9.35;

    const cornerPositions = [
      [-halfW - 6.8, -halfD - 6.8, Math.PI / 4],
      [halfW + 6.8, -halfD - 6.8, -Math.PI / 4],
      [-halfW - 6.8, halfD + 6.8, -Math.PI / 4],
      [halfW + 6.8, halfD + 6.8, Math.PI / 4],
    ];

    for (const [x, z, rot] of cornerPositions) {
      const casting = new THREE.Mesh(new THREE.BoxGeometry(18, 2.7, 10), nickelMat);
      casting.position.set(x, railTopY, z);
      casting.rotation.y = rot;
      casting.castShadow = true;
      casting.receiveShadow = true;
      this.meshGroup.add(casting);

      const pad = new THREE.Mesh(new THREE.BoxGeometry(12.5, 0.7, 6.4), blackInsetMat);
      pad.position.set(x, railTopY + 1.55, z);
      pad.rotation.y = rot;
      pad.castShadow = true;
      this.meshGroup.add(pad);
    }

    for (const sx of [-1, 1]) {
      const x = sx * (halfW + 6.3);
      for (const z of [-12.5, 12.5]) {
        const sideCasting = new THREE.Mesh(new THREE.BoxGeometry(8.5, 2.6, 18), nickelMat);
        sideCasting.position.set(x, railTopY, z);
        sideCasting.castShadow = true;
        sideCasting.receiveShadow = true;
        this.meshGroup.add(sideCasting);
      }
    }

    const seamMat = new THREE.MeshStandardMaterial({
      color: 0xd8d0c4,
      roughness: 0.2,
      metalness: 0.7,
    });
    const seamPositions = [
      [-halfW * 0.34, -halfD - 6],
      [halfW * 0.34, -halfD - 6],
      [-halfW * 0.34, halfD + 6],
      [halfW * 0.34, halfD + 6],
    ];
    for (const [x, z] of seamPositions) {
      const seam = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.6, 9.2), seamMat);
      seam.position.set(x, 9.55, z);
      seam.castShadow = true;
      this.meshGroup.add(seam);
    }
  }

  createApronPanelDetails() {
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0x090909,
      roughness: 0.5,
      metalness: 0.22,
    });
    const nickelMat = new THREE.MeshStandardMaterial({
      color: 0xb7aea3,
      roughness: 0.2,
      metalness: 0.72,
    });
    const badgeMat = new THREE.MeshStandardMaterial({
      color: 0xe2d8c9,
      roughness: 0.16,
      metalness: 0.82,
    });
    const halfW = TABLE.width / 2;
    const halfD = TABLE.depth / 2;

    const panels = [
      [0, -11.8, -halfD - 14.4, TABLE.width * 0.72, 7.2, 0.9],
      [0, -11.8, halfD + 14.4, TABLE.width * 0.72, 7.2, 0.9],
      [-halfW - 14.4, -11.8, 0, 0.9, 7.2, TABLE.depth * 0.66],
      [halfW + 14.4, -11.8, 0, 0.9, 7.2, TABLE.depth * 0.66],
    ];

    for (const [x, y, z, w, h, d] of panels) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), panelMat);
      panel.position.set(x, y, z);
      panel.receiveShadow = true;
      this.meshGroup.add(panel);
    }

    const shortBadges = [
      [0, -7.4, -halfD - 15.05, TABLE.width * 0.28, 2.2, 0.6],
      [0, -7.4, halfD + 15.05, TABLE.width * 0.28, 2.2, 0.6],
    ];
    for (const [x, y, z, w, h, d] of shortBadges) {
      const badge = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), badgeMat);
      badge.position.set(x, y, z);
      badge.castShadow = true;
      this.meshGroup.add(badge);
    }

    const sideStrips = [
      [-halfW - 15.05, -7.4, -TABLE.depth * 0.26, 0.6, 2.0, 26],
      [-halfW - 15.05, -7.4, TABLE.depth * 0.26, 0.6, 2.0, 26],
      [halfW + 15.05, -7.4, -TABLE.depth * 0.26, 0.6, 2.0, 26],
      [halfW + 15.05, -7.4, TABLE.depth * 0.26, 0.6, 2.0, 26],
    ];
    for (const [x, y, z, w, h, d] of sideStrips) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), nickelMat);
      strip.position.set(x, y, z);
      strip.castShadow = true;
      this.meshGroup.add(strip);
    }
  }

  createHiddenStretcher() {
    const stretcherMat = new THREE.MeshStandardMaterial({
      color: 0x101010,
      roughness: 0.48,
      metalness: 0.18,
    });
    const nickelMat = new THREE.MeshStandardMaterial({
      color: 0xa89d92,
      roughness: 0.2,
      metalness: 0.7,
    });

    const spine = new THREE.Mesh(new THREE.BoxGeometry(14, 7, TABLE.depth * 0.54), stretcherMat);
    spine.position.set(0, -49, 0);
    spine.castShadow = true;
    spine.receiveShadow = true;
    this.meshGroup.add(spine);

    for (const z of [-TABLE.depth * 0.2, TABLE.depth * 0.2]) {
      const collar = new THREE.Mesh(new THREE.BoxGeometry(16, 1.6, 5.5), nickelMat);
      collar.position.set(0, -44.6, z);
      collar.castShadow = true;
      this.meshGroup.add(collar);
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
      color: 0x0e0f10,
      roughness: 0.24,
      metalness: 0.72,
    });
    const nickelMat = new THREE.MeshStandardMaterial({
      color: 0xb6ada3,
      roughness: 0.2,
      metalness: 0.75,
    });
    const halfW = TABLE.width / 2;
    const halfD = TABLE.depth / 2;
    const capPositions = [
      [-halfW - 7, 9.0, -halfD - 7],
      [halfW + 7, 9.0, -halfD - 7],
      [-halfW - 7, 9.0, halfD + 7],
      [halfW + 7, 9.0, halfD + 7],
    ];

    for (const [x, y, z] of capPositions) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(10, 8.6, 2.0, 8), capMat);
      cap.position.set(x, y, z);
      cap.rotation.y = Math.PI / 8;
      cap.castShadow = true;
      this.meshGroup.add(cap);

      const crown = new THREE.Mesh(new THREE.CylinderGeometry(6.8, 6.8, 0.75, 8), nickelMat);
      crown.position.set(x, y + 1.2, z);
      crown.rotation.y = Math.PI / 8;
      crown.castShadow = true;
      this.meshGroup.add(crown);
    }
  }

  createLegs() {
    const legMat = new THREE.MeshStandardMaterial({
      color: 0x15100d,
      roughness: 0.42,
      metalness: 0.18,
    });
    const faceMat = new THREE.MeshStandardMaterial({
      color: 0x2d2118,
      roughness: 0.36,
      metalness: 0.12,
    });
    const footMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a0a,
      roughness: 0.3,
      metalness: 0.55,
    });
    const levelerMat = new THREE.MeshStandardMaterial({
      color: 0xc8c0b7,
      roughness: 0.18,
      metalness: 0.85,
    });
    const legH = 54;
    const halfW = TABLE.width / 2 + 7;
    const halfD = TABLE.depth / 2 + 9;

    const positions = [
      [-halfW, -legH / 2 - TABLE.height, -halfD, 1],
      [halfW, -legH / 2 - TABLE.height, -halfD, -1],
      [-halfW, -legH / 2 - TABLE.height, halfD, -1],
      [halfW, -legH / 2 - TABLE.height, halfD, 1],
    ];

    for (const [x, y, z, tilt] of positions) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(14, legH, 18), legMat);
      leg.position.set(x, y, z);
      leg.rotation.z = tilt * 0.08;
      leg.castShadow = true;
      leg.receiveShadow = true;
      this.meshGroup.add(leg);

      const face = new THREE.Mesh(new THREE.BoxGeometry(11.5, legH * 0.72, 1.1), faceMat);
      face.position.set(x, y + 2, z + Math.sign(z) * 9.6);
      face.rotation.z = tilt * 0.08;
      face.castShadow = true;
      this.meshGroup.add(face);

      const base = new THREE.Mesh(new THREE.BoxGeometry(22, 5.4, 25), footMat);
      base.position.set(x, -legH - TABLE.height - 2.7, z);
      base.castShadow = true;
      base.receiveShadow = true;
      this.meshGroup.add(base);

      const leveler = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.8, 1.5, 28), levelerMat);
      leveler.position.set(x, -legH - TABLE.height - 6.2, z);
      leveler.castShadow = true;
      leveler.receiveShadow = true;
      this.meshGroup.add(leveler);
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
