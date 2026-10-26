// F4-03: an accepted shot goes to the sim and through the mode's rules, and both
// players get the shot_result; the next turn's clock starts after the playback.
// A failed sim call is tried once more; a shot that still fails can be sent again,
// and three failures abort the match.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODES, currentSeat, placeCueBall, respotBalls } from '@billiards/modes';
import { OP, SIM_VERSION, bytesToBase64, decodeTrajectory, encodeTrajectory, quantizeShot } from '@billiards/protocol';
import { simulateShot } from '@billiards/sim';
import { message, simReply, startedGame } from './fakes.ts';

/** A break straight up the table, already quantized. */
const BREAK = { angle: 1.5708, power: 110, spin: { x: 0, y: 0 } };
const request = (turnId: number, seq: number, shot: Record<string, unknown> = BREAK) => ({ turnId, seq, ...shot });
/** A plain copy (the state the harness hands out is a proxy over its own copy). */
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const ops = (game: ReturnType<typeof startedGame>) => game.out().map((m) => m.op);

test('tacada aceita: shot_accepted, uma chamada ao sim com a tacada quantizada e shot_result para todos', () => {
  const game = startedGame();
  game.state.match!.mode.ballInHand = { seat: game.seat, zone: 'anywhere' };
  const table = plain(game.state.table!);
  const raw = { angle: Math.PI / 2 + 0.0000012, power: 99.99951, spin: { x: 0.0004, y: -0.1236 }, cueBall: { x: 20.004, z: -80.001 } };
  const shot = quantizeShot(raw);
  assert.deepEqual(shot.cueBall, { x: 20, z: -80 });

  game.loop(5, [message(game.shooter, OP.SHOT_REQUEST, request(0, 1, raw))]);
  const out = game.out();
  assert.deepEqual(out.map((m) => [m.op, m.to]), [[OP.SHOT_ACCEPTED, null], [OP.SHOT_RESULT, null]]);
  assert.deepEqual(out[0].body, { turnId: 0, seq: 1, seat: game.seat, shot });

  // One call, with the cue ball already placed on the table the sim gets.
  assert.equal(game.nk.http.length, 1);
  const call = game.nk.http[0];
  assert.equal(call.url, 'http://sim.test:8080/simulate');
  assert.equal(call.method, 'post');
  assert.deepEqual(call.headers, { 'Content-Type': 'application/json', 'x-sim-secret': 'test-sim-secret' });
  assert.equal(call.timeoutMs, 3000);
  assert.deepEqual(JSON.parse(call.body), { simVersion: SIM_VERSION, table: placeCueBall(table, shot.cueBall!), shot });

  assert.deepEqual(plain(game.state.lastAccepted), { [game.seat]: { turnId: 0, seq: 1 } });
  assert.deepEqual(plain(game.state.decisions), [{ turnId: 0, seat: game.seat, kind: 'shot', shot }]);
  const info = game.logs.filter((l) => l.level === 'info');
  assert.equal(info.length, 1);
  assert.match(info[0].text, new RegExp(`matchId=match-1\\.nakama turnId=0 seat=${game.seat} simMs=\\d+`));
});

