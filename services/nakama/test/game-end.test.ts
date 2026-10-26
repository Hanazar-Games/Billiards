// F4-06: the end of a match. A concession (op 5) or a win ends it; one record goes
// to match_history, written once; an aborted match leaves none; the room closes 10 s
// after the end; a failed write does not bring the match down.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OP, PROTOCOL_VERSION, SIM_VERSION, quantizeShot } from '@billiards/protocol';
import { endMatch } from '../src/game/end.ts';
import { SECONDS, TICK_RATE } from '../src/game/state.ts';
import type { GameEnv } from '../src/game/state.ts';
import { ctx, message, newGame, presence, recordingLogger, startedGame } from './fakes.ts';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
const LINGER = SECONDS.endLinger * TICK_RATE;
/** A plain copy (the state the harness hands out is a proxy over its own copy). */
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const matchEnds = (game: ReturnType<typeof startedGame>) => game.out().filter((m) => m.op === OP.MATCH_END);
/** The env a game function takes, over the same fakes the harness drives. */
const envOf = (game: ReturnType<typeof startedGame>): GameEnv => ({ ctx, logger: recordingLogger(), nk: game.nk as any, dispatcher: game.dispatcher });

test('partida concluída gera exatamente um registro em match_history', () => {
  const game = startedGame();
  const env = envOf(game);
  game.clear();
  endMatch(env, game.state, 40, 1, 'WIN');
  endMatch(env, game.state, 41, 0, 'WIN');   // a second end changes nothing

  assert.equal(game.nk.writes.length, 1);
  const write = game.nk.writes[0];
  assert.equal(write.collection, 'match_history');
  assert.equal(write.key, ctx.matchId);
  assert.equal(write.userId, SYSTEM_USER_ID);
  assert.equal(write.version, '*', 'create only: an existing record is never overwritten');
  assert.equal(write.permissionRead, 2, 'public read');
  assert.equal(write.permissionWrite, 0, 'only the server writes');
  assert.equal(game.state.historyWritten, true);

  assert.deepEqual(matchEnds(game).map((m) => m.body), [{ winnerTeam: 1, reason: 'WIN', summary: { turns: 0, shots: 0 } }]);
  assert.equal(game.state.endTick, 40);
  assert.equal(game.state.end!.winnerTeam, 1);
  assert.equal(game.state.phase, 'ENDED');
});

test('o registro traz jogadores, quem abriu, as tacadas quantizadas e o resultado', (t) => {
  let now = 1_800_000_000_000;
  t.mock.method(Date, 'now', () => now);
  const game = startedGame();
  const startedAt = now;
  const raw = { angle: Math.PI / 2 + 0.0000012, power: 99.99951, spin: { x: 0.0004, y: -0.1236 } };
  const shot = quantizeShot(raw);
  assert.notDeepEqual(shot, raw);

  now += 5000;
  game.loop(5, [message(game.shooter, OP.SHOT_REQUEST, { turnId: 0, seq: 1, ...raw })]);
  assert.equal(game.state.shots.length, 1);
  now += 7000;
  game.loop(60, [message(game.waiter, OP.CONCEDE, '')]);

  assert.equal(game.nk.writes.length, 1);
  const { value } = game.nk.writes[0];
  assert.deepEqual(plain(value), {
    matchId: ctx.matchId,
    mode: '8ball',
    format: '1v1',
    private: true,
    players: [
      { seat: 0, team: 0, userId: 'a', username: 'user-a' },
      { seat: 1, team: 1, userId: 'b', username: 'user-b' },
    ],
    firstSeat: game.seat,
    rack: 'fixed',
    simVersion: SIM_VERSION,
    protocolVersion: PROTOCOL_VERSION,
    shots: [{ turnId: 0, seat: game.seat, shot }],
    winnerTeam: game.seat,
    reason: 'CONCEDE',
    turns: 2,
    startedAt,
    endedAt: startedAt + 12000,
  });
  assert.equal(game.state.firstSeat, game.seat, 'the record names who broke');
});

