// Builds build/index.js for the Nakama JS runtime (D050): src/registry.ts as an
// IIFE (global `Billiards`), then generated glue with InitModule and one global
// function per registered handler. Nakama only registers functions declared at
// the top level, and reads InitModule's source to find them. The handler names
// come from running the bundle itself, so the build needs no TypeScript support
// in Node (a server may run Node 22 without type stripping).
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const bundle = await build({
  entryPoints: [fileURLToPath(new URL('./src/registry.ts', import.meta.url))],
  bundle: true,
  format: 'iife',
  globalName: 'Billiards',
  platform: 'neutral',
  target: 'es2017',
  mainFields: ['module', 'main'],
  define: { __MODULE_VERSION__: JSON.stringify(version) },
  write: false,
  logLevel: 'warning',
});

const code = bundle.outputFiles[0].text;
const context = vm.createContext({});
vm.runInContext(code, context);
const { REGISTRY, MATCH_FUNCTIONS, globalName } = context.Billiards;

const functions = [];
const registrations = [];
for (const id of Object.keys(REGISTRY.rpcs)) {
  const name = globalName('rpc', id);
  functions.push(`function ${name}(ctx, logger, nk, payload) { return Billiards.REGISTRY.rpcs[${JSON.stringify(id)}](ctx, logger, nk, payload); }`);
  registrations.push(`  initializer.registerRpc(${JSON.stringify(id)}, ${name});`);
}
for (const id of Object.keys(REGISTRY.before)) {
  const name = globalName('before', id);
  functions.push(`function ${name}(ctx, logger, nk, data) { return Billiards.REGISTRY.before[${JSON.stringify(id)}](ctx, logger, nk, data); }`);
  registrations.push(`  initializer.registerBefore${id}(${name});`);
}
for (const id of Object.keys(REGISTRY.rtBefore)) {
  const name = globalName('rtBefore', id);
  functions.push(`function ${name}(ctx, logger, nk, envelope) { return Billiards.REGISTRY.rtBefore[${JSON.stringify(id)}](ctx, logger, nk, envelope); }`);
  registrations.push(`  initializer.registerRtBefore(${JSON.stringify(id)}, ${name});`);
}
if (REGISTRY.matchmakerMatched) {
  const name = globalName('matchmaker', 'matched');
  functions.push(`function ${name}(ctx, logger, nk, matches) { return Billiards.REGISTRY.matchmakerMatched(ctx, logger, nk, matches); }`);
  registrations.push(`  initializer.registerMatchmakerMatched(${name});`);
}
for (const id of Object.keys(REGISTRY.matches)) {
  const handlers = [];
  for (const fn of MATCH_FUNCTIONS) {
    const name = globalName('match', id, fn);
    functions.push(`function ${name}() { return Billiards.REGISTRY.matches[${JSON.stringify(id)}].${fn}.apply(null, arguments); }`);
    handlers.push(`${fn}: ${name}`);
  }
  registrations.push(`  initializer.registerMatch(${JSON.stringify(id)}, { ${handlers.join(', ')} });`);
}

const glue = [
  'function InitModule(ctx, logger, nk, initializer) {',
  ...registrations,
  `  logger.info('billiards module ${version} loaded');`,
  '}',
  ...functions,
  '',
].join('\n');

mkdirSync(new URL('./build/', import.meta.url), { recursive: true });
writeFileSync(new URL('./build/index.js', import.meta.url), `${bundle.outputFiles[0].text}\n${glue}`);
console.log(`build/index.js: ${registrations.length} registrations`);
