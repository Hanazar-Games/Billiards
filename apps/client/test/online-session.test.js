// F4-B: the online session over nakama-js (D063): device account, RPCs, queue,
// joining a match with the protocol version, decoding and reconnection.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OP, encodeEnvelope } from '@billiards/protocol';
import { OnlineSession, OnlineError } from '../src/online/OnlineSession.js';

const CONFIG = { host: 'h', port: '7350', useSSL: false, serverKey: 'k', url: 'http://h:7350' };

function memoryStorage() {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k), map };
}

/** Manual clock and timers: advance(ms) runs what is due. */
function fakeTime() {
  let now = 1_000_000;
  let timers = [];
  const clock = {
    now: () => now,
    setTimer: (fn, ms) => { const t = { at: now + ms, fn }; timers.push(t); return t; },
    clearTimer: (t) => { timers = timers.filter((x) => x !== t); },
    async advance(ms) {
      const end = now + ms;
      // Async chains (a rejected fetch's body, a reconnection) register their
      // timer a few event-loop turns later: let them settle before each look.
      const settle = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r)); };
      for (;;) {
        await settle();
        timers.sort((a, b) => a.at - b.at);
        const next = timers[0];
        if (!next || next.at > end) break;
        timers.shift();
        now = next.at;
        next.fn();
      }
      now = end;
      await settle();
    },
  };
  return clock;
}

class FakeSocket {
  constructor(server) { this.server = server; this.sent = []; this.ondisconnect = () => {}; this.onmatchdata = () => {}; this.onmatchpresence = () => {}; this.onmatchmakermatched = () => {}; }
  async connect(session) { this.server.connects++; if (this.server.connectFails > 0) { this.server.connectFails--; throw new Error('offline'); } this.session = session; }
  disconnect(fire) { if (fire) this.ondisconnect({}); }
  async joinMatch(matchId, token, metadata) {
    this.server.joins.push({ matchId, metadata });
    const err = this.server.joinErrors.shift();
    if (err) throw { code: 3, message: err };
    return { match_id: matchId, self: { session_id: `s${this.server.joins.length}`, user_id: 'u1' } };
  }
  async leaveMatch(matchId) { this.server.left.push(matchId); }
  async addMatchmaker(query, min, max, props) { this.server.tickets.push({ query, min, max, props }); return { ticket: 't1' }; }
  async removeMatchmaker(ticket) { this.server.removed.push(ticket); }
  sendMatchState(matchId, op, data) { this.sent.push({ matchId, op, data }); }
}

function fakeServer() {
  const server = {
    connects: 0, connectFails: 0, joins: [], joinErrors: [], left: [], tickets: [], removed: [], sockets: [], auths: [], rpcs: [], refreshes: 0,
    rpcAnswers: {},
    expiresAt: Infinity,
    client: {
      async authenticateDevice(id, create) { server.auths.push({ id, create }); return session(); },
      async sessionRefresh() { server.refreshes++; server.expiresAt = Infinity; return session(); },
      async rpc(_s, id, input) {
        server.rpcs.push({ id, input });
        const answers = server.rpcAnswers[id] ?? [{ ok: {} }];
        const next = answers.length > 1 ? answers.shift() : answers[0];
        if (next.error) throw new Response(JSON.stringify({ message: next.error }), { status: 400 });
        return { id, payload: next.ok };
      },
      createSocket() { const s = new FakeSocket(server); server.sockets.push(s); return s; },
    },
  };
  function session() {
    return { user_id: 'u1', username: 'guest', token: 't', isexpired: (sec) => sec * 1000 >= server.expiresAt };
  }
  return server;
}

function newSession(server, { storage = memoryStorage(), time = fakeTime() } = {}) {
  const session = new OnlineSession({ config: CONFIG, storage, createClient: () => server.client, setTimer: time.setTimer, clearTimer: time.clearTimer, now: time.now });
  return { session, storage, time };
}

const lastSocket = (server) => server.sockets[server.sockets.length - 1];

test('o id do dispositivo é criado uma vez e reaproveitado', async () => {
  const server = fakeServer();
  const storage = memoryStorage();
  const a = newSession(server, { storage });
  assert.deepEqual(await a.session.start(), { userId: 'u1', username: 'guest' });
  const b = newSession(server, { storage });
  await b.session.start();
  assert.equal(server.auths.length, 2);
  assert.equal(server.auths[0].id, server.auths[1].id);
  assert.equal(server.auths[0].create, true);
  assert.equal(storage.getItem('billiards.online.deviceId'), server.auths[0].id);
});

