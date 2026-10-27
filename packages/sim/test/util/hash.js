// FNV-1a (32-bit) over Float64 x, z and one pocketed byte per ball, in the
// order given (callers pass balls sorted by id). Same as
// spikes/sim-bench/src/run-shot.js.
export function hashFinal(balls) {
  const view = new DataView(new ArrayBuffer(17));
  let h = 0x811c9dc5;
  for (const b of balls) {
    view.setFloat64(0, b.x, true);
    view.setFloat64(8, b.z, true);
    view.setUint8(16, b.pocketed ? 1 : 0);
    for (let i = 0; i < 17; i++) {
      h ^= view.getUint8(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  }
  return h.toString(16).padStart(8, '0');
}
