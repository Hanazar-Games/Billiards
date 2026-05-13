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

  applyImpulse(x, y, z, cueTipOffsetX = 0, cueTipOffsetY = 0) {
    this.body.wakeUp();
    const shotSpeed = Math.hypot(x, z);
    const dirX = shotSpeed > 0.001 ? x / shotSpeed : 0;
    const dirZ = shotSpeed > 0.001 ? z / shotSpeed : 1;

    // Apply linear impulse at ball center (relative to body COM)
    this.body.applyImpulse(new CANNON.Vec3(x, y, z), new CANNON.Vec3(0, 0, 0));

    // Compute spin from off-center cue tip hit using physical torque.
    // cueTipOffsetX: horizontal offset [-1,1]  (left/right english)
    // cueTipOffsetY: vertical offset   [-1,1]  (top/bottom = follow/draw)
    const e = cueTipOffsetX;
    const h = cueTipOffsetY;

    if ((Math.abs(e) > 0.001 || Math.abs(h) > 0.001) && shotSpeed > 0.001) {
      const R = BALL.radius;

      // Right-hand perpendicular direction in XZ plane
      const nX = dirZ;
      const nZ = -dirX;

      // Hit point relative to ball centre (world coords)
      //  - horizontal offset is perpendicular to aim direction
      //  - vertical offset is world-Y
      const hitX = e * R * nX;
      const hitY = h * R;
      const hitZ = e * R * nZ;

      // Angular impulse = r × J  (J is the linear impulse vector)
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
      // Right english causes squirt to the LEFT (opposite the offset).
      if (Math.abs(e) > 0.001) {
        const squirt = shotSpeed * BALL.cueSquirt * e;
        this.body.velocity.x -= nX * squirt;
        this.body.velocity.z -= nZ * squirt;
      }
    }

    this.limitSpeed();
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

    // Enhanced braking as speed approaches zero (avoids micro-jitter)
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

    // Cloth-friction spin decay: when the ball is sliding or nearly stopped,
    // cloth friction dissipates spin energy much faster than CANNON's default
    // angular damping.  This prevents balls from spinning in place forever.
    if (angularSpeed > 0) {
      const isNearlyStopped = speed < BALL.stopSpeedLimit * 2.5;
      const spinFriction = isNearlyStopped ? 5.0 : 1.0;
      const spinFactor = Math.max(0, 1 - spinFriction * dt);
      av.x *= spinFactor;
      av.y *= spinFactor;
      av.z *= spinFactor;
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
    // For a sphere rolling without slipping: v = (-ω_z·r, 0, ω_x·r)
    const rollVx = -av.z * BALL.radius;
    const rollVz = av.x * BALL.radius;
    const rollSpeed = Math.sqrt(rollVx * rollVx + rollVz * rollVz);

    if (speed > 0.01 || rollSpeed > 0.01) {
      const coupling = 1 - Math.exp(-BALL.rollCoupling * dt);
      const slipX = rollVx - v.x;
      const slipZ = rollVz - v.z;

      // When the ball is nearly stopped, do NOT let roll coupling re-accelerate
      // it from a dead stop.  Angular velocity still decays naturally toward zero.
      const isNearlyStopped = speed < BALL.stopSpeedLimit;
      if (!isNearlyStopped) {
        v.x += slipX * coupling;
        v.z += slipZ * coupling;
      }

      // Update angular velocity to conserve angular momentum.
      // For a solid sphere the correct coupling is Δω = (5/2)·Δv / R,
      // so we apply the same slip correction scaled by 2.5.
      av.z += (slipX / BALL.radius) * coupling * 2.5;
      av.x -= (slipZ / BALL.radius) * coupling * 2.5;
    }

    // Gradual side-spin (english) decay while rolling
    const sideDecay = Math.exp(-BALL.sideSpinDecay * dt);
    av.y *= sideDecay;
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
