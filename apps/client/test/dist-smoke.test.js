import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import puppeteer from 'puppeteer';
import { browserOptions, prepareBrowserPage } from './browser-options.js';
import { VERSION_TAG } from '../src/core/Version.js';

const dist = resolve(process.env.DIST_DIR || 'dist');
const base = process.env.PAGES_URL ? new URL(process.env.PAGES_URL).pathname : (process.env.PAGES_BASE_PATH || '/Billiards/');
const pages = process.argv.includes('--pages');

test('production artifact on a GitHub Pages project path', { timeout: process.env.CI ? 240000 : 120000 }, async t => {
  const server = createServer(async (req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname === base.slice(0, -1)) { res.writeHead(301, { Location: base }); res.end(); return; }
    const file = resolve(dist, pathname.slice(base.length) || 'index.html');
    try {
      if (!pathname.startsWith(base) || !file.startsWith(dist + sep) || !(await stat(file)).isFile()) throw new Error('Not found');
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
      res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
      res.end(await readFile(file));
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end(await readFile(resolve(dist, '404.html')).catch(() => 'Not found'));
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = process.env.PAGES_URL ? new URL(process.env.PAGES_URL).origin : `http://127.0.0.1:${server.address().port}`;
  const browser = await puppeteer.launch(browserOptions);
  t.after(() => browser.close());
  const page = await browser.newPage();
  await prepareBrowserPage(page);
  await page.setViewport({ width: 1440, height: 1000 });
  const errors = [], assets = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', response => {
    if (response.request().resourceType() === 'script') {
      assets.push(response.url());
      if (!response.ok()) errors.push(`HTTP ${response.status()}: ${response.url()}`);
    }
  });
  const ready = () => page.waitForFunction(() => window.__menu && !document.getElementById('intro-screen'));
  // Polls a Node-side condition (the script responses are collected here, not in the page).
  const until = async (condition, ms = 5000) => {
    for (const end = Date.now() + ms; !condition() && Date.now() < end;) await new Promise(resolve => setTimeout(resolve, 50));
  };

  await t.test('project URL boots without source files or asset failures', async () => {
    await page.goto(origin + base.slice(0, -1), { waitUntil: 'networkidle2' });
    await ready();
    assert.equal(page.url(), origin + base);
    assert.equal(await page.$eval('#version-tag', element => element.textContent), VERSION_TAG);
    assert.ok(await page.evaluate(() => __menu.renderer.renderer.getContext() instanceof WebGL2RenderingContext));
    // The build is split: the entry chunk and the Three.js vendor chunk load at boot.
    assert.ok(assets.some(url => /\/index-[^/]+\.js$/.test(url)));
    assert.ok(assets.some(url => /\/three-[^/]+\.js$/.test(url)));
    assert.ok(assets.every(url => url.startsWith(origin + base + 'assets/')));
    // The reference-shot hook is development only (main.js, import.meta.env.DEV).
    assert.equal(await page.evaluate(() => typeof window.__referenceShot), 'undefined');
    assert.deepEqual(errors, []);
  });

  await t.test('menu BGM and cue SFX emit real audio after a user gesture', async () => {
    await page.mouse.click(10, 10);
    const signal = await page.evaluate(async () => {
      const audio = __menu.audio;
      await audio.ctx.resume();
      const analyser = audio.ctx.createAnalyser();
      audio._masterGain.connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      const heard = () => { analyser.getFloatTimeDomainData(samples); return samples.some(v => Math.abs(v) > 0.00001); };
      audio.startBGM();
      await new Promise(resolve => setTimeout(resolve, 160));
      const bgm = heard();
      audio.stopBGM(false);
      await new Promise(resolve => setTimeout(resolve, 160));
      audio.playCueHit(80);
      await new Promise(resolve => setTimeout(resolve, 30));
      const sfx = heard();
      audio._masterGain.disconnect(analyser); analyser.disconnect(); audio.startBGM();
      return { bgm, sfx };
    });
    assert.deepEqual(signal, { bgm: true, sfx: true });
  });

  await t.test('free play, pause and return work in the built bundle', async () => {
    await page.evaluate(() => [...document.querySelectorAll('button.menu-btn')].find(b => b.textContent.includes('单人练习')).click());
    await page.waitForFunction(() => __menu.game?.state === 'AIM' && __menu.state === 'PLAYING');
    // The sim worker chunk (F1-B) takes the place of the old physics chunk: it loads with the game.
    await until(() => assets.some(url => /\/sim\.worker-[^/]+\.js$/.test(url)));
    assert.ok(assets.length >= 3);
    assert.ok(assets.some(url => /\/index-[^/]+\.js$/.test(url)));
    assert.ok(assets.some(url => /\/three-[^/]+\.js$/.test(url)));
    assert.ok(assets.some(url => /\/sim\.worker-[^/]+\.js$/.test(url)));
    assert.ok(assets.every(url => url.startsWith(origin + base + 'assets/')));
    assert.deepEqual(errors, []);
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => __menu.game.paused), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => __menu.game.paused), false);
    for (const [width, height] of [[390, 844], [844, 390]]) {
      await page.setViewport({ width, height });
      await page.waitForFunction(() => __menu.renderer.width === innerWidth && __menu.renderer.height === innerHeight);
      assert.deepEqual(await page.evaluate(() => {
        const rect = __menu.renderer.renderer.domElement.getBoundingClientRect();
        return [rect.width, rect.height];
      }), [width, height]);
      if (process.env.PAGES_SCREENSHOT) await page.screenshot({ path: `${process.env.PAGES_SCREENSHOT}.${width}.png` });
    }
    await page.setViewport({ width: 1440, height: 1000 });
    await page.evaluate(() => __menu.game.onReturnToMenu());
    await page.waitForFunction(() => __menu.state === 'MENU');
  });

  // After the free-play subtest on purpose: that one proves the worker chunk is fetched with the game,
  // so the chunk must not have been loaded by an earlier shot.
  await t.test('a free-play shot simulates in the bundled worker', async () => {
    await page.evaluate(() => [...document.querySelectorAll('button.menu-btn')].find(b => b.textContent.includes('单人练习')).click());
    await page.waitForFunction(() => __menu.game?.state === 'AIM' && __menu.state === 'PLAYING');
    await page.evaluate(() => { const game = __menu.game; game.power = 40; game.state = 'SHOOTING'; game.shoot(); });
    // Truthy, not `!== null`: a game without the worker pipeline has no `playback` at all.
    await page.waitForFunction(() => Boolean(__menu.game.playback));
    await page.waitForFunction(() => __menu.game.state === 'AIM' && __menu.game.playback === null, { timeout: 25000 });
    assert.ok(assets.some(url => /\/sim\.worker-[^/]+\.js$/.test(url)));
    assert.ok(assets.every(url => url.startsWith(origin + base + 'assets/')));
    assert.deepEqual(errors, []);
    await page.evaluate(() => __menu.game.onReturnToMenu());
    await page.waitForFunction(() => __menu.state === 'MENU');
  });

  await t.test('training loads its separate production chunk', async () => {
    await page.evaluate(() => {
      __menu._showTrainer();
      [...document.querySelectorAll('#trainer-panel div')].find(el => el.onclick && el.style.cursor === 'pointer').click();
    });
    await page.waitForFunction(() => __menu.state === 'PLAYING' && __menu.game?.mode === 'trainer');
    assert.ok(assets.some(url => /TrainerHUD-.*\.js$/.test(url)));
    assert.ok(await page.evaluate(() => __menu.renderer.renderer.info.render.triangles > 0));
    await page.evaluate(() => __menu.game.onReturnToMenu());
    await page.waitForFunction(() => __menu.state === 'MENU');
  });

  await t.test('settings and LAN controls fit a narrow screen', async () => {
    await page.setViewport({ width: 390, height: 844 });
    for (const method of ['_showSettings', '_showLanRoom']) {
      await page.evaluate(method => __menu[method](), method);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.evaluate(() => __menu._showMainMenu());
    }
  });

  if (pages) {
    await t.test('HTTPS Pages gives actionable LAN setup without attempting an imaginary relay', async () => {
      const hosted = await browser.newPage();
      await prepareBrowserPage(hosted);
      try {
        await hosted.setRequestInterception(true);
        hosted.on('request', async request => {
          const url = new URL(request.url());
          const path = resolve(dist, url.pathname.slice(base.length) || 'index.html');
          if (url.hostname !== 'fixture.github.io' || !url.pathname.startsWith(base) || !path.startsWith(dist + sep)) {
            await request.abort(); return;
          }
          const body = await readFile(path).catch(() => null);
          await request.respond({ status: body ? 200 : 404, contentType: extname(path) === '.js' ? 'text/javascript' : 'text/html', body: body || 'Not found' });
        });
        await hosted.evaluateOnNewDocument(() => {
          window.__socketAttempts = 0;
          window.WebSocket = class { constructor() { window.__socketAttempts++; throw new Error('Unexpected relay connection'); } };
        });
        await hosted.goto('https://fixture.github.io' + base, { waitUntil: 'networkidle2' });
        await hosted.waitForFunction(() => window.__menu);
        const result = await hosted.evaluate(async () => {
          __menu._showLanRoom();
          const panel = __menu.lanRoomPanel;
          const empty = panel._serverInput.value === '';
          await panel._onCreateRoom();
          const missing = panel._statusEl.textContent.includes('服务器地址');
          panel._serverInput.value = 'ws://localhost:3001';
          await panel._onCreateRoom();
          return { empty, missing, secure: panel._statusEl.textContent.includes('wss://'), attempts: window.__socketAttempts, canReturn: !panel._cancelBtn.disabled };
        });
        assert.deepEqual(result, { empty: true, missing: true, secure: true, attempts: 0, canReturn: true });
      } finally { await hosted.close(); }
    });
    await t.test('Pages includes a source-free artifact and a working 404 entry', async () => {
      await readFile(resolve(dist, '.nojekyll'));
      await readFile(resolve(dist, '404.html'));
      assert.ok(!(await readFile(resolve(dist, 'index.html'), 'utf8')).includes('src/main.js'));
      for (const path of ['dist/', 'missing/nested/']) {
        await page.goto(origin + base + path + '?check=pages#menu', { waitUntil: 'networkidle2' });
        await ready();
        assert.equal(page.url(), origin + base + '?check=pages#menu');
        assert.equal(await page.$eval('#version-tag', element => element.textContent), VERSION_TAG);
      }
    });
  }
  assert.deepEqual(errors, [], 'uncaught errors and failed production assets');
});
