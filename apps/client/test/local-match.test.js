// LocalMatchController: validates, simulates (fake sim client) and decides with packages/modes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LocalMatchController } from '../src/match/LocalMatchController.js';
import { rulingText } from '../src/match/rulingText.js';
import { toTurnResult } from '../src/match/turnResult.js';
import { getTableProfile } from '../src/game/TableProfiles.js';
import { ev } from '../../../packages/modes/test/helpers.ts';

const SHOT = { angle: Math.PI / 2, power: 50, spin: { x: 0, y: 0 } };
const result = (events, final) => ({ frames: [], events, final, steps: 12, simSeconds: 1 / 30, capped: false });

/** Answers each simulate() with the next entry: a SimResult, or a function returning a promise. */
class FakeSim {
  constructor(answers = []) { this.answers = answers; this.calls = []; this.disposed = false; }
  simulate(table, shot) {
    this.calls.push({ table, shot });
    const next = this.answers.shift();
    return typeof next === 'function' ? next(table, shot) : Promise.resolve(next(table));
  }
  warm() {}
  dispose() { this.disposed = true; }
}
const answer = (events) => (table) => result(events, table);

function setup(modeId, answers, options = {}) {
  const sim = new FakeSim(answers);
  const c = new LocalMatchController({ modeId, tableProfile: getTableProfile('pool9ft'), simClient: sim, ...options });
  const layout = c.newRack();
  const table = { tableProfileId: 'pool9ft', balls: layout.map(({ id, x, z }) => ({ id, x, z, pocketed: false })) };
  return { c, sim, table };
}

test('submitShot valida, simula e decide pelo modo', async () => {
  const { c, sim, table } = setup('8ball', [answer(ev({ first: 1, pocketed: [3] }))]);
  const out = await c.submitShot(table, SHOT);
  assert.equal(out.ruling.nextSeat, 0);
  assert.equal(c.status().breakShot, false);
  assert.equal(c.toJSON().turnId, 1);
  assert.equal(sim.calls.length, 1);
  assert.deepEqual(sim.calls[0].shot, { angle: SHOT.angle, power: 50, spin: { x: 0, y: 0 } });
});

test('força 0 não chama o worker e é falta sem contato', async () => {
  const { c, sim, table } = setup('8ball', []);
  const out = await c.submitShot(table, { ...SHOT, power: 0 });
  assert.equal(sim.calls.length, 0);
  assert.deepEqual(out.ruling.fouls, ['NO_BALL_HIT']);
  assert.deepEqual(out.result.frames, []);
  assert.equal(c.status().currentPlayer, 2);
});

test('resultado de tacada abandonada é ignorado', async () => {
  let release;
  const gate = new Promise((res) => { release = res; });
  const { c, table } = setup('8ball', [(t) => gate.then(() => result(ev({ first: 1, pocketed: [3] }), t))]);
  const pending = c.submitShot(table, SHOT);
  c.newRack();
  const fresh = JSON.stringify(c.toJSON());
  release();
  await assert.rejects(pending, (err) => err.stale === true);
  assert.equal(JSON.stringify(c.toJSON()), fresh);
});

test('worker que não responde: o tempo esgota e nada é aplicado', async () => {
  const { c, sim, table } = setup('8ball', [() => new Promise(() => {}), answer(ev({ first: 1, pocketed: [3] }))], { simTimeoutMs: 50 });
  const before = JSON.stringify(c.toJSON());
  await assert.rejects(c.submitShot(table, SHOT), /simulation timed out/);
  assert.equal(sim.disposed, true);
  assert.equal(JSON.stringify(c.toJSON()), before);
  const out = await c.submitShot(table, SHOT);
  assert.equal(out.ruling.nextSeat, 0);
});

test('push-out declarado sobrevive a uma tacada que falha', async () => {
  const { c, table } = setup('9ball', [answer(ev({ first: 1, pocketed: [2] })), () => Promise.reject(new Error('boom'))]);
  await c.submitShot(table, SHOT);
  assert.equal(c.status().pushOutAvailable, true);
  await assert.rejects(c.submitShot(table, { ...SHOT, pushOut: true }), /boom/);
  assert.equal(c.status().pushOutAvailable, true);
  assert.equal(c.status().currentPlayer, 1);
});

test('bola na mão fora da cozinha é recusada sem chamar o worker', async () => {
  const { c, sim, table } = setup('8ball', [answer(ev({ cue: true }))]);
  await c.submitShot(table, SHOT);                                  // break scratch: ball in hand in the kitchen for player 2
  assert.deepEqual(c.status().ballInHand, { player: 2, kitchen: true });
  await assert.rejects(c.submitShot(table, { ...SHOT, cueBall: { x: 0, z: 0 } }),
    (err) => err.rejected === true && err.reason === 'CUE_BALL_OUTSIDE_KITCHEN');
  assert.equal(sim.calls.length, 1);
});

