// Everything the server module registers in Nakama. build.mjs bundles this
// file (global `Billiards`) and generates InitModule with one literal register
// call per entry, each pointing at a generated global function (D050): Nakama
// reads the InitModule source to find them.
import type { BeforeHook, Context, Logger, MatchHandler, MatchmakerMatchedHandler, Nakama, RpcHandler, RtBeforeHook } from './nakama.ts';
import { beforeAuthenticate, beforeAuthMethodDisabled, beforeUpdateAccount, DISABLED_AUTH_METHODS, rpcProfileUpdate } from './profile.ts';
import { rpcCreatePrivateMatch, rpcJoinByCode } from './rooms.ts';
import { beforeListMatches, billiardsMatch } from './match.ts';
import { matchmakerMatched } from './matchmaker.ts';
import { beforeNativeApiClosed, CLOSED_NATIVE_APIS, CLOSED_RT_APIS } from './nativeApis.ts';

declare const __MODULE_VERSION__: string;

export interface Registry {
  rpcs: Record<string, RpcHandler>;
  /** Keyed by the Nakama API name (registerBefore<Name>). */
  before: Record<string, BeforeHook>;
  /** Keyed by the realtime message name (registerRtBefore(id, fn)). */
  rtBefore: Record<string, RtBeforeHook>;
  matchmakerMatched: MatchmakerMatchedHandler | null;
  matches: Record<string, MatchHandler>;
}

/** The functions every match handler has (registerMatch). */
export const MATCH_FUNCTIONS = ['matchInit', 'matchJoinAttempt', 'matchJoin', 'matchLeave', 'matchLoop', 'matchTerminate', 'matchSignal'] as const;

function rpcHealthcheckModule(ctx: Context, _logger: Logger, _nk: Nakama, _payload: string): string {
  // Read defensively: the unit-test context has no env.
  const simConfigured = Boolean(ctx.env && ctx.env.SIM_URL && ctx.env.SIM_SECRET);
  return JSON.stringify({ module: 'billiards', version: __MODULE_VERSION__, simConfigured });
}

export const REGISTRY: Registry = {
  rpcs: {
    healthcheck_module: rpcHealthcheckModule,
    profile_update: rpcProfileUpdate,
    create_private_match: rpcCreatePrivateMatch,
    join_by_code: rpcJoinByCode,
  },
  before: {
    AuthenticateDevice: beforeAuthenticate,
    AuthenticateEmail: beforeAuthenticate,
    AuthenticateGoogle: beforeAuthenticate,
    UpdateAccount: beforeUpdateAccount,
    ListMatches: beforeListMatches,
  },
  rtBefore: {},
  matchmakerMatched,
  matches: { billiards: billiardsMatch },
};

// Plain loop: the bundle targets the goja runtime, so no Object.fromEntries.
for (const method of DISABLED_AUTH_METHODS) REGISTRY.before[method] = beforeAuthMethodDisabled;
// D064: the native APIs the game does not use.
for (const api of CLOSED_NATIVE_APIS) REGISTRY.before[api] = beforeNativeApiClosed;
for (const api of CLOSED_RT_APIS) REGISTRY.rtBefore[api] = beforeNativeApiClosed;

/** The global function name the glue gives a handler. */
export function globalName(kind: 'rpc' | 'before' | 'rtBefore' | 'matchmaker' | 'match', id: string, fn?: string): string {
  if (kind === 'matchmaker') return 'matchmaker_matched';
  if (kind === 'match') return `match_${id}_${fn}`;
  return `${kind}_${id}`;
}
