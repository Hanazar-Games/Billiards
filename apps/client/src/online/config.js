/**
 * Where the online client finds the Nakama server (D063): VITE_NAKAMA_URL and
 * VITE_NAKAMA_SERVER_KEY at build time. A development build without a URL
 * talks to the local stack; a production build without one has no online play.
 */

const DEV_URL = 'http://127.0.0.1:7350';
/** Nakama's own default server key: public configuration, not a secret (D065). */
const DEFAULT_SERVER_KEY = 'defaultkey';

/**
 * @param {Record<string, any> | undefined} env Vite's import.meta.env (tests pass their own)
 * @returns {{ host: string, port: string, useSSL: boolean, serverKey: string, url: string } | null}
 */
export function onlineConfig(env = import.meta.env) {
  const raw = env?.VITE_NAKAMA_URL || (env?.DEV ? DEV_URL : '');
  if (!raw) return null;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    parsed = null;
  }
  if (!parsed || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')) {
    console.warn(`[online] VITE_NAKAMA_URL is not an http(s) URL: ${raw}`);
    return null;
  }
  const useSSL = parsed.protocol === 'https:';
  return {
    host: parsed.hostname,
    port: parsed.port || (useSSL ? '443' : '80'),
    useSSL,
    serverKey: env.VITE_NAKAMA_SERVER_KEY || DEFAULT_SERVER_KEY,
    url: raw.replace(/\/+$/, ''),
  };
}
