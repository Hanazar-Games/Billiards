// F4-09: the online match controller — the LocalMatchController's interface,
// driven by the server's messages (docs/protocol.md), with a fake session.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OP, encodeTrajectory } from '@billiards/protocol';
import { MODES, createMatch, rackTable, applyRuling } from '@billiards/modes';
import { simulateShot } from '@billiards/sim';
import { OnlineMatchController } from '../src/match/OnlineMatchController.js';
import { LocalMatchController } from '../src/match/LocalMatchController.js';
import { matchStatus } from '../src/match/matchStatus.js';
import { getTableProfile } from '../src/game/TableProfiles.js';
import { BALL, SHOT } from '../src/config.js';

const profile = getTableProfile('pool9ft');
const config = { format: { kind: '1v1' }, table: { width: profile.width, depth: profile.depth, ballRadius: BALL.radius }, maxPower: SHOT.maxPower };

class FakeSession extends EventTarget {
  constructor() { super(); this.sent = []; }
  send(op, body) { this.sent.push({ op, body }); }
  deliver(op, fields) { this.dispatchEvent(new CustomEvent('message', { detail: { op, ...fields } })); }
}

function setup({ localSeat = 0, turnSeat = 0, modeId = '8ball', now = () => 1000 } = {}) {
  const session = new FakeSession();
  const controller = new OnlineMatchController({ session, matchId: 'm1', modeId, tableProfile: profile, now });
  const match = createMatch(MODES[modeId], config, () => 0.5, turnSeat);
  const table = rackTable(MODES[modeId].rackLayout(match.mode), 'pool9ft');
  const snapshot = (over = {}) => ({
    protocolVersion: 1, simVersion: 1, mode: modeId, format: '1v1', phase: 'AWAITING_SHOT', you: { seat: localSeat },
    seats: [{ seat: 0, userId: 'a', username: 'ana', connected: true, timeouts: 0 }, { seat: 1, userId: 'b', username: 'bia', connected: true, timeouts: 0 }],
    turnId: match.turnId, match, table, turn: { seat: turnSeat, turnId: match.turnId, deadlineInMs: 45000 }, playback: null, end: null, ...over,
  });
  return { session, controller, match, table, snapshot };
}

/** A real shot from the rack: the break. */
function breakResult(table) {
  const shot = { angle: Math.PI / 2, power: 80, spin: { x: 0, y: 0 } };
  const sim = simulateShot(table, shot);
  return { shot, sim, payload: encodeTrajectory(sim.frames) };
}

function resultHeader({ match, table, seat, turnId, seq, shot, sim, kind = 'shot' }) {
  const ruling = MODES['8ball'].resolveShot(match.mode, seat, sim?.events ?? [], sim?.final ?? table, shot ?? { angle: 0, power: 0, spin: { x: 0, y: 0 } });
  const next = applyRuling(match, ruling);
  return {
    kind, turnId, seq, seat, shot, events: sim?.events ?? [], final: sim?.final ?? table, table: sim?.final ?? table,
    ruling: { fouls: ruling.fouls, ballInHand: ruling.ballInHand, nextSeat: ruling.nextSeat, winnerTeam: ruling.winnerTeam, respot: ruling.respot, messages: ruling.messages },
    match: next, durationMs: Math.ceil((sim?.simSeconds ?? 0) * 10) * 100, capped: false,
    nextTurn: { seat: ruling.nextSeat, turnId: next.turnId, deadlineInMs: 50000 },
  };
}

test('o primeiro snapshot define o lugar local, a mesa oficial e o prazo', async () => {
  const { session, controller, snapshot, table } = setup({ localSeat: 1, turnSeat: 0 });
  const ready = controller.whenReady();
  session.deliver(OP.MATCH_SNAPSHOT, { header: snapshot(), payload: encodeTrajectory([]) });
  await ready;
  assert.equal(controller.localSeat, 1);
  assert.equal(controller.seat, 0);
  assert.deepEqual(controller.table, table);
  assert.equal(controller.deadlineMs(), 44500);
  assert.equal(controller.online, true);
  assert.deepEqual(controller.newRack().map((b) => b.id), table.balls.map((b) => b.id));
});

