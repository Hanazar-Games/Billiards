// The part of the Nakama 3.x JS runtime API this module uses, declared locally
// (D050): the official typings are not on npm. Names follow the runtime docs.

export interface Context {
  env: Record<string, string>;
  executionMode: string;
  userId?: string;
  username?: string;
  matchId?: string;
}

export interface Logger {
  debug(format: string, ...params: unknown[]): void;
  info(format: string, ...params: unknown[]): void;
  warn(format: string, ...params: unknown[]): void;
  error(format: string, ...params: unknown[]): void;
}

export interface Presence {
  userId: string;
  sessionId: string;
  username: string;
  node: string;
}

export interface MatchListing {
  matchId: string;
  authoritative: boolean;
  label: string;
  size: number;
}

export interface User {
  userId: string;
  username: string;
  avatarUrl: string;
}

export interface Nakama {
  accountUpdateId(userId: string, username: string | null, displayName: string | null, timezone: string | null,
    location: string | null, langTag: string | null, avatarUrl: string | null, metadata: Record<string, unknown> | null): void;
  matchCreate(module: string, params?: Record<string, unknown>): string;
  matchList(limit: number, authoritative?: boolean | null, label?: string | null, minSize?: number | null,
    maxSize?: number | null, query?: string | null): MatchListing[];
  usersGetId(userIds: string[]): User[];
}

export interface MatchDispatcher {
  broadcastMessage(opCode: number, data: string | null, presences?: Presence[] | null, sender?: Presence | null, reliable?: boolean): void;
  matchLabelUpdate(label: string): void;
}

export interface MatchMessage {
  sender: Presence;
  opCode: number;
  data: string;
}

export interface MatchmakerResult {
  properties: Record<string, unknown>;
  presence: Presence;
  partyId?: string;
}

export type RpcHandler = (ctx: Context, logger: Logger, nk: Nakama, payload: string) => string | void;

/** Returns the (possibly changed) request, or nothing to refuse it. */
export type BeforeHook = (ctx: Context, logger: Logger, nk: Nakama, data: any) => any;

/** Returns the id of the match to send the players to, or nothing to fall back to a relayed match. */
export type MatchmakerMatchedHandler = (ctx: Context, logger: Logger, nk: Nakama, matches: MatchmakerResult[]) => string | void;

export interface MatchHandler<S = any> {
  matchInit(ctx: Context, logger: Logger, nk: Nakama, params: Record<string, unknown>): { state: S; tickRate: number; label: string };
  matchJoinAttempt(ctx: Context, logger: Logger, nk: Nakama, dispatcher: MatchDispatcher, tick: number, state: S,
    presence: Presence, metadata: Record<string, unknown>): { state: S; accept: boolean; rejectMessage?: string } | null;
  matchJoin(ctx: Context, logger: Logger, nk: Nakama, dispatcher: MatchDispatcher, tick: number, state: S, presences: Presence[]): { state: S } | null;
  matchLeave(ctx: Context, logger: Logger, nk: Nakama, dispatcher: MatchDispatcher, tick: number, state: S, presences: Presence[]): { state: S } | null;
  matchLoop(ctx: Context, logger: Logger, nk: Nakama, dispatcher: MatchDispatcher, tick: number, state: S, messages: MatchMessage[]): { state: S } | null;
  matchTerminate(ctx: Context, logger: Logger, nk: Nakama, dispatcher: MatchDispatcher, tick: number, state: S, graceSeconds: number): { state: S } | null;
  matchSignal(ctx: Context, logger: Logger, nk: Nakama, dispatcher: MatchDispatcher, tick: number, state: S, data: string): { state: S; data: string } | null;
}

/** gRPC status codes the runtime maps errors to. */
export const GRPC = { INVALID_ARGUMENT: 3, NOT_FOUND: 5, ALREADY_EXISTS: 6, PERMISSION_DENIED: 7, FAILED_PRECONDITION: 9, RESOURCE_EXHAUSTED: 8 } as const;

/** An error the client receives with `message` = the stable code (Global Constraints). */
export function rpcError(code: string, grpc: number): Error & { code: number } {
  return Object.assign(new Error(code), { code: grpc });
}
