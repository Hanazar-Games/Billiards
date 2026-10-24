// Feel metrics of a shot and the D035 tolerance envelope. The same code
// measures the sim (samples = the table plus its frames) and the legacy game
// (samples = the table plus the first frame at or after each k/30 s).

/**
 * @param {'single' | 'low-energy' | 'break'} kind
 * @param {Array<{ balls: { id: number, x: number, z: number, pocketed?: boolean }[] }>} samples
 *   the initial table, then 30 Hz samples that may list only the balls that moved
 * @param {{ balls: { id: number, x: number, z: number, pocketed: boolean }[] }} final
 */
export function computeMetrics(kind, samples, final) {
  const [table, ...rest] = samples;
  const inPlay = table.balls.filter(b => !b.pocketed);
  const pos = new Map(inPlay.map(b => [b.id, { x: b.x, z: b.z }]));
  const path = new Map(inPlay.map(b => [b.id, 0]));
  for (const sample of rest) {
    for (const b of sample.balls) {
      const p = pos.get(b.id);
      if (!p) continue;
      path.set(b.id, path.get(b.id) + Math.hypot(b.x - p.x, b.z - p.z));
      pos.set(b.id, { x: b.x, z: b.z });
    }
  }

  const finalById = new Map(final.balls.map(b => [b.id, b]));
  const pocketed = inPlay.filter(b => finalById.get(b.id).pocketed).map(b => b.id).sort((a, b) => a - b);
  const cue = finalById.get(0);

  switch (kind) {
    case 'single':
      return { cuePath: path.get(0), cueX: cue.x, cueZ: cue.z, pocketed };
    case 'low-energy':
      return {
        cuePath: path.get(0),
        positions: Object.fromEntries(final.balls.filter(b => !b.pocketed).map(b => [b.id, [b.x, b.z]])),
        pocketed,
      };
    case 'break': {
      let totalPath = 0;
      for (const d of path.values()) totalPath += d;
      const moved = inPlay.filter(b => {
        const f = finalById.get(b.id);
        return f.pocketed || Math.hypot(f.x - b.x, f.z - b.z) > 1;
      }).length;
      return { totalPath, moved, pocketedCount: pocketed.length };
    }
    default:
      throw new Error(`unknown shot kind: ${kind}`);
  }
}

const LENGTHS = new Set(['cuePath', 'totalPath']);
const POSITIONS = new Set(['cueX', 'cueZ']);
const COUNTS = new Set(['moved', 'pocketedCount']);

/**
 * D035: inside the legacy envelope at 30/60/120/144 FPS, widened by
 * m = max(1 cm, 2% of the 60 FPS value) for lengths and by
 * m = max(1 cm, 2% of the 60 FPS cuePath) for positions (per axis); counts ±1;
 * pocketed balls equal to the 60 FPS ones.
 * @param {any} value the sim's metric
 * @param {Record<string, any>} legacyByFps the same metric in the legacy game, by FPS
 * @param {string} key metric name
 * @param {{ cuePath?: number }} [legacy60] every metric of the shot at 60 FPS
 */
export function withinEnvelope(value, legacyByFps, key, legacy60 = {}) {
  const values = Object.values(legacyByFps);
  if (LENGTHS.has(key)) return inRange(value, values, Math.max(1, 0.02 * Math.abs(legacyByFps[60])));
  if (COUNTS.has(key)) return inRange(value, values, 1);
  if (key === 'pocketed') return JSON.stringify(value) === JSON.stringify(legacyByFps[60]);
  if (POSITIONS.has(key)) return inRange(value, values, positionMargin(legacy60));
  if (key === 'positions') {
    const m = positionMargin(legacy60);
    const ids = new Set([...Object.keys(value), ...values.flatMap(v => Object.keys(v))]);
    for (const id of ids) {
      if (!(id in value)) return false;
      const legacy = values.filter(v => id in v).map(v => v[id]);
      if (legacy.length === 0) return false;
      for (const axis of [0, 1]) {
        if (!inRange(value[id][axis], legacy.map(p => p[axis]), m)) return false;
      }
    }
    return true;
  }
  throw new Error(`unknown feel metric: ${key}`);
}

/** @param {{ cuePath?: number }} legacy60 */
function positionMargin(legacy60) {
  if (!Number.isFinite(legacy60.cuePath)) throw new Error('position metrics need the 60 FPS cuePath');
  return Math.max(1, 0.02 * Math.abs(/** @type {number} */ (legacy60.cuePath)));
}

/**
 * @param {number} value
 * @param {number[]} values
 * @param {number} margin
 */
function inRange(value, values, margin) {
  return value >= Math.min(...values) - margin && value <= Math.max(...values) + margin;
}
