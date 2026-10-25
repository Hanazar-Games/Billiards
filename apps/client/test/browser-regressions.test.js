import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import puppeteer from 'puppeteer';
import { browserOptions, prepareBrowserPage } from './browser-options.js';
import { spawn } from 'node:child_process';
import { createServer as createSocketServer } from 'node:net';

test('real browser gameplay, presentation and lifecycle regressions', { timeout: process.env.CI ? 600000 : 180000 }, async t => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0, open: false } });
  await server.listen();
  t.after(() => server.close());
  const browser = await puppeteer.launch(browserOptions);
  t.after(() => browser.close());
  const page = await browser.newPage();
  await prepareBrowserPage(page);
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 2 });
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

  const menu = async () => {
    await page.evaluate(async () => {
      if (__menu.state === 'PLAYING') await __menu.game.onReturnToMenu();
      __menu._showMainMenu();
    });
    await page.waitForFunction(() => __menu.state === 'MENU');
  };

  await t.test('canvas follows viewport changes and retains saved render scale', async () => {
    const originalScale = await page.evaluate(async () => {
      const { settings } = await import('/src/core/SettingsStore.js');
      const original = settings.get('renderScale');
      settings.set('renderScale', 0.75);
      return original;
    });
    await page.reload({ waitUntil: 'networkidle2' });
    await page.waitForFunction(() => window.__menu && !document.getElementById('intro-screen'));
    for (const [width, height] of [[1440, 1000], [390, 844], [844, 390]]) {
      await page.setViewport({ width, height, deviceScaleFactor: 2 });
      await page.waitForFunction(() => __menu.renderer.width === innerWidth && __menu.renderer.height === innerHeight);
      const result = await page.evaluate(() => {
        const r = __menu.renderer;
        const canvas = r.renderer.domElement;
        const rect = canvas.getBoundingClientRect();
        const ratio = r.renderer.getPixelRatio();
        return {
          displayed: [rect.width, rect.height],
          buffer: [canvas.width, canvas.height],
          expected: [Math.floor(innerWidth * ratio * 0.75), Math.floor(innerHeight * ratio * 0.75)],
          aspect: r.camera.aspect,
        };
      });
      assert.deepEqual(result.displayed, [width, height]);
      assert.deepEqual(result.buffer, result.expected);
      assert.equal(result.aspect, width / height);
    }
    await page.evaluate(async scale => {
      const { settings } = await import('/src/core/SettingsStore.js');
      settings.set('renderScale', scale);
    }, originalScale);
    await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 2 });
  });

  await t.test('settings initially render and every category contains controls', async () => {
    await page.evaluate(() => __menu._showSettings());
    await page.waitForFunction(() => __menu.settingsScreen._contentArea.innerText.includes('主音量'));
    const categories = await page.evaluate(() => [...__menu.settingsScreen._tabEls.keys()]);
    for (const category of categories) {
      await page.evaluate(category => __menu.settingsScreen._switchCategory(category), category);
      assert.ok(await page.evaluate(() => __menu.settingsScreen._contentArea.innerText.trim().length > 10), category);
    }
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => __menu.settingsScreen._shown), false);
  });

  await t.test('menu sound toggles restore BGM and produce an audio signal', async () => {
    await page.mouse.click(10, 10);
    const result = await page.evaluate(async () => {
      const { settings } = await import('/src/core/SettingsStore.js');
      const audio = __menu.audio;
      settings.set('soundEnabled', false);
      const muted = !audio.soundEnabled && audio.bgmNodes.length === 0;
      settings.set('soundEnabled', true);
      await audio.ctx.resume();
      audio.startBGM();
      const analyser = audio.ctx.createAnalyser();
      audio._masterGain.connect(analyser);
      await new Promise(resolve => setTimeout(resolve, 160));
      const samples = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(samples);
      const bgmSignal = samples.some(value => Math.abs(value) > 0.00001);
      audio.stopBGM(false);
      await new Promise(resolve => setTimeout(resolve, 160));
      audio.playCueHit(80);
      await new Promise(resolve => setTimeout(resolve, 30));
      analyser.getFloatTimeDomainData(samples);
      const sfxSignal = samples.some(value => Math.abs(value) > 0.00001);
      audio._masterGain.disconnect(analyser);
      analyser.disconnect();
      audio.startBGM();
      return { muted, enabled: audio.soundEnabled, playing: audio.bgmNodes.length > 0, bgmSignal, sfxSignal };
    });
    assert.deepEqual(result, { muted: true, enabled: true, playing: true, bgmSignal: true, sfxSignal: true });
  });

  await t.test('freeplay renders geometry and settings Escape preserves the pause menu', async () => {
    await menu();
    await page.evaluate(() => __menu._startGame('freeplay'));
    await page.waitForFunction(() => __menu.game?.state === 'AIM' && __menu.renderer.renderer.info.render.triangles > 1000);
    assert.ok(await page.evaluate(() => __menu.renderer.renderer.getContext() instanceof WebGL2RenderingContext));
    await page.evaluate(() => __menu.game._openInGameSettings());
    await page.keyboard.press('Escape');
    assert.deepEqual(await page.evaluate(() => ({ settings: __menu.game._settingsOpen, paused: __menu.game.paused })),
      { settings: false, paused: true });
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => __menu.game.paused), false);
    if (process.env.BROWSER_SCREENSHOT) await page.screenshot({ path: process.env.BROWSER_SCREENSHOT + '.game.png' });
  });

  await t.test('the sim worker simulates a shot off the main thread', async () => {
    const r = await page.evaluate(async () => {
      const { simClient } = await import('/src/sim/SimWorkerClient.js');
      const table = { tableProfileId: 'pool9ft', balls: [{ id: 0, x: 0, z: -50, pocketed: false }, { id: 1, x: 0, z: 0, pocketed: false }] };
      const res = await simClient.simulate(table, { angle: Math.PI / 2, power: 40, spin: { x: 0, y: 0 } });
      return { first: res.events.find(e => e.type === 'first_contact')?.ball, frames: res.frames.length, steps: res.steps, z1: res.final.balls[1].z };
    });
    assert.equal(r.first, 1);
    assert.equal(r.frames, Math.floor(r.steps / 12));
    assert.ok(r.z1 > 0);
  });

  await t.test('a mouse drag plays the shot from the worker trajectory', async () => {
    await page.evaluate(() => { __menu.game.onboardingTips.hide(); });
    await page.keyboard.press('2');
    await new Promise(resolve => setTimeout(resolve, 200));
    const point = await page.evaluate(() => {
      const game = __menu.game;
      const position = game.ballsManager.getCueBall().mesh.position.clone().project(game.camera);
      const rect = game.renderer.renderer.domElement.getBoundingClientRect();
      return { x: (position.x + 1) * rect.width / 2 + rect.left, y: (1 - position.y) * rect.height / 2 + rect.top };
    });
    assert.ok(point.x > 0 && point.x < 1440 && point.y > 0 && point.y < 1000, 'top camera keeps the cue ball on screen');
    await page.waitForFunction(({ x, y }) => document.elementFromPoint(x, y) === __menu.renderer.renderer.domElement, {}, point);
    if (process.env.BROWSER_SCREENSHOT) await page.screenshot({ path: process.env.BROWSER_SCREENSHOT + '.top.png' });
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.mouse.move(point.x + 100, point.y + 20, { steps: 8 });
    await new Promise(resolve => setTimeout(resolve, 100));
    await page.mouse.up();
    await page.waitForFunction(() => __menu.game.state === 'SHOOTING');
    await page.waitForFunction(() => __menu.game.playback !== null);
    // The player knows the ball radius, so fast balls turn the way they roll (D044).
    assert.ok(await page.evaluate(async () => {
      const { BALL } = await import('/src/config.js');
      return __menu.game.playback.player._ballRadius === BALL.radius;
    }), 'the game gives the trajectory player the ball radius');
    const [x0, , z0] = await page.evaluate(() => __menu.game.ballsManager.getCueBall().mesh.position.toArray());
    await page.waitForFunction((x0, z0) => { const p = __menu.game.ballsManager.getCueBall().mesh.position; return Math.hypot(p.x - x0, p.z - z0) > 1; }, {}, x0, z0);
    await page.waitForFunction(() => __menu.game.state === 'AIM' && __menu.game.playback === null, { timeout: 25000 });
  });

  await t.test('a stale shot result is ignored after a reset', async () => {
    const r = await page.evaluate(async () => {
      const game = __menu.game; let release; const gate = new Promise(res => { release = res; });
      const real = game.simClient; game.simClient = { warm() {}, simulate: (...a) => gate.then(() => real.simulate(...a)) };
      game.power = 30; game.state = 'SHOOTING'; game.shoot();
      game.resetGame(); const rack = game.ballsManager.toTableState(game.tableProfileId);
      release(); await new Promise(res => setTimeout(res, 500));
      game.simClient = real;
      return { state: game.state, playback: game.playback, same: JSON.stringify(game.ballsManager.toTableState(game.tableProfileId)) === JSON.stringify(rack) };
    });
    assert.deepEqual(r, { state: 'AIM', playback: null, same: true });
  });

  await t.test('a failed simulation cancels the shot and the next one plays', async () => {
    const r = await page.evaluate(async () => {
      const game = __menu.game; const real = game.simClient; const before = JSON.stringify(game.ballsManager.toTableState(game.tableProfileId));
      game.simClient = { warm() {}, simulate: () => Promise.reject(new Error('boom')) };
      game.power = 30; game.state = 'SHOOTING'; game.shoot();
      await new Promise(res => setTimeout(res, 100));
      const cancelled = { state: game.state, same: JSON.stringify(game.ballsManager.toTableState(game.tableProfileId)) === before };
      game.simClient = real; game.power = 30; game.state = 'SHOOTING'; game.shoot();
      await new Promise(res => { const tick = () => (game.playback ? res() : requestAnimationFrame(tick)); tick(); });
      return cancelled;
    });
    assert.deepEqual(r, { state: 'AIM', same: true });
    await page.waitForFunction(() => __menu.game.state === 'AIM' && __menu.game.playback === null, { timeout: 25000 });
  });

  await t.test('a zero-power shot resolves without moving any ball', async () => {
    const r = await page.evaluate(async () => {
      const game = __menu.game; const real = game.simClient; let calls = 0;
      game.simClient = { warm() {}, simulate: (...a) => { calls++; return real.simulate(...a); } };
      const before = JSON.stringify(game.ballsManager.toTableState(game.tableProfileId)); const turns = game.statsTracker.totalTurns;
      game.power = 0; game.state = 'SHOOTING'; game.shoot();
      await new Promise(res => setTimeout(res, 300));
      game.simClient = real;
      return { calls, same: JSON.stringify(game.ballsManager.toTableState(game.tableProfileId)) === before, turns: game.statsTracker.totalTurns - turns, playback: game.playback };
    });
    assert.deepEqual(r, { calls: 0, same: true, turns: 1, playback: null });
  });

  await t.test('pausing during playback freezes the shot and resuming continues it', async () => {
    const r = await page.evaluate(async () => {
      const game = __menu.game; const wait = ms => new Promise(res => setTimeout(res, ms));
      game.power = 80; game.state = 'SHOOTING'; game.shoot();
      await new Promise(res => { const tick = () => (game.playback ? res() : requestAnimationFrame(tick)); tick(); });
      game._togglePause(); const t0 = game.playback.player.time; await wait(300);
      const frozen = game.playback.player.time === t0;
      game._togglePause(); await wait(300);
      return { frozen, resumed: game.playback === null || game.playback.player.time > t0 };
    });
    assert.deepEqual(r, { frozen: true, resumed: true });
    await page.waitForFunction(() => __menu.game.state === 'AIM' && __menu.game.playback === null, { timeout: 25000 });
  });

  await t.test('appearance changes update every bevel and preserve preset components', async () => {
    const result = await page.evaluate(async () => {
      const { settings } = await import('/src/core/SettingsStore.js');
      const { FELT_THEMES } = await import('/src/theme/TableThemes.js');
      settings.set('tableTheme', 'blackGold');
      settings.set('feltTheme', 'blue');
      const game = __menu.game;
      return {
        custom: settings.get('tableTheme'), wood: settings.get('woodTheme'),
        felt: game.table._materials.felt.color.getHex() === FELT_THEMES.blue.felt.color,
        bevel: game.table._materials.bevel.color.getHex() === FELT_THEMES.blue.bevel.color,
        bevelMeshes: game.table.meshGroup.children.filter(mesh => mesh.material === game.table._materials.bevel).length,
      };
    });
    assert.equal(result.custom, 'custom'); assert.equal(result.wood, 'blackLacquer');
    assert.ok(result.felt && result.bevel && result.bevelMeshes > 1);
  });

  await t.test('instant replay freezes physics and restores the live ball positions', async () => {
    const result = await page.evaluate(async () => {
      const game = __menu.game;
      const { ShotRecorder } = await import('/src/replay/ShotRecorder.js');
      const recorder = new ShotRecorder();
      recorder.start(game.ballsManager, 'freeplay', 50, { x: 0, y: 0 });
      recorder.update(1, game.ballsManager); recorder.stop();
      const cue = game.ballsManager.getCueBall();
      const original = cue.mesh.position.toArray();
      game._startInstantReplay(recorder.getReplayData());
      const replaying = game.state === 'REPLAYING' && game.instantReplay.active;
      game.instantReplay.update(0.1);
      const cameraBefore = game.camera.quaternion.toArray();
      __menu.renderer.render();
      const directed = game.camera.quaternion.toArray().every((v, i) => v === cameraBefore[i]);
      const cueBefore = cue.mesh.position.toArray();
      await new Promise(resolve => setTimeout(resolve, 100));
      const frozen = game.playback === null && cue.mesh.position.toArray().every((v, i) => v === cueBefore[i]);
      game.instantReplay.skip();
      return { replaying, frozen, directed, state: game.state, restored: cue.mesh.position.toArray().every((v, i) => v === original[i]) };
    });
    assert.deepEqual(result, { replaying: true, frozen: true, directed: true, state: 'AIM', restored: true });
  });

  await t.test('respotting puts the ball back on the table', async () => {
    const result = await page.evaluate(() => {
      const game = __menu.game; const ball = game.ballsManager.getBall(8);
      ball.remove();
      game._respotBall(8);
      return !ball.pocketed && ball.mesh.visible;
    });
    assert.ok(result);
  });

  await t.test('training samples real shot power and safely opens its result', async () => {
    await menu();
    await page.evaluate(async () => {
      const { getDrill } = await import('/src/trainer/DrillData.js');
      await __menu._startTrainer(getDrill('straight_shot'));
    });
    const result = await page.evaluate(() => {
      const game = __menu.game;
      __menu.loop.stop();
      game.power = 55; game.state = 'SHOOTING'; game.shoot();
      const power = game.drillManager.shotPower;
      const replayPower = game.recorder.metadata.maxPower;
      game.drillManager.onPocket(1);
      game.resolveTurn([1]);
      return { power, replayPower, disposed: game.state === 'DISPOSED', menu: __menu.state, result: __menu.trainerResult._shown };
    });
    assert.equal(result.power, 50); assert.equal(result.replayPower, 50);
    assert.equal(result.disposed, true); assert.equal(result.menu, 'MENU');
    await page.evaluate(async () => {
      const { getDrill } = await import('/src/trainer/DrillData.js');
      await __menu._startTrainer(getDrill('cut_shot_easy'));
      await __menu.game.onReturnToMenu();
      await __menu.trainerResult.onRetry();
    });
    assert.equal(await page.evaluate(() => __menu.activeDrill.id), 'cut_shot_easy');
  });

  await t.test('freeplay challenge completion reaches its result and retries the selected challenge', async () => {
    await menu();
    await page.evaluate(async () => {
      const { getChallenge } = await import('/src/challenges/ChallengeData.js');
      await __menu._startChallenge(getChallenge('soft_touch'));
    });
    assert.ok(await page.evaluate(() => {
      const game = __menu.game; __menu.loop.stop();
      game.power = 16.5; game.state = 'SHOOTING'; game.shoot();
      game.challengeManager.onPocket(1); game.resolveTurn([1]);
      return game.challengeManager.completed;
    }));
    await page.evaluate(async () => { await __menu.game.onReturnToMenu(); await __menu.challengeResult.onRetry(); });
    assert.equal(await page.evaluate(() => __menu.activeChallenge.id), 'soft_touch');
  });

  await t.test('tournament exit, win and concession produce the right bracket results', async () => {
    await menu();
    await page.evaluate(async () => {
      __menu._showTournament(); __menu.tournamentPanel.engine.create('Browser Player', 0, '9ball');
      await __menu._startTournamentMatch();
    });
    assert.equal(await page.evaluate(() => __menu.game.mode), '9ball');
    await page.evaluate(() => __menu.game.onReturnToMenu());
    assert.equal(await page.evaluate(() => __menu.tournamentPanel.engine.getCurrentMatch().p1Score), 0);
    await page.evaluate(async () => {
      await __menu._startTournamentMatch();
      const game = __menu.game; __menu.loop.stop();
      game.rules.breakShot = false; game.rules.startShot(1); game.rules.recordFirstHit(1);
      game.resolveTurn([9]);
    });
    assert.equal(await page.evaluate(() => __menu.tournamentPanel.engine.getCurrentMatch().round), 1);
    for (let i = 0; i < 2; i++) {
      await page.evaluate(async () => {
        await __menu._startTournamentMatch();
        __menu.game.currentPlayer = 2; __menu.game._concede();
      });
    }
    assert.equal(await page.evaluate(() => __menu.tournamentPanel.engine.state.status), 'finished');
    assert.equal(await page.evaluate(() => __menu.tournamentPanel.engine.getTournamentSummary().isChampion), false);
  });

  await t.test('host timeout snapshots include ball-in-hand and AI can take the next turn', async () => {
    await menu();
    await page.evaluate(() => __menu._startGame('9ball'));
    const result = await page.evaluate(() => {
      const game = __menu.game;
      __menu.loop.stop();
      let snapshot;
      game.networkRole = 'host';
      game.networkController = { sendStateSnapshot: value => { snapshot = value; } };
      game._onTurnTimerExpired();
      game.networkRole = null; game.networkController = null;
      return { ballInHand: snapshot.ballInHand, currentPlayer: snapshot.currentPlayer };
    });
    assert.deepEqual(result, { ballInHand: true, currentPlayer: 2 });
    await menu();
    await page.evaluate(() => __menu._startGame('vsai'));
    await page.evaluate(() => __menu.game._onTurnTimerExpired());
    assert.equal(await page.evaluate(() => __menu.game.currentPlayer), 2);
    assert.equal(await page.evaluate(() => __menu.game.state), 'AI_THINKING');
    assert.equal(await page.evaluate(() => __menu.game.ballInHand), false);
  });

  await t.test('new panels fit desktop and narrow screens', async () => {
    await menu();
    for (const width of [1440, 390]) {
      await page.setViewport({ width, height: 844, deviceScaleFactor: 2 });
      for (const method of ['_showSettings', '_showCareerStats', '_showHighlights', '_showTournament', '_showTrainer', '_showChallenges']) {
        await page.evaluate(method => __menu[method](), method);
        await new Promise(resolve => setTimeout(resolve, 150));
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${method} at ${width}px`);
        if (width === 390 && method === '_showSettings' && process.env.BROWSER_SCREENSHOT) {
          await page.screenshot({ path: process.env.BROWSER_SCREENSHOT + '.settings.png' });
        }
        await menu();
      }
    }
    if (process.env.BROWSER_SCREENSHOT) await page.screenshot({ path: process.env.BROWSER_SCREENSHOT });
  });

  await t.test('confirmation dialogs activate the focused cancel button on Enter', async () => {
    await menu(); await page.evaluate(() => __menu._startGame('freeplay'));
    await page.evaluate(() => {
      window.__confirmed = 0;
      __menu.game.ui._showConfirmDialog('Keyboard regression', () => __confirmed++);
    });
    await page.waitForFunction(() => document.activeElement?.textContent === '取消');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => __confirmed), 0);
    await page.evaluate(() => __menu.game._openInGameSettings());
    await page.evaluate(() => __menu.game.inGameSettings._showConfirmDialog('Keyboard regression', 'Cancel this action', () => __confirmed++));
    await page.focus('.settings-confirm-backdrop button');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => __confirmed), 0);
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  });

  await t.test('Escape can be captured as a binding without closing settings', async () => {
    await menu(); await page.evaluate(() => __menu._showSettings());
    await page.evaluate(async () => {
      const { keyBindings } = await import('/src/input/KeyBindings.js');
      window.__capturedBinding = null;
      keyBindings.startListening('instantReplay', (_action, chord) => { __capturedBinding = chord; });
    });
    await page.keyboard.press('Escape');
    assert.deepEqual(await page.evaluate(() => ({ key: __capturedBinding, shown: __menu.settingsScreen._shown })),
      { key: 'escape', shown: true });
    await page.keyboard.press('Escape');
  });

  await t.test('local nine-ball matches display series scores and start the next rack', async () => {
    await menu();
    await page.evaluate(() => __menu._startMatchGame({ mode: '9ball', gamesNeeded: 3, p1Name: 'Alpha', p2Name: 'Beta' }));
    await page.evaluate(() => {
      const game = __menu.game; __menu.loop.stop();
      game.rules.breakShot = false; game.rules.startShot(1); game.rules.recordFirstHit(1); game.resolveTurn([9]);
    });
    assert.ok(await page.evaluate(() => __menu.game.ui._lastMessage.includes('比分 1 : 0')));
    await page.evaluate(() => __menu.game.ui._hudNewGameBtn.click());
    await page.waitForFunction(() => __menu.state === 'PLAYING' && __menu.game?.state === 'AIM');
    assert.equal(await page.evaluate(() => __menu.game.mode), '9ball');
    assert.equal(await page.evaluate(() => __menu.matchManager.getStatus().currentGame), 2);
    await page.evaluate(() => {
      const game = __menu.game; __menu.loop.stop();
      game.rules.breakShot = false; game.rules.startShot(1); game.rules.recordFirstHit(1); game.resolveTurn([9]);
    });
    assert.ok(await page.evaluate(() => __menu.game.ui._lastMessage.includes('Alpha 赢得比赛')));
  });

  await t.test('LAN lobby controls fit a narrow viewport', async () => {
    await menu();
    await page.setViewport({ width: 390, height: 700 });
    await page.evaluate(() => __menu._showLanRoom());
    const overflow = await page.evaluate(() => [...document.querySelectorAll('#lan-room-panel input, #lan-room-panel button')]
      .filter(el => { const r = el.getBoundingClientRect(); return r.left < 0 || r.right > innerWidth; })
      .map(el => el.textContent || el.placeholder));
    assert.deepEqual(overflow, []);
    const card = await page.evaluate(() => {
      const rect = document.querySelector('#lan-room-panel').firstElementChild.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: innerWidth };
    });
    assert.ok(card.left >= 0 && card.right <= card.width, 'the entire lobby card fits');
    await page.setViewport({ width: 844, height: 390 });
    assert.ok(await page.evaluate(() => document.querySelector('#lan-room-panel').firstElementChild.getBoundingClientRect().top >= 0), 'short screens can reach the top of the card');
    await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 2 });
  });

  await t.test('spin picker cannot change an AI shot or a paused shot', async () => {
    await menu();
    await page.evaluate(() => __menu._startGame('vsai'));
    const result = await page.evaluate(() => {
      const game = __menu.game;
      __menu.loop.stop();
      game.currentPlayer = 2; game.state = 'CHARGING';
      game.cueTipOffset = { x: 0.2, y: 0.3 };
      const picker = document.getElementById('cue-tip-ball');
      const rect = picker.getBoundingClientRect();
      const pointer = () => picker.dispatchEvent(new PointerEvent('pointerdown', {
        pointerId: 1, clientX: rect.right - 5, clientY: rect.top + 5, bubbles: true,
      }));
      picker.setPointerCapture = () => {};
      pointer();
      const ai = { ...game.cueTipOffset };
      game.currentPlayer = 1; game.paused = true;
      pointer();
      return { ai, paused: game.cueTipOffset };
    });
    assert.deepEqual(result, { ai: { x: 0.2, y: 0.3 }, paused: { x: 0.2, y: 0.3 } });
  });

  await t.test('cancelled and confirmed shots keep the HUD in the actual game state', async () => {
    await menu();
    await page.evaluate(() => __menu._startGame('freeplay'));
    await page.evaluate(() => {
      __menu.game.state = 'CHARGING'; __menu.game.charging = true;
      __menu.game.power = 55; __menu.game.ui.setHUDState('CHARGING');
    });
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => __menu.game.ui._hudState), 'AIM');
    await page.evaluate(async () => {
      const { settings } = await import('/src/core/SettingsStore.js');
      settings.set('confirmShotOnRelease', false);
      __menu.game.power = 55;
    });
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => __menu.game.ui._hudState), 'SHOOTING');
    await page.evaluate(async () => (await import('/src/core/SettingsStore.js')).settings.set('confirmShotOnRelease', true));
  });

  await t.test('AI thinking feedback clears when the shot starts', async () => {
    await menu();
    await page.evaluate(() => __menu._startGame('vsai'));
    await page.evaluate(async () => {
      const game = __menu.game;
      __menu.loop.stop();
      game.currentPlayer = 2;
      game.aiPlayer.takeTurn = async () => ({ aimDirection: { x: 0, z: 1 }, power: 30, cueTipOffset: { x: 0, y: 0 } });
      await game.startAITurn();
    });
    const result = await page.evaluate(() => ({ state: __menu.game.state, hud: __menu.game.ui._hudState, message: __menu.game.ui._lastMessage }));
    assert.equal(result.state, 'SHOOTING');
    assert.equal(result.hud, 'SHOOTING');
    assert.ok(!result.message.includes('思考中'));
  });

  await t.test('draw-ref in the game: the cue ball comes back after the contact', async () => {
    await menu();
    await page.evaluate(() => __menu._startGame('freeplay'));
    await page.waitForFunction(() => __menu.game?.state === 'AIM');
    const r = await page.evaluate(async () => {
      const res = await window.__referenceShot('draw-ref');
      const cueZ = res.frames.flatMap(f => f.balls.filter(b => b.id === 0).map(b => b.z));
      return { contact: res.events.some(e => e.type === 'first_contact'), draw: Math.max(...cueZ) - res.final.balls[0].z,
        exact: __menu.game.ballsManager.getCueBall().mesh.position.z === res.final.balls[0].z };
    });
    assert.equal(r.contact, true); assert.ok(r.draw >= 10, `recuo de ${r.draw.toFixed(1)} cm`); assert.equal(r.exact, true);
  });

  await t.test('a reference shot gives the player\'s spin back, played or cancelled', async () => {
    await menu();
    await page.evaluate(() => __menu._startGame('freeplay'));
    await page.waitForFunction(() => __menu.game?.state === 'AIM');
    const r = await page.evaluate(async () => {
      const game = __menu.game; const real = game.simClient;
      const picker = () => { const m = document.getElementById('cue-tip-marker'); return m && [m.style.left, m.style.top]; };
      game._updateCueTipPicker(); const marker = picker();
      game.cueTipOffset = { x: 0.3, y: 0.2 }; game._updateCueTipPicker(); const wanted = picker();
      await window.__referenceShot('draw-ref');
      const played = { spin: game.cueTipOffset, picker: picker() };
      game.simClient = { warm() {}, simulate: () => Promise.reject(new Error('boom')) };
      const cancelled = { error: await window.__referenceShot('draw-ref').then(() => null, e => e.message) };
      game.simClient = real;
      return { marker, wanted, played, cancelled, spin: game.cueTipOffset, picker: picker() };
    });
    assert.ok(r.marker && r.wanted[0] !== r.marker[0], 'the picker shows the player\'s spin');
    assert.deepEqual(r.played, { spin: { x: 0.3, y: 0.2 }, picker: r.wanted });
    assert.match(r.cancelled.error, /cancelled/);
    assert.deepEqual(r.spin, { x: 0.3, y: 0.2 });
    assert.deepEqual(r.picker, r.wanted);
  });

  await t.test('two browsers keep their LAN connection through play and synchronize the clock', async t => {
    const socket = createSocketServer();
    await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
    const port = socket.address().port;
    await new Promise(resolve => socket.close(resolve));
    const relay = spawn(process.execPath, ['server/lan-server.js'], {
      env: { ...process.env, LAN_SERVER_PORT: String(port), LAN_SERVER_HOST: '127.0.0.1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    t.after(() => new Promise(resolve => { relay.once('exit', resolve); relay.kill(); }));
    await new Promise((resolve, reject) => {
      relay.once('error', reject);
      relay.once('exit', code => reject(new Error(`LAN server exited: ${code}`)));
      relay.stdout.on('data', chunk => { if (chunk.toString().includes('listening')) resolve(); });
    });
    const context = await browser.createBrowserContext();
    t.after(() => context.close());
    const guest = await context.newPage();
    await prepareBrowserPage(guest);
    guest.on('pageerror', error => errors.push(error.message));
    await guest.setViewport({ width: 1280, height: 900 });
    const ws = `ws://127.0.0.1:${port}`;
    await guest.goto(server.resolvedUrls.local[0] + '?ws=' + encodeURIComponent(ws), { waitUntil: 'networkidle2' });
    await guest.waitForFunction(() => window.__menu && !document.getElementById('intro-screen'));
    await menu();
    await page.evaluate(async ws => {
      history.replaceState(null, '', '?ws=' + encodeURIComponent(ws));
      const { settings } = await import('/src/core/SettingsStore.js');
      settings.set('turnTimer', '30');
      __menu._showLanRoom(); await __menu.lanRoomPanel._onCreateRoom();
    }, ws);
    await page.waitForFunction(() => __menu.lanRoomPanel?._roomId);
    assert.equal(await page.evaluate(() => __menu.lanRoomPanel._startBtn.disabled), true);
    const room = await page.evaluate(() => __menu.lanRoomPanel._roomId);
    await guest.evaluate(async room => {
      __menu._showLanRoom(); __menu.lanRoomPanel._joinInput.value = room;
      await __menu.lanRoomPanel._onJoinRoom();
    }, room);
    await guest.waitForFunction(() => __menu.lanRoomPanel?._state === 'joined');
    await page.waitForFunction(() => !__menu.lanRoomPanel._startBtn.disabled);
    await page.evaluate(() => __menu.lanRoomPanel.client.startGame('9ball', 'pool9ft'));
    await Promise.all([
      page.waitForFunction(() => __menu.state === 'PLAYING' && __menu.game?.networkController?.connected),
      guest.waitForFunction(() => __menu.state === 'PLAYING' && __menu.game?.networkController?.connected),
    ]);
    await guest.waitForFunction(() => __menu.game._turnTimerRemaining < 30);
    assert.equal(await guest.evaluate(() => __menu.game.mode), '9ball');
    await page.evaluate(() => { __menu.game._onTurnTimerExpired(); __menu.game._showPause(); });
    await guest.waitForFunction(() => __menu.game.ballInHand && __menu.game.currentPlayer === 2 && __menu.game._hostPaused);
    const remaining = await guest.evaluate(() => __menu.game._turnTimerRemaining);
    await new Promise(resolve => setTimeout(resolve, 350));
    assert.equal(await guest.evaluate(() => __menu.game._turnTimerRemaining), remaining);
    await page.evaluate(() => __menu.game._hidePause());
    await guest.waitForFunction(() => !__menu.game._hostPaused);
    await guest.evaluate(() => __menu.game.networkController.sendShotInput({ x: 0, y: 0, z: 1 }, 0, {}, { x: 0, y: 3, z: -90 }));
    await guest.waitForFunction(() => !__menu.game.ballInHand);
    await guest.evaluate(() => { __menu.game.state = 'CHARGING'; __menu.game.power = 55; __menu.game.charging = true; });
    await new Promise(resolve => setTimeout(resolve, 350));
    assert.equal(await guest.evaluate(() => __menu.game.state), 'CHARGING');
    await guest.evaluate(() => { __menu.game.state = 'SHOOTING'; __menu.game.shoot(); });
    await page.waitForFunction(() => __menu.game.statsTracker.playerStats[2].shots === 1);
    await guest.waitForFunction(() => __menu.game.statsTracker.playerStats[2].shots === 1);
    assert.equal(await guest.evaluate(() => __menu.game.statsTracker.playerStats[2].avgPower), 50);

    await page.evaluate(() => {
      const game = __menu.game;
      game.currentPlayer = 1; game.rules.gameOver = true; game.rules.winner = 2;
      game.resolveTurn([], { gameOver: true, winner: 2, message: '玩家 2 获胜' });
    });
    await guest.waitForFunction(() => __menu.game.state === 'GAME_OVER' && __menu.game.statsPanel._gameOverOverlay?.style.display === 'flex');
    await guest.keyboard.press('Escape');
    await guest.evaluate(() => __menu.game.ui._hudNewGameBtn.click());
    await Promise.all([
      page.waitForFunction(() => __menu.game._rackId === 1 && __menu.game.state === 'AIM'),
      guest.waitForFunction(() => __menu.game._rackId === 1 && __menu.game.state === 'AIM' && __menu.game.statsPanel._gameOverOverlay.style.display === 'none'),
    ]);
    await guest.evaluate(() => __menu.game._openInGameSettings());
    await page.evaluate(() => __menu.game.resetGame());
    await guest.waitForFunction(() => __menu.game._rackId === 2 && !__menu.game.paused && !__menu.game._settingsOpen);
    assert.ok(await guest.evaluate(() => performance.now() - __menu.game.gameStartTime < 2000));
    await guest.evaluate(() => __menu.game.onReturnToMenu());
    await page.waitForFunction(() => __menu.state === 'MENU', { timeout: 6000 });
    await page.evaluate(() => history.replaceState(null, '', location.pathname));
  });

  assert.deepEqual(errors, [], 'browser console and uncaught errors');
});
