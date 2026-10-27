// F4-10/F4-11: two browsers, each in its own context (its own localStorage and
// device, so its own guest account), play online against a real Nakama through
// the online panel. Not part of npm test: it needs the server (npm run infra:up,
// or NAKAMA_URL=http://server:7350 for another machine, https for production).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { appendFileSync } from 'node:fs';
import { createServer } from 'vite';
import puppeteer from 'puppeteer';
import { browserOptions, prepareBrowserPage } from './browser-options.js';

const NAKAMA_URL = process.env.NAKAMA_URL ?? 'http://127.0.0.1:7350';
// The page (import.meta.env) and the history check (the integration bots) use the same server.
process.env.VITE_NAKAMA_URL = NAKAMA_URL;
process.env.NAKAMA_URL = NAKAMA_URL;
if (process.env.NAKAMA_SERVER_KEY) process.env.VITE_NAKAMA_SERVER_KEY = process.env.NAKAMA_SERVER_KEY;
const { newBot, findStorageObject, eventually, closeBots } = await import('../../../services/nakama/test/integration/bot.ts');

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
// The hard AI takes about 100 shots to finish an 8-ball rack (test/local-2p-match.test.js uses the same cap).
const MAX_SHOTS = Number(process.env.E2E_MAX_SHOTS ?? 300);
// The game loop caps a frame at 0.1 s: where frames are slow (two swiftshader pages in CI), a higher
// rate keeps a shot's playback short. The server does not wait for it (D056).
const PLAYBACK_RATE = Number(process.env.E2E_PLAYBACK_RATE ?? 4);
const MATCH_TIMEOUT_MS = Number(process.env.E2E_MATCH_TIMEOUT_MS ?? 900000);

/** One line for the CI summary (E2E_REPORT names the file; see .github/workflows/integration.yml). */
function report(line) {
  if (process.env.E2E_REPORT) appendFileSync(process.env.E2E_REPORT, `${line}\n`);
}

let server;
let browser;
let url;

before(async () => {
  server = await createServer({ server: { host: '127.0.0.1', port: 0, open: false } });
  await server.listen();
  url = server.resolvedUrls.local[0];
  browser = await puppeteer.launch(browserOptions);
});