test('bola na mão: a branca vai para shot.cueBall na mesa simulada', async () => {
  const { c, sim, table } = setup('8ball', [answer(ev({ cue: true })), answer(ev({ first: 2, cushions: [2] }))]);
  await c.submitShot(table, SHOT);
  const scratched = { ...table, balls: table.balls.map((b) => (b.id === 0 ? { ...b, pocketed: true } : b)) };
  const out = await c.submitShot(scratched, { ...SHOT, cueBall: { x: 0, z: -100 } });
  const cue = sim.calls[1].table.balls.find((b) => b.id === 0);
  assert.deepEqual([cue.x, cue.z, cue.pocketed], [0, -100, false]);
  assert.deepEqual(out.initial, sim.calls[1].table);
});

test('toJSON e restore reproduzem o status (LAN)', async () => {
  const { c, table } = setup('8ball', [answer(ev({ first: 1, pocketed: [3] }))]);
  await c.submitShot(table, SHOT);
  const guest = new LocalMatchController({ modeId: '8ball', tableProfile: getTableProfile('pool9ft'), simClient: new FakeSim() });
  guest.restore(JSON.parse(JSON.stringify(c.toJSON())));
  assert.deepEqual(guest.status(), c.status());
});

test('tempo esgotado e desistência', () => {
  const { c } = setup('8ball', []);
  c.timeout();
  assert.equal(c.status().currentPlayer, 2);
  assert.deepEqual(c.status().ballInHand, { player: 2, kitchen: false });
  c.concede(0);
  assert.equal(c.status().gameOver, true);
  assert.equal(c.status().winner, 2);
});

test('rulingText dá o mesmo texto de hoje', () => {
  const names = ['P1', 'P2'];
  assert.equal(rulingText('8ball', [{ code: 'POCKETED', params: { count: 2 } }], names), '打进 2 颗球！继续击球。');
  assert.match(rulingText('9ball', [{ code: 'THREE_FOUL_WARNING' }, { code: 'FOUL', params: { reason: 'SCRATCH' } }], names), /已连续两次犯规/);
  assert.equal(rulingText('8ball', [{ code: 'BREAK_FOUL', params: { reason: 'SCRATCH' } }], names), '开球犯规：白球落袋！对手获得开球线后自由球');
  assert.equal(rulingText('9ball', [{ code: 'BREAK_FOUL', params: { reason: 'WRONG_FIRST_HIT' } }], names), '开球犯规：必须先碰到1号球！对手获得自由球');
  assert.equal(rulingText('9ball', [{ code: 'NINE_ON_FOUL_RESPOT', params: { reason: 'NO_RAIL_AFTER_CONTACT' } }], names), '犯规：9号球进袋（已摆回）。对手获得自由球。');
  assert.equal(rulingText('9ball', [{ code: 'THREE_FOUL_LOSS', params: { seat: 0 } }], names), '玩家 1 连续三次犯规，判负！');
  assert.equal(rulingText('8ball', [{ code: 'TIMEOUT', params: { seat: 0, next: 1 } }], names), '⏰ 回合超时！P1 犯规，P2 获得自由球');
  const codes = ['BREAK_FOUL', 'ILLEGAL_BREAK', 'BREAK_NO_POCKET', 'BREAK_LEGAL', 'EIGHT_ON_BREAK_RESPOT', 'EARLY_EIGHT', 'LEGAL_EIGHT_WIN',
    'NINE_ON_BREAK_WIN', 'LEGAL_NINE_WIN', 'NINE_ON_FOUL_RESPOT', 'FOUL', 'NO_POCKET', 'POCKETED', 'PUSH_OUT_PENDING', 'PUSH_OUT_ACCEPTED',
    'PUSH_OUT_PASSED', 'THREE_FOUL_WARNING', 'THREE_FOUL_LOSS', 'TIMEOUT'];
  for (const code of codes) {
    const params = { reason: 'SCRATCH', count: 1, seat: 0, next: 1 };
    assert.ok(rulingText('8ball', [{ code, params }], names) || rulingText('9ball', [{ code, params }], names), code);
  }
});

test('toTurnResult converte a decisão para o formato do resolveTurn', async () => {
  const { c, table } = setup('8ball', [answer(ev({ cue: true }))]);
  const { ruling } = await c.submitShot(table, SHOT);
  const r = toTurnResult('8ball', ruling, c.status(), ['P1', 'P2']);
  assert.deepEqual(
    { nextPlayer: r.nextPlayer, foul: r.foul, scratch: r.scratch, ballInHand: r.ballInHand, ballInHandBehindLine: r.ballInHandBehindLine, reasonCode: r.reasonCode, gameOver: r.gameOver },
    { nextPlayer: 2, foul: true, scratch: true, ballInHand: true, ballInHandBehindLine: true, reasonCode: 'SCRATCH', gameOver: false });
  assert.equal(r.message, '开球犯规：白球落袋！对手获得开球线后自由球');
});

test('resolveEvents decide a tacada a partir dos eventos e aplica a decisão', () => {
  const { c } = setup('9ball', []);
  c.match = { ...c.match, mode: { ...c.match.mode, breakShot: false } };
  const ruling = c.resolveEvents(ev({ first: 1, pocketed: [9] }));
  assert.equal(ruling.winnerTeam, 0);
  assert.equal(c.status().gameOver, true);
  assert.equal(c.toJSON().turnId, 1);
});
