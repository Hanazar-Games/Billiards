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
  'filhadaputa', 'vagabund', 'putaria', 'estupr', 'pedofil', 'nazis', 'hitler', 'babaca', 'retardad',
  'mongoloid', 'escrot', 'desgracad', 'piroca', 'pentelh',
];

/**
 * Short or ambiguous words ("puta" is inside "computador", "otario" inside "notario"):
 * refused only as a whole part of the name or as parts joined across separators ("p_u_t_a").
 */
const BLOCKED_TOKENS = ['cu', 'fdp', 'vsf', 'pqp', 'tnc', 'krl', 'kct', 'puta', 'puto', 'viado', 'rola', 'foda', 'bosta', 'corno', 'xota', 'pau', 'otario'];

const LEET: Record<string, string> = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't' };

/** Trimmed, lowercase, without accents. */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Letters only, with leetspeak digits read as letters. */
function letters(name: string): string {
  return name.replace(/[013457]/g, (d) => LEET[d]).replace(/[^a-z]/g, '');
}

/** Runs of a letter cut to at most `max` ("porrrra" → "porra" with 2, "pora" with 1). */
function collapse(text: string, max: number): string {
  return text.replace(/(.)\1+/g, (run) => run[0].repeat(Math.min(run.length, max)));
}

const skeleton = (name: string) => collapse(letters(name), 1);

/**
 * A word with a double letter ("porra") is compared with runs cut to two, so it
 * does not match "temporada"; the others with runs cut to one.
 */
const WORD_CHECKS = BLOCKED_WORDS.map((word) => {
  const plain = letters(word);
  const max = collapse(plain, 1) === plain ? 1 : 2;
  return { max, word: collapse(plain, max) };
});
const SKELETON_TOKENS = BLOCKED_TOKENS.map(skeleton);

/** Every run of consecutive parts joined ("p", "pu", "put", "puta", "u"…). */
function joinedRuns(parts: string[]): string[] {
  const runs: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j <= parts.length; j++) runs.push(parts.slice(i, j).join(''));
  }
  return runs;
}

export function validateUsername(raw: string): UsernameValidation {
  const username = typeof raw === 'string' ? normalizeUsername(raw) : '';
  if (!/^[a-z0-9_]{3,16}$/.test(username)) return { ok: false, reason: 'USERNAME_INVALID' };
  const forms = [collapse(letters(username), 1), collapse(letters(username), 2)];
  if (WORD_CHECKS.some(({ max, word }) => forms[max - 1].includes(word))) return { ok: false, reason: 'USERNAME_INVALID' };
  // Parts split by "_" (read through leetspeak) and runs of letters split by anything else,
  // alone or joined across the separators.
  const runs = [...joinedRuns(username.split('_').map(letters)), ...joinedRuns(username.split(/[^a-z]+/))];
  if (runs.some((run) => SKELETON_TOKENS.includes(collapse(run, 1)))) return { ok: false, reason: 'USERNAME_INVALID' };
  return { ok: true, username };
}

/** `preset:<id>` with an id from AVATAR_PRESETS, or null. */
export function parseAvatar(raw: string): string | null {
  const match = typeof raw === 'string' ? /^preset:([a-z0-9]+)$/.exec(raw) : null;
  return match && AVATAR_PRESETS.includes(match[1]) ? raw : null;
}
