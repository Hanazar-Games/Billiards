// F1-B: the client has no physics of its own. Every shot comes from packages/sim.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CLIENT = new URL('../', import.meta.url);

// Every .js/.mjs file under `root` (relative to apps/client), as paths relative
// to apps/client.
function jsFilesUnder(root) {
  const base = fileURLToPath(new URL(`${root}/`, CLIENT));
  return readdirSync(base, { recursive: true })
    .map((p) => p.split('\\').join('/'))
    .filter((p) => /\.(m?js)$/.test(p))
    .map((p) => `${root}/${p}`);
}

const read = (path) => readFileSync(new URL(path, CLIENT), 'utf8');

test('src não importa cannon-es nem usa corpos físicos', () => {
  const files = jsFilesUnder('src');
  assert.ok(files.length > 0, 'src has no .js/.mjs files: the scan is looking in the wrong place');
  // Collect every offender so a failure lists all the files, not just the first.
  const offenders = [];
  for (const file of files) {
    const code = read(file);
    if (/from ['"]cannon-es['"]/.test(code)) offenders.push(`${file}: imports cannon-es`);
    if (/\.body\.(position|velocity|angularVelocity|quaternion)\b|\bPhysicsWorld\b|applyImpulse\(/.test(code)) {
      offenders.push(`${file}: uses a physics body`);
    }
  }
  assert.deepEqual(offenders, []);
  assert.equal(existsSync(new URL('src/core/PhysicsWorld.js', CLIENT)), false);
});

test('package.json do cliente não depende de cannon-es', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.dependencies['cannon-es'], undefined);
});