after(async () => {
  closeBots();
  await browser?.close();
  await server?.close();
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function toMenu(page) {
  await page.waitForFunction(() => window.__menu && !document.getElementById('intro-screen'), { timeout: 60000 });
  await page.evaluate(async () => {
    const { settings } = await import('/src/core/SettingsStore.js');
    settings.set('reducedMotion', true);
    settings.set('autoInstantReplay', false);
    settings.set('cameraAutoResetAfterShot', false);
  });
}

/** A player: a browser context of its own, on the menu, with its console errors collected. */
async function openPlayer(name) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await prepareBrowserPage(page);
  await page.setViewport({ width: 960, height: 600 });
  // The e2e- prefix marks test accounts (docs/f4/implantacao.md); a reload keeps the same device.
  await page.evaluateOnNewDocument(() => {
    if (!localStorage.getItem('billiards.online.deviceId')) localStorage.setItem('billiards.online.deviceId', `e2e-${crypto.randomUUID()}`);
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // A failed resource is logged by its response, which names the URL.
  page.on('console', (message) => { if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) errors.push(message.text()); });
  page.on('response', (response) => {
    if (response.status() < 400) return;
    // A room just created takes a moment to be listed: joinByCode retries its ROOM_NOT_FOUND (404).
    if (response.status() === 404 && new URL(response.url()).pathname === '/v2/rpc/join_by_code') return;
    errors.push(`${response.status()} ${response.request().method()} ${response.url()}`);
  });
  await page.goto(url, { waitUntil: 'networkidle2' });
  await toMenu(page);
  return { name, page, context, errors };
}

async function closePlayers(players) {
  for (const p of players) await p.context.close().catch(() => {});
}

/** Opens the online panel and waits for the lobby (a guest signed in). */
async function openLobby(page) {
  await page.evaluate(() => { __menu._showOnline(); });
  await page.waitForFunction(() => ['lobby', 'offline', 'unavailable'].includes(__menu.onlinePanel?.model.state), { timeout: 30000 });
  const model = await page.evaluate(() => ({ ...__menu.onlinePanel.model }));
  assert.equal(model.state, 'lobby', `painel online: ${model.state} (${model.message}) — o Nakama em ${NAKAMA_URL} está no ar?`);
}

/** The online game is on screen; its playback runs PLAYBACK_RATE times faster. */
async function inGame(page) {
  await page.waitForFunction(() => __menu.game?.online === true && ['AIM', 'SHOOTING'].includes(__menu.game.state), { timeout: 60000 });
  await page.evaluate((rate) => { __menu.game.playbackRate = rate; }, PLAYBACK_RATE);
}

/** A creates a room, B joins with its code. */
async function startRoom(a, b, mode) {
  await Promise.all([openLobby(a.page), openLobby(b.page)]);
  await a.page.evaluate((m) => { __menu.onlinePanel.createRoom(m); }, mode);
  await a.page.waitForFunction(() => __menu.onlinePanel?.model.state === 'room' && __menu.onlinePanel.model.code, { timeout: 30000 });
  const code = await a.page.evaluate(() => __menu.onlinePanel.model.code);
  await b.page.evaluate((c) => { __menu.onlinePanel.joinByCode(c); }, code);
  await Promise.all([inGame(a.page), inGame(b.page)]);
}

/** The turn as this page's controller sees it. */
const view = (page) => page.evaluate(() => {
  const g = __menu.game;
  if (!g?.online) return null;
  const c = g.match;
  return {
    state: g.state,
    ready: g.state === 'AIM' && !g._hostPaused && g.playback === null && !!c.turn && c.turn.seat === c.localSeat,
    turn: c.turn ? { seat: c.turn.seat, turnId: c.turn.turnId } : null,
    matchId: c.matchId,
    localSeat: c.localSeat,
    mode: c.modeId,
  };
});

/** The next shot's player, or null once both pages show the end. */
async function nextShooter(players, ms = 90000) {
  const deadline = Date.now() + ms;
  for (;;) {
    const views = await Promise.all(players.map((p) => view(p.page)));
    if (views.every((v) => v?.state === 'GAME_OVER')) return null;
    const i = views.findIndex((v) => v?.ready);
    if (i >= 0) return { shooter: players[i], other: players[1 - i], turnId: views[i].turn.turnId };
    assert.ok(Date.now() < deadline, `ninguém pode jogar: ${JSON.stringify(views)}`);
    await sleep(100);
  }
}

/** The shot of turn `turnId` is over on this page: a new turn (or the end) and nothing playing. */
const settled = (page, turnId) => page.waitForFunction((t) => {
  const g = __menu.game;
  if (!g?.online || g.state === 'GAME_OVER') return true;
  return !!g.match.turn && g.match.turn.turnId !== t && g.state !== 'SHOOTING' && g.playback === null;
}, { timeout: 120000, polling: 100 }, turnId);

/**
 * The table on screen. A pocketed ball has left the table (its mesh rests wherever
 * its drop animation got to), and a cue ball in hand follows the mouse (or the
 * opponent's drag) until the shot: neither has a place to compare.
 */
const shownTable = (page) => page.evaluate(() => {
  const g = __menu.game;
  const table = g.ballsManager.toTableState(g.tableProfileId);
  const hand = g.state !== 'GAME_OVER' && g.match.status()?.ballInHand;
  const balls = table.balls
    .filter((b) => !(hand && b.id === 0))
    .map((b) => (b.pocketed ? { id: b.id, pocketed: true } : b));
  return { ...table, balls };
});

/** In the page: the hard AI picks the shot and the player shoots it (test/local-2p-match.test.js). */
async function playOnlineTurn() {
  const game = __menu.game;
  if (game.match.status().pushOutPending) {
    game.match.choosePushOut(true);
    return;
  }
  const { AIPlayer } = await import('/src/ai/AIPlayer.js');
  if (game.ballInHand) {
    game._placeCueBallInHand(game.ballInHandBehindLine);
    game._endBallInHand();
  }
  const ai = new AIPlayer('hard');
  ai.settings.thinkTimeMin = ai.settings.thinkTimeMax = 0;
  const decision = await ai.takeTurn(game);
  if (!decision) throw new Error(`the AI planner returned no shot for player ${game.currentPlayer}`);
  game.aimDirection.set(decision.aimDirection.x, 0, decision.aimDirection.z).normalize();
  game.cueTipOffset = decision.cueTipOffset || { x: 0, y: 0 };
  game.power = Math.max(decision.power, 1); // onMouseUp drops a release below 1
  game.state = 'CHARGING';
  game.charging = true;
  game.onMouseUp({ type: 'pointerup' });
}

/** One shot by whoever has the turn; both pages end it on the same table. Returns false at the end. */
async function playShot(players, n) {
  const next = await nextShooter(players);
  if (!next) return false;
  await next.shooter.page.evaluate(playOnlineTurn);
  await Promise.all(players.map((p) => settled(p.page, next.turnId)));
  if (process.env.E2E_DEBUG) {
    const line = await next.shooter.page.evaluate(() => {
      const g = __menu.game;
      const m = g.match.match?.mode;
      return { ruling: g._shotRuling && { fouls: g._shotRuling.fouls, next: g._shotRuling.nextSeat, messages: g._shotRuling.messages?.map((x) => x.code) },
        pocketed: m?.pocketed, groups: m?.groups, turn: g.match.turn, state: g.state };
    });
    console.log(`#${n} ${next.shooter.name} t${next.turnId}: ${JSON.stringify(line)}`);
  }
  const [ta, tb] = await Promise.all(players.map((p) => shownTable(p.page)));
  if (!isDeepStrictEqual(ta, tb)) {
    const [da, db] = await Promise.all(players.map((p) => diagnose(p.page)));
    const detail = { shown: ballDiff(da.shown, db.shown), official: ballDiff(da.official, db.official), a: da.info, b: db.info };
    assert.fail(`mesas diferentes depois da tacada ${n} (${next.shooter.name} jogou): ${JSON.stringify(detail)}`);
  }
  return true;
}

/** The fields that differ, ball by ball, between two lists of balls. */
function ballDiff(a, b) {
  const out = [];
  for (const ball of a) {
    const other = b.find((x) => x.id === ball.id) ?? {};
    const keys = [...new Set([...Object.keys(ball), ...Object.keys(other)])].filter((k) => !isDeepStrictEqual(ball[k], other[k]));
    if (keys.length) out.push({ id: ball.id, ...Object.fromEntries(keys.map((k) => [k, [ball[k], other[k]]])) });
  }
  return out;
}

/** A page's shown and official tables, and its turn. */
const diagnose = (page) => page.evaluate(() => {
  const g = __menu.game;
  const c = g.match;
  return {
    shown: g.ballsManager.toTableState(g.tableProfileId).balls,
    official: c.table?.balls ?? [],
    info: { state: g.state, local: c.localSeat, turn: c.turn, ballInHand: g.ballInHand, status: c.status()?.ballInHand ?? null },
  };
});

/** Waits for `text` on the page; a timeout says what the page shows and where its game is. */
async function showsText(page, text) {
  try {
    await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout: 30000, polling: 200 }, text);
  } catch (err) {
    const state = await page.evaluate(() => {
      const g = __menu.game;
      return {
        menu: __menu.state, game: g?.state ?? null, paused: !!g?._hostPaused, playing: g ? g.playback !== null : null,
        end: g?.match?.end ?? null, pendingEnd: g?._pendingOnlineEnd ?? null, turn: g?.match?.turn ?? null,
        text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 300),
      };
    }).catch((e) => ({ unreadable: e.message }));
    throw new Error(`"${text}" não apareceu: ${JSON.stringify(state)}`, { cause: err });
  }
}

