// Builds the existing physics world (table + racked balls) without a renderer,
// in the same order as Game.js:208-227.
import * as THREE from 'three';
import { PhysicsWorld } from '../../../src/core/PhysicsWorld.js';
import { Table } from '../../../src/game/Table.js';
import { BallsManager } from '../../../src/game/BallsManager.js';
import { getTableProfile } from '../../../src/game/TableProfiles.js';

export function createWorld({ tableProfileId = 'pool9ft', mode = '8ball' } = {}) {
  const profile = getTableProfile(tableProfileId);
  const physics = new PhysicsWorld();
  const scene = new THREE.Scene();
  const table = new Table(physics, profile);
  table.addToScene(scene);
  const balls = new BallsManager(physics, profile);
  balls.rackBalls(mode);
  balls.addToScene(scene);
  installCushionSpin(physics, balls);
  return { physics, table, balls, pockets: table.getPocketPositions(), scene };
}

// The physics part of Game.setupCollisionEvents (Game.js:408-495): cushion
// contacts transfer spin. Everything else in that listener is FX/stats.
function installCushionSpin(physics, balls) {
  for (const ball of balls.balls) {
    ball.body.addEventListener('collide', (e) => {
      if (e.body.material === physics.cushionMaterial) balls.applyCushionSpin(ball);
    });
  }
}
