// F4-03: the turn clock (a turn that times out is a foul; three in a row by the
// same seat are an abandonment) and the 9-ball push-out answered with op 7.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OP, decodeTrajectory, encodeTrajectory } from '@billiards/protocol';
import { message, simReply, startedGame } from './fakes.ts';

const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const shot = (turnId: number, seq: number, extra: Record<string, unknown> = {}) =>
  ({ turnId, seq, angle: 1.5708, power: 0, spin: { x: 0, y: 0 }, ...extra });

test('tempo esgotado conta como falta', () => {
  const game = startedGame();   // started at tick 0: the turn ends at tick 450
  const table = plain(game.state.table!);
  const other = 1 - game.seat;
  game.loop(449);
  assert.deepEqual(game.out(), []);
  game.loop(450);

  const out = game.out();
  assert.deepEqual(out.map((m) => [m.op, m.to]), [[OP.SHOT_RESULT, null]]);
  const { header, payload } = out[0];
  assert.deepEqual(payload, encodeTrajectory([]));
  assert.deepEqual(decodeTrajectory(payload!), []);
  assert.deepEqual(header, {
    kind: 'timeout',
    turnId: 0,
    seq: null,
    seat: game.seat,
    shot: null,
    events: [],
    final: table,
    table,
    ruling: {
      fouls: ['TIMEOUT'],
      ballInHand: { seat: other, zone: 'anywhere' },
      nextSeat: other,
      winnerTeam: null,
      respot: [],
      messages: [{ code: 'TIMEOUT', params: { seat: game.seat, next: other } }],
    },
    match: header.match,
    durationMs: 0,
    capped: false,
    nextTurn: { seat: other, turnId: 1, deadlineInMs: 45000 },
  });
  assert.equal(header.match.turnId, 1);
  assert.equal(header.match.mode.turn.currentSeat, other);
  assert.equal(header.match.seats[game.seat].timeouts, 1);
  assert.equal(game.state.deadlineTick, 900);
  assert.equal(game.state.lastResult!.tick, 450);
  assert.equal(game.state.lastResult!.durationTicks, 0);
  assert.equal(game.nk.http.length, 0);
});

test('uma tacada que chega no tick do prazo dá NOT_YOUR_TURN (o relógio roda antes das mensagens)', () => {
  const game = startedGame();
  game.loop(450, [message(game.shooter, OP.SHOT_REQUEST, shot(0, 1, { power: 50 }))]);
  assert.deepEqual(game.out().map((m) => [m.op, m.header?.kind ?? m.body]), [
    [OP.SHOT_RESULT, 'timeout'],
    [OP.SHOT_REJECTED, { seq: 1, reason: 'NOT_YOUR_TURN' }],
  ]);
  assert.equal(game.nk.http.length, 0);
});

test('três tempos esgotados seguidos = abandono; uma tacada zera a contagem', () => {
  const game = startedGame();
  const [first, second] = [game.seat, 1 - game.seat];
  const timeouts = () => game.state.match!.seats.map((s) => s.timeouts);
  const expect = (seat: number, counts: Record<number, number>) => {
    assert.equal(game.state.match!.mode.turn.currentSeat, seat);
    assert.deepEqual(timeouts(), [counts[0], counts[1]]);
  };

  game.loop(450);    // first: 1
  game.loop(900);    // second: 1
  game.loop(1350);   // first: 2
  game.loop(1800);   // second: 2
  expect(first, { [first]: 2, [second]: 2 });
  // first shoots (power 0: a foul on the break, no sim): its count starts over.
  const presence = first === game.seat ? game.shooter : game.waiter;
  game.loop(1801, [message(presence, OP.SHOT_REQUEST, shot(4, 1))]);
  expect(second, { [first]: 0, [second]: 2 });
  game.clear();

  game.loop(1801 + 10 + 450);   // second's third in a row
  const out = game.out();
  assert.deepEqual(out.map((m) => [m.op, m.to]), [[OP.MATCH_END, null]]);
  assert.deepEqual(out[0].body, { winnerTeam: first, reason: 'ABANDON', summary: { turns: 7, shots: 1 } });
  assert.equal(game.state.phase, 'ENDED');
  assert.equal(game.state.match!.mode.winnerTeam, first);
  assert.equal(game.state.match!.mode.turn.seats[second].eliminated, true);

  game.clear();
  game.loop(10000);
  assert.deepEqual(game.out(), [], 'the clock stops once the match ends');
});

