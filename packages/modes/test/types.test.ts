// Runs the type-level checks in types.check.ts; tsc enforces them (npm run typecheck).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ok, noRespot, threeOnThree } from './types.check.ts';

test('os tipos da interface de modos compilam', () => {
  assert.equal(ok.respot.length, 0);
  assert.ok(noRespot && threeOnThree);
});
