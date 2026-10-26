// F4-02: the match starts with a snapshot for each player, and the server refuses
// bad shot requests, removes a connection that keeps sending them and relays the aim.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { OP } from '@billiards/protocol';
import { waitForNakama } from './env.ts';
import { closeBots, newBot, rpc, serverError, sleep } from './bot.ts';
import { byTurn, startPrivateGame } from './game.ts';

before(() => waitForNakama(60000));
after(closeBots);

const SHOT = { angle: 0.5, power: 40, spin: { x: 0, y: 0 } };

test('os dois recebem o snapshot com lugares diferentes e a mesma mesa', async () => {
  const { bots: [a, b] } = await startPrivateGame();
  assert.deepEqual([a.seat, b.seat], [0, 1]);
  assert.equal(a.snapshot!.phase, 'AWAITING_SHOT');
  assert.equal(a.snapshot!.table.balls.length, 16);
  assert.deepEqual(a.snapshot!.table, b.snapshot!.table);
  assert.deepEqual(a.snapshot!.match, b.snapshot!.match);
  assert.deepEqual(a.snapshot!.turn, b.snapshot!.turn);
  assert.equal(a.snapshot!.turn!.seat, a.snapshot!.match.mode.turn.currentSeat);
  assert.equal(a.snapshot!.turn!.deadlineInMs, 45000);
});

test('tacada fora do turno → shot_rejected', async () => {
  const { bots } = await startPrivateGame();
  const { waiter } = byTurn(bots);
  await waiter.shoot(SHOT, 5);
  const rejected = await waiter.waitFor(OP.SHOT_REJECTED);
  assert.deepEqual(rejected.body, { seq: 5, reason: 'NOT_YOUR_TURN' });
});

test('números não finitos → shot_rejected', async () => {
  const { bots } = await startPrivateGame('9ball');
  const { shooter } = byTurn(bots);
  await shooter.send(OP.SHOT_REQUEST, '{"turnId":0,"seq":1,"angle":1e999,"power":10,"spin":{"x":0,"y":0}}');
  const rejected = await shooter.waitFor(OP.SHOT_REJECTED);
  assert.deepEqual(rejected.body, { seq: 1, reason: 'BAD_MESSAGE' });
});

test('mais de 5 inválidas em 10 s → conexão removida', async () => {
  const { bots } = await startPrivateGame();
  const { shooter, waiter } = byTurn(bots);
  for (let seq = 1; seq <= 6; seq++) {
    await waiter.shoot(SHOT, seq);
    await sleep(250);
  }
  const update = await shooter.waitFor(OP.SEAT_UPDATE);
  assert.deepEqual(update.body, { seat: waiter.seat, connected: false });
});

test('aim_update chega ao adversário com o lugar', async () => {
  const { bots } = await startPrivateGame();
  const { shooter, waiter } = byTurn(bots);
  await shooter.send(OP.AIM_UPDATE, { turnId: shooter.turnId, angle: 1.25, spin: { x: 0.1, y: 0 }, power: 30 });
  const relayed = await waiter.waitFor(OP.AIM_RELAY);
  assert.deepEqual(relayed.body, { seat: shooter.seat, turnId: 0, angle: 1.25, spin: { x: 0.1, y: 0 }, power: 30 });
  assert.equal(shooter.received.some((m) => m.op === OP.AIM_RELAY), false);
});

test('entrada sem protocolVersion é recusada', async () => {
  const bot = await newBot();
  const { matchId } = await rpc(bot, 'create_private_match', { mode: '8ball', format: '1v1' });
  const socket = await bot.socket();
  await assert.rejects(socket.joinMatch(matchId).catch(async (e) => { throw await serverError(e); }), /PROTOCOL_MISMATCH/);
  await assert.rejects(socket.joinMatch(matchId, undefined, { protocolVersion: '0' }).catch(async (e) => { throw await serverError(e); }),
    /PROTOCOL_MISMATCH/);
});
