// D064 (closes D053): the native Nakama APIs the game does not use are refused
// by a hook; the ones it uses stay open.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REGISTRY } from '../src/registry.ts';
import { CLOSED_NATIVE_APIS, CLOSED_RT_APIS } from '../src/nativeApis.ts';
import { beforeAuthenticate } from '../src/profile.ts';
import { loadBundleAndInit } from './bundleLoader.ts';

const ctx = { userId: 'u1' };
const logger = { info() {}, warn() {}, error() {}, debug() {} };

test('cada API nativa fechada está registrada com o hook que recusa', () => {
  const { calls, context } = loadBundleAndInit();
  const registered = new Map(calls.map(([kind, id, fn]) => [`${kind}:${id}`, fn]));
  assert.ok(CLOSED_NATIVE_APIS.length > 30, 'the D064 list');
  assert.deepEqual([...CLOSED_RT_APIS].sort(),
    ['ChannelJoin', 'ChannelMessageRemove', 'ChannelMessageSend', 'ChannelMessageUpdate', 'MatchCreate', 'PartyCreate', 'PartyJoin', 'StatusFollow', 'StatusUpdate']);
  for (const [kind, ids] of [['before', CLOSED_NATIVE_APIS], ['rtBefore', CLOSED_RT_APIS]] as const) {
    for (const id of ids) {
      const fn = registered.get(`${kind}:${id}`);
      assert.ok(fn, `${kind}:${id} is registered`);
      assert.throws(() => context[fn](ctx, logger, {}, {}), (err: any) => {
        assert.match(String(err.message), /NATIVE_API_CLOSED/);
        assert.equal(err.code, 7);
        return true;
      }, `${kind}:${id} refuses`);
    }
  }
});

test('as APIs que o jogo usa continuam abertas', () => {
  assert.equal(REGISTRY.before.AuthenticateDevice, beforeAuthenticate);
  assert.equal(REGISTRY.before.AuthenticateEmail, beforeAuthenticate);
  assert.equal(REGISTRY.before.AuthenticateGoogle, beforeAuthenticate);
  for (const id of ['ReadStorageObjects', 'ListStorageObjects', 'GetUsers', 'GetAccount', 'SessionRefresh', 'SessionLogout',
    'LinkEmail', 'LinkGoogle', 'LinkDevice', 'UnlinkEmail', 'UnlinkGoogle', 'UnlinkDevice', 'ListNotifications', 'DeleteNotifications']) {
    assert.equal(REGISTRY.before[id], undefined, `${id} stays open`);
  }
  for (const id of ['MatchmakerAdd', 'MatchmakerRemove', 'MatchJoin', 'MatchLeave', 'MatchDataSend']) {
    assert.equal(REGISTRY.rtBefore[id], undefined, `${id} stays open`);
  }
});
