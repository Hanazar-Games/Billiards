/**
 * Room — Pool hall environment with walls, floor, lights and lounge furniture.
 */
import * as THREE from 'three';
import { BALL, ROOM } from '../config.js';
import { getDefaultTableProfile } from './TableProfiles.js';
import {
  ROOM_THEMES, FLOOR_THEMES, WALL_THEMES, LAMP_STYLE_THEMES, AMBIENT_LIGHT_THEMES,
  applyMaterialTheme,
} from '../theme/RoomThemes.js';

export class Room {
  constructor(tableProfile = null) {
    this.profile = tableProfile || getDefaultTableProfile();
    this.meshGroup = new THREE.Group();
    this._tmpToTable = new THREE.Vector3();
    this._tmpToLamp = new THREE.Vector3();
    this._tmpToLamp2 = new THREE.Vector3();
    this._materials = {};
    this._themeGroups = {};
    this._themeLights = {};

    // Core architectural structure
    this.createFloor();
    this.createWalls();
    this.createCeiling();

    // Lighting (must come before decorations that may reference lights)
    this.createTableLights();

    // Decorations — all optional, guarded by existence checks in applyVisualSettings
    this.createPlants();
    this.createPlaque();
    this.createLoungeArea();
    this.createRug();

    // Stubs for future optional detail systems
    this.createPaintings();
    this.createWallDetails();
    this.createWindows();
  }

  addToScene(scene) {
    scene.add(this.meshGroup);
  }

  _mat(name, props) {
    const mat = new THREE.MeshStandardMaterial(props);
    this._materials[name] = mat;
    return mat;
  }

  // ── Floor ──
  createFloor() {
    const width = this.profile.width * 4.2;
    const depth = this.profile.depth * 4.2;
    const geometry = new THREE.PlaneGeometry(width, depth);
    const material = this._mat('floor', {
      color: 0xe0d5c0,
      roughness: 0.92,
      metalness: 0.0,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = -this.profile.height - 71;
    mesh.receiveShadow = true;
    this.meshGroup.add(mesh);

    this._themeGroups.floorLines = new THREE.Group();
    this.meshGroup.add(this._themeGroups.floorLines);
    this.createFloorLines(width, depth);
  }

  createFloorLines(width, depth) {
    const lineMat = this._mat('floorLine', {
      color: 0xd4c8b0,
      roughness: 0.9,
      metalness: 0.0,
    });

    for (let x = -width / 2; x <= width / 2; x += 48) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.2, depth), lineMat);
      line.position.set(x, -this.profile.height - 70.85, 0);
      this._themeGroups.floorLines.add(line);
    }

