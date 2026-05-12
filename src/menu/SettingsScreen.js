/**
 * SettingsScreen — Minimal settings overlay.
 *
 * Currently only supports sound toggle.
 * Can be extended with more options (graphics quality, trail toggle default, etc.)
 */
export class SettingsScreen {
  constructor(onBack) {
    this.onBack = onBack;
    this.audio = null;
    this.container = null;
    this._soundListener = null;
    this._buildUI();
  }

  setAudioManager(audioManager) {
    this.audio = audioManager;
    if (this.soundToggle && this.audio) {
      this.soundToggle.checked = this.audio.soundEnabled;
    }
  }

  _buildUI() {
    const layer = document.getElementById('menu-layer');
    if (!layer) return;

    this.container = document.createElement('div');
    this.container.id = 'settings-screen';
    this.container.style.cssText = `
      display: none; flex-direction: column;
      align-items: center; justify-content: center;
      width: 100%; height: 100%;
      transition: opacity 0.28s ease, transform 0.28s cubic-bezier(0.2,0.8,0.2,1);
      position: relative;
      z-index: 1;
    `;

    // Title
    const title = document.createElement('div');
    title.style.cssText = `
      font-size: 34px; font-weight: 850; color: #f4f7f4;
      margin-bottom: 28px; letter-spacing: 1px;
      text-shadow: 0 12px 34px rgba(0,0,0,0.42);
    `;
    title.textContent = '设置';
    this.container.appendChild(title);

    // Settings panel
    const panel = document.createElement('div');
    panel.className = 'panel-surface';
    panel.style.cssText = `
      width: min(380px, calc(100vw - 48px)); padding: 24px;
      display: flex; flex-direction: column; gap: 20px;
      animation: panelIn 260ms cubic-bezier(0.2,0.8,0.2,1) both;
    `;

    // Sound toggle row
    const soundRow = document.createElement('div');
    soundRow.style.cssText = `
      display: flex; justify-content: space-between;
      align-items: center;
    `;

    const soundLabel = document.createElement('span');
    soundLabel.style.cssText = 'font-size: 15px; color: #f4f7f4; font-weight: 700;';
    soundLabel.textContent = '游戏音效';
    soundRow.appendChild(soundLabel);

    this.soundToggle = document.createElement('input');
    this.soundToggle.type = 'checkbox';
    this.soundToggle.checked = false;
    this.soundToggle.style.cssText = `
      width: 44px; height: 24px; cursor: pointer;
      accent-color: #18a46a;
    `;
    this._soundListener = (e) => {
      if (this.audio) {
        this.audio.toggleSound(e.target.checked);
      }
    };
    this.soundToggle.addEventListener('change', this._soundListener);
    soundRow.appendChild(this.soundToggle);
    panel.appendChild(soundRow);

    // Divider
    const divider = document.createElement('div');
    divider.style.cssText = 'height: 1px; background: rgba(255,255,255,0.12);';
    panel.appendChild(divider);

    // Back button
    const backBtn = document.createElement('button');
    backBtn.textContent = '返回';
    backBtn.className = 'ui-action';
    backBtn.style.cssText = `
      width: 100%; padding: 14px 0;
      font-size: 15px; font-weight: 750;
      pointer-events: auto;
    `;
    backBtn.onclick = () => {
      this.hide();
      if (this.onBack) this.onBack();
    };
    panel.appendChild(backBtn);

    this.container.appendChild(panel);
    layer.appendChild(this.container);
  }

  show() {
    if (!this.container) return;
    // Sync toggle with actual audio state
    if (this.soundToggle && this.audio) {
      this.soundToggle.checked = this.audio.soundEnabled;
    }
    this.container.style.display = 'flex';
    this.container.style.opacity = '0';
    this.container.style.transform = 'translateY(8px)';
    requestAnimationFrame(() => {
      this.container.style.opacity = '1';
      this.container.style.transform = 'translateY(0)';
    });
  }

  hide() {
    if (!this.container) return;
    this.container.style.opacity = '0';
    setTimeout(() => {
      if (this.container) this.container.style.display = 'none';
    }, 300);
  }

  destroy() {
    if (this.soundToggle && this._soundListener) {
      this.soundToggle.removeEventListener('change', this._soundListener);
      this._soundListener = null;
    }
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.audio = null;
  }
}
