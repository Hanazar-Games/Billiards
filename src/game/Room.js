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
    this.createFurniture();
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
      color: 0x141414,
      roughness: 0.72,
      metalness: 0.05,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = -TABLE.height - 70;
    mesh.receiveShadow = true;
    this.meshGroup.add(mesh);

    this.createFloorLines(width, depth);
  }

  createFloorLines(width, depth) {
    const lineMat = new THREE.MeshStandardMaterial({
      color: 0x262626,
      roughness: 0.8,
      metalness: 0.0,
    });

    for (let x = -width / 2; x <= width / 2; x += 48) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.2, depth), lineMat);
      line.position.set(x, -TABLE.height - 69.85, 0);
      this.meshGroup.add(line);
    }

    for (let z = -depth / 2; z <= depth / 2; z += 48) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(width, 0.2, 0.8), lineMat);
      line.position.set(0, -TABLE.height - 69.8, z);
      this.meshGroup.add(line);
    }
  }

  // ── Walls ──
  createWalls() {
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x2e231c,
      roughness: 0.88,
      metalness: 0.02,
    });
    const wainscotMat = new THREE.MeshStandardMaterial({
      color: 0x1e1510,
      roughness: 0.55,
      metalness: 0.08,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x4a3528,
      roughness: 0.45,
      metalness: 0.15,
    });
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x14100c,
      roughness: 0.4,
      metalness: 0.25,
    });

    const hw = ROOM.halfWidth;
    const hd = ROOM.halfDepth;
    const h = ROOM.wallHeight;
    const wainscotH = 55;
    const wallThick = 6;

    // Front wall (z = -hd)
    this._addWall(0, h / 2, -hd, hw * 2, h, wallThick, wallMat);
    this._addWall(0, wainscotH / 2, -hd + wallThick / 2 + 1, hw * 2, wainscotH, 3, wainscotMat);

    // Back wall (z = hd)
    this._addWall(0, h / 2, hd, hw * 2, h, wallThick, wallMat);
    this._addWall(0, wainscotH / 2, hd - wallThick / 2 - 1, hw * 2, wainscotH, 3, wainscotMat);

    // Left wall (x = -hw)
    this._addWall(-hw, h / 2, 0, wallThick, h, hd * 2, wallMat);
    this._addWall(-hw + wallThick / 2 + 1, wainscotH / 2, 0, 3, wainscotH, hd * 2, wainscotMat);

    // Right wall (x = hw)
    this._addWall(hw, h / 2, 0, wallThick, h, hd * 2, wallMat);
    this._addWall(hw - wallThick / 2 - 1, wainscotH / 2, 0, 3, wainscotH, hd * 2, wainscotMat);

    // Chair-rail trim at wainscot top
    const railH = 3;
    this._addTrim(0, wainscotH, -hd, hw * 2, railH, wallThick + 2, trimMat);
    this._addTrim(0, wainscotH, hd, hw * 2, railH, wallThick + 2, trimMat);
    this._addTrim(-hw, wainscotH, 0, wallThick + 2, railH, hd * 2, trimMat);
    this._addTrim(hw, wainscotH, 0, wallThick + 2, railH, hd * 2, trimMat);

    // Baseboard at floor level
    const baseH = 6;
    this._addTrim(0, baseH / 2, -hd, hw * 2, baseH, wallThick + 2, baseMat);
    this._addTrim(0, baseH / 2, hd, hw * 2, baseH, wallThick + 2, baseMat);
    this._addTrim(-hw, baseH / 2, 0, wallThick + 2, baseH, hd * 2, baseMat);
    this._addTrim(hw, baseH / 2, 0, wallThick + 2, baseH, hd * 2, baseMat);
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

  // ── Lounge furniture ──
  createFurniture() {
    // Two sofas along the back wall, facing the table
    this.createSofa(-145, 295, 0, 170, 82, 78, 42);
    this.createSofa(145, 295, 0, 170, 82, 78, 42);
    // Coffee table between them
    this.createCoffeeTable(0, 295, 95, 65, 42);
  }

  createSofa(cx, cz, rotY, length, width, height, seatHeight) {
    const upholstery = new THREE.MeshStandardMaterial({
      color: 0x5c3a28,
      roughness: 0.78,
      metalness: 0.04,
    });
    const darker = new THREE.MeshStandardMaterial({
      color: 0x4a2e1e,
      roughness: 0.82,
      metalness: 0.03,
    });
    const legMat = new THREE.MeshStandardMaterial({
      color: 0x1a1008,
      roughness: 0.4,
      metalness: 0.45,
    });

    const group = new THREE.Group();
    group.position.set(cx, 0, cz);
    group.rotation.y = rotY;

    // Seat cushion
    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(length, seatHeight * 0.35, width * 0.72),
      upholstery
    );
    seat.position.set(0, seatHeight * 0.55, width * 0.06);
    seat.castShadow = true;
    seat.receiveShadow = true;
    group.add(seat);

    // Backrest
    const backH = height - seatHeight * 0.9;
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(length, backH, width * 0.22),
      darker
    );
    back.position.set(0, seatHeight * 0.9 + backH / 2, -width * 0.35);
    back.castShadow = true;
    back.receiveShadow = true;
    group.add(back);

    // Armrests
    const armW = width * 0.14;
    const armH = seatHeight * 0.75;
    for (const ax of [-length / 2 + armW / 2, length / 2 - armW / 2]) {
      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(armW, armH, width * 0.78),
        darker
      );
      arm.position.set(ax, seatHeight * 0.55 + armH / 2, width * 0.04);
      arm.castShadow = true;
      arm.receiveShadow = true;
      group.add(arm);
    }

    // Back cushions (three segments)
    const segCount = 3;
    const segW = (length - armW * 2 - 4) / segCount;
    for (let i = 0; i < segCount; i++) {
      const seg = new THREE.Mesh(
        new THREE.BoxGeometry(segW, backH * 0.72, width * 0.16),
        upholstery
      );
      const xOff = -length / 2 + armW + 2 + segW / 2 + i * (segW + 1.5);
      seg.position.set(xOff, seatHeight * 0.9 + backH * 0.5, -width * 0.33);
      seg.castShadow = true;
      seg.receiveShadow = true;
      group.add(seg);
    }

    // Legs
    const legR = 2.8;
    const legH = seatHeight * 0.55;
    const legInsetX = length / 2 - 14;
    const legInsetZ = width / 2 - 14;
    const legPositions = [
      [-legInsetX, legH / 2, -legInsetZ],
      [legInsetX, legH / 2, -legInsetZ],
      [-legInsetX, legH / 2, legInsetZ],
      [legInsetX, legH / 2, legInsetZ],
    ];
    for (const [lx, ly, lz] of legPositions) {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(legR, legR * 0.65, legH, 10),
        legMat
      );
      leg.position.set(lx, ly, lz);
      leg.castShadow = true;
      group.add(leg);
    }

    this.meshGroup.add(group);
  }

  createCoffeeTable(cx, cz, width, depth, height) {
    const topMat = new THREE.MeshStandardMaterial({
      color: 0x362518,
      roughness: 0.32,
      metalness: 0.18,
    });
    const edgeMat = new THREE.MeshStandardMaterial({
      color: 0x2a1c12,
      roughness: 0.35,
      metalness: 0.22,
    });
    const legMat = new THREE.MeshStandardMaterial({
      color: 0x1a1008,
      roughness: 0.4,
      metalness: 0.4,
    });

    const group = new THREE.Group();
    group.position.set(cx, 0, cz);

    // Table top
    const topThick = 4;
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(width, topThick, depth),
      topMat
    );
    top.position.set(0, height - topThick / 2, 0);
    top.castShadow = true;
    top.receiveShadow = true;
    group.add(top);

    // Edge trim
    const edgeH = 1.5;
    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(width + 1.5, edgeH, depth + 1.5),
      edgeMat
    );
    edge.position.set(0, height - topThick - edgeH / 2, 0);
    edge.castShadow = true;
    group.add(edge);

    // Lower shelf
    const shelf = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.72, 2, depth * 0.72),
      topMat
    );
    shelf.position.set(0, height * 0.35, 0);
    shelf.castShadow = true;
    shelf.receiveShadow = true;
    group.add(shelf);

    // Legs
    const legW = 5;
    const legH = height - topThick;
    const legInsetX = width / 2 - 10;
    const legInsetZ = depth / 2 - 10;
    const legPositions = [
      [-legInsetX, legH / 2, -legInsetZ],
      [legInsetX, legH / 2, -legInsetZ],
      [-legInsetX, legH / 2, legInsetZ],
      [legInsetX, legH / 2, legInsetZ],
    ];
    for (const [lx, ly, lz] of legPositions) {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(legW, legH, legW),
        legMat
      );
      leg.position.set(lx, ly, lz);
      leg.castShadow = true;
      group.add(leg);
    }

    this.meshGroup.add(group);
  }

  // ── Table lights ──
  createTableLights() {
    const railY = 235;
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
