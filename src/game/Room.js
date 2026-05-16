/**
 * Room — Pool hall environment with walls, floor, lights and lounge furniture.
 */
import * as THREE from 'three';
import { TABLE, BALL, ROOM } from '../config.js';

export class Room {
  constructor() {
    this.meshGroup = new THREE.Group();
    this._tmpToTable = new THREE.Vector3();
    this._tmpToLamp = new THREE.Vector3();
    this._tmpToLamp2 = new THREE.Vector3();
    this.createFloor();
    this.createWalls();
    this.createCeiling();
    this.createPaintings();
    this.createPlants();
    this.createTableLights();
  }

  addToScene(scene) {
    scene.add(this.meshGroup);
  }

  // ── Floor ──
  createFloor() {
    const width = TABLE.width * 4.2;
    const depth = TABLE.depth * 4.2;
    const geometry = new THREE.PlaneGeometry(width, depth);
    const material = new THREE.MeshStandardMaterial({
      color: 0xe0d5c0,
      roughness: 0.92,
      metalness: 0.0,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = -TABLE.height - 71;
    mesh.receiveShadow = true;
    this.meshGroup.add(mesh);

    this.createFloorLines(width, depth);
  }

  createFloorLines(width, depth) {
    const lineMat = new THREE.MeshStandardMaterial({
      color: 0xd4c8b0,
      roughness: 0.9,
      metalness: 0.0,
    });

    for (let x = -width / 2; x <= width / 2; x += 48) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.2, depth), lineMat);
      line.position.set(x, -TABLE.height - 70.85, 0);
      this.meshGroup.add(line);
    }

