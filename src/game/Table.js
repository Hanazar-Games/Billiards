import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { TABLE, BALL } from '../config.js';
import { getDefaultTableProfile } from './TableProfiles.js';
import {
  TABLE_THEMES, FELT_THEMES, WOOD_THEMES, METAL_TRIM_THEMES, POCKET_LEATHER_THEMES,
  applyMaterialTheme,
} from '../theme/TableThemes.js';
import { createClothNapTexture, createClothPatternTexture, createClothWearTexture } from '../theme/ProceduralTextures.js';

export class Table {
  constructor(physics, tableProfile = null) {
    this.physics = physics;
    this.profile = tableProfile || getDefaultTableProfile();
    this.meshGroup = new THREE.Group();
    this.bodies = [];
    this._materials = {};
    this._themeMeshes = {};
    this._clothTextures = {};

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

  _mat(name, props) {
    const mat = new THREE.MeshStandardMaterial(props);
    this._materials[name] = mat;
    return mat;
  }

  createPlayingSurface() {
    const geo = new THREE.BoxGeometry(this.profile.width, this.profile.height, this.profile.depth);
    const mat = this._mat('felt', {
      color: TABLE.feltColor,
      roughness: 0.88,
      metalness: 0.0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = -this.profile.height / 2;
    mesh.receiveShadow = true;
    this.meshGroup.add(mesh);

    // Cloth nap overlay
    const napGeo = new THREE.PlaneGeometry(this.profile.width - 20, this.profile.depth - 20, 1, 1);
    const napMat = this._mat('nap', {
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
    this._themeMeshes.nap = nap;

    // Edge strips
    const edgeMat = this._mat('edge', {
      color: 0x083a25,
      roughness: 0.95,
      metalness: 0.0,
    });
    const edgeInset = 7;
    const edgeParts = [
      [0, 0.09, -this.profile.depth / 2 + edgeInset, this.profile.width - 18, 0.12, 1.2],
      [0, 0.09, this.profile.depth / 2 - edgeInset, this.profile.width - 18, 0.12, 1.2],
      [-this.profile.width / 2 + edgeInset, 0.09, 0, 1.2, 0.12, this.profile.depth - 18],
      [this.profile.width / 2 - edgeInset, 0.09, 0, 1.2, 0.12, this.profile.depth - 18],
    ];
    for (const [x, y, z, w, h, d] of edgeParts) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), edgeMat);
      edge.position.set(x, y, z);
      this.meshGroup.add(edge);
    }

    // Slate bed edge
    const slateMat = this._mat('slate', {
      color: 0x6e7068,
      roughness: 0.6,
      metalness: 0.02,
    });
    const slateH = 2.2;
    const slateOverhang = 1.5;
    const slateY = -slateH / 2 - 0.5;
    const slateParts = [
      [0, slateY, -this.profile.depth / 2 - slateOverhang / 2, this.profile.width + 4, slateH, slateOverhang],
      [0, slateY, this.profile.depth / 2 + slateOverhang / 2, this.profile.width + 4, slateH, slateOverhang],
      [-this.profile.width / 2 - slateOverhang / 2, slateY, 0, slateOverhang, slateH, this.profile.depth + 4],
      [this.profile.width / 2 + slateOverhang / 2, slateY, 0, slateOverhang, slateH, this.profile.depth + 4],
    ];
    for (const [x, y, z, w, h, d] of slateParts) {
      const slate = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), slateMat);
      slate.position.set(x, y, z);
      slate.receiveShadow = true;
      this.meshGroup.add(slate);
    }
  }

  createCushions() {
    const halfW = this.profile.width / 2;
    const halfD = this.profile.depth / 2;
    const cw = this.profile.cushionWidth;
    const cy = BALL.radius;
    const ch = BALL.radius;

    const cornerR = this.profile.cornerPocketRadius ?? this.profile.pocketRadius;
    const sideR = this.profile.sidePocketRadius ?? this.profile.pocketRadius;

    const cornerGap = cornerR * 2.25;
    const sideGap = sideR * 2.65;

    const shortRailLen = this.profile.width - cornerGap * 2;
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

    const longRailSegLen = (this.profile.depth - sideGap - cornerGap * 2) / 2;
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
    if (!this._materials.cushion) {
      this._materials.cushion = this._mat('cushion', {
        color: TABLE.cushionColor,
        roughness: 0.78,
        metalness: 0.0,
      });
    }
    const mat = this._materials.cushion;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.meshGroup.add(mesh);

    if (bevelNx !== 0 || bevelNz !== 0) {
      this._addCushionBevel(x, y, z, geo, bevelNx, bevelNz);
    }

    const body = new CANNON.Body({
      mass: 0,
      material: this.physics.cushionMaterial,
    });
    body.addShape(shape);
    body.position.set(x, y, z);

    if (bevelNx !== 0 || bevelNz !== 0) {
      this._addCushionBevelPhysics(body, x, y, z, geo, bevelNx, bevelNz);
    }

    this.bodies.push(body);
  }

