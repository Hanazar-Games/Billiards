// Test bots: Node clients of the local Nakama (spec §9.3), with helpers for
// RPC errors and socket events.
import { randomUUID } from 'node:crypto';
import { Client, type Session, type Socket } from '@heroiclabs/nakama-js';
import { NAKAMA } from './env.ts';

export interface Bot {
  client: Client;
  session: Session;
  deviceId: string;
  socket(): Promise<Socket>;
}

export function newClient(): Client {
  return new Client(NAKAMA.serverKey, NAKAMA.host, NAKAMA.port, false);
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
      if (!socket) {
        socket = client.createSocket(false, false);
        await socket.connect(session, true);
      }
      return socket;
    },
  };
}

/** Error thrown by the client for an HTTP failure, with the server's message. */
export async function serverError(err: unknown): Promise<Error> {
  if (err instanceof Response) {
    const body = await err.json().catch(() => ({}));
    return new Error(body.message ?? `HTTP ${err.status}`);
  }
  return err instanceof Error ? err : new Error(String(err));
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
