// The simulation service (D059): Nakama posts every accepted shot here, from
// inside the compose network, and gets the trajectory and the final table back.
// A shared secret guards POST /simulate; a registry of simulation versions lets
// versions N and N-1 run side by side during an update (spec §6.3).
import { createHash, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { simulateShot } from '@billiards/sim';
import type { ShotInput, ShotResult, TableState } from '@billiards/sim';
import { SIM_VERSION, bytesToBase64, encodeTrajectory } from '@billiards/protocol';

export type SimulateFn = (table: TableState, shot: ShotInput) => ShotResult;

export interface SimServerOptions {
  secret: string;
  /** Simulation functions by `simVersion`. */
  versions?: Record<number, SimulateFn>;
  maxBodyBytes?: number;
}

const DEFAULT_MAX_BODY_BYTES = 65536;

const digest = (text: string) => createHash('sha256').update(text).digest();

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(text), ...headers });
  res.end(text);
}

/** The body as text, or null when it exceeds `limit` bytes (the rest is discarded as it arrives). */
function readBody(req: IncomingMessage, limit: number): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let over = false;
    req.on('data', (chunk: Buffer) => {
      if (over) return;
      size += chunk.length;
      if (size > limit) {
        over = true;
        chunks.length = 0;
        resolve(null);
      } else {
        chunks.push(chunk);
      }
    });
    req.on('end', () => resolve(over ? null : Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** Builds the server without listening: the caller picks the port. */
export function createSimServer(options: SimServerOptions): Server {
  const { secret, maxBodyBytes = DEFAULT_MAX_BODY_BYTES } = options;
  const versions: Record<number, SimulateFn> = options.versions ?? { [SIM_VERSION]: simulateShot };
  if (typeof secret !== 'string' || secret === '') throw new Error('secret must not be empty');
  const expected = digest(secret);
  const versionList = Object.keys(versions).map(Number).sort((a, b) => a - b);

  // Digests have the same length whatever the input, which timingSafeEqual requires.
  const authorized = (given: unknown) => typeof given === 'string' && timingSafeEqual(digest(given), expected);

  async function simulate(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (!authorized(req.headers['x-sim-secret'])) return send(res, 401, { error: 'UNAUTHORIZED' });
    const tooLarge = () => send(res, 413, { error: 'BODY_TOO_LARGE' }, { connection: 'close' });
    if (Number(req.headers['content-length']) > maxBodyBytes) return tooLarge();
    const raw = await readBody(req, maxBodyBytes);
    if (raw === null) return tooLarge();

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return send(res, 400, { error: 'BAD_REQUEST' });
    }
    if (!isObject(body) || !isObject(body.table) || !isObject(body.shot)) return send(res, 400, { error: 'BAD_REQUEST' });
    const { simVersion } = body;
    if (typeof simVersion !== 'number' || !Object.hasOwn(versions, simVersion)) {
      return send(res, 400, { error: 'SIM_VERSION_UNSUPPORTED', versions: versionList });
    }

    let reply: Record<string, unknown>;
    try {
      const { frames, events, final, steps, simSeconds, capped } = versions[simVersion](body.table as TableState, body.shot as ShotInput);
      reply = { trajectory: bytesToBase64(encodeTrajectory(frames)), events, final, steps, simSeconds, capped };
    } catch (err) {
      return send(res, 400, { error: 'SIM_INPUT_INVALID', detail: err instanceof Error ? err.message : String(err) });
    }
    send(res, 200, reply);
  }

  return createServer((req, res) => {
    const path = (req.url ?? '').split('?')[0];
    if (req.method === 'GET' && path === '/healthz') return send(res, 200, { ok: true, versions: versionList });
    if (req.method === 'POST' && path === '/simulate') {
      simulate(req, res).catch(() => res.destroy());
      return;
    }
    send(res, 404, { error: 'NOT_FOUND' });
  });
}
