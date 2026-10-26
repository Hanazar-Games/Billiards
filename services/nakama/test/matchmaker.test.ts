// matchmakerMatched with a fake nk: only same-mode, valid 1×1 pairs create a match.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchmakerMatched } from '../src/matchmaker.ts';

const logger = { debug() {}, info() {}, warn() {}, error() {} };
const ctx = { env: {}, executionMode: 'matchmaker' };
const entry = (userId: string, properties: Record<string, unknown>) =>
  ({ properties, presence: { userId, sessionId: `s-${userId}`, username: userId, node: 'n' } });

function fakeNk() {
  const created: Record<string, unknown>[] = [];
  return { nk: { matchCreate: (_m: string, params: Record<string, unknown>) => { created.push(params); return 'match-1'; } } as any, created };
}

test('propriedades iguais e válidas criam a partida', () => {
  const { nk, created } = fakeNk();
  const id = matchmakerMatched(ctx, logger, nk, [entry('a', { mode: '9ball', format: '1v1' }), entry('b', { mode: '9ball', format: '1v1' })]);
  assert.equal(id, 'match-1');
  assert.deepEqual(created, [{ mode: '9ball', format: '1v1', private: false }]);
});

test('propriedades misturadas ou forjadas não criam partida', () => {
  const { nk, created } = fakeNk();
  for (const pair of [
    [entry('a', { mode: '8ball', format: '1v1' }), entry('b', { mode: '9ball', format: '1v1' })],
    [entry('a', { mode: 'xyz', format: '1v1' }), entry('b', { mode: 'xyz', format: '1v1' })],
    [entry('a', { mode: '8ball', format: '2v2' }), entry('b', { mode: '8ball', format: '2v2' })],
    [],
  ]) assert.equal(matchmakerMatched(ctx, logger, nk, pair), undefined);
  assert.equal(created.length, 0);
});
