// Feel and draw report for a candidate tuning, used to calibrate F1-09:
//   node tools/feel-report.mjs '{"ballTableFriction": 0, "rollCoupling": 2}'
// The JSON overrides TUNING_LEGACY. Prints each corpus shot outside its feel
// reference (the D038 legacy envelope, or the calibrated sim for the D041
// shots), the draw-ref draw and the rolling invariant 2.5v + ωR after 0.1 s.
import { simulateShot, TUNING_LEGACY, BALL } from '../src/index.js';
import { CORPUS } from '../test/corpus.js';
import { computeMetrics, withinEnvelope } from '../test/feel/metrics.js';
import { feelReference } from '../test/feel/reference.js';

const tuning = Object.freeze({ ...TUNING_LEGACY, ...JSON.parse(process.argv[2] || '{}') });

let fails = 0;
for (const c of CORPUS.filter((x) => x.kind !== 'calibration')) {
  const r = simulateShot(c.table, c.shot, { tuning });
  const m = computeMetrics(c.kind, [c.table, ...r.frames], r.final);
  const ref = feelReference(c.name).byFps;
  const out = [];
  for (const [key, value] of Object.entries(m)) {
    const byFps = Object.fromEntries(Object.entries(ref).map(([fps, mm]) => [fps, mm[key]]));
    if (withinEnvelope(value, byFps, key, ref['60'])) continue;
    const values = Object.values(byFps);
    out.push(typeof value === 'number'
      ? `${key} ${value.toFixed(1)} fora de [${Math.min(...values).toFixed(1)}, ${Math.max(...values).toFixed(1)}]`
      : `${key} fora`);
  }
  if (out.length) {
    fails++;
    console.log(`FORA ${c.name}: ${out.join('; ')}`);
  }
}

const d = CORPUS.find((x) => x.name === 'draw-ref');
const r = simulateShot(d.table, d.shot, { tuning });
const reached = r.events.some((e) => e.type === 'first_contact');
const maxZ = Math.max(...r.frames.flatMap((f) => f.balls.filter((b) => b.id === 0).map((b) => b.z)));
const draw = maxZ - r.final.balls[0].z;

const alone = { tableProfileId: 'pool9ft', balls: [{ id: 0, x: 0, z: -100, pocketed: false }] };
const stroke = { angle: Math.PI / 2, power: 60, spin: { x: 0, y: -0.8 } };
const inv = (/** @type {{ v: number, w: number }} */ p) => 2.5 * p.v + p.w * BALL.radius;
const p0 = simulateShot(alone, stroke, { tuning, maxSimSeconds: 1 / 360, probe: true }).probe;
const p1 = simulateShot(alone, stroke, { tuning, maxSimSeconds: 0.1, probe: true }).probe;

console.log(`sensação: ${11 - fails}/11 dentro | recuo draw-ref: ${reached ? `${draw.toFixed(1)} cm` : 'a branca não alcança a bola 1'}` +
  ` | 2,5v + ωR: ${inv(p0).toFixed(1)} → ${inv(p1).toFixed(1)}`);
