import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { BALL, BALL_TYPE } from '../config.js';
import { applyBallStyle } from '../theme/BallThemes.js';

export class Ball {
  constructor(id, color, type = BALL_TYPE.SOLID) {
    this.id = id;
    this.type = type;
    this.pocketed = false;

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

    // Physics
    this.shape = new CANNON.Sphere(BALL.radius);
    this.body = new CANNON.Body({
      mass: BALL.mass,
      material: null, // set by BallsManager
      linearDamping: BALL.damping,
      angularDamping: BALL.angularDamping,
    });
    this.body.addShape(this.shape);
    this.body.allowSleep = true;
    this.body.sleepSpeedLimit = BALL.sleepSpeedLimit;
    this.body.sleepTimeLimit = BALL.sleepTimeLimit;

    // Lock Y position (balls shouldn't fly or sink into table)
    this.body.linearFactor = new CANNON.Vec3(1, 0, 1);
    this.body.angularFactor = new CANNON.Vec3(1, 1, 1);

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

  setPhysicsMaterial(material) {
    this.body.material = material;
  }

  setPosition(x, y, z) {
    this.mesh.position.set(x, y, z);
    this.body.position.set(x, y, z);
    this.body.velocity.set(0, 0, 0);
    this.body.angularVelocity.set(0, 0, 0);

    // Random initial orientation so balls don't all look identical at rack time
    if (this.type !== BALL_TYPE.CUE) {
      const euler = new THREE.Euler(
        (Math.random() - 0.5) * Math.PI * 2,
        (Math.random() - 0.5) * Math.PI * 2,
        (Math.random() - 0.5) * Math.PI * 2
      );
      const q = new THREE.Quaternion().setFromEuler(euler);
      this.mesh.quaternion.copy(q);
      this.body.quaternion.set(q.x, q.y, q.z, q.w);
    }

    this.body.wakeUp();
  }

  applyImpulse(x, y, z, cueTipOffsetX = 0, cueTipOffsetY = 0) {
    this.body.wakeUp();
    const shotSpeed = Math.hypot(x, z);
    const dirX = shotSpeed > 0.001 ? x / shotSpeed : 0;
    const dirZ = shotSpeed > 0.001 ? z / shotSpeed : 1;

    // Apply linear impulse at ball centre (relative to body COM)
    this.body.applyImpulse(new CANNON.Vec3(x, y, z), new CANNON.Vec3(0, 0, 0));

    // Compute spin from off-centre cue tip hit using physical torque.
    const e = cueTipOffsetX;
    const h = cueTipOffsetY;

    if ((Math.abs(e) > 0.001 || Math.abs(h) > 0.001) && shotSpeed > 0.001) {
      const R = BALL.radius;

      // Right-hand perpendicular direction in XZ plane
      const nX = dirZ;
      const nZ = -dirX;

      // Hit point relative to ball centre (world coords)
      const hitX = e * R * nX;
      const hitY = h * R;
      const hitZ = e * R * nZ;

      // Angular impulse = r × J
      const Jx = x;
      const Jz = z;
      const angImpulseX = hitY * Jz - hitZ * 0;
      const angImpulseY = hitZ * Jx - hitX * Jz;
      const angImpulseZ = hitX * 0 - hitY * Jx;

      // Solid sphere: I = (2/5) * m * R²
      const invI = 5 / (2 * BALL.mass * R * R);

      this.body.angularVelocity.x += angImpulseX * invI;
      this.body.angularVelocity.y += angImpulseY * invI;
      this.body.angularVelocity.z += angImpulseZ * invI;

      // Squirt: horizontal offset deflects cue ball slightly sideways.
      if (Math.abs(e) > 0.001) {
        const squirt = shotSpeed * BALL.cueSquirt * e;
        this.body.velocity.x -= nX * squirt;
        this.body.velocity.z -= nZ * squirt;
      }
    }

    this.limitSpeed();
    this.limitAngularSpeed();
  }

  limitSpeed() {
    const v = this.body.velocity;
    const speedSq = v.x * v.x + v.z * v.z;
    const maxSq = BALL.maxSpeed * BALL.maxSpeed;
    if (speedSq > maxSq) {
      const scale = BALL.maxSpeed / Math.sqrt(speedSq);
      v.x *= scale;
      v.z *= scale;
    }
    v.y = 0;
  }

  limitAngularSpeed() {
    const av = this.body.angularVelocity;
    const max = BALL.maxAngularSpeed || 180;
    const speed = av.length();
    if (speed > max) {
      const scale = max / speed;
      av.x *= scale;
      av.y *= scale;
      av.z *= scale;
    }
  }

  applyLowSpeedBrake(dt) {
    if (this.pocketed) return;

    const v = this.body.velocity;
    const av = this.body.angularVelocity;
    let speed = Math.sqrt(v.x * v.x + v.z * v.z);
    let angularSpeed = av.length();

    // Rolling resistance: near-constant deceleration from cloth
    if (speed > 0) {
      const rollingDrop = Math.min(speed, BALL.rollingResistance * dt);
      const rollingFactor = (speed - rollingDrop) / speed;
      v.x *= rollingFactor;
      v.z *= rollingFactor;
      speed = Math.sqrt(v.x * v.x + v.z * v.z);
    }

    // Gentle braking as speed approaches zero
    if (speed > 0 && speed < BALL.slowBrakeSpeed) {
      const t = 1 - speed / BALL.slowBrakeSpeed;
      const brake = BALL.slowBrakeStrength * t * t;
      const factor = Math.max(0, Math.exp(-brake * dt));
      v.x *= factor;
      v.z *= factor;
      av.x *= factor;
      av.y *= factor;
      av.z *= factor;
      speed = Math.sqrt(v.x * v.x + v.z * v.z);
      angularSpeed = av.length();
    }

    // Cloth-friction spin decay. Rolling axes (x/z) should survive much
    // longer than side spin; otherwise balls visually slide after contact and
    // spin shots die before they can affect the next cushion.
    if (angularSpeed > 0) {
      const isNearlyStopped = speed < BALL.stopSpeedLimit * 2.5;
      const rollFriction = isNearlyStopped ? 2.4 : BALL.rollingSpinFriction;
      const sideFriction = isNearlyStopped ? 3.0 : BALL.sideSpinFriction;
      const rollFactor = Math.max(0, Math.exp(-rollFriction * dt));
      const sideFactor = Math.max(0, Math.exp(-sideFriction * dt));
      av.x *= rollFactor;
      av.y *= sideFactor;
      av.z *= rollFactor;
      angularSpeed = av.length();
    }

    if (speed < BALL.stopSpeedLimit && angularSpeed < BALL.sleepAngularSpeedLimit) {
      v.set(0, 0, 0);
      av.set(0, 0, 0);
      this.body.sleep();
    }
  }

  applySpinPhysics(dt) {
    if (this.pocketed) return;

    const v = this.body.velocity;
    const av = this.body.angularVelocity;
    const speed = Math.sqrt(v.x * v.x + v.z * v.z);

    // Roll coupling: drive translational velocity toward pure-rolling velocity
    const rollVx = -av.z * BALL.radius;
    const rollVz = av.x * BALL.radius;
    const rollSpeed = Math.sqrt(rollVx * rollVx + rollVz * rollVz);

    if (speed > 0.01 || rollSpeed > 0.01) {
      const coupling = 1 - Math.exp(-BALL.rollCoupling * dt);
      const slipX = rollVx - v.x;
      const slipZ = rollVz - v.z;

      const isNearlyStopped = speed < BALL.stopSpeedLimit;
      if (!isNearlyStopped) {
        v.x += slipX * coupling;
        v.z += slipZ * coupling;
      }

      av.z += (slipX / BALL.radius) * coupling * 2.5;
      av.x -= (slipZ / BALL.radius) * coupling * 2.5;
    }

    this.limitAngularSpeed();
  }

  sync() {
    this.mesh.position.copy(this.body.position);
    this.mesh.quaternion.copy(this.body.quaternion);
  }

  getSpeed() {
    return this.body.velocity.length();
  }

  isSleeping() {
    return this.body.sleepState === CANNON.Body.SLEEPING;
  }

  remove() {
    this.pocketed = true;
    this.mesh.visible = false;
    this.body.velocity.set(0, 0, 0);
    this.body.angularVelocity.set(0, 0, 0);
    this.body.position.set(0, -1000, 0);
  }

  reset(x, y, z) {
    this.pocketed = false;
    this.mesh.visible = true;
    this.setPosition(x, y, z);
  }
}
