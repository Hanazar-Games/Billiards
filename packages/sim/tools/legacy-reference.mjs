// Generates test/feel/legacy-reference.json: the feel metrics of every
// non-calibration corpus shot in the legacy game at the 14 frame rates of
// D038 (performance.now frozen). Samples are the first legacy frame at or after
// each k/30 s; a ball pocketed since the previous sample appears in it once,
// where it was before the pocket took it, as in the sim's frames.
import { writeFileSync } from 'node:fs';
import { installEnv } from '../test/legacy/env.js';

installEnv({ seed: 1 });
const { createLegacyWorld, placeLegacyTable } = await import('../test/legacy/legacy-world.js');
const { runLegacy } = await import('../test/legacy/legacy-run.js');
const { CORPUS } = await import('../test/corpus.js');
const { computeMetrics } = await import('../test/feel/metrics.js');

// D038: real display rates, from cinema to 240 Hz monitors.
const FPS = [24, 30, 40, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 240];
const SAMPLE_RATE = 30;

export function legacyMetrics(c, fps) {
  const legacyWorld = createLegacyWorld({ tableProfileId: c.table.tableProfileId });
  placeLegacyTable(legacyWorld, c.table);
  const samples = [c.table];
  const pending = new Map();
  let k = 1;
  const shot = { dir: { x: Math.cos(c.shot.angle), z: Math.sin(c.shot.angle) }, force: c.shot.power, spin: c.shot.spin };
  const run = runLegacy(legacyWorld, shot, { fps }, {
    onFrame(frame, frameFps, balls) {
      for (const b of balls) if (b.pocketedAt) pending.set(b.id, b.pocketedAt);
      // frame / fps ≥ k / 30, in integers.
      if (frame * SAMPLE_RATE < k * frameFps) return;
      samples.push({
        t: k / SAMPLE_RATE,
        balls: [
          ...balls.filter((b) => !b.pocketed).map(({ id, x, z }) => ({ id, x, z })),
          ...[...pending].map(([id, p]) => ({ id, x: p.x, z: p.z })),
        ],
      });
      pending.clear();
      while (frame * SAMPLE_RATE >= k * frameFps) k++;
    },
  });
  return computeMetrics(c.kind, samples, { balls: run.final });
}

const reference = {};
for (const c of CORPUS.filter((x) => x.kind !== 'calibration')) {
  reference[c.name] = Object.fromEntries(FPS.map((fps) => [fps, legacyMetrics(c, fps)]));
}
const out = new URL('../test/feel/legacy-reference.json', import.meta.url);
writeFileSync(out, JSON.stringify(reference, null, 2) + '\n');
console.log(`legacy-reference.json: ${Object.keys(reference).length} shots × ${FPS.length} FPS`);
