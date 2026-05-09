/**
 * MainMenuScreen — The primary entry screen with mode selection.
 *
 * Features:
 *  - Animated title with glow effect
 *  - 4 mode buttons: Free Play, Local 2P, vs AI, Settings
 *  - Glassmorphism button style with hover effects
 *  - Smooth fade transitions
 *  - Back button when returning from settings
 */
export class MainMenuScreen {
  constructor(onSelectMode, onSettings, onQuit) {
    this.onSelectMode = onSelectMode;
    this.onSettings = onSettings;
    this.onQuit = onQuit;
    this.container = null;
    this._buildUI();
  }

  _buildUI() {
    const layer = document.getElementById('menu-layer');
    if (!layer) return;

    this.container = document.createElement('div');
    this.container.id = 'main-menu';
    this.container.style.cssText = `
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      width: 100%; height: 100%;
      transition: opacity 0.4s ease, transform 0.4s ease;
    `;

    // Title
    const title = document.createElement('div');
    title.className = 'menu-title';
    title.innerHTML = '🎱&nbsp;3D&nbsp;BILLIARDS';
    this.container.appendChild(title);

    // Subtitle
    const subtitle = document.createElement('div');
    subtitle.style.cssText = `
      font-size: 14px; color: rgba(255,255,255,0.5);
      margin-bottom: 48px; letter-spacing: 3px;
      text-transform: uppercase;
    `;
    subtitle.textContent = 'Hanazar Games';
    this.container.appendChild(subtitle);

    // Buttons container
    const btnGroup = document.createElement('div');
    btnGroup.style.cssText = `
      display: flex; flex-direction: column;
      align-items: center; gap: 14px;
    `;

    // Free Play
    this._addButton(btnGroup, '单人练习', '无限击球 · 无规则限制 · 练习瞄准', () => {
      this._fadeOut(() => this.onSelectMode('freeplay'));
    });

    // Local 2P
    this._addButton(btnGroup, '本地双人对战', '标准 8 球规则 · 轮流击球', () => {
      this._fadeOut(() => this.onSelectMode('local2p'));
    });

    // vs AI
    this._addButton(btnGroup, '对战 AI', '标准 8 球规则 · 挑战电脑', () => {
      this._fadeOut(() => this.onSelectMode('vsai'));
    });

    // 9-ball
    this._addButton(btnGroup, '9 球模式', '按顺序击球 · 9号球进袋即胜', () => {
      this._fadeOut(() => this.onSelectMode('nineball'));
    });

    // Settings
    this._addButton(btnGroup, '设置', '音效与画面选项', () => {
      if (this.onSettings) this.onSettings();
    });

    this.container.appendChild(btnGroup);

    // Quit button (bottom-right)
    const quitBtn = document.createElement('button');
    quitBtn.textContent = '退出游戏';
    quitBtn.style.cssText = `
      position: absolute; bottom: 40px; right: 40px;
      padding: 10px 24px; font-size: 14px; color: rgba(255,255,255,0.5);
      background: transparent; border: 1px solid rgba(255,255,255,0.15);
      border-radius: 8px; cursor: pointer; transition: all 0.2s;
      pointer-events: auto;
    `;
    quitBtn.onmouseenter = () => {
      quitBtn.style.color = '#fff';
      quitBtn.style.borderColor = 'rgba(255,255,255,0.4)';
    };
    quitBtn.onmouseleave = () => {
      quitBtn.style.color = 'rgba(255,255,255,0.5)';
      quitBtn.style.borderColor = 'rgba(255,255,255,0.15)';
    };
    quitBtn.onclick = () => {
      if (this.onQuit) this.onQuit();
    };
    this.container.appendChild(quitBtn);

    // Version
    const version = document.createElement('div');
    version.textContent = 'v0.8.0';
    version.style.cssText = `
      position: absolute; bottom: 44px; left: 40px;
      font-size: 12px; color: rgba(255,255,255,0.25);
    `;
    this.container.appendChild(version);

    layer.appendChild(this.container);
  }

  _addButton(parent, label, desc, onClick) {
    const btn = document.createElement('button');
    btn.className = 'menu-btn';
    btn.style.cssText = `
      width: 340px; padding: 18px 24px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 14px;
      backdrop-filter: blur(12px);
      cursor: pointer; transition: all 0.25s ease;
      text-align: left; pointer-events: auto;
      display: flex; flex-direction: column; gap: 4px;
    `;

    const titleRow = document.createElement('div');
    titleRow.style.cssText = `
      font-size: 18px; font-weight: 700; color: #fff;
      letter-spacing: 1px;
    `;
    titleRow.textContent = label;
    btn.appendChild(titleRow);

    if (desc) {
      const descRow = document.createElement('div');
      descRow.style.cssText = `
        font-size: 12px; color: rgba(255,255,255,0.45);
        letter-spacing: 0.5px;
      `;
      descRow.textContent = desc;
      btn.appendChild(descRow);
    }

    btn.onmouseenter = () => {
      btn.style.background = 'rgba(255,255,255,0.14)';
      btn.style.borderColor = 'rgba(255,255,255,0.4)';
      btn.style.transform = 'scale(1.03)';
      btn.style.boxShadow = '0 8px 32px rgba(0,0,0,0.3)';
    };
    btn.onmouseleave = () => {
      btn.style.background = 'rgba(255,255,255,0.06)';
      btn.style.borderColor = 'rgba(255,255,255,0.15)';
      btn.style.transform = 'scale(1)';
      btn.style.boxShadow = 'none';
    };
    btn.onclick = onClick;

    parent.appendChild(btn);
  }

  _fadeOut(callback) {
    if (!this.container) return;
    this.container.style.opacity = '0';
    this.container.style.transform = 'scale(0.96)';
    setTimeout(callback, 400);
  }

  show() {
    if (!this.container) return;
    this.container.style.display = 'flex';
    requestAnimationFrame(() => {
      this.container.style.opacity = '1';
      this.container.style.transform = 'scale(1)';
    });
  }

  hide() {
    if (!this.container) return;
    this.container.style.opacity = '0';
    this.container.style.transform = 'scale(0.96)';
    setTimeout(() => {
      this.container.style.display = 'none';
    }, 400);
  }

  destroy() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
  }
}
