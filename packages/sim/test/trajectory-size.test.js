// F1-04 (D037): every corpus shot fits in 48 KB and survives the round trip.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeTrajectory, decodeTrajectory } from '@billiards/protocol';
import { simulateShot } from '../src/index.js';
import { CORPUS } from './corpus.js';

test('cada tacada do corpus cabe em 48 KB e sobrevive à ida e volta', () => {
  for (const c of CORPUS) {
    const { frames } = simulateShot(c.table, c.shot);
    const bytes = encodeTrajectory(frames);
    console.log(`trajectory ${c.name}: ${(bytes.byteLength / 1024).toFixed(1)} KB`);
    assert.ok(bytes.byteLength <= 48 * 1024, c.name);
    const back = decodeTrajectory(bytes);
    back.forEach((f, i) => f.balls.forEach((b, j) => assert.ok(Math.abs(b.x - frames[i].balls[j].x) <= 0.005)));
  }
});
