// Public usernames and avatar presets (spec §8.1, D052). Usernames are 3–16
// characters [a-z0-9_], stored lowercase without accents, and must not carry
// an improper PT-BR word, even disguised by case, accents, leetspeak,
// separators or repeated letters. Runs in the Nakama runtime (goja) too.

export const AVATAR_PRESETS: readonly string[] = Object.freeze(
  ['a01', 'a02', 'a03', 'a04', 'a05', 'a06', 'a07', 'a08', 'a09', 'a10', 'a11', 'a12']);

export type UsernameValidation = { ok: true; username: string } | { ok: false; reason: 'USERNAME_INVALID' };

/** Distinctive words: refused anywhere inside the name's skeleton. */
const BLOCKED_WORDS = [
  'merda', 'porra', 'caralho', 'buceta', 'cacete', 'arrombad', 'punheta', 'siririca', 'boquete', 'xoxota', 'cuzao',
  'filhadaputa', 'vagabund', 'putaria', 'estupr', 'pedofil', 'nazis', 'hitler', 'otario', 'babaca', 'retardad',
  'mongoloid', 'escrot', 'desgracad', 'piroca', 'pentelh',
];

/** Short or ambiguous words ("puta" is inside "computador"): refused only as a whole part of the name. */
const BLOCKED_TOKENS = ['cu', 'fdp', 'vsf', 'pqp', 'tnc', 'krl', 'kct', 'puta', 'puto', 'viado', 'rola', 'foda', 'bosta', 'corno', 'xota', 'pau'];

const LEET: Record<string, string> = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't' };

/** Trimmed, lowercase, without accents. */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Letters only, with leetspeak digits read as letters and repeated letters merged. */
function skeleton(name: string): string {
  return name.replace(/[013457]/g, (d) => LEET[d]).replace(/[^a-z]/g, '').replace(/(.)\1+/g, '$1');
}

const SKELETON_WORDS = BLOCKED_WORDS.map(skeleton);
const SKELETON_TOKENS = BLOCKED_TOKENS.map(skeleton);

export function validateUsername(raw: string): UsernameValidation {
  const username = typeof raw === 'string' ? normalizeUsername(raw) : '';
  if (!/^[a-z0-9_]{3,16}$/.test(username)) return { ok: false, reason: 'USERNAME_INVALID' };
  const whole = skeleton(username);
  if (SKELETON_WORDS.some((word) => whole.includes(word))) return { ok: false, reason: 'USERNAME_INVALID' };
  // Parts split by "_" (read through leetspeak) and runs of letters split by anything else.
  const parts = [...username.split('_').map(skeleton), ...username.split(/[^a-z]+/).map(skeleton)];
  if (parts.some((part) => SKELETON_TOKENS.includes(part))) return { ok: false, reason: 'USERNAME_INVALID' };
  return { ok: true, username };
}

/** `preset:<id>` with an id from AVATAR_PRESETS, or null. */
export function parseAvatar(raw: string): string | null {
  const match = typeof raw === 'string' ? /^preset:([a-z0-9]+)$/.exec(raw) : null;
  return match && AVATAR_PRESETS.includes(match[1]) ? raw : null;
}
