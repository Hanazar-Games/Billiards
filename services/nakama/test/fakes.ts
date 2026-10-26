// Fakes of the Nakama runtime for the game unit tests: an `nk` that records HTTP
// calls and storage writes and answers the sim like services/sim does, a
// dispatcher that records what it sends, kicks and labels, a logger that records
// its lines, and a harness that drives the "billiards" handler like Nakama does.
import assert from 'node:assert/strict';
import { currentSeat } from '@billiards/modes';
import { OP, PROTOCOL_VERSION, SIM_VERSION, bytesToBase64, decodeEnvelope, encodeTrajectory } from '@billiards/protocol';
import { simulateShot } from '@billiards/sim';
import { billiardsMatch } from '../src/match.ts';
import type { GameState } from '../src/game/state.ts';
import type { MatchMessage, Presence, StorageWrite } from '../src/nakama.ts';

export const logger = { debug() {}, info() {}, warn() {}, error() {} };
export const ctx = {
  env: { SIM_URL: 'http://sim.test:8080', SIM_SECRET: 'test-sim-secret' } as Record<string, string>,
  executionMode: 'match',
  matchId: 'match-1.nakama',
};

/** The join metadata a client of this protocol version sends. */
export const JOIN = { protocolVersion: String(PROTOCOL_VERSION) };

export function presence(userId: string, sessionId = `s-${userId}`): Presence {
  return { userId, sessionId, username: `user-${userId}`, node: 'n' };
}

export interface LogLine { level: 'debug' | 'info' | 'warn' | 'error'; text: string }

/** A logger that keeps each line, formatted like the runtime's (fmt.Sprintf with %v, %s or %d). */
export function recordingLogger() {
  const lines: LogLine[] = [];
  const at = (level: LogLine['level']) => (format: string, ...params: unknown[]) => {
    let i = 0;
    lines.push({ level, text: format.replace(/%[vsd]/g, () => String(params[i++])) });
  };
  return { lines, debug: at('debug'), info: at('info'), warn: at('warn'), error: at('error') };
}

export interface HttpCall { url: string; method: string; headers: Record<string, string>; body: string; timeoutMs: number }

/**
 * A programmed answer of the sim, used before the real one: throw (a timeout or
 * network error), answer with an HTTP status, or answer 200 with this reply.
 */
export type SimScript = { throws: string } | { status: number; body?: string } | { reply: Record<string, unknown> };

/** A sim reply (200) with the trajectory of `frames` in base64, as services/sim sends it. */
export function simReply(fields: { final: unknown; events?: unknown[]; simSeconds?: number; capped?: boolean; frames?: Parameters<typeof encodeTrajectory>[0] }) {
  const simSeconds = fields.simSeconds ?? 2;
  const frames = fields.frames ?? [{ t: 1 / 30, balls: [{ id: 0, x: 0, z: -60, q: [0, 0, 0, 1] as [number, number, number, number] }] }];
  return {
    trajectory: bytesToBase64(encodeTrajectory(frames)),
    events: fields.events ?? [],
    final: fields.final,
    steps: Math.round(simSeconds * 360),
    simSeconds,
    capped: fields.capped ?? false,
  };
}

/** What services/sim answers to POST /simulate, with the real simulateShot. */
function realSim(url: string, method: string, headers: Record<string, string>, body: string): { code: number; body: string } {
  if (method.toLowerCase() !== 'post' || !url.endsWith('/simulate')) return { code: 404, body: '{"error":"NOT_FOUND"}' };
  if (headers['x-sim-secret'] !== ctx.env.SIM_SECRET) return { code: 401, body: '{"error":"UNAUTHORIZED"}' };
  const request = JSON.parse(body);
  if (request.simVersion !== SIM_VERSION) return { code: 400, body: '{"error":"SIM_VERSION_UNSUPPORTED"}' };
  try {
    const { frames, events, final, steps, simSeconds, capped } = simulateShot(request.table, request.shot);
    return { code: 200, body: JSON.stringify({ trajectory: bytesToBase64(encodeTrajectory(frames)), events, final, steps, simSeconds, capped }) };
  } catch (err) {
    return { code: 400, body: JSON.stringify({ error: 'SIM_INPUT_INVALID', detail: String(err) }) };
  }
}

/**
 * `binaryToString` decodes UTF-8 like the runtime; `httpRequest` plays `sim` (the
 * programmed answers, in order) and then answers like services/sim.
 */
export function fakeNakama(overrides: Record<string, unknown> = {}) {
  const http: HttpCall[] = [];
  const writes: StorageWrite[] = [];
  const sim: SimScript[] = [];
  const nk = {
    http,
    writes,
    sim,
    binaryToString: (data: ArrayBuffer) => Buffer.from(data).toString('utf8'),
    httpRequest(url: string, method: string, headers: Record<string, string>, body: string, timeoutMs: number) {
      http.push({ url, method, headers, body, timeoutMs });
      const script = sim.shift();
      if (!script) return realSim(url, method, headers, body);
      if ('throws' in script) throw new Error(script.throws);
      if ('status' in script) return { code: script.status, body: script.body ?? '{"error":"FAILED"}' };
      return { code: 200, body: JSON.stringify(script.reply) };
    },
    storageWrite(list: StorageWrite[]) {
      writes.push(...list);
      return [];
    },
    ...overrides,
  };
  return nk as typeof nk & Record<string, any>;
}

