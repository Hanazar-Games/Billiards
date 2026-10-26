// Profile RPC and account hooks with a fake nk (spec §8.1, D052).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rpcProfileUpdate, beforeAuthenticate, beforeUpdateAccount } from '../src/profile.ts';

const logger = { debug() {}, info() {}, warn() {}, error() {} };
const ctx = { env: {}, executionMode: 'rpc', userId: 'u1', username: 'guest_u1' };

/** A fake nk that keeps one account and records accountUpdateId calls. */
function fakeNk({ failWith }: { failWith?: string } = {}) {
  const account = { userId: 'u1', username: 'guest_u1', avatarUrl: '' };
  const calls: unknown[][] = [];
  const nk = {
    accountUpdateId(...args: unknown[]) {
      calls.push(args);
      if (failWith) throw new Error(failWith);
      if (args[1] !== null) account.username = args[1] as string;
      if (args[6] !== null) account.avatarUrl = args[6] as string;
    },
    usersGetId: () => [account],
  };
  return { nk: nk as any, calls };
}

test('profile_update normaliza e grava o nome', () => {
  const { nk, calls } = fakeNk();
  const out = JSON.parse(rpcProfileUpdate(ctx, logger, nk, JSON.stringify({ username: ' Cássio_10 ', avatar: 'preset:a03' })));
  assert.deepEqual(out, { username: 'cassio_10', avatar: 'preset:a03' });
  assert.deepEqual(calls[0].slice(0, 2), ['u1', 'cassio_10']);
  assert.equal(calls[0][6], 'preset:a03');
});

test('profile_update recusa nome impróprio sem gravar', () => {
  const { nk, calls } = fakeNk();
  assert.throws(() => rpcProfileUpdate(ctx, logger, nk, JSON.stringify({ username: 'p0rr4' })), /USERNAME_INVALID/);
  assert.equal(calls.length, 0);
});

test('nome já usado vira USERNAME_TAKEN', () => {
  const { nk } = fakeNk({ failWith: 'Username is already in use.' });
  assert.throws(() => rpcProfileUpdate(ctx, logger, nk, JSON.stringify({ username: 'taken_name' })), /USERNAME_TAKEN/);
});

test('avatar fora dos presets e payload vazio são recusados', () => {
  const { nk, calls } = fakeNk();
  assert.throws(() => rpcProfileUpdate(ctx, logger, nk, JSON.stringify({ avatar: 'https://x/y.png' })), /AVATAR_INVALID/);
  assert.throws(() => rpcProfileUpdate(ctx, logger, nk, '{}'), /PAYLOAD_INVALID/);
  assert.throws(() => rpcProfileUpdate(ctx, logger, nk, 'not json'), /PAYLOAD_INVALID/);
  assert.equal(calls.length, 0);
});

test('o UpdateAccount nativo é recusado', () => {
  assert.throws(() => beforeUpdateAccount(ctx, logger, {} as any, { username: 'ok_name' }), /PROFILE_VIA_RPC/);
});

test('a autenticação normaliza o username pedido e recusa um impróprio', () => {
  assert.equal(beforeAuthenticate(ctx, logger, {} as any, { account: { id: 'd' }, create: true, username: 'Ana_B' }).username, 'ana_b');
  assert.deepEqual(beforeAuthenticate(ctx, logger, {} as any, { account: { id: 'd' }, create: true }), { account: { id: 'd' }, create: true });
  assert.throws(() => beforeAuthenticate(ctx, logger, {} as any, { account: { id: 'd' }, create: true, username: 'merda' }), /USERNAME_INVALID/);
});
