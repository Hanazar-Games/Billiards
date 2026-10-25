// @ts-check
// Physics constants of the simulation core, copied literally from
// apps/client/src/config.js and apps/client/src/game/TableProfiles.js.
// Units are centimeters (1 meter = 100 units).

export const SCALE = 100; // 1 meter = 100 units

export const BALL = {
  radius: 0.028575 * SCALE,  // 2.8575 cm
  mass: 0.17,                // kg
  segments: 80,              // sphere geometry detail (high-res for crisp numbers)
  restitution: 0.97,
  collisionRestitution: 0.98,
  collisionTangentialFriction: 0.13,
  friction: 0.15,
  damping: 0.018,            // stronger slow-down for more realistic stops
  angularDamping: 0.03,
  sleepSpeedLimit: 0.35,
  sleepAngularSpeedLimit: 0.28,
  sleepTimeLimit: 0.16,
  rollingResistance: 3.0,     // cloth deceleration in cm/s^2
  slowBrakeSpeed: 10,         // below this, braking ramps up as speed approaches zero
  slowBrakeStrength: 0.22,
  stopSpeedLimit: 0.12,
  maxSpeed: 520,
  boundaryRestitution: 0.74,
  overlapIterations: 4,
  sweepContactScale: 0.995,
  spinAngularVelocity: 8.5,
  rollCoupling: 2.8,
  rollingSpinFriction: 0.12,
  sideSpinFriction: 0.38,
  collisionSpinLoss: 0.10,
  cushionTangentialFriction: 0.20,
  cushionSideSpinTransfer: 0.018,
  cushionSpinLoss: 0.18,
  maxAngularSpeed: 180,
  cueSquirt: 0.0035,
  collisionThrow: 0.00055,
  sideSpinDecay: 0.45,
};

export const PHYSICS = {
  gravity: new Float32Array([0, -9.82 * SCALE, 0]),
  fixedTimeStep: 1 / 360,
  maxSubSteps: 24,
};

export const SHOT = {
  maxPower: 110,
  chargeRate: 150,  // power units per second
  minPower: 0,
};

/**
 * Tunable physics parameters of a world. `TUNING_LEGACY` is what the legacy
 * client uses (PhysicsWorld.js and BALL); `TUNING` is what new code runs with.
 * @typedef {Readonly<{
 *   ballTableFriction: number,
 *   ballTableRestitution: number,
 *   ballCushionRestitution: number,
 *   solverIterations: number,
 *   solverTolerance: number,
 *   rollingResistance: number,
 *   rollCoupling: number,
 *   rollingSpinFriction: number,
 *   sideSpinFriction: number,
 *   damping: number,
 *   angularDamping: number,
 * }>} Tuning
 */

/** @type {Tuning} */
export const TUNING_LEGACY = Object.freeze({
  ballTableFriction: 0.15,
  ballTableRestitution: 0.1,
  ballCushionRestitution: 0.9,
  solverIterations: 38,
  solverTolerance: 0.00035,
  rollingResistance: BALL.rollingResistance,
  rollCoupling: BALL.rollCoupling,
  rollingSpinFriction: BALL.rollingSpinFriction,
  sideSpinFriction: BALL.sideSpinFriction,
  damping: BALL.damping,
  angularDamping: BALL.angularDamping,
});

/**
 * D041: calibrated so backspin draws the cue ball back. Without cannon's
 * ball-table friction the ball slides until rollCoupling makes it roll, which
 * conserves 2.5v + ωR (docs/f1/calibragem-recuo.md, attempt 6).
 * @type {Tuning}
 */
export const TUNING = Object.freeze({
  ...TUNING_LEGACY,
  ballTableFriction: 0,
  rollCoupling: 2.04,
  rollingResistance: 3.11,
  damping: 0.0408,
  rollingSpinFriction: 0.195,
  angularDamping: 0.00674,
  sideSpinFriction: 0.96,
});

function cm(/** @type {number} */ v) {
  return (v / 100) * SCALE;
}

/**
 * Table dimensions that affect physics and competitive fairness.
 * @typedef {{
 *   id: string,
 *   width: number,
 *   depth: number,
 *   height: number,
 *   cushionHeight: number,
 *   cushionWidth: number,
 *   pocketRadius: number,
 *   cornerPocketRadius: number,
 *   sidePocketRadius: number,
 *   pocketDetectMargin: number,
 * }} TableProfile
 */

/** @type {Record<string, TableProfile>} */
export const TABLE_PROFILES = {
  pool9ft: {
    id: 'pool9ft',
    width: cm(127),
    depth: cm(254),
    height: 5,
    cushionHeight: 5,
    cushionWidth: 4,
    pocketRadius: BALL.radius * 2.55,
    cornerPocketRadius: BALL.radius * 2.55,
    sidePocketRadius: BALL.radius * 2.1,
    pocketDetectMargin: BALL.radius,
  },

  pool8ft: {
    id: 'pool8ft',
    width: cm(116.84),
    depth: cm(233.68),
    height: 5,
    cushionHeight: 5,
    cushionWidth: 4,
    pocketRadius: BALL.radius * 2.25,
    cornerPocketRadius: BALL.radius * 2.25,
    sidePocketRadius: BALL.radius * 2.1,
    pocketDetectMargin: BALL.radius,
  },

  bar7ft: {
    id: 'bar7ft',
    width: cm(99),
    depth: cm(198),
    height: 5,
    cushionHeight: 5,
    cushionWidth: 4,
    pocketRadius: BALL.radius * 2.65,
    cornerPocketRadius: BALL.radius * 2.65,
    sidePocketRadius: BALL.radius * 2.2,
    pocketDetectMargin: BALL.radius,
  },

  chinese8: {
    id: 'chinese8',
    width: cm(126),
    depth: cm(254),
    height: 5,
    cushionHeight: 5,
    cushionWidth: 4,
    pocketRadius: BALL.radius * 2.25,
    cornerPocketRadius: BALL.radius * 2.25,
    sidePocketRadius: BALL.radius * 1.75,
    pocketDetectMargin: BALL.radius,
  },
};

/**
 * Unlike the legacy lookup there is no fallback to pool9ft: an unknown id is
 * an error, so a typo never silently changes the physics.
 * @param {string} id
 * @returns {TableProfile}
 */
export function getTableProfile(id) {
  const profile = Object.hasOwn(TABLE_PROFILES, id) ? TABLE_PROFILES[id] : undefined;
  if (!profile) throw new Error(`unknown table profile: ${id}`);
  return profile;
}
