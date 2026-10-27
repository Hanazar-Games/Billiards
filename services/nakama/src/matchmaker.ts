// 1×1 matchmaking (spec §7.5): when the matchmaker pairs players whose tickets
// carry the same valid mode and format, the server creates the authoritative
// "billiards" match and sends them there. Anything else creates nothing.
import { MODES } from '@billiards/modes';
import { parseMatchConfig } from '@billiards/protocol';
import type { Context, Logger, MatchmakerResult, Nakama } from './nakama.ts';

export function matchmakerMatched(_ctx: Context, logger: Logger, nk: Nakama, matches: MatchmakerResult[]): string | void {
  if (matches.length === 0) return;
  const { mode, format } = matches[0].properties;
  const config = parseMatchConfig({ mode, format }, MODES);
  const same = matches.every((m) => m.properties.mode === mode && m.properties.format === format);
  if (!config || !same) {
    logger.warn('matchmaker: no match for properties %s', JSON.stringify(matches.map((m) => m.properties)));
    return;
  }
  return nk.matchCreate('billiards', { mode: config.mode, format: config.format, private: false });
}
