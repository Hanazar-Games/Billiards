// Private-room codes and match configs (spec §7.5). Runs in the Nakama runtime
// (goja) too. The caller passes the modes (packages/modes MODES), so this
// package keeps no dependencies (spec §5.1).

/** No 0/O or 1/I, which read alike. */
export const ROOM_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const ROOM_CODE = new RegExp(`^[${ROOM_CODE_ALPHABET}]{6}$`);

/** @param random a source in [0, 1) */
export function generateRoomCode(random: () => number): string {
  let code = '';
  for (let i = 0; i < 6; i++) code += ROOM_CODE_ALPHABET[Math.floor(random() * ROOM_CODE_ALPHABET.length)];
  return code;
}

/** A typed code, trimmed and uppercased, or null if it is not one. */
export function parseRoomCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase();
  return ROOM_CODE.test(code) ? code : null;
}

export interface MatchConfigRequest { mode: string; format: '1v1' }

/** A known mode in a format it supports; only 1×1 in F3. */
export function parseMatchConfig(raw: unknown, modes: Record<string, { formats: readonly string[] }>): MatchConfigRequest | null {
  if (!raw || typeof raw !== 'object') return null;
  const { mode, format } = raw as { mode?: unknown; format?: unknown };
  if (typeof mode !== 'string' || !Object.prototype.hasOwnProperty.call(modes, mode)) return null;
  if (format !== '1v1' || !modes[mode].formats.includes(format)) return null;
  return { mode, format };
}
