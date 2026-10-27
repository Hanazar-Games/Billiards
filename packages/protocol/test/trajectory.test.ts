// Binary trajectory codec v1 (spec §6.1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeTrajectory, decodeTrajectory, type TrajectoryFrame } from '../src/index.ts';

const q = (a: number): [number, number, number, number] => [Math.sin(a / 2), 0, 0, Math.cos(a / 2)];
const frames: TrajectoryFrame[] = [
  { t: 1 / 30, balls: [{ id: 0, x: 12.3456, z: -100.0049, q: q(0.3) }, { id: 15, x: -63.5, z: 127, q: q(-2.9) }] },
  { t: 2 / 30, balls: [] },
];

test('ida e volta preserva posições (0,005 cm) e rotações (0,001 rad)', () => {
  const out = decodeTrajectory(encodeTrajectory(frames));
  assert.equal(out.length, 2); assert.equal(out[1].balls.length, 0); assert.equal(out[1].t, 2 / 30);
  out[0].balls.forEach((b, i) => {
    const s = frames[0].balls[i];
    assert.equal(b.id, s.id);
    assert.ok(Math.abs(b.x - s.x) <= 0.005 && Math.abs(b.z - s.z) <= 0.005);
    const dot = Math.abs(b.q.reduce((acc, v, k) => acc + v * s.q[k], 0));
    assert.ok(2 * Math.acos(Math.min(1, dot)) <= 0.001);
  });
});
test('tamanho: 4 + quadros + 12 bytes por bola', () => {
  assert.equal(encodeTrajectory(frames).byteLength, 4 + 2 + 2 * 12);
});
test('valores fora da faixa lançam RangeError', () => {
  const ball = { id: 0, x: 0, z: 0, q: q(0) };
  assert.throws(() => encodeTrajectory([{ t: 1 / 30, balls: [{ ...ball, x: 327.68 }] }]), RangeError);
  assert.throws(() => encodeTrajectory([{ t: 1 / 30, balls: Array.from({ length: 256 }, () => ball) }]), RangeError);
  assert.throws(() => encodeTrajectory([{ t: 1 / 30, balls: [{ ...ball, id: 256 }] }]), RangeError);
  assert.throws(() => encodeTrajectory([{ t: 0.5, balls: [] }]), RangeError);
  assert.throws(() => encodeTrajectory(Array.from({ length: 65536 }, (_, i) => ({ t: (i + 1) / 30, balls: [] }))), RangeError);
});
test('versão desconhecida e buffer truncado são recusados', () => {
  const bytes = encodeTrajectory(frames);
  const bad = bytes.slice(); bad[0] = 2;
  assert.throws(() => decodeTrajectory(bad), /unsupported trajectory version: 2/);
  assert.throws(() => decodeTrajectory(bytes.slice(0, bytes.length - 3)), RangeError);
});
test('cabeçalho, índice de quatérnio e bytes sobrando inválidos são recusados', () => {
  const bytes = encodeTrajectory(frames);
  const rate = bytes.slice(); rate[1] = 60;
  assert.throws(() => decodeTrajectory(rate), /unsupported trajectory sample rate: 60/);
  const index = bytes.slice(); index[4 + 1 + 5] = 4;
  assert.throws(() => decodeTrajectory(index), RangeError);
  const longer = new Uint8Array(bytes.length + 1); longer.set(bytes);
  assert.throws(() => decodeTrajectory(longer), RangeError);
});
test('posição ou quatérnio não finitos lançam RangeError; quatérnio fora de escala é normalizado', () => {
  const ball = { id: 3, x: 1, z: 2, q: q(1) };
  assert.throws(() => encodeTrajectory([{ t: 1 / 30, balls: [{ ...ball, z: NaN }] }]), RangeError);
  assert.throws(() => encodeTrajectory([{ t: 1 / 30, balls: [{ ...ball, q: [0, 0, 0, 0] }] }]), RangeError);
  const scaled = q(1).map(v => v * 1.5) as [number, number, number, number];
  const [back] = decodeTrajectory(encodeTrajectory([{ t: 1 / 30, balls: [{ ...ball, q: [scaled[0], scaled[1], scaled[1], scaled[3]] }] }]))[0].balls;
  const unit = [scaled[0], scaled[1], scaled[1], scaled[3]].map(v => v / Math.hypot(scaled[0], scaled[1], scaled[1], scaled[3]));
  assert.ok(Math.abs(Math.abs(back.q.reduce((acc, v, k) => acc + v * unit[k], 0)) - 1) < 1e-6);
});
test('decodifica a partir de uma fatia de um buffer maior', () => {
  const bytes = encodeTrajectory(frames);
  const big = new Uint8Array(bytes.length + 10); big.set(bytes, 5);
  assert.equal(decodeTrajectory(big.subarray(5, 5 + bytes.length))[0].balls[1].id, 15);
});
