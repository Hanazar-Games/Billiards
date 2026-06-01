import { animMs } from '../core/AnimSpeed.js';
import { VERSION_TAG } from '../core/Version.js';

/**
 * MainMenuScreen — The primary entry screen with mode selection.
 *
 * Features:
 *  - Animated title with glow effect
 *  - Grouped mode buttons: Play, Practice, Social, System
 *  - Glassmorphism button style with hover effects
 *  - Smooth fade transitions
 *  - Back button when returning from settings
 */
export class MainMenuScreen {
  constructor(onSelectMode, onSettings, onAchievements, onShowReplays, onShowChallenges, onQuit, onLanMultiplayer, onMatchSetup, onShowTrainer, onShowTournament, onShowCareer) {
    this.onSelectMode = onSelectMode || (() => {});
    this.onSettings = onSettings;
    this.onAchievements = onAchievements;
    this.onShowReplays = onShowReplays;
    this.onShowChallenges = onShowChallenges;
    this.onQuit = onQuit;
    this.onLanMultiplayer = onLanMultiplayer;
    this.onMatchSetup = onMatchSetup;
    this.onShowTrainer = onShowTrainer;
    this.onShowTournament = onShowTournament;
    this.onShowCareer = onShowCareer;
    this.container = null;
    this._fadeTimer = null;
    this._hideTimer = null;
    this._showRaf = null;
    this._buildUI();
  }