export interface Sent { op: number; data: string | ArrayBuffer | null; presences: Presence[] | null }

export function fakeDispatcher() {
  const sent: Sent[] = [];
  const kicked: Presence[] = [];
  const labels: string[] = [];
  return {
    sent,
    kicked,
    labels,
    broadcastMessage(op: number, data: string | ArrayBuffer | null, presences?: Presence[] | null) {
      sent.push({ op, data, presences: presences ?? null });
    },
    matchKick(presences: Presence[]) {
      kicked.push(...presences);
    },
    matchLabelUpdate(label: string) {
      labels.push(label);
    },
  };
}

/** A message as the runtime delivers it: `data` is an ArrayBuffer of exactly the UTF-8 bytes. */
export function message(sender: Presence, opCode: number, body: unknown): MatchMessage {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  const bytes = Buffer.from(text, 'utf8');
  return { sender, opCode, data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer };
}

export interface Decoded { op: number; to: Presence[] | null; header?: any; payload?: Uint8Array; body?: any }

/** Reads the envelope of 101 and 105 (which must go as ArrayBuffer) and the JSON of every other operation. */
export function decodeSent(sent: Sent[]): Decoded[] {
  return sent.map(({ op, data, presences }) => {
    if (op === OP.MATCH_SNAPSHOT || op === OP.SHOT_RESULT) {
      assert.ok(data instanceof ArrayBuffer, `op ${op} goes as an ArrayBuffer`);
      const { header, payload } = decodeEnvelope(new Uint8Array(data as ArrayBuffer));
      return { op, to: presences, header, payload };
    }
    assert.equal(typeof data, 'string', `op ${op} goes as JSON text`);
    return { op, to: presences, body: JSON.parse(data as string) };
  });
}

/**
 * Between handler calls Nakama's JS match core exports the state to Go and back,
 * and a Go map keeps no key order. This does the same round trip, deterministically:
 * a deep copy whose objects list their keys in descending order, keys added later included.
 * The state must be plain JSON (R10): a binary value or a function in it throws.
 */
export function roundTrip<T>(value: T): T {
  if (Array.isArray(value)) return value.map(roundTrip) as T;
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer || typeof value === 'function') {
    throw new TypeError(`the match state must be plain JSON, found ${Object.prototype.toString.call(value)}`);
  }
  if (value === null || typeof value !== 'object') return value;
  const copy: Record<string, unknown> = {};
  for (const key of Object.keys(value)) copy[key] = roundTrip((value as Record<string, unknown>)[key]);
  return new Proxy(copy, { ownKeys: (target) => (Reflect.ownKeys(target) as string[]).sort().reverse() }) as T;
}

/** A billiards match driven like Nakama does: join attempts, joins, leaves and loop ticks, with the state round trip. */
export function newGame(params: Record<string, unknown> = { mode: '8ball', format: '1v1', code: 'ABC234', private: true }) {
  const nk = fakeNakama();
  const dispatcher = fakeDispatcher();
  const logger = recordingLogger();
  const init = billiardsMatch.matchInit(ctx, logger, nk as any, params);
  let state = roundTrip(init.state);
  const keep = <R extends { state: GameState } | null>(result: R): R => {
    if (result) state = roundTrip(result.state);
    return result;
  };
  return {
    /** The state the next call gets (a new copy after every call). */
    get state() { return state; },
    tickRate: init.tickRate,
    label: init.label,
    nk,
    dispatcher,
    /** Every line logged so far. */
    logs: logger.lines,
    attempt: (p: Presence, metadata: Record<string, unknown> = JOIN, tick = 0) =>
      keep(billiardsMatch.matchJoinAttempt(ctx, logger, nk as any, dispatcher, tick, state, p, metadata)),
    join: (presences: Presence[], tick = 0) => keep(billiardsMatch.matchJoin(ctx, logger, nk as any, dispatcher, tick, state, presences)),
    leave: (presences: Presence[], tick = 0) => keep(billiardsMatch.matchLeave(ctx, logger, nk as any, dispatcher, tick, state, presences)),
    loop: (tick: number, messages: MatchMessage[] = []) => keep(billiardsMatch.matchLoop(ctx, logger, nk as any, dispatcher, tick, state, messages)),
    /** The node shuts down: Nakama gives the match `graceSeconds` to finish. */
    terminate: (tick: number, graceSeconds = 10) =>
      keep(billiardsMatch.matchTerminate(ctx, logger, nk as any, dispatcher, tick, state, graceSeconds)),
    /** What the dispatcher sent so far, decoded; `clear()` forgets it. */
    out: () => decodeSent(dispatcher.sent),
    clear: () => { dispatcher.sent.length = 0; },
  };
}

/** Players `a` and `b` joined (in that order) and the match started; `shooter` has the turn. */
export function startedGame(mode = '8ball', params: Record<string, unknown> = {}) {
  const game = newGame({ mode, format: '1v1', code: 'ABC234', private: true, ...params });
  const a = presence('a');
  const b = presence('b');
  game.join([a]);
  game.join([b]);
  const seat = currentSeat(game.state.match!)!;
  const shooter = seat === 0 ? a : b;
  const waiter = seat === 0 ? b : a;
  game.clear();
  // Object.assign keeps the `state` getter (a spread would freeze its current value).
  return Object.assign(game, { a, b, shooter, waiter, seat });
}
