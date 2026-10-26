// F4-02: message intake — rate limit, sender, reading, relays and the refusals of
// a shot_request, with the invalid-shot count that removes a connection.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OP } from '@billiards/protocol';
import { message, presence, startedGame } from './fakes.ts';

const shot = (turnId: number, seq: number, extra: Record<string, unknown> = {}) =>
  ({ turnId, seq, angle: 0.5, power: 50, spin: { x: 0, y: 0 }, ...extra });

/** [op, body, userIds it went to] of everything sent. */
const sentSummary = (game: ReturnType<typeof startedGame>) =>
  game.out().map((m) => [m.op, m.body ?? null, m.to ? m.to.map((p) => p.sessionId) : null]);

test('tacada fora do turno → shot_rejected NOT_YOUR_TURN', () => {
  const game = startedGame();
  game.loop(1, [message(game.waiter, OP.SHOT_REQUEST, shot(0, 3))]);
  assert.deepEqual(sentSummary(game), [[OP.SHOT_REJECTED, { seq: 3, reason: 'NOT_YOUR_TURN' }, [game.waiter.sessionId]]]);
});

test('números não finitos → shot_rejected BAD_MESSAGE', () => {
  // Node reads 1e999 as Infinity and the shot reader refuses it (seq 1); goja's JSON.parse throws on it
  // (seq null, like 'not json'), which the integration test checks.
  const game = startedGame();
  game.loop(1, [message(game.shooter, OP.SHOT_REQUEST, '{"turnId":0,"seq":1,"angle":1e999,"power":10,"spin":{"x":0,"y":0}}')]);
  game.loop(2, [message(game.shooter, OP.SHOT_REQUEST, shot(0, 2, { power: 2e6 }))]);
  game.loop(3, [message(game.shooter, OP.SHOT_REQUEST, 'not json')]);
  game.loop(4, [message(game.shooter, OP.SHOT_REQUEST, shot(0, -1))]);
  assert.deepEqual(sentSummary(game), [
    [OP.SHOT_REJECTED, { seq: 1, reason: 'BAD_MESSAGE' }, [game.shooter.sessionId]],
    [OP.SHOT_REJECTED, { seq: 2, reason: 'BAD_MESSAGE' }, [game.shooter.sessionId]],
    [OP.SHOT_REJECTED, { seq: null, reason: 'BAD_MESSAGE' }, [game.shooter.sessionId]],
    [OP.SHOT_REJECTED, { seq: null, reason: 'BAD_MESSAGE' }, [game.shooter.sessionId]],
  ]);
});

test('turnId antigo → TURN_MISMATCH; bola na mão sem direito → CUE_BALL_NOT_ALLOWED', () => {
  const game = startedGame();
  game.state.match!.turnId = 1;
  game.loop(1, [message(game.shooter, OP.SHOT_REQUEST, shot(0, 1))]);
  game.loop(2, [message(game.shooter, OP.SHOT_REQUEST, shot(1, 2, { cueBall: { x: 0, z: -80 } }))]);
  const rejected = game.out().filter((m) => m.op === OP.SHOT_REJECTED).map((m) => m.body);
  assert.deepEqual(rejected, [{ seq: 1, reason: 'TURN_MISMATCH' }, { seq: 2, reason: 'CUE_BALL_NOT_ALLOWED' }]);
});

test('TURN_MISMATCH também manda um snapshot ao remetente, que acerta o turnId (D058)', () => {
  const game = startedGame();
  game.state.match!.turnId = 4;
  game.loop(1, [message(game.shooter, OP.SHOT_REQUEST, shot(3, 9))]);
  const out = game.out();
  assert.deepEqual(out.map((m) => [m.op, m.to!.map((p) => p.sessionId)]),
    [[OP.SHOT_REJECTED, [game.shooter.sessionId]], [OP.MATCH_SNAPSHOT, [game.shooter.sessionId]]]);
  assert.deepEqual(out[0].body, { seq: 9, reason: 'TURN_MISMATCH' });
  assert.equal(out[1].header.turnId, 4);
  assert.equal(out[1].header.turn.turnId, 4);
  assert.equal(out[1].header.you.seat, game.seat);
});