test('partida abortada não grava histórico', () => {
  // A public lobby nobody fills.
  const lobby = newGame({ mode: '8ball', format: '1v1', private: false });
  lobby.join([presence('a')]);
  assert.equal(lobby.loop(SECONDS.fill * TICK_RATE), null);
  assert.equal(lobby.state.phase, 'ENDED');

  // Both players gone for the whole reserve.
  const absent = startedGame();
  absent.leave([absent.b], 10);
  absent.leave([absent.a], 300);
  absent.loop(10 + SECONDS.reconnect * TICK_RATE);
  assert.equal(absent.state.end!.reason, 'ABORTED');

  // Three failures of the sim.
  const failing = startedGame();
  failing.nk.sim.push(...Array.from({ length: 6 }, () => ({ status: 503 })));
  for (const tick of [1, 2, 3]) failing.loop(tick, [message(failing.shooter, OP.SHOT_REQUEST, { turnId: 0, seq: tick, angle: 1.5708, power: 50, spin: { x: 0, y: 0 } })]);
  assert.equal(failing.state.end!.reason, 'ABORTED');

  // The node shuts down in the lobby and in the middle of a match.
  const early = newGame();
  early.join([presence('a')]);
  early.clear();
  early.terminate(7);
  assert.deepEqual(early.out().map((m) => [m.op, m.body, m.to]),
    [[OP.MATCH_END, { winnerTeam: null, reason: 'ABORTED', summary: { turns: 0, shots: 0 } }, null]]);
  const live = startedGame();
  live.clear();
  live.terminate(7);
  assert.deepEqual(live.out().map((m) => [m.op, m.body, m.to]),
    [[OP.MATCH_END, { winnerTeam: null, reason: 'ABORTED', summary: { turns: 0, shots: 0 } }, null]]);
  assert.equal(live.state.phase, 'ENDED');
  assert.equal(live.state.endTick, 7);

  for (const game of [lobby, absent, failing, early, live]) {
    assert.equal(game.nk.writes.length, 0);
    assert.equal(game.state.historyWritten, false);
  }
});

test('o desligamento depois do fim não avisa de novo nem grava outro registro', () => {
  const game = startedGame();
  game.loop(5, [message(game.shooter, OP.CONCEDE, '')]);
  assert.equal(game.nk.writes.length, 1);
  game.clear();
  game.terminate(6);
  assert.deepEqual(game.out(), []);
  assert.equal(game.nk.writes.length, 1);
  assert.equal(game.state.end!.reason, 'CONCEDE');
  assert.equal(game.state.endTick, 5);
});

test('desistência: o outro time vence com reason CONCEDE', () => {
  for (const conceder of ['shooter', 'waiter'] as const) {
    const game = startedGame();
    const from = game[conceder];
    const seat = from === game.a ? 0 : 1;
    game.loop(30, [message(from, OP.CONCEDE, '')]);

    const out = game.out();
    assert.deepEqual(out.map((m) => [m.op, m.to]), [[OP.MATCH_END, null]], 'match_end to everyone, nothing else');
    // removeMatchSeat advances the turn id, so a shot sent before is refused.
    assert.deepEqual(out[0].body, { winnerTeam: 1 - seat, reason: 'CONCEDE', summary: { turns: 1, shots: 0 } });
    assert.equal(game.state.phase, 'ENDED');
    assert.equal(game.state.endTick, 30);
    assert.equal(game.state.match!.phase, 'ENDED');
    assert.equal(game.state.match!.mode.winnerTeam, 1 - seat);
    assert.equal(game.state.match!.mode.turn.seats[seat].eliminated, true);
    assert.equal(game.nk.writes.length, 1);
    assert.equal(plain(game.nk.writes[0].value).winnerTeam, 1 - seat);
    assert.equal(plain(game.nk.writes[0].value).reason, 'CONCEDE');
  }
});

