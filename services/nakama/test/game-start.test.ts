// F4-02: the match starts when both seats fill, every presence gets its own
// snapshot, joins are checked (protocol version, ended match, full room) and a
// public lobby nobody fills ends.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODES, currentSeat, rackTable } from '@billiards/modes';
import { OP, PROTOCOL_VERSION, SIM_VERSION } from '@billiards/protocol';
import { BALL, SHOT, TABLE_PROFILES, cushionContactInset } from '@billiards/sim/constants';
import { ONLINE_TABLE, SECONDS, TICK_RATE, onlineConfig } from '../src/game/state.ts';
import { newGame, presence, startedGame } from './fakes.ts';

test('a partida começa quando os dois entram: cada um recebe o snapshot com o próprio lugar', () => {
  const game = newGame();
  const [a, b] = [presence('a'), presence('b')];
  game.join([a], 3);
  assert.equal(game.out().length, 0, 'nothing is sent while one seat is empty');
  assert.equal(game.state.phase, 'LOBBY');
  game.join([b], 4);

  const snapshots = game.out().filter((m) => m.op === OP.MATCH_SNAPSHOT);
  // One per presence, each with its own seat; seats follow the join order.
  assert.deepEqual(snapshots.map((s) => [s.to!.map((p) => p.sessionId), s.header.you.seat]).sort(),
    [[[a.sessionId], 0], [[b.sessionId], 1]]);
  for (const { header, payload } of snapshots) {
    assert.equal(payload!.length, 0, 'the envelope is exactly header-sized');
    assert.equal(header.protocolVersion, PROTOCOL_VERSION);
    assert.equal(header.simVersion, SIM_VERSION);
    assert.equal(header.mode, '8ball');
    assert.equal(header.format, '1v1');
    assert.equal(header.phase, 'AWAITING_SHOT');
    assert.deepEqual(header.seats, [
      { seat: 0, userId: 'a', username: 'user-a', connected: true, timeouts: 0 },
      { seat: 1, userId: 'b', username: 'user-b', connected: true, timeouts: 0 },
    ]);
    assert.equal(header.turnId, 0);
    assert.deepEqual(header.match, snapshots[0].header.match);
    assert.deepEqual(header.match.seats.map((s: { userId: string }) => s.userId), ['a', 'b']);
    assert.equal(header.table.balls.length, 16);
    assert.deepEqual(header.table, rackTable(MODES['8ball'].rackLayout(header.match.mode), ONLINE_TABLE));
    assert.equal(header.turn.seat, header.match.mode.turn.currentSeat);
    assert.equal(header.turn.turnId, 0);
    assert.equal(header.turn.deadlineInMs, 45000);
    assert.equal(header.playback, null);
    assert.equal(header.end, null);
  }
  assert.equal(game.state.deadlineTick, 4 + 45 * TICK_RATE);
  assert.equal(game.state.firstSeat, currentSeat(game.state.match!));
  assert.deepEqual(game.state.players, [{ userId: 'a', username: 'user-a' }, { userId: 'b', username: 'user-b' }]);
  assert.deepEqual(JSON.parse(game.dispatcher.labels.at(-1)!),
    { mode: '8ball', format: '1v1', code: 'ABC234', private: true, open: false, started: true });
});

test('os lugares seguem a ordem de entrada, mesmo com o estado voltando do Go com as chaves fora de ordem', () => {
  for (const [first, second] of [['a', 'b'], ['b', 'a']]) {
    const game = newGame();
    game.join([presence('c')]);
    game.leave([presence('c')]);   // a lobby leave frees the seat
    game.join([presence(first)]);
    game.join([presence(second)]);
    assert.deepEqual(game.state.players.map((p) => p.userId), [first, second]);
    assert.deepEqual(game.out().map((m) => [m.to![0].userId, m.header.you.seat]).sort(), [['a', first === 'a' ? 0 : 1], ['b', first === 'a' ? 1 : 0]]);
  }
});

