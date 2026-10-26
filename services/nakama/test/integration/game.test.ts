// F4-02: the match starts with a snapshot for each player, and the server refuses
// bad shot requests, removes a connection that keeps sending them and relays the aim.
// F4-03: a shot goes through the sim (nk.httpRequest) and both players get the same
// shot_result envelope; a turn that runs out is a foul.
// F4-04: a player who drops during the playback comes back to the shot still playing,
// a repeated shot_request is one shot, and a second tab replaces the first.
// F4-05: a player away for more than 60 s loses by walkover.
// F4-06: a concession ends the match and leaves exactly one record in match_history.
// F4-07: two bots play a whole 8-ball match to its end, and the record matches what they saw.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { OP, PROTOCOL_VERSION, SIM_VERSION, decodeTrajectory } from '@billiards/protocol';
import { waitForNakama } from './env.ts';
import { call, closeBots, eventually, findStorageObject, newBot, rpc, serverError, sleep } from './bot.ts';
import { chooseShot } from './autoplay.ts';
import { byTurn, startPrivateGame } from './game.ts';

before(() => waitForNakama(60000));
after(closeBots);

const SHOT = { angle: 0.5, power: 40, spin: { x: 0, y: 0 } };
/** The owner of the records the server writes for itself. */
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
/** The strongest break, straight up the table (already quantized). */
const BREAK = { angle: 1.5708, power: 110, spin: { x: 0, y: 0 } };
/** A whole match of the test bot takes tens of shots; this many without an end means the bots are stuck. */
const MAX_MATCH_SHOTS = 200;
/**
 * The pause before each shot of the full match. The server keeps 5 messages per connection and second
 * besides the aim (spec §9) and drops the rest without an answer; shots one after the other at the bots'
 * speed (about 100 ms each) pass that in a bot's turn after turn, and the sixth in the second is lost.
 * A player takes more than a second to line up a shot.
 */
const SHOT_PACE_MS = 300;

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

test('bot cai no meio da reprodução, volta e termina no mesmo estado', async () => {
  const { bots } = await startPrivateGame();
  const { shooter, waiter } = byTurn(bots);
  const seat = waiter.seat;
  await shooter.shoot(BREAK, 1);
  const [mine] = await Promise.all([shooter.waitFor(OP.SHOT_RESULT), waiter.waitFor(OP.SHOT_RESULT)]);

  waiter.socket.disconnect(false);
  assert.deepEqual((await shooter.waitFor(OP.SEAT_UPDATE)).body, { seat, connected: false });
  await sleep(1000);
  await waiter.reconnect();
  const { header, payload } = await waiter.waitFor(OP.MATCH_SNAPSHOT);
  assert.equal(header.you.seat, seat);
  assert.ok(header.playback, 'the break is still playing');
  const { offsetMs } = header.playback;
  assert.ok(offsetMs >= 1000 && offsetMs < mine.header.durationMs, `offset ${offsetMs} ms of ${mine.header.durationMs} ms`);
  assert.deepEqual(header.playback.result, mine.header);
  assert.deepEqual(header.table, mine.header.table);
  assert.deepEqual(header.match, mine.header.match);
  assert.deepEqual(decodeTrajectory(payload!), decodeTrajectory(mine.payload!));
  assert.deepEqual(header.seats.map((s: { connected: boolean }) => s.connected), [true, true]);
  assert.deepEqual((await shooter.waitFor(OP.SEAT_UPDATE)).body, { seat, connected: true });
});

test('shot_request repetido não gera segunda tacada', async () => {
  const { bots } = await startPrivateGame();
  const { shooter, waiter } = byTurn(bots);
  await shooter.shoot(BREAK, 1);
  await shooter.shoot(BREAK, 1);
  await waiter.waitFor(OP.SHOT_RESULT);
  const copy = await shooter.waitFor(OP.MATCH_SNAPSHOT);
  assert.equal(copy.header.turnId, 1, 'the copy gets the state after the shot');
  await sleep(1000);
  for (const bot of [shooter, waiter]) {
    const ofTurn0 = (op: number) => bot.received.filter((m) => m.op === op && (m.body ?? m.header).turnId === 0).length;
    assert.equal(ofTurn0(OP.SHOT_ACCEPTED), 1);
    assert.equal(ofTurn0(OP.SHOT_RESULT), 1);
  }
});