test('a tacada local resolve com o shot_result do mesmo turnId e seq', async () => {
  const { session, controller, snapshot, match, table } = setup();
  session.deliver(OP.MATCH_SNAPSHOT, { header: snapshot() });
  const { shot, sim, payload } = breakResult(table);
  const request = controller.submitShot(table, shot);
  assert.deepEqual(session.sent, [{ op: OP.SHOT_REQUEST, body: { turnId: match.turnId, seq: 1, angle: shot.angle, power: shot.power, spin: shot.spin } }]);
  const header = resultHeader({ match, table, seat: 0, turnId: match.turnId, seq: 1, shot, sim });
  session.deliver(OP.SHOT_RESULT, { header, payload });
  const { initial, result, ruling, table: official } = await request;
  assert.deepEqual(initial, table);
  assert.equal(result.frames.length, sim.frames.length);
  assert.deepEqual(result.events, sim.events);
  assert.deepEqual(official, header.table);
  assert.deepEqual(ruling.fouls, header.ruling.fouls);
  assert.deepEqual(controller.match, header.match);
  assert.equal(controller.deadlineMs(), 49500);
});

test('shot_rejected do mesmo seq rejeita com rejected e o motivo', async () => {
  const { session, controller, snapshot, table } = setup();
  session.deliver(OP.MATCH_SNAPSHOT, { header: snapshot() });
  const request = controller.submitShot(table, { angle: 0, power: 50, spin: { x: 0, y: 0 } });
  session.deliver(OP.SHOT_REJECTED, { body: { seq: 99, reason: 'NOT_YOUR_TURN' } });
  session.deliver(OP.SHOT_REJECTED, { body: { seq: 1, reason: 'CUE_BALL_INVALID' } });
  await assert.rejects(request, (err) => err.rejected === true && err.reason === 'CUE_BALL_INVALID');
});

test('shot_result de tacada sem pedido pendente vira remoteShot com o initial certo', async () => {
  const { session, controller, snapshot, match, table } = setup({ localSeat: 1, turnSeat: 0 });
  session.deliver(OP.MATCH_SNAPSHOT, { header: snapshot() });
  const { shot, sim, payload } = breakResult(table);
  const placed = { ...shot, cueBall: { x: 10, z: -80 } };
  const remote = [];
  controller.addEventListener('remoteShot', (e) => remote.push(e.detail));
  session.deliver(OP.SHOT_RESULT, { header: resultHeader({ match, table, seat: 0, turnId: match.turnId, seq: 4, shot: placed, sim }), payload });
  assert.equal(remote.length, 1);
  assert.equal(remote[0].seat, 0);
  const cue = remote[0].initial.balls.find((b) => b.id === 0);
  assert.deepEqual([cue.x, cue.z, cue.pocketed], [10, -80, false]);
  assert.equal(remote[0].result.frames.length, sim.frames.length);
});

test('tempo esgotado e escolha de push-out viram eventos', () => {
  const { session, controller, snapshot, match, table } = setup();
  session.deliver(OP.MATCH_SNAPSHOT, { header: snapshot() });
  const seen = [];
  controller.addEventListener('timeout', (e) => seen.push(['timeout', e.detail]));
  controller.addEventListener('choice', (e) => seen.push(['choice', e.detail]));
  session.deliver(OP.SHOT_RESULT, { header: resultHeader({ match, table, seat: 0, turnId: match.turnId, seq: null, shot: null, kind: 'timeout' }), payload: encodeTrajectory([]) });
  session.deliver(OP.SHOT_RESULT, { header: resultHeader({ match, table, seat: 1, turnId: match.turnId + 1, seq: null, shot: null, kind: 'choice' }), payload: encodeTrajectory([]) });
  assert.deepEqual(seen.map(([k]) => k), ['timeout', 'choice']);
  assert.ok(seen[0][1].ruling && seen[0][1].table);
  controller.choosePushOut(true);
  controller.concede(0);
  assert.deepEqual(session.sent, [{ op: OP.PUSH_OUT_CHOICE, body: { turnId: controller.turn.turnId, accept: true } }, { op: OP.CONCEDE, body: undefined }]);
  assert.throws(() => controller.timeout(), /server/);
});

test('queda com a tacada em trânsito: o playback da volta resolve o pedido', async () => {
  const { session, controller, snapshot, match, table } = setup();
  session.deliver(OP.MATCH_SNAPSHOT, { header: snapshot() });
  const { shot, sim, payload } = breakResult(table);
  const request = controller.submitShot(table, shot);
  const header = resultHeader({ match, table, seat: 0, turnId: match.turnId, seq: 1, shot, sim });
  const snaps = [];
  controller.addEventListener('snapshot', (e) => snaps.push(e.detail));
  session.deliver(OP.MATCH_SNAPSHOT, { header: snapshot({ match: header.match, table: header.table, turnId: header.match.turnId, turn: header.nextTurn, playback: { result: header, offsetMs: 1200 } }), payload });
  const { result, table: official } = await request;
  assert.equal(result.frames.length, sim.frames.length);
  assert.deepEqual(official, header.table);
  assert.equal(snaps.length, 1);
  assert.equal(snaps[0].continuing, true);
  assert.equal(session.sent.length, 1);
});

