// Runs build/index.js and its InitModule in a fresh vm context with a fake
// initializer that records every registration as [kind, id, function name].
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

export const bundleSource = readFileSync(new URL('../build/index.js', import.meta.url), 'utf8');

export function loadBundleAndInit() {
  const context = vm.createContext({});
  vm.runInContext(bundleSource, context);
  const calls: [string, string, string][] = [];
  const initializer = new Proxy({}, {
    get: (_, key: string) => (...args: any[]) => {
      if (key === 'registerRpc') calls.push(['rpc', args[0], args[1].name]);
      else if (key === 'registerMatchmakerMatched') calls.push(['matchmaker', 'matched', args[0].name]);
      else if (key === 'registerMatch') for (const [fn, f] of Object.entries(args[1] as Record<string, Function>)) calls.push(['match', `${args[0]}.${fn}`, f.name]);
      else if (key === 'registerRtBefore') calls.push(['rtBefore', args[0], args[1].name]);
      else if (key.startsWith('registerBefore')) calls.push(['before', key.slice('registerBefore'.length), args[0].name]);
      else throw new Error(`unexpected initializer call ${key}`);
    },
  });
  const logger = { info() {}, warn() {}, error() {}, debug() {} };
  context.InitModule({}, logger, {}, initializer);
  return { calls, context };
}
