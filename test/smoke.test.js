/**
 * Smoke Test — Browser-level integration test via Puppeteer.
 *
 * Covers every major entry point from the main menu:
 *   Home, Free Play, Local 2P, vs AI, 9-Ball, Trainer, Challenge, LAN, Settings
 *
 * For each entry we verify:
 *   - No Game init failed / TypeError / ReferenceError in console
 *   - No JS error overlay visible
 *   - Canvas element present and WebGL context active
 *   - UI layer state transitions correctly
 */

import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import net from 'net';
import { setTimeout as sleep } from 'timers/promises';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEBGL_MOCK_CODE = readFileSync(join(__dirname, 'webgl-mock.js'), 'utf-8');

let DEV_PORT = Number(process.env.SMOKE_PORT || 5173);
let BASE_URL = `http://127.0.0.1:${DEV_PORT}`;
const NAV_TIMEOUT = 30000;
const GAME_INIT_TIMEOUT = 10000;
const PANEL_OPEN_TIMEOUT = 3000;

let serverProcess = null;
let browser = null;
let page = null;
const consoleErrors = [];
const consoleWarnings = [];

// ── Helpers ───────────────────────────────────────────────────────────────

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

async function findAvailablePort(startPort) {
  for (let port = startPort; port < startPort + 50; port++) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No available smoke-test port found from ${startPort}`);
}

function startDevServer() {
  return new Promise(async (resolve, reject) => {
    try {
      DEV_PORT = await findAvailablePort(DEV_PORT);
      BASE_URL = `http://127.0.0.1:${DEV_PORT}`;
    } catch (err) {
      reject(err);
      return;
    }

    const proc = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(DEV_PORT), '--strictPort'], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });
    serverProcess = proc;

    let resolved = false;
    const onReady = (data) => {
      const text = data.toString();
      if (!resolved && text.includes('Local:')) {
        resolved = true;
        resolve(proc);
      }
    };
    proc.stdout.on('data', onReady);
    proc.stderr.on('data', onReady);

    proc.on('error', (err) => {
      if (!resolved) reject(err);
    });
    proc.on('exit', (code, signal) => {
      if (!resolved) {
        reject(new Error(`Vite dev server exited before ready (code=${code}, signal=${signal})`));
      }
    });

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(proc);
      }
    }, 6000);
  });
}

async function stopDevServer() {
  if (!serverProcess) return;
  serverProcess.kill('SIGTERM');
  await sleep(1000);
  if (!serverProcess.killed) {
    serverProcess.kill('SIGKILL');
  }
}

async function captureConsole() {
  page.on('pageerror', (err) => {
    consoleErrors.push({ type: 'pageerror', message: err.message, stack: err.stack });
  });
  page.on('console', (msg) => {
    const text = msg.text();
    const type = msg.type();
    if (type === 'error') {
      consoleErrors.push({ type: 'console.error', message: text });
    } else if (type === 'warning' || text.toLowerCase().includes('warn')) {
      consoleWarnings.push({ type, message: text });
    }
  });
  page.on('response', (response) => {
    const status = response.status();
    if (status >= 400) {
      consoleErrors.push({ type: 'network', message: `HTTP ${status}: ${response.url()}` });
    }
  });
}

function hasSevereErrors(errors) {
  return errors.some((e) => {
    const m = e.message || '';
    if (/Failed to load resource|the server responded|favicon/i.test(m)) return false;
    return /Game init failed|TypeError|ReferenceError|ENGINE INIT ERROR|MENU SETUP ERROR|Cannot read propert|Cannot set propert|is not a function/i.test(m);
  });
}

function recentErrorsSince(mark) {
  return consoleErrors.slice(mark);
}

async function waitFor(condition, timeoutMs = 5000, intervalMs = 200) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await condition()) return true;
    await sleep(intervalMs);
  }
  return false;
}

async function pageGoto(url) {
  await page.goto(url, { waitUntil: 'networkidle2', timeout: NAV_TIMEOUT });
}

