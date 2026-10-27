// F4-08: the online panel — entry, queue, private room and the return to a
// match — with a fake session, a fake controller and a recording view.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OnlinePanel, ONLINE_PANEL_TEXT } from '../src/menu/OnlinePanel.js';

const CONFIG = { host: 'h', port: '7350', useSSL: false, serverKey: 'k', url: 'http://h:7350' };

class FakeError extends Error { constructor(code) { super(code); this.code = code; } }

function fakeSession({ stored = null, joinError = null, usernameError = null } = {}) {
  const calls = [];
  let storedId = stored;
  // An EventTarget, like OnlineSession: the panel listens to its connection events.
  return Object.assign(new EventTarget(), {
    calls,
    async start() { calls.push(['start']); return { userId: 'u1', username: 'guest_1' }; },
    async setUsername(name) { calls.push(['setUsername', name]); if (usernameError) throw new FakeError(usernameError); return name.toLowerCase(); },
    async createRoom(mode) { calls.push(['createRoom', mode]); return { matchId: 'm-room', code: 'ABC234' }; },
    async joinByCode(code) { calls.push(['joinByCode', code]); return 'm-code'; },
    queue(mode) { calls.push(['queue', mode]); return new Promise((resolve, reject) => { this._queue = { resolve, reject }; }); },
    async cancelQueue() { calls.push(['cancelQueue']); this._queue?.reject(new FakeError('CANCELLED')); },
    async joinMatch(id) { calls.push(['joinMatch', id]); if (joinError) { const code = joinError; joinError = null; if (code === 'MATCH_ENDED') storedId = null; throw new FakeError(code); } storedId = id; },
    storedMatchId() { return storedId; },
    forgetMatch() { calls.push(['forgetMatch']); storedId = null; },
    async leaveMatch() { calls.push(['leaveMatch']); storedId = null; },
    close() { calls.push(['close']); },
  });
}

/** Lets the panel's promise chains run. */
const settle = async () => { for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r)); };

/** whenReady() that resolves only when the test says so. */
function gate() {
  let release;
  const ready = () => new Promise((resolve) => { release = resolve; });
  return { ready, release: () => release() };
}

function setup({ config = CONFIG, session = fakeSession(), ready = () => Promise.resolve() } = {}) {
  const renders = [];
  const view = { show() {}, hide() {}, destroy() {}, render(model) { renders.push({ ...model }); }, bind() {} };
  const started = [];
  const controllers = [];
  let created = 0;
  const panel = new OnlinePanel({
    config,
    createSession: () => { created++; return session; },
    createController: (opts) => { const c = { ...opts, whenReady: ready, dispose() { c.disposed = true; } }; controllers.push(c); return c; },
    onStart: (controller) => started.push(controller),
    onBack: () => {},
    view,
  });
  return { panel, session, renders, started, controllers, last: () => renders.at(-1), created: () => created };
}

test('sem servidor configurado, o online fica indisponível e nada conecta', async () => {
  const { panel, last, created } = setup({ config: null });
  await panel.show();
  assert.equal(created(), 0);
  assert.equal(last().message, ONLINE_PANEL_TEXT.unavailable);
  assert.equal(ONLINE_PANEL_TEXT.unavailable, 'Jogo online indisponível nesta versão');
});

test('PROTOCOL_MISMATCH pede para atualizar a página', async () => {
  const { panel, session, last } = setup({ session: fakeSession({ joinError: 'PROTOCOL_MISMATCH' }) });
  await panel.show();
  await panel.createRoom('8ball');
  assert.equal(last().message, 'O jogo foi atualizado. Recarregue a página.');
  assert.equal(session.calls.filter(([c]) => c === 'joinMatch').length, 1);
  assert.equal(last().state, 'lobby');
});

test('matchId guardado: o painel volta para a partida', async () => {
  const { panel, session, started, controllers } = setup({ session: fakeSession({ stored: 'm-old' }) });
  await panel.show();
  assert.deepEqual(session.calls.find(([c]) => c === 'joinMatch'), ['joinMatch', 'm-old']);
  assert.equal(started.length, 1);
  assert.equal(started[0], controllers[0]);
  assert.equal(controllers[0].matchId, 'm-old');
  assert.equal(controllers[0].modeId, null, 'the mode comes with the first snapshot');
});

test('matchId de partida que acabou é esquecido e o painel fica no saguão', async () => {
  const { panel, session, started, last } = setup({ session: fakeSession({ stored: 'm-old', joinError: 'MATCH_ENDED' }) });
  await panel.show();
  assert.equal(started.length, 0);
  assert.equal(session.storedMatchId(), null);
  assert.equal(last().state, 'lobby');
});

