// Usernames and avatars (spec §8.1, D052).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateUsername, parseAvatar, AVATAR_PRESETS } from '../src/index.ts';

test('nomes válidos são normalizados', () => {
  assert.deepEqual(validateUsername('  Cássio_10 '), { ok: true, username: 'cassio_10' });
  assert.deepEqual(validateUsername('cubo'), { ok: true, username: 'cubo' });
});

test('nomes impróprios são recusados mesmo disfarçados', () => {
  for (const name of ['merda', 'MERDA', 'p0rr4', 'm_e_r_d_a', 'caralho99', 'cu_123', 'porrrra']) {
    assert.deepEqual(validateUsername(name), { ok: false, reason: 'USERNAME_INVALID' }, name);
  }
});

test('tamanho e caracteres', () => {
  for (const name of ['ab', 'a'.repeat(17), 'nome com espaço', 'emoji😀']) assert.equal(validateUsername(name).ok, false, name);
});

test('avatar só de preset', () => {
  assert.equal(AVATAR_PRESETS.length, 12);
  assert.equal(parseAvatar('preset:a07'), 'preset:a07');
  for (const v of ['preset:a13', 'https://x/y.png', '']) assert.equal(parseAvatar(v), null);
});