test('dois navegadores jogam uma partida online inteira de 8-ball', { timeout: MATCH_TIMEOUT_MS }, async () => {
  const players = await Promise.all([openPlayer('A'), openPlayer('B')]);
  const [a, b] = players;
  try {
    const started = Date.now();
    await startRoom(a, b, '8ball');
    const [va, vb] = await Promise.all([view(a.page), view(b.page)]);
    assert.equal(va.matchId, vb.matchId);
    assert.notEqual(va.localSeat, vb.localSeat);

    let shots = 0;
    // A minute before the test's own timeout, fail with how far the match got.
    const seconds = () => ((Date.now() - started) / 1000).toFixed(1);
    while (await playShot(players, shots + 1)) {
      shots++;
      assert.ok(shots <= MAX_SHOTS, `sem fim depois de ${MAX_SHOTS} tacadas`);
      if (Date.now() - started > MATCH_TIMEOUT_MS - 60000) {
        report(`8-ball: sem fim em ${seconds()} s, ${shots} tacadas`);
        assert.fail(`sem fim em ${seconds()} s: ${shots} tacadas`);
      }
    }
    const ends = await Promise.all(players.map((p) => p.page.evaluate(() => ({ ...__menu.game.match.end, text: document.body.innerText }))));
    console.log(`8-ball online: ${shots} tacadas, vencedor ${ends[0].winnerTeam}, ${seconds()} s`);
    report(`8-ball: ${shots} tacadas em ${seconds()} s (${(Number(seconds()) / shots).toFixed(1)} s por tacada)`);
    assert.equal(ends[0].reason, 'WIN');
    assert.equal(ends[0].winnerTeam, ends[1].winnerTeam);
    const winner = ends.findIndex((e) => e.text.includes('Vitória!'));
    assert.ok(winner >= 0, 'nenhum navegador mostra "Vitória!"');
    assert.ok(ends[1 - winner].text.includes('Derrota'), 'o outro navegador não mostra "Derrota"');
    assert.equal([va, vb][winner].localSeat, ends[0].winnerTeam);

    const bot = await newBot();
    const listed = await eventually(() => findStorageObject(bot, 'match_history', SYSTEM_USER_ID, va.matchId), (r) => r.ok && r.value !== undefined, 10000);
    if (!listed.ok) throw listed.error;
    assert.ok(listed.value, `match_history sem a partida ${va.matchId}`);
    assert.equal(listed.value.value.winnerTeam, ends[0].winnerTeam);
    assert.equal(listed.value.value.reason, 'WIN');
    assert.deepEqual(a.errors, []);
    assert.deepEqual(b.errors, []);
  } finally {
    await closePlayers(players);
  }
});