test('as recusas seguem a ordem: fase, vez, turnId e as regras do modo sobre a tacada quantizada', () => {
  const game = startedGame();
  game.state.match!.turnId = 2;
  game.loop(1, [message(game.waiter, OP.SHOT_REQUEST, shot(0, 1))]);                     // not your turn before the turn id
  game.loop(2, [message(game.shooter, OP.SHOT_REQUEST, shot(2, 2, { power: 110.01 }))]); // above SHOT.maxPower
  game.loop(3, [message(game.shooter, OP.SHOT_REQUEST, shot(2, 3, { power: 110.0004 }))]); // quantized to 110: accepted
  game.state.phase = 'ENDED';
  game.loop(4, [message(game.shooter, OP.SHOT_REQUEST, shot(2, 4))]);
  const rejected = game.out().filter((m) => m.op === OP.SHOT_REJECTED).map((m) => m.body);
  assert.deepEqual(rejected, [
    { seq: 1, reason: 'NOT_YOUR_TURN' },
    { seq: 2, reason: 'BAD_INPUT' },
    { seq: 4, reason: 'NOT_AWAITING_SHOT' },
  ]);
});

test('branca sobre outra bola com bola na mão → CUE_BALL_INVALID; num lugar livre passa', () => {
  const game = startedGame();
  game.state.match!.mode.ballInHand = { seat: game.seat, zone: 'anywhere' };
  const one = game.state.table!.balls.find((b) => b.id === 1)!;
  game.loop(1, [message(game.shooter, OP.SHOT_REQUEST, shot(0, 1, { cueBall: { x: one.x + 1.001234, z: one.z } }))]);
  game.loop(2, [message(game.shooter, OP.SHOT_REQUEST, shot(0, 2, { cueBall: { x: 20, z: -80 } }))]);
  assert.deepEqual(sentSummary(game).slice(0, 2), [
    [OP.SHOT_REJECTED, { seq: 1, reason: 'CUE_BALL_INVALID' }, [game.shooter.sessionId]],
    [OP.SHOT_ACCEPTED, { turnId: 0, seq: 2, seat: game.seat, shot: { angle: 0.5, power: 50, spin: { x: 0, y: 0 }, cueBall: { x: 20, z: -80 } } }, null],
  ]);
  assert.deepEqual(game.state.invalid[game.shooter.userId], [1], 'CUE_BALL_INVALID counts as an invalid shot');
});

test('bola na mão na cozinha: a linha da cabeceira vale, já quantizada (−69,85); −69,84 fica fora', () => {
  const game = startedGame();
  game.state.match!.mode.ballInHand = { seat: game.seat, zone: 'kitchen' };
  const headString = -254 / 2 * 0.55;   // −69.85000000000001, which quantizes to −69.85, just above it
  game.loop(1, [message(game.shooter, OP.SHOT_REQUEST, shot(0, 1, { power: 0, cueBall: { x: 20, z: -69.84 } }))]);
  game.loop(2, [message(game.shooter, OP.SHOT_REQUEST, shot(0, 2, { power: 0, cueBall: { x: 20, z: headString } }))]);
  assert.deepEqual(sentSummary(game).slice(0, 2), [
    [OP.SHOT_REJECTED, { seq: 1, reason: 'CUE_BALL_OUTSIDE_KITCHEN' }, [game.shooter.sessionId]],
    [OP.SHOT_ACCEPTED, { turnId: 0, seq: 2, seat: game.seat, shot: { angle: 0.5, power: 0, spin: { x: 0, y: 0 }, cueBall: { x: 20, z: -69.85 } } }, null],
  ]);
});

