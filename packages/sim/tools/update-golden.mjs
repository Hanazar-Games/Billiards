// Regenerates test/golden.json: hash of the final state and step count of
// every corpus shot, simulated with the default TUNING. Run it only on purpose
// (a physics change that is meant to move the golden), never to make a
// failing test pass.
import { writeFileSync } from 'node:fs';
import { simulateShot } from '../src/index.js';
import { CORPUS } from '../test/corpus.js';
import { hashFinal } from '../test/util/hash.js';

const golden = {};
for (const c of CORPUS) {
  const r = simulateShot(c.table, c.shot);
  golden[c.name] = { hash: hashFinal(r.final.balls), steps: r.steps };
}
writeFileSync(new URL('../test/golden.json', import.meta.url), JSON.stringify(golden, null, 2) + '\n');
console.table(golden);
