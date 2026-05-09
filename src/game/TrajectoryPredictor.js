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
      const ballPos = hitBall.mesh.position;
      const ghostPos = new THREE.Vector3().copy(rayDir).multiplyScalar(hitDist).add(rayOrigin);
      const objectDir = new THREE.Vector3().subVectors(ballPos, ghostPos);
      objectDir.y = 0;
      objectDir.normalize();

      this.drawLine(rayOrigin, ghostPos, this.lineMaterial);
      const targetEnd = new THREE.Vector3().copy(ballPos).addScaledVector(objectDir, 58);
      this.drawLine(ballPos, targetEnd, this.hitLineMaterial);

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
    this.visible = Boolean(v);
    this.group.visible = this.visible;
    this.clearLines();
    if (!this.visible) {
      this.ghostBall.visible = false;
    }
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