  _addCushionBevel(cx, cy, cz, geo, nx, nz) {
    const h = BALL.radius * 2;
    const inset = this.profile.cushionWidth / 2;
    const overhang = 3.2;
    const thick = 0.9;

    let width, len;
    if (Math.abs(nx) > 0.5) {
      len = geo.parameters.depth;
      width = len;
    } else {
      len = geo.parameters.width;
      width = len;
    }

    const v = [];
    if (Math.abs(nx) > 0.5) {
      v.push(cx + nx * inset, 0, cz - width / 2);
      v.push(cx + nx * inset, 0, cz + width / 2);
      v.push(cx + nx * (inset + overhang), h, cz - width / 2);
      v.push(cx + nx * (inset + overhang), h, cz + width / 2);
    } else {
      v.push(cx - width / 2, 0, cz + nz * inset);
      v.push(cx + width / 2, 0, cz + nz * inset);
      v.push(cx - width / 2, h, cz + nz * (inset + overhang));
      v.push(cx + width / 2, h, cz + nz * (inset + overhang));
    }

    const dx = -nx * thick;
    const dz = -nz * thick;
    const p = v;
    const pb = [
      v[0] + dx, v[1], v[2] + dz,
      v[3] + dx, v[4], v[5] + dz,
      v[6] + dx, v[7], v[8] + dz,
      v[9] + dx, v[10], v[11] + dz,
    ];

    const positions = new Float32Array([
      // front face
      p[0], p[1], p[2],  p[3], p[4], p[5],  p[9], p[10], p[11],
      p[0], p[1], p[2],  p[9], p[10], p[11],  p[6], p[7], p[8],
      // back face
      pb[0], pb[1], pb[2],  pb[9], pb[10], pb[11],  pb[3], pb[4], pb[5],
      pb[0], pb[1], pb[2],  pb[6], pb[7], pb[8],  pb[9], pb[10], pb[11],
      // side 0-1
      p[0], p[1], p[2],  p[3], p[4], p[5],  pb[3], pb[4], pb[5],
      p[0], p[1], p[2],  pb[3], pb[4], pb[5],  pb[0], pb[1], pb[2],
      // side 1-3
      p[3], p[4], p[5],  p[9], p[10], p[11],  pb[9], pb[10], pb[11],
      p[3], p[4], p[5],  pb[9], pb[10], pb[11],  pb[3], pb[4], pb[5],
      // side 3-2
      p[9], p[10], p[11],  p[6], p[7], p[8],  pb[6], pb[7], pb[8],
      p[9], p[10], p[11],  pb[6], pb[7], pb[8],  pb[9], pb[10], pb[11],
      // side 2-0
      p[6], p[7], p[8],  p[0], p[1], p[2],  pb[0], pb[1], pb[2],
      p[6], p[7], p[8],  pb[0], pb[1], pb[2],  pb[6], pb[7], pb[8],
    ]);

    const bevelGeo = new THREE.BufferGeometry();
    bevelGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    bevelGeo.computeVertexNormals();

    const bevelMat = this._mat('bevel', {
      color: 0x0b5c32,
      roughness: 0.85,
      metalness: 0.0,
    });
    const bevelMesh = new THREE.Mesh(bevelGeo, bevelMat);
    bevelMesh.castShadow = true;
    bevelMesh.receiveShadow = true;
    this.meshGroup.add(bevelMesh);
  }

  _addCushionBevelPhysics(body, cx, cy, cz, geo, nx, nz) {
    const h = BALL.radius * 2;
    const inset = this.profile.cushionWidth / 2;
    const overhang = 3.2;
    const thickness = 3.0;

    let len;
    if (Math.abs(nx) > 0.5) {
      len = geo.parameters.depth;
    } else {
      len = geo.parameters.width;
    }

    const slantLen = Math.sqrt(h * h + overhang * overhang);
    const shape = new CANNON.Box(new CANNON.Vec3(slantLen / 2, thickness / 2, len / 2));

    const offsetX = nx * (inset + overhang / 2);
    const offsetY = 0;
    const offsetZ = nz * (inset + overhang / 2);

    const xAxis = new THREE.Vector3(nx * overhang, h, nz * overhang).normalize();
    const zAxis = new THREE.Vector3(Math.abs(nx) > 0.5 ? 0 : 1, 0, Math.abs(nx) > 0.5 ? 1 : 0);
    const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();
    zAxis.crossVectors(xAxis, yAxis).normalize();

    const m = new THREE.Matrix4();
    m.makeBasis(xAxis, yAxis, zAxis);
    const q3 = new THREE.Quaternion().setFromRotationMatrix(m);
    const q = new CANNON.Quaternion(q3.x, q3.y, q3.z, q3.w);

    body.addShape(shape, new CANNON.Vec3(offsetX, offsetY, offsetZ), q);
  }