test('mais de 5 inválidas em 10 s derrubam a conexão', () => {
  const game = startedGame();
  for (const tick of [0, 3, 6, 9, 12]) game.loop(tick, [message(game.waiter, OP.SHOT_REQUEST, shot(0, tick))]);
  assert.deepEqual(game.dispatcher.kicked, []);
  game.loop(15, [message(game.waiter, OP.SHOT_REQUEST, shot(0, 15))]);
  assert.equal(game.out().filter((m) => m.op === OP.SHOT_REJECTED).length, 6);
  assert.deepEqual(game.dispatcher.kicked, [game.waiter]);
  assert.deepEqual(game.state.invalid[game.waiter.userId] ?? [], [], 'the count starts over');
});

test('6 inválidas em 12 s não derrubam; 6 no mesmo segundo derrubam só 5 (a sexta é descartada pelo ritmo)', () => {
  const spread = startedGame();
  for (const tick of [0, 24, 48, 72, 96, 120]) spread.loop(tick, [message(spread.waiter, OP.SHOT_REQUEST, shot(0, tick))]);
  assert.equal(spread.out().filter((m) => m.op === OP.SHOT_REJECTED).length, 6);
  assert.deepEqual(spread.dispatcher.kicked, []);

  const burst = startedGame();
  burst.loop(200, [0, 1, 2, 3, 4, 5].map((seq) => message(burst.waiter, OP.SHOT_REQUEST, shot(0, seq))));
  assert.deepEqual(burst.out().filter((m) => m.op === OP.SHOT_REJECTED).map((m) => m.body.seq), [0, 1, 2, 3, 4]);
  assert.deepEqual(burst.dispatcher.kicked, []);
  assert.equal(burst.state.invalid[burst.waiter.userId].length, 5);
});

test('reenvio do último (turnId, seq) aceito responde com snapshot e não conta como inválida', () => {
  const game = startedGame();
  game.state.lastAccepted[game.seat] = { turnId: 0, seq: 7 };
  game.state.match!.turnId = 1;
  for (let i = 0; i < 7; i++) game.loop(i * 10, [message(game.shooter, OP.SHOT_REQUEST, shot(0, 7))]);
  const out = game.out();
  assert.equal(out.length, 7);
  for (const m of out) {
    assert.equal(m.op, OP.MATCH_SNAPSHOT);
    assert.deepEqual(m.to!.map((p) => p.sessionId), [game.shooter.sessionId]);
    assert.equal(m.header.turnId, 1);
  }
  assert.deepEqual(game.dispatcher.kicked, []);
  assert.equal(game.state.invalid[game.shooter.userId], undefined);
  game.clear();
  game.loop(100, [message(game.shooter, OP.SHOT_REQUEST, shot(0, 8))]);   // another seq is not a resend
  assert.deepEqual(game.out().filter((m) => m.op === OP.SHOT_REJECTED).map((m) => m.body), [{ seq: 8, reason: 'TURN_MISMATCH' }]);
});

test('aim_update do lugar da vez chega ao outro como 102 com seat; de quem não é a vez, não chega', () => {
  const game = startedGame();
  const aim = { turnId: 0, angle: 1.25, spin: { x: 0.1, y: -0.2 }, power: 30, extra: 'dropped' };
  game.loop(1, [message(game.shooter, OP.AIM_UPDATE, aim)]);
  game.loop(2, [message(game.waiter, OP.AIM_UPDATE, aim)]);
  game.loop(3, [message(game.shooter, OP.AIM_UPDATE, { ...aim, turnId: 1 })]);
  game.loop(4, [message(game.shooter, OP.AIM_UPDATE, { ...aim, angle: 'x' })]);
  game.loop(5, [message(game.shooter, OP.BALL_IN_HAND_MOVE, { turnId: 0, x: 1.5, z: -80 })]);
  game.loop(6, [message(game.waiter, OP.BALL_IN_HAND_MOVE, { turnId: 0, x: 1.5, z: -80 })]);
  assert.deepEqual(sentSummary(game), [
    [OP.AIM_RELAY, { seat: game.seat, turnId: 0, angle: 1.25, spin: { x: 0.1, y: -0.2 }, power: 30 }, [game.waiter.sessionId]],
    [OP.BALL_IN_HAND_RELAY, { seat: game.seat, turnId: 0, x: 1.5, z: -80 }, [game.waiter.sessionId]],
  ]);
  assert.equal(game.state.invalid[game.waiter.userId], undefined, 'a dropped relay is not an invalid shot');
});

