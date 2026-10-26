// F4-02: the match starts with a snapshot for each player, and the server refuses
// bad shot requests, removes a connection that keeps sending them and relays the aim.
// F4-03: a shot goes through the sim (nk.httpRequest) and both players get the same
// shot_result envelope; a turn that runs out is a foul.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { OP, decodeTrajectory } from '@billiards/protocol';
import { waitForNakama } from './env.ts';
import { closeBots, newBot, rpc, serverError, sleep } from './bot.ts';
import { byTurn, startPrivateGame } from './game.ts';

before(() => waitForNakama(60000));
after(closeBots);

const SHOT = { angle: 0.5, power: 40, spin: { x: 0, y: 0 } };
/** The strongest break, straight up the table (already quantized). */
const BREAK = { angle: 1.5708, power: 110, spin: { x: 0, y: 0 } };

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
  // goja's JSON.parse refuses 1e999 (out of range), so the message is unreadable and the seq unknown;
  // Node would read Infinity and the shot reader would refuse it with the seq.
  await shooter.send(OP.SHOT_REQUEST, '{"turnId":0,"seq":1,"angle":1e999,"power":10,"spin":{"x":0,"y":0}}');
  assert.deepEqual((await shooter.waitFor(OP.SHOT_REJECTED)).body, { seq: null, reason: 'BAD_MESSAGE' });
  // A finite number beyond MAX_ABS_NUMBER is read, then refused by the shot reader.
  await shooter.send(OP.SHOT_REQUEST, '{"turnId":0,"seq":2,"angle":2e6,"power":10,"spin":{"x":0,"y":0}}');
  assert.deepEqual((await shooter.waitFor(OP.SHOT_REJECTED)).body, { seq: 2, reason: 'BAD_MESSAGE' });
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

test('os dois bots terminam a tacada com o mesmo estado final', async () => {
  const { bots } = await startPrivateGame();
  const { shooter, waiter } = byTurn(bots);
  await shooter.shoot(BREAK, 1);
  const accepted = await Promise.all([shooter.waitFor(OP.SHOT_ACCEPTED), waiter.waitFor(OP.SHOT_ACCEPTED)]);
  for (const m of accepted) assert.deepEqual(m.body, { turnId: 0, seq: 1, seat: shooter.seat, shot: BREAK });

  const [mine, theirs] = await Promise.all([shooter.waitFor(OP.SHOT_RESULT), waiter.waitFor(OP.SHOT_RESULT)]);
  assert.equal(mine.header.kind, 'shot');
  assert.equal(mine.header.seat, shooter.seat);
  assert.deepEqual(mine.header.table, theirs.header.table);
  assert.deepEqual(mine.header.final, theirs.header.final);
  assert.deepEqual(mine.header.match, theirs.header.match);
  assert.deepEqual(mine.header.events, theirs.header.events);
  assert.equal(mine.header.match.turnId, 1);
  assert.equal(mine.header.nextTurn.seat, mine.header.match.mode.turn.currentSeat);
  // The break's trajectory crossed the socket whole, to both (tens of kilobytes).
  assert.ok(mine.payload!.length > 10000, `trajectory of ${mine.payload!.length} bytes`);
  assert.deepEqual(theirs.payload, mine.payload);
  assert.ok(decodeTrajectory(theirs.payload!).length > 0);
});

test('tempo esgotado conta como falta', { timeout: 90000 }, async () => {
  const { bots } = await startPrivateGame();
  const { shooter, waiter } = byTurn(bots);
  const started = Date.now();
  const results = await Promise.all([shooter.waitFor(OP.SHOT_RESULT, undefined, 60000), waiter.waitFor(OP.SHOT_RESULT, undefined, 60000)]);
  const seconds = (Date.now() - started) / 1000;
  assert.ok(seconds >= 44 && seconds <= 50, `the turn ran out after ${seconds} s`);
  for (const { header, payload } of results) {
    assert.equal(header.kind, 'timeout');
    assert.equal(header.seat, shooter.seat);
    assert.ok(header.ruling.fouls.includes('TIMEOUT'));
    assert.equal(header.ruling.ballInHand.seat, waiter.seat);
    assert.deepEqual(header.nextTurn, { seat: waiter.seat, turnId: 1, deadlineInMs: 45000 });
    assert.deepEqual(decodeTrajectory(payload!), []);
  }
});
