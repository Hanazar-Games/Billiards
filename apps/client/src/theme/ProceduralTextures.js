/**
 * ProceduralTextures — Canvas-based cloth and surface textures for the table.
 * All textures are generated on the fly and can be re-generated when settings change.
 */

import * as THREE from 'three';

/**
 * Generate a cloth-nap (directional fibre) texture.
 * @param {number} width  — texture width in pixels
 * @param {number} height — texture height in pixels
 * @param {number} strength — nap visibility, 0..1
 */
export function createClothNapTexture(width = 512, height = 512, strength = 0.35) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Fill neutral grey base
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, width, height);

  const lines = Math.floor(width * 1.5);
  const alpha = strength * 0.12;

  for (let i = 0; i < lines; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const len = 4 + Math.random() * 12;
    const angle = (Math.random() - 0.5) * 0.12; // slight directional bias
    ctx.strokeStyle = `rgba(255,255,255,${alpha * (0.5 + Math.random() * 0.5)})`;
    ctx.lineWidth = 0.5 + Math.random();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();

    ctx.strokeStyle = `rgba(0,0,0,${alpha * (0.5 + Math.random() * 0.5)})`;
    ctx.beginPath();
    ctx.moveTo(x, y + 1);
    ctx.lineTo(x + Math.cos(angle) * len, y + 1 + Math.sin(angle) * len);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Generate a cloth diamond-pattern texture.
 * @param {number} width
 * @param {number} height
 * @param {number} strength — pattern visibility, 0..1
 */
export function createClothPatternTexture(width = 512, height = 512, strength = 0.35) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, width, height);

  const step = 32;
  const alpha = strength * 0.15;

  ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
  ctx.lineWidth = 0.6;

  for (let x = 0; x < width + height; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x - height, height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - height, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Generate a wear / burn-mark texture for cloth ageing.
 * @param {number} width
 * @param {number} height
 */
export function createClothWearTexture(width = 512, height = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, width, height);

  // Random faint dark patches (wear spots)
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const r = 10 + Math.random() * 30;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(60,60,60,0.15)');
    grad.addColorStop(1, 'rgba(128,128,128,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Light friction streaks near "break area" (centre-ish)
  for (let i = 0; i < 20; i++) {
    const cx = width * (0.35 + Math.random() * 0.3);
    const cy = height * (0.35 + Math.random() * 0.3);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 40 + Math.random() * 60);
    grad.addColorStop(0, 'rgba(200,200,200,0.06)');
    grad.addColorStop(1, 'rgba(128,128,128,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, 60, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
