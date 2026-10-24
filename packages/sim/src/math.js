// @ts-check
// Minimal 3D vector and quaternion helpers. The operation order mirrors the
// Three.js routines they replace (Vector3.normalize / crossVectors,
// Matrix4.makeBasis + Quaternion.setFromRotationMatrix) so the results match.

/** @typedef {{ x: number, y: number, z: number }} Vec3Like */
/** @typedef {{ x: number, y: number, z: number, w: number }} QuatLike */

/**
 * @param {Vec3Like} v
 * @returns {Vec3Like}
 */
export function normalize(v) {
  const inv = 1 / (Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1);
  return { x: v.x * inv, y: v.y * inv, z: v.z * inv };
}

/**
 * @param {Vec3Like} a
 * @param {Vec3Like} b
 * @returns {Vec3Like}
 */
export function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

/**
 * Quaternion of the rotation whose matrix columns are the given orthonormal
 * axes.
 * @param {Vec3Like} xAxis
 * @param {Vec3Like} yAxis
 * @param {Vec3Like} zAxis
 * @returns {QuatLike}
 */
export function quaternionFromBasis(xAxis, yAxis, zAxis) {
  const m11 = xAxis.x, m12 = yAxis.x, m13 = zAxis.x;
  const m21 = xAxis.y, m22 = yAxis.y, m23 = zAxis.y;
  const m31 = xAxis.z, m32 = yAxis.z, m33 = zAxis.z;
  const trace = m11 + m22 + m33;

  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1.0);
    return { x: (m32 - m23) * s, y: (m13 - m31) * s, z: (m21 - m12) * s, w: 0.25 / s };
  }
  if (m11 > m22 && m11 > m33) {
    const s = 2.0 * Math.sqrt(1.0 + m11 - m22 - m33);
    return { x: 0.25 * s, y: (m12 + m21) / s, z: (m13 + m31) / s, w: (m32 - m23) / s };
  }
  if (m22 > m33) {
    const s = 2.0 * Math.sqrt(1.0 + m22 - m11 - m33);
    return { x: (m12 + m21) / s, y: 0.25 * s, z: (m23 + m32) / s, w: (m13 - m31) / s };
  }
  const s = 2.0 * Math.sqrt(1.0 + m33 - m11 - m22);
  return { x: (m13 + m31) / s, y: (m23 + m32) / s, z: 0.25 * s, w: (m21 - m12) / s };
}
