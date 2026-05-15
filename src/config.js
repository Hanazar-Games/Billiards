// Game constants - using centimeters for physics stability
export const SCALE = 100; // 1 meter = 100 units

// Table dimensions (scaled)
export const TABLE = {
  width: 1.27 * SCALE,       // 127 cm across the short rail (X axis)
  depth: 2.54 * SCALE,       // 254 cm along the break direction (Z axis)
  height: 5,                  // table thickness
  cushionHeight: 5,           // cushion above surface
  cushionWidth: 4,            // cushion thickness
  feltColor: 0x0d5c3a,
  woodColor: 0x5c3a1e,
  cushionColor: 0x0a4a2e,
};

// Ball properties
export const BALL = {
  radius: 0.028575 * SCALE,  // 2.8575 cm
  mass: 0.17,                // kg
  segments: 80,              // sphere geometry detail (high-res for crisp numbers)
  restitution: 0.92,
  collisionRestitution: 0.94,
  collisionTangentialFriction: 0.10,
  friction: 0.15,
  damping: 0.004,            // high-speed velocity drag
  angularDamping: 0.008,
  sleepSpeedLimit: 0.35,
  sleepAngularSpeedLimit: 0.28,
  sleepTimeLimit: 0.16,
  rollingResistance: 3.5,     // cloth deceleration in cm/s^2
  slowBrakeSpeed: 10,         // below this, braking ramps up as speed approaches zero
  slowBrakeStrength: 0.18,
  stopSpeedLimit: 0.18,
  maxSpeed: 520,
  boundaryRestitution: 0.74,
  overlapIterations: 4,
  sweepContactScale: 0.995,
  spinAngularVelocity: 8.5,
  rollCoupling: 0.22,
  cueSquirt: 0.0035,
  collisionThrow: 0.00055,
  sideSpinDecay: 0.45,
};

// Pocket radius = ~1.5x ball radius (standard pool)
export const POCKET = {
  radius: BALL.radius * 1.92,  // generous pocket mouths for playable 3D aiming
  detectMargin: BALL.radius * 1.1,
};

// Physics world
export const PHYSICS = {
  gravity: new Float32Array([0, -9.82 * SCALE, 0]),
  fixedTimeStep: 1 / 360,
  maxSubSteps: 24,
};

// Ball colors (standard 8-ball set)
// Solids: 1-7, 8-ball: 8, Stripes: 9-15
export const BALL_COLORS = {
  0: 0xffffff,   // cue ball
  1: 0xffd700,   // yellow solid
  2: 0x0000ff,   // blue solid
  3: 0xff0000,   // red solid
  4: 0x800080,   // purple solid
  5: 0xff8c00,   // orange solid
  6: 0x006400,   // green solid
  7: 0x8b0000,   // maroon solid
  8: 0x111111,   // black 8-ball
  9: 0xffd700,   // yellow stripe
  10: 0x0000ff,  // blue stripe
  11: 0xff0000,  // red stripe
  12: 0x800080,  // purple stripe
  13: 0xff8c00,  // orange stripe
  14: 0x006400,  // green stripe
  15: 0x8b0000,  // maroon stripe
};

// Ball types
export const BALL_TYPE = {
  CUE: 0,
  SOLID: 1,    // 1-7
  EIGHT: 2,    // 8
  STRIPE: 3,   // 9-15
};

export function getBallType(id) {
  if (id === 0) return BALL_TYPE.CUE;
  if (id === 8) return BALL_TYPE.EIGHT;
  if (id >= 1 && id <= 7) return BALL_TYPE.SOLID;
  if (id >= 9 && id <= 15) return BALL_TYPE.STRIPE;
  return null;
}

// Room dimensions (walls / bounds)
export const ROOM = {
  halfWidth: 260,
  halfDepth: 380,
  wallHeight: 160,
  minCameraY: 10,
  maxCameraY: 220,
};

// Camera
export const CAMERA = {
  fov: 45,
  near: 0.1,
  far: 10000,
  defaultPos: [0, 180, 220],
  lookAt: [0, 0, 0],
};

// Shooting
export const SHOT = {
  maxPower: 82,
  chargeRate: 150,  // power units per second
  minPower: 0.8,
};
