// The simulation worker plumbing: handleSimRequest (what runs inside the worker)
// and SimWorkerClient (what the game calls), driven here by a fake Worker so
// the whole thing runs in Node. The real worker is covered in the browser suite.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulateShot } from '@billiards/sim';
import { encodeTrajectory, decodeTrajectory } from '@billiards/protocol';
import { CORPUS } from '../../../packages/sim/test/corpus.js';
import { handleSimRequest } from '../src/sim/simRequest.js';
import { SimWorkerClient } from '../src/sim/SimWorkerClient.js';

const brk = CORPUS.find(c => c.name === 'break');
const hardShot = { ...brk.shot, power: 20 };

// A Worker stand-in: records what the client posts and lets the test decide
// when (and in which order) each request is answered.
class FakeWorker extends EventTarget {
  constructor() {
    super();
    this.msgs = [];
    this.terminated = false;
  }
  postMessage(msg) { this.msgs.push(msg); }
  terminate() { this.terminated = true; }
  // Answers the i-th posted request with what the real worker would send back.
  reply(i) {
    this.dispatchEvent(new MessageEvent('message', { data: handleSimRequest(this.msgs[i]).reply }));
  }
  fail() { this.dispatchEvent(new Event('error')); }
}

test('handleSimRequest devolve a trajetória codificada, os eventos e o estado final do sim', () => {
  const { reply, transfer } = handleSimRequest({ id: 7, table: brk.table, shot: brk.shot });
  const direct = simulateShot(brk.table, brk.shot);
  assert.equal(reply.id, 7);
  assert.equal(reply.ok, true);
  assert.deepEqual(decodeTrajectory(reply.trajectory), decodeTrajectory(encodeTrajectory(direct.frames)));
  assert.deepEqual([reply.events, reply.final, reply.steps, reply.simSeconds, reply.capped],
    [direct.events, direct.final, direct.steps, direct.simSeconds, direct.capped]);
  assert.equal(transfer.length, 1);
  assert.equal(transfer[0], reply.trajectory.buffer);
});

test('handleSimRequest transforma a exceção do sim em ok: false', () => {
  const { reply, transfer } = handleSimRequest({ id: 1, table: brk.table, shot: { ...brk.shot, power: NaN } });
  assert.equal(reply.id, 1);
  assert.equal(reply.ok, false);
  assert.match(reply.error, /power/);
  assert.deepEqual(transfer, []);
});

test('SimWorkerClient resolve cada pedido pelo id, mesmo fora de ordem', async () => {
  const fake = new FakeWorker();
  let created = 0;
  const client = new SimWorkerClient(() => { created++; return fake; });
  assert.equal(created, 0, 'o worker só nasce no primeiro pedido');
  const p1 = client.simulate(brk.table, brk.shot);
  const p2 = client.simulate(brk.table, hardShot);
  assert.equal(created, 1);
  assert.equal(fake.msgs.length, 2);
  assert.notEqual(fake.msgs[0].id, fake.msgs[1].id);
  fake.reply(1); fake.reply(0); // answers the second request first
  const [r1, r2] = await Promise.all([p1, p2]);
  assert.deepEqual(r1.final, simulateShot(brk.table, brk.shot).final);
  assert.deepEqual(r2.final, simulateShot(brk.table, hardShot).final);
  assert.equal(r1.frames.length, Math.floor(r1.steps / 12));
  assert.equal(r1.frames[0].t, 1 / 30);
});

test('SimWorkerClient rejeita com a mensagem de ok: false', async () => {
  const fake = new FakeWorker();
  const client = new SimWorkerClient(() => fake);
  const p = client.simulate(brk.table, { ...brk.shot, power: NaN });
  const ok = client.simulate(brk.table, brk.shot);
  fake.reply(0); fake.reply(1);
  await assert.rejects(p, /power/);
  assert.equal((await ok).steps, simulateShot(brk.table, brk.shot).steps, 'um pedido ruim não afeta o vizinho');
});

test('worker que morre rejeita os pedidos pendentes e o seguinte usa um worker novo', async () => {
  const fakes = [];
  const client = new SimWorkerClient(() => { const w = new FakeWorker(); fakes.push(w); return w; });
  const p1 = client.simulate(brk.table, brk.shot);
  const p2 = client.simulate(brk.table, hardShot);
  fakes[0].fail();
  await Promise.all([assert.rejects(p1, /sim worker/), assert.rejects(p2, /sim worker/)]);
  assert.equal(fakes[0].terminated, true);

  const p3 = client.simulate(brk.table, brk.shot);
  assert.equal(fakes.length, 2, 'o pedido seguinte cria outro worker');
  fakes[1].reply(0);
  assert.deepEqual((await p3).final, simulateShot(brk.table, brk.shot).final);
  fakes[0].fail(); // a dead worker's late events must not touch the new one
  assert.equal(fakes[1].terminated, false);
});

test('dispose rejeita os pendentes e encerra o worker', async () => {
  const fake = new FakeWorker();
  const client = new SimWorkerClient(() => fake);
  const p = client.simulate(brk.table, brk.shot);
  client.dispose();
  await assert.rejects(p, /disposed/);
  assert.equal(fake.terminated, true);
  client.dispose(); // idempotent
});

test('warm cria o worker e já manda uma tacada curta, cuja resposta ninguém espera', async () => {
  const fake = new FakeWorker();
  let created = 0;
  const client = new SimWorkerClient(() => { created++; return fake; });
  client.warm();
  assert.equal(created, 1);
  assert.equal(fake.msgs.length, 1, 'one short shot, so the first real one finds the sim compiled');
  assert.equal(handleSimRequest(fake.msgs[0]).reply.ok, true, 'a shot the sim accepts');
  fake.reply(0); // nobody waits for it: the answer resolves nothing and breaks nothing
  client.warm();
  assert.equal(fake.msgs.length, 1, 'a worker already running is not warmed again');
  const p = client.simulate(brk.table, brk.shot);
  fake.reply(1);
  assert.equal((await p).steps, simulateShot(brk.table, brk.shot).steps);
});
