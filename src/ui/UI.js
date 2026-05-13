import { settings } from '../core/SettingsStore.js';

export class UI {
  constructor() {
    this.player1Badge = document.getElementById('player1');
    this.player2Badge = document.getElementById('player2');
    this.message = document.getElementById('message');
    this.powerFill = document.getElementById('power-bar-fill');
    this._messageTimer = null;
    this._messageId = 0; // monotonic counter to prevent stale timers clearing new messages
    this._aiListeners = []; // { el, type, fn }

    this.player1Group = document.createElement('div');
    this.player1Group.id = 'player1-group';
    this.player1Group.style.cssText = 'font-size:12px;opacity:0.8;margin-top:4px;';
    if (this.player1Badge) this.player1Badge.appendChild(this.player1Group);

    this.player2Group = document.createElement('div');
    this.player2Group.id = 'player2-group';
    this.player2Group.style.cssText = 'font-size:12px;opacity:0.8;margin-top:4px;';
    if (this.player2Badge) this.player2Badge.appendChild(this.player2Group);

    // Reset button
    this.resetBtn = document.createElement('button');
    this.resetBtn.textContent = 'New Game';
    this.resetBtn.style.cssText = `
      position: absolute; top: 70px; left: 50%; transform: translateX(-50%);
      padding: 9px 18px; font-size: 13px; font-weight: 750;
      background: rgba(18,20,23,0.62); color: #fff; border: 1px solid rgba(255,255,255,0.22);
      border-radius: 8px; cursor: pointer; pointer-events: auto; backdrop-filter: blur(10px);
      display: none; transition: background 0.2s;
      box-shadow: 0 10px 30px rgba(0,0,0,0.28);
    `;
    this.resetBtn.onmouseenter = () => this.resetBtn.style.background = 'rgba(255,255,255,0.18)';
    this.resetBtn.onmouseleave = () => this.resetBtn.style.background = 'rgba(18,20,23,0.62)';
    const uiLayer = document.getElementById('ui-layer');
    if (uiLayer) uiLayer.appendChild(this.resetBtn);

    // AI controls container
    this.aiPanel = document.createElement('div');
    this.aiPanel.style.cssText = `
      position: absolute; top: 122px; left: 50%; transform: translateX(-50%);
      display: flex; gap: 12px; align-items: center; flex-wrap: wrap;
      pointer-events: auto; background: rgba(10,12,15,0.58);
      padding: 9px 14px; border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.16);
      backdrop-filter: blur(12px);
      box-shadow: 0 12px 32px rgba(0,0,0,0.26);
    `;

    // AI toggle
    this.aiToggle = document.createElement('label');
    this.aiToggle.style.cssText = 'display:flex;align-items:center;gap:6px;color:#fff;font-size:13px;font-weight:600;cursor:pointer;';
    this.aiToggle.innerHTML = `
      <input type="checkbox" id="ai-toggle" style="cursor:pointer;">
      <span>vs AI</span>
    `;
    this.aiPanel.appendChild(this.aiToggle);

    // Difficulty select
    this.diffSelect = document.createElement('select');
    this.diffSelect.id = 'ai-difficulty';
    this.diffSelect.style.cssText = `
      background: rgba(255,255,255,0.1); color: #fff; border: 1px solid rgba(255,255,255,0.2);
      border-radius: 6px; padding: 4px 9px; font-size: 12px; cursor: pointer;
    `;
    this.diffSelect.innerHTML = `
      <option value="easy" style="background:#333;">Easy</option>
      <option value="normal" style="background:#333;" selected>Normal</option>
      <option value="hard" style="background:#333;">Hard</option>
    `;
    this.aiPanel.appendChild(this.diffSelect);

    // Trajectory toggle
    this.trajToggle = document.createElement('label');
    this.trajToggle.style.cssText = 'display:flex;align-items:center;gap:6px;color:#fff;font-size:13px;font-weight:600;cursor:pointer;margin-left:4px;';
    this.trajToggle.innerHTML = `
      <input type="checkbox" id="traj-toggle" checked style="cursor:pointer;">
      <span>Aim Line</span>
    `;
    this.aiPanel.appendChild(this.trajToggle);

    // Shot trail toggle
    this.trailToggle = document.createElement('label');
    this.trailToggle.style.cssText = 'display:flex;align-items:center;gap:6px;color:#fff;font-size:13px;font-weight:600;cursor:pointer;margin-left:4px;';
    this.trailToggle.innerHTML = `
      <input type="checkbox" id="trail-toggle" checked style="cursor:pointer;">
      <span>Trail</span>
    `;
    this.aiPanel.appendChild(this.trailToggle);

    // Sound toggle
    this.soundToggle = document.createElement('label');
    this.soundToggle.style.cssText = 'display:flex;align-items:center;gap:6px;color:#fff;font-size:13px;font-weight:600;cursor:pointer;margin-left:4px;border-left:1px solid rgba(255,255,255,0.18);padding-left:12px;';
    this.soundToggle.innerHTML = `
      <input type="checkbox" id="sound-toggle" style="cursor:pointer;">
      <span>Sound</span>
    `;
    this.aiPanel.appendChild(this.soundToggle);

    if (uiLayer) uiLayer.appendChild(this.aiPanel);

    // Pause button (top-right gear)
    this.pauseBtn = document.createElement('button');
    this.pauseBtn.textContent = '⚙️';
    this.pauseBtn.style.cssText = `
      position: absolute; top: 18px; right: 24px;
      width: 40px; height: 40px; border-radius: 8px;
      background: rgba(12,15,18,0.72); border: 1px solid rgba(255,255,255,0.16);
      color: #fff; font-size: 18px; cursor: pointer; pointer-events: auto;
      display: flex; align-items: center; justify-content: center;
      backdrop-filter: blur(10px); z-index: 10;
      transition: all 0.2s ease; box-shadow: 0 8px 24px rgba(0,0,0,0.22);
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

    // Pause overlay (fullscreen dark backdrop)
    this.pauseOverlay = document.createElement('div');
    this.pauseOverlay.style.cssText = `
      position: fixed; inset: 0; z-index: 50;
      background: rgba(5,7,8,0.82);
      backdrop-filter: blur(12px);
      display: none; flex-direction: column;
      align-items: center; justify-content: center;
      opacity: 0; transition: opacity 0.3s ease;
    `;

    // Pause menu panel
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
      animation: panelIn 0.4s var(--ease) both;
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
        transition: all 0.2s ease;
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

    // ── In-Game Settings Overlay ──
    this.settingsOverlay = document.createElement('div');
    this.settingsOverlay.style.cssText = `
      position: fixed; inset: 0; z-index: 60;
      background: rgba(5,7,8,0.88);
      backdrop-filter: blur(16px);
      display: none; flex-direction: column;
      align-items: center; justify-content: flex-start;
      opacity: 0; transition: opacity 0.3s ease;
      overflow-y: auto; padding: 40px 24px;
    `;

    const settingsPanel = document.createElement('div');
    settingsPanel.style.cssText = `
      width: min(520px, 100%);
      display: flex; flex-direction: column; gap: 16px;
    `;

    const settingsHeader = document.createElement('div');
    settingsHeader.style.cssText = `
      display: flex; align-items: center; gap: 14px;
      margin-bottom: 4px;
    `;
    const settingsBack = document.createElement('button');
    settingsBack.textContent = '←';
    settingsBack.style.cssText = `
      width: 38px; height: 38px; border-radius: 8px;
      background: rgba(255,255,255,0.06); border: 1px solid var(--line);
      color: var(--text); font-size: 16px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.2s ease; flex-shrink: 0;
    `;
    settingsBack.onmouseenter = () => {
      settingsBack.style.background = 'rgba(255,255,255,0.12)';
      settingsBack.style.borderColor = 'var(--line-strong)';
    };
    settingsBack.onmouseleave = () => {
      settingsBack.style.background = 'rgba(255,255,255,0.06)';
      settingsBack.style.borderColor = 'var(--line)';
    };
    this._settingsBackBtn = settingsBack;
    settingsHeader.appendChild(settingsBack);

    const settingsTitle = document.createElement('div');
    settingsTitle.textContent = '设置';
    settingsTitle.style.cssText = `
      font-size: 20px; font-weight: 800; color: var(--text);
      letter-spacing: 2px;
    `;
    settingsHeader.appendChild(settingsTitle);
    settingsPanel.appendChild(settingsHeader);

    this._inGameSettingCards = [];

    // Helper: create a compact card
    const createCard = (title, subtitle, control) => {
      const card = document.createElement('div');
      card.style.cssText = `
        background: var(--panel-strong);
        border: 1px solid var(--line);
        border-radius: 10px;
        padding: 16px 20px;
        display: flex; justify-content: space-between; align-items: center;
        box-shadow: 0 8px 28px rgba(0,0,0,0.22);
        backdrop-filter: blur(12px);
      `;
      const text = document.createElement('div');
      text.style.cssText = 'display:flex;flex-direction:column;gap:2px;';
      const t = document.createElement('div');
      t.textContent = title;
      t.style.cssText = 'font-size:14px;font-weight:750;color:var(--text);';
      text.appendChild(t);
      if (subtitle) {
        const s = document.createElement('div');
        s.textContent = subtitle;
        s.style.cssText = 'font-size:12px;color:var(--muted);';
        text.appendChild(s);
      }
      card.appendChild(text);
      card.appendChild(control);
      settingsPanel.appendChild(card);
      this._inGameSettingCards.push(card);
      return card;
    };

    // Toggle helper
    const createToggle = (checked, onChange) => {
      const wrap = document.createElement('label');
      wrap.style.cssText = 'position:relative;display:inline-block;width:44px;height:24px;flex-shrink:0;cursor:pointer;';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = checked;
      input.style.cssText = 'opacity:0;width:0;height:0;';
      const slider = document.createElement('span');
      slider.style.cssText = `
        position:absolute;cursor:pointer;inset:0;
        background:rgba(255,255,255,0.12);border-radius:999px;
        transition:background 0.25s ease;border:1px solid rgba(255,255,255,0.1);
      `;
      const knob = document.createElement('span');
      knob.style.cssText = `
        position:absolute;height:20px;width:20px;left:2px;bottom:2px;
        background:#fff;border-radius:50%;
        transition:transform 0.25s var(--ease);
        box-shadow:0 2px 6px rgba(0,0,0,0.3);
      `;
      slider.appendChild(knob);
      const update = () => {
        const on = input.checked;
        slider.style.background = on ? 'var(--felt-bright)' : 'rgba(255,255,255,0.12)';
        slider.style.borderColor = on ? 'rgba(24,164,106,0.5)' : 'rgba(255,255,255,0.1)';
        knob.style.transform = on ? 'translateX(20px)' : 'translateX(0)';
      };
      update();
      input.addEventListener('change', () => { update(); onChange(input.checked); });
      wrap.appendChild(input);
      wrap.appendChild(slider);
      return { wrap, input };
    };

    // Slider helper
    const createSlider = (value, min, max, onChange) => {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;align-items:center;gap:10px;min-width:140px;flex-shrink:0;';
      const trackWrap = document.createElement('div');
      trackWrap.style.cssText = 'position:relative;flex:1;height:24px;display:flex;align-items:center;';
      const track = document.createElement('div');
      track.style.cssText = 'width:100%;height:4px;background:rgba(255,255,255,0.1);border-radius:999px;position:relative;overflow:hidden;';
      const fill = document.createElement('div');
      fill.style.cssText = 'height:100%;width:0%;background:linear-gradient(90deg,var(--felt-bright),var(--gold));border-radius:999px;transition:width 0.1s ease;';
      track.appendChild(fill);
      trackWrap.appendChild(track);

      const input = document.createElement('input');
      input.type = 'range';
      input.min = min; input.max = max; input.step = 1;
      input.value = value;
      input.style.cssText = 'position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;';
      const updateFill = () => {
        fill.style.width = `${((input.value - min) / (max - min)) * 100}%`;
      };
      updateFill();
      input.addEventListener('input', () => { updateFill(); onChange(parseFloat(input.value)); });
      trackWrap.appendChild(input);

      const label = document.createElement('div');
      label.textContent = Math.round(input.value) + '%';
      label.style.cssText = 'font-size:12px;font-weight:700;color:var(--text);min-width:36px;text-align:right;font-variant-numeric:tabular-nums;';
      input.addEventListener('input', () => { label.textContent = Math.round(input.value) + '%'; });

      wrap.appendChild(trackWrap);
      wrap.appendChild(label);
      return { wrap, input };
    };

    // Select helper
    const createSelect = (value, options, onChange) => {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:relative;flex-shrink:0;';
      const select = document.createElement('select');
      select.style.cssText = 'appearance:none;-webkit-appearance:none;background:rgba(255,255,255,0.06);border:1px solid var(--line);border-radius:8px;padding:7px 28px 7px 12px;color:var(--text);font-size:13px;font-weight:650;cursor:pointer;min-width:110px;transition:all 0.2s ease;';
      select.onmouseenter = () => { select.style.background = 'rgba(255,255,255,0.1)'; select.style.borderColor = 'var(--line-strong)'; };
      select.onmouseleave = () => { select.style.background = 'rgba(255,255,255,0.06)'; select.style.borderColor = 'var(--line)'; };
      options.forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.value; opt.textContent = o.label;
        opt.style.cssText = 'background:#1a1e22;color:#f4f7f4;';
        select.appendChild(opt);
      });
      select.value = value;
      select.addEventListener('change', () => onChange(select.value));
      const arrow = document.createElement('span');
      arrow.textContent = '▼';
      arrow.style.cssText = 'position:absolute;right:9px;top:50%;transform:translateY(-50%);font-size:10px;color:var(--muted);pointer-events:none;';
      wrap.appendChild(select);
      wrap.appendChild(arrow);
      return { wrap, select };
    };

    this._inGameSettings = {
      createToggle, createSlider, createSelect, createCard,
    };

    this.settingsOverlay.appendChild(settingsPanel);
    document.body.appendChild(this.settingsOverlay);
  }

  _addTrackedListener(el, type, fn) {
    el.addEventListener(type, fn);
    this._aiListeners.push({ el, type, fn });
  }

  setupAIControls(onAIToggle, onDiffChange, onSoundToggle) {
    const checkbox = this.aiToggle.querySelector('input');
    const onAIChange = (e) => {
      const enabled = e.target.checked;
      onAIToggle(enabled);
      this.diffSelect.disabled = !enabled;
      this.diffSelect.style.opacity = enabled ? '1' : '0.4';
      if (this.player2Badge) {
        this.player2Badge.childNodes[0].textContent = enabled ? 'AI' : 'Player 2';
      }
    };
    this._addTrackedListener(checkbox, 'change', onAIChange);

    const onDiff = (e) => onDiffChange(e.target.value);
    this._addTrackedListener(this.diffSelect, 'change', onDiff);

    const trajCheckbox = this.trajToggle.querySelector('input');
    const onTraj = (e) => window.dispatchEvent(new CustomEvent('toggleTrajectory', { detail: e.target.checked }));
    this._addTrackedListener(trajCheckbox, 'change', onTraj);

    const trailCheckbox = this.trailToggle.querySelector('input');
    const onTrail = (e) => window.dispatchEvent(new CustomEvent('toggleShotTrail', { detail: e.target.checked }));
    this._addTrackedListener(trailCheckbox, 'change', onTrail);

    const soundCheckbox = this.soundToggle.querySelector('input');
    const onSound = (e) => { if (onSoundToggle) onSoundToggle(e.target.checked); };
    this._addTrackedListener(soundCheckbox, 'change', onSound);
  }

  setPower(pct) {
    if (this.powerFill) {
      this.powerFill.style.width = Math.max(0, Math.min(100, pct)) + '%';
    }
  }

  setMessage(text, duration = 0) {
    if (this.message) {
      this.message.textContent = text;
      this._messageId++;
      const id = this._messageId;
      if (this._messageTimer) {
        clearTimeout(this._messageTimer);
        this._messageTimer = null;
      }
      if (duration > 0) {
        this._messageTimer = setTimeout(() => {
          this._messageTimer = null;
          if (this.message && this._messageId === id) {
            this.message.textContent = '';
          }
        }, duration);
      }
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
  }

  setPlayerGroups(p1Group, p2Group) {
    if (p1Group) {
      this.player1Group.textContent = p1Group === 'solid' ? '● Solids' : '◯ Stripes';
    } else {
      this.player1Group.textContent = '';
    }
    if (p2Group) {
      this.player2Group.textContent = p2Group === 'solid' ? '● Solids' : '◯ Stripes';
    } else {
      this.player2Group.textContent = '';
    }
  }

  showResetButton(onClick) {
    this.resetBtn.style.display = 'block';
    this.resetBtn.onclick = onClick;
  }

  hideResetButton() {
    this.resetBtn.style.display = 'none';
    this.resetBtn.onclick = null;
  }

  setupPauseControls(onPauseClick, onResume, onSettings, onQuit) {
    if (this.pauseBtn) {
      this.pauseBtn.onclick = onPauseClick;
    }
    // Clear old actions
    this._pauseActions.forEach(btn => btn.remove());
    this._pauseActions = [];

    this._addPauseAction('继续游戏', '', onResume);
    this._addPauseAction('设置', '', onSettings);
    this._addPauseAction('返回主菜单', 'color: #ff8a9a; border-color: rgba(185,18,63,0.35);', onQuit);
  }

  showPauseMenu() {
    if (!this.pauseOverlay) return;
    this.pauseOverlay.style.display = 'flex';
    requestAnimationFrame(() => {
      this.pauseOverlay.style.opacity = '1';
    });
  }

  hidePauseMenu() {
    if (!this.pauseOverlay) return;
    this.pauseOverlay.style.opacity = '0';
    setTimeout(() => {
      if (this.pauseOverlay) this.pauseOverlay.style.display = 'none';
    }, 300);
  }

  showInGameSettings(audioManager) {
    if (!this.settingsOverlay) return;
    // Rebuild cards to sync current values
    const s = this._inGameSettings;
    // Clear old cards except header/back button
    this._inGameSettingCards.forEach(c => c.remove());
    this._inGameSettingCards = [];

    // Sound toggle
    const { input: soundInput } = s.createToggle(
      settings.get('soundEnabled'),
      (v) => {
        settings.set('soundEnabled', v);
        if (audioManager) audioManager.toggleSound(v);
      }
    );
    s.createCard('音效', '开启或关闭所有游戏音效', soundInput.parentElement);

    // Master volume
    const { input: volInput } = s.createSlider(
      settings.get('masterVolume'), 0, 100,
      (v) => { settings.set('masterVolume', v); if (audioManager) audioManager.setMasterVolume(v); }
    );
    s.createCard('主音量', '整体输出音量', volInput.parentElement);

    // Trajectory
    const { input: trajInput } = s.createToggle(
      settings.get('trajectoryEnabled'),
      (v) => {
        settings.set('trajectoryEnabled', v);
        window.dispatchEvent(new CustomEvent('toggleTrajectory', { detail: v }));
      }
    );
    s.createCard('轨迹预测线', '显示白球击球后的运动轨迹', trajInput.parentElement);

    // Shot trails
    const { input: trailInput } = s.createToggle(
      settings.get('shotTrailsEnabled'),
      (v) => {
        settings.set('shotTrailsEnabled', v);
        window.dispatchEvent(new CustomEvent('toggleShotTrail', { detail: v }));
      }
    );
    s.createCard('击球拖尾', '球运动时的尾迹效果', trailInput.parentElement);

    // Particles
    const { input: partInput } = s.createToggle(
      settings.get('particlesEnabled'),
      (v) => settings.set('particlesEnabled', v)
    );
    s.createCard('粒子效果', '击球火花与进球喷泉特效', partInput.parentElement);

    // Quality
    const { select: qualSelect } = s.createSelect(
      settings.get('quality'),
      [{ value: 'low', label: '低' }, { value: 'medium', label: '中' }, { value: 'high', label: '高' }],
      (v) => settings.set('quality', v)
    );
    s.createCard('画质等级', '调整渲染质量以平衡性能', qualSelect.parentElement);

    // Camera
    const { select: camSelect } = s.createSelect(
      settings.get('defaultCamera'),
      [{ value: 'free', label: '自由视角' }, { value: 'top', label: '俯视视角' }, { value: 'follow', label: '跟随视角' }],
      (v) => settings.set('defaultCamera', v)
    );
    s.createCard('默认视角', '进入游戏时的初始相机模式', camSelect.parentElement);

    this._settingsBackBtn.onclick = () => this.hideInGameSettings();
    this.settingsOverlay.style.display = 'flex';
    requestAnimationFrame(() => {
      this.settingsOverlay.style.opacity = '1';
    });
  }

  hideInGameSettings() {
    if (!this.settingsOverlay) return;
    this.settingsOverlay.style.opacity = '0';
    setTimeout(() => {
      if (this.settingsOverlay) this.settingsOverlay.style.display = 'none';
    }, 300);
  }

  destroy() {
    if (this._messageTimer) {
      clearTimeout(this._messageTimer);
      this._messageTimer = null;
    }
    // Remove all tracked event listeners
    for (const { el, type, fn } of this._aiListeners) {
      el.removeEventListener(type, fn);
    }
    this._aiListeners = [];

    if (this.player1Group && this.player1Group.parentNode) {
      this.player1Group.parentNode.removeChild(this.player1Group);
    }
    if (this.player2Group && this.player2Group.parentNode) {
      this.player2Group.parentNode.removeChild(this.player2Group);
    }
    if (this.resetBtn) {
      this.resetBtn.onmouseenter = null;
      this.resetBtn.onmouseleave = null;
      this.resetBtn.onclick = null;
      if (this.resetBtn.parentNode) this.resetBtn.parentNode.removeChild(this.resetBtn);
    }
    if (this.aiPanel && this.aiPanel.parentNode) {
      this.aiPanel.parentNode.removeChild(this.aiPanel);
    }
    this.player1Badge = null;
    this.player2Badge = null;
    this.message = null;
    this.powerFill = null;
    this.player1Group = null;
    this.player2Group = null;
    this.resetBtn = null;
    this.aiPanel = null;
    this.aiToggle = null;
    this.diffSelect = null;
    this.trajToggle = null;
    this.trailToggle = null;
    this.soundToggle = null;

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

    if (this.settingsOverlay) {
      if (this._settingsBackBtn) {
        this._settingsBackBtn.onmouseenter = null;
        this._settingsBackBtn.onmouseleave = null;
        this._settingsBackBtn.onclick = null;
      }
      this._inGameSettingCards.forEach(c => {
        const inputs = c.querySelectorAll('input, select');
        inputs.forEach(i => { i.onchange = null; i.oninput = null; });
      });
      this._inGameSettingCards = [];
      if (this.settingsOverlay.parentNode) this.settingsOverlay.parentNode.removeChild(this.settingsOverlay);
    }
    this.settingsOverlay = null;
    this._settingsBackBtn = null;
    this._inGameSettings = null;
  }
}
