import { MenuSystem } from './menu/MenuSystem.js';

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

function showError(msg) {
  const overlay = document.getElementById('js-error-overlay');
  const content = document.getElementById('js-error-content');
  if (overlay && content) {
    content.textContent = (content.textContent ? content.textContent + '\n---\n' : '') + msg;
    overlay.classList.add('visible');
  } else {
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#000;color:#f00;padding:40px;font-family:monospace;white-space:pre-wrap;overflow:auto;';
    div.textContent = msg;
    document.body.appendChild(div);
  }
}

try {
  const container = document.getElementById('app');
  if (!container) {
    throw new Error('#app element not found in DOM');
  }

  // Phase 1 — DOM & core modules loaded (we're already here)
  updateLoadingProgress(15, 'Loading core modules... 加载核心模块...');

  // Phase 2 — MenuSystem initializes Renderer + Physics + Audio
  updateLoadingProgress(35, 'Initializing engine... 初始化引擎...');
  const menu = new MenuSystem(container);

  // Phase 3 — Menu UI built
  updateLoadingProgress(75, 'Building menu... 构建菜单...');

  // Remove legacy boot message
  document.getElementById('boot-message')?.remove();

  // Phase 4 — Finalize
  updateLoadingProgress(100, 'Ready! 准备就绪!');
  hideIntroScreen(400);

  // Success indicator — remove after 3s
  const ok = document.createElement('div');
  ok.textContent = '✓ init OK';
  ok.style.cssText = 'position:fixed;top:4px;left:4px;z-index:99999;background:rgba(0,0,0,0.7);color:#0f0;padding:4px 8px;font-size:11px;font-family:monospace;border-radius:4px;transition:opacity 0.5s;';
  document.body.appendChild(ok);
  setTimeout(() => { ok.style.opacity = '0'; setTimeout(() => ok.remove(), 500); }, 3000);

} catch (err) {
  showError('INIT ERROR: ' + err.message + '\n' + (err.stack || ''));
}
