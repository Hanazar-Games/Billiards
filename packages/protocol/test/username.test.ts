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

test('separadores não disfarçam palavras curtas', () => {
  for (const name of ['p_u_t_a', 'pu_ta', 'p_u_t_4', 'f_o_d_a', 'v_i_a_d_o', 'via_do', 'b_o_s_t_a', 'co_rno', 'c_u', 'f_d_p', 'k_r_l', 'otario']) {
    assert.deepEqual(validateUsername(name), { ok: false, reason: 'USERNAME_INVALID' }, name);
  }
});

test('palavras comuns e lugares que contêm um pedaço bloqueado passam', () => {
  for (const name of ['temporada', 'temporal', 'corporal', 'porao', 'evaporar', 'diaspora', 'iporanga', 'ponta_pora', 'notario', 'computador', 'enviado', 'paulo_c']) {
    assert.equal(validateUsername(name).ok, true, name);
  }
});
