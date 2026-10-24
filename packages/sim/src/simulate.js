// @ts-check
// simulateShot: one shot from a table state to rest, at a fixed rhythm (cannon
// every 1/360 s, guards every 6 steps with dt = 1/60). Pure function of its
// inputs: no clock, no randomness, inputs are never mutated.
import { BALL, SHOT, TUNING, getTableProfile } from './constants.js';
import { createWorld } from './world.js';
import { applyCueImpulse, createBall } from './ball.js';
import { createGuards } from './guards.js';

/** @import * as CANNON from 'cannon-es' */
/** @import { SimBall } from './ball.js' */
/** @import { BallState, ShotInput, ShotResult, SimulateOptions, TableState } from './types.js' */

const STEP = 1 / 360;
const STEPS_PER_SECOND = 360;
const GUARD_EVERY = 6;
const GUARD_DT = 1 / 60;

/**
 * @param {TableState} table
 * @param {ShotInput} shot
 * @param {SimulateOptions} [opts]
 * @returns {ShotResult}
 */
export function simulateShot(table, shot, opts = {}) {
  const { tuning = TUNING, maxSimSeconds = 20 } = opts;
  validateShot(shot);
  if (!(Number.isFinite(maxSimSeconds) && maxSimSeconds > 0)) {
    throw new RangeError(`maxSimSeconds must be a positive finite number: ${maxSimSeconds}`);
  }
  const profile = getTableProfile(table.tableProfileId);
  const states = sortedBallStates(table.balls);

  const power = Math.min(SHOT.maxPower, shot.power);
  // Same normalization as ShotInput.js: the cue tip offset never leaves the ball.
  const spinLength = Math.max(1, Math.hypot(shot.spin.x, shot.spin.y));
  const spinX = shot.spin.x / spinLength;
  const spinY = shot.spin.y / spinLength;

  // Body order matches the legacy world: table, then the balls in play by id.
  const simWorld = createWorld(profile, tuning);
  /** @type {SimBall[]} */
  const balls = [];
  for (const s of states) {
    if (s.pocketed) continue;
    const ball = createBall(s.id, tuning);
    const start = s.id === 0 && shot.cueBall ? shot.cueBall : s;
    ball.body.position.set(start.x, BALL.radius, start.z);
    if (s.q) ball.body.quaternion.set(s.q[0], s.q[1], s.q[2], s.q[3]);
    ball.body.material = simWorld.materials.ball;
    simWorld.world.addBody(ball.body);
    balls.push(ball);
  }

  const guards = createGuards(simWorld, balls);
  // Cannon cushion contacts transfer spin, as in Game.setupCollisionEvents.
  for (const ball of balls) {
    ball.body.addEventListener('collide', (/** @type {{ body: CANNON.Body }} */ e) => {
      if (e.body.material === simWorld.materials.cushion) guards.applyCushionSpin(ball);
    });
  }

  const cue = /** @type {SimBall} */ (balls.find(b => b.id === 0));
  applyCueImpulse(cue, Math.cos(shot.angle) * power, 0, Math.sin(shot.angle) * power, spinX, spinY);

  const maxSteps = Math.round(maxSimSeconds * STEPS_PER_SECOND);
  let steps = 0;
  let stopped = false;
  while (steps < maxSteps) {
    simWorld.world.step(STEP);
    steps++;
    if (steps % GUARD_EVERY === 0) {
      guards.update(GUARD_DT);
      guards.checkPockets();
      if (guards.allStopped()) {
        stopped = true;
        break;
      }
    }
  }

  const byId = new Map(balls.map(b => [b.id, b]));
  const final = {
    tableProfileId: table.tableProfileId,
    balls: states.map(s => {
      const ball = byId.get(s.id);
      if (!ball) return { id: s.id, x: s.x, z: s.z, pocketed: true };
      return { id: s.id, x: ball.body.position.x, z: ball.body.position.z, pocketed: ball.pocketed };
    }),
  };

  return {
    frames: [],
    events: [],
    final,
    steps,
    simSeconds: steps / STEPS_PER_SECOND,
    capped: !stopped,
  };
}

/** @param {ShotInput} shot */
function validateShot(shot) {
  const numbers = { angle: shot.angle, power: shot.power, 'spin.x': shot.spin.x, 'spin.y': shot.spin.y };
  if (shot.cueBall) Object.assign(numbers, { 'cueBall.x': shot.cueBall.x, 'cueBall.z': shot.cueBall.z });
  for (const [name, value] of Object.entries(numbers)) {
    if (!Number.isFinite(value)) throw new RangeError(`shot ${name} must be a finite number: ${value}`);
  }
  if (shot.power <= 0) throw new RangeError(`shot power must be positive: ${shot.power}`);
}

/**
 * Validates the balls and returns them sorted by id (the input is untouched).
 * @param {BallState[]} input
 * @returns {BallState[]}
 */
function sortedBallStates(input) {
  const states = [...input].sort((a, b) => a.id - b.id);
  for (let i = 0; i < states.length; i++) {
    const s = states[i];
    if (!Number.isInteger(s.id) || s.id < 0) throw new RangeError(`ball id must be a non-negative integer: ${s.id}`);
    if (i > 0 && states[i - 1].id === s.id) throw new Error(`duplicate ball id: ${s.id}`);
    if (!Number.isFinite(s.x) || !Number.isFinite(s.z)) throw new RangeError(`ball ${s.id} position must be finite`);
    if (s.q && !(s.q.length === 4 && s.q.every(Number.isFinite))) throw new RangeError(`ball ${s.id} q must be 4 finite numbers`);
  }
  if (!states.some(s => s.id === 0 && !s.pocketed)) throw new Error('table state has no cue ball in play (id 0)');
  return states;
}
