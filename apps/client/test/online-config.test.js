// F4-B: where the online client finds the Nakama server (D063).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onlineConfig } from '../src/online/config.js';

test('URL https sem porta usa 443 e TLS', () => {
  assert.deepEqual(onlineConfig({ VITE_NAKAMA_URL: 'https://api.exemplo.com', VITE_NAKAMA_SERVER_KEY: 'k' }),
    { host: 'api.exemplo.com', port: '443', useSSL: true, serverKey: 'k', url: 'https://api.exemplo.com' });
});

test('URL http com porta usa a porta e não usa TLS', () => {
  assert.deepEqual(onlineConfig({ VITE_NAKAMA_URL: 'http://server:7350', VITE_NAKAMA_SERVER_KEY: 'k' }),
    { host: 'server', port: '7350', useSSL: false, serverKey: 'k', url: 'http://server:7350' });
});

test('em desenvolvimento, sem URL, aponta para o Nakama local', () => {
  assert.deepEqual(onlineConfig({ DEV: true }),
    { host: '127.0.0.1', port: '7350', useSSL: false, serverKey: 'defaultkey', url: 'http://127.0.0.1:7350' });
});

test('em produção, sem URL, o online fica indisponível', () => {
  assert.equal(onlineConfig({ DEV: false }), null);
  assert.equal(onlineConfig({ DEV: false, VITE_NAKAMA_URL: '' }), null);
});

test('URL inválida dá null', (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  assert.equal(onlineConfig({ DEV: true, VITE_NAKAMA_URL: 'nada' }), null);
  assert.equal(onlineConfig({ DEV: false, VITE_NAKAMA_URL: 'ftp://x' }), null);
  assert.equal(warn.mock.callCount(), 2);
});

test('em produção, sem chave, usa a chave padrão do Nakama só se a URL vier', () => {
  // The server key is public configuration (D065); a production build without it keeps Nakama's default.
  assert.equal(onlineConfig({ DEV: false, VITE_NAKAMA_URL: 'https://a.b' }).serverKey, 'defaultkey');
});