test('segunda aba substitui a primeira', async () => {
  const { bots } = await startPrivateGame();
  const { shooter, waiter } = byTurn(bots);
  const seat = shooter.seat;
  await shooter.reconnect();   // the first socket stays open
  const { header } = await shooter.waitFor(OP.MATCH_SNAPSHOT);
  assert.equal(header.you.seat, seat);
  assert.deepEqual([header.turn.seat, header.turn.turnId], [seat, 0]);
  assert.deepEqual((await waiter.waitFor(OP.SEAT_UPDATE)).body, { seat, connected: true });

  await shooter.shoot(BREAK, 1);   // from the second tab
  assert.deepEqual((await waiter.waitFor(OP.SHOT_ACCEPTED)).body, { turnId: 0, seq: 1, seat, shot: BREAK });
  await waiter.waitFor(OP.SHOT_RESULT);
  assert.equal(waiter.received.some((m) => m.op === OP.SEAT_UPDATE && m.body.connected === false), false,
    'the first tab was removed without leaving the seat');
});

test('bot ausente por mais de 60 s perde por W.O.', { timeout: 90000 }, async () => {
  const { bots: [a, b] } = await startPrivateGame();
  const started = Date.now();
  b.socket.disconnect(false);
  const end = await a.waitFor(OP.MATCH_END, undefined, 75000);
  const seconds = (Date.now() - started) / 1000;
  assert.ok(seconds >= 60 && seconds <= 70, `the walkover came after ${seconds} s`);
  assert.deepEqual([end.body.winnerTeam, end.body.reason], [a.seat, 'ABANDON']);
});

test('desistência encerra a partida e grava o histórico uma vez', async () => {
  const { bots: [a, b], matchId } = await startPrivateGame();
  const firstSeat = a.snapshot!.turn!.seat;
  await a.send(OP.CONCEDE, '');   // no content: the server never reads it
  const ends = await Promise.all([a.waitFor(OP.MATCH_END), b.waitFor(OP.MATCH_END)]);
  for (const end of ends) {
    assert.deepEqual(end.body, { winnerTeam: b.seat, reason: 'CONCEDE', summary: { turns: 1, shots: 0 } });
  }

  // The record is written as the match ends; the client may read before the write commits.
  // Nakama 3.41 refuses the system user's id in a client read ("Invalid user ID"): a read with no
  // user_id gets the system-owned public object, and a list can name the system user.
  const { client, session } = a.bot;
  const read = await eventually(() => call(client.readStorageObjects(session, { object_ids: [{ collection: 'match_history', key: matchId }] })),
    (r) => r.ok && r.value.objects.length > 0);
  if (!read.ok) throw read.error;
  assert.equal(read.value.objects.length, 1, 'objects read without a user_id');
  const record = read.value.objects[0];
  assert.deepEqual([record.collection, record.key, record.user_id, record.permission_read, record.permission_write],
    ['match_history', matchId, SYSTEM_USER_ID, 2, 0]);
  const value = record.value as any;
  assert.deepEqual(
    { ...value, startedAt: typeof value.startedAt, endedAt: typeof value.endedAt },
    {
      matchId,
      mode: '8ball',
      format: '1v1',
      private: true,
      players: [a, b].map((player) => ({ seat: player.seat, team: player.seat, userId: player.bot.session.user_id, username: player.bot.session.username })),
      firstSeat,
      rack: 'fixed',
      simVersion: SIM_VERSION,
      protocolVersion: PROTOCOL_VERSION,
      shots: [],
      winnerTeam: b.seat,
      reason: 'CONCEDE',
      turns: 1,
      startedAt: 'number',
      endedAt: 'number',
    });
  assert.ok(value.endedAt >= value.startedAt && value.endedAt - value.startedAt < 60000);

  // The listing has this key: the history is listed by key, and the keys are random match ids, so the
  // record may be on any page once the database holds more than one (findStorageObject follows the cursor).
  const listed = await eventually(() => findStorageObject(a.bot, 'match_history', SYSTEM_USER_ID, matchId), (r) => r.ok && r.value !== undefined);
  if (!listed.ok) throw listed.error;
  assert.ok(listed.value, `match_history listing has no object with key ${matchId}`);
  assert.deepEqual(listed.value.value, value);
});

