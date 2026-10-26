// Accounts and profiles (spec §8.1, D052): usernames are validated wherever
// they enter (authentication and the profile_update RPC), and the profile only
// changes through the RPC — the built-in UpdateAccount is refused.
import { parseAvatar, validateUsername } from '@billiards/protocol';
import { GRPC, rpcError, type Context, type Logger, type Nakama } from './nakama.ts';

/** Before AuthenticateDevice/Email/Google: a requested username is normalized, an improper one refused. */
export function beforeAuthenticate(_ctx: Context, _logger: Logger, _nk: Nakama, data: { username?: string }) {
  if (data.username === undefined || data.username === '') return data;
  const result = validateUsername(data.username);
  if (!result.ok) throw rpcError(result.reason, GRPC.INVALID_ARGUMENT);
  return { ...data, username: result.username };
}

/**
 * Authentication methods without the username rules (custom ids, Facebook,
 * Game Center, Apple, Steam need no server configuration): refused, so every
 * account goes through device, e-mail or Google (D052).
 */
export const DISABLED_AUTH_METHODS = Object.freeze(['AuthenticateApple', 'AuthenticateCustom', 'AuthenticateFacebook',
  'AuthenticateFacebookInstantGame', 'AuthenticateGameCenter', 'AuthenticateSteam']);

export function beforeAuthMethodDisabled(_ctx: Context, _logger: Logger, _nk: Nakama, _data: unknown): never {
  throw rpcError('AUTH_METHOD_DISABLED', GRPC.PERMISSION_DENIED);
}

/** Before UpdateAccount: always refused; the profile changes through profile_update. */
export function beforeUpdateAccount(_ctx: Context, _logger: Logger, _nk: Nakama, _data: unknown): never {
  throw rpcError('PROFILE_VIA_RPC', GRPC.PERMISSION_DENIED);
}

/** RPC profile_update { username?, avatar? } → { username, avatar } after the change. */
export function rpcProfileUpdate(ctx: Context, logger: Logger, nk: Nakama, payload: string): string {
  let input: { username?: unknown; avatar?: unknown };
  try {
    input = JSON.parse(payload || '{}');
  } catch {
    throw rpcError('PAYLOAD_INVALID', GRPC.INVALID_ARGUMENT);
  }
  if (!input || typeof input !== 'object' || (input.username === undefined && input.avatar === undefined)) {
    throw rpcError('PAYLOAD_INVALID', GRPC.INVALID_ARGUMENT);
  }
  let username: string | null = null;
  if (input.username !== undefined) {
    const result = validateUsername(input.username as string);
    if (!result.ok) throw rpcError(result.reason, GRPC.INVALID_ARGUMENT);
    username = result.username;
  }
  let avatar: string | null = null;
  if (input.avatar !== undefined) {
    avatar = parseAvatar(input.avatar as string);
    if (avatar === null) throw rpcError('AVATAR_INVALID', GRPC.INVALID_ARGUMENT);
  }
  try {
    nk.accountUpdateId(ctx.userId!, username, null, null, null, null, avatar, null);
  } catch (err) {
    if (/already in use/i.test(String((err as Error)?.message ?? err))) throw rpcError('USERNAME_TAKEN', GRPC.ALREADY_EXISTS);
    logger.error('profile_update failed for %s: %s', ctx.userId, String(err));
    throw err;
  }
  const user = nk.usersGetId([ctx.userId!])[0];
  return JSON.stringify({ username: user.username, avatar: user.avatarUrl });
}
