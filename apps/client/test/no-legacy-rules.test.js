// F2: the client has no rules of its own; packages/modes decides every turn.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

/** .js files under `dir` (relative to apps/client), with forward slashes. */
function jsFilesUnder(dir) {
  return readdirSync(new URL(`../${dir}`, import.meta.url), { recursive: true })
    .map((p) => `${dir}/${String(p).replaceAll('\\', '/')}`)
    .filter((p) => p.endsWith('.js'));
}

test('src não tem regras próprias', () => {
  assert.equal(existsSync(`${root}src/game/Rules.js`), false);
  assert.equal(existsSync(`${root}src/game/NineBallRules.js`), false);
  const files = jsFilesUnder('src');
  assert.ok(files.length > 0);
  const offenders = files.filter((file) => /\bRules\.js\b|NineBallRules|\.rules\b/.test(
    // Comments may name the legacy files; code may not use them.
    readFileSync(`${root}${file}`, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')));
  assert.deepEqual(offenders, []);
});