test('dois bots jogam uma partida inteira de 8-ball', { timeout: 300000 }, async () => {
  const { bots: [a, b], matchId } = await startPrivateGame();
  const bySeat = (seat: number) => (a.seat === seat ? a : b);

  // The bot of the seat to play shoots what chooseShot picks from the state the server last sent
  // (the start snapshot, then each shot_result); both wait for the same result, until the shot
  // that ends the match (its nextTurn is null).
  let state = { match: a.snapshot!.match, table: a.snapshot!.table };
  let seat = a.snapshot!.turn!.seat;
  const results: any[] = [];
  const took: number[] = [];
  for (;;) {
    assert.ok(results.length < MAX_MATCH_SHOTS, `no end after ${MAX_MATCH_SHOTS} shot results`);
    if (results.length > 0) await sleep(SHOT_PACE_MS);
    const shooter = bySeat(seat);
    const request = chooseShot(state, seat);
    const marks = [a.received.length, b.received.length];
    const sentAt = Date.now();
    await shooter.shoot(request);
    let both;
    try {
      both = await Promise.all([a.waitFor(OP.SHOT_RESULT, undefined, 20000), b.waitFor(OP.SHOT_RESULT, undefined, 20000)]);
    } catch (err) {
      // What each bot got since the request, so a stall says which message is missing.
      const got = [a, b].map((bot, i) => bot.received.slice(marks[i]).map((m) => (m.header ? `${m.op}:${m.header.kind ?? m.header.phase}` : `${m.op}:${JSON.stringify(m.body)}`)));
      const [mineGot, otherGot] = shooter === a ? got : [got[1], got[0]];
      throw new Error(`no shot_result for the shot ${results.length + 1} of seat ${seat} after ${Date.now() - sentAt} ms (${(err as Error).message}); `
        + `request: ${JSON.stringify(request)}; the shooter got ${JSON.stringify(mineGot)}, the other got ${JSON.stringify(otherGot)}; `
        + `ms of the shots so far: ${took.join(',')}`);
    }
    took.push(Date.now() - sentAt);
    const [mine, theirs] = both;
    assert.deepEqual(mine.header.table, theirs.header.table);
    assert.deepEqual(mine.header.match, theirs.header.match);
    assert.deepEqual(mine.payload, theirs.payload);
    assert.equal(mine.header.turnId, results.length);
    assert.equal(mine.header.match.turnId, results.length + 1);
    assert.equal(mine.header.kind, 'shot', 'the bots shoot within a second of their turn, so no turn times out, and 8-ball has no choices');
    assert.ok(decodeTrajectory(mine.payload!).length > 0);
    results.push(mine.header);
    if (!mine.header.nextTurn) break;
    state = { match: mine.header.match, table: mine.header.table };
    seat = mine.header.nextTurn.seat;
  }

  const ends = await Promise.all([a.waitFor(OP.MATCH_END), b.waitFor(OP.MATCH_END)]);
  assert.deepEqual(ends[0].body, ends[1].body);
  const end = ends[0].body;
  assert.equal(end.reason, 'WIN');
  assert.ok(end.winnerTeam === 0 || end.winnerTeam === 1, `winnerTeam ${end.winnerTeam}`);
  assert.equal(results[results.length - 1].ruling.winnerTeam, end.winnerTeam);
  assert.deepEqual(end.summary, { turns: results.length, shots: results.length });
  for (const bot of [a, b]) {
    assert.equal(bot.received.some((m) => m.op === OP.SHOT_REJECTED || m.op === OP.ERROR), false, 'the server refused or failed a shot');
  }

  // One record, with the same winner and the same shots, in the order they were played.
  const { client, session } = a.bot;
  const read = await eventually(() => call(client.readStorageObjects(session, { object_ids: [{ collection: 'match_history', key: matchId }] })),
    (r) => r.ok && r.value.objects.length > 0);
  if (!read.ok) throw read.error;
  assert.equal(read.value.objects.length, 1);
  const record = read.value.objects[0].value as any;
  assert.deepEqual([record.matchId, record.reason, record.winnerTeam, record.turns], [matchId, 'WIN', end.winnerTeam, results.length]);
  assert.equal(record.shots.length, results.filter((h) => h.kind === 'shot').length);
  assert.deepEqual(record.shots, results.map((h) => ({ turnId: h.turnId, seat: h.seat, shot: h.shot })));
});
