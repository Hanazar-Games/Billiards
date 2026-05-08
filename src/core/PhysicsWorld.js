import * as CANNON from 'cannon-es';
import { PHYSICS, TABLE, BALL } from '../config.js';

export class PhysicsWorld {
  constructor() {
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(PHYSICS.gravity[0], PHYSICS.gravity[1], PHYSICS.gravity[2]),
    });

    // Materials
    this.ballMaterial = new CANNON.Material('ball');
    this.cushionMaterial = new CANNON.Material('cushion');
    this.tableMaterial = new CANNON.Material('table');

    // Contact materials
    const ballCushion = new CANNON.ContactMaterial(
      this.ballMaterial,
      this.cushionMaterial,
      {
        friction: 0.1,
        restitution: 0.9,
      }
    );

    const ballBall = new CANNON.ContactMaterial(
      this.ballMaterial,
      this.ballMaterial,
      {
        friction: 0.06,
        restitution: 0.92,
      }
    );

    const ballTable = new CANNON.ContactMaterial(
      this.ballMaterial,
      this.tableMaterial,
      {
        friction: 0.15,
        restitution: 0.1,
      }
    );

    this.world.addContactMaterial(ballCushion);
    this.world.addContactMaterial(ballBall);
    this.world.addContactMaterial(ballTable);

    // Default solver iterations
    this.world.solver.iterations = 20;
    this.world.solver.tolerance = 0.001;

    // Create static table body (infinite plane for the felt surface)
    this.createTableBody();
  }

  createTableBody() {
    // Table surface plane
    const shape = new CANNON.Plane();
    const body = new CANNON.Body({
      mass: 0,
      material: this.tableMaterial,
    });
    body.addShape(shape);
    body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(body);
  }

  step(dt) {
    this.world.step(PHYSICS.fixedTimeStep, dt, PHYSICS.maxSubSteps);
  }

  addBody(body) {
    this.world.addBody(body);
  }

  removeBody(body) {
    this.world.removeBody(body);
  }
}