    for (let z = -depth / 2; z <= depth / 2; z += 48) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(width, 0.2, 0.8), lineMat);
      line.position.set(0, -TABLE.height - 70.85, z);
      this.meshGroup.add(line);
    }
  }

  // ── Walls ──
  createWalls() {
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xf5e6c8,
      roughness: 0.88,
      metalness: 0.02,
    });
    const wainscotMat = new THREE.MeshStandardMaterial({
      color: 0xd9c9a8,
      roughness: 0.55,
      metalness: 0.08,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xc4b496,
      roughness: 0.45,
      metalness: 0.15,
    });
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0xb8a88a,
      roughness: 0.4,
      metalness: 0.25,
    });

    const hw = ROOM.halfWidth;
    const hd = ROOM.halfDepth;
    const floorY = -TABLE.height - 71;
    const wallTotalH = ROOM.wallHeight - floorY;
    const wallCenterY = floorY + wallTotalH / 2;
    const wainscotH = 55;
    const wallThick = 6;

    // Front wall (z = -hd) — extends all the way down to the floor
    this._addWall(0, wallCenterY, -hd, hw * 2, wallTotalH, wallThick, wallMat);
    this._addWall(0, floorY + wainscotH / 2, -hd + wallThick / 2 + 1, hw * 2, wainscotH, 3, wainscotMat);

    // Back wall (z = hd)
    this._addWall(0, wallCenterY, hd, hw * 2, wallTotalH, wallThick, wallMat);
    this._addWall(0, floorY + wainscotH / 2, hd - wallThick / 2 - 1, hw * 2, wainscotH, 3, wainscotMat);

    // Left wall (x = -hw)
    this._addWall(-hw, wallCenterY, 0, wallThick, wallTotalH, hd * 2, wallMat);
    this._addWall(-hw + wallThick / 2 + 1, floorY + wainscotH / 2, 0, 3, wainscotH, hd * 2, wainscotMat);

    // Right wall (x = hw)
    this._addWall(hw, wallCenterY, 0, wallThick, wallTotalH, hd * 2, wallMat);
    this._addWall(hw - wallThick / 2 - 1, floorY + wainscotH / 2, 0, 3, wainscotH, hd * 2, wainscotMat);

    // Chair-rail trim at wainscot top
    const railH = 3;
    this._addTrim(0, wainscotH, -hd, hw * 2, railH, wallThick + 2, trimMat);
    this._addTrim(0, wainscotH, hd, hw * 2, railH, wallThick + 2, trimMat);
    this._addTrim(-hw, wainscotH, 0, wallThick + 2, railH, hd * 2, trimMat);
    this._addTrim(hw, wainscotH, 0, wallThick + 2, railH, hd * 2, trimMat);

    // Baseboard at floor level
    const baseH = 6;
    this._addTrim(0, floorY + baseH / 2, -hd, hw * 2, baseH, wallThick + 2, baseMat);
    this._addTrim(0, floorY + baseH / 2, hd, hw * 2, baseH, wallThick + 2, baseMat);
    this._addTrim(-hw, floorY + baseH / 2, 0, wallThick + 2, baseH, hd * 2, baseMat);
    this._addTrim(hw, floorY + baseH / 2, 0, wallThick + 2, baseH, hd * 2, baseMat);
  }

  _addWall(x, y, z, w, h, d, material) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    wall.position.set(x, y, z);
    wall.receiveShadow = true;
    wall.castShadow = true;
    this.meshGroup.add(wall);
  }

  _addTrim(x, y, z, w, h, d, material) {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    trim.position.set(x, y, z);
    trim.castShadow = true;
    trim.receiveShadow = true;
    this.meshGroup.add(trim);
  }

  // ── Ceiling ──
  createCeiling() {
    const ceilMat = new THREE.MeshStandardMaterial({
      color: 0xf5e6c8,
      roughness: 0.9,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
    const w = ROOM.halfWidth * 2;
    const d = ROOM.halfDepth * 2;
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(w, d), ceilMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = ROOM.wallHeight;
    ceiling.receiveShadow = true;
    this.meshGroup.add(ceiling);

    // Ceiling grid lines (recessed panels)
    const gridMat = new THREE.MeshStandardMaterial({
      color: 0x3a3530,
      roughness: 0.85,
      metalness: 0.05,
    });
    const step = 52;
    for (let x = -w / 2; x <= w / 2; x += step) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, d), gridMat);
      line.position.set(x, ROOM.wallHeight - 0.3, 0);
      this.meshGroup.add(line);
    }
    for (let z = -d / 2; z <= d / 2; z += step) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, 0.6), gridMat);
      line.position.set(0, ROOM.wallHeight - 0.3, z);
      this.meshGroup.add(line);
    }

    // Recessed ceiling downlights — soft fill for walls and room ambience
    const downLightPositions = [
      [-120, -240], [0, -240], [120, -240],
      [-120, -80],  [0, -80],  [120, -80],
      [-120, 80],   [0, 80],   [120, 80],
      [-120, 240],  [0, 240],  [120, 240],
    ];
    for (const [x, z] of downLightPositions) {
      const pl = new THREE.PointLight(0xfff5e0, 0.28, 280, 1.6);
      pl.position.set(x, ROOM.wallHeight - 2, z);
      this.meshGroup.add(pl);
    }
  }

  // ── Table lights ──
  createTableLights() {
    const railY = 140;
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0xfff1cc,
      emissive: 0xffd98a,
      emissiveIntensity: 1.2,
      roughness: 0.2,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
    });

    const crossbarMat = new THREE.MeshStandardMaterial({
      color: 0x2b2418,
      emissive: 0x4a3214,
      emissiveIntensity: 0.25,
      roughness: 0.45,
      metalness: 0.25,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
    });
    const crossbar = new THREE.Mesh(new THREE.BoxGeometry(4, 3, TABLE.depth * 0.68), crossbarMat);
    crossbar.position.set(0, railY + 14, 0);
    this.meshGroup.add(crossbar);

    // Suspension rods — connect crossbar to ceiling
    const rodMat = new THREE.MeshStandardMaterial({
      color: 0x8a7a68,
      roughness: 0.35,
      metalness: 0.65,
    });
    const ceilingY = ROOM.wallHeight;
    const crossbarTopY = railY + 14 + 1.5; // top face of crossbar
    const rodLen = ceilingY - crossbarTopY;
    for (const z of [-TABLE.depth * 0.3, 0, TABLE.depth * 0.3]) {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, rodLen, 12), rodMat);
      rod.position.set(0, crossbarTopY + rodLen / 2, z);
      rod.castShadow = true;
      this.meshGroup.add(rod);
    }

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

    this._lampCrossbarMat = crossbarMat;
  }

  // ── Paintings (Chinese-style landscape) ──
  createPaintings() {
    // Paintings removed per design direction — only the "厚德载物" plaque remains.
  }

  _addPainting(x, y, z, w, h, rotY, frameMat, innerMat) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotY;

    // Canvas texture
    const tex = this._createLandscapeTexture(w, h);
    const canvasMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0.0 });

    // Frame border
    const border = 3.5;
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(w + border * 2, h + border * 2, 3),
      frameMat
    );
    frame.castShadow = true;
    group.add(frame);

    // Inner gold trim
    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(w + border * 0.6, h + border * 0.6, 3.5),
      innerMat
    );
    group.add(trim);

    // Canvas
    const canvasMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      canvasMat
    );
    canvasMesh.position.z = 1.8;
    group.add(canvasMesh);

    this.meshGroup.add(group);
  }

  _createLandscapeTexture(w, h) {
    const W = 256;
    const H = Math.round(W * (h / w));
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#b8c5d6');
    grad.addColorStop(0.4, '#d4ddd8');
    grad.addColorStop(1, '#e8e0d0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Distant mountains
    ctx.fillStyle = '#7a8a9a';
    ctx.beginPath();
    ctx.moveTo(0, H * 0.55);
    ctx.lineTo(W * 0.15, H * 0.35);
    ctx.lineTo(W * 0.35, H * 0.5);
    ctx.lineTo(W * 0.5, H * 0.3);
    ctx.lineTo(W * 0.7, H * 0.48);
    ctx.lineTo(W * 0.85, H * 0.38);
    ctx.lineTo(W, H * 0.52);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.fill();

    // Mid mountains
    ctx.fillStyle = '#5a6a72';
    ctx.beginPath();
    ctx.moveTo(0, H * 0.72);
    ctx.lineTo(W * 0.2, H * 0.55);
    ctx.lineTo(W * 0.4, H * 0.68);
    ctx.lineTo(W * 0.6, H * 0.5);
    ctx.lineTo(W * 0.8, H * 0.62);
    ctx.lineTo(W, H * 0.58);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.fill();

    // Foreground hills
    ctx.fillStyle = '#3a4a42';
    ctx.beginPath();
    ctx.moveTo(0, H * 0.88);
    ctx.lineTo(W * 0.25, H * 0.78);
    ctx.lineTo(W * 0.5, H * 0.85);
    ctx.lineTo(W * 0.75, H * 0.75);
    ctx.lineTo(W, H * 0.82);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.fill();

    // Mist / fog layer
    const mist = ctx.createLinearGradient(0, H * 0.45, 0, H * 0.75);
    mist.addColorStop(0, 'rgba(255,255,255,0)');
    mist.addColorStop(0.5, 'rgba(255,255,255,0.25)');
    mist.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, H * 0.45, W, H * 0.3);

    // Sun / moon
    ctx.beginPath();
    ctx.arc(W * 0.75, H * 0.18, W * 0.06, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,240,200,0.55)';
    ctx.fill();

    // Red seal stamp (Chinese painting signature style)
    ctx.fillStyle = '#b03030';
    ctx.fillRect(W * 0.85, H * 0.82, W * 0.08, W * 0.08);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  // ── Potted plants ──
  createPlants() {
    const positions = [
      [-ROOM.halfWidth + 25, -ROOM.halfDepth + 25],
      [ROOM.halfWidth - 25, -ROOM.halfDepth + 25],
      [-ROOM.halfWidth + 25, ROOM.halfDepth - 25],
      [ROOM.halfWidth - 25, ROOM.halfDepth - 25],
    ];
    for (const [x, z] of positions) {
      this.createPlant(x, z);
    }
  }

  createPlant(x, z) {
    const potMat = new THREE.MeshStandardMaterial({
      color: 0x5c3a28,
      roughness: 0.85,
      metalness: 0.05,
    });
    const soilMat = new THREE.MeshStandardMaterial({
      color: 0x2a1e14,
      roughness: 0.95,
      metalness: 0.0,
    });
    const stemMat = new THREE.MeshStandardMaterial({
      color: 0x3d2b1f,
      roughness: 0.9,
      metalness: 0.0,
    });
    const trayMat = new THREE.MeshStandardMaterial({
      color: 0x6b4a35,
      roughness: 0.7,
      metalness: 0.1,
    });
    const pebbleMat = new THREE.MeshStandardMaterial({
      color: 0x5a5548,
      roughness: 0.92,
      metalness: 0.05,
    });

    // Five green tones for richer foliage layers
    const leafMats = [
      new THREE.MeshStandardMaterial({ color: 0x2d5a28, roughness: 0.72, metalness: 0.02 }),
      new THREE.MeshStandardMaterial({ color: 0x4a8a3a, roughness: 0.68, metalness: 0.02 }),
      new THREE.MeshStandardMaterial({ color: 0x6ab050, roughness: 0.65, metalness: 0.02 }),
      new THREE.MeshStandardMaterial({ color: 0x1a3a18, roughness: 0.78, metalness: 0.02 }),
      new THREE.MeshStandardMaterial({ color: 0x7ab860, roughness: 0.62, metalness: 0.02 }),
    ];

    const group = new THREE.Group();
    group.position.set(x, -TABLE.height - 71, z);

    // Pot (truncated cone)
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(14, 10, 18, 20),
      potMat
    );
    pot.position.y = 9;
    pot.castShadow = true;
    pot.receiveShadow = true;
    group.add(pot);

    // Decorative pot rim
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(13.6, 0.7, 8, 20),
      potMat
    );
    rim.position.y = 18;
    rim.rotation.x = Math.PI / 2;
    rim.castShadow = true;
    group.add(rim);

    // Pot saucer underneath
    const saucer = new THREE.Mesh(
      new THREE.CylinderGeometry(11.5, 10.5, 1.0, 20),
      trayMat
    );
    saucer.position.y = 0.5;
    saucer.receiveShadow = true;
    group.add(saucer);

    // Soil surface
    const soil = new THREE.Mesh(
      new THREE.CylinderGeometry(12.5, 12.5, 1.5, 20),
      soilMat
    );
    soil.position.y = 17.5;
    group.add(soil);

    // Small pebbles / moss on soil
    for (let i = 0; i < 8; i++) {
      const pebble = new THREE.Mesh(
        new THREE.SphereGeometry(0.5 + Math.random() * 0.7, 6, 5),
        pebbleMat
      );
      const r = Math.random() * 9;
      const theta = Math.random() * Math.PI * 2;
      pebble.position.set(r * Math.cos(theta), 18.3 + Math.random() * 0.4, r * Math.sin(theta));
      pebble.scale.y = 0.35 + Math.random() * 0.25;
      pebble.castShadow = true;
      group.add(pebble);
    }

    // Main stem with slight curve — built from 3 segments
    for (let i = 0; i < 3; i++) {
      const segH = 9;
      const t = i / 2;
      const rTop = 2.0 - t * 0.6;
      const rBot = 2.0 - (t - 0.5) * 0.6;
      const seg = new THREE.Mesh(
        new THREE.CylinderGeometry(Math.max(0.8, rTop), Math.max(1.0, rBot), segH, 8),
        stemMat
      );
      seg.position.set(t * 1.2, 19 + i * segH * 0.92, 0);
      seg.rotation.z = t * 0.06;
      seg.castShadow = true;
      group.add(seg);
    }

    // Helper: add a branch with leaves at its tip
    const addBranch = (startY, tiltAngle, length, thickness) => {
      const branchGrp = new THREE.Group();
      branchGrp.position.y = startY;
      branchGrp.rotation.z = tiltAngle;

      const branch = new THREE.Mesh(
        new THREE.CylinderGeometry(thickness * 0.5, thickness, length, 6),
        stemMat
      );
      branch.position.y = length / 2;
      branch.castShadow = true;
      branchGrp.add(branch);

      // Node ring where leaves cluster
      const nodeRing = new THREE.Mesh(
        new THREE.TorusGeometry(thickness * 0.65, 0.25, 5, 8),
        stemMat
      );
      nodeRing.position.y = length * 0.82;
      nodeRing.rotation.x = Math.PI / 2;
      branchGrp.add(nodeRing);

      // Primary leaves at branch tip — arranged in a loose cluster
      const leafCount = 4 + Math.floor(Math.random() * 4);
      for (let i = 0; i < leafCount; i++) {
        const mat = leafMats[Math.floor(Math.random() * leafMats.length)];
        const leaf = new THREE.Mesh(
          new THREE.SphereGeometry(2.0 + Math.random() * 2.5, 7, 5),
          mat
        );
        leaf.scale.set(
          1.2 + Math.random() * 0.7,
          0.18 + Math.random() * 0.12,
          0.65 + Math.random() * 0.45
        );
        const clusterR = 2.5 + Math.random() * 3;
        const clusterAngle = (i / leafCount) * Math.PI * 2 + Math.random() * 0.6;
        leaf.position.set(
          Math.cos(clusterAngle) * clusterR * 0.5,
          length + Math.random() * 3.5,
          Math.sin(clusterAngle) * clusterR * 0.5
        );
        leaf.rotation.set(
          Math.random() * 0.8 - 0.4,
          Math.random() * Math.PI * 2,
          Math.random() * 0.8 - 0.4
        );
        leaf.castShadow = true;
        branchGrp.add(leaf);
      }

      // Secondary smaller leaves along the branch body
      const secCount = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < secCount; i++) {
        const mat = leafMats[Math.floor(Math.random() * leafMats.length)];
        const leaf = new THREE.Mesh(
          new THREE.SphereGeometry(1.0 + Math.random() * 0.9, 6, 4),
          mat
        );
        leaf.scale.set(1.1, 0.2, 0.65);
        const t = 0.35 + Math.random() * 0.45;
        leaf.position.set(
          (Math.random() - 0.5) * 2.5,
          length * t,
          (Math.random() - 0.5) * 2.5
        );
        leaf.rotation.set(Math.random(), Math.random(), Math.random());
        leaf.castShadow = true;
        branchGrp.add(leaf);
      }

      return branchGrp;
    };

    // Branch configurations: startY, tilt, length, thickness
    const branchCfgs = [
      { y: 20, a: 0.5, len: 12, thick: 1.05 },
      { y: 24, a: -0.6, len: 14, thick: 0.95 },
      { y: 28, a: 0.7, len: 10, thick: 0.8 },
      { y: 22, a: -0.4, len: 11, thick: 1.0 },
      { y: 30, a: 0.3, len: 9, thick: 0.7 },
      { y: 26, a: -0.8, len: 13, thick: 0.9 },
      { y: 32, a: 0.2, len: 8, thick: 0.6 },
      { y: 18, a: 0.65, len: 10, thick: 0.85 },
    ];
    for (const cfg of branchCfgs) {
      const b = addBranch(cfg.y, cfg.a, cfg.len, cfg.thick);
      b.rotation.y = Math.random() * Math.PI * 2;
      group.add(b);
    }

    // Draping vines — soft hanging tendrils from lower branches
    const addDrape = (startY, sideAngle) => {
      const drapeGrp = new THREE.Group();
      drapeGrp.position.y = startY;
      drapeGrp.rotation.y = sideAngle;

      const drapeLen = 7 + Math.random() * 6;
      const drape = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.1, drapeLen, 4),
        leafMats[1]
      );
      drape.position.set(0, -drapeLen / 2, 4 + Math.random() * 3);
      drapeGrp.add(drape);

      // Drape leaves
      const drapeLeafCount = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < drapeLeafCount; i++) {
        const mat = leafMats[Math.floor(Math.random() * leafMats.length)];
        const leaf = new THREE.Mesh(
          new THREE.SphereGeometry(1.3 + Math.random() * 1.0, 6, 4),
          mat
        );
        leaf.scale.set(1.0, 0.22, 0.7);
        const t = Math.random();
        leaf.position.set(
          (Math.random() - 0.5) * 1.5,
          -drapeLen * t,
          4 + Math.random() * 3
        );
        leaf.rotation.set(Math.random(), Math.random(), Math.random());
        leaf.castShadow = true;
        drapeGrp.add(leaf);
      }
      return drapeGrp;
    };
    for (let i = 0; i < 3; i++) {
      const drape = addDrape(18 + Math.random() * 8, Math.random() * Math.PI * 2);
      group.add(drape);
    }

    // Top canopy clusters for volume
    for (let i = 0; i < 12; i++) {
      const mat = leafMats[Math.floor(Math.random() * leafMats.length)];
      const cluster = new THREE.Mesh(
        new THREE.SphereGeometry(3.0 + Math.random() * 3, 8, 6),
        mat
      );
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.5;
      const r = 5 + Math.random() * 8;
      cluster.position.set(
        r * Math.sin(phi) * Math.cos(theta),
        38 + Math.random() * 12,
        r * Math.sin(phi) * Math.sin(theta)
      );
      cluster.scale.set(1, 0.45 + Math.random() * 0.35, 1);
      cluster.rotation.set(Math.random(), Math.random(), Math.random());
      cluster.castShadow = true;
      group.add(cluster);
    }

    this.meshGroup.add(group);
  }

  // ── "厚德载物" plaque ──
  createPlaque() {
    const boardW = 160;
    const boardH = 42;
    const boardD = 5;

    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x1a0f08,
      roughness: 0.55,
      metalness: 0.15,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      roughness: 0.35,
      metalness: 0.75,
    });
    const borderMat = new THREE.MeshStandardMaterial({
      color: 0x8a6a3a,
      roughness: 0.4,
      metalness: 0.55,
    });

    const group = new THREE.Group();
    // Centre of back wall, above the sofas
    group.position.set(0, 105, ROOM.halfDepth - 5);
    group.rotation.y = Math.PI;

    // Main board
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(boardW, boardH, boardD),
      woodMat
    );
    board.castShadow = true;
    group.add(board);

    // Outer gold border frame
    const frameT = 3;
    const frameD = boardD + 1.5;
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(boardW + frameT * 2, boardH + frameT * 2, frameD),
      borderMat
    );
    frame.position.z = -0.5;
    frame.castShadow = true;
    group.add(frame);

    // Inner board (slightly recessed)
    const inner = new THREE.Mesh(
      new THREE.BoxGeometry(boardW - 6, boardH - 6, boardD + 0.5),
      woodMat
    );
    inner.position.z = 0.5;
    group.add(inner);

    // Text texture
    const textTex = this._createPlaqueTexture();
    const textMat = new THREE.MeshStandardMaterial({
      map: textTex,
      transparent: true,
      roughness: 0.4,
      metalness: 0.6,
    });
    const textMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(boardW - 12, boardH - 12),
      textMat
    );
    textMesh.position.z = boardD / 2 + 1;
    group.add(textMesh);

    // Decorative corner pieces
    const cornerSize = 10;
    const corners = [
      [-boardW / 2 + 12, -boardH / 2 + 12],
      [boardW / 2 - 12, -boardH / 2 + 12],
      [-boardW / 2 + 12, boardH / 2 - 12],
      [boardW / 2 - 12, boardH / 2 - 12],
    ];
    for (const [cx, cy] of corners) {
      const c = new THREE.Mesh(
        new THREE.BoxGeometry(cornerSize, cornerSize, boardD + 2),
        borderMat
      );
      c.position.set(cx, cy, 0);
      group.add(c);
    }

    this.meshGroup.add(group);
  }

  _createPlaqueTexture() {
    const W = 1024;
    const H = 256;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Warm rice-paper background tone (subtle, so the wood behind shows through)
    ctx.fillStyle = 'rgba(245, 235, 210, 0.12)';
    ctx.fillRect(0, 0, W, H);

    const text = '厚德载物';
    const baseY = H / 2 + 8;

    // ── Layer 1: thick ink wash shadow (gives depth) ──
    ctx.fillStyle = 'rgba(160, 120, 40, 0.25)';
    ctx.font = 'bold 148px "KaiTi", "STKaiti", "SimKaiti", "楷体", "华文楷体", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, W / 2 + 3, baseY + 3);

    // ── Layer 2: main gold-brush body ──
    ctx.fillStyle = '#d4a72c';
    ctx.fillText(text, W / 2, baseY);

    // ── Layer 3: darker core for 3D brush stroke feel ──
    ctx.fillStyle = '#b8860b';
    ctx.fillText(text, W / 2 - 1, baseY - 1);

    // ── Layer 4: dry-brush flywhite (飞白) streaks ──
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineCap = 'round';
    for (let i = 0; i < 90; i++) {
      const sx = Math.random() * W;
      const sy = Math.random() * H;
      const len = Math.random() * 28 + 4;
      const angle = (Math.random() - 0.5) * Math.PI;
      ctx.lineWidth = Math.random() * 1.8 + 0.3;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(angle) * len, sy + Math.sin(angle) * len);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';

    // ── Layer 5: ink splatter / bleed dots ──
    ctx.fillStyle = 'rgba(180, 140, 50, 0.35)';
    for (let i = 0; i < 40; i++) {
      const sx = Math.random() * W;
      const sy = Math.random() * H;
      const sr = Math.random() * 2.5 + 0.3;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Layer 6: red seal stamp (方印) ──
    const sealSize = 42;
    const sealX = W * 0.82;
    const sealY = H * 0.68;
    ctx.fillStyle = 'rgba(180, 48, 48, 0.88)';
    ctx.fillRect(sealX - sealSize / 2, sealY - sealSize / 2, sealSize, sealSize);
    // Seal inner texture
    ctx.fillStyle = 'rgba(160, 38, 38, 0.6)';
    for (let i = 0; i < 15; i++) {
      const sx = sealX + (Math.random() - 0.5) * sealSize * 0.8;
      const sy = sealY + (Math.random() - 0.5) * sealSize * 0.8;
      const sr = Math.random() * 3 + 1;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
    // Tiny seal text
    ctx.fillStyle = 'rgba(220, 180, 140, 0.7)';
    ctx.font = 'bold 10px serif';
    ctx.fillText('印', sealX, sealY + 3);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  updateLampOpacity(camera) {
    if (!this._lampDiffusers || this._lampDiffusers.length === 0) return;

    const camPos = camera.position;
    const tableCenter = this._tmpToTable.set(0, BALL.radius, 0);
    const toTable = this._tmpToTable.subVectors(tableCenter, camPos);
    const distToTable = toTable.length();
    toTable.normalize();

    for (const diffuser of this._lampDiffusers) {
      const toLamp = this._tmpToLamp.subVectors(diffuser.position, camPos);
      const distToLamp = toLamp.length();
      toLamp.normalize();
      const alignment = toLamp.dot(toTable);

      let targetOpacity = 1.0;
      let targetEmissive = 1.2;
      if (distToLamp < distToTable && alignment > 0.78) {
        const fade = Math.max(0, (alignment - 0.78) / (1.0 - 0.78));
        targetOpacity = 1.0 - fade * 0.96;
        targetEmissive = 1.2 * (1.0 - fade * 0.92);
      }

      const mat = diffuser.material;
      if (Math.abs(mat.opacity - targetOpacity) > 0.01) {
        mat.opacity += (targetOpacity - mat.opacity) * 0.15;
      }
      if (Math.abs(mat.emissiveIntensity - targetEmissive) > 0.01) {
        mat.emissiveIntensity += (targetEmissive - mat.emissiveIntensity) * 0.15;
      }
    }

    if (this._lampCrossbarMat) {
      let maxFade = 0;
      for (const diffuser of this._lampDiffusers) {
        const toLamp = this._tmpToLamp2.subVectors(diffuser.position, camera.position);
        const distToLamp = toLamp.length();
        toLamp.normalize();
        const alignment = toLamp.dot(toTable);
        if (distToLamp < distToTable && alignment > 0.88) {
          maxFade = Math.max(maxFade, (alignment - 0.88) / 0.12);
        }
      }
      const targetCross = Math.max(0.04, 1.0 - maxFade * 0.96);
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
