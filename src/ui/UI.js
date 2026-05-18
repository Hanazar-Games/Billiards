import { settings } from '../core/SettingsStore.js';
import { animMs } from '../core/AnimSpeed.js';
import { UIText } from '../core/UIText.js';


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
    this._pauseHideTimer = null;
    this._floatTimers = [];
    this._lastTimerSec = null;
    this._lastTurnTimerSec = null;
    this._lastTurnTimerWarn = 'none';

    const uiLayer = document.getElementById('ui-layer');

    // ── Top-bar group labels removed: group info now shown only in bottom HUD ──

    // ── Bottom HUD ──
    this.bottomHud = document.createElement('div');
    this.bottomHud.id = 'bottom-hud';

    // Main info row
    const hudMain = document.createElement('div');
    hudMain.id = 'bottom-hud-main';

    // Player 1 side
    this._hudP1 = document.createElement('div');
    this._hudP1.className = 'hud-side hud-left';
    this._hudP1Name = document.createElement('div');
    this._hudP1Name.className = 'hud-name active';
    this._hudP1Name.textContent = '玩家 1';
    this._hudP1Detail = document.createElement('div');
    this._hudP1Detail.className = 'hud-detail';
    this._hudP1.appendChild(this._hudP1Name);
    this._hudP1.appendChild(this._hudP1Detail);
    hudMain.appendChild(this._hudP1);

    // Center: score + timer + objective
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
    this._hudCenter.appendChild(this._hudScore);
    this._hudCenter.appendChild(this._hudTimer);
    this._hudCenter.appendChild(this._hudObjective);
    hudMain.appendChild(this._hudCenter);

    // Player 2 side
    this._hudP2 = document.createElement('div');
    this._hudP2.className = 'hud-side hud-right';
    this._hudP2Name = document.createElement('div');
    this._hudP2Name.className = 'hud-name';
    this._hudP2Name.textContent = '玩家 2';
    this._hudP2Detail = document.createElement('div');
    this._hudP2Detail.className = 'hud-detail';
    this._hudP2.appendChild(this._hudP2Name);
    this._hudP2.appendChild(this._hudP2Detail);
    hudMain.appendChild(this._hudP2);

    this.bottomHud.appendChild(hudMain);

    // Action buttons row
    const hudActions = document.createElement('div');
    hudActions.id = 'bottom-hud-actions';

    this._hudNewGameBtn = document.createElement('button');
    this._hudNewGameBtn.className = 'hud-btn';
    this._hudNewGameBtn.textContent = '再来一局';
    this._hudNewGameBtn.style.display = 'none';
    hudActions.appendChild(this._hudNewGameBtn);

    this._hudConcedeBtn = document.createElement('button');
    this._hudConcedeBtn.className = 'hud-btn hud-btn-danger';
    this._hudConcedeBtn.textContent = '认输';
    hudActions.appendChild(this._hudConcedeBtn);

    this._hudSettingsBtn = document.createElement('button');
    this._hudSettingsBtn.className = 'hud-btn';
    this._hudSettingsBtn.textContent = '⚙️ 设置';
    hudActions.appendChild(this._hudSettingsBtn);

    this.bottomHud.appendChild(hudActions);

    if (uiLayer) uiLayer.appendChild(this.bottomHud);

    // ── Pause button (top-right gear) ──
    this.pauseBtn = document.createElement('button');
    this.pauseBtn.textContent = '⚙️';
    this.pauseBtn.style.cssText = `
      position: absolute; top: 18px; right: 24px;
      width: 40px; height: 40px; border-radius: 8px;
      background: rgba(12,15,18,0.72); border: 1px solid rgba(255,255,255,0.16);
      color: #fff; font-size: 18px; cursor: pointer; pointer-events: auto;
      display: flex; align-items: center; justify-content: center;
      backdrop-filter: blur(10px); z-index: 10;
      transition: all calc(0.2s / var(--ui-anim-speed)) ease; box-shadow: 0 8px 24px rgba(0,0,0,0.22);
    `;
    this.pauseBtn.onmouseenter = () => {
      this.pauseBtn.style.background = 'rgba(255,255,255,0.14)';
      this.pauseBtn.style.borderColor = 'rgba(255,255,255,0.35)';
      this.pauseBtn.style.transform = 'translateY(-1px)';
    };
    this.pauseBtn.onmouseleave = () => {
      this.pauseBtn.style.background = 'rgba(12,15,18,0.72)';
      this.pauseBtn.style.borderColor = 'rgba(255,255,255,0.16)';
      this.pauseBtn.style.transform = 'translateY(0)';
    };
    if (uiLayer) uiLayer.appendChild(this.pauseBtn);

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
      animation: panelIn calc(0.4s / var(--ui-anim-speed)) var(--ease) both;
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
      btn.onmouseenter = () => {
        btn.style.background = 'rgba(255,255,255,0.14)';
        btn.style.borderColor = 'var(--line-strong)';
        btn.style.transform = 'translateY(-1px)';
      };
      btn.onmouseleave = () => {
        btn.style.background = 'rgba(255,255,255,0.06)';
        btn.style.borderColor = 'var(--line)';
        btn.style.transform = 'translateY(0)';
      };
      btn.onclick = onClick;
      pausePanel.appendChild(btn);
      this._pauseActions.push(btn);
    };

    this._addPauseAction = addAction;

    this.pauseOverlay.appendChild(pausePanel);
    document.body.appendChild(this.pauseOverlay);

  }

  _addTrackedListener(el, type, fn) {
    el.addEventListener(type, fn);
    this._aiListeners.push({ el, type, fn });
  }

  // Kept for backward-compat; top-bar AI controls removed — settings overlay handles these now
  setupAIControls(onAIToggle, onDiffChange, onSoundToggle) {
    // No-op: controls moved to in-game settings panel
  }

  setPower(pct) {
    if (this.powerFill) {
      this.powerFill.style.width = Math.max(0, Math.min(100, pct)) + '%';
    }
  }

  setMessage(text, duration = 0) {
    if (this.message) {
      this.message.textContent = text;
      this._lastMessage = text;
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
          }
        }, duration * scale);
      }
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
    this._hudScore.textContent = `${n1} ${p1Score} : ${p2Score} ${n2}  ·  第 ${currentGame}/${gamesNeeded} 局`;
    this._hudScore.style.display = 'block';
  }

  updateTimer(elapsedMs) {
    if (!this._hudTimer) return;
    const totalSec = Math.floor(elapsedMs / 1000);
    if (this._lastTimerSec === totalSec) return;
    this._lastTimerSec = totalSec;
    const min = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const sec = String(totalSec % 60).padStart(2, '0');
    this._hudTimer.textContent = `${min}:${sec}`;
  }

  setTurnTimer(seconds, maxSeconds) {
    if (!this.turnTimerEl) return;
    if (maxSeconds <= 0) {
      this.turnTimerEl.style.display = 'none';
      this.turnTimerEl.classList.remove('warning', 'danger');
      this._lastTurnTimerSec = null;
      return;
    }
    const s = Math.max(0, Math.ceil(seconds));
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

  setPlayerStats({ p1Name, p1Group, p1Remaining, p2Name, p2Group, p2Remaining, mode }) {
    if (this._hudP1Name) this._hudP1Name.textContent = p1Name || '玩家 1';
    if (this._hudP2Name) this._hudP2Name.textContent = p2Name || '玩家 2';

    const groupLabel = (g) => {
      if (!g) return '';
      return g === 'solid' ? '● 全色' : '◯ 花色';
    };

    // 9-ball mode: show target ball instead of group
    const is9Ball = mode === '9ball';

    if (this._hudP1Detail) {
      const r1 = Number.isFinite(p1Remaining) ? p1Remaining : (is9Ball ? 9 : 7);
      const group1 = is9Ball ? '' : groupLabel(p1Group);
      this._hudP1Detail.innerHTML = group1
        ? `<span class="hud-group">${group1}</span><span class="hud-remain">剩 ${r1}</span>`
        : `<span class="hud-remain">剩 ${r1}</span>`;
    }
    if (this._hudP2Detail) {
      const r2 = Number.isFinite(p2Remaining) ? p2Remaining : (is9Ball ? 9 : 7);
      const group2 = is9Ball ? '' : groupLabel(p2Group);
      this._hudP2Detail.innerHTML = group2
        ? `<span class="hud-group">${group2}</span><span class="hud-remain">剩 ${r2}</span>`
        : `<span class="hud-remain">剩 ${r2}</span>`;
    }
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
    if (this._hudP1Name) {
      this._hudP1Name.classList.toggle('active', player === 1);
    }
    if (this._hudP2Name) {
      this._hudP2Name.classList.toggle('active', player === 2);
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
    if (this.pauseBtn) {
      this.pauseBtn.onclick = onPauseClick;
    }
    if (this._hudSettingsBtn) {
      this._hudSettingsBtn.onclick = onSettings;
    }
    this._pauseActions.forEach(btn => {
      btn.onmouseenter = null;
      btn.onmouseleave = null;
      btn.onclick = null;
      btn.remove();
    });
    this._pauseActions = [];

    this._addPauseAction('继续游戏', '', onResume);
    this._addPauseAction('设置', '', onSettings);
    this._addPauseAction('返回主菜单', 'color: #ff8a9a; border-color: rgba(185,18,63,0.35);', onQuit);
  }

  setupConcede(onConcede) {
    if (this._hudConcedeBtn) {
      this._hudConcedeBtn.onclick = onConcede;
    }
  }

  showPauseMenu() {
    if (!this.pauseOverlay) return;
    if (this._pauseHideTimer) { clearTimeout(this._pauseHideTimer); this._pauseHideTimer = null; }
    this.pauseOverlay.style.display = 'flex';
    requestAnimationFrame(() => {
      if (this.pauseOverlay) this.pauseOverlay.style.opacity = '1';
    });
  }

  hidePauseMenu() {
    if (!this.pauseOverlay) return;
    this.pauseOverlay.style.opacity = '0';
    if (this._pauseHideTimer) { clearTimeout(this._pauseHideTimer); }
    this._pauseHideTimer = setTimeout(() => {
      if (this.pauseOverlay) this.pauseOverlay.style.display = 'none';
      this._pauseHideTimer = null;
    }, animMs(300));
  }

  flashRed() {
    const uiLayer = document.getElementById('ui-layer');
    if (!uiLayer) return;
    let flash = document.getElementById('ui-red-flash');
    if (!flash) {
      flash = document.createElement('div');
      flash.id = 'ui-red-flash';
      flash.style.cssText = `
        position: absolute; inset: 0; pointer-events: none; z-index: 5;
        background: radial-gradient(circle at center, rgba(185,18,63,0.18) 0%, transparent 70%);
        opacity: 0; transition: opacity calc(0.25s / var(--ui-anim-speed)) ease;
      `;
      uiLayer.appendChild(flash);
    }
    flash.style.opacity = '1';
    if (this._flashTimer) clearTimeout(this._flashTimer);
    this._flashTimer = setTimeout(() => {
      const f = document.getElementById('ui-red-flash');
      if (f) {
        f.style.opacity = '0';
        // Remove from DOM after fade-out transition completes
        setTimeout(() => { if (f.parentNode) f.parentNode.removeChild(f); }, animMs(300));
      }
      this._flashTimer = null;
    }, animMs(350));
  }

  showFloatingText(text, screenX, screenY, color = '#d8b15f') {
    const uiLayer = document.getElementById('ui-layer');
    if (!uiLayer) return;
    const vw = window.innerWidth || 1;
    const vh = window.innerHeight || 1;
    const clampedX = Math.max(0, Math.min(vw, screenX));
    const clampedY = Math.max(0, Math.min(vh, screenY));
    const el = document.createElement('div');
    el.className = 'ui-float-text';
    el.textContent = text;
    el.style.cssText = `
      position: absolute; left: ${clampedX}px; top: ${clampedY}px;
      transform: translate(-50%, -50%);
      font-size: 18px; font-weight: 800; color: ${color};
      text-shadow: 0 2px 8px rgba(0,0,0,0.8);
      pointer-events: none; z-index: 10; white-space: nowrap;
      animation: floatTextUp calc(1.2s / var(--ui-anim-speed)) ease-out forwards;
    `;
    uiLayer.appendChild(el);
    const t = setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
      const idx = this._floatTimers.indexOf(t);
      if (idx !== -1) this._floatTimers.splice(idx, 1);
    }, animMs(1200));
    this._floatTimers.push(t);
  }

  // ── HUD visibility controls (wired from SettingsScreen) ──
  setHudScale(v) {
    if (this.bottomHud) {
      this.bottomHud.style.transform = `scale(${Math.max(0.5, Math.min(2.0, v))})`;
      this.bottomHud.style.transformOrigin = 'bottom center';
    }
  }

  setHudOpacity(v) {
    if (this.bottomHud) {
      this.bottomHud.style.opacity = String(Math.max(0.3, Math.min(1.0, v)));
    }
  }

  setHighContrastUI(v) {
    document.documentElement.classList.toggle('high-contrast', Boolean(v));
  }

  setLargeTextMode(v) {
    document.documentElement.classList.toggle('large-text', Boolean(v));
  }

  setReducedMotion(v) {
    document.documentElement.classList.toggle('reduce-motion', Boolean(v));
  }

  setShowFPS(v) {
    if (!this._fpsEl && v) {
      this._fpsEl = document.createElement('div');
      this._fpsEl.style.cssText = `
        position: absolute; top: 14px; left: 14px;
        font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.6);
        font-family: ui-monospace, SFMono-Regular, monospace;
        pointer-events: none; z-index: 10;
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
    if (this.powerFill) {
      const bar = this.powerFill.parentElement;
      if (bar) bar.style.display = v ? 'block' : 'none';
    }
  }

  setShowSpinIndicator(v) {
    const el = document.getElementById('spin-indicator');
    if (el) el.style.display = v ? 'block' : 'none';
  }

  setShowCrosshair(v) {
    const el = document.getElementById('crosshair');
    if (el) el.style.display = v ? 'block' : 'none';
  }

  setShowBallLabels(v) {
    // Ball labels are rendered by the 3D scene; toggled via global CSS or scene flag
    document.documentElement.style.setProperty('--ball-labels-visible', v ? '1' : '0');
  }

  setShowRemainingBalls(v) {
    if (this._hudObjective) this._hudObjective.style.display = v ? 'block' : 'none';
  }

  setShowComboCounter(v) {
    // Combo counter not yet implemented in HUD
  }

  setStatsPanelEnabled(v) {
    // Stats panel visibility is controlled by StatsPanel class
  }

  setTimerPosition(pos) {
    if (!this._hudTimer) return;
    this._hudTimer.style.position = 'relative';
    this._hudTimer.style.top = this._hudTimer.style.bottom = 'auto';
    if (pos === 'top') {
      this._hudTimer.style.marginBottom = '4px';
    } else if (pos === 'bottom') {
      this._hudTimer.style.marginTop = '4px';
    }
  }

  // ── Push-out UI ──

  showPushOutButton(onClick) {
    if (!this._pushOutBtn) {
      this._pushOutBtn = document.createElement('button');
      this._pushOutBtn.className = 'hud-btn hud-btn-accent';
      this._pushOutBtn.textContent = UIText.pushOutButton;
      this._pushOutBtn.style.cssText = `
        position: absolute; bottom: 96px; left: 50%; transform: translateX(-50%);
        padding: 10px 22px; font-size: 15px; font-weight: 800;
        background: rgba(212,167,44,0.18); border: 1px solid rgba(212,167,44,0.55);
        color: #f0d78c; border-radius: 10px; cursor: pointer; pointer-events: auto;
        backdrop-filter: blur(8px); z-index: 15;
        transition: all calc(0.2s / var(--ui-anim-speed)) ease;
      `;
      this._pushOutBtn.onmouseenter = () => {
        this._pushOutBtn.style.background = 'rgba(212,167,44,0.32)';
        this._pushOutBtn.style.transform = 'translateX(-50%) translateY(-1px)';
      };
      this._pushOutBtn.onmouseleave = () => {
        this._pushOutBtn.style.background = 'rgba(212,167,44,0.18)';
        this._pushOutBtn.style.transform = 'translateX(-50%) translateY(0)';
      };
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

  showPushOutChoice(onAccept, onPass) {
    if (!this._pushOutChoiceWrap) {
      this._pushOutChoiceWrap = document.createElement('div');
      this._pushOutChoiceWrap.style.cssText = `
        position: absolute; bottom: 96px; left: 50%; transform: translateX(-50%);
        display: flex; gap: 10px; align-items: center; z-index: 15;
        background: rgba(8,10,12,0.78); border: 1px solid rgba(255,255,255,0.12);
        border-radius: 12px; padding: 10px 16px; backdrop-filter: blur(10px);
        pointer-events: auto;
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
      this._pushOutAcceptBtn.onmouseenter = () => {
        this._pushOutAcceptBtn.style.background = 'rgba(44,167,112,0.32)';
      };
      this._pushOutAcceptBtn.onmouseleave = () => {
        this._pushOutAcceptBtn.style.background = 'rgba(44,167,112,0.18)';
      };
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
      this._pushOutPassBtn.onmouseenter = () => {
        this._pushOutPassBtn.style.background = 'rgba(185,96,44,0.32)';
      };
      this._pushOutPassBtn.onmouseleave = () => {
        this._pushOutPassBtn.style.background = 'rgba(185,96,44,0.18)';
      };
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
      this._threeFoulBadge = document.createElement('div');
      this._threeFoulBadge.style.cssText = `
        position: absolute; top: 64px; left: 50%; transform: translateX(-50%);
        padding: 8px 18px; font-size: 14px; font-weight: 800;
        background: rgba(185,18,63,0.22); border: 1px solid rgba(185,18,63,0.55);
        color: #ff8a9a; border-radius: 10px; pointer-events: none;
        backdrop-filter: blur(8px); z-index: 12; white-space: nowrap;
        animation: badgePulse 2s ease-in-out infinite;
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
    if (this._fpsEl && this._fpsEl.parentNode) {
      this._fpsEl.parentNode.removeChild(this._fpsEl);
    }
    this._fpsEl = null;
    if (this._flashTimer) {
      clearTimeout(this._flashTimer);
      this._flashTimer = null;
    }
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
      this._pushOutBtn.parentNode.removeChild(this._pushOutBtn);
    }
    this._pushOutBtn = null;
    if (this._pushOutChoiceWrap && this._pushOutChoiceWrap.parentNode) {
      this._pushOutChoiceWrap.parentNode.removeChild(this._pushOutChoiceWrap);
    }
    this._pushOutChoiceWrap = null;
    this._pushOutAcceptBtn = null;
    this._pushOutPassBtn = null;
    if (this._threeFoulBadge && this._threeFoulBadge.parentNode) {
      this._threeFoulBadge.parentNode.removeChild(this._threeFoulBadge);
    }
    this._threeFoulBadge = null;

    document.documentElement.style.setProperty("--ball-labels-visible", "0");
    document.documentElement.classList.remove("high-contrast", "large-text", "reduce-motion");
    this.player1Badge = null;
    this.player2Badge = null;
    this.message = null;
    this.powerFill = null;
    this.turnTimerEl = null;

    if (this.bottomHud && this.bottomHud.parentNode) {
      this.bottomHud.parentNode.removeChild(this.bottomHud);
    }
    this.bottomHud = null;
    this._hudP1 = null;
    this._hudP1Name = null;
    this._hudP1Detail = null;
    this._hudP2 = null;
    this._hudP2Name = null;
    this._hudP2Detail = null;
    this._hudCenter = null;
    this._hudTimer = null;
    this._hudObjective = null;
    if (this._hudNewGameBtn) this._hudNewGameBtn.onclick = null;
    this._hudScore = null;
    if (this._hudSettingsBtn) { this._hudSettingsBtn.onclick = null; }
    if (this._hudConcedeBtn) { this._hudConcedeBtn.onclick = null; }
    this._hudNewGameBtn = null;
    this._hudConcedeBtn = null;
    this._hudSettingsBtn = null;

    if (this.pauseBtn) {
      this.pauseBtn.onmouseenter = null;
      this.pauseBtn.onmouseleave = null;
      this.pauseBtn.onclick = null;
      if (this.pauseBtn.parentNode) this.pauseBtn.parentNode.removeChild(this.pauseBtn);
    }
    if (this.pauseOverlay) {
      this._pauseActions.forEach(btn => {
        btn.onmouseenter = null;
        btn.onmouseleave = null;
        btn.onclick = null;
      });
      this._pauseActions = [];
      if (this.pauseOverlay.parentNode) this.pauseOverlay.parentNode.removeChild(this.pauseOverlay);
    }
    this.pauseBtn = null;
    this.pauseOverlay = null;
    this._addPauseAction = null;

    this._lastMessage = null;
  }
}
