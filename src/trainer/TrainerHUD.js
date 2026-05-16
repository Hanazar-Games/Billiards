/**
 * TrainerHUD — In-game overlay for Shot Trainer mode.
 *
 * Displays:
 *   - Current drill name and objective
 *   - Hint toggle (shows recommended aim line and power)
 *   - Target zone visualization (for position-play drills)
 *   - Real-time progress feedback
 */
import * as THREE from 'three';
import { resolveDrillPositions } from './DrillData.js';
import { BALL } from '../config.js';

export class TrainerHUD {
  constructor(scene, drill, profile) {
    this.scene = scene;
    this.drill = drill;
    this.profile = profile;
    this.hintsEnabled = false;
    this.hintMeshes = [];
    this.zoneMesh = null;
    this.labelEl = null;
    this.hintBtnEl = null;
    this.resetBtnEl = null;
    this._buildUI();
  }

  _buildUI() {
    const uiLayer = document.getElementById('ui-layer');
    if (!uiLayer) return;

    // Drill info label (top center)
    this.labelEl = document.createElement('div');
    this.labelEl.style.cssText = `
      position: absolute; top: 18px; left: 50%; transform: translateX(-50%);
      padding: 8px 20px;
      background: rgba(12,14,17,0.7);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 10px;
      color: #fff; font-size: 14px; font-weight: 700;
      pointer-events: auto;
      backdrop-filter: blur(10px);
      z-index: 15;
      white-space: nowrap;
    `;
    this.labelEl.textContent = `🎯 ${this.drill.name}`;
    uiLayer.appendChild(this.labelEl);

    // Hint toggle button (bottom right)
    this.hintBtnEl = document.createElement('button');
    this.hintBtnEl.textContent = '💡 提示: 关';
    this.hintBtnEl.style.cssText = `
      position: absolute; bottom: 38px; right: 60px;
      padding: 10px 18px;
      background: rgba(12,14,17,0.6);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 8px;
      color: #fff; font-size: 13px; font-weight: 700;
      pointer-events: auto;
      backdrop-filter: blur(10px);
      cursor: pointer; transition: all calc(0.2s / var(--ui-anim-speed));
      z-index: 15;
    `;
    this.hintBtnEl.onmouseenter = () => {
      this.hintBtnEl.style.background = 'rgba(255,255,255,0.2)';
    };
    this.hintBtnEl.onmouseleave = () => {
      this.hintBtnEl.style.background = 'rgba(12,14,17,0.6)';
    };
    this.hintBtnEl.onclick = () => this.toggleHints();
    uiLayer.appendChild(this.hintBtnEl);

    // Reset drill button (bottom center)
    this.resetBtnEl = document.createElement('button');
    this.resetBtnEl.textContent = '↺ 重置球型';
    this.resetBtnEl.style.cssText = `
      position: absolute; bottom: 38px; left: 50%; transform: translateX(-50%);
      padding: 10px 18px;
      background: rgba(12,14,17,0.6);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 8px;
      color: #fff; font-size: 13px; font-weight: 700;
      pointer-events: auto;
      backdrop-filter: blur(10px);
      cursor: pointer; transition: all calc(0.2s / var(--ui-anim-speed));
      z-index: 15;
    `;
    this.resetBtnEl.onmouseenter = () => {
      this.resetBtnEl.style.background = 'rgba(255,255,255,0.2)';
    };
    this.resetBtnEl.onmouseleave = () => {
      this.resetBtnEl.style.background = 'rgba(12,14,17,0.6)';
    };
    uiLayer.appendChild(this.resetBtnEl);
  }

  setOnReset(callback) {
    this.resetBtnEl.onclick = callback;
  }

  toggleHints() {
    this.hintsEnabled = !this.hintsEnabled;
    this.hintBtnEl.textContent = this.hintsEnabled ? '💡 提示: 开' : '💡 提示: 关';
    if (this.hintsEnabled) {
      this._showHints();
    } else {
      this._hideHints();
    }
  }

