// Where the integration tests find the local stack (npm run infra:up).
// The keys default to the development values of infra/.env.example.

export const NAKAMA = {
  host: '127.0.0.1',
  port: '7350',
  serverKey: process.env.NAKAMA_SERVER_KEY ?? 'defaultkey',
  httpKey: process.env.NAKAMA_HTTP_KEY ?? 'dev-http-key',
};

export const BASE_URL = `http://${NAKAMA.host}:${NAKAMA.port}`;

/** Resolves once GET /healthcheck answers 200; fails after `timeoutMs`. */
export async function waitForNakama(timeoutMs = 60000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/healthcheck`);
      if (res.status === 200) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('Nakama não está no ar: rode npm run infra:up');
}
