// F4-12 (D064): native APIs outside what the game uses are refused; the ones it
// uses keep working.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { waitForNakama } from './env.ts';
import { closeBots, newBot, serverError } from './bot.ts';

before(() => waitForNakama(60000));
after(closeBots);

/** Rejects with the server's message so the assertion sees NATIVE_API_CLOSED. */
const refused = (promise: Promise<unknown>) => promise.then(
  () => { throw new Error('accepted'); },
  async (err) => { throw await serverError(err); },
);

test('APIs nativas fora do uso do jogo são recusadas', async () => {
  const bot = await newBot();
  const { client, session } = bot;
  await assert.rejects(refused(client.writeStorageObjects(session, [{ collection: 'x', key: 'k', value: { a: 1 } }])), /NATIVE_API_CLOSED/);
  await assert.rejects(refused(client.createGroup(session, { name: `g${randomUUID().slice(0, 8)}` })), /NATIVE_API_CLOSED/);
  await assert.rejects(refused(client.addFriends(session, [], ['someone'])), /NATIVE_API_CLOSED/);
  await assert.rejects(refused(client.linkCustom(session, { id: randomUUID() })), /NATIVE_API_CLOSED/);
  await assert.rejects(refused(client.writeLeaderboardRecord(session, 'board', { score: '1' })), /NATIVE_API_CLOSED/);

  const socket = await bot.socket();
  await assert.rejects(refused(socket.joinChat('sala', 1, false, false)), /NATIVE_API_CLOSED/);
  await assert.rejects(refused(socket.createMatch()), /NATIVE_API_CLOSED/);
  await assert.rejects(refused(socket.updateStatus('aqui')), /NATIVE_API_CLOSED/);

  // What the game uses stays open.
  const users = await client.getUsers(session, [session.user_id!]);
  assert.equal(users.users?.length, 1);
  const read = await client.readStorageObjects(session, { object_ids: [{ collection: 'match_history', key: randomUUID() }] });
  assert.deepEqual(read.objects ?? [], []);
});
