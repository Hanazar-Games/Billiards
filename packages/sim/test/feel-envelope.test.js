// Feel metrics and the D035 envelope used by feel.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeMetrics, withinEnvelope } from './feel/metrics.js';

const byFps = (a, b, c, d) => ({ 30: a, 60: b, 120: c, 144: d });

test('comprimento: envelope alargado por max(1, 2% do valor a 60 FPS)', () => {
  const ref = byFps(100, 102, 104, 103); // m = 2.04
  assert.ok(withinEnvelope(97.97, ref, 'cuePath'));
  assert.ok(!withinEnvelope(97.9, ref, 'cuePath'));
  assert.ok(withinEnvelope(106.03, ref, 'totalPath'));
  assert.ok(!withinEnvelope(106.1, ref, 'totalPath'));
  assert.ok(withinEnvelope(11.9, byFps(10, 10, 11, 10), 'cuePath')); // m = 1
  assert.ok(!withinEnvelope(12.1, byFps(10, 10, 11, 10), 'cuePath'));
});

test('posição: margem de max(1, 2% do cuePath a 60 FPS)', () => {
  const ref = byFps(10, 10.5, 9.5, 10);
  const at60 = { cuePath: 200 }; // m = 4
  assert.ok(withinEnvelope(14.5, ref, 'cueX', at60));
  assert.ok(!withinEnvelope(14.6, ref, 'cueX', at60));
  assert.ok(withinEnvelope(5.5, ref, 'cueZ', at60));
  assert.ok(!withinEnvelope(5.4, ref, 'cueZ', at60));
  assert.ok(!withinEnvelope(12, ref, 'cueX', { cuePath: 10 })); // m = 1
  assert.throws(() => withinEnvelope(10, ref, 'cueX'), /cuePath/);
});

test('posições por bola e por eixo; bola a mais ou a menos fica fora', () => {
  const p = (x, z) => ({ 0: [x, z], 3: [5, 5] });
  const ref = byFps(p(0, 0), p(1, 0), p(0.5, 1), p(0, 0.5));
  const at60 = { cuePath: 100 }; // m = 2
  assert.ok(withinEnvelope({ 0: [2.9, -1.9], 3: [5, 5] }, ref, 'positions', at60));
  assert.ok(!withinEnvelope({ 0: [3.1, 0], 3: [5, 5] }, ref, 'positions', at60));
  assert.ok(!withinEnvelope({ 0: [0, 3.1], 3: [5, 5] }, ref, 'positions', at60));
  assert.ok(!withinEnvelope({ 0: [0, 0] }, ref, 'positions', at60));
  assert.ok(!withinEnvelope({ 0: [0, 0], 3: [5, 5], 4: [1, 1] }, ref, 'positions', at60));
});

test('contagens ±1 e encaçapadas iguais às de 60 FPS', () => {
  assert.ok(withinEnvelope(9, byFps(10, 10, 11, 12), 'moved'));
  assert.ok(withinEnvelope(13, byFps(10, 10, 11, 12), 'pocketedCount'));
  assert.ok(!withinEnvelope(8, byFps(10, 10, 11, 12), 'moved'));
  assert.ok(!withinEnvelope(14, byFps(10, 10, 11, 12), 'pocketedCount'));
  assert.ok(withinEnvelope([1], byFps([], [1], [], [1, 2]), 'pocketed'));
  assert.ok(!withinEnvelope([], byFps([], [1], [], []), 'pocketed'));
});

test('métrica desconhecida lança erro', () => {
  assert.throws(() => withinEnvelope(1, byFps(1, 1, 1, 1), 'speed'), /unknown feel metric: speed/);
});

test('computeMetrics soma caminhos sobre amostras esparsas e lê o estado final', () => {
  const table = { tableProfileId: 'pool9ft', balls: [
    { id: 0, x: 0, z: 0, pocketed: false },
    { id: 1, x: 10, z: 0, pocketed: false },
    { id: 2, x: 20, z: 0, pocketed: false },
    { id: 3, x: 30, z: 0, pocketed: true },
  ] };
  const samples = [table,
    { t: 1 / 30, balls: [{ id: 0, x: 3, z: 4 }] },
    { t: 2 / 30, balls: [] },
    { t: 3 / 30, balls: [{ id: 0, x: 3, z: 10 }, { id: 1, x: 10, z: 5 }] },
  ];
  const final = { tableProfileId: 'pool9ft', balls: [
    { id: 0, x: 3, z: 10.2, pocketed: false },
    { id: 1, x: 0, z: 0, pocketed: true },
    { id: 2, x: 20.5, z: 0, pocketed: false },
    { id: 3, x: 30, z: 0, pocketed: true },
  ] };
  assert.deepEqual(computeMetrics('single', samples, final), { cuePath: 11, cueX: 3, cueZ: 10.2, pocketed: [1] });
  assert.deepEqual(computeMetrics('break', samples, final), { totalPath: 16, moved: 2, pocketedCount: 1 });
  assert.deepEqual(computeMetrics('low-energy', samples, final), { cuePath: 11, positions: { 0: [3, 10.2], 2: [20.5, 0] }, pocketed: [1] });
  assert.throws(() => computeMetrics('calibration', samples, final), /unknown shot kind/);
});
