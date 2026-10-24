// Runs one shot to rest with either the fixed-step model (the new design) or
// the legacy frame-driven model (what MenuSystem.js + Game.update do today).
import { SHOT } from '../../../src/config.js';

const FIXED_DT = 1 / 360;
const SIM_LIMIT_S = 20;

export function runShot(world, shot, { model, fps = 60, now }) {
  if (model !== 'fixed' && model !== 'legacy') throw new Error(`unknown model: ${model}`);
  const { physics, balls, pockets } = world;
  const dir = resolveAim(balls, shot.aim);
  const force = Math.min(SHOT.maxPower, shot.force);
  const dt = model === 'fixed' ? FIXED_DT : 1 / fps;

  const start = now();
  balls.getCueBall().applyImpulse(dir.x * force, 0, dir.z * force, shot.spin.x, shot.spin.y);

  const pocketed = [];
  let steps = 0;
  let simSeconds = 0;
  let stopped = false;
  while (simSeconds < SIM_LIMIT_S) {
    if (model === 'fixed') physics.world.step(FIXED_DT);
    else physics.step(dt);
    balls.updatePhysicsGuards(dt, pockets);
    for (const p of balls.checkPockets(pockets)) pocketed.push(p.id);
    steps++;
    simSeconds += dt;
    if (balls.allStopped()) { stopped = true; break; }
  }
  const wallMs = now() - start;

  const final = [...balls.balls]
    .sort((a, b) => a.id - b.id)
    .map((b) => ({ id: b.id, x: b.body.position.x, z: b.body.position.z, pocketed: b.pocketed }));
  return { steps, simSeconds, wallMs, capped: !stopped, pocketed, final, hash: hashFinal(final) };
}

function resolveAim(balls, aim) {
  let x = aim.x;
  let z = aim.z;
  if (aim.atBall !== undefined) {
    const from = balls.getCueBall().body.position;
    const to = balls.getBall(aim.atBall).body.position;
    x = to.x - from.x;
    z = to.z - from.z;
  }
  const len = Math.hypot(x, z);
  return { x: x / len, z: z / len };
}

// FNV-1a (32-bit) over Float64 x, z and one pocketed byte per ball, by id.
function hashFinal(final) {
  const view = new DataView(new ArrayBuffer(17));
  let h = 0x811c9dc5;
  for (const f of final) {
    view.setFloat64(0, f.x, true);
    view.setFloat64(8, f.z, true);
    view.setUint8(16, f.pocketed ? 1 : 0);
    for (let i = 0; i < 17; i++) {
      h ^= view.getUint8(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  }
  return h.toString(16).padStart(8, '0');
}
