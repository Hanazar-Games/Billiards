import { MenuSystem } from './menu/MenuSystem.js';
import { autoSyncAnimSpeed, animMs } from './core/AnimSpeed.js';
import { VERSION_TAG } from './core/Version.js';

/* ── Loading Screen Progress ── */
const introScreen = document.getElementById('intro-screen');
const introFill = document.getElementById('intro-progress-fill');
const introPercent = document.getElementById('intro-percent');
const introText = document.getElementById('intro-loading-text');

window.updateLoadingProgress = (percent, text) => {
  if (introFill) introFill.style.width = percent + '%';
  if (introPercent) introPercent.textContent = Math.round(percent) + '%';
  if (introText && text) introText.textContent = text;
};

function hideIntroScreen(delay = 600) {
  if (!introScreen) return;
  setTimeout(() => {
    introScreen.classList.add('hidden');
    setTimeout(() => introScreen?.remove(), 1400);
  }, delay);
}

let __initPhase = 'boot';
function setInitPhase(phase) { __initPhase = phase; }

function showError(msg) {
  const overlay = document.getElementById('js-error-overlay');
  const content = document.getElementById('js-error-content');
  const phaseEl = document.getElementById('js-error-phase');
  if (overlay && content) {
    const time = new Date().toLocaleTimeString();
    const block = document.createElement('div');
    block.className = 'err-block';
    const timeDiv = document.createElement('div');
    timeDiv.className = 'err-time';
    timeDiv.textContent = time + ' — 阶段：' + __initPhase;
    block.appendChild(timeDiv);
    msg.split('\n').forEach((line, i) => {
      if (i > 0) block.appendChild(document.createElement('br'));
      block.appendChild(document.createTextNode(line));
    });
    content.appendChild(block);
    if (phaseEl) {
      phaseEl.style.display = 'block';
      phaseEl.textContent = '出错阶段：' + __initPhase;
    }
    overlay.classList.add('visible');
  } else {
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#000;color:#f00;padding:40px;font-family:monospace;white-space:pre-wrap;overflow:auto;';
    div.textContent = msg;
    document.body.appendChild(div);
  }
}

const initStart = performance.now();

try {
  const container = document.getElementById('app');
  if (!container) {
    throw new Error('#app element not found in DOM');
  }

  // Phase 1 — DOM & core modules loaded (we're already here)
  setInitPhase('core-modules');
  updateLoadingProgress(15, '加载核心模块...');

  // Phase 2 — MenuSystem initializes Renderer + Physics + Audio
  setInitPhase('engine-init');
  updateLoadingProgress(35, '初始化引擎...');
  let menu;
  try {
    menu = new MenuSystem(container);
  } catch (err) {
    showError('ENGINE INIT ERROR: ' + err.message + '\n' + (err.stack || ''));
    throw err;
  }
  // Expose for browser-level integration tests (smoke tests, e2e)
  if (typeof window !== 'undefined') window.__menu = menu;

  // Phase 3 — Menu UI built
  setInitPhase('menu-build');
  updateLoadingProgress(75, '构建菜单...');

  // Remove legacy boot message
  document.getElementById('boot-message')?.remove();

  // Phase 4 — Finalize
  setInitPhase('finalize');
  updateLoadingProgress(100, '准备就绪！');
  const elapsed = performance.now() - initStart;
  const minDelay = Math.max(0, 2000 - elapsed);
  hideIntroScreen(minDelay);

  // Sync version display from single source of truth
  document.title = '3D Billiards ' + VERSION_TAG;
  const verTag = document.getElementById('version-tag');
  if (verTag) verTag.textContent = VERSION_TAG;

  // Sync CSS animation speed variable with settings
  autoSyncAnimSpeed();

  // Success indicator — remove after 3s (z-index below error overlay)
  const ok = document.createElement('div');
  ok.textContent = '✓ 初始化完成';
  ok.style.cssText = `position:fixed;top:4px;left:4px;z-index:99998;background:rgba(0,0,0,0.7);color:#0f0;padding:4px 8px;font-size:11px;font-family:monospace;border-radius:4px;transition:opacity calc(0.5s / var(--ui-anim-speed));`;
  document.body.appendChild(ok);
  setTimeout(() => { ok.style.opacity = '0'; setTimeout(() => ok.remove(), animMs(500)); }, animMs(3000));

} catch (err) {
  showError('INIT ERROR: ' + err.message + '\n' + (err.stack || ''));
}
