// @ts-check
// Headless physics world: the CANNON side of apps/client/src/core/PhysicsWorld.js
// plus Table.addToScene (body order: table plane, then the six cushions).
import * as CANNON from 'cannon-es';
import { BALL, PHYSICS, TUNING } from './constants.js';
import { createTableBodies, getPocketPositions } from './table.js';

/** @import { TableProfile, Tuning } from './constants.js' */
/** @import { Pocket } from './table.js' */

/**
 * @typedef {{
 *   world: CANNON.World,
 *   materials: { ball: CANNON.Material, cushion: CANNON.Material, table: CANNON.Material },
 *   planeBody: CANNON.Body,
 *   tableBodies: CANNON.Body[],
 *   pockets: Pocket[],
 *   profile: TableProfile,
 *   tuning: Tuning,
 * }} SimWorld
 */

/**
 * @param {TableProfile} profile
 * @param {Tuning} [tuning]
 * @returns {SimWorld}
 */
export function createWorld(profile, tuning = TUNING) {
  const world = new CANNON.World({
    gravity: new CANNON.Vec3(PHYSICS.gravity[0], PHYSICS.gravity[1], PHYSICS.gravity[2]),
  });
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.allowSleep = true;

  const ball = new CANNON.Material('ball');
  const cushion = new CANNON.Material('cushion');
  const table = new CANNON.Material('table');

  world.addContactMaterial(new CANNON.ContactMaterial(ball, cushion, {
    friction: BALL.cushionTangentialFriction,
    restitution: tuning.ballCushionRestitution,
    contactEquationStiffness: 1e8,
    contactEquationRelaxation: 3,
  }));
  world.addContactMaterial(new CANNON.ContactMaterial(ball, ball, {
    friction: BALL.collisionTangentialFriction,
    restitution: BALL.collisionRestitution,
    contactEquationStiffness: 1e8,
    contactEquationRelaxation: 3,
  }));
  world.addContactMaterial(new CANNON.ContactMaterial(ball, table, {
    friction: tuning.ballTableFriction,
    restitution: tuning.ballTableRestitution,
    contactEquationStiffness: 1e8,
    contactEquationRelaxation: 4,
  }));

  const solver = /** @type {CANNON.GSSolver} */ (world.solver);
  solver.iterations = tuning.solverIterations;
  solver.tolerance = tuning.solverTolerance;

  // Table surface: an infinite plane facing up.
  const planeBody = new CANNON.Body({ mass: 0, material: table });
  planeBody.addShape(new CANNON.Plane());
  planeBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(planeBody);

  const tableBodies = createTableBodies(profile, cushion);
  for (const body of tableBodies) world.addBody(body);

  return {
    world,
    materials: { ball, cushion, table },
    planeBody,
    tableBodies,
    pockets: getPocketPositions(profile),
    profile,
    tuning,
  };
}
