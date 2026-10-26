// Test bots: Node clients of the local Nakama (spec §9.3), with helpers for
// RPC errors and socket events.
import { randomUUID } from 'node:crypto';
import { Client, type Session, type Socket, type StorageObject } from '@heroiclabs/nakama-js';
import { NAKAMA } from './env.ts';

export interface Bot {
  client: Client;
  session: Session;
  deviceId: string;
  socket(): Promise<Socket>;
}

/** Every socket a bot opened, closed by closeBots() so the test process can exit. */
const openSockets = new Set<Socket>();

export function closeBots(): void {
  for (const socket of openSockets) socket.disconnect(false);
  openSockets.clear();
}

export function newClient(): Client {
  return new Client(NAKAMA.serverKey, NAKAMA.host, NAKAMA.port, false);
}

/** A new connected socket of the bot's session, closed by closeBots(). */
export async function openSocket(bot: Pick<Bot, 'client' | 'session'>): Promise<Socket> {
  const socket = bot.client.createSocket(false, false);
  await socket.connect(bot.session, true);
  openSockets.add(socket);
  return socket;
}

/** A guest with a fresh device id. */
export async function newBot(): Promise<Bot> {
  const client = newClient();
  const deviceId = randomUUID();
  const session = await client.authenticateDevice(deviceId, true);
  let socket: Socket | null = null;
  return {
    client,
    session,
    deviceId,
    async socket() {
      if (!socket) socket = await openSocket({ client, session });
      return socket;
    },
  };
}

/** Error thrown by the client for an HTTP failure or a socket error ({ code, message }), with the server's message. */
export async function serverError(err: unknown): Promise<Error> {
  if (err instanceof Response) {
    const body = await err.json().catch(() => ({}));
    return new Error(body.message ?? `HTTP ${err.status}`);
  }
  if (err instanceof Error) return err;
  const message = (err as { message?: unknown } | null)?.message;
  return new Error(typeof message === 'string' ? message : String(err));
}

/** Awaits a client call; rejects with the server's message instead of a Response. */
export async function call<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (err) {
    throw await serverError(err);
  }
}

/** Calls an RPC and returns its payload; rejects with the server's message. */
export async function rpc(bot: Bot, id: string, input: object): Promise<any> {
  try {
    return (await bot.client.rpc(bot.session, id, input)).payload;
  } catch (err) {
    throw await serverError(err);
  }
}

/** Resolves with the first event the socket raises on `handler` (e.g. 'onmatchmakermatched'). */
export function once<T = any>(socket: Socket, handler: keyof Socket): Promise<T> {
  return new Promise((resolve) => { (socket as any)[handler] = (event: T) => resolve(event); });
}

/** Rejects with `what` if `promise` takes longer than `ms`. */
export function withTimeout<T>(promise: Promise<T>, ms: number, what = 'event'): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`timed out waiting for ${what}`)), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retries `attempt` every 200 ms until it settles the way `done` accepts, for up to `ms`.
 * A new room reaches Nakama's label listing after a short indexing delay.
 */
export async function eventually<T>(attempt: () => Promise<T>, done: (result: { ok: true; value: T } | { ok: false; error: Error }) => boolean, ms = 5000) {
  const deadline = Date.now() + ms;
  for (;;) {
    let result: { ok: true; value: T } | { ok: false; error: Error };
    try { result = { ok: true, value: await attempt() }; } catch (error) { result = { ok: false, error: error as Error }; }
    if (done(result) || Date.now() >= deadline) return result;
    await sleep(200);
  }
}

/** join_by_code once the room is listed (ROOM_NOT_FOUND only while it is being indexed). */
export async function joinByCode(bot: Bot, code: string) {
  const result = await eventually(() => rpc(bot, 'join_by_code', { code }), (r) => r.ok || !/ROOM_NOT_FOUND/.test(r.error.message));
  if (!result.ok) throw result.error;
  return result.value;
}

/**
 * The object with `key` in `userId`'s `collection`, found by listing it page by page along the
 * cursor until it turns up or the listing ends (undefined). Nakama pages by key, and the keys of
 * the match history are random match ids, so on a database that keeps its records (a local volume,
 * the `server` machine) the object can be on any page.
 */
export async function findStorageObject(bot: Pick<Bot, 'client' | 'session'>, collection: string, userId: string, key: string): Promise<StorageObject | undefined> {
  let cursor: string | undefined;
  do {
    const page = await call(bot.client.listStorageObjects(bot.session, collection, userId, 100, cursor));
    const found = page.objects.find((o) => o.key === key);
    if (found) return found;
    cursor = page.cursor || undefined;
  } while (cursor);
  return undefined;
}