async function waitForMenuReady() {
  const ready = await waitFor(
    async () => {
      const hasMenuBtn = await page.evaluate(() => document.querySelector('.menu-btn') !== null);
      const introHidden = await page.evaluate(() => {
        const el = document.getElementById('intro-screen');
        return !el || el.classList.contains('hidden') || el.style.display === 'none';
      });
      return hasMenuBtn && introHidden;
    },
    15000,
    500
  );
  if (!ready) {
    const html = await page.evaluate(() => ({
      bodyChildren: Array.from(document.body.children).map((c) => c.tagName + (c.id ? '#' + c.id : '') + (c.className ? '.' + c.className : '')),
      menuLayerHTML: document.getElementById('menu-layer')?.innerHTML?.slice(0, 800) || 'missing',
      hasApp: !!document.getElementById('app'),
      hasCanvas: !!document.querySelector('canvas'),
      menuBtns: Array.from(document.querySelectorAll('.menu-btn')).map((b) => b.textContent?.slice(0, 30)),
      viteError: document.querySelector('vite-error-overlay')?.shadowRoot?.textContent?.slice(0, 1200) || null,
      jsErrorContent: document.getElementById('js-error-content')?.textContent?.slice(0, 1200) || null,
    }));
    console.log('  [debug] Page state:', JSON.stringify(html, null, 2));
  }
}

async function isErrorOverlayVisible() {
  return page.evaluate(() => {
    const el = document.getElementById('js-error-overlay');
    return el && el.classList.contains('visible');
  });
}

async function isCanvasPresent() {
  return page.evaluate(() => document.querySelector('canvas') !== null);
}

async function isCanvasRendering() {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return false;
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return gl instanceof WebGLRenderingContext;
  });
}

async function isUiLayerVisible() {
  return page.evaluate(() => {
    const el = document.getElementById('ui-layer');
    return el && el.style.display !== 'none' && getComputedStyle(el).display !== 'none';
  });
}

async function isMenuLayerVisible() {
  return page.evaluate(() => {
    const el = document.getElementById('menu-layer');
    return el && el.style.display !== 'none' && getComputedStyle(el).display !== 'none';
  });
}

async function clickMenuButton(label) {
  const found = await page.evaluate((text) => {
    const btns = Array.from(document.querySelectorAll('.menu-btn, button'));
    const btn = btns.find((b) => b.textContent.includes(text));
    if (btn) { btn.click(); return true; }
    return false;
  }, label);
  if (!found) {
    const allBtns = await page.$$eval('.menu-btn', (els) => els.map((e) => e.textContent));
    throw new Error(`Menu button "${label}" not found. Available: ${JSON.stringify(allBtns)}`);
  }
  await sleep(600);
}

async function clickBackToMenu() {
  const clicked = await page.evaluate(() => {
    const btn = document.getElementById('back-to-menu');
    if (btn) { btn.click(); return true; }
    return false;
  });
  if (clicked) {
    await sleep(1000);
  } else {
    await page.keyboard.press('Escape');
    await sleep(1000);
  }
}

async function clickPanelCloseButton() {
  const clicked = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const closeBtn = btns.find((b) => /[✕×]|返回/.test((b.textContent || '') + (b.title || '')));
    if (closeBtn) { closeBtn.click(); return true; }
    return false;
  });
  await sleep(clicked ? 600 : 300);
  if (!clicked) {
    await page.keyboard.press('Escape');
    await sleep(400);
  }
}

// ── Test cases ────────────────────────────────────────────────────────────

const results = [];

function record(name, passed, detail = '') {
  results.push({ name, passed, detail });
  const icon = passed ? '✓' : '✗';
  console.log(`  ${icon} ${name}${detail ? ' — ' + detail : ''}`);
}

async function runHomepageTest() {
  console.log('\n▶ Homepage');
  const mark = consoleErrors.length;
  await pageGoto(BASE_URL);
  await waitForMenuReady();

  const canvasOk = await isCanvasPresent();
  const menuOk = await isMenuLayerVisible();
  const uiHidden = !(await isUiLayerVisible());
  const errors = recentErrorsSince(mark);

  record('Canvas present', canvasOk, canvasOk ? '' : 'canvas missing');
  record('Menu layer visible', menuOk, menuOk ? '' : 'menu-layer not visible');
  record('UI layer hidden', uiHidden, uiHidden ? '' : 'ui-layer should be hidden');
  record('No severe errors', !hasSevereErrors(errors), errors.filter((e) => hasSevereErrors([e])).map((e) => e.message).join('; '));
}

