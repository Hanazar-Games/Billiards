// packages/sim/test/legacy-copy.test.js — D042: frozen legacy, nobody imports the client
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const REPO = new URL('../../../', import.meta.url);
const FROZEN = 'packages/sim/test/legacy/client/';

// Every .js/.mjs file under `root` (relative to the repository root), as paths
// relative to the repository root, skipping the frozen copy itself.
function jsFilesUnder(root) {
  const base = fileURLToPath(new URL(`${root}/`, REPO));
  return readdirSync(base, { recursive: true })
    .map((p) => p.split('\\').join('/'))
    .filter((p) => /\.(m?js)$/.test(p))
    .map((p) => `${root}/${p}`)
    .filter((p) => !p.startsWith(FROZEN));
}

test('a cópia congelada do legado bate com o MANIFEST.json', () => {
  const dir = new URL('./legacy/client/', import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL('MANIFEST.json', dir), 'utf8'));
  assert.equal(Object.keys(manifest).length, 10);
  for (const [path, sha256] of Object.entries(manifest)) {
    // CRLF → LF: a checkout with core.autocrlf must not change the hash.
    const text = readFileSync(new URL(path, dir), 'utf8').replaceAll('\r\n', '\n');
    assert.equal(createHash('sha256').update(text).digest('hex'), sha256, path);
  }
});

test('nenhum teste, ferramenta ou benchmark importa apps/client', () => {
  // A module specifier (a quoted string) that goes through the client folder;
  // comments and test names that merely mention the folder do not count.
  const clientSpecifier = /['"][^'"\n]*\/apps\/client\//;
  for (const root of ['packages/sim/test', 'packages/sim/tools', 'packages/sim/bench', 'spikes/sim-bench/src']) {
    const files = jsFilesUnder(root);
    assert.ok(files.length > 0, `${root} has no .js/.mjs files: the scan is looking in the wrong place`);
    for (const file of files) {
      assert.doesNotMatch(readFileSync(new URL(file, REPO), 'utf8'), clientSpecifier, file);
    }
  }
});