test('entrar na partida manda protocolVersion e guarda o matchId', async () => {
  const server = fakeServer();
  const { session, storage } = newSession(server);
  await session.start();
  await session.joinMatch('m1');
  assert.deepEqual(server.joins, [{ matchId: 'm1', metadata: { protocolVersion: '1' } }]);
  assert.equal(session.storedMatchId(), 'm1');
  assert.equal(storage.getItem('billiards.online.matchId'), 'm1');
  session.forgetMatch();
  assert.equal(session.storedMatchId(), null);
});

test('PROTOCOL_MISMATCH vira OnlineError e não é tentado de novo', async () => {
  const server = fakeServer();
  server.joinErrors.push('PROTOCOL_MISMATCH');
  const { session } = newSession(server);
  await session.start();
  await assert.rejects(session.joinMatch('m1'), (err) => err instanceof OnlineError && err.code === 'PROTOCOL_MISMATCH');
  assert.equal(server.joins.length, 1);
  assert.equal(session.storedMatchId(), null);
});

test('MATCH_ENDED apaga o matchId guardado', async () => {
  const server = fakeServer();
  const { session, storage } = newSession(server);
  storage.setItem('billiards.online.matchId', 'm9');
  server.joinErrors.push('MATCH_ENDED');
  await session.start();
  await assert.rejects(session.joinMatch('m9'), (err) => err.code === 'MATCH_ENDED');
  assert.equal(session.storedMatchId(), null);
});

test('erros das RPCs viram OnlineError com o código; o resto é NETWORK', async () => {
  const server = fakeServer();
  server.rpcAnswers.profile_update = [{ error: 'USERNAME_TAKEN' }];
  server.rpcAnswers.create_private_match = [{ error: 'something odd' }];
  const { session } = newSession(server);
  await session.start();
  await assert.rejects(session.setUsername('ana'), (err) => err.code === 'USERNAME_TAKEN');
  await assert.rejects(session.createRoom('8ball'), (err) => err.code === 'NETWORK');
  server.rpcAnswers.profile_update = [{ ok: { username: 'ana_1' } }];
  assert.equal(await session.setUsername('Ana 1'), 'ana_1');
  assert.deepEqual(server.rpcs.at(-1), { id: 'profile_update', input: { username: 'Ana 1' } });
});

test('sala recém-criada: ROOM_NOT_FOUND é tentado de novo por até 3 s', async () => {
  const server = fakeServer();
  server.rpcAnswers.create_private_match = [{ ok: { matchId: 'm2', code: 'ABC234' } }];
  server.rpcAnswers.join_by_code = [{ error: 'ROOM_NOT_FOUND' }, { error: 'ROOM_NOT_FOUND' }, { ok: { matchId: 'm2' } }];
  const { session, time } = newSession(server);
  await session.start();
  assert.deepEqual(await session.createRoom('8ball'), { matchId: 'm2', code: 'ABC234' });
  assert.deepEqual(server.rpcs.at(-1).input, { mode: '8ball', format: '1v1' });
  const joined = session.joinByCode('ABC234');
  await time.advance(1000);
  assert.equal(await joined, 'm2');
  assert.equal(server.rpcs.filter((r) => r.id === 'join_by_code').length, 3);

  server.rpcAnswers.join_by_code = [{ error: 'ROOM_NOT_FOUND' }];
  const missing = session.joinByCode('ZZZ999');
  const outcome = assert.rejects(missing, (err) => err.code === 'ROOM_NOT_FOUND');
  await time.advance(4000);
  await outcome;
});

test('a fila manda as propriedades do modo e resolve com a partida formada; cancelar remove o bilhete', async () => {
  const server = fakeServer();
  const { session } = newSession(server);
  await session.start();
  const matched = session.queue('9ball');
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(server.tickets[0], { query: '+properties.mode:9ball +properties.format:1v1', min: 2, max: 2, props: { mode: '9ball', format: '1v1' } });
  lastSocket(server).onmatchmakermatched({ ticket: 't1', match_id: 'm3' });
  assert.equal(await matched, 'm3');
  const pending = session.queue('8ball');
  await new Promise((r) => setImmediate(r));
  await session.cancelQueue();
  await assert.rejects(pending, (err) => err.code === 'CANCELLED');
  assert.deepEqual(server.removed, ['t1']);
});

