// F3-01: the local stack answers its healthcheck.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASE_URL, waitForNakama } from './env.ts';

test('o Nakama responde ao healthcheck em até 60 s', async () => {
  await waitForNakama(60000);
  const res = await fetch(`${BASE_URL}/healthcheck`);
  assert.equal(res.status, 200);
});