  _showHints() {
    this._hideHints();

    const pocketPositions = [
      new THREE.Vector3(-this.profile.width / 2, 0, -this.profile.depth / 2),
      new THREE.Vector3( this.profile.width / 2, 0, -this.profile.depth / 2),
      new THREE.Vector3(-this.profile.width / 2, 0, 0),
      new THREE.Vector3( this.profile.width / 2, 0, 0),
      new THREE.Vector3(-this.profile.width / 2, 0,  this.profile.depth / 2),
      new THREE.Vector3( this.profile.width / 2, 0,  this.profile.depth / 2),
    ];
    const targetPocket = pocketPositions[this.drill.targetPocket];
    if (!targetPocket) return;

    const { positions } = resolveDrillPositions(this.drill, this.profile);

    const targetBallId = Object.keys(this.drill.ballPositions)
      .map(Number).find((id) => id !== 0);
    if (targetBallId === undefined) return;

    const targetBallPos = positions[targetBallId];
    if (!targetBallPos) return;

    const start = new THREE.Vector3(targetBallPos.x, BALL.radius, targetBallPos.z);
    const end = targetPocket.clone();
    end.y = BALL.radius;

    const dir = new THREE.Vector3().subVectors(end, start).normalize();

    // Target-to-pocket line (green dashed)
    const lineGeo = new THREE.BufferGeometry().setFromPoints([start, end]);
    const lineMat = new THREE.LineDashedMaterial({
      color: 0x00e676,
      dashSize: 3,
      gapSize: 2,
      linewidth: 1,
    });
    const line = new THREE.Line(lineGeo, lineMat);
    line.computeLineDistances();
    this.scene.add(line);
    this.hintMeshes.push(line);

    // Ghost ball indicator (yellow ring)
    const ghostPos = start.clone().addScaledVector(dir, -2 * BALL.radius);
    const ringGeo = new THREE.RingGeometry(2.5, 3.5, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffd700,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(ghostPos.x, 0.1, ghostPos.z);
    ring.rotation.x = -Math.PI / 2;
    this.scene.add(ring);
    this.hintMeshes.push(ring);

    // Recommended power arc
    const arcGeo = new THREE.RingGeometry(8, 8.5, 32, 1, 0, Math.PI);
    const arcMat = new THREE.MeshBasicMaterial({
      color: 0xffab00,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    });
    const arc = new THREE.Mesh(arcGeo, arcMat);
    arc.position.set(ghostPos.x, 0.1, ghostPos.z);
    arc.rotation.x = -Math.PI / 2;
    arc.rotation.z = Math.atan2(dir.x, dir.z);
    this.scene.add(arc);
    this.hintMeshes.push(arc);
  }

  _hideHints() {
    for (const mesh of this.hintMeshes) {
      this.scene.remove(mesh);
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) mesh.material.dispose();
    }
    this.hintMeshes = [];
  }

  showTargetZone(idealZone) {
    if (!idealZone) return;
    this._hideTargetZone();

    const zoneGeo = new THREE.RingGeometry(
      idealZone.radius * 0.95,
      idealZone.radius,
      64
    );
    const zoneMat = new THREE.MeshBasicMaterial({
      color: 0x00e676,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });
    this.zoneMesh = new THREE.Mesh(zoneGeo, zoneMat);
    this.zoneMesh.position.set(idealZone.x, 0.08, idealZone.z);
    this.zoneMesh.rotation.x = -Math.PI / 2;
    this.scene.add(this.zoneMesh);
  }

  _hideTargetZone() {
    if (this.zoneMesh) {
      this.scene.remove(this.zoneMesh);
      if (this.zoneMesh.geometry) this.zoneMesh.geometry.dispose();
      if (this.zoneMesh.material) this.zoneMesh.material.dispose();
      this.zoneMesh = null;
    }
  }

  updateLabel(text) {
    if (this.labelEl) this.labelEl.textContent = text;
  }

  dispose() {
    this._hideHints();
    this._hideTargetZone();
    if (this.labelEl && this.labelEl.parentNode) {
      this.labelEl.parentNode.removeChild(this.labelEl);
    }
    if (this.hintBtnEl && this.hintBtnEl.parentNode) {
      this.hintBtnEl.parentNode.removeChild(this.hintBtnEl);
    }
    if (this.resetBtnEl && this.resetBtnEl.parentNode) {
      this.resetBtnEl.parentNode.removeChild(this.resetBtnEl);
    }
    this.labelEl = null;
    this.hintBtnEl = null;
    this.resetBtnEl = null;
  }
}
