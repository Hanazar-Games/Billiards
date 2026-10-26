// Private-room codes and match configs (spec §7.5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateRoomCode, parseRoomCode, parseMatchConfig } from '../src/index.ts';

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

test('código de sala: 6 caracteres do alfabeto, sem 0/O/1/I', () => {
  const code = generateRoomCode(mulberry32(1));
  assert.match(code, /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
  assert.equal(parseRoomCode(' abc234 '), 'ABC234');
  for (const v of ['ABC23', 'ABC2340', 'ABC23O', 42]) assert.equal(parseRoomCode(v), null);
});

test('configuração de partida', () => {
  const modes = { '8ball': { formats: ['1v1', '2v2'] }, '9ball': { formats: ['1v1'] } };
  assert.deepEqual(parseMatchConfig({ mode: '9ball', format: '1v1' }, modes), { mode: '9ball', format: '1v1' });
  for (const v of [{ mode: 'xyz', format: '1v1' }, { mode: '8ball', format: '2v2' }, { mode: '9ball', format: '2v2' }, null, '8ball']) {
    assert.equal(parseMatchConfig(v, modes), null);
  }
});