test('queda com a tacada em trânsito: mesmo turnId reenvia o mesmo corpo', async () => {
  const { session, controller, snapshot, table } = setup();
  session.deliver(OP.MATCH_SNAPSHOT, { header: snapshot() });
  controller.submitShot(table, { angle: 1, power: 40, spin: { x: 0, y: 0 } }).catch(() => {});
  session.deliver(OP.MATCH_SNAPSHOT, { header: snapshot() });
  assert.equal(session.sent.length, 2);
  assert.deepEqual(session.sent[1], session.sent[0]);
});

test('queda com a tacada em trânsito: turnId novo rejeita com stale', async () => {
  const { session, controller, snapshot, match, table } = setup();
  session.deliver(OP.MATCH_SNAPSHOT, { header: snapshot() });
  const request = controller.submitShot(table, { angle: 1, power: 40, spin: { x: 0, y: 0 } });
  const moved = { ...match, turnId: match.turnId + 1 };
  const snaps = [];
  controller.addEventListener('snapshot', (e) => snaps.push(e.detail));
  session.deliver(OP.MATCH_SNAPSHOT, { header: snapshot({ match: moved, turnId: moved.turnId, turn: { seat: 1, turnId: moved.turnId, deadlineInMs: 45000 } }) });
  await assert.rejects(request, (err) => err.stale === true);
  assert.equal(snaps[0].continuing, false);
  assert.equal(session.sent.length, 1);
});

test('volta com uma reprodução em curso: o snapshot traz a tacada com o deslocamento', () => {
  const { session, controller, snapshot, match, table } = setup({ localSeat: 1, turnSeat: 0 });
  const { shot, sim, payload } = breakResult(table);
  const header = resultHeader({ match, table, seat: 0, turnId: match.turnId, seq: 1, shot, sim });
  const snaps = [];
  controller.addEventListener('snapshot', (e) => snaps.push(e.detail));
  // A reload: the controller never saw the table before the shot.
  session.deliver(OP.MATCH_SNAPSHOT, { header: snapshot({ match: header.match, table: header.table, turnId: header.match.turnId, turn: header.nextTurn, playback: { result: header, offsetMs: 900 } }), payload });
  const playback = snaps[0].playback;
  assert.equal(playback.offsetMs, 900);
  assert.equal(playback.result.frames.length, sim.frames.length);
  assert.deepEqual(playback.table, header.table);
  // Balls that never move keep their final place; moving ones start where their trajectory starts.
  for (const ball of playback.initial.balls) {
    const first = playback.result.frames.find((f) => f.balls.some((b) => b.id === ball.id))?.balls.find((b) => b.id === ball.id);
    const at = first ?? header.final.balls.find((b) => b.id === ball.id);
    assert.deepEqual([ball.x, ball.z], [at.x, at.z], `ball ${ball.id}`);
  }
});

test('match_end diz se este cliente venceu', () => {
  const ends = [];
  for (const [winnerTeam, reason, expected] of [[1, 'WIN', true], [0, 'CONCEDE', false], [null, 'ABORTED', null]]) {
    const { session, controller, snapshot } = setup({ localSeat: 1 });
    session.deliver(OP.MATCH_SNAPSHOT, { header: snapshot() });
    controller.addEventListener('end', (e) => ends.push(e.detail));
    session.deliver(OP.MATCH_END, { body: { winnerTeam, reason, summary: { turns: 3, shots: 2 } } });
    assert.equal(ends.at(-1).won, expected);
    assert.equal(ends.at(-1).reason, reason);
  }
});

test('o fim antes do primeiro snapshot rejeita o whenReady com o fim', async () => {
  const { session, controller } = setup();
  const ready = controller.whenReady();
  session.deliver(OP.MATCH_END, { body: { winnerTeam: null, reason: 'ABORTED', summary: { turns: 0, shots: 0 } } });
  await assert.rejects(ready, (err) => err.end?.reason === 'ABORTED');
});

test('status() é o mesmo do LocalMatchController para o mesmo estado', () => {
  const local = new LocalMatchController({ modeId: '8ball', tableProfile: profile, simClient: { simulate() {} } });
  assert.deepEqual(matchStatus('8ball', local.match), local.status());
  const { session, controller, snapshot, match } = setup({ localSeat: 1, turnSeat: 1 });
  session.deliver(OP.MATCH_SNAPSHOT, { header: snapshot() });
  assert.deepEqual(controller.status(), matchStatus('8ball', match));
  assert.equal(controller.status().currentPlayer, 2);
});
