import * as THREE from 'three';
import { BALL, TABLE } from '../config.js';

const LINE_COLOR = 0xffffff;
const LINE_HIT_COLOR = 0x00ff88;
const GHOST_COLOR = 0x00ff88;

export class TrajectoryPredictor {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.visible = true;

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

    // Find first ball hit
    let hitBall = null;
    let hitDist = Infinity;
    let hitPoint = null;

    for (const ball of balls) {
      if (ball.pocketed || ball.id === 0) continue;

      const toBall = new THREE.Vector3().subVectors(ball.mesh.position, rayOrigin);
      const proj = toBall.dot(rayDir);
      if (proj < r * 2) continue; // too close or behind cue ball

      const closest = new THREE.Vector3().copy(rayDir).multiplyScalar(proj).add(rayOrigin);
      // Note: copy(rayDir) prevents modifying rayDir
      const distSq = closest.distanceToSquared(ball.mesh.position);
      if (distSq < (r * 2) * (r * 2) && proj < hitDist) {
        hitDist = proj;
        hitBall = ball;
        hitPoint = closest;
      }
    }

    if (hitBall) {
      // Draw line to ghost ball position
      const ballPos = hitBall.mesh.position;
      const toPocket = this.findBestPocketDirection(ballPos, pocketPositions, balls, hitBall.id);

      let ghostPos;
      if (toPocket && toPocket.score > -500) {
        // Align ghost ball for pocket
        ghostPos = new THREE.Vector3().copy(ballPos).addScaledVector(toPocket.dir, -2 * r);
      } else {
        // Simple reflection ghost ball
        ghostPos = new THREE.Vector3().copy(ballPos).addScaledVector(rayDir, -2 * r);
      }

      this.drawLine(rayOrigin, ghostPos, this.lineMaterial);

      // Draw target ball trajectory after hit
      if (toPocket) {
        const pocketTarget = new THREE.Vector3().copy(ballPos).addScaledVector(toPocket.dir, 60);
        this.drawLine(ballPos, pocketTarget, this.hitLineMaterial);
      }

      this.ghostBall.position.copy(ghostPos);
      this.ghostBall.visible = true;
    } else {
      // No ball hit: draw line to table edge
      const edgeDist = this.rayToEdge(rayOrigin, rayDir);
      const edgePoint = new THREE.Vector3().copy(rayDir).multiplyScalar(edgeDist).add(rayOrigin);
      this.drawLine(rayOrigin, edgePoint, this.lineMaterial);
      this.ghostBall.visible = false;
    }
  }

  findBestPocketDirection(ballPos, pocketPositions, balls, targetBallId) {
    let best = null;
    let bestScore = -Infinity;
    const r = BALL.radius;

    for (const pocket of pocketPositions) {
      const dir = new THREE.Vector3().subVectors(pocket, ballPos);
      const dist = dir.length();
      if (dist < r) continue;
      dir.normalize();

      // Check if path to pocket is clear
      let blocked = false;
      for (const ball of balls) {
        if (ball.pocketed || ball.id === targetBallId) continue;
        if (this.isPointNearLine(ball.mesh.position, ballPos, pocket, r * 2.1)) {
          blocked = true;
          break;
        }
      }

      const score = blocked ? -1000 : (1000 - dist);
      if (score > bestScore) {
        bestScore = score;
        best = { dir, score };
      }
    }

    return best;
  }

  isPointNearLine(point, lineA, lineB, threshold) {
    const abx = lineB.x - lineA.x;
    const abz = lineB.z - lineA.z;
    const lenSq = abx * abx + abz * abz;
    if (lenSq < 0.001) return false;

    const acx = point.x - lineA.x;
    const acz = point.z - lineA.z;
    const t = (acx * abx + acz * abz) / lenSq;
    if (t < 0 || t > 1) return false;

    const cx = lineA.x + t * abx;
    const cz = lineA.z + t * abz;
    const dx = point.x - cx;
    const dz = point.z - cz;
    return (dx * dx + dz * dz) < (threshold * threshold);
  }

  rayToEdge(origin, dir) {
    const halfW = TABLE.width / 2 - BALL.radius;
    const halfD = TABLE.depth / 2 - BALL.radius;

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
    const points = [a.clone(), b.clone()];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, material);
    this.group.add(line);
    this.lines.push(line);
  }

  clearLines() {
    for (const line of this.lines) {
      line.geometry.dispose();
      this.group.remove(line);
    }
    this.lines = [];
  }

  setVisible(v) {
    this.visible = v;
    this.group.visible = v;
    if (!v) this.clearLines();
  }

  dispose() {
    this.clearLines();
    this.ghostGeometry.dispose();
    this.ghostMaterial.dispose();
    this.lineMaterial.dispose();
    this.hitLineMaterial.dispose();
    this.scene.remove(this.group);
  }
}