  createPockets() {
    const pocketMat = this._mat('pocketHole', { color: 0x050505, roughness: 1.0 });

    const halfW = this.profile.width / 2;
    const halfD = this.profile.depth / 2;
    const positions = [
      [-halfW, 0, -halfD],
      [halfW, 0, -halfD],
      [-halfW, 0, 0],
      [halfW, 0, 0],
      [-halfW, 0, halfD],
      [halfW, 0, halfD],
    ];

    this.pocketPositions = [];

    for (let i = 0; i < positions.length; i++) {
      const [x, y, z] = positions[i];
      const isCorner = i === 0 || i === 1 || i === 4 || i === 5;
      const radius = isCorner
        ? (this.profile.cornerPocketRadius ?? this.profile.pocketRadius)
        : (this.profile.sidePocketRadius ?? this.profile.pocketRadius);

      const pocketGeo = new THREE.CylinderGeometry(radius, radius, this.profile.height + 4, 24);
      const mesh = new THREE.Mesh(pocketGeo, pocketMat);
      mesh.position.set(x, y - 2, z);
      mesh.receiveShadow = true;
      this.meshGroup.add(mesh);

      const pos = new THREE.Vector3(x, y, z);
      pos.radius = radius;
      pos.type = isCorner ? 'corner' : 'side';
      this.pocketPositions.push(pos);
    }
  }

