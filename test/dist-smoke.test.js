/**
 * Dist Smoke Test — Verify the production build loads correctly.
 *
 * Prerequisites: npm run build (dist/ must exist with current assets)
 *
 * Verifies:
 *   - dist/index.html references valid asset files (no 404s)
 *   - Menu layer visible, UI layer hidden on load
 *   - Can enter Free Play without severe console errors
 *   - No JS error overlay visible
 */

import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import net from 'net';
import { setTimeout as sleep } from 'timers/promises';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEBGL_MOCK_CODE = readFileSync(join(__dirname, 'webgl-mock.js'), 'utf-8');

const PREVIEW_PORT = 14173;
const BASE_URL = `http://127.0.0.1:${PREVIEW_PORT}`;
const NAV_TIMEOUT = 30000;

let previewProcess = null;
let browser = null;
let page = null;
const consoleErrors = [];
const results = [];

function record(label, passed, detail = '') {
  results.push({ label, passed, detail });
  const icon = passed ? '✓' : '✗';
  const extra = detail ? ` — ${detail}` : '';
  console.log(`  ${icon} ${label}${extra}`);
}

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

function startPreviewServer() {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['vite', 'preview', '--port', String(PREVIEW_PORT), '--strictPort', '--host', '127.0.0.1'], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });
    previewProcess = proc;

    let resolved = false;
    const onReady = (data) => {
      const text = data.toString();
      if (!resolved && (text.includes('Local:') || text.includes('http://'))) {
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
        reject(new Error(`Preview server exited before ready (code=${code}, signal=${signal})`));
      }
    });

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(proc);
      }
    }, 5000);
  });
}

async function stopPreviewServer() {
  if (!previewProcess) return;
  previewProcess.kill('SIGTERM');
  await sleep(1000);
  if (!previewProcess.killed) {
    previewProcess.kill('SIGKILL');
  }
}

function hasSevereErrors(errors) {
  return errors.some((e) => {
    const m = e.message || '';
    if (/Failed to load resource|the server responded|favicon/i.test(m)) return false;
    return /Game init failed|TypeError|ReferenceError|ENGINE INIT ERROR|MENU SETUP ERROR|Cannot read propert|Cannot set propert|is not a function/i.test(m);
  });
}

async function main() {
  console.log('📦 3D Billiards Dist Smoke Test');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Verify dist exists
  if (!existsSync(join(process.cwd(), 'dist', 'index.html'))) {
    console.error('  ✗ dist/index.html not found. Run npm run build first.');
    process.exit(1);
  }

  const portFree = await isPortAvailable(PREVIEW_PORT);
  if (!portFree) {
    console.error(`  ✗ Port ${PREVIEW_PORT} is already in use.`);
    process.exit(1);
  }

  console.log('\n▶ Starting Vite preview server...');
  try {
    await startPreviewServer();
    console.log('  ✓ Preview server ready');
  } catch (err) {
    console.error('  ✗ Preview server failed:', err.message);
    process.exit(1);
  }

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

  page.on('pageerror', (err) => {
    consoleErrors.push({ type: 'pageerror', message: err.message });
  });
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error') {
      consoleErrors.push({ type: 'console.error', message: text });
    }
  });
  page.on('response', (response) => {
    const status = response.status();
    if (status >= 400) {
      consoleErrors.push({ type: 'network', message: `HTTP ${status}: ${response.url()}` });
    }
  });

  await page.evaluateOnNewDocument(WEBGL_MOCK_CODE);
  console.log('  ✓ Browser ready');

  // ── Homepage ──
  console.log('\n▶ Homepage (dist)');
  const mark = consoleErrors.length;
  await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
  await sleep(800);

  const canvasPresent = await page.evaluate(() => !!document.querySelector('canvas'));
  record('Canvas present', canvasPresent);

  const menuVisible = await page.evaluate(() => {
    const el = document.getElementById('menu-layer');
    return el && getComputedStyle(el).display !== 'none';
  });
  record('Menu layer visible', menuVisible);

  const uiHidden = await page.evaluate(() => {
    const el = document.getElementById('ui-layer');
    return el && getComputedStyle(el).display === 'none';
  });
  record('UI layer hidden', uiHidden);

  const versionCorrect = await page.evaluate(() => {
    const el = document.getElementById('version-tag');
    return el && el.textContent.includes('1.7.30');
  });
  record('Version tag matches 1.7.30', versionCorrect);

  const no404s = !consoleErrors.slice(mark).some((e) => /404|Not Found|Cannot find module|Failed to load/.test(e.message));
  record('No asset 404 errors', no404s, no404s ? '' : consoleErrors.slice(mark).map((e) => e.message).join('; '));

  const errors = consoleErrors.slice(mark);
  record('No severe errors', !hasSevereErrors(errors), errors.filter((e) => hasSevereErrors([e])).map((e) => e.message).join('; '));

  // ── Free Play ──
  console.log('\n▶ Free Play (dist)');
  const mark2 = consoleErrors.length;

  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button.menu-btn'));
    const btn = btns.find((b) => b.textContent.includes('单人练习'));
    if (btn) btn.click();
  });
  await sleep(3500);

  const gameUiVisible = await page.evaluate(() => {
    const el = document.getElementById('ui-layer');
    return el && getComputedStyle(el).display !== 'none';
  });
  record('Game UI visible', gameUiVisible);

  const noErrorOverlay = await page.evaluate(() => {
    const el = document.getElementById('js-error-overlay');
    return !el || !el.classList.contains('visible');
  });
  record('No JS error overlay', noErrorOverlay);

  const errors2 = consoleErrors.slice(mark2);
  record('No severe errors', !hasSevereErrors(errors2), errors2.filter((e) => hasSevereErrors([e])).map((e) => e.message).join('; '));

  // Back to menu
  await page.evaluate(() => {
    const btn = document.getElementById('back-to-menu');
    if (btn) btn.click();
  });
  await sleep(800);

  // ── Summary ──
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Results: ${passed} passed, ${failed} failed / ${results.length} total`);

  if (consoleErrors.length > 0) {
    console.log('\n📋 All console errors:');
    consoleErrors.forEach((e, i) => console.log(`  ${i + 1}. [${e.type}] ${e.message}`));
  }

  await browser.close();
  await stopPreviewServer();

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error('Dist smoke test crashed:', err);
  if (browser) await browser.close();
  await stopPreviewServer();
  process.exit(1);
});
