// F4-04 and F4-05: a player who leaves keeps the seat for 60 s (the other is
// told), comes back with a snapshot that resumes a shot still playing, a second
// tab replaces the first, and a seat away for 60 s loses by walkover; with both
// seats away the match ends without a winner.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currentSeat } from '@billiards/modes';
import { OP, decodeTrajectory } from '@billiards/protocol';
import { SECONDS, TICK_RATE } from '../src/game/state.ts';
import { message, newGame, presence, simReply, startedGame } from './fakes.ts';

/** A plain copy (the state the harness hands out is a proxy over its own copy). */
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const shot = (turnId: number, seq: number, power = 50) => ({ turnId, seq, angle: 1.5708, power, spin: { x: 0, y: 0 } });
/** [op, JSON body (null for an envelope), sessionIds it went to (null: everyone)] of everything sent. */
const sentSummary = (game: ReturnType<typeof startedGame>) =>
  game.out().map((m) => [m.op, m.body ?? null, m.to ? m.to.map((p) => p.sessionId) : null]);
/** A seat's reconnection reserve, in ticks. */
const RESERVE = SECONDS.reconnect * TICK_RATE;

test('saída marca o lugar desconectado e avisa o outro', () => {
  const game = startedGame();
  game.leave([game.a], 30);
  assert.deepEqual(sentSummary(game), [[OP.SEAT_UPDATE, { seat: 0, connected: false }, [game.b.sessionId]]]);
  assert.equal(game.state.match!.seats[0].connected, false);
  assert.deepEqual(plain(game.state.disconnectedAt), { 0: 30 });
  assert.deepEqual(Object.keys(game.state.presences), ['b']);
  assert.deepEqual(game.dispatcher.kicked, []);
  assert.equal(game.state.phase, 'AWAITING_SHOT', 'the seat is kept');
});

test('volta em até 60 s: snapshot só para a conexão nova e aviso ao outro', () => {
  const game = startedGame();
  game.leave([game.b], 20);
  const at = 20 + RESERVE - 1;   // 59.9 s later
  for (let tick = 21; tick < at; tick++) game.loop(tick);
  game.clear();

  const back = presence('b', 's-b-2');
  assert.equal(game.attempt(back, undefined, at)!.accept, true);
  game.join([back], at);
  const out = game.out();
  assert.deepEqual(out.map((m) => [m.op, m.body ?? null, m.to!.map((p) => p.sessionId)]), [
    [OP.MATCH_SNAPSHOT, null, ['s-b-2']],
    [OP.SEAT_UPDATE, { seat: 1, connected: true }, [game.a.sessionId]],
  ]);
  const { header, payload } = out[0];
  assert.equal(header.you.seat, 1);
  assert.deepEqual(header.seats.map((s: { connected: boolean }) => s.connected), [true, true]);
  assert.deepEqual(header.match, plain(game.state.match));
  assert.deepEqual(header.table, plain(game.state.table));
  // The turn ran out at 450 while b was away: the next one ends at 900.
  assert.deepEqual(header.turn, { seat: currentSeat(game.state.match!), turnId: 1, deadlineInMs: (900 - at) * 100 });
  assert.equal(header.playback, null);
  assert.equal(payload!.length, 0);

  assert.equal(game.state.match!.seats[1].connected, true);
  assert.deepEqual(plain(game.state.disconnectedAt), {});
  assert.equal(game.state.presences.b.sessionId, 's-b-2');
  assert.deepEqual(game.dispatcher.kicked, [], 'the old connection had already left');

  // The reserve is gone: no walkover when it would have run out.
  game.clear();
  game.loop(20 + RESERVE);
  assert.deepEqual(game.out(), []);
  assert.equal(game.state.phase, 'AWAITING_SHOT');
});

