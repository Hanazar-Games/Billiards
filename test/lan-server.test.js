/**
 * LAN Server Integration Test — Node/WebSocket test for room lifecycle.
 *
 * Verifies:
 *   - createRoom, joinRoom, startGame
 *   - 2-player limit enforcement
 *   - guest leave → playerLeft broadcast
 *   - host disconnect → roomClosed broadcast to guest
 */

import { spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';
import WebSocket from 'ws';

const SERVER_PORT = 13001;
const SERVER_URL = `ws://localhost:${SERVER_PORT}`;

let serverProcess = null;

function startServer() {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', ['server/lan-server.js'], {
      cwd: process.cwd(),
      env: { ...process.env, LAN_SERVER_PORT: String(SERVER_PORT) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    serverProcess = proc;

    let resolved = false;
    const onReady = (data) => {
      const text = data.toString();
      if (!resolved && text.includes('listening')) {
        resolved = true;
        resolve();
      }
    };
    proc.stdout.on('data', onReady);
    proc.stderr.on('data', onReady);

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(); // assume it started even if we missed the log
      }
    }, 1500);

    proc.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        reject(err);
      }
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }
    resolve();
  });
}

function connectClient() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(SERVER_URL);
    const client = { ws, messages: [] };
    ws.on('open', () => resolve(client));
    ws.on('message', (buf) => {
      try {
        client.messages.push(JSON.parse(buf.toString()));
      } catch {}
    });
    ws.on('error', reject);
    ws.on('close', () => { client.closed = true; });
  });
}

function send(client, msg) {
  if (client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(msg));
  }
}

function waitForMessage(client, type, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const found = client.messages.find((m) => m.type === type);
      if (found) {
        resolve(found);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Timeout waiting for message type: ${type}`));
        return;
      }
      setTimeout(check, 50);
    };
    check();
  });
}

function clearMessages(client) {
  client.messages.length = 0;
}

// ── Test runner ──

const results = [];

function record(label, passed, detail = '') {
  results.push({ label, passed, detail });
  const icon = passed ? '✓' : '✗';
  const extra = detail ? ` — ${detail}` : '';
  console.log(`  ${icon} ${label}${extra}`);
}

async function main() {
  console.log('🌐 LAN Server Integration Test');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    await startServer();
    await sleep(300);
    console.log('  ✓ Server started');
  } catch (err) {
    console.error('  ✗ Server start failed:', err.message);
    process.exit(1);
  }

  // ── Test 1: createRoom ──
  console.log('\n▶ Test 1: createRoom');
  const host = await connectClient();
  send(host, { type: 'createRoom' });
  const created = await waitForMessage(host, 'roomCreated');
  record('roomCreated received', created.roomId && created.playerId === 1);
  record('maxPlayers is 2', created.maxPlayers === 2);
  record('playerList has host', created.playerList?.length === 1 && created.playerList[0].isHost);

  // ── Test 2: joinRoom ──
  console.log('\n▶ Test 2: joinRoom');
  const guest = await connectClient();
  send(guest, { type: 'joinRoom', roomId: created.roomId, nickname: 'Guest' });
  const joined = await waitForMessage(guest, 'joinedRoom');
  record('joinedRoom received', joined.roomId === created.roomId && joined.playerId === 2);
  record('maxPlayers sent to guest', joined.maxPlayers === 2);

  // Host should receive playerJoined
  const playerJoined = await waitForMessage(host, 'playerJoined');
  record('host received playerJoined', playerJoined.playerId === 2);
  record('playerList updated', playerJoined.playerList?.length === 2);

  // ── Test 3: 2-player limit ──
  console.log('\n▶ Test 3: 2-player limit');
  const third = await connectClient();
  send(third, { type: 'joinRoom', roomId: created.roomId });
  const fullError = await waitForMessage(third, 'error');
  record('third player rejected', fullError.error === 'Room is full');
  third.ws.close();

  // ── Test 4: startGame with custom tableProfileId ──
  console.log('\n▶ Test 4: startGame (tableProfileId sync)');
  clearMessages(host);
  clearMessages(guest);
  send(host, { type: 'startGame', mode: '8ball', tableProfileId: 'chinese8' });
  const hostStart = await waitForMessage(host, 'startGame');
  const guestStart = await waitForMessage(guest, 'startGame');
  record('host received startGame with tableProfileId', hostStart.mode === '8ball' && hostStart.tableProfileId === 'chinese8');
  record('guest received startGame with tableProfileId', guestStart.mode === '8ball' && guestStart.tableProfileId === 'chinese8');

  // ── Test 5: guest leaveRoom ──
  console.log('\n▶ Test 5: guest leaveRoom');
  clearMessages(host);
  send(guest, { type: 'leaveRoom' });
  const leftMsg = await waitForMessage(host, 'playerLeft');
  record('host received playerLeft', leftMsg.playerId === 2);

  // ── Test 6: host disconnect → roomClosed ──
  console.log('\n▶ Test 6: host disconnect');
  const host2 = await connectClient();
  send(host2, { type: 'createRoom' });
  const created2 = await waitForMessage(host2, 'roomCreated');

  const guest2 = await connectClient();
  send(guest2, { type: 'joinRoom', roomId: created2.roomId });
  await waitForMessage(guest2, 'joinedRoom');

  clearMessages(guest2);
  host2.ws.close();
  const closed = await waitForMessage(guest2, 'roomClosed');
  record('guest received roomClosed on host disconnect', closed.reason === 'hostDisconnected');

  // ── Test 7: join non-existent room ──
  console.log('\n▶ Test 7: join non-existent room');
  const lone = await connectClient();
  send(lone, { type: 'joinRoom', roomId: 'FAKE99' });
  const notFound = await waitForMessage(lone, 'error');
  record('rejected with room not found', notFound.error === 'Room not found');
  lone.ws.close();

  // ── Test 8: join after game started ──
  console.log('\n▶ Test 8: join after game started');
  const host3 = await connectClient();
  send(host3, { type: 'createRoom' });
  const created3 = await waitForMessage(host3, 'roomCreated');

  const guest3 = await connectClient();
  send(guest3, { type: 'joinRoom', roomId: created3.roomId });
  await waitForMessage(guest3, 'joinedRoom');

  // Host starts game
  send(host3, { type: 'startGame', mode: '9ball', tableProfileId: 'pool9ft' });
  await waitForMessage(host3, 'startGame');

  // Late joiner should be rejected
  const late = await connectClient();
  send(late, { type: 'joinRoom', roomId: created3.roomId });
  const startedError = await waitForMessage(late, 'error');
  record('rejected because game already started', startedError.error === 'Game already started');
  late.ws.close();
  host3.ws.close();
  guest3.ws.close();

  // ── Summary ──
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Results: ${passed} passed, ${failed} failed / ${results.length} total`);

  await stopServer();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Test runner crashed:', err);
  stopServer().then(() => process.exit(1));
});
