// Binary envelope and base64 (D055). Both run in the Nakama runtime (goja), which has no
// TextEncoder or Buffer; the tests may use Buffer as the reference.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeEnvelope, decodeEnvelope, bytesToBase64, base64ToBytes } from '../src/index.ts';

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function headerLengthOf(bytes: Uint8Array): number {
  return new DataView(bytes.buffer, bytes.byteOffset).getUint32(0, true);
}

test('envelope ida e volta com cabeçalho acentuado e trajetória', () => {
  const payload = Uint8Array.from({ length: 5000 }, (_, i) => (i * 37) & 0xff);
  const bytes = encodeEnvelope({ msg: 'ação', n: 1.5 }, payload);
  const headerLength = headerLengthOf(bytes);
  assert.ok(bytes.subarray(4, 4 + headerLength).every((b) => b < 0x80));
  assert.equal(bytes.length, 4 + headerLength + payload.length);
  assert.deepEqual(decodeEnvelope(bytes), { header: { msg: 'ação', n: 1.5 }, payload });
});

test('envelope escapa tudo acima de U+007F, inclusive pares substitutos, e mantém o resto', () => {
  const header = { texto: 'ç😀\u0080\u007f"\\\n', 'chave-ã': [1, null, true] };
  const bytes = encodeEnvelope(header);
  const ascii = String.fromCharCode(...bytes.subarray(4, 4 + headerLengthOf(bytes)));
  assert.match(ascii, /^[\x00-\x7f]*$/);
  assert.ok(ascii.includes('\\u00e7\\ud83d\\ude00\\u0080'));
  assert.deepEqual(decodeEnvelope(bytes), { header, payload: new Uint8Array(0) });
});

test('envelope sem trajetória tem payload vazio', () => {
  const bytes = encodeEnvelope({ ok: true });
  assert.equal(bytes.length, 4 + headerLengthOf(bytes));
  assert.equal(decodeEnvelope(bytes).payload.length, 0);
});

test('envelope ida e volta com cabeçalhos de tamanhos variados', () => {
  const rng = mulberry32(7);
  for (const size of [0, 1, 2, 1023, 1024, 1025, 70000]) {
    const text = Array.from({ length: size }, () => 'aé😀z'[Math.floor(rng() * 4)]).join('');
    const payload = Uint8Array.from({ length: Math.floor(rng() * 40) }, () => Math.floor(rng() * 256));
    const decoded = decodeEnvelope(encodeEnvelope({ text }, payload));
    assert.deepEqual(decoded, { header: { text }, payload }, `size ${size}`);
  }
});

test('envelope truncado lança RangeError', () => {
  const bytes = encodeEnvelope({ msg: 'ação', n: 1.5 }, Uint8Array.of(1, 2, 3));
  assert.ok(headerLengthOf(bytes) > 2);
  const truncated = { name: 'RangeError', message: /truncated/ }; // not the later "not valid JSON" failure
  for (const cut of [0, 1, 3, 4, 6, 4 + headerLengthOf(bytes) - 1]) {
    assert.throws(() => decodeEnvelope(bytes.subarray(0, cut)), truncated, `cut at ${cut}`);
  }
  const lying = Uint8Array.from(bytes);
  new DataView(lying.buffer).setUint32(0, lying.length, true); // header length larger than the buffer
  assert.throws(() => decodeEnvelope(lying), truncated);
  new DataView(lying.buffer).setUint32(0, 0xffffffff, true);
  assert.throws(() => decodeEnvelope(lying), truncated);
});

test('envelope com byte de cabeçalho acima de 0x7F ou JSON inválido lança RangeError', () => {
  const raw = (header: number[], payload: number[] = []) => {
    const bytes = new Uint8Array(4 + header.length + payload.length);
    new DataView(bytes.buffer).setUint32(0, header.length, true);
    bytes.set(header, 4);
    bytes.set(payload, 4 + header.length);
    return bytes;
  };
  const ascii = (text: string) => Array.from(text, (c) => c.charCodeAt(0));
  assert.deepEqual(decodeEnvelope(raw(ascii('{"a":1}'), [9])), { header: { a: 1 }, payload: Uint8Array.of(9) });
  assert.throws(() => decodeEnvelope(raw([...ascii('{"a":"'), 0xc3, 0xa7, ...ascii('"}')])), RangeError);
  assert.throws(() => decodeEnvelope(raw(ascii('{"a":'))), RangeError);
  assert.throws(() => decodeEnvelope(raw(ascii('not json'))), RangeError);
  assert.throws(() => decodeEnvelope(raw([])), RangeError);
});

test('envelope recusa um cabeçalho que não vira JSON', () => {
  assert.throws(() => encodeEnvelope(undefined), TypeError);
});

test('base64 confere com o Buffer em todos os tamanhos de 0 a 300', () => {
  const rng = mulberry32(11);
  for (let size = 0; size <= 300; size++) {
    const bytes = Uint8Array.from({ length: size }, () => Math.floor(rng() * 256));
    const text = bytesToBase64(bytes);
    assert.equal(text, Buffer.from(bytes).toString('base64'), `encode ${size}`);
    assert.deepEqual(base64ToBytes(text), bytes, `decode ${size}`);
  }
});

test('base64 inválido lança RangeError', () => {
  for (const bad of ['abc', 'ab$=', '====', 'a===', 'ab=c', 'abcd=', 'ab cd', 'abcd\n', '=abc', 'ab-_']) {
    assert.throws(() => base64ToBytes(bad), RangeError, JSON.stringify(bad));
  }
  assert.deepEqual(base64ToBytes(''), new Uint8Array(0));
});
