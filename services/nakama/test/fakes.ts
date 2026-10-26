// Fakes of the Nakama runtime for the game unit tests: an `nk` that records HTTP
// calls and storage writes, a dispatcher that records what it sends, kicks and
// labels, and a harness that drives the "billiards" handler like Nakama does.
import assert from 'node:assert/strict';
import { currentSeat } from '@billiards/modes';
import { OP, PROTOCOL_VERSION, decodeEnvelope } from '@billiards/protocol';
import { billiardsMatch } from '../src/match.ts';
import type { MatchMessage, Presence, StorageWrite } from '../src/nakama.ts';

export const logger = { debug() {}, info() {}, warn() {}, error() {} };
export const ctx = { env: {} as Record<string, string>, executionMode: 'match', matchId: 'match-1.nakama' };

/** The join metadata a client of this protocol version sends. */
export const JOIN = { protocolVersion: String(PROTOCOL_VERSION) };

export function presence(userId: string, sessionId = `s-${userId}`): Presence {
  return { userId, sessionId, username: `user-${userId}`, node: 'n' };
}

export interface HttpCall { url: string; method: string; headers: Record<string, string>; body: string; timeoutMs: number }

/** `binaryToString` decodes UTF-8 like the runtime; `httpRequest` answers 503 unless overridden. */
export function fakeNakama(overrides: Record<string, unknown> = {}) {
  const http: HttpCall[] = [];
  const writes: StorageWrite[] = [];
  const nk = {
    http,
    writes,
    binaryToString: (data: ArrayBuffer) => Buffer.from(data).toString('utf8'),
    httpRequest(url: string, method: string, headers: Record<string, string>, body: string, timeoutMs: number) {
      http.push({ url, method, headers, body, timeoutMs });
      return { code: 503, body: '' };
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

/** A billiards match driven like Nakama does: join attempts, joins, leaves and loop ticks. */
export function newGame(params: Record<string, unknown> = { mode: '8ball', format: '1v1', code: 'ABC234', private: true }) {
  const nk = fakeNakama();
  const dispatcher = fakeDispatcher();
  const { state, tickRate, label } = billiardsMatch.matchInit(ctx, logger, nk as any, params);
  return {
    state,
    tickRate,
    label,
    nk,
    dispatcher,
    attempt: (p: Presence, metadata: Record<string, unknown> = JOIN, tick = 0) =>
      billiardsMatch.matchJoinAttempt(ctx, logger, nk as any, dispatcher, tick, state, p, metadata),
    join: (presences: Presence[], tick = 0) => billiardsMatch.matchJoin(ctx, logger, nk as any, dispatcher, tick, state, presences),
    leave: (presences: Presence[], tick = 0) => billiardsMatch.matchLeave(ctx, logger, nk as any, dispatcher, tick, state, presences),
    loop: (tick: number, messages: MatchMessage[] = []) => billiardsMatch.matchLoop(ctx, logger, nk as any, dispatcher, tick, state, messages),
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
  return { ...game, a, b, shooter, waiter, seat };
}
