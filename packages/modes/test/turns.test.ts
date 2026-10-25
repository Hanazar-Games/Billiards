// Turn order for 1×1, 2×2 and free-for-all (spec §7.2, D013).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTurnState, endTurn, removeSeat, activeTeams, type TurnState } from '../src/index.ts';

const order = (t: TurnState, n: number) => {
  const seats = [t.currentSeat];
  for (let i = 0; i < n; i++) { t = endTurn(t); seats.push(t.currentSeat); }
  return seats;
};

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object') {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
};

test('1×1 alterna 0, 1, 0', () => assert.deepEqual(order(createTurnState({ kind: '1v1' }), 2), [0, 1, 0]));

test('2×2: ordem A1, B1, A2, B2, A1', () => assert.deepEqual(order(createTurnState({ kind: '2v2' }), 4), [0, 1, 2, 3, 0]));

test('cada um por si com 5 lugares pula os eliminados', () =>
  assert.deepEqual(order(removeSeat(removeSeat(createTurnState({ kind: 'ffa', seats: 5 }), 2), 3), 3), [0, 1, 4, 0]));

test('2×2: o parceiro assume quando um lugar sai', () =>
  assert.deepEqual(order(removeSeat(createTurnState({ kind: '2v2' }), 2), 4), [0, 1, 0, 3, 0]));

test('quem sai na vez passa a vez; equipe sem lugar ativo sai da ordem', () => {
  const t = removeSeat(createTurnState({ kind: '1v1' }), 0);
  assert.equal(t.currentSeat, 1);
  assert.deepEqual(activeTeams(t), [1]);
});

test('2×2: o parceiro assume a vez de quem sai na vez', () =>
  assert.equal(removeSeat(createTurnState({ kind: '2v2' }), 0).currentSeat, 2));

test('as funções não alteram o estado recebido', () => {
  const t = deepFreeze(createTurnState({ kind: '2v2' }));
  const before = JSON.stringify(t);
  endTurn(t);
  removeSeat(t, 0);
  removeSeat(t, 3);
  assert.equal(JSON.stringify(t), before);
});

test('ffa fora de 3..5 lugares é RangeError', () => {
  assert.throws(() => createTurnState({ kind: 'ffa', seats: 6 }), RangeError);
  assert.throws(() => createTurnState({ kind: 'ffa', seats: 2 }), RangeError);
});