test('16 aim_update no mesmo segundo: só 15 retransmitidos', () => {
  const game = startedGame();
  const aim = (angle: number) => message(game.shooter, OP.AIM_UPDATE, { turnId: 0, angle, spin: { x: 0, y: 0 } });
  game.loop(10, Array.from({ length: 8 }, (_, i) => aim(i)));
  game.loop(15, Array.from({ length: 8 }, (_, i) => aim(8 + i)));
  // The other messages have their own budget in the same second.
  game.loop(19, [message(game.shooter, OP.SHOT_REQUEST, shot(5, 1))]);
  assert.deepEqual(game.out().filter((m) => m.op === OP.AIM_RELAY).map((m) => m.body.angle), [...Array(15).keys()]);
  assert.equal(game.out().filter((m) => m.op === OP.SHOT_REJECTED).length, 1);
  game.clear();
  game.loop(20, [aim(16)]);   // the next second
  assert.deepEqual(game.out().map((m) => m.body.angle), [16]);
});

test('mensagem da sessão antiga de um jogador é ignorada', () => {
  const game = startedGame();
  const newTab = presence(game.shooter.userId, 's-new');
  game.join([newTab], 1);
  game.clear();
  game.loop(2, [message(game.shooter, OP.AIM_UPDATE, { turnId: 0, angle: 1, spin: { x: 0, y: 0 } })]);
  game.loop(3, [message(game.shooter, OP.SHOT_REQUEST, 'not json')]);
  game.loop(4, [message(presence('stranger'), OP.SHOT_REQUEST, shot(0, 1))]);
  assert.deepEqual(game.out(), []);
  game.loop(5, [message(newTab, OP.AIM_UPDATE, { turnId: 0, angle: 1, spin: { x: 0, y: 0 } })]);
  assert.deepEqual(game.out().map((m) => m.op), [OP.AIM_RELAY]);
});

test('operações sem conteúdo não são lidas: corpo vazio ou que não é JSON não dá BAD_MESSAGE', () => {
  const game = startedGame();
  game.loop(1, [message(game.waiter, OP.REMATCH_VOTE, ''), message(game.waiter, OP.EMOTE, 'not json')]);
  game.loop(10, [message(game.shooter, 42, '')]);
  game.loop(20, [message(game.shooter, OP.CONCEDE, '')]);   // concede carries no content: it ends the match
  assert.deepEqual(sentSummary(game), [
    [OP.ERROR, { code: 'UNSUPPORTED_OP' }, [game.waiter.sessionId]],
    [OP.ERROR, { code: 'UNSUPPORTED_OP' }, [game.waiter.sessionId]],
    [OP.ERROR, { code: 'UNSUPPORTED_OP' }, [game.shooter.sessionId]],
    [OP.MATCH_END, { winnerTeam: 1 - game.seat, reason: 'CONCEDE', summary: { turns: 1, shots: 0 } }, null],
  ]);
  assert.deepEqual(game.state.invalid, {});
});

test('emote e rematch_vote dão UNSUPPORTED_OP', () => {
  const game = startedGame();
  game.loop(1, [message(game.waiter, OP.EMOTE, { id: 'wave' }), message(game.waiter, OP.REMATCH_VOTE, { yes: true })]);
  game.loop(10, [message(game.shooter, 42, {})]);
  assert.deepEqual(sentSummary(game), [
    [OP.ERROR, { code: 'UNSUPPORTED_OP' }, [game.waiter.sessionId]],
    [OP.ERROR, { code: 'UNSUPPORTED_OP' }, [game.waiter.sessionId]],
    [OP.ERROR, { code: 'UNSUPPORTED_OP' }, [game.shooter.sessionId]],
  ]);
});
