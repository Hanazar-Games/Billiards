// Builds the legacy game world (apps/client/src) without a renderer, as the F0
// spike does (spikes/sim-bench/src/world.js): same construction order as
// Game.js:208-227 plus the cushion-spin listener. Call installEnv() first.
import * as THREE from 'three';
import { PhysicsWorld } from '../../../../apps/client/src/core/PhysicsWorld.js';
import { Table } from '../../../../apps/client/src/game/Table.js';
import { BallsManager } from '../../../../apps/client/src/game/BallsManager.js';
import { getTableProfile } from '../../../../apps/client/src/game/TableProfiles.js';

export function createLegacyWorld({ tableProfileId = 'pool9ft', mode = '8ball' } = {}) {
  const profile = getTableProfile(tableProfileId);
  const physics = new PhysicsWorld();
  const scene = new THREE.Scene();
  const table = new Table(physics, profile);
  table.addToScene(scene);
  const balls = new BallsManager(physics, profile);
  balls.rackBalls(mode);
  balls.addToScene(scene);
  installCushionSpin(physics, balls);
  // Legacy pockets are THREE.Vector3 with .radius and .type attached.
  return { physics, table, balls, pockets: table.getPocketPositions() };
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
