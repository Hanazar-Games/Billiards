export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function distance2D(x1, z1, x2, z2) {
  return Math.sqrt((x1 - x2) ** 2 + (z1 - z2) ** 2);
}

export function vec2FromAngle(angle) {
  return [Math.cos(angle), Math.sin(angle)];
}
