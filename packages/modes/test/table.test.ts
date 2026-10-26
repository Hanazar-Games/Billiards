// Authoritative table operations (spec §6, §7.2): rack, ball in hand, respot and
// the ball-in-hand placement check. Pure functions over plain JSON.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  eightBall, createMatch, rackTable, placeCueBall, respotBalls, isCueBallPlacementValid,
  type BallPlacement, type TableGeometry, type TableState,
} from '../src/index.ts';
import { config8, mulberry32 } from './helpers.ts';

const geometry: TableGeometry = config8.table;
const R = geometry.ballRadius;
const FOOT_Z = geometry.depth / 2 * 0.55;
const HEAD_Z = -FOOT_Z;

const tableOf = (balls: { id: number; x: number; z: number; pocketed?: boolean }[]): TableState => ({
  tableProfileId: 'pool9ft',
  balls: balls.map((b) => ({ id: b.id, x: b.x, z: b.z, pocketed: b.pocketed ?? false })),
});
const ballOf = (table: TableState, id: number) => table.balls.find((b) => b.id === id)!;

test('rackTable arruma as 16 bolas do 8-ball em jogo, em ordem de id', () => {
  const layout = eightBall.rackLayout(createMatch(eightBall, config8, mulberry32(1)).mode);
  const table = rackTable(layout, 'pool9ft');
  assert.equal(table.tableProfileId, 'pool9ft');
  assert.deepEqual(table.balls.map((b) => b.id), Array.from({ length: 16 }, (_, i) => i));
  assert.ok(table.balls.every((b) => b.pocketed === false));
  assert.deepEqual([ballOf(table, 0).x, ballOf(table, 0).z], [0, HEAD_Z]);
  // Each ball keeps the place the mode gave it.
  for (const p of layout) assert.deepEqual([ballOf(table, p.id).x, ballOf(table, p.id).z], [p.x, p.z]);
});

test('rackTable não muta o layout nem reaproveita seus objetos', () => {
  const layout: BallPlacement[] = [{ id: 2, x: 5, z: 6 }, { id: 0, x: 1, z: 2 }];
  const before = JSON.stringify(layout);
  const table = rackTable(layout, 'pool9ft');
  assert.equal(JSON.stringify(layout), before);
  assert.deepEqual(table.balls, [{ id: 0, x: 1, z: 2, pocketed: false }, { id: 2, x: 5, z: 6, pocketed: false }]);
  table.balls[0].x = 99;
  assert.equal(layout[1].x, 1);
});

test('placeCueBall põe a branca no ponto e a tira da caçapa sem mexer no resto', () => {
  const table = {
    tableProfileId: 'pool9ft',
    balls: [
      { id: 0, x: 10, z: 20, pocketed: true, q: [0, 0, 0, 1] },
      { id: 1, x: -3, z: 4, pocketed: false, q: [0.1, 0.2, 0.3, 0.9] },
      { id: 8, x: 7, z: 8, pocketed: true, q: [0, 0.5, 0, 0.8] },
    ],
  };
  const before = JSON.stringify(table);
  const placed = placeCueBall(table, { x: -12, z: HEAD_Z });
  assert.equal(JSON.stringify(table), before, 'the input is untouched');
  assert.deepEqual(placed.balls[0], { id: 0, x: -12, z: HEAD_Z, pocketed: false, q: [0, 0, 0, 1] });
  assert.deepEqual(placed.balls.slice(1), table.balls.slice(1));
  assert.equal(placed.tableProfileId, 'pool9ft');
  assert.notEqual(placed, table);
});

test('o 8 encaçapado volta à marca do pé', () => {
  const table = tableOf([{ id: 0, x: 0, z: HEAD_Z }, { id: 3, x: 20, z: 0 }, { id: 8, x: 0, z: 0, pocketed: true }]);
  const out = respotBalls(table, [8], geometry);
  assert.deepEqual(ballOf(out, 8), { id: 8, x: 0, z: FOOT_Z, pocketed: false });
  assert.deepEqual(ballOf(out, 0), ballOf(table, 0));
  assert.deepEqual(ballOf(out, 3), ballOf(table, 3));
  assert.equal(ballOf(table, 8).pocketed, true, 'the input is untouched');
});

test('com a marca ocupada, vai para +2R; com +2R também, para −2R', () => {
  // A ball 2.1R from the spot blocks it (< 2.2R) but not +2R.
  const blockSpot = tableOf([{ id: 1, x: -2.1 * R, z: FOOT_Z }, { id: 8, x: 0, z: 0, pocketed: true }]);
  assert.deepEqual(
    [ballOf(respotBalls(blockSpot, [8], geometry), 8).x, ballOf(respotBalls(blockSpot, [8], geometry), 8).z],
    [2 * R, FOOT_Z],
  );
  // A ball at +R blocks the spot and +2R, but not −2R.
  const blockBoth = tableOf([{ id: 1, x: R, z: FOOT_Z }, { id: 8, x: 0, z: 0, pocketed: true }]);
  assert.deepEqual(
    [ballOf(respotBalls(blockBoth, [8], geometry), 8).x, ballOf(respotBalls(blockBoth, [8], geometry), 8).z],
    [-2 * R, FOOT_Z],
  );
});

test('uma bola exatamente na marca empurra a reposta para +4R (a folga é 2,2R, não 2R)', () => {
  const table = tableOf([{ id: 1, x: 0, z: FOOT_Z }, { id: 8, x: 0, z: 0, pocketed: true }]);
  assert.equal(ballOf(respotBalls(table, [8], geometry), 8).x, 4 * R);
});