test('o shot_result traz trajetória, eventos, decisão, a partida nova e o próximo turno', () => {
  const game = startedGame();
  const table = plain(game.state.table!);
  const match = plain(game.state.match!);
  game.loop(5, [message(game.shooter, OP.SHOT_REQUEST, request(0, 1))]);
  const { header, payload } = game.out().find((m) => m.op === OP.SHOT_RESULT)!;

  const expected = simulateShot(table, BREAK);
  const ruling = MODES['8ball'].resolveShot(match.mode as any, game.seat, expected.events, expected.final, BREAK);
  assert.ok(decodeTrajectory(payload!).length > 0);
  assert.deepEqual(payload, encodeTrajectory(expected.frames));
  assert.equal(header.kind, 'shot');
  assert.equal(header.turnId, 0);
  assert.equal(header.seq, 1);
  assert.equal(header.seat, game.seat);
  assert.deepEqual(header.shot, BREAK);
  assert.deepEqual(header.events, expected.events);
  assert.deepEqual(header.final, expected.final);
  assert.deepEqual(header.table, respotBalls(expected.final, ruling.respot, match.mode.config.table));
  const { state: _state, eliminatedSeats: _eliminated, ...decision } = ruling;
  assert.deepEqual(header.ruling, decision);
  assert.equal(header.match.turnId, 1);
  assert.deepEqual(header.match.mode, ruling.state);
  assert.equal(header.durationMs, Math.round(expected.simSeconds * 1000));
  assert.equal(header.capped, false);
  const durationTicks = Math.ceil(expected.simSeconds * 10) + 10;
  assert.deepEqual(header.nextTurn, { seat: currentSeat(header.match), turnId: 1, deadlineInMs: (durationTicks + 450) * 100 });

  // The state follows the result, and keeps it for a reconnection: the trajectory as base64 (R10).
  assert.deepEqual(plain(game.state.table), header.table);
  assert.deepEqual(plain(game.state.match), header.match);
  assert.equal(game.state.phase, 'AWAITING_SHOT');
  const last = game.state.lastResult!;
  assert.deepEqual(plain(last.header), header);
  assert.equal(last.trajectory, bytesToBase64(payload!));
  assert.equal(last.tick, 5);
  assert.equal(last.durationTicks, durationTicks);
});

test('o 8 encaçapado na abertura volta à marca do pé na mesa do resultado', () => {
  const game = startedGame();
  const geometry = game.state.match!.mode.config.table;
  // The balls spread out; the 8 went down (the sim parks a pocketed ball at x = 0, z = 0).
  const final = {
    tableProfileId: 'pool9ft',
    balls: game.state.table!.balls.map((b) => (b.id === 8
      ? { id: 8, x: 0, z: 0, q: [0, 0, 0, 1], pocketed: true }
      : { id: b.id, x: -56 + b.id * 7, z: -40, q: [0, 0, 0, 1], pocketed: false })),
  };
  const events = [
    { t: 0.05, type: 'ball_ball', a: 0, b: 1, speed: 400 },
    { t: 0.05, type: 'first_contact', ball: 1 },
    { t: 1.2, type: 'pocket', ball: 8, pocket: 4 },
  ];
  game.nk.sim.push({ reply: simReply({ final, events, simSeconds: 6 }) });
  game.loop(1, [message(game.shooter, OP.SHOT_REQUEST, request(0, 1))]);
  const { header } = game.out().find((m) => m.op === OP.SHOT_RESULT)!;

  assert.deepEqual(header.ruling.messages, [{ code: 'EIGHT_ON_BREAK_RESPOT' }]);
  assert.deepEqual(header.ruling.respot, [8]);
  assert.deepEqual(header.final, final);
  const eight = { id: 8, x: 0, z: geometry.depth / 2 * 0.55, q: [0, 0, 0, 1], pocketed: false };
  assert.deepEqual(header.table.balls.find((b: { id: number }) => b.id === 8), eight);
  assert.deepEqual(plain(game.state.table!.balls.find((b) => b.id === 8)), eight);
  assert.equal(header.nextTurn.seat, game.seat, 'the breaker keeps the table');
});

