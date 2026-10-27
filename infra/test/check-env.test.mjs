// F4-13 (D065): the production .env is checked before the stack goes up, and
// gen-secrets gives secrets the check accepts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const infra = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = mkdtempSync(join(tmpdir(), 'check-env-'));
const run = (script, args = []) => spawnSync(process.execPath, [join(infra, script), ...args], { encoding: 'utf8' });

const GOOD = {
  NAKAMA_DOMAIN: 'jogo.exemplo.com.br',
  ACME_EMAIL: 'ops@exemplo.com.br',
  NAKAMA_SERVER_KEY: 'Srv_key-0123456789abcdefgh',
  NAKAMA_HTTP_KEY: 'Http_key-0123456789abcdefg',
  NAKAMA_SESSION_KEY: 'Session_key-0123456789abcd',
  NAKAMA_CONSOLE_PASSWORD: 'Console_pw-0123456789abcde',
  POSTGRES_PASSWORD: 'Postgres_pw-0123456789abcd',
  SIM_SECRET: 'Sim_secret-0123456789abcdef',
};

let n = 0;
/** Writes an .env with `values` and runs check-env on it. */
function check(values) {
  const file = join(dir, `env-${++n}`);
  writeFileSync(file, Object.entries(values).map(([k, v]) => `${k}=${v}`).join('\n') + '\n');
  return run('check-env.mjs', [file]);
}

test('check-env aceita um .env de produção completo', () => {
  const out = check(GOOD);
  assert.equal(out.status, 0, out.stderr);
});

test('check-env recusa chave faltando, valor de desenvolvimento e segredo com caractere fora do padrão', () => {
  const { SIM_SECRET, ...missing } = GOOD;
  const cases = [
    [missing, 'SIM_SECRET'],
    [{ ...GOOD, NAKAMA_SERVER_KEY: 'defaultkey' }, 'NAKAMA_SERVER_KEY'],
    [{ ...GOOD, NAKAMA_CONSOLE_PASSWORD: 'dev-console' }, 'NAKAMA_CONSOLE_PASSWORD'],
    [{ ...GOOD, POSTGRES_PASSWORD: 'Postgres$pw-0123456789abcd' }, 'POSTGRES_PASSWORD'],
    [{ ...GOOD, NAKAMA_HTTP_KEY: 'short_key-123' }, 'NAKAMA_HTTP_KEY'],
    [{ ...GOOD, NAKAMA_DOMAIN: 'https://jogo.exemplo.com.br' }, 'NAKAMA_DOMAIN'],
    [{ ...GOOD, ACME_EMAIL: 'ops' }, 'ACME_EMAIL'],
  ];
  for (const [values, key] of cases) {
    const out = check(values);
    assert.equal(out.status, 1, `${key}: ${out.stdout}${out.stderr}`);
    assert.match(out.stderr, new RegExp(key));
  }
});

test('o exemplo de produção não passa sem ser preenchido', () => {
  const out = run('check-env.mjs', [join(infra, '.env.production.example')]);
  assert.equal(out.status, 1);
  for (const key of Object.keys(GOOD)) assert.match(out.stderr, new RegExp(key));
});

test('gen-secrets produz segredos que o check-env aceita', () => {
  const first = run('gen-secrets.mjs');
  const second = run('gen-secrets.mjs');
  assert.equal(first.status, 0, first.stderr);
  const secrets = Object.fromEntries(first.stdout.split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => l.split('=')));
  assert.deepEqual(Object.keys(secrets).sort(), Object.keys(GOOD).filter((k) => !['NAKAMA_DOMAIN', 'ACME_EMAIL'].includes(k)).sort());
  assert.notEqual(first.stdout, second.stdout);
  const out = check({ NAKAMA_DOMAIN: GOOD.NAKAMA_DOMAIN, ACME_EMAIL: GOOD.ACME_EMAIL, ...secrets });
  assert.equal(out.status, 0, out.stderr);
});

test('sem arquivo, check-env diz qual faltou', () => {
  const out = run('check-env.mjs', [join(dir, 'missing.env')]);
  assert.equal(out.status, 1);
  assert.match(out.stderr, /missing\.env/);
});
