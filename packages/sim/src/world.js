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
 *   nextBodyId: number,
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
  // The cushions' bounding spheres span the table, so with the default sphere
  // test every ball ran sphereBox against them on every step. Boxes only drop
  // pairs that cannot touch; the narrowphase still checks bounding spheres, so
  // the contacts (and the physics) are the same.
  world.broadphase.useBoundingBoxes = true;
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

  const tableBodies = createTableBodies(profile, cushion);

  /** @type {SimWorld} */
  const simWorld = {
    world,
    materials: { ball, cushion, table },
    planeBody,
    tableBodies,
    pockets: getPocketPositions(profile),
    profile,
    tuning,
    nextBodyId: 0,
  };
  addBody(simWorld, planeBody);
  for (const body of tableBodies) addBody(simWorld, body);
  return simWorld;
}

/**
 * Adds a body under an id local to this world, in the order bodies are added.
 * cannon-es packs pairs of body ids into 16 bits each for its contact events
 * and draws ids from a counter global to the process, so a long-running
 * server would pass 65535 and get contact events for the wrong bodies. Local
 * ids also keep a shot independent of what the process simulated before.
 * @param {SimWorld} simWorld
 * @param {CANNON.Body} body
 */
export function addBody(simWorld, body) {
  body.id = simWorld.nextBodyId++;
  simWorld.world.addBody(body);
}
