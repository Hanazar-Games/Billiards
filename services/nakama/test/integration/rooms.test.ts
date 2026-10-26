// F3-04: private rooms joined by a 6-character code.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { waitForNakama } from './env.ts';
import { closeBots, newBot, rpc, serverError } from './bot.ts';

before(() => waitForNakama(60000));
after(closeBots);

test('bot A cria a sala; bot B entra pelo código', async () => {
  const [a, b] = await Promise.all([newBot(), newBot()]);
  const { matchId, code } = await rpc(a, 'create_private_match', { mode: '8ball', format: '1v1' });
  assert.match(code, /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
  const sa = await a.socket();
  await sa.joinMatch(matchId);
  const found = await rpc(b, 'join_by_code', { code: ` ${code.toLowerCase()} ` });
  assert.equal(found.matchId, matchId);
  const sb = await b.socket();
  const joined = await sb.joinMatch(found.matchId);
  assert.equal(joined.presences.length + 1, 2);   // B sees A, plus itself
});

test('terceiro bot recebe ROOM_FULL', async () => {
  const [a, b, c] = await Promise.all([newBot(), newBot(), newBot()]);
  const { matchId, code } = await rpc(a, 'create_private_match', { mode: '9ball', format: '1v1' });
  await (await a.socket()).joinMatch(matchId);
  await (await b.socket()).joinMatch((await rpc(b, 'join_by_code', { code })).matchId);
  await assert.rejects(rpc(c, 'join_by_code', { code }), /ROOM_FULL/);
  await assert.rejects((await c.socket()).joinMatch(matchId).catch(async (e) => { throw await serverError(e); }));
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
