// F2-05: local two-player 8-ball and 9-ball matches go to the end through the
// match controller (packages/modes), with no console errors.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import puppeteer from 'puppeteer';
import { browserOptions, prepareBrowserPage } from './browser-options.js';

const MAX_SHOTS = 300;

/**
 * Runs in the page: plays the turn of whoever is at the table the way a person
 * would, through the release of the mouse, with a shot a hard AI chooses. A
 * pending 9-ball push-out is accepted.
 */
async function playTurn() {
  const game = __menu.game;
  if (game.match.status().pushOutPending) {
    game._applyPushOutChoice('accept');
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

async function playMatch(t, mode) {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0, open: false } });
  await server.listen();
  t.after(() => server.close());
  const browser = await puppeteer.launch(browserOptions);
  t.after(() => browser.close());
  const page = await browser.newPage();
  await prepareBrowserPage(page);
  await page.setViewport({ width: 1280, height: 800 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
    // A shot the worker could not simulate is cancelled with only a warning.
    else if (message.type() === 'warn' && /shot simulation failed/.test(message.text())) errors.push(message.text());
  });
  await page.goto(server.resolvedUrls.local[0], { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => window.__menu && !document.getElementById('intro-screen'));
  await page.evaluate(async () => {
    const { settings } = await import('/src/core/SettingsStore.js');
    settings.set('reducedMotion', true);
    settings.set('autoInstantReplay', false);
    settings.set('cameraAutoResetAfterShot', false);
  });

  const started = Date.now();
  await page.evaluate((m) => __menu._startGame(m), mode);
  await page.waitForFunction(() => __menu.game?.state === 'AIM');
  await page.evaluate(() => { __menu.game.playbackRate = 8; });

  let shots = 0;
  const over = () => page.evaluate(() => __menu.game.match.status().gameOver);
  while (!(await over()) && shots < MAX_SHOTS) {
    await page.waitForFunction(() => {
      const g = __menu.game;
      return g.match.status().gameOver || g.state === 'AIM';
    }, { timeout: 60000 });
    if (await over()) break;
    await page.evaluate(playTurn);
    shots++;
  }

  // The controller decides the shot before it plays back: wait for the winning
  // shot to finish, then let the game-over flow run for a few frames.
  await page.waitForFunction(() => __menu.game.state !== 'SHOOTING' && __menu.game.playback === null, { timeout: 60000 });
  await page.evaluate(() => new Promise(res => { let n = 10; const tick = () => (--n ? requestAnimationFrame(tick) : res()); tick(); }));
  const end = await page.evaluate(() => ({ ...__menu.game.match.status(), state: __menu.game.state }));
  console.log(`${mode}: ${shots} shots, winner ${end.winner}, ${((Date.now() - started) / 1000).toFixed(1)} s`);
  assert.equal(end.gameOver, true, `sem fim depois de ${shots} tacadas`);
  assert.ok([1, 2].includes(end.winner), `vencedor ${end.winner}`);
  assert.equal(end.state, 'GAME_OVER');
  assert.deepEqual(errors, []);
}

test('8-ball local de 2 jogadores vai até o fim sem erros', { timeout: 600000 }, t => playMatch(t, 'local2p'));

test('9-ball local de 2 jogadores vai até o fim sem erros', { timeout: 600000 }, t => playMatch(t, '9ball'));