test('a fila junta os dois navegadores numa partida de 9-ball', { timeout: 120000 }, async () => {
  const players = await Promise.all([openPlayer('A'), openPlayer('B')]);
  const [a, b] = players;
  try {
    await Promise.all([openLobby(a.page), openLobby(b.page)]);
    await Promise.all(players.map((p) => p.page.evaluate(() => { __menu.onlinePanel.queue('9ball'); })));
    await Promise.all([inGame(a.page), inGame(b.page)]);
    const [va, vb] = await Promise.all([view(a.page), view(b.page)]);
    assert.equal(va.matchId, vb.matchId);
    assert.equal(va.mode, '9ball');

    assert.equal(await playShot(players, 1), true);
    await a.page.evaluate(() => __menu.game._concede());
    await Promise.all([showsText(a.page, 'Você desistiu'), showsText(b.page, 'Vitória — o adversário desistiu')]);
    assert.deepEqual(a.errors, []);
    assert.deepEqual(b.errors, []);
  } finally {
    await closePlayers(players);
  }
});

test('queda no meio da reprodução: o navegador volta e termina no mesmo estado', { timeout: 180000 }, async () => {
  const players = await Promise.all([openPlayer('A'), openPlayer('B')]);
  const [a, b] = players;
  try {
    await startRoom(a, b, '8ball');
    const next = await nextShooter(players);
    // The opponent watches at normal speed, so the drop lands inside the playback.
    await next.other.page.evaluate(() => { __menu.game.playbackRate = 1; });
    await next.shooter.page.evaluate(playOnlineTurn);
    await next.other.page.waitForFunction(() => __menu.game.state === 'SHOOTING' && __menu.game.playback !== null, { timeout: 30000 });
    await next.other.page.evaluate(() => __menu.onlineSession.dropConnection());
    await showsText(next.other.page, 'Reconectando');
    await next.other.page.waitForFunction(() => !__menu.game._hostPaused, { timeout: 30000 });
    await Promise.all(players.map((p) => settled(p.page, next.turnId)));
    const [ta, tb] = await Promise.all(players.map((p) => shownTable(p.page)));
    assert.deepEqual(ta, tb);
    const [va, vb] = await Promise.all([view(a.page), view(b.page)]);
    assert.deepEqual(va.turn, vb.turn);
    assert.deepEqual(a.errors, []);
    assert.deepEqual(b.errors, []);
  } finally {
    await closePlayers(players);
  }
});

test('recarregar a página no meio da partida volta para a mesma partida', { timeout: 180000 }, async () => {
  const players = await Promise.all([openPlayer('A'), openPlayer('B')]);
  const [a, b] = players;
  try {
    await startRoom(a, b, '8ball');
    assert.equal(await playShot(players, 1), true);
    const before = await view(a.page);

    await b.page.reload({ waitUntil: 'networkidle2' });
    await toMenu(b.page);
    await b.page.evaluate(() => { __menu._showOnline(); });
    await inGame(b.page);
    const [va, vb] = await Promise.all([view(a.page), view(b.page)]);
    assert.equal(vb.matchId, before.matchId);
    assert.deepEqual(vb.turn, va.turn);
    // The server's state comes back through Go with its keys in another order: compared as objects.
    const states = await Promise.all(players.map((p) => p.page.evaluate(() => __menu.game.match.match)));
    assert.deepEqual(states[1], states[0]);
    const [ta, tb] = await Promise.all(players.map((p) => shownTable(p.page)));
    assert.deepEqual(tb, ta);

    await b.page.evaluate(() => __menu.game._concede());
    await Promise.all([showsText(a.page, 'Vitória — o adversário desistiu'), showsText(b.page, 'Você desistiu')]);
    assert.deepEqual(a.errors, []);
    assert.deepEqual(b.errors, []);
  } finally {
    await closePlayers(players);
  }
});