test('o prazo conta a reprodução: tick + ceil(simSeconds·10) + 10 + 450', () => {
  const game = startedGame();
  const simSeconds = 1517 / 360;   // 4.21… s: 43 ticks of playback, 10 of slack
  game.nk.sim.push({ reply: simReply({ final: plain(game.state.table), simSeconds }) });
  game.loop(7, [message(game.shooter, OP.SHOT_REQUEST, request(0, 1))]);
  const { header } = game.out().find((m) => m.op === OP.SHOT_RESULT)!;
  assert.equal(header.durationMs, 4214);
  assert.equal(header.nextTurn.deadlineInMs, (53 + 450) * 100);
  assert.equal(game.state.deadlineTick, 7 + 53 + 450);
  assert.equal(game.state.lastResult!.durationTicks, 53);

  game.clear();
  game.loop(509);
  assert.deepEqual(game.out(), []);
  game.loop(510);
  assert.deepEqual(game.out().map((m) => [m.op, m.header.kind]), [[OP.SHOT_RESULT, 'timeout']]);
});

test('força 0 não chama o sim e decide a tacada', () => {
  const game = startedGame();
  game.state.match!.mode.ballInHand = { seat: game.seat, zone: 'anywhere' };
  const table = plain(game.state.table!);
  const shot = { angle: 1, power: 0, spin: { x: 0, y: 0 }, cueBall: { x: 20, z: -80 } };
  game.loop(3, [message(game.shooter, OP.SHOT_REQUEST, request(0, 1, shot))]);

  assert.equal(game.nk.http.length, 0);
  assert.deepEqual(ops(game), [OP.SHOT_ACCEPTED, OP.SHOT_RESULT]);
  const { header, payload } = game.out()[1];
  assert.deepEqual(payload, encodeTrajectory([]));
  assert.deepEqual(decodeTrajectory(payload!), []);
  assert.deepEqual(header.events, []);
  assert.deepEqual(header.final, placeCueBall(table, shot.cueBall));
  assert.deepEqual(header.table, header.final);
  assert.deepEqual(header.ruling.fouls, ['NO_BALL_HIT']);
  assert.equal(header.durationMs, 0);
  assert.notEqual(header.nextTurn.seat, game.seat);
  assert.equal(game.state.deadlineTick, 3 + 10 + 450);
  assert.deepEqual(plain(game.state.decisions), [{ turnId: 0, seat: game.seat, kind: 'shot', shot }]);
});

test('falha do sim: uma nova tentativa e segue', () => {
  const game = startedGame();
  game.nk.sim.push({ throws: 'i/o timeout' });
  game.loop(1, [message(game.shooter, OP.SHOT_REQUEST, request(0, 1))]);
  assert.equal(game.nk.http.length, 2);
  assert.deepEqual(game.nk.http[1], game.nk.http[0]);
  assert.deepEqual(ops(game), [OP.SHOT_ACCEPTED, OP.SHOT_RESULT]);
  assert.equal(game.state.simFailures, 0);
  assert.deepEqual(game.logs.filter((l) => l.level === 'warn'), []);
});

test('duas falhas: a vez volta ao mesmo jogador sem falta, e a mesma tacada pode ser reenviada', () => {
  const game = startedGame();
  const match = plain(game.state.match!);
  game.nk.sim.push({ throws: 'i/o timeout' }, { status: 500 });
  game.loop(20, [message(game.shooter, OP.SHOT_REQUEST, request(0, 1))]);

  assert.equal(game.nk.http.length, 2);
  const out = game.out();
  assert.deepEqual(out.map((m) => m.op), [OP.SHOT_ACCEPTED, OP.ERROR, OP.MATCH_SNAPSHOT, OP.MATCH_SNAPSHOT]);
  assert.deepEqual([out[0].to, out[1].to], [null, null]);
  assert.deepEqual(out.slice(2).map((m) => m.to!.map((p) => p.sessionId)).sort(), [[game.a.sessionId], [game.b.sessionId]]);
  assert.deepEqual(out[1].body, { code: 'SIM_FAILED' });
  for (const { header } of out.slice(2)) {
    assert.equal(header.turnId, 0);
    assert.deepEqual(header.match.mode, match.mode, 'no foul, nothing changes');
    assert.deepEqual(header.turn, { seat: game.seat, turnId: 0, deadlineInMs: 45000 });
  }
  assert.equal(game.state.simFailures, 1);
  assert.equal(game.state.deadlineTick, 20 + 450);
  assert.equal(game.state.lastAccepted[game.seat], undefined);
  assert.deepEqual(plain(game.state.decisions), []);
  assert.deepEqual(game.logs.filter((l) => l.level === 'warn').map((l) => l.text),
    ['sim failed: matchId=match-1.nakama turnId=0 seat=' + game.seat + ' error=SIM_HTTP failures=1']);

  // The same request again is a new shot, not a resend.
  game.clear();
  game.loop(21, [message(game.shooter, OP.SHOT_REQUEST, request(0, 1))]);
  assert.deepEqual(ops(game), [OP.SHOT_ACCEPTED, OP.SHOT_RESULT]);
  assert.equal(game.out()[1].header.seq, 1);
});

