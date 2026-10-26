// The billiards module is loaded by the local Nakama and answers its RPC.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASE_URL, NAKAMA, waitForNakama } from './env.ts';

test('o Nakama carrega o módulo billiards', async () => {
  await waitForNakama(60000);
  const res = await fetch(`${BASE_URL}/v2/rpc/healthcheck_module?http_key=${encodeURIComponent(NAKAMA.httpKey)}&unwrap`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  });
  assert.equal(res.status, 200, await res.clone().text());
  const out = await res.json();
  assert.equal(out.module, 'billiards');
  // The compose file hands the sim address and secret to the runtime (--runtime.env).
  assert.equal(out.simConfigured, true);
});
