// F3-04: private rooms joined by a 6-character code.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { waitForNakama } from './env.ts';
import { closeBots, eventually, joinByCode, newBot, rpc, serverError } from './bot.ts';
import { JOIN_METADATA } from './game.ts';

before(() => waitForNakama(60000));
after(closeBots);

test('bot A cria a sala; bot B entra pelo código', async () => {
  const [a, b] = await Promise.all([newBot(), newBot()]);
  const { matchId, code } = await rpc(a, 'create_private_match', { mode: '8ball', format: '1v1' });
  assert.match(code, /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
  const sa = await a.socket();
  await sa.joinMatch(matchId, undefined, JOIN_METADATA);
  const found = await joinByCode(b, ` ${code.toLowerCase()} `);
  assert.equal(found.matchId, matchId);
  const sb = await b.socket();
  const joined = await sb.joinMatch(found.matchId, undefined, JOIN_METADATA);
  assert.equal(joined.presences.length + 1, 2);   // B sees A, plus itself
});

test('terceiro bot recebe ROOM_FULL', async () => {
  const [a, b, c] = await Promise.all([newBot(), newBot(), newBot()]);
  const { matchId, code } = await rpc(a, 'create_private_match', { mode: '9ball', format: '1v1' });
  await (await a.socket()).joinMatch(matchId, undefined, JOIN_METADATA);
  await (await b.socket()).joinMatch((await joinByCode(b, code)).matchId, undefined, JOIN_METADATA);
  // The full room's label (open: false) also reaches the listing after the indexing delay.
  const full = await eventually(() => rpc(c, 'join_by_code', { code }), (r) => !r.ok && /ROOM_FULL/.test(r.error.message));
  assert.equal(full.ok, false);
  assert.match((full as { error: Error }).error.message, /ROOM_FULL/);
  await assert.rejects((await c.socket()).joinMatch(matchId, undefined, JOIN_METADATA).catch(async (e) => { throw await serverError(e); }), /ROOM_FULL/);
});

test('código inexistente dá ROOM_NOT_FOUND e código malformado dá CODE_INVALID', async () => {
  const bot = await newBot();
  await assert.rejects(rpc(bot, 'join_by_code', { code: 'ZZZ999' }), /ROOM_NOT_FOUND/);
  await assert.rejects(rpc(bot, 'join_by_code', { code: 'ABC23O' }), /CODE_INVALID/);
});

test('modo ou formato inválido dá MODE_INVALID', async () => {
  const bot = await newBot();
  await assert.rejects(rpc(bot, 'create_private_match', { mode: 'xyz', format: '1v1' }), /MODE_INVALID/);
  await assert.rejects(rpc(bot, 'create_private_match', { mode: '8ball', format: '2v2' }), /MODE_INVALID/);
});

test('o cliente não consegue listar salas privadas', async () => {
  const [a, b] = await Promise.all([newBot(), newBot()]);
  await rpc(a, 'create_private_match', { mode: '8ball', format: '1v1' });
  await assert.rejects(b.client.listMatches(b.session, 10, true, undefined, 0, 64, '+label.private:true').catch(async (e) => { throw await serverError(e); }),
    /MATCH_LISTING_DISABLED/);
});
