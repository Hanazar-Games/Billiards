import { settings } from '../core/SettingsStore.js';
import { animMs, isReducedMotion } from '../core/AnimSpeed.js';
import { UIText } from '../core/UIText.js';
import { uiLayout } from './UILayout.js';


export class UI {
  constructor() {
    this.player1Badge = document.getElementById('player1');
    this.player2Badge = document.getElementById('player2');
    this.message = document.getElementById('message');
    this.powerFill = document.getElementById('power-bar-fill');
    this.turnTimerEl = document.getElementById('turn-timer');
    this._messageTimer = null;
    this._messageId = 0;
    this._aiListeners = [];
    this._flashTimer = null;
    this._flashInnerTimer = null;
    this._flashRaf = null;
    this._pauseHideTimer = null;
    this._pauseShowRaf = null;
    this._floatTimers = [];
    this._turnPulseRaf = null;
    this._turnPulseTimer = null;
    this._lastTimerSec = null;
    this._lastTurnTimerSec = null;
    this._lastTurnTimerWarn = 'none';
    this._confirmOverlay = null;
    this._confirmKeyHandler = null;
    this._currentSpin = { x: 0, y: 0 };
    // HUD state machine tracking
    this._hudState = 'AIM';
    this._messagePriority = 0;
    this._baseMessagePriority = 0;

    const uiLayer = document.getElementById('ui-layer');

    // ── Inject player details into top badges ──
    this._player1Name = null;
    this._player2Name = null;
    this._player1Detail = null;
    this._player2Detail = null;
    if (this.player1Badge) {
      const layout = this._installPlayerBadgeLayout(this.player1Badge, '玩家 1');
      this._player1Name = layout.name;
      this._player1Detail = layout.detail;
    }
    if (this.player2Badge) {
      const layout = this._installPlayerBadgeLayout(this.player2Badge, '玩家 2');
      this._player2Name = layout.name;
      this._player2Detail = layout.detail;
    }

    // ── Bottom HUD (single bar at very bottom) ──
    this.bottomHud = document.createElement('div');
    this.bottomHud.id = 'bottom-hud';

    const hudMain = document.createElement('div');
    hudMain.id = 'bottom-hud-main';

    // Left actions: back-to-menu + concede
    const hudLeft = document.createElement('div');
    hudLeft.className = 'hud-actions-left';

    this._hudBackBtn = document.createElement('button');
    this._hudBackBtn.id = 'back-to-menu';
    this._hudBackBtn.className = 'hud-btn';
    this._hudBackBtn.setAttribute('aria-label', '返回主菜单');
    this._hudBackBtn.dataset.fullLabel = '← 返回菜单';
    this._hudBackBtn.dataset.shortLabel = '←';
    this._hudBackBtn.textContent = this._hudBackBtn.dataset.fullLabel;
    hudLeft.appendChild(this._hudBackBtn);

    this._hudConcedeBtn = document.createElement('button');
    this._hudConcedeBtn.className = 'hud-btn hud-btn-danger';
    this._hudConcedeBtn.setAttribute('aria-label', '认输并结束当前对局');
    this._hudConcedeBtn.dataset.fullLabel = '认输';
    this._hudConcedeBtn.dataset.shortLabel = '认输';
    this._hudConcedeBtn.textContent = this._hudConcedeBtn.dataset.fullLabel;
    hudLeft.appendChild(this._hudConcedeBtn);

    hudMain.appendChild(hudLeft);

    // Center: timer + objective + spin
    this._hudCenter = document.createElement('div');
    this._hudCenter.className = 'hud-center';
    this._hudScore = document.createElement('div');
    this._hudScore.className = 'hud-score';
    this._hudScore.style.cssText = 'font-size:13px;font-weight:700;color:rgba(255,255,255,0.7);text-align:center;letter-spacing:1px;margin-bottom:2px;display:none;';
    this._hudTimer = document.createElement('div');
    this._hudTimer.className = 'hud-timer';
    this._hudTimer.textContent = '00:00';
    this._hudObjective = document.createElement('div');
    this._hudObjective.className = 'hud-objective';
    this._hudObjective.textContent = '';
    this._hudSpin = document.createElement('div');
    this._hudSpin.className = 'hud-spin';
    this._hudSpin.style.cssText = 'font-size:11px;font-weight:600;color:rgba(216,177,95,0.7);text-align:center;letter-spacing:0.5px;margin-top:2px;display:none;font-variant-numeric:tabular-nums;';
    this._hudCenter.appendChild(this._hudScore);
    this._hudCenter.appendChild(this._hudTimer);
    this._hudCenter.appendChild(this._hudObjective);
    this._hudCenter.appendChild(this._hudSpin);
    hudMain.appendChild(this._hudCenter);

    // Right actions: new game + settings
    const hudRight = document.createElement('div');
    hudRight.className = 'hud-actions-right';

    this._hudNewGameBtn = document.createElement('button');
    this._hudNewGameBtn.className = 'hud-btn';
    this._hudNewGameBtn.setAttribute('aria-label', '重新开始一局');
    this._hudNewGameBtn.dataset.fullLabel = '再来一局';
    this._hudNewGameBtn.dataset.shortLabel = '再来';
    this._hudNewGameBtn.textContent = this._hudNewGameBtn.dataset.fullLabel;
    this._hudNewGameBtn.style.display = 'none';
    hudRight.appendChild(this._hudNewGameBtn);

    this._hudSettingsBtn = document.createElement('button');
    this._hudSettingsBtn.className = 'hud-btn';
    this._hudSettingsBtn.setAttribute('aria-label', '打开游戏设置');
    this._hudSettingsBtn.dataset.fullLabel = '⚙️ 设置';
    this._hudSettingsBtn.dataset.shortLabel = '⚙️';
    this._hudSettingsBtn.textContent = this._hudSettingsBtn.dataset.fullLabel;
    hudRight.appendChild(this._hudSettingsBtn);

    // Responsive button labels: narrow viewports → short text
    this._compactHudEnabled = false;
    this._updateButtonLabels = () => {
      const narrow = window.innerWidth < 640;
      const useShort = narrow || this._compactHudEnabled;
      const pick = (btn) => {
        if (!btn) return;
        const label = useShort ? (btn.dataset.shortLabel || btn.dataset.fullLabel) : btn.dataset.fullLabel;
        if (label && btn.textContent !== label) btn.textContent = label;
      };
      pick(this._hudBackBtn);
      pick(this._hudConcedeBtn);
      pick(this._hudNewGameBtn);
      pick(this._hudSettingsBtn);
    };
    window.addEventListener('resize', this._updateButtonLabels);
    this._updateButtonLabels();

    hudMain.appendChild(hudRight);
    this.bottomHud.appendChild(hudMain);

    if (uiLayer) uiLayer.appendChild(this.bottomHud);

    // Register bottom HUD with the layout manager so its height is measured
    // dynamically (reacts to compact-hud / large-text / hudScale changes).
    if (this.bottomHud) {
      uiLayout.observeElement('bottomHud', this.bottomHud, 'bottom', { priority: 0, mode: 'stack' });
    }

    // Observe other persistent HUD elements so safe zones reflect their real footprint.
    const powerBar = document.getElementById('power-bar-container');
    if (powerBar) {
      uiLayout.observeElement('powerBar', powerBar, 'bottom', { priority: 1, mode: 'stack' });
    }
    if (this.turnTimerEl) {
      uiLayout.observeElement('turnTimer', this.turnTimerEl, 'bottom', { priority: 2, mode: 'stack' });
    }
    const topBar = document.getElementById('top-bar');
    if (topBar) {
      uiLayout.observeElement('topBar', topBar, 'top', { priority: 0, mode: 'stack' });
    }

    // ── Pause overlay ──
    this.pauseOverlay = document.createElement('div');
    this.pauseOverlay.style.cssText = `
      position: fixed; inset: 0; z-index: 50;
      background: rgba(5,7,8,0.82);
      backdrop-filter: blur(12px);
      display: none; flex-direction: column;
      align-items: center; justify-content: center;
      opacity: 0; transition: opacity calc(0.3s / var(--ui-anim-speed)) ease;
    `;

    const pausePanel = document.createElement('div');
    pausePanel.style.cssText = `
      background: var(--panel-strong);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 32px 36px;
      min-width: 300px;
      display: flex; flex-direction: column;
      gap: 14px; align-items: center;
      box-shadow: 0 24px 80px rgba(0,0,0,0.5);
      animation: ${isReducedMotion() ? 'none' : 'panelIn calc(0.4s / var(--ui-anim-speed)) var(--ease) both'};
    `;

    const pauseTitle = document.createElement('div');
    pauseTitle.textContent = '⏸ 暂停';
    pauseTitle.style.cssText = `
      font-size: 22px; font-weight: 800; color: var(--text);
      margin-bottom: 6px; letter-spacing: 2px;
    `;
    pausePanel.appendChild(pauseTitle);

    this._pauseActions = [];
    const addAction = (label, style, onClick) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = label;
      btn.style.cssText = `
        width: 100%; padding: 14px 0;
        background: rgba(255,255,255,0.06);
        border: 1px solid var(--line);
        border-radius: 10px;
        color: var(--text); font-size: 15px; font-weight: 750;
        cursor: pointer; pointer-events: auto;
        transition: all calc(0.2s / var(--ui-anim-speed)) ease;
        ${style || ''}
      `;
      const _setHover = (active) => {
        btn.style.background = active ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.06)';
        btn.style.borderColor = active ? 'var(--line-strong)' : 'var(--line)';
        btn.style.transform = active ? 'translateY(-1px)' : 'translateY(0)';
      };
      btn.onmouseenter = () => _setHover(true);
      btn.onmouseleave = () => _setHover(false);
      btn.onfocus = () => _setHover(true);
      btn.onblur = () => _setHover(false);
      btn.onclick = onClick;
      pausePanel.appendChild(btn);
      this._pauseActions.push(btn);
    };

    this._addPauseAction = addAction;

    this.pauseOverlay.appendChild(pausePanel);
    document.body.appendChild(this.pauseOverlay);

  }

  _installPlayerBadgeLayout(badge, fallbackName) {
    const existingName = badge.querySelector('[data-ui-player-name]')?.textContent?.trim();
    const textName = Array.from(badge.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent.trim())
      .find(Boolean);
    const nameText = existingName || textName || fallbackName;

    badge.textContent = '';

    const name = document.createElement('div');
    name.className = 'player-name';
    name.dataset.uiPlayerName = 'true';
    name.textContent = nameText;
    badge.appendChild(name);

    const detail = document.createElement('div');
    detail.className = 'player-detail';
    detail.dataset.uiPlayerDetail = 'true';
    badge.appendChild(detail);

    return { name, detail };
  }

  // Kept for backward-compat; top-bar AI controls removed — settings overlay handles these now
  setupAIControls(onAIToggle, onDiffChange, onSoundToggle) {
    // No-op: controls moved to in-game settings panel
  }

  setPower(pct) {
    if (this.powerFill) {
      const valid = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;
      this.powerFill.style.width = valid + '%';
    }
  }

  /**
   * Show a message in the top-center HUD area.
   * @param {string} text
   * @param {number} [duration=0] — ms to auto-clear (0 = persist)
   * @param {number} [priority=0] — higher priority messages block lower ones
   */
  setMessage(text, duration = 0, priority = 0) {
    if (!this.message) return;
    // Higher-priority messages override lower ones; equal or lower are dropped
    // unless the current message is empty.
    if (priority < this._messagePriority && this._lastMessage !== '') return;
    this.message.textContent = text;
    this._lastMessage = text;
    this._messagePriority = priority;
    this._messageId++;
    const id = this._messageId;
    if (this._messageTimer) {
      clearTimeout(this._messageTimer);
      this._messageTimer = null;
    }
    if (duration > 0) {
      const scale = (typeof settings !== 'undefined' && settings.get) ? (settings.get('messageDurationScale') ?? 1.0) : 1.0;
      this._messageTimer = setTimeout(() => {
        this._messageTimer = null;
        if (this.message && this._messageId === id) {
          this.message.textContent = '';
          this._lastMessage = '';
          this._messagePriority = this._baseMessagePriority;
        }
      }, duration * scale);
    }
  }

  /** Force-clear the current message regardless of priority. */
  clearMessage() {
    if (!this.message) return;
    this.message.textContent = '';
    this._lastMessage = '';
    this._messagePriority = this._baseMessagePriority;
    if (this._messageTimer) {
      clearTimeout(this._messageTimer);
      this._messageTimer = null;
    }
  }

  // ── Bottom HUD API ──

  setMatchInfo(objectiveText) {
    if (this._hudObjective) this._hudObjective.textContent = objectiveText || '';
  }

  setMatchScore({ p1Name, p2Name, p1Score, p2Score, currentGame, gamesNeeded, visible }) {
    if (!this._hudScore) return;
    if (!visible) {
      this._hudScore.style.display = 'none';
      return;
    }
    const n1 = p1Name || '玩家 1';
    const n2 = p2Name || '玩家 2';
    const cg = currentGame ?? 1;
    const gn = gamesNeeded ?? 1;
    this._hudScore.textContent = `${n1} ${p1Score} : ${p2Score} ${n2}  ·  第 ${cg}/${gn} 局`;
    this._hudScore.style.display = 'block';
  }

  updateTimer(elapsedMs) {
    if (!this._hudTimer) return;
    const safeMs = Number.isFinite(elapsedMs) && elapsedMs >= 0 ? elapsedMs : 0;
    const totalSec = Math.floor(safeMs / 1000);
    if (this._lastTimerSec === totalSec) return;
    this._lastTimerSec = totalSec;
    const h = Math.floor(totalSec / 3600);
    const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
    const sec = String(totalSec % 60).padStart(2, '0');
    this._hudTimer.textContent = h > 0 ? `${h}:${m}:${sec}` : `${m}:${sec}`;
  }

  setTurnTimer(seconds, maxSeconds) {
    if (!this.turnTimerEl) return;
    if (maxSeconds <= 0) {
      this.turnTimerEl.style.display = 'none';
      this.turnTimerEl.classList.remove('warning', 'danger');
      this._lastTurnTimerSec = null;
      return;
    }
    const s = Math.max(0, Math.ceil(Number.isFinite(seconds) ? seconds : 0));
    // Only update DOM when the displayed second changes
    if (this._lastTurnTimerSec === s && this._lastTurnTimerWarn === (s <= 3 ? 'danger' : s <= 5 ? 'warning' : 'none')) {
      return;
    }
    this._lastTurnTimerSec = s;
    this.turnTimerEl.textContent = `${s}s`;
    this.turnTimerEl.style.display = 'block';
    const warnClass = s <= 3 ? 'danger' : s <= 5 ? 'warning' : 'none';
    this._lastTurnTimerWarn = warnClass;
    this.turnTimerEl.classList.remove('warning', 'danger');
    if (warnClass !== 'none') {
      this.turnTimerEl.classList.add(warnClass);
    }
  }

  hideTurnTimer() {
    if (this.turnTimerEl) {
      this.turnTimerEl.style.display = 'none';
      this.turnTimerEl.classList.remove('warning', 'danger');
    }
  }

  setPlayerStats({ p1Name, p1Group, p1Remaining, p2Name, p2Group, p2Remaining, mode, targetBall }) {
    if (this._player1Name) this._player1Name.textContent = p1Name || '玩家 1';
    if (this._player2Name) this._player2Name.textContent = p2Name || '玩家 2';

    const groupLabel = (g) => {
      if (!g) return '';
      return g === 'solid' ? '● 全色' : '◯ 花色';
    };

    const is9Ball = mode === '9ball';

    const _setDetail = (el, remaining, group) => {
      if (!el) return;
      const r = Number.isFinite(remaining) ? remaining : (is9Ball ? 9 : 7);
      el.textContent = '';
      if (is9Ball && targetBall) {
        const span = document.createElement('span');
        span.className = 'hud-remain';
        span.textContent = `目标 ${targetBall}号`;
        el.appendChild(span);
      } else {
        const g = is9Ball ? '' : groupLabel(group);
        if (g) {
          const gSpan = document.createElement('span');
          gSpan.className = 'hud-group';
          gSpan.textContent = g;
          el.appendChild(gSpan);
        }
        const rSpan = document.createElement('span');
        rSpan.className = 'hud-remain';
        rSpan.textContent = `剩 ${r}`;
        el.appendChild(rSpan);
      }
    };
    _setDetail(this._player1Detail, p1Remaining, p1Group);
    _setDetail(this._player2Detail, p2Remaining, p2Group);
  }

  setPlayerTurn(player) {
    if (!this.player1Badge || !this.player2Badge) return;
    if (player === 1) {
      this.player1Badge.classList.add('active');
      this.player2Badge.classList.remove('active');
    } else {
      this.player1Badge.classList.remove('active');
      this.player2Badge.classList.add('active');
    }
    // Subtle scale pulse on turn change for clearer feedback
    const activeBadge = player === 1 ? this.player1Badge : this.player2Badge;
    if (activeBadge && !isReducedMotion()) {
      if (this._turnPulseRaf) { cancelAnimationFrame(this._turnPulseRaf); this._turnPulseRaf = null; }
      if (this._turnPulseTimer) { clearTimeout(this._turnPulseTimer); this._turnPulseTimer = null; }
      activeBadge.style.transform = 'scale(1.03)';
      this._turnPulseRaf = requestAnimationFrame(() => {
        this._turnPulseRaf = null;
        this._turnPulseTimer = setTimeout(() => {
          this._turnPulseTimer = null;
          if (activeBadge) activeBadge.style.transform = '';
        }, animMs(180));
      });
    }
  }

  setPlayerGroups(p1Group, p2Group) {
    // Group info is now shown only in bottom HUD; this method is kept for
    // backward compatibility with Game.js callers.
  }

  setShowConcede(show) {
    if (this._hudConcedeBtn) {
      this._hudConcedeBtn.style.display = show ? 'inline-block' : 'none';
    }
  }

  showResetButton(onClick, label = null) {
    if (this._hudNewGameBtn) {
      this._hudNewGameBtn.style.display = 'inline-block';
      if (label) this._hudNewGameBtn.textContent = label;
      this._hudNewGameBtn.onclick = onClick;
    }
  }

  hideResetButton() {
    if (this._hudNewGameBtn) {
      this._hudNewGameBtn.style.display = 'none';
      this._hudNewGameBtn.onclick = null;
    }
  }

  setupPauseControls(onPauseClick, onResume, onSettings, onQuit) {
    if (this._hudSettingsBtn) {
      this._hudSettingsBtn.onclick = onSettings;
    }
    if (this._hudBackBtn) {
      this._hudBackBtn.onclick = () => this._showConfirmDialog('确认返回主菜单？当前进度将丢失。', onQuit);
    }
    this._pauseActions.forEach(btn => {
      btn.onmouseenter = null;
      btn.onmouseleave = null;
      btn.onfocus = null;
      btn.onblur = null;
      btn.onclick = null;
      btn.remove();
    });
    this._pauseActions = [];

    this._addPauseAction('继续游戏', '', onResume);
    this._addPauseAction('设置', '', onSettings);
    this._addPauseAction('返回主菜单', 'color: #ff8a9a; border-color: rgba(185,18,63,0.35);', () => this._showConfirmDialog('确认返回主菜单？当前进度将丢失。', onQuit));
  }

  setupConcede(onConcede) {
    if (this._hudConcedeBtn) {
      this._hudConcedeBtn.onclick = onConcede;
    }
  }

  _showConfirmDialog(message, onConfirm) {
    // Remove any existing confirm dialog and its listener
    if (this._confirmKeyHandler) {
      document.removeEventListener('keydown', this._confirmKeyHandler);
      this._confirmKeyHandler = null;
    }
    const existing = document.getElementById('ui-confirm-dialog');
    if (existing) existing.remove();

    // Save previously focused element to restore later
    const previousFocus = document.activeElement;

    const overlay = document.createElement('div');
    overlay.id = 'ui-confirm-dialog';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 60;
      background: rgba(5,7,8,0.72);
      backdrop-filter: blur(8px);
      display: flex; align-items: center; justify-content: center;
      opacity: 0; transition: opacity calc(0.25s / var(--ui-anim-speed)) ease;
    `;

    const panel = document.createElement('div');
    panel.style.cssText = `
      background: var(--panel-strong);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 28px 32px;
      min-width: 280px;
      max-width: 90vw;
      display: flex; flex-direction: column;
      gap: 18px; align-items: center;
      box-shadow: 0 24px 80px rgba(0,0,0,0.5);
    `;

    const msg = document.createElement('div');
    msg.textContent = message;
    msg.style.cssText = 'font-size: 15px; font-weight: 650; color: var(--text); text-align: center; line-height: 1.45;';
    panel.appendChild(msg);

    const btns = document.createElement('div');
    btns.style.cssText = 'display: flex; gap: 12px; width: 100%;';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = '取消';
    cancelBtn.style.cssText = `
      flex: 1; padding: 12px 0;
      background: rgba(255,255,255,0.06);
      border: 1px solid var(--line);
      border-radius: 8px; color: var(--text);
      font-size: 14px; font-weight: 750; cursor: pointer;
      transition: all calc(0.2s / var(--ui-anim-speed)) ease;
    `;
    cancelBtn.onmouseenter = () => { cancelBtn.style.background = 'rgba(255,255,255,0.14)'; };
    cancelBtn.onmouseleave = () => { cancelBtn.style.background = 'rgba(255,255,255,0.06)'; };

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.textContent = '确认';
    confirmBtn.style.cssText = `
      flex: 1; padding: 12px 0;
      background: rgba(185,18,63,0.22);
      border: 1px solid rgba(185,18,63,0.45);
      border-radius: 8px; color: #ff8a9a;
      font-size: 14px; font-weight: 750; cursor: pointer;
      transition: all calc(0.2s / var(--ui-anim-speed)) ease;
    `;
    confirmBtn.onmouseenter = () => { confirmBtn.style.background = 'rgba(185,18,63,0.35)'; };
    confirmBtn.onmouseleave = () => { confirmBtn.style.background = 'rgba(185,18,63,0.22)'; };

    const close = () => {
      overlay.style.opacity = '0';
      document.removeEventListener('keydown', this._confirmKeyHandler);
      this._confirmKeyHandler = null;
      if (this._confirmCloseTimer) clearTimeout(this._confirmCloseTimer);
      this._confirmCloseTimer = setTimeout(() => {
        this._confirmCloseTimer = null;
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, animMs(250));
      // Restore focus to the element that had it before the dialog opened
      if (previousFocus && previousFocus.focus) {
        try { previousFocus.focus(); } catch (e) {}
      }
    };

    cancelBtn.onclick = close;
    confirmBtn.onclick = () => { close(); if (onConfirm) onConfirm(); };
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    this._confirmKeyHandler = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
      else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); close(); if (onConfirm) onConfirm(); }
    };
    document.addEventListener('keydown', this._confirmKeyHandler);

    btns.appendChild(cancelBtn);
    btns.appendChild(confirmBtn);
    panel.appendChild(btns);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    this._confirmOverlay = overlay;

    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
      // Move focus into the dialog for keyboard accessibility
      if (cancelBtn && cancelBtn.focus) {
        try { cancelBtn.focus(); } catch (e) {}
      }
    });
  }

  showPauseMenu() {
    if (!this.pauseOverlay) return;
    if (this._pauseHideTimer) { clearTimeout(this._pauseHideTimer); this._pauseHideTimer = null; }
    if (this._pauseShowRaf) { cancelAnimationFrame(this._pauseShowRaf); this._pauseShowRaf = null; }
    this.pauseOverlay.style.display = 'flex';
    this._pauseShowRaf = requestAnimationFrame(() => {
      this._pauseShowRaf = null;
      if (this.pauseOverlay) this.pauseOverlay.style.opacity = '1';
    });
  }

  hidePauseMenu() {
    if (!this.pauseOverlay) return;
    if (this._pauseShowRaf) { cancelAnimationFrame(this._pauseShowRaf); this._pauseShowRaf = null; }
    this.pauseOverlay.style.opacity = '0';
    if (this._pauseHideTimer) { clearTimeout(this._pauseHideTimer); }
    this._pauseHideTimer = setTimeout(() => {
      if (this.pauseOverlay) this.pauseOverlay.style.display = 'none';
      this._pauseHideTimer = null;
    }, animMs(300));
  }

  flashRed() {
    const reduced = isReducedMotion();
    if (reduced) return;
    const uiLayer = document.getElementById('ui-layer');
    if (!uiLayer) return;
    // Clear any existing flash to prevent overlapping timers
    const old = document.getElementById('ui-red-flash');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    if (this._flashTimer) clearTimeout(this._flashTimer);
    if (this._flashInnerTimer) clearTimeout(this._flashInnerTimer);
    const flash = document.createElement('div');
    flash.id = 'ui-red-flash';
    flash.style.cssText = `
      position: absolute; inset: 0; pointer-events: none; z-index: 5;
      background: radial-gradient(circle at center, rgba(185,18,63,0.18) 0%, transparent 70%);
      opacity: 0; transition: opacity calc(0.25s / var(--ui-anim-speed)) ease;
    `;
    uiLayer.appendChild(flash);
    if (this._flashRaf) { cancelAnimationFrame(this._flashRaf); this._flashRaf = null; }
    this._flashRaf = requestAnimationFrame(() => {
      this._flashRaf = null;
      if (flash) flash.style.opacity = '1';
    });
    this._flashTimer = setTimeout(() => {
      if (flash) flash.style.opacity = '0';
      this._flashInnerTimer = setTimeout(() => {
        this._flashInnerTimer = null;
        if (flash && flash.parentNode) flash.parentNode.removeChild(flash);
      }, animMs(300));
      this._flashTimer = null;
    }, animMs(350));
  }

  showFloatingText(text, screenX, screenY, color = '#d8b15f') {
    if (settings.get('floatingTextEnabled') === false) return;
    const uiLayer = document.getElementById('ui-layer');
    if (!uiLayer) return;
    if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) return;
    const vw = window.innerWidth || 1;
    const vh = window.innerHeight || 1;
    const clampedX = Math.max(0, Math.min(vw, screenX));
    const clampedY = Math.max(0, Math.min(vh, screenY));
    const reduced = isReducedMotion();
    const el = document.createElement('div');
    el.className = 'ui-float-text';
    el.textContent = text;
    el.style.cssText = `
      position: absolute; left: ${clampedX}px; top: ${clampedY}px;
      transform: translate(-50%, -50%);
      font-size: 18px; font-weight: 800; color: ${color};
      text-shadow: 0 2px 8px rgba(0,0,0,0.8);
      pointer-events: none; z-index: 10; white-space: nowrap;
      ${reduced ? '' : `animation: floatTextUp calc(1.2s / var(--ui-anim-speed)) ease-out forwards;`}
      opacity: var(--hud-opacity, 1);
    `;
    uiLayer.appendChild(el);
    const t = setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
      const idx = this._floatTimers.indexOf(t);
      if (idx !== -1) this._floatTimers.splice(idx, 1);
    }, reduced ? 600 : animMs(1200));
    this._floatTimers.push(t);
  }

  // ── HUD visibility controls (wired from SettingsScreen) ──
  setHudScale(v) {
    let scale = Math.max(0.5, Math.min(2.0, v));
    // Prevent the scaled HUD from overflowing narrow viewports
    const vw = window.innerWidth || 1;
    const maxScale = vw < 400 ? 1.3 : vw < 600 ? 1.6 : 2.0;
    scale = Math.min(scale, maxScale);
    if (this.bottomHud) {
      this.bottomHud.style.transform = `scale(${scale})`;
      this.bottomHud.style.transformOrigin = 'bottom center';
    }
    uiLayout.updateScale('bottomHud', scale);
  }

  setHudOpacity(v) {
    const opacity = String(Math.max(0.3, Math.min(1.0, v)));
    // Publish as CSS custom property so dynamically-created HUD elements inherit it
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--hud-opacity', opacity);
    }
    if (this.bottomHud) {
      this.bottomHud.style.opacity = opacity;
    }
    // Apply opacity to other persistent HUD elements so the whole HUD
    // feels cohesive when the user adjusts transparency.
    const powerBar = document.getElementById('power-bar-container');
    if (powerBar) powerBar.style.opacity = opacity;
    if (this.turnTimerEl) this.turnTimerEl.style.opacity = opacity;
    if (this.player1Badge) this.player1Badge.style.opacity = opacity;
    if (this.player2Badge) this.player2Badge.style.opacity = opacity;
    const versionTag = document.getElementById('version-tag');
    if (versionTag) versionTag.style.opacity = opacity;
    // Minimap
    const minimap = document.querySelector('.table-minimap');
    if (minimap) minimap.style.opacity = String(Math.min(1, (settings.get('minimapOpacity') ?? 0.85) * parseFloat(opacity)));
    // Combo counter
    if (this._comboEl) this._comboEl.style.opacity = opacity;
    // FPS counter
    if (this._fpsEl) this._fpsEl.style.opacity = opacity;
    // Crosshair
    const crosshair = document.getElementById('crosshair');
    if (crosshair) crosshair.style.opacity = opacity;
    // Message
    if (this.message) this.message.style.opacity = opacity;
    // Replay hint
    if (this._replayHintEl) this._replayHintEl.style.opacity = opacity;
    // Push-out button / choice
    if (this._pushOutBtn) this._pushOutBtn.style.opacity = opacity;
    if (this._pushOutChoiceWrap) this._pushOutChoiceWrap.style.opacity = opacity;
    // Three-foul badge
    if (this._threeFoulBadge) this._threeFoulBadge.style.opacity = opacity;
  }

  setHighContrastUI(v) {
    document.documentElement.classList.toggle('high-contrast', Boolean(v));
  }

  setLargeTextMode(v) {
    document.documentElement.classList.toggle('large-text', Boolean(v));
  }

  setCompactHud(v) {
    this._compactHudEnabled = Boolean(v);
    document.documentElement.classList.toggle('compact-hud', this._compactHudEnabled);
    this._updateButtonLabels?.();
  }

  setReducedMotion(v) {
    document.documentElement.classList.toggle('reduce-motion', Boolean(v));
  }

  setShowFPS(v) {
    if (!this._fpsEl && v) {
      this._fpsEl = document.createElement('div');
      this._fpsEl.style.cssText = `
        position: absolute; top: calc(var(--hud-top-safe) + 14px); left: calc(var(--hud-left-safe) + 14px);
        font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.6);
        font-family: ui-monospace, SFMono-Regular, monospace;
        pointer-events: none; z-index: 10;
        opacity: var(--hud-opacity, 1);
      `;
      const uiLayer = document.getElementById('ui-layer');
      if (uiLayer) uiLayer.appendChild(this._fpsEl);
    }
    if (this._fpsEl) this._fpsEl.style.display = v ? 'block' : 'none';
  }

  updateFPS(fps) {
    if (this._fpsEl && this._fpsEl.style.display !== 'none') {
      this._fpsEl.textContent = fps + ' FPS';
    }
  }

  setShowPowerBar(v) {
    this._powerBarSetting = v;
    this._applyHUDVisibility();
  }

  setShowSpinIndicator(v) {
    if (this._hudSpin) {
      this._hudSpin.style.display = v ? 'block' : 'none';
    }
  }

  /**
   * Updates the spin indicator text in the bottom HUD.
   * @param {{x:number,y:number}} spin - normalized spin offset (-1..1)
   */
  setSpin(spin) {
    if (!this._hudSpin) return;
    const s = spin || { x: 0, y: 0 };
    const x = Number.isFinite(s.x) ? s.x : 0;
    const y = Number.isFinite(s.y) ? s.y : 0;
    this._currentSpin = { x, y };
    const absX = Math.abs(x);
    const absY = Math.abs(y);
    if (absX < 0.05 && absY < 0.05) {
      this._hudSpin.textContent = '无旋转';
      this._hudSpin.style.color = 'rgba(255,255,255,0.35)';
      return;
    }
    const dirH = x > 0.05 ? '右' : x < -0.05 ? '左' : '';
    const dirV = y > 0.05 ? '下' : y < -0.05 ? '上' : '';
    const strength = Math.max(absX, absY);
    const level = strength > 0.7 ? '强' : strength > 0.35 ? '中' : '弱';
    this._hudSpin.textContent = `${dirV}${dirH}旋 · ${level}`;
    this._hudSpin.style.color = 'rgba(216,177,95,0.85)';
  }

  setShowCrosshair(v) {
    this._crosshairSetting = v;
    let el = document.getElementById('crosshair');
    if (!el && v) {
      el = document.createElement('div');
      el.id = 'crosshair';
      el.style.cssText = `
        position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
        width: 24px; height: 24px; pointer-events: none; z-index: 9;
        border: 2px solid rgba(255,255,255,0.7); border-radius: 50%;
        box-shadow: 0 0 0 1px rgba(0,0,0,0.4), 0 0 8px rgba(255,255,255,0.3);
        opacity: var(--hud-opacity, 1);
      `;
      const h = document.createElement('div');
      h.style.cssText = 'position:absolute;top:50%;left:0;width:100%;height:2px;background:rgba(255,255,255,0.7);transform:translateY(-50%);';
      el.appendChild(h);
      const vline = document.createElement('div');
      vline.style.cssText = 'position:absolute;left:50%;top:0;height:100%;width:2px;background:rgba(255,255,255,0.7);transform:translateX(-50%);';
      el.appendChild(vline);
      const uiLayer = document.getElementById('ui-layer');
      if (uiLayer) uiLayer.appendChild(el);
    }
    this._applyHUDVisibility();
  }

  setShowRemainingBalls(v) {
    if (this._hudObjective) this._hudObjective.style.display = v ? 'block' : 'none';
  }

  setShowComboCounter(v) {
    this._comboCounterSetting = v;
    if (!this._comboEl && v) {
      this._comboEl = document.createElement('div');
      this._comboEl.style.cssText = `
        position: absolute; top: calc(var(--hud-top-safe) + 50px); left: 50%; transform: translateX(-50%);
        font-size: 14px; font-weight: 800; color: rgba(216,177,95,0.9);
        text-shadow: 0 2px 8px rgba(0,0,0,0.7); pointer-events: none; z-index: 10;
        white-space: nowrap; letter-spacing: 1px;
        opacity: var(--hud-opacity, 1);
      `;
      const uiLayer = document.getElementById('ui-layer');
      if (uiLayer) uiLayer.appendChild(this._comboEl);
    }
    this._applyHUDVisibility();
  }

  updateComboCounter(count) {
    if (this._comboEl && this._comboEl.style.display !== 'none') {
      this._comboEl.textContent = count > 1 ? `连击 ×${count}` : '';
    }
  }

  /**
   * Transition the HUD to a new game state.
   * This centralises which UI elements should be visible in each state,
   * preventing conflicting overlays (e.g. power bar + game-over screen).
   *
   * @param {'AIM'|'CHARGING'|'SHOOTING'|'AI_THINKING'|'GAME_OVER'|'BALL_IN_HAND'|'PAUSED'} state
   */
  setHUDState(state) {
    const prev = this._hudState;
    this._hudState = state;

    // Game over: aggressively clean up transient HUD so only the result remains
    if (state === 'GAME_OVER') {
      this.hidePushOutButton();
      this.hidePushOutChoice();
      this.hideThreeFoulWarning();
      this.hideTurnTimer();
      this._baseMessagePriority = 3;
    } else if (prev === 'GAME_OVER') {
      // Leaving game over: drop base priority back to normal
      this._baseMessagePriority = 0;
      if (this._messagePriority > 0) this._messagePriority = 0;
    }

    // Ball-in-hand / AI thinking: clear any low-priority transient messages
    if (state === 'BALL_IN_HAND' || state === 'AI_THINKING') {
      if (this._messagePriority < 2) this.clearMessage();
    }

    this._applyHUDVisibility();
  }

  /** Apply visibility rules based on the current _hudState and user settings. */
  _applyHUDVisibility() {
    const state = this._hudState;
    const isPlaying = state === 'AIM' || state === 'CHARGING';
    const isShooting = state === 'SHOOTING';
    const isGameOver = state === 'GAME_OVER';
    const isAIThinking = state === 'AI_THINKING';
    const isBallInHand = state === 'BALL_IN_HAND';
    const isReplaying = state === 'REPLAYING';

    // Power bar: visible only during AIM/CHARGING when enabled by settings
    if (this.powerFill) {
      const bar = this.powerFill.parentElement;
      if (bar) {
        const show = (this._powerBarSetting !== false) && isPlaying;
        bar.style.display = show ? 'block' : 'none';
      }
    }

    // Crosshair: visible only during AIM/CHARGING when enabled by settings
    const crosshair = document.getElementById('crosshair');
    if (crosshair) {
      const show = (this._crosshairSetting !== false) && isPlaying;
      crosshair.style.display = show ? 'block' : 'none';
    }

    // Combo counter: hidden on game over or replay regardless of setting
    if (this._comboEl) {
      const show = (this._comboCounterSetting !== false) && !isGameOver && !isReplaying;
      this._comboEl.style.display = show ? 'block' : 'none';
    }

    // Turn timer: immediately hide when shooting / AI thinking / game over / ball-in-hand / replaying
    if (isShooting || isAIThinking || isGameOver || isBallInHand || isReplaying) {
      this.hideTurnTimer();
    }
  }

  setStatsPanelEnabled(v) {
    // Forward to StatsPanel if available
    if (this._statsPanelRef) {
      this._statsPanelRef.setEnabled(v);
    }
  }

  bindStatsPanel(statsPanel) {
    this._statsPanelRef = statsPanel;
  }

  setTimerPosition(pos) {
    const el = this.turnTimerEl;
    if (!el) return;
    el.classList.remove('top', 'bottom');
    if (pos === 'top' || pos === 'bottom') {
      el.classList.add(pos);
    }
  }

  // ── Push-out UI ──

  showPushOutButton(onClick) {
    if (!this._pushOutBtn) {
      this._pushOutBtn = document.createElement('button');
      this._pushOutBtn.className = 'hud-btn hud-btn-accent';
      this._pushOutBtn.textContent = UIText.pushOutButton;
      this._pushOutBtn.style.cssText = `
        position: absolute; bottom: calc(var(--hud-bottom-safe) + 44px); left: 50%; transform: translateX(-50%);
        padding: 10px 22px; font-size: 15px; font-weight: 800;
        background: rgba(212,167,44,0.18); border: 1px solid rgba(212,167,44,0.55);
        color: #f0d78c; border-radius: 10px; cursor: pointer; pointer-events: auto;
        backdrop-filter: blur(8px); z-index: 15;
        transition: all calc(0.2s / var(--ui-anim-speed)) ease;
        opacity: var(--hud-opacity, 1);
      `;
      const _setPushHover = (active) => {
        this._pushOutBtn.style.background = active ? 'rgba(212,167,44,0.32)' : 'rgba(212,167,44,0.18)';
        this._pushOutBtn.style.transform = active ? 'translateX(-50%) translateY(-1px)' : 'translateX(-50%) translateY(0)';
      };
      this._pushOutBtn.onmouseenter = () => _setPushHover(true);
      this._pushOutBtn.onmouseleave = () => _setPushHover(false);
      this._pushOutBtn.onfocus = () => _setPushHover(true);
      this._pushOutBtn.onblur = () => _setPushHover(false);
      const uiLayer = document.getElementById('ui-layer');
      if (uiLayer) uiLayer.appendChild(this._pushOutBtn);
    }
    this._pushOutBtn.style.display = 'block';
    this._pushOutBtn.onclick = onClick;
  }

  hidePushOutButton() {
    if (this._pushOutBtn) {
      this._pushOutBtn.style.display = 'none';
      this._pushOutBtn.onclick = null;
    }
  }

  showReplayHint(onClick) {
    if (!this._replayHintEl) {
      this._replayHintEl = document.createElement('button');
      this._replayHintEl.className = 'hud-btn';
      this._replayHintEl.textContent = '🔁 回放上一杆 (R)';
      this._replayHintEl.style.cssText = `
        position: absolute;
        bottom: calc(var(--hud-bottom-safe) + 84px);
        right: calc(var(--hud-right-safe) + 12px);
        padding: 7px 14px;
        font-size: 12px;
        font-weight: 750;
        background: rgba(0,0,0,0.55);
        border: 1px solid rgba(255,255,255,0.18);
        color: rgba(255,255,255,0.75);
        border-radius: 8px;
        cursor: pointer;
        pointer-events: auto;
        backdrop-filter: blur(6px);
        z-index: 12;
        transition: all calc(0.2s / var(--ui-anim-speed)) ease;
        opacity: 0;
        transform: translateY(6px);
      `;
      this._replayHintEl.onmouseenter = () => {
        if (this._replayHintEl) {
          this._replayHintEl.style.background = 'rgba(255,255,255,0.12)';
          this._replayHintEl.style.borderColor = 'rgba(255,255,255,0.3)';
        }
      };
      this._replayHintEl.onmouseleave = () => {
        if (this._replayHintEl) {
          this._replayHintEl.style.background = 'rgba(0,0,0,0.55)';
          this._replayHintEl.style.borderColor = 'rgba(255,255,255,0.18)';
        }
      };
      const uiLayer = document.getElementById('ui-layer');
      if (uiLayer) uiLayer.appendChild(this._replayHintEl);
    }
    if (this._replayHintHideTimer) {
      clearTimeout(this._replayHintHideTimer);
      this._replayHintHideTimer = null;
    }
    this._replayHintEl.style.display = 'block';
    this._replayHintEl.onclick = onClick;
    if (this._replayHintRaf) cancelAnimationFrame(this._replayHintRaf);
    this._replayHintRaf = requestAnimationFrame(() => {
      this._replayHintRaf = null;
      if (this._replayHintEl) {
        const hudOp = getComputedStyle(document.documentElement).getPropertyValue('--hud-opacity').trim() || '1';
        this._replayHintEl.style.opacity = hudOp;
        this._replayHintEl.style.transform = 'translateY(0)';
      }
    });
  }

  hideReplayHint() {
    if (this._replayHintEl) {
      this._replayHintEl.style.opacity = '0';
      this._replayHintEl.style.transform = 'translateY(6px)';
      this._replayHintHideTimer = setTimeout(() => {
        this._replayHintHideTimer = null;
        if (this._replayHintEl) this._replayHintEl.style.display = 'none';
      }, animMs(250));
      this._replayHintEl.onclick = null;
    }
  }

  showPushOutChoice(onAccept, onPass) {
    if (!this._pushOutChoiceWrap) {
      this._pushOutChoiceWrap = document.createElement('div');
      this._pushOutChoiceWrap.style.cssText = `
        position: absolute; bottom: calc(var(--hud-bottom-safe) + 44px); left: 50%; transform: translateX(-50%);
        display: flex; gap: 10px; align-items: center; z-index: 15;
        background: rgba(8,10,12,0.78); border: 1px solid rgba(255,255,255,0.12);
        border-radius: 12px; padding: 10px 16px; backdrop-filter: blur(10px);
        pointer-events: auto;
        opacity: var(--hud-opacity, 1);
      `;
      const prompt = document.createElement('span');
      prompt.textContent = UIText.pushOutPrompt;
      prompt.style.cssText = 'font-size: 14px; font-weight: 700; color: rgba(255,255,255,0.7); margin-right: 6px; white-space: nowrap;';
      this._pushOutChoiceWrap.appendChild(prompt);

      this._pushOutAcceptBtn = document.createElement('button');
      this._pushOutAcceptBtn.className = 'hud-btn';
      this._pushOutAcceptBtn.textContent = UIText.pushOutAccept;
      this._pushOutAcceptBtn.style.cssText = `
        padding: 8px 18px; font-size: 14px; font-weight: 750;
        background: rgba(44,167,112,0.18); border: 1px solid rgba(44,167,112,0.55);
        color: #8ce0b0; border-radius: 8px; cursor: pointer;
        transition: all calc(0.2s / var(--ui-anim-speed)) ease;
      `;
      const _setAcceptHover = (active) => {
        this._pushOutAcceptBtn.style.background = active ? 'rgba(44,167,112,0.32)' : 'rgba(44,167,112,0.18)';
      };
      this._pushOutAcceptBtn.onmouseenter = () => _setAcceptHover(true);
      this._pushOutAcceptBtn.onmouseleave = () => _setAcceptHover(false);
      this._pushOutAcceptBtn.onfocus = () => _setAcceptHover(true);
      this._pushOutAcceptBtn.onblur = () => _setAcceptHover(false);
      this._pushOutChoiceWrap.appendChild(this._pushOutAcceptBtn);

      this._pushOutPassBtn = document.createElement('button');
      this._pushOutPassBtn.className = 'hud-btn';
      this._pushOutPassBtn.textContent = UIText.pushOutPass;
      this._pushOutPassBtn.style.cssText = `
        padding: 8px 18px; font-size: 14px; font-weight: 750;
        background: rgba(185,96,44,0.18); border: 1px solid rgba(185,96,44,0.55);
        color: #f0b88c; border-radius: 8px; cursor: pointer;
        transition: all calc(0.2s / var(--ui-anim-speed)) ease;
      `;
      const _setPassHover = (active) => {
        this._pushOutPassBtn.style.background = active ? 'rgba(185,96,44,0.32)' : 'rgba(185,96,44,0.18)';
      };
      this._pushOutPassBtn.onmouseenter = () => _setPassHover(true);
      this._pushOutPassBtn.onmouseleave = () => _setPassHover(false);
      this._pushOutPassBtn.onfocus = () => _setPassHover(true);
      this._pushOutPassBtn.onblur = () => _setPassHover(false);
      this._pushOutChoiceWrap.appendChild(this._pushOutPassBtn);

      const uiLayer = document.getElementById('ui-layer');
      if (uiLayer) uiLayer.appendChild(this._pushOutChoiceWrap);
    }
    this._pushOutChoiceWrap.style.display = 'flex';
    this._pushOutAcceptBtn.onclick = onAccept;
    this._pushOutPassBtn.onclick = onPass;
  }

  hidePushOutChoice() {
    if (this._pushOutChoiceWrap) {
      this._pushOutChoiceWrap.style.display = 'none';
      this._pushOutAcceptBtn.onclick = null;
      this._pushOutPassBtn.onclick = null;
    }
  }

  // ── Three-foul warning ──

  showThreeFoulWarning() {
    if (!this._threeFoulBadge) {
      const reduced = isReducedMotion();
      this._threeFoulBadge = document.createElement('div');
      this._threeFoulBadge.style.cssText = `
        position: absolute; top: calc(var(--hud-top-safe) + 16px); left: 50%; transform: translateX(-50%);
        padding: 8px 18px; font-size: 14px; font-weight: 800;
        background: rgba(185,18,63,0.22); border: 1px solid rgba(185,18,63,0.55);
        color: #ff8a9a; border-radius: 10px; pointer-events: none;
        backdrop-filter: blur(8px); z-index: 12; white-space: nowrap;
        ${reduced ? '' : 'animation: badgePulse calc(2s / var(--ui-anim-speed)) ease-in-out infinite;'}
        opacity: var(--hud-opacity, 1);
      `;
      const uiLayer = document.getElementById('ui-layer');
      if (uiLayer) uiLayer.appendChild(this._threeFoulBadge);
    }
    this._threeFoulBadge.style.display = 'block';
    this._threeFoulBadge.textContent = UIText.threeFoulWarning;
  }

  hideThreeFoulWarning() {
    if (this._threeFoulBadge) {
      this._threeFoulBadge.style.display = 'none';
    }
  }

  destroy() {
    if (this._messageTimer) {
      clearTimeout(this._messageTimer);
      this._messageTimer = null;
    }
    if (this._pauseHideTimer) { clearTimeout(this._pauseHideTimer); this._pauseHideTimer = null; }
    if (this._pauseShowRaf) { cancelAnimationFrame(this._pauseShowRaf); this._pauseShowRaf = null; }
    if (this._fpsEl && this._fpsEl.parentNode) {
      this._fpsEl.parentNode.removeChild(this._fpsEl);
    }
    this._fpsEl = null;
    if (this._comboEl && this._comboEl.parentNode) {
      this._comboEl.parentNode.removeChild(this._comboEl);
    }
    this._comboEl = null;
    if (this._flashRaf) { cancelAnimationFrame(this._flashRaf); this._flashRaf = null; }
    if (this._flashTimer) {
      clearTimeout(this._flashTimer);
      this._flashTimer = null;
    }
    if (this._flashInnerTimer) {
      clearTimeout(this._flashInnerTimer);
      this._flashInnerTimer = null;
    }
    if (this._turnPulseRaf) { cancelAnimationFrame(this._turnPulseRaf); this._turnPulseRaf = null; }
    if (this._turnPulseTimer) { clearTimeout(this._turnPulseTimer); this._turnPulseTimer = null; }
    if (this._replayHintRaf) { cancelAnimationFrame(this._replayHintRaf); this._replayHintRaf = null; }
    if (this._confirmCloseTimer) { clearTimeout(this._confirmCloseTimer); this._confirmCloseTimer = null; }
    this._floatTimers.forEach(t => clearTimeout(t));
    this._floatTimers = [];
    const flash = document.getElementById('ui-red-flash');
    if (flash && flash.parentNode) flash.parentNode.removeChild(flash);
    const floats = document.querySelectorAll('.ui-float-text');
    floats.forEach(el => { if (el.parentNode) el.parentNode.removeChild(el); });
    for (const { el, type, fn } of this._aiListeners) {
      el.removeEventListener(type, fn);
    }
    this._aiListeners = [];

    if (this._pushOutBtn && this._pushOutBtn.parentNode) {
      this._pushOutBtn.onmouseenter = null;
      this._pushOutBtn.onmouseleave = null;
      this._pushOutBtn.onfocus = null;
      this._pushOutBtn.onblur = null;
      this._pushOutBtn.onclick = null;
      this._pushOutBtn.parentNode.removeChild(this._pushOutBtn);
    }
    this._pushOutBtn = null;
    if (this._replayHintHideTimer) {
      clearTimeout(this._replayHintHideTimer);
      this._replayHintHideTimer = null;
    }
    if (this._replayHintEl && this._replayHintEl.parentNode) {
      this._replayHintEl.onmouseenter = null;
      this._replayHintEl.onmouseleave = null;
      this._replayHintEl.onclick = null;
      this._replayHintEl.parentNode.removeChild(this._replayHintEl);
    }
    this._replayHintEl = null;
    if (this._pushOutChoiceWrap && this._pushOutChoiceWrap.parentNode) {
      this._pushOutChoiceWrap.parentNode.removeChild(this._pushOutChoiceWrap);
    }
    this._pushOutChoiceWrap = null;
    if (this._pushOutAcceptBtn) {
      this._pushOutAcceptBtn.onmouseenter = null;
      this._pushOutAcceptBtn.onmouseleave = null;
      this._pushOutAcceptBtn.onfocus = null;
      this._pushOutAcceptBtn.onblur = null;
      this._pushOutAcceptBtn.onclick = null;
      this._pushOutAcceptBtn = null;
    }
    if (this._pushOutPassBtn) {
      this._pushOutPassBtn.onmouseenter = null;
      this._pushOutPassBtn.onmouseleave = null;
      this._pushOutPassBtn.onfocus = null;
      this._pushOutPassBtn.onblur = null;
      this._pushOutPassBtn.onclick = null;
      this._pushOutPassBtn = null;
    }
    if (this._threeFoulBadge && this._threeFoulBadge.parentNode) {
      this._threeFoulBadge.parentNode.removeChild(this._threeFoulBadge);
    }
    this._threeFoulBadge = null;

    const crosshair = document.getElementById('crosshair');
    if (crosshair && crosshair.parentNode) crosshair.parentNode.removeChild(crosshair);
    // Note: we intentionally do NOT remove high-contrast / large-text / reduce-motion /
    // compact-hud classes here because they are global user preferences, not per-session state.

    // Reset static HUD elements so the next game session starts clean
    if (this.message) {
      this.message.textContent = '';
      this._lastMessage = '';
    }
    if (this.powerFill) this.powerFill.style.width = '0%';
    if (this.turnTimerEl) {
      this.turnTimerEl.style.display = 'none';
      this.turnTimerEl.classList.remove('warning', 'danger', 'top', 'bottom');
      this.turnTimerEl.textContent = '--';
    }
    if (this.player1Badge) {
      this.player1Badge.classList.remove('active');
      this.player1Badge.textContent = this._player1Name?.textContent || '玩家 1';
    }
    if (this.player2Badge) {
      this.player2Badge.classList.remove('active');
      this.player2Badge.textContent = this._player2Name?.textContent || '玩家 2';
    }
    const powerBar = document.getElementById('power-bar-container');
    if (powerBar) {
      powerBar.style.display = 'none';
      powerBar.style.opacity = '';
    }
    const versionTag = document.getElementById('version-tag');
    if (versionTag) versionTag.style.opacity = '';

    this._statsPanelRef = null;
    const confirmOverlay = this._confirmOverlay || document.getElementById('ui-confirm-dialog');
    if (confirmOverlay && confirmOverlay.parentNode) {
      confirmOverlay.onclick = null;
      confirmOverlay.querySelectorAll('button').forEach(btn => {
        btn.onmouseenter = null;
        btn.onmouseleave = null;
        btn.onclick = null;
      });
      confirmOverlay.parentNode.removeChild(confirmOverlay);
    }
    if (this._confirmKeyHandler) {
      document.removeEventListener('keydown', this._confirmKeyHandler);
      this._confirmKeyHandler = null;
    }
    this._confirmOverlay = null;
    this._player1Name = null;
    this._player2Name = null;
    this._player1Detail = null;
    this._player2Detail = null;
    this.player1Badge = null;
    this.player2Badge = null;
    this.message = null;
    this.powerFill = null;
    this.turnTimerEl = null;

    uiLayout.release('bottomHud');
    uiLayout.release('powerBar');
    uiLayout.release('turnTimer');
    uiLayout.release('topBar');
    if (this.bottomHud && this.bottomHud.parentNode) {
      this.bottomHud.parentNode.removeChild(this.bottomHud);
    }
    this.bottomHud = null;
    this._hudCenter = null;
    this._hudTimer = null;
    this._hudObjective = null;
    this._hudSpin = null;
    if (this._hudNewGameBtn) this._hudNewGameBtn.onclick = null;
    this._hudScore = null;
    if (this._hudSettingsBtn) { this._hudSettingsBtn.onclick = null; }
    if (this._hudConcedeBtn) { this._hudConcedeBtn.onclick = null; }
    if (this._hudBackBtn) { this._hudBackBtn.onclick = null; }
    this._hudNewGameBtn = null;
    this._hudConcedeBtn = null;
    this._hudSettingsBtn = null;
    this._hudBackBtn = null;
    if (this._updateButtonLabels) {
      window.removeEventListener('resize', this._updateButtonLabels);
      this._updateButtonLabels = null;
    }

    if (this.pauseOverlay) {
      this._pauseActions.forEach(btn => {
        btn.onmouseenter = null;
        btn.onmouseleave = null;
        btn.onfocus = null;
        btn.onblur = null;
        btn.onclick = null;
      });
      this._pauseActions = [];
      if (this.pauseOverlay.parentNode) this.pauseOverlay.parentNode.removeChild(this.pauseOverlay);
    }
    this.pauseOverlay = null;
    this._addPauseAction = null;

    this._lastMessage = null;
  }
}