async function runGameModeTest(label, modeLabel) {
  console.log(`\n▶ ${label}`);
  const mark = consoleErrors.length;

  try {
    await clickMenuButton(modeLabel);
  } catch (err) {
    record('Menu click', false, err.message);
    return;
  }

  const gameReady = await waitFor(async () => await isUiLayerVisible(), GAME_INIT_TIMEOUT, 300);
  const canvasOk = await isCanvasPresent();
  const glOk = await isCanvasRendering();
  const errorOverlay = await isErrorOverlayVisible();
  const errors = recentErrorsSince(mark);

  record('Game UI visible', gameReady, gameReady ? '' : 'ui-layer not visible after timeout');
  record('Canvas present', canvasOk);
  record('WebGL active', glOk);
  record('No error overlay', !errorOverlay);
  record('No severe errors', !hasSevereErrors(errors), errors.filter((e) => hasSevereErrors([e])).map((e) => e.message).join('; '));

  await clickBackToMenu();
  await waitFor(async () => await isMenuLayerVisible(), 5000, 200);
}

async function runRoomVisibilityTest() {
  console.log('\n▶ Room Visibility');
  const mark = consoleErrors.length;

  // Re-enter Free Play so we have an active Game with a Room
  try {
    await clickMenuButton('单人练习');
  } catch (err) {
    record('Menu click (Free Play)', false, err.message);
    return;
  }

  const gameReady = await waitFor(async () => await isUiLayerVisible(), GAME_INIT_TIMEOUT, 300);
  if (!gameReady) {
    record('Game active for room check', false, 'ui-layer not visible');
    await clickBackToMenu();
    await waitFor(async () => await isMenuLayerVisible(), 5000, 200);
    return;
  }

  await sleep(600);

  const checks = await page.evaluate(() => {
    const menu = window.__menu;
    if (!menu || !menu.game || !menu.game.room) {
      return { ok: false, reason: 'menu.game.room not accessible' };
    }
    const room = menu.game.room;
    const scene = menu.game.scene;
    const camera = menu.game.camera;
    const results = {};

    // 1. Room meshGroup must be in the scene
    results.meshGroupInScene = scene.children.includes(room.meshGroup);

    // 2. Ceiling material must be FrontSide (not DoubleSide)
    const ceilingMat = room._materials.ceiling;
    results.ceilingFrontSide = ceilingMat && ceilingMat.side === 0; // THREE.FrontSide = 0

    // 3. Table light structure group must exist
    results.hasTableLightStructure = !!room._themeGroups.tableLightStructure;

    // 4. Ceiling grid must exist
    results.hasCeilingGrid = !!room._themeGroups.ceilingGrid;

    // 5. Move camera above ceiling → structural elements hidden
    const origY = camera.position.y;
    camera.position.y = 200; // well above ROOM.wallHeight (160)
    room.updateCameraVisibility(camera);
    results.structureHiddenAbove = room._themeGroups.tableLightStructure && !room._themeGroups.tableLightStructure.visible;
    results.gridHiddenAbove = room._themeGroups.ceilingGrid && !room._themeGroups.ceilingGrid.visible;

    // 6. Move camera below ceiling → structural elements visible
    camera.position.y = 120; // below ceiling
    room.updateCameraVisibility(camera);
    results.structureVisibleBelow = room._themeGroups.tableLightStructure && room._themeGroups.tableLightStructure.visible;
    results.gridVisibleBelow = room._themeGroups.ceilingGrid && room._themeGroups.ceilingGrid.visible;

    // Restore camera
    camera.position.y = origY;
    room.updateCameraVisibility(camera);

    // 7. Plaque group must exist (was previously never created)
    results.hasPlaque = !!room._themeGroups.plaque;

    // 8. Lounge and rug must be real decorative groups, so the visual
    // settings toggle can hide them instead of leaving stray furniture.
    results.hasLoungeGroup = !!room._themeGroups.lounge && room._themeGroups.lounge.children.length > 0;
    results.hasRugGroup = !!room._themeGroups.rug && room._themeGroups.rug.children.length > 0;

    const getDecorOff = (key) => key === 'decorativePropsEnabled' ? false : undefined;
    room.applyVisualSettings({ get: getDecorOff });
    results.decorativeGroupsHidden = !room._themeGroups.lounge.visible && !room._themeGroups.rug.visible;

    const getDecorOn = (key) => key === 'decorativePropsEnabled' ? true : undefined;
    room.applyVisualSettings({ get: getDecorOn });
    results.decorativeGroupsVisible = room._themeGroups.lounge.visible && room._themeGroups.rug.visible;

    return { ok: true, results };
  });

  if (!checks.ok) {
    record('Room introspection', false, checks.reason);
  } else {
    const r = checks.results;
    record('Room meshGroup in scene', r.meshGroupInScene);
    record('Ceiling FrontSide (not DoubleSide)', r.ceilingFrontSide);
    record('Table light structure group exists', r.hasTableLightStructure);
    record('Ceiling grid group exists', r.hasCeilingGrid);
    record('Structure hidden when camera above', r.structureHiddenAbove);
    record('Grid hidden when camera above', r.gridHiddenAbove);
    record('Structure visible when camera below', r.structureVisibleBelow);
    record('Grid visible when camera below', r.gridVisibleBelow);
    record('Plaque group created', r.hasPlaque);
    record('Lounge decorative group created', r.hasLoungeGroup);
    record('Rug decorative group created', r.hasRugGroup);
    record('Decorative groups hide with setting', r.decorativeGroupsHidden);
    record('Decorative groups restore with setting', r.decorativeGroupsVisible);
  }

  const errors = recentErrorsSince(mark);
  record('No severe errors', !hasSevereErrors(errors), errors.filter((e) => hasSevereErrors([e])).map((e) => e.message).join('; '));

  await clickBackToMenu();
  await waitFor(async () => await isMenuLayerVisible(), 5000, 200);
}

