// D046: the frozen legacy rules the differential tests compare against.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

test('a cópia congelada das regras legadas bate com o MANIFEST.json', () => {
  const dir = new URL('./legacy/', import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL('MANIFEST.json', dir), 'utf8'));
  assert.equal(Object.keys(manifest).length, 4);
  for (const [path, sha256] of Object.entries(manifest)) {
    // CRLF → LF: a checkout with core.autocrlf must not change the hash.
    const text = readFileSync(new URL(path, dir), 'utf8').replaceAll('\r\n', '\n');
    assert.equal(createHash('sha256').update(text).digest('hex'), sha256, path);
  }
});