  _buildUI() {
    const layer = document.getElementById('menu-layer');
    if (!layer) {
      console.error('[MainMenuScreen] #menu-layer not found');
      return;
    }

    this.container = document.createElement('div');
    this.container.id = 'main-menu';
    this.container.style.cssText = `
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      width: 100%; height: 100%;
      padding: 24px 0 100px;
      overflow-y: auto;
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
      margin-bottom: 28px; letter-spacing: 3px;
      text-transform: uppercase;
    `;
    subtitle.textContent = 'Hanazar Games';
    this.container.appendChild(subtitle);

    // Buttons grid (2-col on wide, 1-col on narrow)
    const btnGrid = document.createElement('div');
    btnGrid.className = 'menu-grid';
    btnGrid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(2, minmax(280px, 360px));
      gap: 20px;
      max-width: min(760px, 96vw);
    `;

    // ── Section: 开始游戏 ──
    const playGroup = this._createSection(btnGrid, '🎯 开始游戏');
    this._addButton(playGroup, '单人练习', '无胜负规则 · 白球自动复位 · 练习瞄准与力度', () => {
      this._fadeOut(() => this.onSelectMode('freeplay'));
    });
    this._addButton(playGroup, '本地双人对战', '标准 8 球 · 分组清台 · 同屏轮流击球', () => {
      this._fadeOut(() => this.onSelectMode('local2p'));
    });
    this._addButton(playGroup, '对战 AI', '标准 8 球 · 内置电脑对手 · 难度可调', () => {
      this._fadeOut(() => this.onSelectMode('vsai'));
    });
    this._addButton(playGroup, '9 球模式', '先碰最小号码球 · 合法打进 9 号球获胜', () => {
      this._fadeOut(() => this.onSelectMode('nineball'));
    });
    this._addButton(playGroup, '本地比赛', '自定义名字与赛制 · 8 球或 9 球 · 单局/三局/五局', () => {
      if (this.onMatchSetup) this.onMatchSetup();
    });
    this._addButton(playGroup, '冠军锦标赛', '8人单淘汰 · progressively harder AI · 争夺金杯', () => {
      if (this.onShowTournament) this.onShowTournament();
    });

    // ── Section: 练习与挑战 ──
    const trainGroup = this._createSection(btnGrid, '📚 练习与挑战');
    this._addButton(trainGroup, '击球训练', '从直线球到走位控制，逐步提升击球技巧', () => {
      if (this.onShowTrainer) this.onShowTrainer();
    });
    this._addButton(trainGroup, '挑战模式', '完成指定条件，刷新星级评价', () => {
      if (this.onShowChallenges) this.onShowChallenges();
    });

    // ── Section: 资料与社交 ──
    const socialGroup = this._createSection(btnGrid, '🏆 资料与社交');
    this._addButton(socialGroup, '成就', '查看解锁进度与技巧记录', () => {
      if (this.onAchievements) this.onAchievements();
    });
    this._addButton(socialGroup, '精彩回放', '浏览并播放自动保存的高分击球', () => {
      if (this.onShowReplays) this.onShowReplays();
    });
    this._addButton(socialGroup, 'AI 对战观赛', '两台电脑自动对弈 · 转播视角 · 实时解说', () => {
      this._fadeOut(() => this.onSelectMode('spectator'));
    });
    this._addButton(socialGroup, '局域网联机', '同一 Wi-Fi 下创建或加入房间，与好友对战', () => {
      if (this.onLanMultiplayer) this.onLanMultiplayer();
    });
    this._addButton(socialGroup, '生涯统计', '查看击球风格分析、胜率趋势与最佳记录', () => {
      if (this.onShowCareer) this.onShowCareer();
    });

    // ── Section: 系统 ──
    const sysGroup = this._createSection(btnGrid, '⚙️ 系统');
    this._addButton(sysGroup, '设置', '音效与显示偏好', () => {
      if (this.onSettings) this.onSettings();
    });

    this.container.appendChild(btnGrid);

    // Quit button (bottom-right)
    const quitBtn = document.createElement('button');
    quitBtn.type = 'button';
    quitBtn.textContent = '退出游戏';
    quitBtn.className = 'ui-action';
    quitBtn.style.cssText = `
      position: absolute; bottom: 40px; right: 40px;
      padding: 10px 24px; font-size: 14px; color: rgba(244,247,244,0.62);
      pointer-events: auto;
    `;
    const _setQuitHover = (active) => {
      quitBtn.style.color = active ? '#fff' : 'rgba(244,247,244,0.62)';
      quitBtn.style.borderColor = active ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)';
      quitBtn.style.transform = active ? 'translateY(-1px)' : 'translateY(0)';
    };
    quitBtn.onmouseenter = () => _setQuitHover(true);
    quitBtn.onmouseleave = () => _setQuitHover(false);
    quitBtn.onfocus = () => _setQuitHover(true);
    quitBtn.onblur = () => _setQuitHover(false);
    quitBtn.onclick = () => {
      if (this.onQuit) this.onQuit();
    };
    this.container.appendChild(quitBtn);
    this._quitBtn = quitBtn;

    // Version
    const version = document.createElement('div');
    version.textContent = VERSION_TAG;
    version.style.cssText = `
      position: absolute; bottom: 44px; left: 40px;
      font-size: 12px; color: rgba(244,247,244,0.32);
    `;
    this.container.appendChild(version);

    layer.appendChild(this.container);
  }

  _createSection(parent, title) {
    const section = document.createElement('div');
    section.style.cssText = `
      display: flex; flex-direction: column; gap: 8px;
    `;
    const header = document.createElement('div');
    header.textContent = title;
    header.style.cssText = `
      font-size: 12px; font-weight: 700; color: rgba(216,177,95,0.75);
      letter-spacing: 1.5px; text-transform: uppercase;
      padding: 0 4px; margin-bottom: 2px;
      user-select: none;
    `;
    section.appendChild(header);
    parent.appendChild(section);
    return section;
  }

  _addButton(parent, label, desc, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'menu-btn';
    btn.setAttribute('tabindex', '0');

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
    if (!this.container || typeof callback !== 'function') return;
    this.container.style.opacity = '0';
    this.container.style.transform = 'scale(0.96)';
    if (this._fadeTimer) clearTimeout(this._fadeTimer);
    this._fadeTimer = setTimeout(() => {
      if (this.container) callback();
    }, animMs(400));
  }

  show() {
    if (!this.container) return;
    if (this._fadeTimer) { clearTimeout(this._fadeTimer); this._fadeTimer = null; }
    if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; }
    if (this._showRaf) { cancelAnimationFrame(this._showRaf); this._showRaf = null; }
    this.container.style.display = 'flex';
    this._showRaf = requestAnimationFrame(() => {
      this._showRaf = null;
      if (!this.container) return;
      this.container.style.opacity = '1';
      this.container.style.transform = 'scale(1)';
    });
  }

  hide() {
    if (!this.container) return;
    if (this._showRaf) { cancelAnimationFrame(this._showRaf); this._showRaf = null; }
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
    if (this._showRaf) { cancelAnimationFrame(this._showRaf); this._showRaf = null; }
    if (this._quitBtn) {
      this._quitBtn.onmouseenter = null;
      this._quitBtn.onmouseleave = null;
      this._quitBtn.onfocus = null;
      this._quitBtn.onblur = null;
      this._quitBtn.onclick = null;
      this._quitBtn = null;
    }
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.onSelectMode = null;
    this.onSettings = null;
    this.onAchievements = null;
    this.onShowReplays = null;
    this.onShowChallenges = null;
    this.onQuit = null;
    this.onLanMultiplayer = null;
    this.onMatchSetup = null;
    this.onShowTrainer = null;
    this.onShowTournament = null;
  }
}
