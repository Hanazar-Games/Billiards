// Where the integration tests and the browser e2e find the server: NAKAMA_URL
// (http or https, as the production overlay serves it) or NAKAMA_HOST/NAKAMA_PORT.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nakamaFromEnv } from './integration/env.ts';

test('sem nada, o stack local desta máquina', () => {
  const nakama = nakamaFromEnv({});
  assert.deepEqual({ host: nakama.host, port: nakama.port, useSSL: nakama.useSSL, url: nakama.url },
    { host: '127.0.0.1', port: '7350', useSSL: false, url: 'http://127.0.0.1:7350' });
});

test('NAKAMA_HOST e NAKAMA_PORT valem sem NAKAMA_URL', () => {
  const nakama = nakamaFromEnv({ NAKAMA_HOST: 'server', NAKAMA_PORT: '7351' });
  assert.equal(nakama.url, 'http://server:7351');
});

test('NAKAMA_URL com https liga o TLS e assume a porta 443', () => {
  const nakama = nakamaFromEnv({ NAKAMA_URL: 'https://api.example.com', NAKAMA_HOST: 'ignored' });
  assert.deepEqual({ host: nakama.host, port: nakama.port, useSSL: nakama.useSSL, url: nakama.url },
    { host: 'api.example.com', port: '443', useSSL: true, url: 'https://api.example.com:443' });
});

test('NAKAMA_URL com http e porta explícita', () => {
  const nakama = nakamaFromEnv({ NAKAMA_URL: 'http://server:7350/' });
  assert.deepEqual({ host: nakama.host, port: nakama.port, useSSL: nakama.useSSL }, { host: 'server', port: '7350', useSSL: false });
});

test('as chaves vêm do ambiente ou dos valores de desenvolvimento', () => {
  assert.deepEqual(nakamaFromEnv({}).serverKey, 'defaultkey');
  assert.deepEqual(nakamaFromEnv({ NAKAMA_SERVER_KEY: 'k', NAKAMA_HTTP_KEY: 'h' }).httpKey, 'h');
});
