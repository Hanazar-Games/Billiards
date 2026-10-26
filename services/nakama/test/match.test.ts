// The "billiards" match handler in its F3 lobby form, with a fake dispatcher.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { billiardsMatch, beforeListMatches } from '../src/match.ts';
import { REGISTRY } from '../src/registry.ts';

const logger = { debug() {}, info() {}, warn() {}, error() {} };
const ctx = { env: {}, executionMode: 'match' };
const nk = {} as any;
const presence = (userId: string) => ({ userId, sessionId: `s-${userId}`, username: userId, node: 'n' });

function lobby() {
  const labels: string[] = [];
  const dispatcher = { broadcastMessage() {}, matchLabelUpdate: (l: string) => labels.push(l) };
  const { state, tickRate, label } = billiardsMatch.matchInit(ctx, logger, nk, { mode: '8ball', format: '1v1', code: 'ABC234', private: true });
  return { state, tickRate, label, labels, dispatcher };
}

test('o rótulo traz modo, formato, código e a sala aberta', () => {
  const { label, tickRate } = lobby();
  assert.deepEqual(JSON.parse(label), { mode: '8ball', format: '1v1', code: 'ABC234', private: true, open: true });
  assert.equal(tickRate, 1);
});

test('entra até lotar e depois ROOM_FULL', () => {
  const { state, dispatcher } = lobby();
  for (const id of ['a', 'b']) {
    assert.equal(billiardsMatch.matchJoinAttempt(ctx, logger, nk, dispatcher, 0, state, presence(id), {})!.accept, true);
    billiardsMatch.matchJoin(ctx, logger, nk, dispatcher, 0, state, [presence(id)]);
  }
  assert.deepEqual(billiardsMatch.matchJoinAttempt(ctx, logger, nk, dispatcher, 0, state, presence('c'), {}),
    { state, accept: false, rejectMessage: 'ROOM_FULL' });
  assert.equal(billiardsMatch.matchJoinAttempt(ctx, logger, nk, dispatcher, 0, state, presence('a'), {})!.accept, true);   // the same player again
});

test('lotada, o rótulo fecha; quando alguém sai, abre de novo', () => {
  const { state, dispatcher, labels } = lobby();
  billiardsMatch.matchJoin(ctx, logger, nk, dispatcher, 0, state, [presence('a'), presence('b')]);
  assert.equal(JSON.parse(labels.at(-1)!).open, false);
  billiardsMatch.matchLeave(ctx, logger, nk, dispatcher, 1, state, [presence('b')]);
  assert.equal(JSON.parse(labels.at(-1)!).open, true);
});

test('termina depois de 60 ticks vazia', () => {
  const { state, dispatcher } = lobby();
  for (let tick = 1; tick < 60; tick++) assert.ok(billiardsMatch.matchLoop(ctx, logger, nk, dispatcher, tick, state, []), `tick ${tick}`);
  assert.equal(billiardsMatch.matchLoop(ctx, logger, nk, dispatcher, 60, state, []), null);
});

test('alguém na sala zera a contagem de ticks vazios', () => {
  const { state, dispatcher } = lobby();
  for (let tick = 1; tick < 50; tick++) billiardsMatch.matchLoop(ctx, logger, nk, dispatcher, tick, state, []);
  billiardsMatch.matchJoin(ctx, logger, nk, dispatcher, 50, state, [presence('a')]);
  billiardsMatch.matchLeave(ctx, logger, nk, dispatcher, 51, state, [presence('a')]);
  for (let tick = 52; tick < 100; tick++) assert.ok(billiardsMatch.matchLoop(ctx, logger, nk, dispatcher, tick, state, []), `tick ${tick}`);
});

test('a saída da conexão antiga não libera o lugar da nova', () => {
  const { state, dispatcher, labels } = lobby();
  const oldTab = presence('a');
  const newTab = { ...presence('a'), sessionId: 's-a-2' };
  billiardsMatch.matchJoin(ctx, logger, nk, dispatcher, 0, state, [oldTab, presence('b')]);
  billiardsMatch.matchJoin(ctx, logger, nk, dispatcher, 1, state, [newTab]);
  billiardsMatch.matchLeave(ctx, logger, nk, dispatcher, 2, state, [oldTab]);
  assert.equal(Object.keys(state.presences).length, 2);
  assert.equal(JSON.parse(labels.at(-1)!).open, false);
  assert.deepEqual(billiardsMatch.matchJoinAttempt(ctx, logger, nk, dispatcher, 3, state, presence('c'), {}),
    { state, accept: false, rejectMessage: 'ROOM_FULL' });
});

test('a listagem de partidas pelo cliente é recusada (salas privadas ficam escondidas)', () => {
  assert.equal(REGISTRY.before.ListMatches, beforeListMatches);
  assert.throws(() => beforeListMatches(ctx, logger, nk, { query: '+label.private:true' }), /MATCH_LISTING_DISABLED/);
});
