import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { BALL, BALL_TYPE } from '../config.js';

export class Ball {
  constructor(id, color, type = BALL_TYPE.SOLID) {
    this.id = id;
    this.type = type;
    this.pocketed = false;

    // Visual
    this.geometry = new THREE.SphereGeometry(BALL.radius, BALL.segments, BALL.segments);

    if (type === BALL_TYPE.STRIPE) {
      this.material = this.createStripeMaterial(color);
    } else if (type === BALL_TYPE.CUE) {
      this.material = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.05,
        metalness: 0.1,
      });
    } else {
      this.material = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.1,
        metalness: 0.1,
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
  }

  createStripeMaterial(color) {
    // Create a texture with white background and colored stripe
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // White base
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 128, 128);

    // Color stripe in middle
    ctx.fillStyle = '#' + new THREE.Color(color).getHexString();
    ctx.fillRect(0, 44, 128, 40);

    const texture = new THREE.CanvasTexture(canvas);
    return new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.1,
      metalness: 0.1,
    });
  }

  setPhysicsMaterial(material) {
    this.body.material = material;
  }

  setPosition(x, y, z) {
    this.mesh.position.set(x, y, z);
    this.body.position.set(x, y, z);
    this.body.velocity.set(0, 0, 0);
    this.body.angularVelocity.set(0, 0, 0);
    this.body.wakeUp();
  }

  applyImpulse(x, y, z, spinX = 0, spinZ = 0) {
    this.body.wakeUp();
    this.body.applyImpulse(new CANNON.Vec3(x, y, z), this.body.position);
    this.limitSpeed();

    // spinX = left/right english around the vertical axis.
    // spinZ = follow/draw around the local side axis.
    const maxSpin = BALL.spinAngularVelocity;
    this.body.angularVelocity.y += spinX * maxSpin;
    this.body.angularVelocity.x += spinZ * maxSpin;
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

  applyLowSpeedBrake(dt) {
    if (this.pocketed) return;

    this.limitSpeed();

    const v = this.body.velocity;
    const av = this.body.angularVelocity;
    const speed = Math.sqrt(v.x * v.x + v.z * v.z);

    if (speed > 0 && speed < BALL.slowBrakeSpeed) {
      const t = 1 - speed / BALL.slowBrakeSpeed;
      const brake = BALL.slowBrakeStrength * t * t;
      const factor = Math.max(0, Math.exp(-brake * dt));
      v.x *= factor;
      v.z *= factor;
      av.x *= factor;
      av.y *= factor;
      av.z *= factor;
    }

    const angularSpeed = av.length();
    if (speed < BALL.stopSpeedLimit && angularSpeed < 1.2) {
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

    const rollVx = -av.z * BALL.radius;
    const rollVz = av.x * BALL.radius;
    const rollSpeed = Math.sqrt(rollVx * rollVx + rollVz * rollVz);

    if (speed > 0.01 || rollSpeed > 0.01) {
      const coupling = 1 - Math.exp(-BALL.rollCoupling * dt);
      const slipX = rollVx - v.x;
      const slipZ = rollVz - v.z;

      v.x += slipX * coupling;
      v.z += slipZ * coupling;
      av.z += (slipX / BALL.radius) * coupling * 0.45;
      av.x -= (slipZ / BALL.radius) * coupling * 0.45;
    }

    if (speed > 0.5 && Math.abs(av.y) > 0.02) {
      const nx = -v.z / speed;
      const nz = v.x / speed;
      const curve = av.y * speed * BALL.sideSpinCurve * dt;
      v.x += nx * curve;
      v.z += nz * curve;
    }

    const sideDecay = Math.exp(-BALL.sideSpinDecay * dt);
    av.y *= sideDecay;
    this.limitSpeed();
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