async function runTrainerTest() {
  console.log('\n▶ Trainer');
  const mark = consoleErrors.length;

  try {
    await clickMenuButton('击球训练');
  } catch (err) {
    record('Menu click', false, err.message);
    return;
  }

  await sleep(800);
  const listVisible = await page.evaluate(() => {
    const panels = Array.from(document.body.children).filter((el) =>
      getComputedStyle(el).display === 'flex' && el.textContent.includes('击球训练')
    );
    return panels.length > 0;
  });
  record('Trainer list visible', listVisible);

  // Check overall progress bar
  const progressBar = await page.evaluate(() => {
    const panel = document.getElementById('trainer-panel');
    if (!panel) return false;
    return panel.textContent.includes('总进度');
  });
  record('Trainer progress bar visible', progressBar);

  // Check that drill cards show category info
  const cardsHaveInfo = await page.evaluate(() => {
    const panel = document.getElementById('trainer-panel');
    if (!panel) return false;
    const text = panel.textContent;
    return text.includes('建议') && text.includes('基础技巧');
  });
  record('Trainer cards have power hints', cardsHaveInfo);

  const cardClicked = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('#trainer-panel div[style*="cursor: pointer"]'));
    if (cards.length > 0) { cards[0].click(); return true; }
    return false;
  });
  if (cardClicked) {
    await sleep(600);
    const gameReady = await waitFor(async () => {
      const ui = await isUiLayerVisible();
      const backBtn = await page.evaluate(() => !!document.getElementById('back-to-menu'));
      return ui && backBtn;
    }, GAME_INIT_TIMEOUT + 8000, 400);
    const errors = recentErrorsSince(mark);
    record('Drill game UI visible', gameReady);

    // Check trainer HUD elements
    const hudVisible = await waitFor(async () => {
      return page.evaluate(() => {
        const ui = document.getElementById('ui-layer');
        if (!ui) return false;
        const text = ui.textContent;
        return text.includes('🎯') && text.includes('建议力度');
      });
    }, 6000, 300);
    record('Trainer HUD visible', hudVisible);

    record('No severe errors', !hasSevereErrors(errors), errors.filter((e) => hasSevereErrors([e])).map((e) => e.message).join('; '));
    await clickBackToMenu();
  } else {
    record('First drill card click', false, 'no cards rendered');
    await clickPanelCloseButton();
  }

  await waitFor(async () => await isMenuLayerVisible(), 5000, 200);
}

