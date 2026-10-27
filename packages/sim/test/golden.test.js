// packages/sim/test/golden.test.js — F1-05
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { simulateShot } from '../src/index.js';
import { CORPUS } from './corpus.js';
import { hashFinal } from './util/hash.js';
const golden = JSON.parse(readFileSync(new URL('./golden.json', import.meta.url), 'utf8'));

test('corpus golden idêntico em duas execuções e igual ao golden.json', () => {
  assert.deepEqual(Object.keys(golden).sort(), CORPUS.map(c => c.name).sort());
  for (const c of CORPUS) {
    const a = simulateShot(c.table, c.shot), b = simulateShot(c.table, c.shot);
    assert.equal(hashFinal(a.final.balls), hashFinal(b.final.balls), c.name);
    assert.deepEqual({ hash: hashFinal(a.final.balls), steps: a.steps }, golden[c.name], c.name);
  }
});
