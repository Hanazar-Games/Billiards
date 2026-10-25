// Generates test/feel/sim-reference.json: the feel metrics of the D041 shots
// in the calibrated sim (default TUNING). The sim does not depend on the frame
// rate, so each shot has a single entry, stored under 60 so the D038 margins
// apply as they are. Run it only with a decision that changes this feel,
// never to make a failing feel test pass.
import { writeFileSync } from 'node:fs';
import { simulateShot } from '../src/index.js';
import { CORPUS } from '../test/corpus.js';
import { computeMetrics } from '../test/feel/metrics.js';
import { SIM_REFERENCE_SHOTS } from '../test/feel/reference.js';

const reference = {};
for (const name of SIM_REFERENCE_SHOTS) {
  const c = CORPUS.find((x) => x.name === name);
  const r = simulateShot(c.table, c.shot);
  reference[name] = { 60: computeMetrics(c.kind, [c.table, ...r.frames], r.final) };
}
writeFileSync(new URL('../test/feel/sim-reference.json', import.meta.url), JSON.stringify(reference, null, 2) + '\n');
console.log(`sim-reference.json: ${Object.keys(reference).join(', ')}`);