test('bolas encaçapadas não bloqueiam a marca', () => {
  const table = tableOf([{ id: 1, x: 0, z: FOOT_Z, pocketed: true }, { id: 8, x: 0, z: 0, pocketed: true }]);
  assert.equal(ballOf(respotBalls(table, [8], geometry), 8).x, 0);
});

test('sem lugar livre até k = 10, a bola fica em x = 0', () => {
  // Balls every 6R from −18R to +18R cover every candidate x = j · 2R, j in −10..10.
  const blockers = [-9, -6, -3, 0, 3, 6, 9].map((j, i) => ({ id: i + 1, x: j * 2 * R, z: FOOT_Z }));
  const table = tableOf([...blockers, { id: 8, x: 0, z: 0, pocketed: true }]);
  assert.deepEqual(ballOf(respotBalls(table, [8], geometry), 8), { id: 8, x: 0, z: FOOT_Z, pocketed: false });
});

test('uma bola reposta antes bloqueia a seguinte, na ordem de ids', () => {
  const table = tableOf([{ id: 0, x: 0, z: HEAD_Z }, { id: 8, x: 0, z: 0, pocketed: true }, { id: 9, x: 5, z: 5, pocketed: true }]);
  const first = respotBalls(table, [8, 9], geometry);
  assert.deepEqual([ballOf(first, 8).x, ballOf(first, 9).x], [0, 4 * R]);
  const swapped = respotBalls(table, [9, 8], geometry);
  assert.deepEqual([ballOf(swapped, 9).x, ballOf(swapped, 8).x], [0, 4 * R]);
  assert.ok([8, 9].every((id) => ballOf(first, id).pocketed === false && ballOf(first, id).z === FOOT_Z));
});

test('bola que não está encaçapada não se mexe', () => {
  const table = tableOf([{ id: 0, x: 1, z: 2 }, { id: 8, x: 30, z: -10 }, { id: 9, x: 5, z: 5, pocketed: true }]);
  const before = JSON.stringify(table);
  const out = respotBalls(table, [8, 7], geometry);
  assert.deepEqual(out, table);
  assert.equal(JSON.stringify(table), before);
});

test('respotBalls mantém os outros campos das bolas', () => {
  const table = { tableProfileId: 'pool9ft', balls: [{ id: 8, x: 0, z: 0, pocketed: true, q: [0, 0, 0, 1] }] };
  assert.deepEqual(respotBalls(table, [8], geometry).balls[0], { id: 8, x: 0, z: FOOT_Z, pocketed: false, q: [0, 0, 0, 1] });
});

test('isCueBallPlacementValid: na mesa aberta, a posição vale', () => {
  const table = rackTable(eightBall.rackLayout(createMatch(eightBall, config8, mulberry32(1)).mode), 'pool9ft');
  assert.equal(isCueBallPlacementValid(table, { x: 0, z: HEAD_Z }, geometry), true);
  assert.equal(isCueBallPlacementValid(table, { x: 20, z: -30 }, geometry), true);
});

test('isCueBallPlacementValid: fora das tabelas não vale; no limite vale', () => {
  const table = tableOf([{ id: 0, x: 0, z: 0 }, { id: 1, x: 0, z: 60 }]);
  const maxX = geometry.width / 2 - R;
  const maxZ = geometry.depth / 2 - R;
  assert.equal(isCueBallPlacementValid(table, { x: maxX, z: 0 }, geometry), true);
  assert.equal(isCueBallPlacementValid(table, { x: -maxX, z: -maxZ }, geometry), true);
  assert.equal(isCueBallPlacementValid(table, { x: maxX + 0.01, z: 0 }, geometry), false);
  assert.equal(isCueBallPlacementValid(table, { x: -maxX - 0.01, z: 0 }, geometry), false);
  assert.equal(isCueBallPlacementValid(table, { x: 0, z: maxZ + 0.01 }, geometry), false);
  assert.equal(isCueBallPlacementValid(table, { x: 0, z: -maxZ - 0.01 }, geometry), false);
  assert.equal(isCueBallPlacementValid(table, { x: 1000, z: 0 }, geometry), false);
});

test('isCueBallPlacementValid: sobre a bola 1 não vale; a exatamente 2R vale', () => {
  const table = tableOf([{ id: 0, x: -30, z: 0 }, { id: 1, x: 10, z: 20 }]);
  assert.equal(isCueBallPlacementValid(table, { x: 10, z: 20 }, geometry), false);
  assert.equal(isCueBallPlacementValid(table, { x: 10 + 2 * R - 0.01, z: 20 }, geometry), false);
  assert.equal(isCueBallPlacementValid(table, { x: 10, z: 20 - (2 * R - 1e-6) }, geometry), false);
  assert.equal(isCueBallPlacementValid(table, { x: 10 + 2 * R, z: 20 }, geometry), true);
  assert.equal(isCueBallPlacementValid(table, { x: 10, z: 20 + 2 * R }, geometry), true);
});

test('isCueBallPlacementValid: bola encaçapada no lugar não bloqueia, e a posição atual da branca é ignorada', () => {
  const table = tableOf([{ id: 0, x: 10, z: 20 }, { id: 1, x: 10, z: 20, pocketed: true }, { id: 2, x: -20, z: 0 }]);
  assert.equal(isCueBallPlacementValid(table, { x: 10, z: 20 }, geometry), true);
  assert.equal(isCueBallPlacementValid(table, { x: 10.5, z: 20 }, geometry), true);
});

test('isCueBallPlacementValid: número que não é finito não vale', () => {
  const table = tableOf([{ id: 0, x: 0, z: 0 }]);
  assert.equal(isCueBallPlacementValid(table, { x: NaN, z: 0 }, geometry), false);
  assert.equal(isCueBallPlacementValid(table, { x: 0, z: Infinity }, geometry), false);
});