test('volta no meio da reprodução: o snapshot traz o resultado, o deslocamento e a trajetória', () => {
  const game = startedGame();
  const frames = [1, 2, 3].map((i) => ({ t: i / 30, balls: [{ id: 0, x: 0, z: -60 + i * 5, q: [0, 0, 0, 1] as [number, number, number, number] }] }));
  game.nk.sim.push({ reply: simReply({ final: plain(game.state.table), simSeconds: 8, frames }) });
  game.loop(100, [message(game.shooter, OP.SHOT_REQUEST, shot(0, 1))]);
  const result = game.out().find((m) => m.op === OP.SHOT_RESULT)!;
  assert.equal(game.state.lastResult!.durationTicks, 90, '8 s of playback and 1 s of slack');
  game.leave([game.waiter], 110);
  game.clear();

  const back = presence(game.waiter.userId, 's-back');
  game.join([back], 130);
  const out = game.out();
  assert.deepEqual(out.map((m) => [m.op, m.to!.map((p) => p.sessionId)]),
    [[OP.MATCH_SNAPSHOT, ['s-back']], [OP.SEAT_UPDATE, [game.shooter.sessionId]]]);
  const { header, payload } = out[0];
  assert.equal(header.you.seat, 1 - game.seat);
  assert.deepEqual(header.playback, { result: result.header, offsetMs: 3000 });
  assert.deepEqual(payload, result.payload);
  assert.deepEqual(decodeTrajectory(payload!), decodeTrajectory(result.payload!));
  assert.deepEqual(header.table, result.header.table);
  assert.deepEqual(header.match, result.header.match);

  // [offsetMs or null, payload bytes] of the snapshot a new connection of the waiter gets at `tick`.
  const rejoin = (tick: number) => {
    game.clear();
    game.join([presence(game.waiter.userId, `s-${tick}`)], tick);
    const snapshot = game.out()[0];
    assert.equal(snapshot.op, OP.MATCH_SNAPSHOT);
    return [snapshot.header.playback ? snapshot.header.playback.offsetMs : null, snapshot.payload!.length];
  };
  // Up to the end of the playback and its slack, not after.
  assert.deepEqual(rejoin(189), [8900, result.payload!.length]);
  assert.deepEqual(rejoin(190), [null, 0]);
  // A result with nothing to play (a turn that ran out) never comes back as a playback.
  game.loop(100 + 90 + 450);
  assert.equal(game.state.lastResult!.header.kind, 'timeout');
  assert.deepEqual(rejoin(640), [null, 0]);
});

test('segunda aba substitui a primeira, e a saída da primeira é ignorada', () => {
  const game = startedGame();
  const old = game.shooter;
  const tab = presence(old.userId, 's-tab-2');
  assert.equal(game.attempt(tab, undefined, 5)!.accept, true);
  game.join([tab], 5);
  assert.deepEqual(game.dispatcher.kicked, [old]);
  assert.deepEqual(sentSummary(game), [
    [OP.MATCH_SNAPSHOT, null, ['s-tab-2']],
    [OP.SEAT_UPDATE, { seat: game.seat, connected: true }, [game.waiter.sessionId]],
  ]);
  assert.equal(game.state.presences[old.userId].sessionId, 's-tab-2');

  // Nakama then reports the kicked connection's leave: it changes nothing.
  game.clear();
  game.leave([old], 6);
  assert.deepEqual(game.out(), []);
  assert.equal(game.state.match!.seats[game.seat].connected, true);
  assert.deepEqual(plain(game.state.disconnectedAt), {});
  assert.equal(game.state.presences[old.userId].sessionId, 's-tab-2');

  // The old connection's shot is dropped; the new one's is accepted.
  game.loop(7, [message(old, OP.SHOT_REQUEST, shot(0, 1, 0))]);
  assert.deepEqual(game.out(), []);
  game.loop(8, [message(tab, OP.SHOT_REQUEST, shot(0, 2, 0))]);
  assert.deepEqual(game.out().map((m) => m.op), [OP.SHOT_ACCEPTED, OP.SHOT_RESULT]);

  // No reserve runs for a seat that never went away.
  game.clear();
  game.loop(6 + RESERVE);
  assert.equal(game.out().some((m) => m.op === OP.MATCH_END), false);
  assert.equal(game.state.phase, 'AWAITING_SHOT');
});

test('no saguão, a segunda aba também substitui a primeira: a antiga é removida e a saída dela é ignorada', () => {
  const game = newGame();
  const old = presence('a');
  game.join([old], 1);
  const tab = presence('a', 's-a-2');
  assert.equal(game.attempt(tab, undefined, 2)!.accept, true);
  game.join([tab], 2);
  assert.deepEqual(game.dispatcher.kicked, [old], 'the old connection would keep getting the broadcasts');
  assert.equal(game.state.presences.a.sessionId, 's-a-2');
  assert.deepEqual(plain(game.state.joinOrder), ['a']);

  // The same connection again is not a second tab.
  game.join([tab], 3);
  assert.deepEqual(game.dispatcher.kicked, [old]);

  // Nakama then reports the kicked connection's leave: the seat stays with the new tab.
  game.leave([old], 4);
  assert.equal(game.state.presences.a.sessionId, 's-a-2');
  assert.deepEqual(plain(game.state.joinOrder), ['a']);

  // The second player fills the room: the start snapshot goes to the new tab, not the old one.
  game.join([presence('b')], 5);
  const snapshots = game.out().filter((m) => m.op === OP.MATCH_SNAPSHOT);
  assert.deepEqual(snapshots.map((s) => s.to!.map((p) => p.sessionId)).sort(), [['s-a-2'], ['s-b']]);
  assert.deepEqual(game.state.players.map((p) => p.userId), ['a', 'b']);
});

