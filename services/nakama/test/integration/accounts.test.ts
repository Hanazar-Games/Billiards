// F3-02 and F3-03: guest accounts, e-mail linking and validated profiles.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { waitForNakama } from './env.ts';
import { newBot, newClient, rpc, serverError } from './bot.ts';

before(() => waitForNakama(60000));

const PASSWORD = 'senha-de-teste-123';
const uniqueName = () => `bot_${randomUUID().slice(0, 8)}`;

test('convidado vincula e-mail e entra de novo com e-mail na mesma conta', async () => {
  const bot = await newBot();
  const email = `bot-${randomUUID()}@example.test`;
  await bot.client.linkEmail(bot.session, email, PASSWORD);
  const again = await newClient().authenticateEmail(email, PASSWORD, false);
  assert.equal(again.user_id, bot.session.user_id);
});

test('o mesmo dispositivo volta para a mesma conta', async () => {
  const bot = await newBot();
  const again = await newClient().authenticateDevice(bot.deviceId, true);
  assert.equal(again.user_id, bot.session.user_id);
});

test('e-mail de outra conta não pode ser vinculado', async () => {
  const [a, b] = await Promise.all([newBot(), newBot()]);
  const email = `bot-${randomUUID()}@example.test`;
  await a.client.linkEmail(a.session, email, PASSWORD);
  await assert.rejects(b.client.linkEmail(b.session, email, PASSWORD));
  const again = await newClient().authenticateEmail(email, PASSWORD, false);
  assert.equal(again.user_id, a.session.user_id);
});

test('RPC recusa username impróprio', async () => {
  const bot = await newBot();
  const before = (await bot.client.getAccount(bot.session)).user?.username;
  await assert.rejects(rpc(bot, 'profile_update', { username: 'p0rr4' }), /USERNAME_INVALID/);
  assert.equal((await bot.client.getAccount(bot.session)).user?.username, before);
});

test('username já usado devolve USERNAME_TAKEN', async () => {
  const [a, b] = await Promise.all([newBot(), newBot()]);
  const name = uniqueName();
  await rpc(a, 'profile_update', { username: name });
  const before = (await b.client.getAccount(b.session)).user?.username;
  await assert.rejects(rpc(b, 'profile_update', { username: name }), /USERNAME_TAKEN/);
  assert.equal((await b.client.getAccount(b.session)).user?.username, before);
});

test('perfil de outro jogador é legível', async () => {
  const [a, b] = await Promise.all([newBot(), newBot()]);
  const name = uniqueName();
  assert.deepEqual(await rpc(a, 'profile_update', { username: name, avatar: 'preset:a03' }), { username: name, avatar: 'preset:a03' });
  const users = await b.client.getUsers(b.session, [a.session.user_id!]);
  assert.equal(users.users?.[0].username, name);
  assert.equal(users.users?.[0].avatar_url, 'preset:a03');
});

test('UpdateAccount nativo é recusado', async () => {
  const bot = await newBot();
  await assert.rejects(bot.client.updateAccount(bot.session, { username: uniqueName() }).catch(async (e) => { throw await serverError(e); }), /PROFILE_VIA_RPC/);
});

test('token do Google inválido é recusado', async () => {
  const bot = await newBot();
  await assert.rejects(bot.client.linkGoogle(bot.session, { token: 'not-a-google-token' }));
});
