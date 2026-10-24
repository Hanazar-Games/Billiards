// Runs one shot on a legacy world (createLegacyWorld) headlessly, as the F0
// spike does (spikes/sim-bench/src/run-shot.js). Two rhythms:
// - { cadence: 'fixed60' }: 6 × world.step(1/360), then the guards with
//   dt = 1/60, pockets and the stop check — the sim's rhythm;
// - { fps }: the legacy frame loop (MenuSystem → PhysicsWorld.step(dt) →
//   Game.update) with dt = 1/fps and performance.now frozen, so cannon never
//   cuts substeps by wall clock.
// `steps` counts cannon 1/360 s steps in both modes; `simSeconds` is
// steps / 360 at fixed60 and frames / fps otherwise.
// `onFrame(frame, fps, balls)` runs after every frame with each ball's
// { id, x, z, pocketed }; a ball pocketed in that frame also carries
// `pocketedAt: { x, z }`, where it was before the pocket parked its body.
import { SHOT } from '../../../../apps/client/src/config.js';

const STEP = 1 / 360;
const SIM_LIMIT_S = 20;

export function runLegacy(legacyWorld, shot, mode, { onFrame } = {}) {
  const { physics, balls, pockets } = legacyWorld;
  const fixed = mode.cadence === 'fixed60';
  if (!fixed && !(mode.fps > 0)) throw new Error(`unknown mode: ${JSON.stringify(mode)}`);
  const fps = fixed ? 60 : mode.fps;
  const dt = 1 / fps;
  const maxFrames = Math.round(SIM_LIMIT_S * fps);

  // Game.shoot: power clamped to [0, maxPower], then at least SHOT.minPower.
  const safePower = Math.min(SHOT.maxPower, Math.max(0, shot.force));
  const force = Math.max(safePower, SHOT.minPower);
  balls.getCueBall().applyImpulse(shot.dir.x * force, 0, shot.dir.z * force, shot.spin.x, shot.spin.y);

  const world = physics.world;
  const firstStep = world.stepnumber;
  let frames = 0;
  const restoreClock = fixed ? () => {} : freezeClock();
  try {
    while (frames < maxFrames) {
      if (fixed) {
        for (let i = 0; i < 6; i++) world.step(STEP);
      } else {
        physics.step(dt);
      }
      balls.updatePhysicsGuards(dt, pockets);
      const before = onFrame ? positionsInPlay(balls) : null;
      balls.checkPockets(pockets);
      frames++;
      if (onFrame) onFrame(frames, fps, frameState(balls, before));
      if (balls.allStopped()) break;
    }
  } finally {
    restoreClock();
  }

  const steps = world.stepnumber - firstStep;
  const final = [...balls.balls]
    .sort((a, b) => a.id - b.id)
    .map((b) => ({ id: b.id, x: b.body.position.x, z: b.body.position.z, pocketed: b.pocketed }));
  return { final, steps, simSeconds: fixed ? steps / 360 : frames / fps };
}

function positionsInPlay(balls) {
  return new Map(balls.balls.filter((b) => !b.pocketed).map((b) => [b.id, { x: b.body.position.x, z: b.body.position.z }]));
}

function frameState(balls, before) {
  return [...balls.balls].sort((a, b) => a.id - b.id).map((b) => {
    const state = { id: b.id, x: b.body.position.x, z: b.body.position.z, pocketed: b.pocketed };
    if (b.pocketed && before.has(b.id)) state.pocketedAt = before.get(b.id);
    return state;
  });
}

function freezeClock() {
  const frozen = performance.now();
  Object.defineProperty(performance, 'now', { value: () => frozen, configurable: true, writable: true });
  return () => { delete performance.now; };
}
