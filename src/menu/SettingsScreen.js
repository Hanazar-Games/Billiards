/**
 * SettingsScreen — Minimal settings overlay.
 *
 * Currently only supports sound toggle.
 * Can be extended with more options (graphics quality, trail toggle default, etc.)
 */
export class SettingsScreen {
  constructor(onBack, audioManager) {
    this.onBack = onBack;
    this.audio = audioManager;
    this.container = null;
    this._buildUI();
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
      transition: opacity 0.3s ease;
    `;

    // Title
    const title = document.createElement('div');
    title.style.cssText = `
      font-size: 36px; font-weight: 700; color: #fff;
      margin-bottom: 48px; letter-spacing: 2px;
    `;
    title.textContent = '设置';
    this.container.appendChild(title);

    // Settings panel
    const panel = document.createElement('div');
    panel.style.cssText = `
      width: 360px; padding: 28px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 16px;
      backdrop-filter: blur(12px);
      display: flex; flex-direction: column; gap: 20px;
    `;

    // Sound toggle row
    const soundRow = document.createElement('div');
    soundRow.style.cssText = `
      display: flex; justify-content: space-between;
      align-items: center;
    `;

    const soundLabel = document.createElement('span');
    soundLabel.style.cssText = 'font-size: 16px; color: #fff;';
    soundLabel.textContent = '游戏音效';
    soundRow.appendChild(soundLabel);

    this.soundToggle = document.createElement('input');
    this.soundToggle.type = 'checkbox';
    this.soundToggle.checked = false;
    this.soundToggle.style.cssText = `
      width: 44px; height: 24px; cursor: pointer;
      accent-color: #00e676;
    `;
    this.soundToggle.addEventListener('change', (e) => {
      if (this.audio) {
        this.audio.toggleSound(e.target.checked);
      }
    });
    soundRow.appendChild(this.soundToggle);
    panel.appendChild(soundRow);

    // Divider
    const divider = document.createElement('div');
    divider.style.cssText = 'height: 1px; background: rgba(255,255,255,0.1);';
    panel.appendChild(divider);

    // Back button
    const backBtn = document.createElement('button');
    backBtn.textContent = '返回';
    backBtn.style.cssText = `
      width: 100%; padding: 14px 0;
      font-size: 16px; font-weight: 600; color: #fff;
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 10px;
      cursor: pointer; transition: all 0.2s;
      pointer-events: auto;
    `;
    backBtn.onmouseenter = () => {
      backBtn.style.background = 'rgba(255,255,255,0.2)';
    };
    backBtn.onmouseleave = () => {
      backBtn.style.background = 'rgba(255,255,255,0.1)';
    };
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
    this.container.style.display = 'flex';
    this.container.style.opacity = '0';
    requestAnimationFrame(() => {
      this.container.style.opacity = '1';
    });
  }

  hide() {
    if (!this.container) return;
    this.container.style.opacity = '0';
    setTimeout(() => {
      this.container.style.display = 'none';
    }, 300);
  }

  destroy() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
  }
}
