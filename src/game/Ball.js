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

  applyImpulse(x, y, z) {
    this.body.wakeUp();
    this.body.applyImpulse(new CANNON.Vec3(x, y, z), this.body.position);
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
