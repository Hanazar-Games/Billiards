// The internal simulation service (D059): secret, version registry, limits and
// the same answer as a local simulateShot. The server listens on port 0 inside
// the test process; the entry point and the bundle run as child processes.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { simulateShot } from '@billiards/sim';
import { CORPUS } from '@billiards/sim/corpus';
import { SIM_VERSION, base64ToBytes, encodeTrajectory } from '@billiards/protocol';
import { createSimServer } from '../src/server.ts';

const SECRET = 'test-secret';
const SERVICE_DIR = new URL('..', import.meta.url);
const sample = (name: string) => CORPUS.find((entry) => entry.name === name)!;

type ServerOptions = Parameters<typeof createSimServer>[0];
const closers: (() => Promise<void>)[] = [];
// Last in, first out: a process is stopped before its directory goes away.
after(async () => {
  const failures: unknown[] = [];
  for (const close of closers.reverse()) {
    try { await close(); } catch (err) { failures.push(err); }
  }
  if (failures.length > 0) throw failures[0];
});

/** Starts a server on a free port; closed when the file's tests are done. */
async function listen(options: Partial<ServerOptions> = {}): Promise<string> {
  const server = createSimServer({ secret: SECRET, ...options });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  closers.push(() => new Promise<void>((resolve) => { server.close(() => resolve()); server.closeAllConnections(); }));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

function post(url: string, body: unknown, headers: Record<string, string> = { 'x-sim-secret': SECRET }): Promise<Response> {
  return fetch(`${url}/simulate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const { table, shot } = sample('soft');
const request = (simVersion: number) => ({ simVersion, table, shot });

/** A stand-in simulation: `steps` tells which one answered. */
const fakeSimulation = (steps: number) => () => ({
  frames: [], events: [], final: table, steps, simSeconds: steps / 360, capped: false,
});

test('chamada sem segredo é recusada', async () => {
  let calls = 0;
  const url = await listen({ versions: { [SIM_VERSION]: () => { calls++; return fakeSimulation(1)(); } } });
  for (const headers of [{}, { 'x-sim-secret': 'wrong-secret' }, { 'x-sim-secret': 'test-secrex' }, { 'x-sim-secret': '' }, { 'x-sim-secret': `${SECRET}${SECRET}` }]) {
    const res = await post(url, request(SIM_VERSION), headers);
    assert.equal(res.status, 401, JSON.stringify(headers));
    assert.deepEqual(await res.json(), { error: 'UNAUTHORIZED' });
  }
  assert.equal(calls, 0, 'a recusa vem antes da simulação');
  assert.equal((await post(url, request(SIM_VERSION))).status, 200);
  assert.equal(calls, 1);
});

test('o servidor recusa um segredo vazio', () => {
  assert.throws(() => createSimServer({ secret: '' }), /secret/);
});

test('simVersion desconhecida é recusada', async () => {
  const url = await listen();
  for (const simVersion of [999, 0, 1.5, '1', null, undefined, '__proto__', 'toString']) {
    const res = await post(url, { simVersion, table, shot });
    assert.equal(res.status, 400, String(simVersion));
    assert.deepEqual(await res.json(), { error: 'SIM_VERSION_UNSUPPORTED', versions: [1] });
  }
});

test('aceita as versões N e N−1 do registro', async () => {
  const url = await listen({ versions: { 1: fakeSimulation(1), 2: fakeSimulation(2) } });
  assert.equal((await (await post(url, request(1))).json()).steps, 1);
  assert.equal((await (await post(url, request(2))).json()).steps, 2);
  const refused = await post(url, request(3));
  assert.equal(refused.status, 400);
  assert.deepEqual(await refused.json(), { error: 'SIM_VERSION_UNSUPPORTED', versions: [1, 2] });
  const health = await (await fetch(`${url}/healthz`)).json();
  assert.deepEqual(health, { ok: true, versions: [1, 2] });
});

test('a abertura volta igual à simulação local', async () => {
  const { table: breakTable, shot: breakShot } = sample('break');
  const url = await listen();
  const res = await post(url, { simVersion: SIM_VERSION, table: breakTable, shot: breakShot });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') ?? '', /^application\/json/);
  const body = await res.json();
  const local = simulateShot(breakTable, breakShot);
  // What the service sends is JSON, so the local result goes through JSON too (-0 becomes 0).
  const wire = JSON.parse(JSON.stringify(local));
  assert.deepEqual(body.final, wire.final);
  assert.deepEqual(body.events, wire.events);
  assert.deepEqual([body.steps, body.simSeconds, body.capped], [local.steps, local.simSeconds, local.capped]);
  assert.deepEqual(base64ToBytes(body.trajectory), encodeTrajectory(local.frames));
  assert.deepEqual(Object.keys(body).sort(), ['capped', 'events', 'final', 'simSeconds', 'steps', 'trajectory']);
});

test('corpo grande demais dá 413, JSON inválido dá 400 e perfil desconhecido dá SIM_INPUT_INVALID', async () => {
  const exact = JSON.stringify(request(SIM_VERSION));
  const limit = Buffer.byteLength(exact);
  const small = await listen({ maxBodyBytes: limit });
  assert.equal((await post(small, exact)).status, 200, 'um corpo do tamanho do limite passa');
  const tooLarge = await post(small, JSON.stringify({ ...request(SIM_VERSION), padding: 'x' }));
  assert.equal(tooLarge.status, 413);
  assert.deepEqual(await tooLarge.json(), { error: 'BODY_TOO_LARGE' });
  // Same limit without a Content-Length: the body is counted as it arrives.
  const chunks = (async function* () { for (let i = 0; i < 8; i++) yield new TextEncoder().encode('x'.repeat(Math.ceil(limit / 4))); })();
  const streamed = await fetch(`${small}/simulate`, {
    method: 'POST', headers: { 'x-sim-secret': SECRET }, duplex: 'half',
    body: ReadableStream.from(chunks),
  } as RequestInit);
  assert.equal(streamed.status, 413);
  assert.deepEqual(await streamed.json(), { error: 'BODY_TOO_LARGE' });

  const url = await listen();
  for (const body of ['{', '', 'not json', '[]', 'null', '42', '{}', JSON.stringify({ simVersion: 1, shot }), JSON.stringify({ simVersion: 1, table }),
    JSON.stringify({ simVersion: 1, table: null, shot }), JSON.stringify({ simVersion: 1, table, shot: 'fast' })]) {
    const res = await post(url, body);
    assert.equal(res.status, 400, body);
    assert.deepEqual(await res.json(), { error: 'BAD_REQUEST' }, body);
  }

  const unknownProfile = await post(url, { simVersion: SIM_VERSION, table: { ...table, tableProfileId: 'nope' }, shot });
  assert.equal(unknownProfile.status, 400);
  const refusal = await unknownProfile.json();
  assert.equal(refusal.error, 'SIM_INPUT_INVALID');
  assert.match(refusal.detail, /unknown table profile/);

  for (const badShot of [{ angle: 0, power: 0, spin: { x: 0, y: 0 } }, { angle: 0, power: 10 }, { angle: 'a', power: 10, spin: { x: 0, y: 0 } }]) {
    const res = await post(url, { simVersion: SIM_VERSION, table, shot: badShot });
    assert.equal(res.status, 400, JSON.stringify(badShot));
    assert.equal((await res.json()).error, 'SIM_INPUT_INVALID', JSON.stringify(badShot));
  }
});

test('GET /healthz responde sem segredo', async () => {
  const url = await listen();
  const res = await fetch(`${url}/healthz`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, versions: [1] });
  for (const [method, path] of [['GET', '/'], ['GET', '/simulate'], ['POST', '/healthz'], ['GET', '/other']]) {
    const other = await fetch(`${url}${path}`, { method, headers: { 'x-sim-secret': SECRET } });
    assert.equal(other.status, 404, `${method} ${path}`);
    assert.deepEqual(await other.json(), { error: 'NOT_FOUND' });
  }
});

test('sem SIM_SECRET o serviço não sobe', () => {
  for (const secret of [undefined, '']) {
    const env: Record<string, string | undefined> = { ...process.env, PORT: '0' };
    if (secret === undefined) delete env.SIM_SECRET; else env.SIM_SECRET = secret;
    const result = spawnSync(process.execPath, ['src/main.ts'], { cwd: SERVICE_DIR, env, encoding: 'utf8', timeout: 20000 });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /SIM_SECRET is required/);
  }
});

interface Running {
  url: string;
  /** The JSON lines the process has printed so far. */
  output: () => Record<string, unknown>[];
}

/** Runs a main file as the container does; resolves once it reports its port. */
async function startProcess(file: string, cwd: string | URL): Promise<Running> {
  const child = spawn(process.execPath, [file], {
    cwd, env: { ...process.env, SIM_SECRET: SECRET, PORT: '0' }, stdio: ['ignore', 'pipe', 'inherit'],
  });
  closers.push(async () => {
    if (child.exitCode === null) { child.kill(); await once(child, 'close'); }
  });
  const printed: string[] = [];
  createInterface({ input: child.stdout }).on('line', (line) => printed.push(line));
  const running: Running = { url: '', output: () => printed.map((line) => JSON.parse(line)) };
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const listening = running.output().find((entry) => entry.event === 'listening');
    if (listening) return { ...running, url: `http://127.0.0.1:${listening.port}` };
    if (child.exitCode !== null) throw new Error(`${file} exited with ${child.exitCode}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`${file} did not start in 20 s`);
}

test('o serviço registra uma linha JSON por pedido', async () => {
  const { url, output } = await startProcess('src/main.ts', SERVICE_DIR);
  assert.equal((await fetch(`${url}/healthz`)).status, 200);
  assert.equal((await post(url, request(SIM_VERSION), {})).status, 401);
  assert.equal((await fetch(`${url}/missing?x=1`)).status, 404);
  const deadline = Date.now() + 5000;
  const requests = () => output().filter((entry) => entry.path !== undefined);
  while (requests().length < 3 && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 50));
  assert.deepEqual(requests().map(({ path, status }) => ({ path, status })), [
    { path: '/healthz', status: 200 }, { path: '/simulate', status: 401 }, { path: '/missing', status: 404 },
  ]);
  for (const entry of requests()) assert.equal(typeof entry.ms, 'number');
});

test('o bundle build/server.mjs roda sozinho, fora do repositório (como na imagem)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sim-bundle-'));
  closers.push(async () => { rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });
  copyFileSync(new URL('../build/server.mjs', import.meta.url), join(dir, 'server.mjs'));
  const { url } = await startProcess('server.mjs', dir);
  assert.deepEqual(await (await fetch(`${url}/healthz`)).json(), { ok: true, versions: [1] });
  const res = await post(url, request(SIM_VERSION));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(base64ToBytes(body.trajectory), encodeTrajectory(simulateShot(table, shot).frames));
});