test('a desistência não lê o corpo da mensagem', () => {
  for (const body of ['', '{"reason":', 'not json at all', '{"turnId":"x"}', '1e999']) {
    const game = startedGame();
    game.loop(3, [message(game.waiter, OP.CONCEDE, body)]);
    assert.deepEqual(game.out().map((m) => m.op), [OP.MATCH_END], JSON.stringify(body));
    assert.equal(game.state.end!.reason, 'CONCEDE');
    assert.deepEqual(plain(game.state.invalid), {});
  }
});

test('desistência de quem não é jogador, de sessão antiga, antes do início ou depois do fim não faz nada', () => {
  const game = startedGame();
  // Not a player.
  game.loop(1, [message(presence('z'), OP.CONCEDE, '')]);
  // A session the player replaced (a second tab).
  const tab = presence('a', 's-a-2');
  game.join([tab], 2);
  game.clear();
  game.loop(3, [message(game.a, OP.CONCEDE, '')]);
  assert.deepEqual(game.out(), []);
  assert.equal(game.state.phase, 'AWAITING_SHOT');
  assert.equal(game.nk.writes.length, 0);
  assert.deepEqual(plain(game.state.invalid), {});

  // The current session concedes; a concession after the end changes nothing.
  game.loop(4, [message(tab, OP.CONCEDE, '')]);
  assert.equal(game.state.end!.reason, 'CONCEDE');
  assert.equal(game.state.end!.winnerTeam, 1);
  game.clear();
  game.loop(5, [message(game.b, OP.CONCEDE, ''), message(tab, OP.CONCEDE, '')]);
  assert.deepEqual(game.out(), []);
  assert.equal(game.nk.writes.length, 1);
  assert.equal(game.state.endTick, 4);
  assert.equal(game.state.end!.winnerTeam, 1);
  assert.deepEqual(plain(game.state.invalid), {});

  // Before the match starts, in the lobby.
  const lobby = newGame();
  const a = presence('a');
  lobby.join([a]);
  lobby.loop(1, [message(a, OP.CONCEDE, '')]);
  assert.deepEqual(lobby.out(), []);
  assert.equal(lobby.state.phase, 'LOBBY');
  assert.equal(lobby.nk.writes.length, 0);
  assert.deepEqual(plain(lobby.state.invalid), {});
});

test('a partida termina 10 s depois do fim', () => {
  assert.equal(LINGER, 100);
  const game = startedGame();
  // The turn would run out at tick 450: the clock must not run while the room lingers.
  game.loop(440, [message(game.shooter, OP.CONCEDE, '')]);
  assert.equal(game.state.endTick, 440);
  assert.equal(game.nk.writes.length, 1);
  game.clear();
  for (let tick = 441; tick < 440 + LINGER; tick++) assert.ok(game.loop(tick), `tick ${tick}`);
  assert.deepEqual(game.out(), [], 'no timeout, no walkover while it lingers');
  assert.equal(game.loop(440 + LINGER), null);
  assert.equal(game.nk.writes.length, 1);
});

test('erro de escrita (registro já existe) não derruba a partida', () => {
  const game = startedGame();
  const writes: unknown[] = [];
  game.nk.storageWrite = (list: unknown) => {
    writes.push(list);
    throw new Error('Storage write rejected - not found, version check failed, or permission denied.');
  };
  game.clear();
  assert.doesNotThrow(() => game.loop(9, [message(game.shooter, OP.CONCEDE, '')]));

  assert.equal(writes.length, 1);
  assert.deepEqual(game.out().map((m) => m.op), [OP.MATCH_END], 'everyone is still told');
  assert.equal(game.state.phase, 'ENDED');
  assert.equal(game.state.historyWritten, true, 'it is not tried again');
  const warns = game.logs.filter((l) => l.level === 'warn');
  assert.equal(warns.length, 1);
  assert.match(warns[0].text, /match history/);
  assert.match(warns[0].text, new RegExp(ctx.matchId));
  assert.match(warns[0].text, /version check failed/);

  // The room still closes on time.
  assert.ok(game.loop(10));
  assert.equal(game.loop(9 + LINGER), null);
  assert.equal(writes.length, 1);
});