test('USERNAME_TAKEN mostra a mensagem e mantém o nome antigo', async () => {
  const { panel, last } = setup({ session: fakeSession({ usernameError: 'USERNAME_TAKEN' }) });
  await panel.show();
  await panel.setUsername('ana');
  assert.equal(last().message, 'Esse nome já existe');
  assert.equal(last().username, 'guest_1');
});

test('o código é normalizado antes de entrar', async () => {
  const { panel, session, started } = setup();
  await panel.show();
  await panel.joinByCode(' ab23cd ');
  assert.deepEqual(session.calls.find(([c]) => c === 'joinByCode'), ['joinByCode', 'AB23CD']);
  assert.deepEqual(session.calls.find(([c]) => c === 'joinMatch'), ['joinMatch', 'm-code']);
  assert.equal(started.length, 1);
});

test('criar sala mostra o código e espera o adversário', async () => {
  let release;
  const { panel, renders, started } = setup({ ready: () => new Promise((r) => { release = r; }) });
  await panel.show();
  const entering = panel.createRoom('9ball');
  await new Promise((r) => setImmediate(r));
  const waiting = renders.at(-1);
  assert.equal(waiting.state, 'room');
  assert.equal(waiting.code, 'ABC234');
  assert.equal(waiting.message, 'Aguardando o adversário…');
  release();
  await entering;
  assert.equal(started.length, 1);
  assert.equal(started[0].modeId, '9ball');
});

test('cancelar a fila remove o bilhete', async () => {
  const { panel, session, last, started } = setup();
  await panel.show();
  const queued = panel.queue('8ball');
  await new Promise((r) => setImmediate(r));
  assert.equal(last().state, 'queue');
  assert.equal(last().message, 'Procurando adversário…');
  await panel.cancelQueue();
  await queued;
  assert.ok(session.calls.some(([c]) => c === 'cancelQueue'));
  assert.equal(last().state, 'lobby');
  assert.equal(started.length, 0);
});

test('adversário que não aparece: o painel volta ao saguão com aviso', async () => {
  const ended = () => Promise.reject(Object.assign(new Error('ended'), { end: { reason: 'ABORTED', winnerTeam: null } }));
  const { panel, session, last, started, controllers } = setup({ ready: ended });
  await panel.show();
  const queued = panel.queue('8ball');
  await new Promise((r) => setImmediate(r));
  session._queue.resolve('m-q');
  await queued;
  assert.equal(started.length, 0);
  assert.equal(last().message, 'O adversário não apareceu');
  assert.equal(last().state, 'lobby');
  assert.ok(session.calls.some(([c]) => c === 'forgetMatch'));
  assert.equal(controllers[0].disposed, true);
});

test('cancelar a sala sai da partida e o jogo não começa depois', async () => {
  const { ready, release } = gate();
  const { panel, session, started, controllers, last } = setup({ ready });
  await panel.show();
  const creating = panel.createRoom('8ball');
  await settle();
  assert.equal(last().state, 'room');
  await panel.cancel();
  assert.equal(session.calls.filter(([c]) => c === 'leaveMatch').length, 1);
  assert.equal(session.storedMatchId(), null);
  assert.equal(controllers[0].disposed, true);
  assert.equal(last().state, 'lobby');
  release();
  await creating;
  assert.deepEqual(started, []);
  assert.equal(last().state, 'lobby');
});

test('sair do painel com a sala aberta ou na fila não deixa partida para trás', async () => {
  const room = gate();
  const a = setup({ ready: room.ready });
  await a.panel.show();
  const creating = a.panel.createRoom('8ball');
  await settle();
  a.panel.destroy();
  await settle();
  assert.equal(a.session.calls.filter(([c]) => c === 'leaveMatch').length, 1);
  room.release();
  await creating;
  assert.deepEqual(a.started, []);

  const b = setup();
  await b.panel.show();
  const queued = b.panel.queue('8ball');
  await settle();
  b.panel.destroy();
  await queued;
  assert.deepEqual(b.session.calls.filter(([c]) => c === 'cancelQueue').length, 1);
  assert.deepEqual(b.started, []);
});

test('conexão perdida durante a espera mostra o aviso e não começa o jogo', async () => {
  const { ready, release } = gate();
  const { panel, session, started, controllers, last } = setup({ ready });
  await panel.show();
  const creating = panel.createRoom('8ball');
  await settle();
  session.dispatchEvent(new CustomEvent('connection', { detail: { state: 'offline' } }));
  assert.equal(last().state, 'offline');
  assert.equal(last().message, 'Sem conexão com o servidor');
  assert.equal(controllers[0].disposed, true);
  release();
  await creating;
  assert.deepEqual(started, []);
});