test('9-ball: push-out pendente e escolha pela operação 7', () => {
  const game = startedGame('9ball');
  const breaker = game.shooter;
  const pusher = game.waiter;
  const choose = (from: typeof breaker, turnId: number, accept: boolean) => message(from, OP.PUSH_OUT_CHOICE, { turnId, accept });
  const rejected = () => game.out().filter((m) => m.op === OP.SHOT_REJECTED).map((m) => m.body);

  // No push-out to answer yet.
  game.loop(1, [choose(pusher, 0, true)]);
  game.loop(2, [choose(breaker, 0, true)]);
  assert.deepEqual(rejected(), [{ seq: null, reason: 'NO_CHOICE_PENDING' }, { seq: null, reason: 'NO_CHOICE_PENDING' }]);
  game.clear();

  // A break that pockets nothing and drives four balls to a rail: the next seat may push out.
  const table = plain(game.state.table!);
  const railEvents = [2, 3, 4, 5].map((ball, i) => ({ t: 0.5 + i / 10, type: 'ball_cushion', ball, speed: 100 }));
  game.nk.sim.push({ reply: simReply({ final: table, events: [{ t: 0.05, type: 'first_contact', ball: 1 }, ...railEvents] }) });
  game.loop(3, [message(breaker, OP.SHOT_REQUEST, shot(0, 1, { power: 100 }))]);
  // The push-out touches the 3 and nothing more.
  game.nk.sim.push({ reply: simReply({ final: table, events: [{ t: 0.2, type: 'first_contact', ball: 3 }] }) });
  game.loop(4, [message(pusher, OP.SHOT_REQUEST, shot(1, 1, { power: 20, pushOut: true }))]);
  const pushed = game.out().filter((m) => m.op === OP.SHOT_RESULT).at(-1)!.header;
  assert.deepEqual(pushed.ruling.messages, [{ code: 'PUSH_OUT_PENDING' }]);
  assert.equal(pushed.nextTurn.seat, game.seat, 'the breaker answers');
  game.clear();

  // While the push-out waits, the answer is a choice, not a shot.
  game.loop(5, [message(breaker, OP.SHOT_REQUEST, shot(2, 2, { power: 20 }))]);
  game.loop(6, [choose(pusher, 2, false)]);       // not the pusher's turn
  game.loop(7, [choose(breaker, 1, false)]);      // an old turn id
  game.loop(8, [message(breaker, OP.PUSH_OUT_CHOICE, { turnId: 2 })]);
  assert.deepEqual(rejected(), [
    { seq: 2, reason: 'PUSH_OUT_PENDING' },
    { seq: null, reason: 'NO_CHOICE_PENDING' },
    { seq: null, reason: 'NO_CHOICE_PENDING' },
    { seq: null, reason: 'BAD_MESSAGE' },
  ]);
  game.clear();

  // The breaker passes: the pusher shoots again.
  game.loop(20, [choose(breaker, 2, false)]);
  const out = game.out();
  assert.deepEqual(out.map((m) => [m.op, m.to]), [[OP.SHOT_RESULT, null]]);
  const { header, payload } = out[0];
  assert.deepEqual(decodeTrajectory(payload!), []);
  assert.equal(header.kind, 'choice');
  assert.equal(header.turnId, 2);
  assert.equal(header.seq, null);
  assert.equal(header.seat, game.seat);
  assert.equal(header.shot, null);
  assert.deepEqual(header.events, []);
  assert.deepEqual(header.final, header.table);
  assert.deepEqual(header.ruling.messages, [{ code: 'PUSH_OUT_PASSED', params: { seat: 1 - game.seat } }]);
  assert.deepEqual(header.ruling.fouls, []);
  assert.equal(header.match.mode.pushOut.pending, false);
  assert.deepEqual(header.nextTurn, { seat: 1 - game.seat, turnId: 3, deadlineInMs: 45000 });
  assert.equal(game.state.deadlineTick, 20 + 450);
  assert.deepEqual(game.state.decisions.map((d) => d.kind), ['shot', 'shot', 'choice'], 'a choice is a decision, not a shot');

  game.clear();
  game.loop(21, [choose(breaker, 3, true)]);
  assert.deepEqual(rejected(), [{ seq: null, reason: 'NO_CHOICE_PENDING' }]);
});