  createRails() {
    const railMat = this._mat('rail', {
      color: 0x221a16,
      roughness: 0.36,
      metalness: 0.18,
    });
    const topInsertMat = this._mat('topInsert', {
      color: 0x604328,
      roughness: 0.32,
      metalness: 0.08,
    });
    const railH = 8;
    const railW = 12;
    const halfW = this.profile.width / 2;
    const halfD = this.profile.depth / 2;

    const cornerR = this.profile.cornerPocketRadius ?? this.profile.pocketRadius;
    const sideR = this.profile.sidePocketRadius ?? this.profile.pocketRadius;

    const cornerGap = cornerR * 2.9;
    const shortRailLen = this.profile.width - cornerGap * 2;

    const rail1 = new THREE.Mesh(new THREE.BoxGeometry(shortRailLen, railH, railW), railMat);
    rail1.position.set(0, railH / 2, -halfD - railW / 2);
    rail1.castShadow = true;
    this.meshGroup.add(rail1);
    this._addRailTopInsert(0, railH + 1.0, -halfD - railW / 2, shortRailLen - 12, 1.2, railW * 0.62, topInsertMat);

    const rail2 = new THREE.Mesh(new THREE.BoxGeometry(shortRailLen, railH, railW), railMat);
    rail2.position.set(0, railH / 2, halfD + railW / 2);
    rail2.castShadow = true;
    this.meshGroup.add(rail2);
    this._addRailTopInsert(0, railH + 1.0, halfD + railW / 2, shortRailLen - 12, 1.2, railW * 0.62, topInsertMat);

    const roundMat = this._mat('round', {
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
    roundShort.position.set(0, railH + roundTubeR + 0.1, -halfD - railW / 2 + roundTubeR);
    roundShort.castShadow = true;
    this.meshGroup.add(roundShort);

    const roundShort2 = roundShort.clone();
    roundShort2.position.set(0, railH + roundTubeR + 0.1, halfD + railW / 2 - roundTubeR);
    this.meshGroup.add(roundShort2);

    const sideGap = sideR * 3.05;
    const sideRailLen = (this.profile.depth - sideGap) / 2;
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

    for (const x of sideX) {
      for (const z of [-sideZ, sideZ]) {
        const roundSide = new THREE.Mesh(
          new THREE.CylinderGeometry(roundTubeR, roundTubeR, sideRailLen, 14, 1, false, 0, Math.PI),
          roundMat
        );
        roundSide.rotation.x = Math.PI / 2;
        const nx = x < 0 ? 1 : -1;
        roundSide.position.set(x + nx * roundTubeR, railH + roundTubeR + 0.1, z);
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
    const bevelMat = this._mat('railBevel', {
      color: 0x9c5e26,
      roughness: 0.34,
      metalness: 0.16,
    });
    const halfW = this.profile.width / 2;
    const halfD = this.profile.depth / 2;
    const cornerR = this.profile.cornerPocketRadius ?? this.profile.pocketRadius;
    const sideR = this.profile.sidePocketRadius ?? this.profile.pocketRadius;
    const cornerGap = cornerR * 3.0;
    const shortLen = this.profile.width - cornerGap * 2;
    const sideGap = sideR * 3.1;
    const sideLen = (this.profile.depth - sideGap) / 2;
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
    const apronMat = this._mat('apron', {
      color: 0x151313,
      roughness: 0.42,
      metalness: 0.14,
    });
    const trimMat = this._mat('trim', {
      color: 0xb9aaa0,
      roughness: 0.22,
      metalness: 0.62,
    });
    const halfW = this.profile.width / 2;
    const halfD = this.profile.depth / 2;

    const parts = [
      [0, -13, -halfD - 10, this.profile.width + 26, 16, 8],
      [0, -13, halfD + 10, this.profile.width + 26, 16, 8],
      [-halfW - 10, -13, 0, 8, 16, this.profile.depth + 18],
      [halfW + 10, -13, 0, 8, 16, this.profile.depth + 18],
    ];

    for (const [x, y, z, w, h, d] of parts) {
      const apron = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), apronMat);
      apron.position.set(x, y, z);
      apron.castShadow = true;
      apron.receiveShadow = true;
      this.meshGroup.add(apron);
    }

    const trims = [
      [0, 8.3, -halfD - 7, this.profile.width + 18, 0.5, 2.4],
      [0, 8.3, halfD + 7, this.profile.width + 18, 0.5, 2.4],
      [-halfW - 7, 8.3, 0, 2.4, 0.5, this.profile.depth + 14],
      [halfW + 7, 8.3, 0, 2.4, 0.5, this.profile.depth + 14],
    ];

    for (const [x, y, z, w, h, d] of trims) {
      const trim = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), trimMat);
      trim.position.set(x, y, z);
      trim.castShadow = true;
      this.meshGroup.add(trim);
    }

    const bracketMat = this._mat('bracket', {
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
    const linerMat = this._mat('liner', {
      color: 0x090909,
      roughness: 0.78,
      metalness: 0.05,
    });
    const ringMat = this._mat('pocketRing', {
      color: 0x101010,
      roughness: 0.45,
      metalness: 0.35,
    });
    const cupMat = this._mat('cup', {
      color: 0x030303,
      roughness: 0.9,
      metalness: 0.02,
    });
    const leatherMat = this._mat('leather', {
      color: 0x3d2314,
      roughness: 0.62,
      metalness: 0.04,
    });

    for (const pocket of this.pocketPositions) {
      const r = pocket.radius;

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r * 1.12, 1.65, 12, 48),
        ringMat
      );
      ring.position.set(pocket.x, 1.1, pocket.z);
      ring.rotation.x = Math.PI / 2;
      ring.castShadow = true;
      this.meshGroup.add(ring);

      const facing = new THREE.Mesh(
        new THREE.TorusGeometry(r * 1.32, 2.4, 10, 48),
        leatherMat
      );
      facing.position.set(pocket.x, 0.35, pocket.z);
      facing.rotation.x = Math.PI / 2;
      facing.castShadow = true;
      this.meshGroup.add(facing);

      const skirt = new THREE.Mesh(
        new THREE.TorusGeometry(r * 1.25, 1.6, 10, 48),
        leatherMat
      );
      skirt.position.set(pocket.x, 0.02, pocket.z);
      skirt.rotation.x = Math.PI / 2;
      skirt.castShadow = true;
      this.meshGroup.add(skirt);

      const drop = new THREE.Mesh(
        new THREE.CylinderGeometry(r * 0.96, r * 0.7, 16, 36),
        linerMat
      );
      drop.position.set(pocket.x, -8, pocket.z);
      drop.receiveShadow = true;
      this.meshGroup.add(drop);

      const cup = new THREE.Mesh(
        new THREE.CylinderGeometry(r * 0.7, r * 0.52, 8, 32),
        cupMat
      );
      cup.position.set(pocket.x, -19, pocket.z);
      cup.receiveShadow = true;
      this.meshGroup.add(cup);
    }
  }

  createPocketNets() {
    const netMat = this._mat('net', {
      color: 0x1a1208,
      roughness: 0.72,
      metalness: 0.08,
    });
    const chainMat = this._mat('chain', {
      color: 0x3a2e1e,
      roughness: 0.45,
      metalness: 0.35,
    });

    this._themeMeshes.pocketNets = [];

    for (const pocket of this.pocketPositions) {
      const count = 5;
      for (let i = 0; i < count; i++) {
        const t = (i + 1) / (count + 1);
        const radius = pocket.radius * (0.85 - t * 0.45);
        const y = -2 - t * 14;
        const tube = 0.7 - t * 0.35;

        const link = new THREE.Mesh(
          new THREE.TorusGeometry(radius, Math.max(0.25, tube), 10, 32),
          i % 2 === 0 ? netMat : chainMat
        );
        link.position.set(pocket.x, y, pocket.z);
        link.rotation.x = Math.PI / 2 + (Math.random() - 0.5) * 0.06;
        this.meshGroup.add(link);
        this._themeMeshes.pocketNets.push(link);
      }
    }
  }