test('ausente por 600 ticks perde por W.O.; 599 ainda não', () => {
  assert.equal(RESERVE, 600);
  const game = startedGame();
  const away = game.waiter;
  const awaySeat = 1 - game.seat;
  game.leave([away], 10);
  for (let tick = 11; tick < 10 + RESERVE; tick++) game.loop(tick);
  assert.equal(game.out().some((m) => m.op === OP.MATCH_END), false);
  assert.equal(game.state.phase, 'AWAITING_SHOT');

  game.clear();
  game.loop(10 + RESERVE);
  // The shooter's turn ran out at 450 (turn 1); removing the away seat starts turn 2.
  assert.deepEqual(sentSummary(game), [[OP.MATCH_END, { winnerTeam: game.seat, reason: 'ABANDON', summary: { turns: 2, shots: 0 } }, null]]);
  assert.equal(game.state.phase, 'ENDED');
  assert.equal(game.state.match!.mode.winnerTeam, game.seat);
  assert.equal(game.state.match!.mode.turn.seats[awaySeat].eliminated, true);

  // Too late to come back; the clock stops.
  assert.deepEqual(game.attempt(presence(away.userId, 's-late'), undefined, 611), { state: game.state, accept: false, rejectMessage: 'MATCH_ENDED' });
  game.clear();
  game.loop(5000);
  assert.deepEqual(game.out(), []);
});

test('os dois ausentes: a partida termina ABORTED, sem vencedor', () => {
  const game = startedGame();
  game.leave([game.b], 10);
  game.leave([game.a], 300);
  game.loop(10 + RESERVE - 1);   // the turn runs out (turn 1); seat 1 has 0.1 s left
  assert.equal(game.out().some((m) => m.op === OP.MATCH_END), false);

  game.clear();
  game.loop(10 + RESERVE);
  assert.deepEqual(sentSummary(game), [[OP.MATCH_END, { winnerTeam: null, reason: 'ABORTED', summary: { turns: 1, shots: 0 } }, null]]);
  assert.equal(game.state.phase, 'ENDED');
  assert.equal(game.state.match!.mode.winnerTeam, null, 'nobody wins by the walkover of someone who also left');
  assert.deepEqual(game.state.match!.mode.turn.seats.map((s) => s.eliminated), [false, false]);
});

test('ausente na própria vez: o cronômetro continua e o tempo esgotado conta', () => {
  const game = startedGame();
  game.leave([game.shooter], 0);
  game.clear();
  const sent: unknown[][] = [];
  for (let tick = 1; tick <= RESERVE + 10; tick++) {
    game.loop(tick);
    for (const m of game.out()) sent.push([tick, m.op, m.header ? [m.header.kind, m.header.seat] : [m.body.reason, m.body.winnerTeam]]);
    game.clear();
  }
  // The away seat's turn runs out at 450 like any other; its reserve at 600.
  assert.deepEqual(sent, [
    [450, OP.SHOT_RESULT, ['timeout', game.seat]],
    [600, OP.MATCH_END, ['ABANDON', 1 - game.seat]],
  ]);

  // On the same tick, the turn's deadline counts before the reserve.
  const same = startedGame();
  same.leave([same.waiter], 0);
  same.loop(140, [message(same.shooter, OP.SHOT_REQUEST, shot(0, 1, 0))]);   // power 0: 1 s of slack, then the waiter's turn
  assert.equal(same.state.deadlineTick, RESERVE);
  same.clear();
  same.loop(RESERVE);
  const out = same.out();
  assert.deepEqual(out.map((m) => m.op), [OP.SHOT_RESULT, OP.MATCH_END]);
  assert.deepEqual([out[0].header.kind, out[0].header.seat], ['timeout', 1 - same.seat]);
  assert.deepEqual(out[1].body, { winnerTeam: same.seat, reason: 'ABANDON', summary: { turns: 3, shots: 1 } });
});
