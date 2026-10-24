// Reference shots on the pool9ft table (angles in radians). Tables other than
// rack8() hold only the balls they list.
import { BALL, getPocketPositions, getTableProfile } from '../src/index.js';

// Initial 8-ball rack: the float expressions of BallsManager._rackEightBall.
export function rack8(tableProfileId = 'pool9ft') {
  const profile = getTableProfile(tableProfileId);
  const r = BALL.radius;
  const d = r * 2.02;
  const halfD = profile.depth / 2;
  const balls = [];

  // Cue ball: head spot
  balls[0] = { id: 0, x: 0, z: -halfD * 0.55, pocketed: false };

  // Rack at foot spot
  const rackZ = halfD * 0.55;
  const startX = 0;

  const rackOrder = [
    1, 9, 10, 2, 8, 3, 11, 4, 5, 12, 6, 13, 7, 14, 15,
  ];
  const positions = [
    [0, 1], [-0.5, 2], [0.5, 2], [-1, 3], [0, 3], [1, 3],
    [-1.5, 4], [-0.5, 4], [0.5, 4], [1.5, 4],
    [-2, 5], [-1, 5], [0, 5], [1, 5], [2, 5],
  ];

  for (let i = 0; i < positions.length; i++) {
    const [col, row] = positions[i];
    const ballId = rackOrder[i];
    const x = startX + col * d;
    const z = rackZ + (row - 1) * d * Math.sin(Math.PI / 3);
    balls[ballId] = { id: ballId, x, z, pocketed: false };
  }
  return { tableProfileId, balls };
}

const table = (...balls) => ({
  tableProfileId: 'pool9ft',
  balls: balls.map(([id, x, z]) => ({ id, x, z, pocketed: false })),
});

// atan2(z1 − z0, x1 − x0): from the cue ball toward ball 1.
function aimAtBall1(t) {
  const cue = t.balls.find(b => b.id === 0);
  const one = t.balls.find(b => b.id === 1);
  return Math.atan2(one.z - cue.z, one.x - cue.x);
}

// Cut shot: aim the cue ball at the ghost ball, the cue ball's center when it
// touches ball 1 on the line from ball 1 to the pocket center.
function aimAtGhostBall(t, pocketIndex) {
  const cue = t.balls.find(b => b.id === 0);
  const one = t.balls.find(b => b.id === 1);
  const pocket = getPocketPositions(getTableProfile(t.tableProfileId))[pocketIndex];
  const len = Math.hypot(pocket.x - one.x, pocket.z - one.z);
  const ghostX = one.x - 2 * BALL.radius * (pocket.x - one.x) / len;
  const ghostZ = one.z - 2 * BALL.radius * (pocket.z - one.z) / len;
  return Math.atan2(ghostZ - cue.z, ghostX - cue.x);
}

const RACK = rack8();
// Straight-in pots scratch with the legacy physics (the rolling cue ball
// follows ball 1 in), so the pot shots are cuts: ~15° into a corner, ~20° into
// the side pocket.
const POT_CORNER = table([0, -21.8, -70.6], [1, -45.8, -109.3]);
const POT_SIDE = table([0, -6.7, 13.7], [1, -50, 0]);
const POT_FAR_CORNER = table([0, 21.8, 70.6], [1, 45.8, 109.3]);
const shot = (angle, power, x, y) => ({ angle, power, spin: { x, y } });

export const CORPUS = [
  { name: 'break', kind: 'break', table: rack8(), shot: shot(aimAtBall1(RACK), 110, 0, 0) },
  { name: 'medium', kind: 'break', table: rack8(), shot: shot(aimAtBall1(RACK), 50, 0, 0) },
  { name: 'english', kind: 'break', table: rack8(), shot: shot(aimAtBall1(RACK), 60, 0.8, 0) },
  { name: 'soft', kind: 'low-energy', table: rack8(), shot: shot(aimAtBall1(RACK), 15, 0, 0), expectPocketed: [] },
  { name: 'draw-rack', kind: 'calibration', table: rack8(), shot: shot(aimAtBall1(RACK), 60, 0, -0.8) },
  { name: 'rail-straight', kind: 'single', table: table([0, 0, -60]), shot: shot(Math.PI / 2, 40, 0, 0), expectPocketed: [] },
  { name: 'rail-english', kind: 'single', table: table([0, -30, -80]), shot: shot(3 * Math.PI / 4, 50, 0.6, 0), expectPocketed: [] },
  { name: 'long-stun', kind: 'single', table: table([0, 0, -100]), shot: shot(Math.PI / 2, 70, 0, 0), expectPocketed: [] },
  { name: 'follow', kind: 'single', table: table([0, 0, -60], [1, 0, 0]), shot: shot(Math.PI / 2, 40, 0, 0.6), expectPocketed: [] },
  { name: 'pot-corner', kind: 'single', table: POT_CORNER, shot: shot(aimAtGhostBall(POT_CORNER, 0), 30, 0, 0), expectPocketed: [1] },
  { name: 'pot-side', kind: 'single', table: POT_SIDE, shot: shot(aimAtGhostBall(POT_SIDE, 2), 25, 0, 0), expectPocketed: [1] },
  { name: 'pot-far-corner', kind: 'single', table: POT_FAR_CORNER, shot: shot(aimAtGhostBall(POT_FAR_CORNER, 5), 30, 0, 0), expectPocketed: [1] },
  { name: 'draw-ref', kind: 'calibration', table: table([0, 0, -50], [1, 0, 0]), shot: shot(Math.PI / 2, 60, 0, -0.8) },
];
