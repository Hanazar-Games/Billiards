import * as THREE from 'three';
import { BALL } from '../config.js';
import { getDefaultTableProfile } from './TableProfiles.js';

const LINE_COLOR = 0xffffff;
const LINE_HIT_COLOR = 0x00ff88;
const GHOST_COLOR = 0x00ff88;

export class TrajectoryPredictor {
  constructor(scene, tableProfile = null) {
    this.scene = scene;
    this.profile = tableProfile || getDefaultTableProfile();
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.visible = false;
    this.group.visible = false;

    this.lineMaterial = new THREE.LineBasicMaterial({
      color: LINE_COLOR,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });

    this.hitLineMaterial = new THREE.LineBasicMaterial({
      color: LINE_HIT_COLOR,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });

    this.ghostMaterial = new THREE.MeshBasicMaterial({
      color: GHOST_COLOR,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });

    this.ghostGeometry = new THREE.SphereGeometry(BALL.radius * 0.98, 16, 16);
    this.ghostBall = new THREE.Mesh(this.ghostGeometry, this.ghostMaterial);
    this.group.add(this.ghostBall);

    this.lines = [];
    this.activeLineCount = 0;
  }

  setTableProfile(profile) {
    this.profile = profile || this.profile;
  }

  update(cueBall, aimDirection, balls, pocketPositions) {
    this.clearLines();

    if (!this.visible || !cueBall || cueBall.pocketed) {
      this.ghostBall.visible = false;
      return;
    }

    const cuePos = cueBall.mesh.position;
    const r = BALL.radius;

    // Ray from cue ball along aim direction
    const rayOrigin = new THREE.Vector3(cuePos.x, cuePos.y, cuePos.z);
    const rayDir = new THREE.Vector3(aimDirection.x, 0, aimDirection.z).normalize();

    const firstHit = this.findFirstBallContact(rayOrigin, rayDir, balls, new Set([0]), r * 2);
    const lineStart = new THREE.Vector3().copy(rayOrigin).addScaledVector(rayDir, r * 1.05);

    if (firstHit) {
      const hitBall = firstHit.ball;
      const hitDist = firstHit.distance;
      const ballPos = hitBall.mesh.position;
      const ghostPos = new THREE.Vector3().copy(rayDir).multiplyScalar(hitDist).add(rayOrigin);
      const objectDir = new THREE.Vector3().subVectors(ballPos, ghostPos);
      objectDir.y = 0;
      objectDir.normalize();

      const cueLineEnd = new THREE.Vector3().copy(ghostPos).addScaledVector(rayDir, -r * 0.25);
      this.drawLine(lineStart, cueLineEnd, this.lineMaterial);

      const objectLineStart = new THREE.Vector3().copy(ballPos).addScaledVector(objectDir, r * 1.05);
      const objectLineDist = this.findPreviewLineDistance(
        ballPos,
        objectDir,
        balls,
        new Set([0, hitBall.id]),
        82
      );
      const objectLineEnd = new THREE.Vector3().copy(ballPos).addScaledVector(objectDir, objectLineDist);
      this.drawLine(objectLineStart, objectLineEnd, this.hitLineMaterial);

      this.ghostBall.position.copy(ghostPos);
      this.ghostBall.visible = true;
    } else {
      // No ball hit: draw line to table edge
      const edgeDist = this.rayToEdge(rayOrigin, rayDir);
      const edgePoint = new THREE.Vector3().copy(rayDir).multiplyScalar(Math.max(r * 1.2, edgeDist - r * 0.5)).add(rayOrigin);
      this.drawLine(lineStart, edgePoint, this.lineMaterial);
      this.ghostBall.visible = false;
    }
  }

  findFirstBallContact(origin, dir, balls, ignoredIds, collisionRadius) {
    let hitBall = null;
    let hitDist = Infinity;
    const collisionRadiusSq = collisionRadius * collisionRadius;

    for (const ball of balls) {
      if (ball.pocketed || ignoredIds.has(ball.id)) continue;

      const toBall = new THREE.Vector3().subVectors(ball.mesh.position, origin);
      const proj = toBall.dot(dir);
      if (proj <= 0) continue;

      const closest = new THREE.Vector3().copy(dir).multiplyScalar(proj).add(origin);
      const distSq = closest.distanceToSquared(ball.mesh.position);
      if (distSq > collisionRadiusSq) continue;

      const contactDist = proj - Math.sqrt(Math.max(0, collisionRadiusSq - distSq));
      if (contactDist >= 0 && contactDist < hitDist) {
        hitDist = contactDist;
        hitBall = ball;
      }
    }

    return hitBall ? { ball: hitBall, distance: hitDist } : null;
  }

  findPreviewLineDistance(origin, dir, balls, ignoredIds, maxDist) {
    const edgeDist = this.rayToEdge(origin, dir);
    let lineDist = Math.min(maxDist, Math.max(BALL.radius * 1.2, edgeDist - BALL.radius * 0.5));
    const nextHit = this.findFirstBallContact(origin, dir, balls, ignoredIds, BALL.radius * 2);

    if (nextHit) {
      lineDist = Math.min(lineDist, Math.max(BALL.radius * 1.2, nextHit.distance - BALL.radius * 0.95));
    }

    return lineDist;
  }

  rayToEdge(origin, dir) {
    const halfW = this.profile.width / 2 - BALL.radius;
    const halfD = this.profile.depth / 2 - BALL.radius;

    let tMin = Infinity;

    if (dir.x > 0.001) {
      tMin = Math.min(tMin, (halfW - origin.x) / dir.x);
    } else if (dir.x < -0.001) {
      tMin = Math.min(tMin, (-halfW - origin.x) / dir.x);
    }

    if (dir.z > 0.001) {
      tMin = Math.min(tMin, (halfD - origin.z) / dir.z);
    } else if (dir.z < -0.001) {
      tMin = Math.min(tMin, (-halfD - origin.z) / dir.z);
    }

    return tMin < Infinity ? tMin : 100;
  }

  drawLine(a, b, material) {
    let line = this.lines[this.activeLineCount];
    if (!line) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      line = new THREE.Line(geometry, material);
      line.frustumCulled = false;
      this.group.add(line);
      this.lines.push(line);
    }

    const positions = line.geometry.attributes.position.array;
    positions[0] = a.x;
    positions[1] = a.y;
    positions[2] = a.z;
    positions[3] = b.x;
    positions[4] = b.y;
    positions[5] = b.z;
    line.geometry.attributes.position.needsUpdate = true;
    line.geometry.computeBoundingSphere();
    line.material = material;
    line.visible = true;
    this.activeLineCount++;
  }

  clearLines() {
    for (const line of this.lines) {
      line.visible = false;
    }
    this.activeLineCount = 0;
  }

  setVisible(v) {
    this.visible = Boolean(v);
    this.group.visible = this.visible;
    this.clearLines();
    if (!this.visible) {
      this.ghostBall.visible = false;
    }
  }

  dispose() {
    this.clearLines();
    for (const line of this.lines) {
      line.geometry.dispose();
      this.group.remove(line);
    }
    this.lines = [];
    this.ghostGeometry.dispose();
    this.ghostMaterial.dispose();
    this.lineMaterial.dispose();
    this.hitLineMaterial.dispose();
    this.scene.remove(this.group);
  }
}