test('três falhas na partida: match_end ABORTED', () => {
  const game = startedGame();
  game.nk.sim.push(
    { throws: 'i/o timeout' }, { throws: 'connection refused' },
    { status: 503 }, { status: 401 },
    { status: 200, body: 'not json' }, { reply: { trajectory: '###', events: [], final: { balls: [] }, steps: 1, simSeconds: 0, capped: false } },
  );
  for (const tick of [1, 2, 3]) game.loop(tick, [message(game.shooter, OP.SHOT_REQUEST, request(0, tick))]);

  assert.equal(game.nk.http.length, 6);
  assert.deepEqual(ops(game), [
    OP.SHOT_ACCEPTED, OP.ERROR, OP.MATCH_SNAPSHOT, OP.MATCH_SNAPSHOT,
    OP.SHOT_ACCEPTED, OP.ERROR, OP.MATCH_SNAPSHOT, OP.MATCH_SNAPSHOT,
    OP.SHOT_ACCEPTED, OP.ERROR, OP.MATCH_END,
  ]);
  const end = game.out().at(-1)!;
  assert.deepEqual([end.body, end.to], [{ winnerTeam: null, reason: 'ABORTED', summary: { turns: 0, shots: 0 } }, null]);
  assert.equal(game.state.phase, 'ENDED');
  assert.deepEqual(plain(game.state.end), end.body);
  assert.equal(game.state.endTick, 3);
  assert.deepEqual(game.logs.filter((l) => l.level === 'warn').map((l) => /error=(\w+)/.exec(l.text)![1]),
    ['SIM_TIMEOUT', 'SIM_HTTP', 'SIM_BAD_REPLY']);

  // Ended: no more shots, and the clock stops.
  game.clear();
  game.loop(4, [message(game.shooter, OP.SHOT_REQUEST, request(0, 4))]);
  game.loop(5000);
  assert.deepEqual(game.out().map((m) => [m.op, m.body]), [[OP.SHOT_REJECTED, { seq: 4, reason: 'NOT_AWAITING_SHOT' }]]);
});

test('com a branca encaçapada, a tacada precisa colocá-la (CUE_BALL_INVALID) e o sim não é chamado', () => {
  const game = startedGame();
  const cue = game.state.table!.balls.find((b) => b.id === 0)!;
  cue.pocketed = true;
  game.state.match!.mode.ballInHand = { seat: game.seat, zone: 'anywhere' };
  game.loop(1, [message(game.shooter, OP.SHOT_REQUEST, request(0, 1))]);
  assert.deepEqual(game.out().map((m) => [m.op, m.body]), [[OP.SHOT_REJECTED, { seq: 1, reason: 'CUE_BALL_INVALID' }]]);
  assert.equal(game.nk.http.length, 0);
  game.loop(2, [message(game.shooter, OP.SHOT_REQUEST, request(0, 2, { ...BREAK, cueBall: { x: 0, z: -69.85 } }))]);
  assert.deepEqual(ops(game).slice(1), [OP.SHOT_ACCEPTED, OP.SHOT_RESULT]);
});
