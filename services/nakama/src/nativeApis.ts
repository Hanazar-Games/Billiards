// D064 (closes D053): native Nakama APIs the game does not use are refused by
// a hook, so a client cannot go around the server's rules (§9.2). Reopening one
// is deleting its line, when a phase needs it (groups in F7, purchases in F8).
import { GRPC, rpcError, type Context, type Logger, type Nakama } from './nakama.ts';

/** registerBefore<Id> names refused by beforeNativeApiClosed. */
export const CLOSED_NATIVE_APIS = Object.freeze([
  // Storage: clients never write (§9.2); reads stay open for the match history.
  'WriteStorageObjects', 'DeleteStorageObjects',
  // Friends and groups (no social features in the MVP; groups come back in F7).
  'AddFriends', 'BlockFriends', 'DeleteFriends', 'ImportFacebookFriends', 'ImportSteamFriends',
  'CreateGroup', 'UpdateGroup', 'DeleteGroup', 'JoinGroup', 'LeaveGroup',
  'AddGroupUsers', 'KickGroupUsers', 'BanGroupUsers', 'PromoteGroupUsers', 'DemoteGroupUsers',
  // Leaderboards and tournaments (ranking is F9, written by the server).
  'WriteLeaderboardRecord', 'DeleteLeaderboardRecord', 'WriteTournamentRecord', 'DeleteTournamentRecord', 'JoinTournament',
  // Purchases (F8 decides the payment flow).
  'ValidatePurchaseApple', 'ValidatePurchaseGoogle', 'ValidatePurchaseHuawei', 'ValidatePurchaseFacebookInstant',
  'ValidateSubscriptionApple', 'ValidateSubscriptionGoogle',
  // Account deletion comes as an RPC with the LGPD flow (§8.1).
  'DeleteAccount',
  // Linking identities whose username the server cannot validate (as their authentication).
  'LinkCustom', 'LinkFacebook', 'LinkFacebookInstantGame', 'LinkGameCenter', 'LinkApple', 'LinkSteam',
]);

/** registerRtBefore ids refused: chat and direct messages (no free chat, D024), status, parties and relayed matches. */
export const CLOSED_RT_APIS = Object.freeze([
  'MatchCreate',
  'ChannelJoin', 'ChannelMessageSend', 'ChannelMessageUpdate', 'ChannelMessageRemove',
  'StatusFollow', 'StatusUpdate',
  'PartyCreate', 'PartyJoin',
]);

export function beforeNativeApiClosed(ctx: Context, logger: Logger, _nk: Nakama, _data: unknown): never {
  logger.debug(`native API closed for user ${ctx.userId ?? '?'}`);
  throw rpcError('NATIVE_API_CLOSED', GRPC.PERMISSION_DENIED);
}

/**
 * MatchJoin stays open for the billiards matches, joined by id, but not for a relayed
 * match: the matchmaker hands out a token when matchmakerMatched creates nothing (tickets
 * with properties that are no billiards mode), and in a relayed match clients exchange
 * anything through the server (free chat, D024; §9.2).
 */
export function beforeMatchJoin(ctx: Context, logger: Logger, nk: Nakama, envelope: any): any {
  if (envelope?.matchJoin?.token) beforeNativeApiClosed(ctx, logger, nk, envelope);
  return envelope;
}
