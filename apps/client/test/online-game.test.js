// F4-09: the Game plays online — shots decided by the server, timeouts, returns
// and the end — driven by an in-page fake server (src/dev/FakeOnlineController.js).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import puppeteer from 'puppeteer';
import { browserOptions, prepareBrowserPage } from './browser-options.js';

let server;
let browser;

before(async () => {
  server = await createServer({ server: { host: '127.0.0.1', port: 0, open: false } });
  await server.listen();
  browser = await puppeteer.launch(browserOptions);
});

after(async () => {
  await browser?.close();
  await server?.close();
});

/** A fresh page on the menu, with the console errors collected. */
async function openPage() {
  const page = await browser.newPage();
  await prepareBrowserPage(page);
  await page.setViewport({ width: 1280, height: 800 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(server.resolvedUrls.local[0], { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => window.__menu && !document.getElementById('intro-screen'));
  await page.evaluate(async () => {
    const { settings } = await import('/src/core/SettingsStore.js');
    settings.set('reducedMotion', true);
    settings.set('autoInstantReplay', false);
    settings.set('cameraAutoResetAfterShot', false);
  });
  return { page, errors };
}

/** Starts an online game against the fake server; `window.__fake` is the fake. */
async function startOnline(page, options) {
  await page.evaluate(async (opts) => {
    const { createFakeOnlineMatch } = await import('/src/dev/FakeOnlineController.js');
    const fake = createFakeOnlineMatch(opts);
    window.__fake = fake;
    fake.start();
    await __menu._startOnlineGame(fake.controller);
  }, options);
  await page.waitForFunction(() => __menu.game?.state === 'AIM');
  await page.evaluate(() => { __menu.game.playbackRate = 8; });
}

/** The table on screen against the official one: every ball's place and pocket. */
const sameTable = (a, b) => a.balls.every((ball) => {
  const other = b.balls.find((x) => x.id === ball.id);
  return other && other.pocketed === ball.pocketed && (ball.pocketed || (Math.abs(other.x - ball.x) < 1e-6 && Math.abs(other.z - ball.z) < 1e-6));
});

const BREAK = { angle: Math.PI / 2, power: 80, spin: { x: 0, y: 0 } };

test('a tacada do adversário é reproduzida e a mesa termina na oficial', { timeout: 120000 }, async () => {
  const { page, errors } = await openPage();
  await startOnline(page, { localSeat: 1, turnSeat: 0 });
  assert.equal(await page.evaluate(() => __menu.game.isLocalPlayerTurn()), false);
  await page.evaluate(async (shot) => {
    const game = __menu.game;
    const sim = await game.simClient.simulate(__fake.table, shot);
    // The official table differs from the simulated end: the Game must take the server's.
    __fake.remoteShot(0, shot, sim, { tweak: (t) => ({ ...t, balls: t.balls.map((b) => (b.id === 5 && !b.pocketed ? { ...b, x: b.x + 3 } : b)) }) });
  }, BREAK);
  await page.waitForFunction(() => __menu.game.state === 'SHOOTING' || __menu.game.playback);
  await page.waitForFunction(() => __menu.game.state !== 'SHOOTING' && __menu.game.playback === null, { timeout: 60000 });
  const end = await page.evaluate(() => ({ shown: __menu.game.ballsManager.toTableState('pool9ft'), official: __fake.table, player: __menu.game.currentPlayer, next: __fake.match.mode.turn.currentSeat }));
  assert.ok(sameTable(end.shown, end.official), 'the table on screen is the official one');
  assert.equal(end.player, end.next + 1);
  assert.deepEqual(errors, []);
  await page.close();
});

test('a tacada local só se move quando o servidor responde', { timeout: 120000 }, async () => {
  const { page, errors } = await openPage();
  await startOnline(page, { localSeat: 0, turnSeat: 0 });
  const before = await page.evaluate(() => __menu.game.ballsManager.toTableState('pool9ft'));
  await page.evaluate(() => {
    const game = __menu.game;
    game.aimDirection.set(0, 0, 1).normalize();
    game.cueTipOffset = { x: 0, y: 0 };
    game.power = 70;
    game.state = 'CHARGING';
    game.charging = true;
    game.onMouseUp({ type: 'pointerup' });
  });
  await page.waitForFunction(() => __fake.lastShotRequest() !== null);
  await new Promise((r) => setTimeout(r, 500));
  const waiting = await page.evaluate(() => ({ state: __menu.game.state, playback: __menu.game.playback, table: __menu.game.ballsManager.toTableState('pool9ft') }));
  assert.equal(waiting.state, 'SHOOTING');
  assert.equal(waiting.playback, null);
  assert.ok(sameTable(waiting.table, before), 'nothing moves before the server answers');
  await page.evaluate(async () => {
    const body = __fake.lastShotRequest();
    const sim = await __menu.game.simClient.simulate(__fake.table, body);
    __fake.answerShot(sim);
  });
  await page.waitForFunction(() => __menu.game.state !== 'SHOOTING' && __menu.game.playback === null, { timeout: 60000 });
  const end = await page.evaluate(() => ({ shown: __menu.game.ballsManager.toTableState('pool9ft'), official: __fake.table }));
  assert.ok(sameTable(end.shown, end.official));
  assert.deepEqual(errors, []);
  await page.close();
});

test('tempo esgotado do servidor no meio da carga cancela a tacada local e passa a vez', { timeout: 120000 }, async () => {
  const { page, errors } = await openPage();
  await startOnline(page, { localSeat: 0, turnSeat: 0 });
  await page.evaluate(() => {
    const game = __menu.game;
    game.power = 40;
    game.state = 'CHARGING';
    game.charging = true;
    __fake.timeout();
  });
  await page.waitForFunction(() => __menu.game.currentPlayer === 2 && __menu.game.state === 'AIM');
  const after = await page.evaluate(() => ({ charging: __menu.game.charging, ballInHand: __menu.game.ballInHand, sent: __fake.lastShotRequest() }));
  assert.equal(after.charging, false);
  assert.equal(after.ballInHand, false, 'the opponent has the ball in hand, not this client');
  assert.equal(after.sent, null);
  assert.deepEqual(errors, []);
  await page.close();
});

test('volta no meio da reprodução retoma do deslocamento, sem tocar os eventos de antes', { timeout: 120000 }, async () => {
  const { page, errors } = await openPage();
  await startOnline(page, { localSeat: 1, turnSeat: 0 });
  const info = await page.evaluate(async (shot) => {
    const game = __menu.game;
    game.playbackRate = 0; // freeze the playback right where the return puts it
    const sim = await game.simClient.simulate(__fake.table, shot);
    const header = __fake.decideQuietly(0, shot, sim);
    const offsetMs = Math.round(header.durationMs / 2);
    __fake.snapshotWithPlayback(offsetMs);
    return { offsetMs, time: game.playback?.player.time ?? null, state: game.state };
  }, BREAK);
  assert.equal(info.state, 'SHOOTING');
  assert.ok(info.time !== null && Math.abs(info.time - info.offsetMs / 1000) < 0.05, `playback at ${info.time} s, offset ${info.offsetMs} ms`);
  await page.evaluate(() => { __menu.game.playbackRate = 8; });
  await page.waitForFunction(() => __menu.game.state !== 'SHOOTING' && __menu.game.playback === null, { timeout: 60000 });
  const end = await page.evaluate(() => ({ shown: __menu.game.ballsManager.toTableState('pool9ft'), official: __fake.table }));
  assert.ok(sameTable(end.shown, end.official));
  assert.deepEqual(errors, []);
  await page.close();
});

test('playback além do último quadro aplica a mesa oficial direto', { timeout: 120000 }, async () => {
  const { page, errors } = await openPage();
  await startOnline(page, { localSeat: 1, turnSeat: 0 });
  await page.evaluate(async (shot) => {
    const sim = await __menu.game.simClient.simulate(__fake.table, shot);
    const header = __fake.decideQuietly(0, shot, sim);
    __fake.snapshotWithPlayback(header.durationMs + 500);
  }, BREAK);
  await page.waitForFunction(() => __menu.game.state !== 'SHOOTING' && __menu.game.playback === null, { timeout: 10000 });
  const end = await page.evaluate(() => ({ shown: __menu.game.ballsManager.toTableState('pool9ft'), official: __fake.table }));
  assert.ok(sameTable(end.shown, end.official));
  assert.deepEqual(errors, []);
  await page.close();
});

test('fim da partida mostra o resultado e volta ao menu', { timeout: 120000 }, async () => {
  const { page, errors } = await openPage();
  await startOnline(page, { localSeat: 1, turnSeat: 0 });
  await page.evaluate(() => __fake.end({ winnerTeam: 1, reason: 'WIN', summary: { turns: 9, shots: 9 } }));
  await page.waitForFunction(() => document.body.innerText.includes('Vitória!'), { timeout: 10000 });
  assert.equal(await page.evaluate(() => __menu.game.state), 'GAME_OVER');
  await page.waitForFunction(() => __menu.state === 'MENU', { timeout: 15000 });
  assert.deepEqual(errors, []);
  await page.close();
});

test('os modos offline continuam iguais', { timeout: 120000 }, async () => {
  const { page, errors } = await openPage();
  await page.evaluate(() => __menu._startGame('vsai'));
  await page.waitForFunction(() => __menu.game?.state === 'AIM');
  const info = await page.evaluate(() => ({ controller: __menu.game.match.constructor.name, networkMode: __menu.game.networkMode, online: __menu.game.online }));
  assert.deepEqual(info, { controller: 'LocalMatchController', networkMode: null, online: false });
  assert.deepEqual(errors, []);
  await page.close();
});
