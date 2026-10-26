// F3-05: 1×1 matchmaking creates an authoritative billiards match.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Socket } from '@heroiclabs/nakama-js';
import { waitForNakama } from './env.ts';
import { closeBots, newBot, once, sleep, withTimeout } from './bot.ts';

before(() => waitForNakama(60000));
after(closeBots);

const ticket = (socket: Socket, mode: string) =>
  socket.addMatchmaker(`+properties.mode:${mode} +properties.format:1v1`, 2, 2, { mode, format: '1v1' });

test('dois bots na fila formam uma partida', async () => {
  const [a, b] = await Promise.all([newBot(), newBot()]);
  const [sa, sb] = await Promise.all([a.socket(), b.socket()]);
  const matched = Promise.all([once(sa, 'onmatchmakermatched'), once(sb, 'onmatchmakermatched')]);
  await Promise.all([ticket(sa, '8ball'), ticket(sb, '8ball')]);
  const [ma, mb] = await withTimeout(matched, 15000, 'onmatchmakermatched');
  assert.ok(ma.match_id);
  assert.equal(ma.match_id, mb.match_id);
  await sa.joinMatch(ma.match_id);
  const joined = await sb.joinMatch(mb.match_id);
  assert.equal(joined.presences.length + 1, 2);
  sa.disconnect(false); sb.disconnect(false);
});

test('8-ball e 9-ball não se misturam', async () => {
  const [eight, nine, nine2] = await Promise.all([newBot(), newBot(), newBot()]);
  const [s8, s9] = await Promise.all([eight.socket(), nine.socket()]);
  let crossed = false;
  s8.onmatchmakermatched = () => { crossed = true; };
  const nineMatched = once(s9, 'onmatchmakermatched');
  await Promise.all([ticket(s8, '8ball'), ticket(s9, '9ball')]);
  await sleep(5000);
  assert.equal(crossed, false);
  const s92 = await nine2.socket();
  const otherMatched = once(s92, 'onmatchmakermatched');
  await ticket(s92, '9ball');
  const [m1, m2] = await withTimeout(Promise.all([nineMatched, otherMatched]), 15000, 'the 9-ball pair');
  assert.equal(m1.match_id, m2.match_id);
  assert.equal(crossed, false);
  for (const s of [s8, s9, s92]) s.disconnect(false);
});