    for (let z = -depth / 2; z <= depth / 2; z += 48) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(width, 0.2, 0.8), lineMat);
      line.position.set(0, -this.profile.height - 70.85, z);
      this._themeGroups.floorLines.add(line);
    }
  }

  // ── Walls ──
  createWalls() {
    const wallMat = this._mat('wall', {
      color: 0xf5e6c8,
      roughness: 0.88,
      metalness: 0.02,
    });

    const hw = ROOM.halfWidth;
    const hd = ROOM.halfDepth;
    const floorY = -this.profile.height - 71;
    const wallTotalH = ROOM.wallHeight - floorY;
    const wallCenterY = floorY + wallTotalH / 2;
    const wallThick = 6;

    this._addWall(0, wallCenterY, -hd, hw * 2, wallTotalH, wallThick, wallMat);
    this._addWall(0, wallCenterY, hd, hw * 2, wallTotalH, wallThick, wallMat);
    this._addWall(-hw, wallCenterY, 0, wallThick, wallTotalH, hd * 2, wallMat);
    this._addWall(hw, wallCenterY, 0, wallThick, wallTotalH, hd * 2, wallMat);
  }

  createWallDetails() {
    // Stub — reserved for future wall trim / wainscoting detail meshes
  }

  createWindows() {
    // Stub — reserved for future window meshes
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
    const ceilMat = this._mat('ceiling', {
      color: 0xf5e6c8,
      roughness: 0.9,
      metalness: 0.02,
      // Intentionally FrontSide only: the plane is rotated so its normal points
      // downward. This makes the ceiling invisible from above (default / top
      // cameras) while remaining visible from below.
    });
    const w = ROOM.halfWidth * 2;
    const d = ROOM.halfDepth * 2;
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(w, d), ceilMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = ROOM.wallHeight;
    ceiling.receiveShadow = true;
    this.meshGroup.add(ceiling);

    this._themeGroups.ceilingGrid = new THREE.Group();
    this.meshGroup.add(this._themeGroups.ceilingGrid);

    const gridMat = this._mat('grid', {
      color: 0x3a3530,
      roughness: 0.85,
      metalness: 0.05,
    });
    const step = 52;
    for (let x = -w / 2; x <= w / 2; x += step) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, d), gridMat);
      line.position.set(x, ROOM.wallHeight - 0.3, 0);
      this._themeGroups.ceilingGrid.add(line);
    }
    for (let z = -d / 2; z <= d / 2; z += step) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, 0.6), gridMat);
      line.position.set(0, ROOM.wallHeight - 0.3, z);
      this._themeGroups.ceilingGrid.add(line);
    }

    // Recessed ceiling downlights
    this._themeLights.downlights = [];
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
      this._themeLights.downlights.push(pl);
    }
  }

  // ── Table lights ──
  createTableLights() {
    const railY = 140;
    const glowMat = this._mat('diffuser', {
      color: 0xfff1cc,
      emissive: 0xffd98a,
      emissiveIntensity: 1.2,
      roughness: 0.2,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
    });

    // Structural elements (crossbar, rods, chains) are grouped so they can be
    // hidden when the camera is above them, preventing obstruction of the
    // default and top-down views.
    this._themeGroups.tableLightStructure = new THREE.Group();
    this.meshGroup.add(this._themeGroups.tableLightStructure);

    const crossbarMat = this._mat('crossbar', {
      color: 0x2b2418,
      emissive: 0x4a3214,
      emissiveIntensity: 0.25,
      roughness: 0.45,
      metalness: 0.25,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
    });
    const crossbar = new THREE.Mesh(new THREE.BoxGeometry(4, 3, this.profile.depth * 0.68), crossbarMat);
    crossbar.position.set(0, railY + 14, 0);
    this._themeGroups.tableLightStructure.add(crossbar);

    const rodMat = this._mat('rod', {
      color: 0x8a7a68,
      roughness: 0.35,
      metalness: 0.65,
    });
    const ceilingY = ROOM.wallHeight;
    const crossbarTopY = railY + 14 + 1.5;
    const rodLen = ceilingY - crossbarTopY;
    for (const z of [-this.profile.depth * 0.3, 0, this.profile.depth * 0.3]) {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, rodLen, 12), rodMat);
      rod.position.set(0, crossbarTopY + rodLen / 2, z);
      rod.castShadow = true;
      this._themeGroups.tableLightStructure.add(rod);
    }

    // Chain links from crossbar to ceiling
    const chainMat = this._mat('chain', {
      color: 0x6a6058, roughness: 0.30, metalness: 0.85,
    });
    const linkRadius = 1.0;
    const linkTube = 0.28;
    const linkGeo = new THREE.TorusGeometry(linkRadius, linkTube, 8, 16);
    const chainTopY = ceilingY - 2;
    const chainBotY = crossbarTopY;
    const chainLen = chainTopY - chainBotY;
    const linksCount = Math.max(4, Math.round(chainLen / 5));
    for (const z of [-this.profile.depth * 0.3, 0, this.profile.depth * 0.3]) {
      for (let i = 0; i < linksCount; i++) {
        const link = new THREE.Mesh(linkGeo, chainMat);
        const t = i / (linksCount - 1);
        link.position.set(0, chainBotY + t * chainLen, z);
        link.rotation.y = (i % 2) * Math.PI / 2;
        this._themeGroups.tableLightStructure.add(link);
      }
    }

    this._lampDiffusers = [];
    this._lampLights = [];
    const lampZs = [-this.profile.depth * 0.3, 0, this.profile.depth * 0.3];

    // Refined lamp shade using LatheGeometry (bell shape)
    const shadeProfile = [];
    const shadeSegs = 16;
    for (let i = 0; i <= shadeSegs; i++) {
      const t = i / shadeSegs;
      const r = 7.0 + Math.sin(t * Math.PI) * 6.5 + t * 2.5;
      const y = t * 9.0;
      shadeProfile.push(new THREE.Vector2(r, y));
    }
    const shadeGeo = new THREE.LatheGeometry(shadeProfile, 32);

    for (const z of lampZs) {
      // Shade — share the glowMat so applyVisualSettings updates all diffusers
      const shade = new THREE.Mesh(shadeGeo, glowMat);
      shade.position.set(0, railY - 14, z);
      this.meshGroup.add(shade);
      this._lampDiffusers.push(shade);

      // Inner bulb glow
      const bulbMat = this._mat('bulb', {
        color: 0xffffee, emissive: 0xffe8aa, emissiveIntensity: 2.0,
        roughness: 0.1, metalness: 0.0,
        transparent: true, opacity: 0.9,
      });
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(3.5, 16, 16), bulbMat);
      bulb.position.set(0, railY - 10, z);
      this.meshGroup.add(bulb);

      // Spot light
      const spot = new THREE.SpotLight(0xffe4b0, 1.25, 420, Math.PI / 4.8, 0.55, 1.4);
      spot.position.set(0, railY - 10, z);
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

    const tex = this._createLandscapeTexture(w, h);
    const canvasMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0.0 });

    const border = 3.5;
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(w + border * 2, h + border * 2, 3),
      frameMat
    );
    frame.castShadow = true;
    group.add(frame);

    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(w + border * 0.6, h + border * 0.6, 3.5),
      innerMat
    );
    group.add(trim);

    const canvasMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      canvasMat
    );
    canvasMesh.position.z = 1.8;
    group.add(canvasMesh);

    this.meshGroup.add(group);
    return group;
  }

  _createLandscapeTexture(w, h) {
    const W = 256;
    const H = Math.round(W * (h / w));
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#b8c5d6');
    grad.addColorStop(0.4, '#d4ddd8');
    grad.addColorStop(1, '#e8e0d0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

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

    const mist = ctx.createLinearGradient(0, H * 0.45, 0, H * 0.75);
    mist.addColorStop(0, 'rgba(255,255,255,0)');
    mist.addColorStop(0.5, 'rgba(255,255,255,0.25)');
    mist.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, H * 0.45, W, H * 0.3);

    ctx.beginPath();
    ctx.arc(W * 0.75, H * 0.18, W * 0.06, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,240,200,0.55)';
    ctx.fill();

    ctx.fillStyle = '#b03030';
    ctx.fillRect(W * 0.85, H * 0.82, W * 0.08, W * 0.08);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  // ── Potted plants ──
  createPlants() {
    this._themeGroups.plants = new THREE.Group();
    this.meshGroup.add(this._themeGroups.plants);

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
    const potMat = this._mat('pot', {
      color: 0x5c3a28,
      roughness: 0.85,
      metalness: 0.05,
    });
    const soilMat = this._mat('soil', {
      color: 0x2a1e14,
      roughness: 0.95,
      metalness: 0.0,
    });
    const stemMat = this._mat('stem', {
      color: 0x3d2b1f,
      roughness: 0.9,
      metalness: 0.0,
    });
    const trayMat = this._mat('tray', {
      color: 0x6b4a35,
      roughness: 0.7,
      metalness: 0.1,
    });
    const pebbleMat = this._mat('pebble', {
      color: 0x5a5548,
      roughness: 0.92,
      metalness: 0.05,
    });

    const leafMats = [
      new THREE.MeshStandardMaterial({ color: 0x2d5a28, roughness: 0.72, metalness: 0.02 }),
      new THREE.MeshStandardMaterial({ color: 0x4a8a3a, roughness: 0.68, metalness: 0.02 }),
      new THREE.MeshStandardMaterial({ color: 0x6ab050, roughness: 0.65, metalness: 0.02 }),
      new THREE.MeshStandardMaterial({ color: 0x1a3a18, roughness: 0.78, metalness: 0.02 }),
      new THREE.MeshStandardMaterial({ color: 0x7ab860, roughness: 0.62, metalness: 0.02 }),
    ];

    const group = new THREE.Group();
    group.position.set(x, -this.profile.height - 71, z);

    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(14, 10, 18, 20),
      potMat
    );
    pot.position.y = 9;
    pot.castShadow = true;
    pot.receiveShadow = true;
    group.add(pot);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(13.6, 0.7, 8, 20),
      potMat
    );
    rim.position.y = 18;
    rim.rotation.x = Math.PI / 2;
    rim.castShadow = true;
    group.add(rim);

    const saucer = new THREE.Mesh(
      new THREE.CylinderGeometry(11.5, 10.5, 1.0, 20),
      trayMat
    );
    saucer.position.y = 0.5;
    saucer.receiveShadow = true;
    group.add(saucer);

    const soil = new THREE.Mesh(
      new THREE.CylinderGeometry(12.5, 12.5, 1.5, 20),
      soilMat
    );
    soil.position.y = 17.5;
    group.add(soil);

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

      const nodeRing = new THREE.Mesh(
        new THREE.TorusGeometry(thickness * 0.65, 0.25, 5, 8),
        stemMat
      );
      nodeRing.position.y = length * 0.82;
      nodeRing.rotation.x = Math.PI / 2;
      branchGrp.add(nodeRing);

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

    this._themeGroups.plants.add(group);
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
    group.position.set(0, 105, ROOM.halfDepth - 5);
    group.rotation.y = Math.PI;

    const board = new THREE.Mesh(
      new THREE.BoxGeometry(boardW, boardH, boardD),
      woodMat
    );
    board.castShadow = true;
    group.add(board);

    const frameT = 3;
    const frameD = boardD + 1.5;
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(boardW + frameT * 2, boardH + frameT * 2, frameD),
      borderMat
    );
    frame.position.z = -0.5;
    frame.castShadow = true;
    group.add(frame);

    const inner = new THREE.Mesh(
      new THREE.BoxGeometry(boardW - 6, boardH - 6, boardD + 0.5),
      woodMat
    );
    inner.position.z = 0.5;
    group.add(inner);

    this._plaqueTexture = this._createPlaqueTexture();
    const textMat = new THREE.MeshStandardMaterial({
      map: this._plaqueTexture,
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
    this._themeGroups.plaque = group;
  }

  _createPlaqueTexture() {
    const W = 1024;
    const H = 256;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgba(245, 235, 210, 0.12)';
    ctx.fillRect(0, 0, W, H);

    const text = '厚德载物';
    const baseY = H / 2 + 8;

    ctx.fillStyle = 'rgba(160, 120, 40, 0.25)';
    ctx.font = 'bold 148px "KaiTi", "STKaiti", "SimKaiti", "楷体", "华文楷体", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, W / 2 + 3, baseY + 3);

    ctx.fillStyle = '#d4a72c';
    ctx.fillText(text, W / 2, baseY);

    ctx.fillStyle = '#b8860b';
    ctx.fillText(text, W / 2 - 1, baseY - 1);

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

    ctx.fillStyle = 'rgba(180, 140, 50, 0.35)';
    for (let i = 0; i < 40; i++) {
      const sx = Math.random() * W;
      const sy = Math.random() * H;
      const sr = Math.random() * 2.5 + 0.3;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }

    const sealSize = 42;
    const sealX = W * 0.82;
    const sealY = H * 0.68;
    ctx.fillStyle = 'rgba(180, 48, 48, 0.88)';
    ctx.fillRect(sealX - sealSize / 2, sealY - sealSize / 2, sealSize, sealSize);
    ctx.fillStyle = 'rgba(160, 38, 38, 0.6)';
    for (let i = 0; i < 15; i++) {
      const sx = sealX + (Math.random() - 0.5) * sealSize * 0.8;
      const sy = sealY + (Math.random() - 0.5) * sealSize * 0.8;
      const sr = Math.random() * 3 + 1;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(220, 180, 140, 0.7)';
    ctx.font = 'bold 10px serif';
    ctx.fillText('印', sealX, sealY + 3);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  // ── Theme application ──

  // Lounge area: armchairs and side tables
  createLoungeArea() {
    const hw = ROOM.halfWidth;
    const hd = ROOM.halfDepth;
    const floorY = -this.profile.height - 71;

    const chairMat = this._mat('chairFabric', {
      color: 0x4a3028, roughness: 0.82, metalness: 0.0,
    });
    const woodMat = this._mat('chairWood', {
      color: 0x5c4030, roughness: 0.50, metalness: 0.10,
    });
    const tableMat = this._mat('sideTable', {
      color: 0x3a2820, roughness: 0.45, metalness: 0.15,
    });

    // Two armchairs on each side wall
    this._createArmchair(-hw + 18, floorY + 18, -140, Math.PI / 2, chairMat, woodMat);
    this._createArmchair(-hw + 18, floorY + 18,  140, Math.PI / 2, chairMat, woodMat);
    this._createArmchair( hw - 18, floorY + 18, -140, -Math.PI / 2, chairMat, woodMat);
    this._createArmchair( hw - 18, floorY + 18,  140, -Math.PI / 2, chairMat, woodMat);

    // Side tables between chairs
    this._createSideTable(-hw + 18, floorY + 12, -60, tableMat);
    this._createSideTable(-hw + 18, floorY + 12,  60, tableMat);
    this._createSideTable( hw - 18, floorY + 12, -60, tableMat);
    this._createSideTable( hw - 18, floorY + 12,  60, tableMat);

    // Small lamp on each side table
    const lampMat = this._mat('tableLamp', {
      color: 0xfff5e0, emissive: 0xffe4b0, emissiveIntensity: 0.6,
      roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.95,
    });
    const lampPositions = [
      [-hw + 18, floorY + 28, -60],
      [-hw + 18, floorY + 28,  60],
      [ hw - 18, floorY + 28, -60],
      [ hw - 18, floorY + 28,  60],
    ];
    for (const [lx, ly, lz] of lampPositions) {
      const shade = new THREE.Mesh(
        new THREE.CylinderGeometry(4, 5, 5, 16), lampMat);
      shade.position.set(lx, ly, lz);
      this.meshGroup.add(shade);

      const bulb = new THREE.PointLight(0xffe8c0, 0.35, 60, 1.8);
      bulb.position.set(lx, ly - 1, lz);
      this.meshGroup.add(bulb);
    }
  }

  _createArmchair(x, y, z, rotY, fabricMat, woodMat) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotY;

    // Seat
    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(22, 5, 22), fabricMat);
    seat.position.y = 0;
    seat.castShadow = true;
    group.add(seat);

    // Backrest
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(22, 22, 4), fabricMat);
    back.position.set(0, 11, -10);
    back.castShadow = true;
    group.add(back);

    // Armrests
    const armL = new THREE.Mesh(
      new THREE.BoxGeometry(4, 10, 18), woodMat);
    armL.position.set(-11, 5, 0);
    armL.castShadow = true;
    group.add(armL);

    const armR = new THREE.Mesh(
      new THREE.BoxGeometry(4, 10, 18), woodMat);
    armR.position.set(11, 5, 0);
    armR.castShadow = true;
    group.add(armR);

    // Legs
    const legGeo = new THREE.CylinderGeometry(1.2, 0.8, 8, 8);
    for (const [lx, lz] of [[-9, -9], [9, -9], [-9, 9], [9, 9]]) {
      const leg = new THREE.Mesh(legGeo, woodMat);
      leg.position.set(lx, -6.5, lz);
      leg.castShadow = true;
      group.add(leg);
    }

    this.meshGroup.add(group);
  }

  _createSideTable(x, y, z, tableMat) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    // Table top
    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(10, 10, 1.5, 24), tableMat);
    top.position.y = 6;
    top.castShadow = true;
    group.add(top);

    // Stem
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 2.0, 10, 12), tableMat);
    stem.position.y = 0.5;
    stem.castShadow = true;
    group.add(stem);

    // Base
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(6, 7, 1.2, 24), tableMat);
    base.position.y = -4.5;
    base.castShadow = true;
    group.add(base);

    this.meshGroup.add(group);
  }

  // Large area rug under the table
  createRug() {
    const rugMat = this._mat('rug', {
      color: 0x2a1810, roughness: 0.95, metalness: 0.0,
    });
    const rug = new THREE.Mesh(
      new THREE.BoxGeometry(this.profile.width + 120, 1.2, this.profile.depth + 160), rugMat);
    rug.position.set(0, -this.profile.height - 70.4, 0);
    rug.receiveShadow = true;
    this.meshGroup.add(rug);

    // Rug border (slightly larger, thinner)
    const borderMat = this._mat('rugBorder', {
      color: 0x4a3020, roughness: 0.90, metalness: 0.0,
    });
    const borderW = this.profile.width + 132;
    const borderD = this.profile.depth + 172;
    const border = new THREE.Mesh(
      new THREE.BoxGeometry(borderW, 0.8, borderD), borderMat);
    border.position.set(0, -this.profile.height - 70.6, 0);
    border.receiveShadow = true;
    this.meshGroup.add(border);
  }

  applyVisualSettings(settings) {
    // Legacy-to-V2 mapping
    const legacyRoomMap = { classic: 'club', modern: 'modern', tournament: 'tournament', minimal: 'minimal' };
    const legacyLightingMap = { warm: 'classic', neutral: 'modern', cool: 'tournament', bright: 'tournament' };
    const legacyAmbientMap = { warm: 'warm', neutral: 'neutral', cool: 'cool', bright: 'neutral' };

    const roomThemeId = settings.get('roomTheme') || legacyRoomMap[settings.get('roomStyle')] || 'club';
    const floorThemeId = settings.get('floorTheme') || 'tile';
    const wallThemeId = settings.get('wallTheme') || 'warm';
    const lampStyleId = settings.get('lampStyle') || legacyLightingMap[settings.get('lightingStyle')] || 'classic';
    const ambientThemeId = settings.get('ambientLightTheme') || legacyAmbientMap[settings.get('lightingStyle')] || 'warm';

    const roomPreset = ROOM_THEMES[roomThemeId] || ROOM_THEMES.club;
    const floorKey = roomPreset.floor || floorThemeId;
    const wallKey = roomPreset.wall || wallThemeId;
    const lampKey = roomPreset.lamp || lampStyleId;
    const ambientKey = roomPreset.ambient || ambientThemeId;

    const floor = FLOOR_THEMES[floorKey] || FLOOR_THEMES.tile;
    const wall = WALL_THEMES[wallKey] || WALL_THEMES.warm;
    const lamp = LAMP_STYLE_THEMES[lampKey] || LAMP_STYLE_THEMES.classic;
    const ambient = AMBIENT_LIGHT_THEMES[ambientKey] || AMBIENT_LIGHT_THEMES.warm;

    // Legacy intensity multipliers (default 1.0 / 0.5 to keep backward compat)
    const lightIntensityMult = settings.get('lightingIntensity') ?? 1.0;
    const ambientIntensityMult = settings.get('ambientIntensity') ?? 0.5;

    // Apply floor
    applyMaterialTheme(this._materials.floor, floor.floor);
    applyMaterialTheme(this._materials.floorLine, floor.floorLine);

    // Apply walls / ceiling
    applyMaterialTheme(this._materials.wall, wall.wall);
    applyMaterialTheme(this._materials.ceiling, wall.ceiling);
    applyMaterialTheme(this._materials.grid, wall.grid);

    // Apply lamp materials
    applyMaterialTheme(this._materials.diffuser, lamp.diffuser);
    applyMaterialTheme(this._materials.crossbar, lamp.crossbar);
    applyMaterialTheme(this._materials.rod, lamp.rod);

    // Update spot light colors & intensities
    for (const spot of this._lampLights) {
      if (spot) {
        spot.color.setHex(lamp.spotColor);
        spot.intensity = lamp.spotIntensity * (settings.get('tableLightIntensity') ?? 1.0) * lightIntensityMult;
      }
    }

    // Update downlight colors & intensities
    if (this._themeLights.downlights) {
      for (const pl of this._themeLights.downlights) {
        if (pl) {
          pl.color.setHex(lamp.pointColor);
          pl.intensity = lamp.pointIntensity * lightIntensityMult;
        }
      }
    }

    // Ambient light updates dispatched to Renderer
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('roomThemeChanged', {
        detail: {
          ambientColor: ambient.ambientColor,
          ambientIntensity: ambient.ambientIntensity,
        },
      }));
    }

    // Toggle decorative groups
    if (this._themeGroups.plants) {
      this._themeGroups.plants.visible = settings.get('plantsEnabled') !== false;
    }
    if (this._themeGroups.ceilingGrid) {
      this._themeGroups.ceilingGrid.visible = settings.get('ceilingGridEnabled') !== false;
    }
    if (this._themeGroups.plaque) {
      this._themeGroups.plaque.visible = settings.get('wallDecorEnabled') !== false;
    }
    if (this._themeGroups.floorLines) {
      this._themeGroups.floorLines.visible = settings.get('decorativePropsEnabled') !== false;
    }
  }

  updateCameraVisibility(camera) {
    const camPos = camera.position;
    const camY = camPos.y;

    // ── Ceiling grid: hide when camera is above the ceiling so the default
    // and top-down views remain unobstructed.
    if (this._themeGroups.ceilingGrid) {
      this._themeGroups.ceilingGrid.visible = camY < ROOM.wallHeight - 2;
    }

    // ── Table light structure (crossbar, rods, chains): hide when camera is
    // well above the lights (default & top-down camera positions).
    if (this._themeGroups.tableLightStructure) {
      this._themeGroups.tableLightStructure.visible = camY < ROOM.wallHeight + 8;
    }

    // ── Lamp diffuser fade (existing logic, preserves visual clarity when
    // the camera is between the lamp and the table).
    if (!this._lampDiffusers || this._lampDiffusers.length === 0) return;

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
    if (this._plaqueTexture) {
      this._plaqueTexture.dispose();
      this._plaqueTexture = null;
    }
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
  }
}
