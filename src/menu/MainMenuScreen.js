import { animMs } from '../core/AnimSpeed.js';

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
  constructor(onSelectMode, onSettings, onAchievements, onShowReplays, onShowChallenges, onQuit) {
    this.onSelectMode = onSelectMode;
    this.onSettings = onSettings;
    this.onAchievements = onAchievements;
    this.onShowReplays = onShowReplays;
    this.onShowChallenges = onShowChallenges;
    this.onQuit = onQuit;
    this.container = null;
    this._fadeTimer = null;
    this._hideTimer = null;
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
      transition: opacity calc(0.35s / var(--ui-anim-speed)) cubic-bezier(0.2,0.8,0.2,1), transform calc(0.35s / var(--ui-anim-speed)) cubic-bezier(0.2,0.8,0.2,1);
      position: relative;
      z-index: 1;
    `;

    // Title
    const title = document.createElement('div');
    title.className = 'menu-title';
    title.innerHTML = '🎱&nbsp;3D&nbsp;BILLIARDS';
    this.container.appendChild(title);

    // Subtitle
    const subtitle = document.createElement('div');
    subtitle.style.cssText = `
      font-size: 13px; color: rgba(244,247,244,0.58);
      margin-bottom: 34px; letter-spacing: 3px;
      text-transform: uppercase;
    `;
    subtitle.textContent = 'Hanazar Games';
    this.container.appendChild(subtitle);

    // Buttons container
    const btnGroup = document.createElement('div');
    btnGroup.style.cssText = `
      display: flex; flex-direction: column;
      align-items: center; gap: 10px;
    `;

    // Free Play
    this._addButton(btnGroup, '单人练习', '无胜负规则 · 白球自动复位 · 练习瞄准与力度', () => {
      this._fadeOut(() => this.onSelectMode('freeplay'));
    });

    // Local 2P
    this._addButton(btnGroup, '本地双人对战', '标准 8 球 · 分组清台 · 同屏轮流击球', () => {
      this._fadeOut(() => this.onSelectMode('local2p'));
    });

    // vs AI
    this._addButton(btnGroup, '对战 AI', '标准 8 球 · 内置电脑对手 · 难度可调', () => {
      this._fadeOut(() => this.onSelectMode('vsai'));
    });

    // 9-ball
    this._addButton(btnGroup, '9 球模式', '先碰最小号码球 · 合法打进 9 号球获胜', () => {
      this._fadeOut(() => this.onSelectMode('nineball'));
    });

    // Settings
    this._addButton(btnGroup, '设置', '音效与显示偏好', () => {
      if (this.onSettings) this.onSettings();
    });

    // Achievements
    this._addButton(btnGroup, '成就', '查看解锁进度与技巧记录', () => {
      if (this.onAchievements) this.onAchievements();
    });

    // Replays
    this._addButton(btnGroup, '精彩回放', '浏览并播放自动保存的高分击球', () => {
      if (this.onShowReplays) this.onShowReplays();
    });

    // Challenges
    this._addButton(btnGroup, '挑战模式', '完成指定条件，刷新星级评价', () => {
      if (this.onShowChallenges) this.onShowChallenges();
    });

    this.container.appendChild(btnGroup);

    // Quit button (bottom-right)
    const quitBtn = document.createElement('button');
    quitBtn.textContent = '退出游戏';
    quitBtn.className = 'ui-action';
    quitBtn.style.cssText = `
      position: absolute; bottom: 40px; right: 40px;
      padding: 10px 24px; font-size: 14px; color: rgba(244,247,244,0.62);
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
    version.textContent = 'v1.3.2';
    version.style.cssText = `
      position: absolute; bottom: 44px; left: 40px;
      font-size: 12px; color: rgba(244,247,244,0.32);
    `;
    this.container.appendChild(version);

    layer.appendChild(this.container);
  }

  _addButton(parent, label, desc, onClick) {
    const btn = document.createElement('button');
    btn.className = 'menu-btn';

    const titleRow = document.createElement('div');
    titleRow.className = 'menu-btn-title';
    titleRow.textContent = label;
    btn.appendChild(titleRow);

    if (desc) {
      const descRow = document.createElement('div');
      descRow.className = 'menu-btn-desc';
      descRow.textContent = desc;
      btn.appendChild(descRow);
    }
    btn.onclick = onClick;

    parent.appendChild(btn);
  }

  _fadeOut(callback) {
    if (!this.container) return;
    this.container.style.opacity = '0';
    this.container.style.transform = 'scale(0.96)';
    if (this._fadeTimer) clearTimeout(this._fadeTimer);
    this._fadeTimer = setTimeout(() => {
      if (this.container) callback();
    }, animMs(400));
  }

  show() {
    if (!this.container) return;
    this.container.style.display = 'flex';
    requestAnimationFrame(() => {
      if (!this.container) return;
      this.container.style.opacity = '1';
      this.container.style.transform = 'scale(1)';
    });
  }

  hide() {
    if (!this.container) return;
    this.container.style.opacity = '0';
    this.container.style.transform = 'scale(0.96)';
    if (this._hideTimer) clearTimeout(this._hideTimer);
    this._hideTimer = setTimeout(() => {
      if (this.container) this.container.style.display = 'none';
    }, animMs(400));
  }

  destroy() {
    if (this._fadeTimer) { clearTimeout(this._fadeTimer); this._fadeTimer = null; }
    if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; }
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
  }
}
