// Builds the legacy game world without a renderer, from the frozen copy of the
// legacy physics in ./client (D042, never edited), as the F0 spike does
// (spikes/sim-bench/src/world.js): same construction order as Game.js:208-227
// plus the cushion-spin listener. Call installEnv() first.
import * as THREE from 'three';
import { PhysicsWorld } from './client/core/PhysicsWorld.js';
import { Table } from './client/game/Table.js';
import { BallsManager } from './client/game/BallsManager.js';
import { getTableProfile } from './client/game/TableProfiles.js';
import { BALL } from './client/config.js';

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

// Puts a sim TableState on a legacy world: balls absent from the table (or
// pocketed in it) leave the world, the others go to their positions.
export function placeLegacyTable({ physics, balls }, table) {
  const byId = new Map(table.balls.map((b) => [b.id, b]));
  for (const ball of balls.balls) {
    const s = byId.get(ball.id);
    if (!s || s.pocketed) {
      ball.remove();
      physics.removeBody(ball.body);
    } else {
      ball.setPosition(s.x, BALL.radius, s.z);
    }
  }
}
