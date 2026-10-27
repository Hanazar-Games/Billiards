// Builds build/server.mjs: the service and everything it imports in one file,
// so the container image needs nothing but Node and this file.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

await build({
  entryPoints: [fileURLToPath(new URL('./src/main.ts', import.meta.url))],
  outfile: fileURLToPath(new URL('./build/server.mjs', import.meta.url)),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  // cannon-es ships an ES build next to its CommonJS one; the CommonJS one needs require.
  mainFields: ['module', 'main'],
  logLevel: 'warning',
});
console.log('build/server.mjs');
