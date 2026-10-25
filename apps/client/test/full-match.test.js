import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import puppeteer from 'puppeteer';
import { browserOptions, prepareBrowserPage } from './browser-options.js';

const MAX_PLAYER_SHOTS = 200;

/**
 * Runs in the page: plays the human's turn (player 1) the way a person would,
 * through the release of the mouse. The shot is chosen by a hard AI.
 */
async function playHumanTurn() {
  const game = __menu.game;
  const { AIPlayer } = await import('/src/ai/AIPlayer.js');

  if (game.ballInHand) {
    // The same placement the game uses for the AI's cue ball.
    game._placeCueBallInHand(game.ballInHandBehindLine);
    game._endBallInHand();
  }

  const ai = new AIPlayer('hard');
  ai.settings.thinkTimeMin = ai.settings.thinkTimeMax = 0;
  const decision = await ai.takeTurn(game);
  if (!decision) throw new Error('the AI planner returned no shot for the human turn');

  game.aimDirection.set(decision.aimDirection.x, 0, decision.aimDirection.z).normalize();
  game.cueTipOffset = decision.cueTipOffset || { x: 0, y: 0 };
  game.power = Math.max(decision.power, 1); // onMouseUp drops a release below 1
  game.state = 'CHARGING';
  game.charging = true;
  game.onMouseUp({ type: 'pointerup' });
}

test('8-ball contra a IA vai até o fim sem erros no console', { timeout: 600000 }, async t => {
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
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(server.resolvedUrls.local[0], { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => window.__menu && !document.getElementById('intro-screen'));
  await page.evaluate(async () => {
    const { settings } = await import('/src/core/SettingsStore.js');
    settings.set('reducedMotion', true);
    settings.set('autoInstantReplay', false);
    settings.set('cameraAutoResetAfterShot', false);
  });

  const started = Date.now();
  await page.evaluate(() => __menu._startGame('vsai'));
  await page.waitForFunction(() => __menu.game?.state === 'AIM');
  await page.evaluate(() => {
    const g = __menu.game;
    g.playbackRate = 8;
    g.aiPlayer.settings.thinkTimeMin = g.aiPlayer.settings.thinkTimeMax = 0;
  });

  let shots = 0;
  while (!(await page.evaluate(() => __menu.game.rules.gameOver)) && shots < MAX_PLAYER_SHOTS) {
    await page.waitForFunction(() => {
      const g = __menu.game;
      return g.rules.gameOver || (g.state === 'AIM' && g.currentPlayer === 1);
    }, { timeout: 60000 });
    if (await page.evaluate(() => __menu.game.rules.gameOver)) break;
    await page.evaluate(playHumanTurn);
    shots++;
  }

  const end = await page.evaluate(() => ({ gameOver: __menu.game.rules.gameOver, winner: __menu.game.rules.winner, state: __menu.game.state }));
  console.log(`full match: ${shots} human shots, winner ${end.winner}, ${((Date.now() - started) / 1000).toFixed(1)} s`);
  assert.equal(end.gameOver, true, `sem fim depois de ${shots} tacadas do jogador`);
  assert.deepEqual(errors, []);
});
