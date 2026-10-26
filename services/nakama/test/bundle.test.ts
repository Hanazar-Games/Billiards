// The server module bundle (D050): every handler Nakama registers is a global
// function declared in build/index.js, and nothing the goja runtime lacks is used.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { REGISTRY, globalName, MATCH_FUNCTIONS } from '../src/registry.ts';

const source = readFileSync(new URL('../build/index.js', import.meta.url), 'utf8');

/** Runs the bundle and InitModule in a fresh context; returns [kind, id, function name] per registration. */
function loadBundleAndInit() {
  const context = vm.createContext({});
  vm.runInContext(source, context);
  const calls: [string, string, string][] = [];
  const initializer = new Proxy({}, {
    get: (_, key: string) => (...args: any[]) => {
      if (key === 'registerRpc') calls.push(['rpc', args[0], args[1].name]);
      else if (key === 'registerMatchmakerMatched') calls.push(['matchmaker', 'matched', args[0].name]);
      else if (key === 'registerMatch') for (const [fn, f] of Object.entries(args[1] as Record<string, Function>)) calls.push(['match', `${args[0]}.${fn}`, f.name]);
      else if (key.startsWith('registerBefore')) calls.push(['before', key.slice('registerBefore'.length), args[0].name]);
      else throw new Error(`unexpected initializer call ${key}`);
    },
  });
  const logger = { info() {}, warn() {}, error() {}, debug() {} };
  context.InitModule({}, logger, {}, initializer);
  return { calls, context };
}

function expectedRegistrations(): string[] {
  return [
    ...Object.keys(REGISTRY.rpcs).map((id) => `rpc:${id}`),
    ...Object.keys(REGISTRY.before).map((id) => `before:${id}`),
    ...(REGISTRY.matchmakerMatched ? ['matchmaker:matched'] : []),
    ...Object.keys(REGISTRY.matches).flatMap((id) => MATCH_FUNCTIONS.map((fn) => `match:${id}.${fn}`)),
  ].sort();
}

test('o bundle registra cada handler por uma função global', () => {
  const { calls, context } = loadBundleAndInit();
  for (const [kind, id, fnName] of calls) {
    assert.match(source, new RegExp(`^function ${fnName}\\(`, 'm'), `${kind}:${id}`);
    assert.equal(typeof context[fnName], 'function', fnName);
  }
  assert.deepEqual(calls.map(([kind, id]) => `${kind}:${id}`).sort(), expectedRegistrations());
  assert.equal(globalName('rpc', 'healthcheck_module'), 'rpc_healthcheck_module');
});

test('o bundle não usa recursos ausentes no goja', () => {
  assert.doesNotMatch(source, /\bstructuredClone\(|\bimport\(|\brequire\(/);
});

test('a RPC healthcheck_module identifica o módulo e a versão', () => {
  const { context } = loadBundleAndInit();
  const out = JSON.parse(context.rpc_healthcheck_module({}, {}, {}, ''));
  assert.deepEqual(out, { module: 'billiards', version: JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version });
});
