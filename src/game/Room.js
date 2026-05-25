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
    this.createPaintings();
    this.createCueRack();
    this.createWallSconces();
    this.createTableAccessories();

    // Optional architectural detail systems
    this.createWallDetails();
    this.createWindows();
    this.createPosters();
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
    const width = ROOM.halfWidth * 2;
    const depth = ROOM.halfDepth * 2;
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

  // ── Wall Details (baseboard, chair rail, corner pilasters, wainscoting) ──
  createWallDetails() {
    this._themeGroups.wallDetails = new THREE.Group();
    this.meshGroup.add(this._themeGroups.wallDetails);

    const hw = ROOM.halfWidth;
    const hd = ROOM.halfDepth;
    const floorY = -this.profile.height - 71;
    const wallThick = 6;

    const trimMat = this._mat('wallTrim', {
      color: 0xe8d8c0, roughness: 0.70, metalness: 0.05,
    });
    const pilasterMat = this._mat('pilaster', {
      color: 0xf0e0c8, roughness: 0.80, metalness: 0.03,
    });

    // Baseboard — runs along bottom of all four walls
    const bbH = 7.0;
    const bbD = 2.2;
    const baseboards = [
      [0, floorY + bbH / 2, -hd + wallThick / 2 + bbD / 2, hw * 2, bbH, bbD],
      [0, floorY + bbH / 2,  hd - wallThick / 2 - bbD / 2, hw * 2, bbH, bbD],
      [-hw + wallThick / 2 + bbD / 2, floorY + bbH / 2, 0, bbD, bbH, hd * 2],
      [ hw - wallThick / 2 - bbD / 2, floorY + bbH / 2, 0, bbD, bbH, hd * 2],
    ];
    for (const [x, y, z, w, h, d] of baseboards) {
      const bb = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), trimMat);
      bb.position.set(x, y, z);
      bb.castShadow = true;
      bb.receiveShadow = true;
      this._themeGroups.wallDetails.add(bb);
    }

    // Chair rail — horizontal band at mid-wall height
    const crH = 3.0;
    const crD = 1.6;
    const crY = floorY + 48;
    const chairRails = [
      [0, crY, -hd + wallThick / 2 + crD / 2, hw * 2, crH, crD],
      [0, crY,  hd - wallThick / 2 - crD / 2, hw * 2, crH, crD],
      [-hw + wallThick / 2 + crD / 2, crY, 0, crD, crH, hd * 2],
      [ hw - wallThick / 2 - crD / 2, crY, 0, crD, crH, hd * 2],
    ];
    for (const [x, y, z, w, h, d] of chairRails) {
      const cr = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), trimMat);
      cr.position.set(x, y, z);
      cr.castShadow = true;
      cr.receiveShadow = true;
      this._themeGroups.wallDetails.add(cr);
    }

    // Crown moulding — thin strip near ceiling
    const cmH = 2.2;
    const cmD = 2.0;
    const cmY = ROOM.wallHeight - cmH / 2 - 1;
    const crowns = [
      [0, cmY, -hd + wallThick / 2 + cmD / 2, hw * 2, cmH, cmD],
      [0, cmY,  hd - wallThick / 2 - cmD / 2, hw * 2, cmH, cmD],
      [-hw + wallThick / 2 + cmD / 2, cmY, 0, cmD, cmH, hd * 2],
      [ hw - wallThick / 2 - cmD / 2, cmY, 0, cmD, cmH, hd * 2],
    ];
    for (const [x, y, z, w, h, d] of crowns) {
      const cm = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), trimMat);
      cm.position.set(x, y, z);
      cm.castShadow = true;
      cm.receiveShadow = true;
      this._themeGroups.wallDetails.add(cm);
    }

    // Corner pilasters — decorative columns at each wall corner
    const pilW = 7;
    const pilH = crY - floorY;
    const pilY = floorY + pilH / 2;
    const pilInset = wallThick / 2 + pilW / 2;
    const pilasters = [
      [-hw + pilInset, pilY, -hd + pilInset],
      [ hw - pilInset, pilY, -hd + pilInset],
      [-hw + pilInset, pilY,  hd - pilInset],
      [ hw - pilInset, pilY,  hd - pilInset],
    ];
    for (const [x, y, z] of pilasters) {
      const pil = new THREE.Mesh(new THREE.BoxGeometry(pilW, pilH, pilW), pilasterMat);
      pil.position.set(x, y, z);
      pil.castShadow = true;
      pil.receiveShadow = true;
      this._themeGroups.wallDetails.add(pil);

      // Capital (top cap)
      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(pilW + 2.5, 2.5, pilW + 2.5), trimMat
      );
      cap.position.set(x, y + pilH / 2 + 1.25, z);
      cap.castShadow = true;
      this._themeGroups.wallDetails.add(cap);

      // Base (bottom plinth)
      const plinth = new THREE.Mesh(
        new THREE.BoxGeometry(pilW + 2.0, 2.0, pilW + 2.0), trimMat
      );
      plinth.position.set(x, floorY + 1.0, z);
      plinth.castShadow = true;
      this._themeGroups.wallDetails.add(plinth);
    }

    // Wainscoting panels — recessed rectangles between baseboard and chair rail
    const panelMat = this._mat('wainscot', {
      color: 0xddd0bc, roughness: 0.82, metalness: 0.02,
    });
    const panelY = floorY + 26;
    const panelH = 38;
    const recess = 0.6;

    // Front / back walls
    for (const z of [-hd + wallThick / 2 + recess, hd - wallThick / 2 - recess]) {
      for (let x = -hw + 30; x < hw - 20; x += 55) {
        const pw = 40;
        const panel = new THREE.Mesh(new THREE.BoxGeometry(pw, panelH, 1.2), panelMat);
        panel.position.set(x, panelY, z);
        panel.receiveShadow = true;
        this._themeGroups.wallDetails.add(panel);
      }
    }
    // Left / right walls
    for (const x of [-hw + wallThick / 2 + recess, hw - wallThick / 2 - recess]) {
      for (let z = -hd + 30; z < hd - 20; z += 55) {
        const pw = 40;
        const panel = new THREE.Mesh(new THREE.BoxGeometry(1.2, panelH, pw), panelMat);
        panel.position.set(x, panelY, z);
        panel.receiveShadow = true;
        this._themeGroups.wallDetails.add(panel);
      }
    }
  }

  // ── Windows (tall side-wall windows with frame, glass, sill, mullions) ──
  createWindows() {
    this._themeGroups.windows = new THREE.Group();
    this.meshGroup.add(this._themeGroups.windows);

    const hw = ROOM.halfWidth;
    const hd = ROOM.halfDepth;
    const wallThick = 6;

    const frameMat = this._mat('windowFrame', {
      color: 0xd4c4a8, roughness: 0.55, metalness: 0.10,
    });
    const glassMat = this._mat('windowGlass', {
      color: 0xc8e0f0, roughness: 0.05, metalness: 0.15,
      transparent: true, opacity: 0.28,
    });
    const sillMat = this._mat('windowSill', {
      color: 0xccc0a8, roughness: 0.60, metalness: 0.08,
    });

    // Left and right walls, two windows each (tall, above chair rail)
    const winW = 55;
    const winH = 72;
    const winY = 72;
    const frameThick = 3.2;
    const mullionThick = 1.8;

    const windowConfigs = [
      { x: -hw, z: -hd * 0.38, ry: 0 },   // left wall, front
      { x: -hw, z:  hd * 0.38, ry: 0 },   // left wall, back
      { x:  hw, z: -hd * 0.38, ry: 0 },   // right wall, front
      { x:  hw, z:  hd * 0.38, ry: 0 },   // right wall, back
    ];

    for (const cfg of windowConfigs) {
      const grp = new THREE.Group();
      grp.position.set(cfg.x, winY, cfg.z);
      // Rotate so window faces into room
      grp.rotation.y = cfg.x < 0 ? Math.PI / 2 : -Math.PI / 2;

      // Outer frame
      const outerFrame = new THREE.Mesh(
        new THREE.BoxGeometry(winW + frameThick * 2, winH + frameThick * 2, frameThick),
        frameMat
      );
      outerFrame.castShadow = true;
      grp.add(outerFrame);

      // Inner frame (slightly recessed)
      const innerFrame = new THREE.Mesh(
        new THREE.BoxGeometry(winW + frameThick, winH + frameThick, frameThick * 0.6),
        frameMat
      );
      innerFrame.position.z = frameThick * 0.25;
      grp.add(innerFrame);

      // Glass pane
      const glass = new THREE.Mesh(
        new THREE.PlaneGeometry(winW - 2, winH - 2),
        glassMat
      );
      glass.position.z = frameThick * 0.35;
      grp.add(glass);

      // Horizontal mullion
      const hMullion = new THREE.Mesh(
        new THREE.BoxGeometry(winW + frameThick, mullionThick, frameThick * 0.7),
        frameMat
      );
      grp.add(hMullion);

      // Vertical mullion
      const vMullion = new THREE.Mesh(
        new THREE.BoxGeometry(mullionThick, winH + frameThick, frameThick * 0.7),
        frameMat
      );
      grp.add(vMullion);

      // Window sill (extends outward into room)
      const sill = new THREE.Mesh(
        new THREE.BoxGeometry(winW + frameThick * 3, 2.8, 7),
        sillMat
      );
      sill.position.set(0, -winH / 2 - frameThick - 0.4, 3.5);
      sill.castShadow = true;
      sill.receiveShadow = true;
      grp.add(sill);

      // Window header (decorative cap above frame)
      const header = new THREE.Mesh(
        new THREE.BoxGeometry(winW + frameThick * 4, 3.5, 4.5),
        sillMat
      );
      header.position.set(0, winH / 2 + frameThick + 2.0, 1.5);
      header.castShadow = true;
      grp.add(header);

      this._themeGroups.windows.add(grp);
    }
  }

  // ── Tournament posters on front/back walls ──
  createPosters() {
    this._themeGroups.posters = new THREE.Group();
    this.meshGroup.add(this._themeGroups.posters);

    const hw = ROOM.halfWidth;
    const hd = ROOM.halfDepth;
    const wallThick = 6;

    const frameMat = this._mat('posterFrame', {
      color: 0x5a4a30, roughness: 0.45, metalness: 0.15,
    });

    const posterConfigs = [
      { x: -hw * 0.45, z: -hd + wallThick / 2 + 1.5, ry: 0, text: 'WORLD\nPOOL\nMASTERS' },
      { x:  hw * 0.45, z: -hd + wallThick / 2 + 1.5, ry: 0, text: '9-BALL\nCHAMPIONSHIP' },
      { x: -hw * 0.45, z:  hd - wallThick / 2 - 1.5, ry: Math.PI, text: 'SNOOKER\nCLASSIC' },
      { x:  hw * 0.45, z:  hd - wallThick / 2 - 1.5, ry: Math.PI, text: '8-BALL\nOPEN' },
    ];

    for (const cfg of posterConfigs) {
      const grp = new THREE.Group();
      grp.position.set(cfg.x, 88, cfg.z);
      grp.rotation.y = cfg.ry;

      const pw = 34;
      const ph = 48;
      const border = 2.5;

      // Frame
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(pw + border * 2, ph + border * 2, 2.2),
        frameMat
      );
      frame.castShadow = true;
      grp.add(frame);

      // Canvas texture
      const tex = this._createPosterTexture(cfg.text);
      const canvasMat = new THREE.MeshStandardMaterial({
        map: tex, roughness: 0.85, metalness: 0.0,
      });
      const canvasMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(pw, ph),
        canvasMat
      );
      canvasMesh.position.z = 1.2;
      grp.add(canvasMesh);

      this._themeGroups.posters.add(grp);
    }
  }

  _createPosterTexture(text) {
    const W = 512;
    const H = 720;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Dark elegant background
    ctx.fillStyle = '#1a1410';
    ctx.fillRect(0, 0, W, H);

    // Subtle border
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)';
    ctx.lineWidth = 8;
    ctx.strokeRect(20, 20, W - 40, H - 40);

    // Title text
    ctx.fillStyle = '#d4af37';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = text.split('\\n');
    const lineH = 104;
    const startY = H / 2 - (lines.length - 1) * lineH / 2;
    ctx.font = 'bold 72px "Arial", sans-serif';
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], W / 2, startY + i * lineH);
    }

    // Decorative stripe
    ctx.fillStyle = 'rgba(212, 175, 55, 0.2)';
    ctx.fillRect(60, H - 140, W - 120, 8);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    if (!this._posterTextures) this._posterTextures = [];
    this._posterTextures.push(texture);
    return texture;
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

    // Recessed ceiling downlights (fixture geometry + light)
    this._themeLights.downlights = [];
    this._themeGroups.downlightFixtures = new THREE.Group();
    this.meshGroup.add(this._themeGroups.downlightFixtures);

    const downLightPositions = [
      [-120, -240], [0, -240], [120, -240],
      [-120, -80],  [0, -80],  [120, -80],
      [-120, 80],   [0, 80],   [120, 80],
      [-120, 240],  [0, 240],  [120, 240],
    ];
    const canMat = this._mat('downlightCan', {
      color: 0xf0ece0, roughness: 0.45, metalness: 0.35,
    });
    const baffleMat = this._mat('downlightBaffle', {
      color: 0xdddddd, roughness: 0.55, metalness: 0.25,
    });
    for (const [x, z] of downLightPositions) {
      // Physical can (recessed into ceiling)
      const can = new THREE.Mesh(
        new THREE.CylinderGeometry(5, 5, 2.5, 16), canMat);
      can.position.set(x, ROOM.wallHeight - 1.25, z);
      can.rotation.x = Math.PI;
      this._themeGroups.downlightFixtures.add(can);
      // Inner baffle ring
      const baffle = new THREE.Mesh(
        new THREE.CylinderGeometry(3.5, 4.2, 1.2, 16, 1, true), baffleMat);
      baffle.position.set(x, ROOM.wallHeight - 2.2, z);
      baffle.rotation.x = Math.PI;
      this._themeGroups.downlightFixtures.add(baffle);
      // Light
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

  // ── Landscape paintings on walls ──
  createPaintings() {
    this._themeGroups.paintings = new THREE.Group();
    this.meshGroup.add(this._themeGroups.paintings);

    const hw = ROOM.halfWidth;
    const hd = ROOM.halfDepth;
    const wallThick = 6;

    const frameMat = this._mat('paintingFrame', {
      color: 0x4a3a20, roughness: 0.40, metalness: 0.20,
    });
    const innerMat = this._mat('paintingInner', {
      color: 0x2a2010, roughness: 0.60, metalness: 0.05,
    });

    // Front wall — large horizontal landscape above the plaque area
    this._addPainting(0, 78, -hd + wallThick / 2 + 1.8, 70, 45, 0, frameMat, innerMat, 'mountain');

    // Back wall — matching landscape
    this._addPainting(0, 78, hd - wallThick / 2 - 1.8, 70, 45, Math.PI, frameMat, innerMat, 'lake');

    // Left wall — vertical painting between windows
    this._addPainting(-hw + wallThick / 2 + 1.8, 78, 0, 38, 58, -Math.PI / 2, frameMat, innerMat, 'forest');

    // Right wall — vertical painting between windows
    this._addPainting(hw - wallThick / 2 - 1.8, 78, 0, 38, 58, Math.PI / 2, frameMat, innerMat, 'sunset');
  }

  _addPainting(x, y, z, w, h, rotY, frameMat, innerMat, sceneType = 'mountain') {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotY;

    const tex = this._createLandscapeTexture(w, h, sceneType);
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

    (this._themeGroups.paintings || this.meshGroup).add(group);
    return group;
  }

  _createLandscapeTexture(w, h, sceneType = 'mountain') {
    const W = 1024; // higher resolution for richer detail
    const H = Math.round(W * (h / w));
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // ── Sky gradients per scene type (more color stops for smoother transition) ──
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.55);
    if (sceneType === 'sunset') {
      skyGrad.addColorStop(0, '#2a1a3a');
      skyGrad.addColorStop(0.15, '#4a2a4a');
      skyGrad.addColorStop(0.35, '#8a4a50');
      skyGrad.addColorStop(0.55, '#c07055');
      skyGrad.addColorStop(0.75, '#d8a070');
      skyGrad.addColorStop(1, '#e8c8a0');
    } else if (sceneType === 'lake') {
      skyGrad.addColorStop(0, '#5a7a90');
      skyGrad.addColorStop(0.2, '#7a9ab0');
      skyGrad.addColorStop(0.45, '#a0c0d0');
      skyGrad.addColorStop(0.7, '#c8d8e0');
      skyGrad.addColorStop(1, '#e0e8e8');
    } else if (sceneType === 'forest') {
      skyGrad.addColorStop(0, '#4a6a50');
      skyGrad.addColorStop(0.25, '#6a8a70');
      skyGrad.addColorStop(0.5, '#8aaa90');
      skyGrad.addColorStop(0.75, '#b0c8b0');
      skyGrad.addColorStop(1, '#c8d8c0');
    } else {
      // mountain
      skyGrad.addColorStop(0, '#6a8098');
      skyGrad.addColorStop(0.2, '#8aa0b8');
      skyGrad.addColorStop(0.4, '#a8c0d0');
      skyGrad.addColorStop(0.65, '#c8d8e4');
      skyGrad.addColorStop(1, '#e4e8e0');
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    // ── Stars (subtle, for sunset and mountain scenes) ──
    if (sceneType !== 'forest') {
      for (let i = 0; i < 40; i++) {
        const sx = Math.random() * W;
        const sy = Math.random() * H * 0.25;
        const sr = Math.random() * 1.2;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,240,${0.15 + Math.random() * 0.25})`;
        ctx.fill();
      }
    }

    // ── Clouds — layered, multiple sizes, softer blur ──
    ctx.filter = 'blur(12px)';
    for (let layer = 0; layer < 3; layer++) {
      const count = 5 + layer * 3;
      const alphaBase = 0.08 + (2 - layer) * 0.04;
      for (let i = 0; i < count; i++) {
        const cx = Math.random() * W;
        const cy = Math.random() * H * (0.18 + layer * 0.08);
        const cr = 25 + Math.random() * (50 + layer * 20);
        ctx.beginPath();
        ctx.arc(cx, cy, cr, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${alphaBase + Math.random() * 0.06})`;
        ctx.fill();
        // Slightly offset second arc for cloud puffiness
        ctx.beginPath();
        ctx.arc(cx + cr * 0.4, cy - cr * 0.15, cr * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${alphaBase * 0.7})`;
        ctx.fill();
      }
    }
    ctx.filter = 'none';

    // ── Sun / moon with glow halo ──
    const sunX = sceneType === 'sunset' ? W * 0.72 : W * 0.22;
    const sunY = H * 0.14;
    const sunR = sceneType === 'sunset' ? 28 : 20;
    // Outer glow
    const glow = ctx.createRadialGradient(sunX, sunY, sunR * 0.4, sunX, sunY, sunR * 3.5);
    glow.addColorStop(0, sceneType === 'sunset' ? 'rgba(255,160,80,0.45)' : 'rgba(255,245,200,0.35)');
    glow.addColorStop(0.5, sceneType === 'sunset' ? 'rgba(255,120,60,0.15)' : 'rgba(255,230,180,0.12)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR * 3.5, 0, Math.PI * 2);
    ctx.fill();
    // Core
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.fillStyle = sceneType === 'sunset' ? 'rgba(255,210,140,0.9)' : 'rgba(255,250,220,0.75)';
    ctx.fill();

    // ── Layer 1: Far distant mountains (faint, atmospheric) ──
    ctx.fillStyle = sceneType === 'sunset' ? '#7a6a7a' : sceneType === 'lake' ? '#8aa0b0' : '#9aabb8';
    ctx.beginPath();
    ctx.moveTo(0, H * 0.42);
    for (let i = 0; i <= 16; i++) {
      const px = (i / 16) * W;
      const py = H * (0.32 + Math.sin(i * 0.9 + 1.2) * 0.06 + Math.cos(i * 1.4) * 0.04);
      ctx.lineTo(px, py);
    }
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.fill();

    // ── Layer 2: Distant mountain range ──
    ctx.fillStyle = sceneType === 'sunset' ? '#6a5a6a' : sceneType === 'lake' ? '#7a90a0' : '#8a9aaa';
    ctx.beginPath();
    ctx.moveTo(0, H * 0.48);
    for (let i = 0; i <= 14; i++) {
      const px = (i / 14) * W;
      const py = H * (0.38 + Math.sin(i * 1.2 + 0.8) * 0.07 + Math.cos(i * 1.9) * 0.05);
      ctx.lineTo(px, py);
    }
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.fill();

    // ── Layer 3: Mid-ground hills / mountains ──
    ctx.fillStyle = sceneType === 'sunset' ? '#5a4a52' : sceneType === 'lake' ? '#6a8090' : '#6a7a88';
    ctx.beginPath();
    ctx.moveTo(0, H * 0.58);
    for (let i = 0; i <= 18; i++) {
      const px = (i / 18) * W;
      const py = H * (0.46 + Math.sin(i * 1.5 + 1.5) * 0.09 + Math.cos(i * 2.2) * 0.06 + Math.sin(i * 3.1) * 0.03);
      ctx.lineTo(px, py);
    }
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.fill();

    // ── Layer 4: Foreground rolling hills ──
    ctx.fillStyle = sceneType === 'forest' ? '#3a5a3a' : sceneType === 'sunset' ? '#4a3a40' : '#4a5a52';
    ctx.beginPath();
    ctx.moveTo(0, H * 0.72);
    for (let i = 0; i <= 20; i++) {
      const px = (i / 20) * W;
      const py = H * (0.58 + Math.sin(i * 1.8 + 2.5) * 0.08 + Math.cos(i * 2.7) * 0.05 + Math.sin(i * 4.3) * 0.04);
      ctx.lineTo(px, py);
    }
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.fill();

    // ── Layer 5: Very near dark silhouette (trees/rocks) ──
    ctx.fillStyle = sceneType === 'forest' ? '#1e3018' : sceneType === 'sunset' ? '#2a1e22' : '#2a3230';
    ctx.beginPath();
    ctx.moveTo(0, H * 0.82);
    for (let i = 0; i <= 24; i++) {
      const px = (i / 24) * W;
      const base = H * (0.72 + Math.sin(i * 2.4 + 3.0) * 0.04);
      const py = base - Math.abs(Math.sin(i * 3.7)) * H * 0.06;
      ctx.lineTo(px, py);
    }
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.fill();

    // ── Lake reflection (for lake scene) ──
    if (sceneType === 'lake') {
      // Water surface gradient
      const waterGrad = ctx.createLinearGradient(0, H * 0.68, 0, H * 0.92);
      waterGrad.addColorStop(0, 'rgba(100, 130, 150, 0.35)');
      waterGrad.addColorStop(0.5, 'rgba(120, 150, 170, 0.5)');
      waterGrad.addColorStop(1, 'rgba(140, 170, 190, 0.25)');
      ctx.fillStyle = waterGrad;
      ctx.fillRect(0, H * 0.68, W, H * 0.24);
      // Reflection shimmer lines
      for (let i = 0; i < 80; i++) {
        const rx = Math.random() * W;
        const ry = H * (0.70 + Math.random() * 0.20);
        const rw = 6 + Math.random() * 30;
        ctx.fillStyle = `rgba(200,220,235,${0.08 + Math.random() * 0.18})`;
        ctx.fillRect(rx, ry, rw, 1 + Math.random() * 2);
      }
      // Distant ripples
      ctx.strokeStyle = 'rgba(180, 200, 210, 0.15)';
      ctx.lineWidth = 0.8;
      for (let i = 0; i < 12; i++) {
        const cx = Math.random() * W;
        const cy = H * (0.72 + Math.random() * 0.16);
        const cr = 10 + Math.random() * 25;
        ctx.beginPath();
        ctx.ellipse(cx, cy, cr, cr * 0.25, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // ── Forest tree silhouettes (detailed, varied) ──
    if (sceneType === 'forest') {
      ctx.fillStyle = '#1e3018';
      for (let i = 0; i < 28; i++) {
        const tx = Math.random() * W;
        const tw = 5 + Math.random() * 12;
        const th = 18 + Math.random() * 40;
        // Pine tree shape
        ctx.beginPath();
        ctx.moveTo(tx - tw / 2, H * 0.85);
        ctx.lineTo(tx, H * 0.85 - th);
        ctx.lineTo(tx + tw / 2, H * 0.85);
        ctx.fill();
        // Second tier
        ctx.beginPath();
        ctx.moveTo(tx - tw * 0.35, H * 0.85 - th * 0.35);
        ctx.lineTo(tx, H * 0.85 - th * 1.15);
        ctx.lineTo(tx + tw * 0.35, H * 0.85 - th * 0.35);
        ctx.fill();
      }
    }

    // ── Mountain snow caps ──
    if (sceneType === 'mountain') {
      ctx.fillStyle = 'rgba(230, 240, 250, 0.55)';
      for (let i = 0; i <= 14; i++) {
        const px = (i / 14) * W;
        const peakY = H * (0.38 + Math.sin(i * 1.2 + 0.8) * 0.07);
        const capH = Math.max(0, Math.sin(i * 1.2 + 0.8)) * H * 0.035;
        if (capH > 2) {
          ctx.beginPath();
          ctx.moveTo(px - 12, peakY + capH);
          ctx.lineTo(px, peakY);
          ctx.lineTo(px + 12, peakY + capH);
          ctx.fill();
        }
      }
    }

    // ── Mist / atmospheric haze overlay ──
    const mist = ctx.createLinearGradient(0, H * 0.35, 0, H * 0.85);
    mist.addColorStop(0, 'rgba(255,255,255,0)');
    mist.addColorStop(0.3, 'rgba(255,255,255,0.08)');
    mist.addColorStop(0.6, 'rgba(255,255,255,0.18)');
    mist.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, H * 0.35, W, H * 0.5);

    // ── Flocks of birds (more numerous, varied formations) ──
    ctx.strokeStyle = sceneType === 'sunset' ? 'rgba(60,40,40,0.4)' : 'rgba(40,45,55,0.35)';
    ctx.lineWidth = 1.0;
    for (let flock = 0; flock < 4; flock++) {
      const fx = W * (0.15 + Math.random() * 0.55);
      const fy = H * (0.12 + Math.random() * 0.18);
      for (let i = 0; i < 3 + Math.floor(Math.random() * 4); i++) {
        const bx = fx + i * (8 + Math.random() * 6);
        const by = fy + Math.sin(i * 0.8) * 4;
        ctx.beginPath();
        ctx.moveTo(bx - 4, by);
        ctx.quadraticCurveTo(bx - 1.5, by - 2.5, bx, by);
        ctx.quadraticCurveTo(bx + 1.5, by - 2.5, bx + 4, by);
        ctx.stroke();
      }
    }

    // ── Oil-painting texture overlay (subtle canvas grain) ──
    ctx.globalCompositeOperation = 'overlay';
    for (let i = 0; i < 600; i++) {
      const gx = Math.random() * W;
      const gy = Math.random() * H;
      ctx.fillStyle = `rgba(${120 + Math.random() * 80},${120 + Math.random() * 80},${110 + Math.random() * 90},0.04)`;
      ctx.fillRect(gx, gy, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
    ctx.globalCompositeOperation = 'source-over';

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    if (!this._landscapeTextures) this._landscapeTextures = [];
    this._landscapeTextures.push(texture);
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

    // Pot body (slightly more elegant proportions)
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(13, 10.5, 16, 20),
      potMat
    );
    pot.position.y = 8;
    pot.castShadow = true;
    pot.receiveShadow = true;
    group.add(pot);

    // Decorative foot ring
    const potFoot = new THREE.Mesh(
      new THREE.CylinderGeometry(11.5, 12, 1.8, 20),
      potMat
    );
    potFoot.position.y = 0.9;
    potFoot.castShadow = true;
    group.add(potFoot);

    // Upper rim (thick rolled edge)
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(12.8, 1.0, 8, 24),
      potMat
    );
    rim.position.y = 16;
    rim.rotation.x = Math.PI / 2;
    rim.castShadow = true;
    group.add(rim);

    // Saucer underneath
    const saucer = new THREE.Mesh(
      new THREE.CylinderGeometry(12, 11, 1.2, 20),
      trayMat
    );
    saucer.position.y = 0.6;
    saucer.receiveShadow = true;
    group.add(saucer);

    // Soil surface
    const soil = new THREE.Mesh(
      new THREE.CylinderGeometry(11.5, 11.5, 1.2, 20),
      soilMat
    );
    soil.position.y = 15.8;
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

    // Scale up to realistic size relative to the pool table
    const PLANT_SCALE = 1.6;
    group.scale.set(PLANT_SCALE, PLANT_SCALE, PLANT_SCALE);

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
    group.rotation.y = 0;

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
    const floorY = -this.profile.height - 71;
    this._themeGroups.lounge = new THREE.Group();
    this.meshGroup.add(this._themeGroups.lounge);

    const chairMat = this._mat('chairFabric', {
      color: 0x4a3028, roughness: 0.82, metalness: 0.0,
    });
    const woodMat = this._mat('chairWood', {
      color: 0x5c4030, roughness: 0.50, metalness: 0.10,
    });
    const tableMat = this._mat('sideTable', {
      color: 0x3a2820, roughness: 0.45, metalness: 0.15,
    });

    const LS = 1.38; // lounge furniture unified scale

    // Two armchairs on each side wall (scaled to match table proportions)
    this._createArmchair(-hw + 56, floorY + 44, -145, Math.PI / 2, chairMat, woodMat, LS);
    this._createArmchair(-hw + 56, floorY + 44,  145, Math.PI / 2, chairMat, woodMat, LS);
    this._createArmchair( hw - 56, floorY + 44, -145, -Math.PI / 2, chairMat, woodMat, LS);
    this._createArmchair( hw - 56, floorY + 44,  145, -Math.PI / 2, chairMat, woodMat, LS);

    // Side tables between chairs (y set so base rests on floor)
    this._createSideTable(-hw + 56, floorY + 10 * LS, -72, tableMat, LS);
    this._createSideTable(-hw + 56, floorY + 10 * LS,  72, tableMat, LS);
    this._createSideTable( hw - 56, floorY + 10 * LS, -72, tableMat, LS);
    this._createSideTable( hw - 56, floorY + 10 * LS,  72, tableMat, LS);

    // Table lamp on each side table (base + stem + bell shade)
    const lampMat = this._mat('tableLamp', {
      color: 0xfff5e0, emissive: 0xffe4b0, emissiveIntensity: 0.6,
      roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.95,
    });
    const lampMetalMat = this._mat('lampMetal', {
      color: 0x8a7a68, roughness: 0.3, metalness: 0.7,
    });
    // Side-table top surface (group.y + top.y + top half-height)
    const tableTopY = floorY + 38 * LS; // ≈ floorY + 52
    const lampPositions = [
      [-hw + 56, tableTopY, -72],
      [-hw + 56, tableTopY,  72],
      [ hw - 56, tableTopY, -72],
      [ hw - 56, tableTopY,  72],
    ];
    for (const [lx, ly, lz] of lampPositions) {
      // Circular base
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(5 * LS, 5.5 * LS, 1.5 * LS, 20), lampMetalMat);
      base.position.set(lx, ly + 0.75 * LS, lz);
      base.castShadow = true;
      this._themeGroups.lounge.add(base);

      // Stem
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.7 * LS, 0.9 * LS, 14 * LS, 12), lampMetalMat);
      stem.position.set(lx, ly + 8 * LS, lz);
      stem.castShadow = true;
      this._themeGroups.lounge.add(stem);

      // Bell-shaped shade (LatheGeometry)
      const shadeProfile = [];
      for (let i = 0; i <= 14; i++) {
        const t = i / 14;
        const r = 3.5 * LS + Math.sin(t * Math.PI) * 5.0 * LS + t * 2.0 * LS;
        const y = t * 9.0 * LS;
        shadeProfile.push(new THREE.Vector2(r, y));
      }
      const shadeGeo = new THREE.LatheGeometry(shadeProfile, 28);
      const shade = new THREE.Mesh(shadeGeo, lampMat);
      shade.position.set(lx, ly + 13 * LS, lz);
      this._themeGroups.lounge.add(shade);

      // Inner bulb
      const bulbMat = this._mat('lampBulb', {
        color: 0xffffee, emissive: 0xffe8aa, emissiveIntensity: 1.8,
        roughness: 0.1, metalness: 0.0,
      });
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(2.2 * LS, 12, 12), bulbMat);
      bulb.position.set(lx, ly + 12 * LS, lz);
      this._themeGroups.lounge.add(bulb);

      // Warm point light
      const light = new THREE.PointLight(0xffe8c0, 0.4, 65 * LS, 1.7);
      light.position.set(lx, ly + 11 * LS, lz);
      this._themeGroups.lounge.add(light);
    }
  }

  // ── Cue rack with cues — classic floor-standing rack near the back wall ──
  createCueRack() {
    const hw = ROOM.halfWidth;
    const hd = ROOM.halfDepth;
    const floorY = -this.profile.height - 71;
    const group = new THREE.Group();
    group.position.set(hw * 0.55, floorY, -hd + 30);
    group.rotation.y = Math.PI;
    this.meshGroup.add(group);

    const rackWood = this._mat('rackWood', {
      color: 0x3d2817, roughness: 0.55, metalness: 0.08,
    });
    const rackDark = this._mat('rackDark', {
      color: 0x2a1a0e, roughness: 0.60, metalness: 0.05,
    });

    const S = 1.38;

    // Two vertical posts
    const postGeo = new THREE.BoxGeometry(4 * S, 110 * S, 4 * S);
    const postL = new THREE.Mesh(postGeo, rackWood);
    postL.position.set(-18 * S, 55 * S, 0);
    postL.castShadow = true;
    group.add(postL);
    const postR = new THREE.Mesh(postGeo, rackWood);
    postR.position.set(18 * S, 55 * S, 0);
    postR.castShadow = true;
    group.add(postR);

    // Bottom base plate
    const baseGeo = new THREE.BoxGeometry(44 * S, 4 * S, 14 * S);
    const base = new THREE.Mesh(baseGeo, rackWood);
    base.position.set(0, 2 * S, 2 * S);
    base.castShadow = true;
    group.add(base);

    // Top crossbar
    const topGeo = new THREE.BoxGeometry(44 * S, 5 * S, 5 * S);
    const topBar = new THREE.Mesh(topGeo, rackWood);
    topBar.position.set(0, 108 * S, 1 * S);
    topBar.castShadow = true;
    group.add(topBar);

    // Middle shelf
    const shelfGeo = new THREE.BoxGeometry(40 * S, 3 * S, 10 * S);
    const shelf = new THREE.Mesh(shelfGeo, rackDark);
    shelf.position.set(0, 35 * S, 2 * S);
    shelf.castShadow = true;
    group.add(shelf);

    // Top V-grooves (6 slots for cues)
    for (let i = 0; i < 6; i++) {
      const t = (i - 2.5) / 2.5; // -1.0 .. 1.0
      const gx = t * 15 * S;
      const vGeo = new THREE.BoxGeometry(3 * S, 3 * S, 4 * S);
      const vBlock = new THREE.Mesh(vGeo, rackDark);
      vBlock.position.set(gx, 106.5 * S, 1 * S);
      group.add(vBlock);
    }

    // ── Cues ──
    const cueShaftMat = this._mat('cueShaft', {
      color: 0xd4a574, roughness: 0.35, metalness: 0.0,
    });
    const cueWrapMat = this._mat('cueWrap', {
      color: 0x1a1a1a, roughness: 0.70, metalness: 0.0,
    });
    const cueTipMat = this._mat('cueTip', {
      color: 0x3a2510, roughness: 0.90, metalness: 0.0,
    });
    const cueFerruleMat = this._mat('cueFerrule', {
      color: 0xdddddd, roughness: 0.15, metalness: 0.6,
    });

    const cueColors = [
      0xd4a574, 0xc49464, 0xe0b080, 0xb08050, 0xcc9a6a, 0xa07040,
    ];

    for (let i = 0; i < 6; i++) {
      const t = (i - 2.5) / 2.5;
      const cx = t * 15 * S;
      const leanAngle = 0.08 + Math.abs(t) * 0.04; // slight lean outward
      const leanDir = t >= 0 ? 1 : -1;

      const cueGroup = new THREE.Group();
      cueGroup.position.set(cx, 0, 4 * S);
      cueGroup.rotation.z = leanAngle * leanDir;
      cueGroup.rotation.x = -0.03;
      group.add(cueGroup);

      // Shaft (tapered cylinder)
      const shaftLen = 92 * S;
      const shaftGeo = new THREE.CylinderGeometry(0.55 * S, 0.85 * S, shaftLen, 10);
      const shaftMat = this._mat(`cueShaft${i}`, {
        color: cueColors[i], roughness: 0.35, metalness: 0.0,
      });
      const shaft = new THREE.Mesh(shaftGeo, shaftMat);
      shaft.position.y = shaftLen / 2 + 35 * S;
      shaft.castShadow = true;
      cueGroup.add(shaft);

      // Wrap (butt grip)
      const wrapLen = 22 * S;
      const wrapGeo = new THREE.CylinderGeometry(0.9 * S, 1.0 * S, wrapLen, 10);
      const wrap = new THREE.Mesh(wrapGeo, cueWrapMat);
      wrap.position.y = wrapLen / 2 + 35 * S;
      wrap.castShadow = true;
      cueGroup.add(wrap);

      // Butt cap
      const buttGeo = new THREE.CylinderGeometry(1.0 * S, 1.1 * S, 2 * S, 10);
      const butt = new THREE.Mesh(buttGeo, cueWrapMat);
      butt.position.y = 1 * S + 35 * S;
      cueGroup.add(butt);

      // Ferrule (white ring near tip)
      const ferruleGeo = new THREE.CylinderGeometry(0.50 * S, 0.55 * S, 1.5 * S, 10);
      const ferrule = new THREE.Mesh(ferruleGeo, cueFerruleMat);
      ferrule.position.y = shaftLen + 35 * S + 0.75 * S;
      cueGroup.add(ferrule);

      // Tip (leather)
      const tipGeo = new THREE.CylinderGeometry(0.45 * S, 0.50 * S, 1.2 * S, 10);
      const tip = new THREE.Mesh(tipGeo, cueTipMat);
      tip.position.y = shaftLen + 35 * S + 1.5 * S + 0.6 * S;
      cueGroup.add(tip);
    }

    // Triangle rack hanging on the side of the rack
    this._createTriangleRack(group, -26 * S, 48 * S, 3 * S, S);
  }

  // Small helper to build a plastic triangle rack
  _createTriangleRack(parentGroup, x, y, z, S = 1.38) {
    const rackMat = this._mat('triangleRack', {
      color:0xcc8855, roughness: 0.4, metalness: 0.05, transparent: true, opacity: 0.92,
    });
    const triGroup = new THREE.Group();
    triGroup.position.set(x, y, z);
    triGroup.rotation.x = -0.15;
    parentGroup.add(triGroup);

    // Three edges of the triangle (thin boxes)
    const edgeW = 1.2 * S;
    const edgeH = 2.2 * S;
    const sideLen = 14 * S;
    const height = sideLen * Math.sqrt(3) / 2;

    const edgeMat = rackMat;

    // Bottom edge
    const e1 = new THREE.Mesh(new THREE.BoxGeometry(sideLen, edgeH, edgeW), edgeMat);
    e1.position.set(0, -height / 3, 0);
    e1.castShadow = true;
    triGroup.add(e1);

    // Left edge
    const e2 = new THREE.Mesh(new THREE.BoxGeometry(sideLen, edgeH, edgeW), edgeMat);
    e2.position.set(-sideLen / 4, height / 6, 0);
    e2.rotation.z = Math.PI / 3;
    e2.castShadow = true;
    triGroup.add(e2);

    // Right edge
    const e3 = new THREE.Mesh(new THREE.BoxGeometry(sideLen, edgeH, edgeW), edgeMat);
    e3.position.set(sideLen / 4, height / 6, 0);
    e3.rotation.z = -Math.PI / 3;
    e3.castShadow = true;
    triGroup.add(e3);
  }

  // ── Wall sconces — brass fixtures on front and back walls ──
  createWallSconces() {
    const hw = ROOM.halfWidth;
    const hd = ROOM.halfDepth;
    const wallH = 260;
    const group = new THREE.Group();
    this.meshGroup.add(group);

    const brassMat = this._mat('sconceBrass', {
      color: 0xb8965a, roughness: 0.25, metalness: 0.85,
    });
    const glassMat = this._mat('sconceGlass', {
      color: 0xfff8e0, emissive: 0xffe8b0, emissiveIntensity: 0.5,
      roughness: 0.15, metalness: 0.0, transparent: true, opacity: 0.75,
    });
    const bulbMat = this._mat('sconceBulb', {
      color: 0xffffee, emissive: 0xffe8aa, emissiveIntensity: 2.0,
      roughness: 0.1, metalness: 0.0,
    });

    const S = 1.38;
    const positions = [
      { x: -hw + 2, y: wallH * 0.55, z: -hd * 0.6, ry: Math.PI / 2 },
      { x: -hw + 2, y: wallH * 0.55, z:  hd * 0.6, ry: Math.PI / 2 },
      { x:  hw - 2, y: wallH * 0.55, z: -hd * 0.6, ry: -Math.PI / 2 },
      { x:  hw - 2, y: wallH * 0.55, z:  hd * 0.6, ry: -Math.PI / 2 },
    ];

    for (const pos of positions) {
      const sg = new THREE.Group();
      sg.position.set(pos.x, pos.y, pos.z);
      sg.rotation.y = pos.ry;
      group.add(sg);

      // Wall mount plate
      const plate = new THREE.Mesh(
        new THREE.CylinderGeometry(5 * S, 5 * S, 1.5 * S, 16),
        brassMat);
      plate.rotation.x = Math.PI / 2;
      plate.position.z = 0.75 * S;
      plate.castShadow = true;
      sg.add(plate);

      // Arm (curved upward)
      const armGeo = new THREE.TorusGeometry(6 * S, 0.8 * S, 8, 16, Math.PI);
      const arm = new THREE.Mesh(armGeo, brassMat);
      arm.position.set(0, 3 * S, 4 * S);
      arm.rotation.y = Math.PI / 2;
      arm.castShadow = true;
      sg.add(arm);

      // Holder cup
      const cup = new THREE.Mesh(
        new THREE.CylinderGeometry(4.5 * S, 3.5 * S, 4 * S, 14, 1, true),
        brassMat);
      cup.position.set(0, 8 * S, 8 * S);
      cup.castShadow = true;
      sg.add(cup);

      // Glass shade (slightly larger, open bottom)
      const shade = new THREE.Mesh(
        new THREE.SphereGeometry(5 * S, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.65),
        glassMat);
      shade.position.set(0, 9 * S, 8 * S);
      sg.add(shade);

      // Bulb
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(2.2 * S, 10, 10),
        bulbMat);
      bulb.position.set(0, 8.5 * S, 8 * S);
      sg.add(bulb);

      // Warm wall-wash light
      const light = new THREE.PointLight(0xffe0b0, 0.35, 80 * S, 1.8);
      light.position.set(0, 7 * S, 10 * S);
      sg.add(light);
    }
  }

  // ── Table accessories — chalk, drink glass, etc. on side tables ──
  createTableAccessories() {
    const hw = ROOM.halfWidth;
    const floorY = -this.profile.height - 71;
    const S = 1.38;
    const tableTopY = floorY + 38 * S; // matches _createSideTable top surface

    const chalkMat = this._mat('chalk', {
      color: 0x0066cc, roughness: 0.85, metalness: 0.0,
    });
    const glassMat = this._mat('drinkGlass', {
      color: 0xffffff, roughness: 0.05, metalness: 0.0,
      transparent: true, opacity: 0.35,
    });
    const liquidMat = this._mat('drinkLiquid', {
      color: 0xcc6633, roughness: 0.1, metalness: 0.0,
      transparent: true, opacity: 0.75,
    });
    const coasterMat = this._mat('coaster', {
      color: 0x5c4030, roughness: 0.80, metalness: 0.0,
    });

    const positions = [
      { x: -hw + 56, z: -72 },
      { x: -hw + 56, z:  72 },
      { x:  hw - 56, z: -72 },
      { x:  hw - 56, z:  72 },
    ];

    for (let idx = 0; idx < positions.length; idx++) {
      const { x, z } = positions[idx];
      // Offset each table slightly so items don't overlap with lamp centre
      const offX = (x < 0 ? 4 : -4) * S;
      const offZ = (idx < 2 ? 3 : -3) * S;

      const tg = new THREE.Group();
      tg.position.set(x + offX, tableTopY, z + offZ);
      this.meshGroup.add(tg);

      // ── Chalk cube ──
      const chalk = new THREE.Mesh(
        new THREE.BoxGeometry(2.8 * S, 2.2 * S, 2.8 * S),
        chalkMat);
      chalk.position.set(-3 * S, 1.1 * S, -2 * S);
      chalk.rotation.y = 0.3;
      chalk.castShadow = true;
      tg.add(chalk);

      // ── Coaster + drink glass ──
      const coaster = new THREE.Mesh(
        new THREE.CylinderGeometry(5 * S, 5 * S, 0.6 * S, 16),
        coasterMat);
      coaster.position.set(2 * S, 0.3 * S, 1.5 * S);
      coaster.castShadow = true;
      tg.add(coaster);

      // Glass
      const glass = new THREE.Mesh(
        new THREE.CylinderGeometry(3.5 * S, 3.2 * S, 8 * S, 14, 1, true),
        glassMat);
      glass.position.set(2 * S, 4.3 * S, 1.5 * S);
      glass.castShadow = true;
      tg.add(glass);

      // Liquid inside
      const liquid = new THREE.Mesh(
        new THREE.CylinderGeometry(3.0 * S, 2.9 * S, 5 * S, 14),
        liquidMat);
      liquid.position.set(2 * S, 3.0 * S, 1.5 * S);
      tg.add(liquid);

      // Glass bottom
      const glassBot = new THREE.Mesh(
        new THREE.CylinderGeometry(3.2 * S, 3.2 * S, 0.4 * S, 14),
        glassMat);
      glassBot.position.set(2 * S, 0.6 * S, 1.5 * S);
      tg.add(glassBot);
    }
  }

  _createArmchair(x, y, z, rotY, fabricMat, woodMat, S = 1.38) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotY;

    // ── Seat cushion (soft top layer) ──
    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(70 * S, 8 * S, 55 * S), fabricMat);
    seat.position.y = 1 * S;
    seat.castShadow = true;
    group.add(seat);

    // Seat base (firmer lower layer, slightly inset for overhang look)
    const seatBase = new THREE.Mesh(
      new THREE.BoxGeometry(66 * S, 4 * S, 51 * S), fabricMat);
    seatBase.position.y = -3.5 * S;
    seatBase.castShadow = true;
    group.add(seatBase);

    // ── Backrest — gently reclined with rounded top ──
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(66 * S, 36 * S, 5 * S), fabricMat);
    back.position.set(0, 13 * S, -26.5 * S);
    back.rotation.x = -0.06;
    back.castShadow = true;
    group.add(back);

    // Backrest top roll (cylinder half gives a plush rounded edge)
    const backTopGeo = new THREE.CylinderGeometry(4 * S, 4 * S, 66 * S, 14, 1, false, 0, Math.PI);
    const backTop = new THREE.Mesh(backTopGeo, fabricMat);
    backTop.rotation.z = Math.PI / 2;
    backTop.rotation.x = -0.06;
    backTop.position.set(0, 31.5 * S, -26.5 * S);
    backTop.castShadow = true;
    group.add(backTop);

    // ── Armrests — padded tops on wooden supports ──
    const armPadL = new THREE.Mesh(
      new THREE.BoxGeometry(8 * S, 3 * S, 50 * S), fabricMat);
    armPadL.position.set(-34 * S, 8 * S, 0);
    armPadL.castShadow = true;
    group.add(armPadL);

    const armSupportL = new THREE.Mesh(
      new THREE.BoxGeometry(5 * S, 11 * S, 48 * S), woodMat);
    armSupportL.position.set(-34 * S, 1.5 * S, 0);
    armSupportL.castShadow = true;
    group.add(armSupportL);

    const armPadR = new THREE.Mesh(
      new THREE.BoxGeometry(8 * S, 3 * S, 50 * S), fabricMat);
    armPadR.position.set(34 * S, 8 * S, 0);
    armPadR.castShadow = true;
    group.add(armPadR);

    const armSupportR = new THREE.Mesh(
      new THREE.BoxGeometry(5 * S, 11 * S, 48 * S), woodMat);
    armSupportR.position.set(34 * S, 1.5 * S, 0);
    armSupportR.castShadow = true;
    group.add(armSupportR);

    // ── Legs — turned wood style with decorative ball feet ──
    const legH = 28 * S;
    const legGeo = new THREE.CylinderGeometry(2.5 * S, 1.8 * S, legH, 8);
    const footGeo = new THREE.SphereGeometry(2.8 * S, 10, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    const legY = -(5.5 * S + legH / 2);

    for (const [lx, lz] of [[-28 * S, -20 * S], [28 * S, -20 * S], [-28 * S, 20 * S], [28 * S, 20 * S]]) {
      const leg = new THREE.Mesh(legGeo, woodMat);
      leg.position.set(lx, legY, lz);
      leg.castShadow = true;
      group.add(leg);

      const foot = new THREE.Mesh(footGeo, woodMat);
      foot.position.set(lx, legY - legH / 2, lz);
      foot.castShadow = true;
      group.add(foot);
    }

    (this._themeGroups.lounge || this.meshGroup).add(group);
  }

  _createSideTable(x, y, z, tableMat, S = 1.38) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    // Table top
    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(18 * S, 18 * S, 2 * S, 24), tableMat);
    top.position.y = 27 * S;
    top.castShadow = true;
    group.add(top);

    // Stem — tall enough to reach from base to top
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(2.5 * S, 3.0 * S, 30 * S, 12), tableMat);
    stem.position.y = 11 * S;
    stem.castShadow = true;
    group.add(stem);

    // Base — rests on floor (group.y is set so base bottom ≈ floorY)
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(12 * S, 13 * S, 6 * S, 24), tableMat);
    base.position.y = -7 * S;
    base.castShadow = true;
    group.add(base);

    (this._themeGroups.lounge || this.meshGroup).add(group);
  }

  // Large area rug under the table
  createRug() {
    this._themeGroups.rug = new THREE.Group();
    this.meshGroup.add(this._themeGroups.rug);

    const rugW = this.profile.width + 140;
    const rugD = this.profile.depth + 180;
    const floorY = -this.profile.height - 71;
    // Rug sits flush on floor: bottom at floorY, thickness 1.2
    const rugY = floorY + 0.6;

    // ── Procedural rug texture with medallion, borders and corner motifs ──
    const rugTex = this._createRugTexture();
    const rugMat = this._mat('rug', {
      map: rugTex,
      color: 0xffffff,
      roughness: 0.95,
      metalness: 0.0,
    });
    const rug = new THREE.Mesh(
      new THREE.BoxGeometry(rugW, 0.3, rugD), rugMat);
    rug.position.set(0, rugY, 0);
    rug.receiveShadow = true;
    this._themeGroups.rug.add(rug);

    // ── Physical border layers (stacked on floor, none penetrate below) ──
    const outerBorderMat = this._mat('rugBorderOuter', {
      color: 0x3a2018, roughness: 0.92, metalness: 0.0,
    });
    const midBorderMat = this._mat('rugBorderMid', {
      color: 0x5a3a28, roughness: 0.88, metalness: 0.0,
    });
    const innerBorderMat = this._mat('rugBorderInner', {
      color: 0x4a3020, roughness: 0.90, metalness: 0.0,
    });
    const accentMat = this._mat('rugAccent', {
      color: 0x7a5a30, roughness: 0.85, metalness: 0.05,
    });

    // All borders sit on floor (bottom = floorY + 0.05 to avoid z-fighting)
    const baseY = floorY + 0.05;

    // Outer wide border
    const outerW = rugW + 10;
    const outerD = rugD + 10;
    const outerBorder = new THREE.Mesh(
      new THREE.BoxGeometry(outerW, 0.7, outerD), outerBorderMat);
    outerBorder.position.set(0, baseY + 0.35, 0);
    outerBorder.receiveShadow = true;
    this._themeGroups.rug.add(outerBorder);

    // Mid decorative band (inset from outer edge)
    const midW = rugW + 4;
    const midD = rugD + 4;
    const midBorder = new THREE.Mesh(
      new THREE.BoxGeometry(midW, 0.9, midD), midBorderMat);
    midBorder.position.set(0, baseY + 0.45, 0);
    midBorder.receiveShadow = true;
    this._themeGroups.rug.add(midBorder);

    // Inner thin border line
    const innerW = rugW - 12;
    const innerD = rugD - 12;
    const innerBorder = new THREE.Mesh(
      new THREE.BoxGeometry(innerW, 0.85, innerD), innerBorderMat);
    innerBorder.position.set(0, baseY + 0.425, 0);
    innerBorder.receiveShadow = true;
    this._themeGroups.rug.add(innerBorder);

    // Accent lines (thin raised strips along edges)
    const lineThick = 1.2;
    const lineW = rugW - 22;
    const lineD = rugD - 22;
    const accentLines = [
      [0, rugY - 0.15, -lineD / 2, lineW, 0.5, lineThick],
      [0, rugY - 0.15,  lineD / 2, lineW, 0.5, lineThick],
      [-lineW / 2, rugY - 0.15, 0, lineThick, 0.5, lineD],
      [ lineW / 2, rugY - 0.15, 0, lineThick, 0.5, lineD],
    ];
    for (const [x, y, z, w, h, d] of accentLines) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), accentMat);
      line.position.set(x, y, z);
      line.receiveShadow = true;
      this._themeGroups.rug.add(line);
    }
  }

  /**
   * Generate a rich traditional carpet texture with medallion center,
   * multiple border bands, corner motifs and geometric filler patterns.
   */
  _createRugTexture() {
    const W = 1024;
    const H = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Palette
    const base = '#2a1810';
    const borderDark = '#3a2018';
    const borderMid = '#5a3a28';
    const borderLight = '#7a5a30';
    const accent = '#a08050';
    const highlight = '#c8a860';

    // ── Base fill ──
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, W, H);

    // ── Helper: draw a decorative border band ──
    const drawBorderBand = (inset, width, color, patternSize) => {
      const x1 = inset;
      const y1 = inset;
      const x2 = W - inset;
      const y2 = H - inset;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      // Small repeating diamonds along the border
      ctx.fillStyle = color;
      const step = patternSize;
      for (let x = x1; x <= x2; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, y1);
        ctx.lineTo(x + step * 0.25, y1 - width * 0.4);
        ctx.lineTo(x + step * 0.5, y1);
        ctx.lineTo(x + step * 0.25, y1 + width * 0.4);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x, y2);
        ctx.lineTo(x + step * 0.25, y2 + width * 0.4);
        ctx.lineTo(x + step * 0.5, y2);
        ctx.lineTo(x + step * 0.25, y2 - width * 0.4);
        ctx.fill();
      }
      for (let y = y1; y <= y2; y += step) {
        ctx.beginPath();
        ctx.moveTo(x1, y);
        ctx.lineTo(x1 - width * 0.4, y + step * 0.25);
        ctx.lineTo(x1, y + step * 0.5);
        ctx.lineTo(x1 + width * 0.4, y + step * 0.25);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x2, y);
        ctx.lineTo(x2 + width * 0.4, y + step * 0.25);
        ctx.lineTo(x2, y + step * 0.5);
        ctx.lineTo(x2 - width * 0.4, y + step * 0.25);
        ctx.fill();
      }
    };

    // ── Multiple border bands ──
    drawBorderBand(8, 14, borderDark, 28);
    drawBorderBand(26, 10, borderMid, 20);
    drawBorderBand(40, 6, borderLight, 16);
    drawBorderBand(50, 3, accent, 12);

    // ── Inner field (slightly lighter base) ──
    const innerInset = 70;
    ctx.fillStyle = '#2e1c14';
    ctx.fillRect(innerInset, innerInset, W - innerInset * 2, H - innerInset * 2);

    // ── Central medallion (octagonal star) ──
    const cx = W / 2;
    const cy = H / 2;
    const medallionR = 140;

    // Medallion outer ring
    ctx.fillStyle = borderDark;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 - Math.PI / 8;
      const px = cx + Math.cos(angle) * medallionR;
      const py = cy + Math.sin(angle) * medallionR;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // Medallion mid ring
    ctx.fillStyle = borderMid;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 - Math.PI / 8;
      const px = cx + Math.cos(angle) * (medallionR * 0.78);
      const py = cy + Math.sin(angle) * (medallionR * 0.78);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // Medallion inner star
    ctx.fillStyle = accent;
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2 - Math.PI / 16;
      const r = i % 2 === 0 ? medallionR * 0.55 : medallionR * 0.28;
      const px = cx + Math.cos(angle) * r;
      const py = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // Medallion center gem
    ctx.fillStyle = highlight;
    ctx.beginPath();
    ctx.arc(cx, cy, medallionR * 0.14, 0, Math.PI * 2);
    ctx.fill();

    // ── Corner motifs (quarter-medallion fans) ──
    const cornerSize = 70;
    const corners = [
      [innerInset + 10, innerInset + 10],
      [W - innerInset - 10, innerInset + 10],
      [innerInset + 10, H - innerInset - 10],
      [W - innerInset - 10, H - innerInset - 10],
    ];
    for (const [cpx, cpy] of corners) {
      ctx.fillStyle = borderMid;
      ctx.beginPath();
      ctx.arc(cpx, cpy, cornerSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = accent;
      ctx.beginPath();
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const r = i % 2 === 0 ? cornerSize * 0.65 : cornerSize * 0.35;
        const px = cpx + Math.cos(angle) * r;
        const py = cpy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = highlight;
      ctx.beginPath();
      ctx.arc(cpx, cpy, cornerSize * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Filler geometric pattern (diamond lattice) ──
    ctx.strokeStyle = 'rgba(160, 128, 80, 0.12)';
    ctx.lineWidth = 1.2;
    const diamondStep = 32;
    for (let x = innerInset + 20; x < W - innerInset - 20; x += diamondStep) {
      for (let y = innerInset + 20; y < H - innerInset - 20; y += diamondStep) {
        // Skip area near medallion center
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy < medallionR * medallionR * 1.5) continue;
        // Skip near corners
        let nearCorner = false;
        for (const [cpx, cpy] of corners) {
          const cdx = x - cpx;
          const cdy = y - cpy;
          if (cdx * cdx + cdy * cdy < cornerSize * cornerSize * 1.8) {
            nearCorner = true; break;
          }
        }
        if (nearCorner) continue;

        ctx.beginPath();
        ctx.moveTo(x, y - diamondStep * 0.35);
        ctx.lineTo(x + diamondStep * 0.35, y);
        ctx.lineTo(x, y + diamondStep * 0.35);
        ctx.lineTo(x - diamondStep * 0.35, y);
        ctx.closePath();
        ctx.stroke();
      }
    }

    // ── Small rosette accents scattered in the field ──
    ctx.fillStyle = 'rgba(180, 150, 90, 0.15)';
    for (let i = 0; i < 24; i++) {
      const rx = innerInset + 40 + Math.random() * (W - innerInset * 2 - 80);
      const ry = innerInset + 40 + Math.random() * (H - innerInset * 2 - 80);
      // Skip near center and corners
      const dx = rx - cx;
      const dy = ry - cy;
      if (dx * dx + dy * dy < medallionR * medallionR * 1.8) continue;
      let nearCorner = false;
      for (const [cpx, cpy] of corners) {
        const cdx = rx - cpx;
        const cdy = ry - cpy;
        if (cdx * cdx + cdy * cdy < cornerSize * cornerSize * 2.2) {
          nearCorner = true; break;
        }
      }
      if (nearCorner) continue;

      for (let p = 0; p < 6; p++) {
        const angle = (p / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(rx + Math.cos(angle) * 5, ry + Math.sin(angle) * 5, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ── Subtle wear / age overlay ──
    ctx.globalCompositeOperation = 'multiply';
    for (let i = 0; i < 200; i++) {
      const wx = Math.random() * W;
      const wy = Math.random() * H;
      const wr = 5 + Math.random() * 20;
      const grad = ctx.createRadialGradient(wx, wy, 0, wx, wy, wr);
      grad.addColorStop(0, 'rgba(60,40,30,0.08)');
      grad.addColorStop(1, 'rgba(60,40,30,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(wx, wy, wr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    if (!this._rugTextures) this._rugTextures = [];
    this._rugTextures.push(texture);
    return texture;
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
    applyMaterialTheme(this._materials.wallTrim, wall.trim);
    applyMaterialTheme(this._materials.pilaster, wall.pilaster);
    applyMaterialTheme(this._materials.windowFrame, wall.windowFrame);
    applyMaterialTheme(this._materials.windowSill, wall.windowFrame);
    applyMaterialTheme(this._materials.posterFrame, wall.posterFrame);
    applyMaterialTheme(this._materials.wainscot, wall.wall);

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
    if (this._themeGroups.lounge) {
      this._themeGroups.lounge.visible = settings.get('decorativePropsEnabled') !== false;
    }
    if (this._themeGroups.rug) {
      this._themeGroups.rug.visible = settings.get('decorativePropsEnabled') !== false;
    }
    if (this._themeGroups.wallDetails) {
      this._themeGroups.wallDetails.visible = settings.get('wallDecorEnabled') !== false;
    }
    if (this._themeGroups.windows) {
      this._themeGroups.windows.visible = settings.get('wallDecorEnabled') !== false;
    }
    if (this._themeGroups.posters) {
      this._themeGroups.posters.visible = settings.get('wallDecorEnabled') !== false;
    }
    if (this._themeGroups.paintings) {
      this._themeGroups.paintings.visible = settings.get('wallDecorEnabled') !== false;
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
    // Textures are disposed through the mesh traverse below;
    // clearing the arrays here prevents double-dispose.
    this._plaqueTexture = null;
    this._posterTextures = null;
    this._landscapeTextures = null;
    this._rugTextures = null;
    if (this.meshGroup && this.meshGroup.parent) {
      this.meshGroup.parent.remove(this.meshGroup);
    }
    this.meshGroup.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        const disposeMat = (m) => {
          if (m.map) {
            m.map.dispose();
            m.map = null;
          }
          m.dispose();
        };
        if (Array.isArray(child.material)) {
          child.material.forEach(disposeMat);
        } else {
          disposeMat(child.material);
        }
      }
    });
  }
}