test('mensagens 101 e 105 chegam decodificadas; as outras em JSON', async (t) => {
  const server = fakeServer();
  const { session } = newSession(server);
  await session.start();
  await session.joinMatch('m1');
  const got = [];
  session.addEventListener('message', (e) => got.push(e.detail));
  const socket = lastSocket(server);
  socket.onmatchdata({ match_id: 'm1', op_code: OP.SHOT_RESULT, data: encodeEnvelope({ kind: 'shot' }, Uint8Array.of(1, 2)) });
  socket.onmatchdata({ match_id: 'm1', op_code: OP.SHOT_REJECTED, data: new TextEncoder().encode('{"seq":3,"reason":"NOT_YOUR_TURN"}') });
  const warn = t.mock.method(console, 'warn', () => {});
  socket.onmatchdata({ match_id: 'm1', op_code: OP.SHOT_REJECTED, data: new TextEncoder().encode('{nope') });
  assert.equal(got.length, 2);
  assert.deepEqual(got[0].header, { kind: 'shot' });
  assert.deepEqual([...got[0].payload], [1, 2]);
  assert.deepEqual(got[1], { op: OP.SHOT_REJECTED, body: { seq: 3, reason: 'NOT_YOUR_TURN' } });
  session.send(OP.SHOT_REQUEST, { turnId: 1 });
  session.send(OP.CONCEDE);
  assert.deepEqual(socket.sent, [{ matchId: 'm1', op: OP.SHOT_REQUEST, data: '{"turnId":1}' }, { matchId: 'm1', op: OP.CONCEDE, data: '' }]);
  assert.equal(warn.mock.callCount(), 1);
});

test('queda: reconecta e entra de novo na partida; depois de 60 s emite offline', async () => {
  const server = fakeServer();
  const { session, time } = newSession(server);
  const states = [];
  session.addEventListener('connection', (e) => states.push(e.detail.state));
  await session.start();
  await session.joinMatch('m1');
  server.connectFails = 3; // the attempts at 1 s, 3 s and 7 s fail; the one at 15 s connects
  session.dropConnection();
  await time.advance(14_000);
  assert.deepEqual(states, ['reconnecting']);
  await time.advance(1_000);
  assert.deepEqual(states, ['reconnecting', 'online']);
  assert.equal(server.joins.at(-1).matchId, 'm1');
  assert.equal(server.joins.length, 2);

  server.connectFails = 1000;
  lastSocket(server).disconnect(true);
  await time.advance(59_000);
  assert.equal(states.at(-1), 'reconnecting');
  await time.advance(10_000);
  assert.equal(states.at(-1), 'offline');
});

test('sessão perto de expirar é renovada antes de reconectar', async () => {
  const server = fakeServer();
  const { session, time } = newSession(server);
  await session.start();
  await session.joinMatch('m1');
  server.expiresAt = time.now() + 30_000; // within the 60 s margin
  session.dropConnection();
  await time.advance(1_000);
  assert.equal(server.refreshes, 1);
  assert.equal(server.joins.length, 2);
});

test('tirada da partida por outra aba: emite replaced e não entra de novo', async () => {
  const server = fakeServer();
  const { session, time } = newSession(server);
  const states = [];
  session.addEventListener('connection', (e) => states.push(e.detail.state));
  await session.start();
  await session.joinMatch('m1');
  lastSocket(server).onmatchpresence({ match_id: 'm1', joins: [], leaves: [{ session_id: 'someone-else', user_id: 'u2' }] });
  assert.deepEqual(states, []);
  lastSocket(server).onmatchpresence({ match_id: 'm1', joins: [], leaves: [{ session_id: 's1', user_id: 'u1' }] });
  assert.deepEqual(states, ['replaced']);
  await time.advance(70_000);
  assert.equal(server.joins.length, 1);
  assert.equal(session.storedMatchId(), 'm1');
});

test('a partida que terminou durante a queda dá offline com o motivo', async () => {
  const server = fakeServer();
  const { session, time } = newSession(server);
  const events = [];
  session.addEventListener('connection', (e) => events.push(e.detail));
  await session.start();
  await session.joinMatch('m1');
  server.joinErrors.push('MATCH_ENDED');
  session.dropConnection();
  await time.advance(1_000);
  assert.deepEqual(events.at(-1), { state: 'offline', reason: 'MATCH_ENDED' });
  assert.equal(session.storedMatchId(), null);
});
