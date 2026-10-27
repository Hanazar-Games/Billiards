// create_private_match and join_by_code with a fake nk.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rpcCreatePrivateMatch, rpcJoinByCode } from '../src/rooms.ts';

const logger = { debug() {}, info() {}, warn() {}, error() {} };
const ctx = { env: {}, executionMode: 'rpc', userId: 'u1' };

/** A fake nk whose matchList answers from `rooms` (label JSON by code) and records matchCreate. */
function fakeNk(rooms: Record<string, { open: boolean }> = {}, takenFirst = 0) {
  const created: { module: string; params: Record<string, unknown> }[] = [];
  let taken = takenFirst;
  const nk = {
    matchList(_limit: number, _auth: boolean, _label: null, _min: null, _max: null, query: string) {
      const code = /\+label\.code:([A-Z0-9]+)/.exec(query)![1];
      if (taken > 0) { taken--; return [{ matchId: 'other', authoritative: true, label: JSON.stringify({ code, open: true }), size: 1 }]; }
      const room = rooms[code];
      return room ? [{ matchId: `m-${code}`, authoritative: true, label: JSON.stringify({ code, open: room.open }), size: 1 }] : [];
    },
    matchCreate(module: string, params: Record<string, unknown>) { created.push({ module, params }); return `m-${params.code}`; },
  };
  return { nk: nk as any, created };
}

test('cria a sala com um código e o rótulo privado', () => {
  const { nk, created } = fakeNk();
  const out = JSON.parse(rpcCreatePrivateMatch(ctx, logger, nk, JSON.stringify({ mode: '8ball', format: '1v1' })));
  assert.match(out.code, /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
  assert.equal(out.matchId, `m-${out.code}`);
  assert.deepEqual(created, [{ module: 'billiards', params: { mode: '8ball', format: '1v1', code: out.code, private: true } }]);
});

test('código já usado por uma sala aberta gera outro', () => {
  const { nk, created } = fakeNk({}, 2);
  rpcCreatePrivateMatch(ctx, logger, nk, JSON.stringify({ mode: '9ball', format: '1v1' }));
  assert.equal(created.length, 1);
});

test('modo ou formato inválido dá MODE_INVALID', () => {
  const { nk, created } = fakeNk();
  for (const p of [{ mode: 'xyz', format: '1v1' }, { mode: '8ball', format: '2v2' }]) {
    assert.throws(() => rpcCreatePrivateMatch(ctx, logger, nk, JSON.stringify(p)), /MODE_INVALID/);
  }
  assert.equal(created.length, 0);
});

test('join_by_code acha a sala com o código em minúsculas e espaços', () => {
  const { nk } = fakeNk({ ABC234: { open: true } });
  assert.deepEqual(JSON.parse(rpcJoinByCode(ctx, logger, nk, JSON.stringify({ code: ' abc234 ' }))), { matchId: 'm-ABC234' });
});

test('join_by_code: CODE_INVALID, ROOM_NOT_FOUND e ROOM_FULL', () => {
  const { nk } = fakeNk({ ABC234: { open: false } });
  assert.throws(() => rpcJoinByCode(ctx, logger, nk, JSON.stringify({ code: 'ABC23O' })), /CODE_INVALID/);
  assert.throws(() => rpcJoinByCode(ctx, logger, nk, JSON.stringify({ code: 'ZZZ999' })), /ROOM_NOT_FOUND/);
  assert.throws(() => rpcJoinByCode(ctx, logger, nk, JSON.stringify({ code: 'ABC234' })), /ROOM_FULL/);
});
