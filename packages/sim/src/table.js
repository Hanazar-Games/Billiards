// @ts-check
// Headless table geometry: the CANNON side of apps/client/src/game/Table.js
// (createCushions, addCushion, _addCushionBevelPhysics, createPockets and the
// physics fields of _getTableGeometryMetrics). Same arithmetic, same order, so
// the bodies are bit-identical to the legacy ones.
import * as CANNON from 'cannon-es';
import { BALL } from './constants.js';
import { cross, normalize, quaternionFromBasis } from './math.js';

/** @import { TableProfile } from './constants.js' */

/**
 * @typedef {{
 *   x: number,
 *   y: number,
 *   z: number,
 *   radius: number,
 *   type: 'corner' | 'side',
 * }} Pocket
 */

/**
 * Cushion segment metrics. The gaps are the physics baseline and must not
 * change.
 * @param {TableProfile} profile
 */
function getCushionMetrics(profile) {
  const halfW = profile.width / 2;
  const halfD = profile.depth / 2;
  const cw = profile.cushionWidth;
  const ch = BALL.radius * 2;
  const cornerR = profile.cornerPocketRadius;
  const sideR = profile.sidePocketRadius;

  const cCornerGap = cornerR * 2.25;
  const cSideGap = sideR * 2.65;

  const cShortLen = profile.width - cCornerGap * 2;
  const cLongSegLen = (profile.depth - cSideGap - cCornerGap * 2) / 2;
  const cLongZ = cSideGap / 2 + cLongSegLen / 2;

  return { halfW, halfD, cw, ch, cShortLen, cLongSegLen, cLongZ };
}

/**
 * Pocket centers at the table corners and long-rail middles, in the order
 * (-W,-D), (W,-D), (-W,0), (W,0), (-W,D), (W,D) with W = width / 2 and
 * D = depth / 2.
 * @param {TableProfile} profile
 * @returns {Pocket[]}
 */
export function getPocketPositions(profile) {
  const halfW = profile.width / 2;
  const halfD = profile.depth / 2;
  const positions = [
    [-halfW, 0, -halfD],
    [halfW, 0, -halfD],
    [-halfW, 0, 0],
    [halfW, 0, 0],
    [-halfW, 0, halfD],
    [halfW, 0, halfD],
  ];

  return positions.map(([x, y, z], i) => {
    const isCorner = i === 0 || i === 1 || i === 4 || i === 5;
    return {
      x,
      y,
      z,
      radius: isCorner ? profile.cornerPocketRadius : profile.sidePocketRadius,
      type: isCorner ? 'corner' : 'side',
    };
  });
}

/**
 * Static cushion body: the box plus its slanted bevel shape (the part of the
 * cushion that overhangs the playing surface).
 * @param {TableProfile} profile
 * @param {CANNON.Material} material
 * @param {{ x: number, y: number, z: number }} halfExtents box half extents
 * @param {{ x: number, y: number, z: number }} pos body position
 * @param {number} bevelNx bevel direction along X (-1, 0 or 1)
 * @param {number} bevelNz bevel direction along Z (-1, 0 or 1)
 * @param {number} len length of the cushion segment (bevel length)
 */
function createCushion(profile, material, halfExtents, pos, bevelNx, bevelNz, len) {
  const body = new CANNON.Body({ mass: 0, material });
  body.addShape(new CANNON.Box(new CANNON.Vec3(halfExtents.x, halfExtents.y, halfExtents.z)));
  body.position.set(pos.x, pos.y, pos.z);
  addCushionBevelShape(profile, body, bevelNx, bevelNz, len);
  return body;
}

/**
 * @param {TableProfile} profile
 * @param {CANNON.Body} body
 * @param {number} nx
 * @param {number} nz
 * @param {number} len
 */
function addCushionBevelShape(profile, body, nx, nz, len) {
  const h = BALL.radius * 2;
  const inset = profile.cushionWidth / 2;
  const overhang = 3.2;
  const thickness = 3.0;

  const slantLen = Math.sqrt(h * h + overhang * overhang);
  const shape = new CANNON.Box(new CANNON.Vec3(slantLen / 2, thickness / 2, len / 2));

  const offsetX = nx * (inset + overhang / 2);
  const offsetY = 0;
  const offsetZ = nz * (inset + overhang / 2);

  const alongX = Math.abs(nx) > 0.5;
  const xAxis = normalize({ x: nx * overhang, y: h, z: nz * overhang });
  let zAxis = { x: alongX ? 0 : 1, y: 0, z: alongX ? 1 : 0 };
  const yAxis = normalize(cross(zAxis, xAxis));
  zAxis = normalize(cross(xAxis, yAxis));

  const q3 = quaternionFromBasis(xAxis, yAxis, zAxis);
  const q = new CANNON.Quaternion(q3.x, q3.y, q3.z, q3.w);

  body.addShape(shape, new CANNON.Vec3(offsetX, offsetY, offsetZ), q);
}

/**
 * The six cushion bodies (two short rails, four long-rail segments), in the
 * order of the legacy Table.createCushions.
 * @param {TableProfile} profile
 * @param {CANNON.Material} cushionMaterial
 * @returns {CANNON.Body[]}
 */
export function createTableBodies(profile, cushionMaterial) {
  const m = getCushionMetrics(profile);
  const cy = BALL.radius;

  const shortHalf = { x: m.cShortLen / 2, y: m.ch / 2, z: m.cw / 2 };
  const longHalf = { x: m.cw / 2, y: m.ch / 2, z: m.cLongSegLen / 2 };

  return [
    // Short rails
    createCushion(profile, cushionMaterial, shortHalf, { x: 0, y: cy, z: -m.halfD + m.cw / 2 }, 0, 1, m.cShortLen),
    createCushion(profile, cushionMaterial, shortHalf, { x: 0, y: cy, z: m.halfD - m.cw / 2 }, 0, -1, m.cShortLen),
    // Long rail segments
    createCushion(profile, cushionMaterial, longHalf, { x: -m.halfW + m.cw / 2, y: cy, z: -m.cLongZ }, 1, 0, m.cLongSegLen),
    createCushion(profile, cushionMaterial, longHalf, { x: -m.halfW + m.cw / 2, y: cy, z: m.cLongZ }, 1, 0, m.cLongSegLen),
    createCushion(profile, cushionMaterial, longHalf, { x: m.halfW - m.cw / 2, y: cy, z: -m.cLongZ }, -1, 0, m.cLongSegLen),
    createCushion(profile, cushionMaterial, longHalf, { x: m.halfW - m.cw / 2, y: cy, z: m.cLongZ }, -1, 0, m.cLongSegLen),
  ];
}
