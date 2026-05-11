import { MenuSystem } from './menu/MenuSystem.js';

function showError(msg) {
  const overlay = document.getElementById('js-error-overlay');
  const content = document.getElementById('js-error-content');
  if (overlay && content) {
    content.textContent = (content.textContent ? content.textContent + '\n---\n' : '') + msg;
    overlay.classList.add('visible');
  } else {
    // Fallback if overlay elements don't exist
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

  // MenuSystem owns Renderer, Physics, Game lifecycle
  const menu = new MenuSystem(container);
  document.getElementById('boot-message')?.remove();

  // Success indicator — remove after 3s
  const ok = document.createElement('div');
  ok.textContent = '✓ init OK';
  ok.style.cssText = 'position:fixed;top:4px;left:4px;z-index:99999;background:rgba(0,0,0,0.7);color:#0f0;padding:4px 8px;font-size:11px;font-family:monospace;border-radius:4px;transition:opacity 0.5s;';
  document.body.appendChild(ok);
  setTimeout(() => { ok.style.opacity = '0'; setTimeout(() => ok.remove(), 500); }, 3000);

} catch (err) {
  showError('INIT ERROR: ' + err.message + '\n' + (err.stack || ''));
}