test('a mesa online é a pool9ft, com raio, contato com a tabela e força máxima do sim', () => {
  const config = onlineConfig();
  const profile = TABLE_PROFILES[ONLINE_TABLE];
  assert.equal(ONLINE_TABLE, 'pool9ft');
  assert.deepEqual(config, {
    format: { kind: '1v1' },
    table: { width: profile.width, depth: profile.depth, ballRadius: BALL.radius, cushionInset: cushionContactInset(profile) },
    maxPower: SHOT.maxPower,
  });
  const { state } = startedGame('9ball');
  assert.deepEqual(state.match!.mode.config, config);
  assert.equal(state.table!.balls.length, 10);
  assert.equal(state.table!.tableProfileId, 'pool9ft');
});

test('quem abre é sorteado entre os dois lugares', () => {
  const firsts = new Set<number>();
  for (let i = 0; i < 40; i++) firsts.add(startedGame().state.firstSeat);
  assert.deepEqual([...firsts].sort(), [0, 1]);
});

test('entrada sem protocolVersion ou com outra versão é recusada', () => {
  const game = newGame();
  for (const metadata of [{}, { protocolVersion: '2' }, { protocolVersion: 'x' }, { protocolVersion: '' }, null as any]) {
    assert.deepEqual(game.attempt(presence('a'), metadata), { state: game.state, accept: false, rejectMessage: 'PROTOCOL_MISMATCH' });
  }
  assert.equal(game.attempt(presence('a'), { protocolVersion: '1' })!.accept, true);
});

test('partida começada recusa quem não é jogador (ROOM_FULL); terminada recusa todos (MATCH_ENDED)', () => {
  const game = startedGame();
  assert.deepEqual(game.attempt(presence('c')), { state: game.state, accept: false, rejectMessage: 'ROOM_FULL' });
  assert.equal(game.attempt(presence('a', 's-a-2'))!.accept, true);   // a player comes back
  game.leave([game.b], 5);
  assert.deepEqual(game.attempt(presence('c')), { state: game.state, accept: false, rejectMessage: 'ROOM_FULL' });
  assert.equal(game.attempt(presence('b', 's-b-2'))!.accept, true);
  game.state.phase = 'ENDED';
  assert.deepEqual(game.attempt(presence('a', 's-a-3')), { state: game.state, accept: false, rejectMessage: 'MATCH_ENDED' });
  // The version is checked first.
  assert.deepEqual(game.attempt(presence('a', 's-a-3'), {}), { state: game.state, accept: false, rejectMessage: 'PROTOCOL_MISMATCH' });
});

test('saída de um jogador marca o lugar desconectado e avisa o outro', () => {
  const game = startedGame();
  game.leave([game.b], 20);
  const out = game.out();
  assert.deepEqual(out.map((m) => [m.op, m.body, m.to!.map((p) => p.userId)]), [[OP.SEAT_UPDATE, { seat: 1, connected: false }, ['a']]]);
  assert.equal(game.state.match!.seats[1].connected, false);
  assert.equal(game.state.disconnectedAt[1], 20);
  assert.deepEqual(Object.keys(game.state.presences), ['a']);
});

test('partida pública sem adversário por 30 s termina ABORTED; sala privada não', () => {
  const lonely = newGame({ mode: '8ball', format: '1v1', private: false });
  lonely.join([presence('a')]);
  const fill = SECONDS.fill * TICK_RATE;
  assert.equal(fill, 300);
  for (let tick = 1; tick < fill; tick++) assert.ok(lonely.loop(tick), `tick ${tick}`);
  assert.equal(lonely.out().length, 0);
  assert.equal(lonely.loop(fill), null);
  assert.deepEqual(lonely.out().map((m) => [m.op, m.body, m.to]),
    [[OP.MATCH_END, { winnerTeam: null, reason: 'ABORTED', summary: { turns: 0, shots: 0 } }, null]]);

  const room = newGame();
  room.join([presence('a')]);
  for (let tick = 1; tick <= 2 * fill; tick++) assert.ok(room.loop(tick), `private tick ${tick}`);
  assert.equal(room.out().length, 0);

  const filled = newGame({ mode: '9ball', format: '1v1', private: false });
  filled.join([presence('a')]);
  for (let tick = 1; tick <= 2 * fill; tick++) {
    if (tick === 100) filled.join([presence('b')], tick);
    assert.ok(filled.loop(tick), `filled tick ${tick}`);
  }
  assert.equal(filled.out().filter((m) => m.op === OP.MATCH_END).length, 0);
});