async function runChallengeTest() {
  console.log('\n▶ Challenge');
  const mark = consoleErrors.length;

  try {
    await clickMenuButton('挑战模式');
  } catch (err) {
    record('Menu click', false, err.message);
    return;
  }

  await sleep(800);
  const listVisible = await page.evaluate(() => {
    const panels = Array.from(document.body.children).filter((el) =>
      getComputedStyle(el).display === 'flex' && el.textContent.includes('挑战模式')
    );
    return panels.length > 0;
  });
  record('Challenge list visible', listVisible);

  // Check new UI elements
  const progressVisible = await page.evaluate(() => {
    const panel = document.getElementById('challenge-panel');
    return panel ? panel.textContent.includes('/') && panel.textContent.includes('%') : false;
  });
  record('Challenge progress bar visible', progressVisible);

  const filtersVisible = await page.evaluate(() => {
    const row = document.getElementById('challenge-filters');
    return row && row.querySelectorAll('button').length >= 3;
  });
  record('Challenge filter tabs visible', filtersVisible);

  const bannersVisible = await page.evaluate(() => {
    const banners = document.getElementById('challenge-banners');
    return banners && banners.children.length > 0;
  });
  record('Challenge banners visible', bannersVisible);

  const cardClicked = await page.evaluate(() => {
    const grid = document.getElementById('challenge-grid');
    if (!grid) return false;
    const cards = Array.from(grid.querySelectorAll('div[style*="cursor: pointer"]'));
    if (cards.length > 0) { cards[0].click(); return true; }
    return false;
  });
  if (cardClicked) {
    await sleep(600);
    const gameReady = await waitFor(async () => {
      const ui = await isUiLayerVisible();
      const backBtn = await page.evaluate(() => !!document.getElementById('back-to-menu'));
      return ui && backBtn;
    }, GAME_INIT_TIMEOUT + 8000, 400);
    const errors = recentErrorsSince(mark);
    record('Challenge game UI visible', gameReady);
    record('No severe errors', !hasSevereErrors(errors), errors.filter((e) => hasSevereErrors([e])).map((e) => e.message).join('; '));
    await clickBackToMenu();
  } else {
    record('First challenge card click', false, 'no clickable card');
    await clickPanelCloseButton();
  }

  await waitFor(async () => await isMenuLayerVisible(), 5000, 200);
}
async function runLanRoomTest() {
  console.log('\n▶ LAN Room');
  const mark = consoleErrors.length;

  try {
    await clickMenuButton('局域网联机');
  } catch (err) {
    record('Menu click', false, err.message);
    return;
  }

  await sleep(800);
  const panelVisible = await page.evaluate(() => {
    const el = document.getElementById('lan-room-panel');
    return el && getComputedStyle(el).display !== 'none';
  });
  const errors = recentErrorsSince(mark);

  record('LAN panel visible', panelVisible);
  record('No severe errors', !hasSevereErrors(errors), errors.filter((e) => hasSevereErrors([e])).map((e) => e.message).join('; '));

  await clickPanelCloseButton();
  await waitFor(async () => await isMenuLayerVisible(), 5000, 200);
}

async function runSettingsTest() {
  console.log('\n▶ Settings');
  const mark = consoleErrors.length;

  try {
    await clickMenuButton('设置');
  } catch (err) {
    record('Menu click', false, err.message);
    return;
  }

  await sleep(800);
  const panelVisible = await page.evaluate(() => {
    const el = document.getElementById('settings-screen');
    return el && getComputedStyle(el).display !== 'none';
  });
  const errors = recentErrorsSince(mark);

  record('Settings panel visible', panelVisible);
  record('No severe errors', !hasSevereErrors(errors), errors.filter((e) => hasSevereErrors([e])).map((e) => e.message).join('; '));

  await clickPanelCloseButton();
  await waitFor(async () => await isMenuLayerVisible(), 5000, 200);
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('🎱 3D Billiards Smoke Test');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  console.log('\n▶ Starting Vite dev server...');
  await startDevServer();
  console.log('  ✓ Server ready');

  console.log('\n▶ Launching Puppeteer...');
  browser = await puppeteer.launch({
    headless: false,
    args: [
      '--headless=old',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-gl=swiftshader',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--disable-gpu-sandbox',
    ],
  });
  page = await browser.newPage();
  page.setDefaultTimeout(NAV_TIMEOUT);
  await captureConsole();
  await page.evaluateOnNewDocument(WEBGL_MOCK_CODE);
  console.log('  ✓ Browser ready');

  await runHomepageTest();
  await runGameModeTest('Free Play', '单人练习');
  await runRoomVisibilityTest();
  await runGameModeTest('Local 2P', '本地双人对战');
  await runGameModeTest('vs AI', '对战 AI');
  await runGameModeTest('9-Ball', '9 球模式');
  await runTrainerTest();
  await runChallengeTest();
  await runLanRoomTest();
  await runSettingsTest();

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Results: ${passed} passed, ${failed} failed / ${results.length} total`);

  if (consoleWarnings.length > 0) {
    console.log(`\n⚠ ${consoleWarnings.length} console warning(s) captured (non-fatal)`);
  }

  if (consoleErrors.length > 0) {
    console.log('\n📋 All console errors:');
    consoleErrors.forEach((e, i) => console.log(`  ${i + 1}. [${e.type}] ${e.message}`));
  }

  await browser.close();
  await stopDevServer();

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error('Smoke test runner crashed:', err);
  if (browser) await browser.close();
  await stopDevServer();
  process.exit(1);
});