  createPocketJaws() {
    const jawMat = this._mat('jaw', {
      color: 0x050505,
      roughness: 0.62,
      metalness: 0.18,
    });
    const halfW = this.profile.width / 2;
    const halfD = this.profile.depth / 2;

    const addJaw = (x, z, angle, length = 12) => {
      const jaw = new THREE.Mesh(new THREE.BoxGeometry(length, 1.5, 3.2), jawMat);
      jaw.position.set(x, 5.8 + 0.75, z);
      jaw.rotation.y = angle;
      jaw.castShadow = true;
      this.meshGroup.add(jaw);
    };

    const cornerR = this.profile.cornerPocketRadius ?? this.profile.pocketRadius;
    const sideR = this.profile.sidePocketRadius ?? this.profile.pocketRadius;

    const inset = cornerR * 0.95;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        addJaw(sx * (halfW - inset * 0.52), sz * (halfD + 2.8), 0, 13);
        addJaw(sx * (halfW + 2.8), sz * (halfD - inset * 0.52), Math.PI / 2, 13);
      }
    }

    for (const sx of [-1, 1]) {
      addJaw(sx * (halfW + 2.8), -sideR * 1.35, Math.PI / 2, 15);
      addJaw(sx * (halfW + 2.8), sideR * 1.35, Math.PI / 2, 15);
    }
  }

  createTournamentCastings() {
    const nickelMat = this._mat('nickel', {
      color: 0xb8b0a6,
      roughness: 0.18,
      metalness: 0.78,
    });
    const blackInsetMat = this._mat('blackInset', {
      color: 0x0a0a0b,
      roughness: 0.32,
      metalness: 0.28,
    });
    const halfW = this.profile.width / 2;
    const halfD = this.profile.depth / 2;
    const railTopY = 9.45;

    const cornerPositions = [
      [-halfW - 6.8, -halfD - 6.8, Math.PI / 4],
      [halfW + 6.8, -halfD - 6.8, -Math.PI / 4],
      [-halfW - 6.8, halfD + 6.8, -Math.PI / 4],
      [halfW + 6.8, halfD + 6.8, Math.PI / 4],
    ];

    for (const [x, z, rot] of cornerPositions) {
      const casting = new THREE.Mesh(new THREE.BoxGeometry(11, 1.4, 5.5), nickelMat);
      casting.position.set(x, railTopY - 0.3, z);
      casting.rotation.y = rot;
      casting.castShadow = true;
      casting.receiveShadow = true;
      this.meshGroup.add(casting);

      const pad = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.35, 3.2), blackInsetMat);
      pad.position.set(x, railTopY + 0.45, z);
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

    const seamMat = this._mat('seam', {
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
    const panelMat = this._mat('panel', {
      color: 0x090909,
      roughness: 0.5,
      metalness: 0.22,
    });
    const nickelMat = this._mat('apronNickel', {
      color: 0xb7aea3,
      roughness: 0.2,
      metalness: 0.72,
    });
    const badgeMat = this._mat('badge', {
      color: 0xe2d8c9,
      roughness: 0.16,
      metalness: 0.82,
    });
    const halfW = this.profile.width / 2;
    const halfD = this.profile.depth / 2;

    const panels = [
      [0, -11.8, -halfD - 14.4, this.profile.width * 0.72, 7.2, 0.9],
      [0, -11.8, halfD + 14.4, this.profile.width * 0.72, 7.2, 0.9],
      [-halfW - 14.4, -11.8, 0, 0.9, 7.2, this.profile.depth * 0.66],
      [halfW + 14.4, -11.8, 0, 0.9, 7.2, this.profile.depth * 0.66],
    ];

    for (const [x, y, z, w, h, d] of panels) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), panelMat);
      panel.position.set(x, y, z);
      panel.receiveShadow = true;
      this.meshGroup.add(panel);
    }

    const shortBadges = [
      [0, -7.0, -halfD - 15.05, this.profile.width * 0.28, 2.2, 0.6],
      [0, -7.0, halfD + 15.05, this.profile.width * 0.28, 2.2, 0.6],
    ];
    for (const [x, y, z, w, h, d] of shortBadges) {
      const badge = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), badgeMat);
      badge.position.set(x, y, z);
      badge.castShadow = true;
      this.meshGroup.add(badge);
    }

    const sideStrips = [
      [-halfW - 15.05, -7.4, -this.profile.depth * 0.26, 0.6, 2.0, 26],
      [-halfW - 15.05, -7.4, this.profile.depth * 0.26, 0.6, 2.0, 26],
      [halfW + 15.05, -7.4, -this.profile.depth * 0.26, 0.6, 2.0, 26],
      [halfW + 15.05, -7.4, this.profile.depth * 0.26, 0.6, 2.0, 26],
    ];
    for (const [x, y, z, w, h, d] of sideStrips) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), nickelMat);
      strip.position.set(x, y, z);
      strip.castShadow = true;
      this.meshGroup.add(strip);
    }
  }

  createHiddenStretcher() {
    const stretcherMat = this._mat('stretcher', {
      color: 0x101010,
      roughness: 0.48,
      metalness: 0.18,
    });
    const nickelMat = this._mat('stretcherNickel', {
      color: 0xa89d92,
      roughness: 0.2,
      metalness: 0.7,
    });

    const spine = new THREE.Mesh(new THREE.BoxGeometry(14, 7, this.profile.depth * 0.54), stretcherMat);
    spine.position.set(0, -49, 0);
    spine.castShadow = true;
    spine.receiveShadow = true;
    this.meshGroup.add(spine);

    for (const z of [-this.profile.depth * 0.2, this.profile.depth * 0.2]) {
      const collar = new THREE.Mesh(new THREE.BoxGeometry(16, 1.6, 5.5), nickelMat);
      collar.position.set(0, -44.4, z);
      collar.castShadow = true;
      this.meshGroup.add(collar);
    }
  }

  createRailSights() {
    const sightMat = this._mat('sight', {
      color: 0xf3e6c7,
      roughness: 0.18,
      metalness: 0.05,
      emissive: 0x1c1408,
      emissiveIntensity: 0.15,
    });
    const halfW = this.profile.width / 2;
    const halfD = this.profile.depth / 2;
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
      sight.position.set(x, 8.3, z);
      sight.rotation.z = rot;
      this.meshGroup.add(sight);
    }
  }

  createCornerCaps() {
    const capMat = this._mat('cap', {
      color: 0x0e0f10,
      roughness: 0.24,
      metalness: 0.72,
    });
    const nickelMat = this._mat('capNickel', {
      color: 0xb6ada3,
      roughness: 0.2,
      metalness: 0.75,
    });
    const halfW = this.profile.width / 2;
    const halfD = this.profile.depth / 2;
    const capPositions = [
      [-halfW - 7, 9.0, -halfD - 7],
      [halfW + 7, 9.0, -halfD - 7],
      [-halfW - 7, 9.0, halfD + 7],
      [halfW + 7, 9.0, halfD + 7],
    ];

    for (const [x, y, z] of capPositions) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 5.2, 1.0, 8), capMat);
      cap.position.set(x, y - 0.5, z);
      cap.rotation.y = Math.PI / 8;
      cap.castShadow = true;
      this.meshGroup.add(cap);

      const crown = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 0.35, 8), nickelMat);
      crown.position.set(x, y + 0.15, z);
      crown.rotation.y = Math.PI / 8;
      crown.castShadow = true;
      this.meshGroup.add(crown);
    }
  }

  createLegs() {
    const legMat = this._mat('leg', {
      color: 0x15100d,
      roughness: 0.42,
      metalness: 0.18,
    });
    const faceMat = this._mat('legFace', {
      color: 0x2d2118,
      roughness: 0.36,
      metalness: 0.12,
    });
    const footMat = this._mat('foot', {
      color: 0x0a0a0a,
      roughness: 0.3,
      metalness: 0.55,
    });
    const levelerMat = this._mat('leveler', {
      color: 0xc8c0b7,
      roughness: 0.18,
      metalness: 0.85,
    });
    const legH = 65;
    const halfW = this.profile.width / 2 + 7;
    const halfD = this.profile.depth / 2 + 9;

    const positions = [
      [-halfW, -legH / 2 - this.profile.height, -halfD, 1],
      [halfW, -legH / 2 - this.profile.height, -halfD, -1],
      [-halfW, -legH / 2 - this.profile.height, halfD, -1],
      [halfW, -legH / 2 - this.profile.height, halfD, 1],
    ];

    for (const [x, y, z, tilt] of positions) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(14, legH, 18), legMat);
      leg.position.set(x, y, z);
      leg.castShadow = true;
      leg.receiveShadow = true;
      this.meshGroup.add(leg);

      const face = new THREE.Mesh(new THREE.BoxGeometry(11.5, legH * 0.72, 1.1), faceMat);
      face.position.set(x, y + 2, z + Math.sign(z) * 9.6);
      face.castShadow = true;
      this.meshGroup.add(face);

      const base = new THREE.Mesh(new THREE.BoxGeometry(22, 5.4, 25), footMat);
      base.position.set(x, -legH - this.profile.height - 2.7, z);
      base.castShadow = true;
      base.receiveShadow = true;
      this.meshGroup.add(base);

      const leveler = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.8, 1.5, 28), levelerMat);
      leveler.position.set(x, -legH - this.profile.height - 6.2, z);
      leveler.castShadow = true;
      leveler.receiveShadow = true;
      this.meshGroup.add(leveler);
    }
  }

  // ── Theme application ──

  applyVisualSettings(settings) {
    // Legacy-to-V2 mapping fallbacks
    const legacyFeltMap = { classic: 'classicGreen', blue: 'blue', red: 'red', black: 'black', purple: 'purple' };
    const legacyWoodMap = { classic: 'classic', dark: 'darkWalnut', light: 'lightOak', black: 'blackLacquer' };

    const tableThemeId = settings.get('tableTheme') || 'classic';
    const feltThemeId = settings.get('feltTheme') || legacyFeltMap[settings.get('feltColorTheme')] || 'classicGreen';
    const woodThemeId = settings.get('woodTheme') || legacyWoodMap[settings.get('woodColorTheme')] || 'classic';
    const metalThemeId = settings.get('metalTrimTheme') || 'nickel';
    const leatherThemeId = settings.get('pocketLeatherTheme') || 'brown';

    // Resolve preset overrides
    const tablePreset = TABLE_THEMES[tableThemeId] || TABLE_THEMES.classic;
    const feltKey = tablePreset.felt || feltThemeId;
    const woodKey = tablePreset.wood || woodThemeId;
    const metalKey = tablePreset.metal || metalThemeId;

    const felt = FELT_THEMES[feltKey] || FELT_THEMES.classicGreen;
    const wood = WOOD_THEMES[woodKey] || WOOD_THEMES.classic;
    const metal = METAL_TRIM_THEMES[metalKey] || METAL_TRIM_THEMES.nickel;
    const leather = POCKET_LEATHER_THEMES[leatherThemeId] || POCKET_LEATHER_THEMES.brown;

    const tableReflection = settings.get('tableReflection') !== false;

    // Apply felt colors
    applyMaterialTheme(this._materials.felt, felt.felt);
    applyMaterialTheme(this._materials.cushion, felt.cushion);
    applyMaterialTheme(this._materials.bevel, felt.bevel);
    applyMaterialTheme(this._materials.nap, felt.nap);
    applyMaterialTheme(this._materials.edge, felt.edge);

    // Apply wood colors
    applyMaterialTheme(this._materials.rail, wood.rail);
    applyMaterialTheme(this._materials.topInsert, wood.topInsert);
    applyMaterialTheme(this._materials.round, wood.round);
    applyMaterialTheme(this._materials.railBevel, wood.railBevel);
    applyMaterialTheme(this._materials.apron, wood.apron);
    applyMaterialTheme(this._materials.leg, wood.leg);
    applyMaterialTheme(this._materials.legFace, wood.legFace);

    // Apply metal trim colors
    applyMaterialTheme(this._materials.trim, metal.trim);
    applyMaterialTheme(this._materials.bracket, metal.bracket);
    applyMaterialTheme(this._materials.nickel, metal.nickel);
    applyMaterialTheme(this._materials.seam, metal.seam);
    applyMaterialTheme(this._materials.capNickel, metal.capNickel);
    applyMaterialTheme(this._materials.leveler, metal.leveler);
    applyMaterialTheme(this._materials.foot, metal.foot);
    applyMaterialTheme(this._materials.apronNickel, metal.apronNickel);
    applyMaterialTheme(this._materials.stretcherNickel, metal.stretcherNickel);
    applyMaterialTheme(this._materials.badge, metal.badge);
    applyMaterialTheme(this._materials.casting, metal.casting);
    applyMaterialTheme(this._materials.sight, metal.sight);

    // Apply pocket leather
    applyMaterialTheme(this._materials.leather, leather.leather);
    applyMaterialTheme(this._materials.net, leather.net);
    applyMaterialTheme(this._materials.chain, leather.chain);

    // Reflection toggle: dull reflective surfaces when disabled
    if (!tableReflection) {
      const dullReflective = (mat) => {
        if (!mat) return;
        mat.metalness = Math.max(0, mat.metalness - 0.25);
        mat.roughness = Math.min(1, mat.roughness + 0.18);
      };
      dullReflective(this._materials.rail);
      dullReflective(this._materials.round);
      dullReflective(this._materials.railBevel);
      dullReflective(this._materials.topInsert);
      dullReflective(this._materials.trim);
      dullReflective(this._materials.bracket);
      dullReflective(this._materials.nickel);
      dullReflective(this._materials.seam);
      dullReflective(this._materials.capNickel);
      dullReflective(this._materials.leveler);
      dullReflective(this._materials.apronNickel);
      dullReflective(this._materials.stretcherNickel);
      dullReflective(this._materials.badge);
      dullReflective(this._materials.casting);
      dullReflective(this._materials.sight);
    }

    // Show/hide cloth nap
    if (this._themeMeshes.nap) {
      this._themeMeshes.nap.visible = settings.get('clothNapEnabled') !== false;
    }

    // Pocket net detail level
    const netDetail = settings.get('pocketNetDetail') || 'high';
    if (this._themeMeshes.pocketNets) {
      for (const mesh of this._themeMeshes.pocketNets) {
        mesh.visible = netDetail !== 'off';
        if (netDetail === 'low') {
          mesh.scale.set(0.6, 0.6, 0.6);
        } else {
          mesh.scale.set(1, 1, 1);
        }
      }
    }

    // Update cloth textures (nap, pattern, wear)
    this._updateClothTextures(settings);
  }

  _updateClothTextures(settings) {
    const napEnabled = settings.get('clothNapEnabled') !== false;
    const patternStrength = settings.get('clothPatternStrength') ?? 0.35;
    const wearEnabled = settings.get('clothWearEnabled') !== false;

    const feltMat = this._materials.felt;
    if (!feltMat) return;

    // Dispose old textures (individual + composite)
    if (this._clothTextures.nap) { this._clothTextures.nap.dispose(); this._clothTextures.nap = null; }
    if (this._clothTextures.pattern) { this._clothTextures.pattern.dispose(); this._clothTextures.pattern = null; }
    if (this._clothTextures.wear) { this._clothTextures.wear.dispose(); this._clothTextures.wear = null; }
    if (this._clothTextures.composite) { this._clothTextures.composite.dispose(); this._clothTextures.composite = null; }

    const maps = [];

    if (napEnabled) {
      const napTex = createClothNapTexture(512, 512, 0.5);
      this._clothTextures.nap = napTex;
      maps.push(napTex);
    }

    if (patternStrength > 0.02) {
      const patTex = createClothPatternTexture(512, 512, patternStrength);
      this._clothTextures.pattern = patTex;
      maps.push(patTex);
    }

    if (wearEnabled) {
      const wearTex = createClothWearTexture(512, 512);
      this._clothTextures.wear = wearTex;
      maps.push(wearTex);
    }

    if (maps.length > 0) {
      if (maps.length === 1) {
        feltMat.bumpMap = maps[0];
      } else {
        // Composite all cloth detail textures into a single canvas
        // so they all contribute to the bump map instead of discarding extras
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#808080';
        ctx.fillRect(0, 0, 512, 512);
        // Average-composite bump maps by drawing at reduced opacity onto neutral grey.
        // With N textures, each at 1/N opacity produces a balanced blend.
        const layerAlpha = maps.length > 0 ? 1.0 / maps.length : 1.0;
        for (const tex of maps) {
          if (tex.image) {
            ctx.globalAlpha = layerAlpha;
            ctx.drawImage(tex.image, 0, 0);
          }
        }
        const composite = new THREE.CanvasTexture(canvas);
        composite.wrapS = THREE.RepeatWrapping;
        composite.wrapT = THREE.RepeatWrapping;
        composite.colorSpace = THREE.NoColorSpace;
        feltMat.bumpMap = composite;
        this._clothTextures.composite = composite;
        // Dispose individual textures after compositing
        for (const tex of maps) tex.dispose();
        this._clothTextures.nap = null;
        this._clothTextures.pattern = null;
        this._clothTextures.wear = null;
      }
      feltMat.bumpScale = 0.02;
    } else {
      feltMat.bumpMap = null;
    }
    feltMat.needsUpdate = true;
  }

  getPocketPositions() {
    return this.pocketPositions;
  }

  dispose() {
    if (this.meshGroup && this.meshGroup.parent) {
      this.meshGroup.parent.remove(this.meshGroup);
    }
    this.meshGroup.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => {
            if (m.map) m.map.dispose();
            m.dispose();
          });
        } else {
          if (child.material.map) child.material.map.dispose();
          child.material.dispose();
        }
      }
    });

    Object.values(this._clothTextures).forEach((t) => t && t.dispose());
    this._clothTextures = {};

    if (this.physics) {
      for (const body of this.bodies) {
        this.physics.removeBody(body);
      }
    }
    this.bodies = [];
  }
}
