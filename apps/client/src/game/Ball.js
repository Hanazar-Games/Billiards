import * as THREE from 'three';
import { BALL, BALL_TYPE } from '../config.js';
import { applyBallStyle } from '../theme/BallThemes.js';

export class Ball {
  constructor(id, color, type = BALL_TYPE.SOLID) {
    this.id = id;
    this.type = type;
    this.pocketed = false;
    // Speed in cm/s, set by the shot playback from the change of the pose.
    this.speed = 0;

    // Visual — high precision sphere for crisp number rendering
    this.geometry = new THREE.SphereGeometry(BALL.radius, BALL.segments, BALL.segments);

    if (type === BALL_TYPE.CUE) {
      const texture = this._createCueBallTexture('redDot');
      this.material = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.05,
        metalness: 0.1,
      });
    } else {
      const texture = this.createBallTexture(id, color, type);
      this.material = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.08,
        metalness: 0.05,
      });
    }

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    this._cachedColor = color;
  }

  /**
   * Regenerate textures based on visual settings.
   * Old textures are disposed to avoid memory leaks.
   */
  updateVisualSettings(settings) {
    const quality = settings.get('ballTextureQuality') || 'high';
    const size = settings.get('ballNumberSize') || 'normal';
    const contrast = settings.get('ballNumberContrast') || 'normal';
    const markStyle = settings.get('cueBallMarkStyle') || 'redDot';
    const ballStyle = settings.get('ballStyle') || 'standard';
    const showNumbers = settings.get('ballNumbers') !== false;

    // Dispose old texture
    if (this.material.map) {
      this.material.map.dispose();
      this.material.map = null;
    }

    if (this.type === BALL_TYPE.CUE) {
      this.material.map = this._createCueBallTexture(markStyle, quality);
    } else {
      this.material.map = this.createBallTexture(this.id, this._cachedColor, this.type, quality, size, contrast, showNumbers);
    }

    // Apply surface finish style
    applyBallStyle(this.material, ballStyle, this._cachedColor);
  }

  /**
   * Generate a high-resolution equirectangular texture for a numbered ball.
   */
  createBallTexture(id, color, type, quality = 'high', numberSize = 'normal', contrast = 'normal', showNumbers = true) {
    const W = quality === 'high' ? 1024 : 512;
    const H = quality === 'high' ? 512 : 256;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    const hexColor = '#' + new THREE.Color(color).getHexString();

    // ── Base colour ──
    if (type === BALL_TYPE.STRIPE) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);

      const bandTop = Math.round(H * 0.30);
      const bandH = Math.round(H * 0.40);
      ctx.fillStyle = hexColor;
      ctx.fillRect(0, bandTop, W, bandH);
    } else {
      ctx.fillStyle = hexColor;
      ctx.fillRect(0, 0, W, H);
    }

    // ── White spot + number ──
    if (showNumbers) {
      this._drawBallSpot(ctx, id, type, W, H, numberSize, contrast);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = quality === 'high' ? 16 : 8;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  _createCueBallTexture(markStyle = 'redDot', quality = 'high') {
    const W = quality === 'high' ? 1024 : 512;
    const H = quality === 'high' ? 512 : 256;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Pure white base
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    if (markStyle === 'plain') {
      const texture = new THREE.CanvasTexture(canvas);
      texture.anisotropy = quality === 'high' ? 16 : 8;
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    }

    const cx = W / 2;
    const cy = H / 2;
    const dotR = Math.round(H * 0.065);
    const dotColor = markStyle === 'blueDot' ? '#2563eb' : '#d62828';
    const ringColor = markStyle === 'blueDot' ? 'rgba(30,80,180,0.45)' : 'rgba(180,30,30,0.45)';
    const highlightColor = markStyle === 'blueDot' ? 'rgba(200,220,255,0.35)' : 'rgba(255,255,255,0.35)';

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;

    ctx.beginPath();
    ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
    ctx.fillStyle = dotColor;
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(cx - dotR * 0.25, cy - dotR * 0.25, dotR * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = highlightColor;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(1, Math.round(dotR * 0.08));
    ctx.strokeStyle = ringColor;
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = quality === 'high' ? 16 : 8;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  _drawBallSpot(ctx, id, type, W, H, numberSize = 'normal', contrast = 'normal', showNumbers = true) {
    if (!showNumbers) return;
    const cx = W / 2;
    const cy = H / 2;

    const sizeMultipliers = { small: 0.11, normal: 0.144, large: 0.18 };
    const spotR = Math.round(H * (sizeMultipliers[numberSize] || 0.144));

    const shadowAlpha = contrast === 'high' ? 0.50 : 0.35;
    const ringAlpha = contrast === 'high' ? 0.22 : 0.12;

    ctx.save();
    ctx.shadowColor = `rgba(0,0,0,${shadowAlpha})`;
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;

    ctx.beginPath();
    ctx.arc(cx, cy, spotR, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(cx, cy, spotR, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(1, Math.round(spotR * 0.04));
    ctx.strokeStyle = `rgba(0,0,0,${ringAlpha})`;
    ctx.stroke();

    const isEight = id === 8;
    const textColor = isEight ? '#000000' : '#000000';
    const fontSize = Math.round(spotR * 1.05);
    ctx.fillStyle = textColor;
    ctx.font = `900 ${fontSize}px "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillText(String(id), cx, cy + fontSize * 0.06);
  }

  setPosition(x, y, z) {
    this.mesh.position.set(x, y, z);
    this.speed = 0;

    // Random initial orientation so balls don't all look identical at rack time
    if (this.type !== BALL_TYPE.CUE) {
      const euler = new THREE.Euler(
        (Math.random() - 0.5) * Math.PI * 2,
        (Math.random() - 0.5) * Math.PI * 2,
        (Math.random() - 0.5) * Math.PI * 2
      );
      const q = new THREE.Quaternion().setFromEuler(euler);
      this.mesh.quaternion.copy(q);
    }
  }

  getSpeed() {
    return this.speed;
  }

  remove() {
    this.pocketed = true;
    this.mesh.visible = false;
    this.speed = 0;
  }

  reset(x, y, z) {
    this.pocketed = false;
    this.mesh.visible = true;
    this.setPosition(x, y, z);
  }
}
