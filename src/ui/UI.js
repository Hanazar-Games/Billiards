import { settings } from '../core/SettingsStore.js';
import { animMs } from '../core/AnimSpeed.js';


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
      display: none; transition: background calc(0.2s / var(--ui-anim-speed));
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

    // Pause overlay (fullscreen dark backdrop)
    this.pauseOverlay = document.createElement('div');
    this.pauseOverlay.style.cssText = `
      position: fixed; inset: 0; z-index: 50;
      background: rgba(5,7,8,0.82);
      backdrop-filter: blur(12px);
      display: none; flex-direction: column;
      align-items: center; justify-content: center;
      opacity: 0; transition: opacity calc(0.3s / var(--ui-anim-speed)) ease;
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

    // ── In-Game Settings Overlay ──
    this.settingsOverlay = document.createElement('div');
    this.settingsOverlay.style.cssText = `
      position: fixed; inset: 0; z-index: 60;
      background: rgba(0,0,0,0.65);
      backdrop-filter: blur(8px);
      display: none; align-items: center; justify-content: center;
      opacity: 0; transition: opacity calc(0.3s / var(--ui-anim-speed)) ease;
    `;

    const settingsPanel = document.createElement('div');
    settingsPanel.style.cssText = `
      width: min(520px, 92vw); max-height: min(580px, 80vh);
      background: #161616;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 20px;
      display: flex; flex-direction: column;
      overflow: hidden;
      box-shadow: 0 40px 100px rgba(0,0,0,0.6);
    `;

    const settingsHeader = document.createElement('div');
    settingsHeader.style.cssText = `
      display: flex; align-items: center; gap: 14px;
      padding: 18px 20px 14px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      flex-shrink: 0;
    `;
    const settingsBack = document.createElement('button');
    settingsBack.textContent = '←';
    settingsBack.style.cssText = `
      width: 38px; height: 38px; border-radius: 8px;
      background: rgba(255,255,255,0.06); border: 1px solid var(--line);
      color: var(--text); font-size: 16px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: all calc(0.2s / var(--ui-anim-speed)) ease; flex-shrink: 0;
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
      font-size: 18px; font-weight: 700; color: #fff;
      letter-spacing: 0.5px;
    `;
    settingsHeader.appendChild(settingsTitle);
    settingsPanel.appendChild(settingsHeader);

    this._inGameSettingCards = [];

    // Scrollable content area
    const settingsContent = document.createElement('div');
    settingsContent.style.cssText = `
      flex: 1; overflow-y: auto;
      padding: 8px 20px 20px;
    `;

    // Helper: row item with label + control + divider
    const createCard = (title, subtitle, control) => {
      const card = document.createElement('div');
      card.style.cssText = `
        display: flex; justify-content: space-between; align-items: center;
        padding: 13px 0; border-bottom: 1px solid rgba(255,255,255,0.06);
        gap: 16px;
      `;
      const text = document.createElement('div');
      text.style.cssText = 'display:flex;flex-direction:column;gap:1px;min-width:0;';
      const t = document.createElement('div');
      t.textContent = title;
      t.style.cssText = 'font-size:14px;font-weight:600;color:rgba(255,255,255,0.85);white-space:nowrap;';
      text.appendChild(t);
      if (subtitle) {
        const s = document.createElement('div');
        s.textContent = subtitle;
        s.style.cssText = 'font-size:12px;color:rgba(255,255,255,0.4);';
        text.appendChild(s);
      }
      card.appendChild(text);
      card.appendChild(control);
      settingsContent.appendChild(card);
      this._inGameSettingCards.push(card);
      return card;
    };

    // Toggle helper — iOS style
    const createToggle = (checked, onChange) => {
      const wrap = document.createElement('label');
      wrap.style.cssText = 'position:relative;display:inline-block;width:48px;height:28px;flex-shrink:0;cursor:pointer;';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = checked;
      input.style.cssText = 'opacity:0;width:0;height:0;position:absolute;';
      const track = document.createElement('span');
      const knob = document.createElement('span');
      const update = () => {
        const on = input.checked;
        track.style.cssText = `
          position:absolute;inset:0;border-radius:999px;
          background:${on ? '#34c759' : 'rgba(255,255,255,0.14)'};
          transition:background calc(0.25s / var(--ui-anim-speed)) ease;
        `;
        knob.style.cssText = `
          position:absolute;top:2px;left:2px;
          width:24px;height:24px;border-radius:50%;
          background:#fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);
          transition:transform calc(0.25s / var(--ui-anim-speed)) cubic-bezier(0.2,0.8,0.2,1);
          transform:translateX(${on ? '20px' : '0'});
        `;
      };
      update();
      input.addEventListener('change', () => { update(); onChange(input.checked); });
      wrap.appendChild(input);
      wrap.appendChild(track);
      wrap.appendChild(knob);
      return { wrap, input };
    };

    // Slider helper — white-knob style
    const createSlider = (value, min, max, onChange) => {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;align-items:center;gap:14px;min-width:160px;flex-shrink:0;';
      const trackWrap = document.createElement('div');
      trackWrap.style.cssText = 'position:relative;flex:1;height:20px;display:flex;align-items:center;';
      const track = document.createElement('div');
      track.style.cssText = 'width:100%;height:4px;background:rgba(255,255,255,0.1);border-radius:999px;position:relative;';
      const fill = document.createElement('div');
      fill.style.cssText = 'height:100%;width:0%;background:rgba(255,255,255,0.5);border-radius:999px;transition:width calc(0.08s / var(--ui-anim-speed)) ease;';
      track.appendChild(fill);
      trackWrap.appendChild(track);

      const thumb = document.createElement('div');
      thumb.style.cssText = `
        position:absolute;top:50%;left:0%;
        width:16px;height:16px;border-radius:50%;background:#fff;
        box-shadow:0 2px 6px rgba(0,0,0,0.35);
        transform:translate(-50%,-50%);pointer-events:none;
        transition:left calc(0.08s / var(--ui-anim-speed)) ease;
      `;
      trackWrap.appendChild(thumb);

      const input = document.createElement('input');
      input.type = 'range';
      input.min = min; input.max = max; input.step = 1;
      input.value = value;
      input.style.cssText = 'position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;';
      const update = () => {
        const pct = ((input.value - min) / (max - min)) * 100;
        fill.style.width = `${pct}%`;
        thumb.style.left = `${pct}%`;
      };
      update();
      input.addEventListener('input', () => { update(); onChange(parseFloat(input.value)); });
      trackWrap.appendChild(input);

      const label = document.createElement('div');
      label.textContent = Math.round(input.value) + '%';
      label.style.cssText = 'font-size:13px;font-weight:600;color:rgba(255,255,255,0.5);min-width:40px;text-align:right;font-variant-numeric:tabular-nums;';
      input.addEventListener('input', () => { label.textContent = Math.round(input.value) + '%'; });

      wrap.appendChild(trackWrap);
      wrap.appendChild(label);
      return { wrap, input };
    };

    // Select helper — pill group
    const createSelect = (value, options, onChange) => {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;flex-shrink:0;';
      const btns = [];
      options.forEach(o => {
        const btn = document.createElement('button');
        btn.textContent = o.label;
        const active = o.value === value;
        btn.style.cssText = `
          padding:6px 14px;border-radius:999px;
          background:${active ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.05)'};
          border:1px solid ${active ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)'};
          color:${active ? '#fff' : 'rgba(255,255,255,0.55)'};
          font-size:12px;font-weight:600;cursor:pointer;
          transition:all calc(0.2s / var(--ui-anim-speed)) ease;
        `;
        btn.onmouseenter = () => { if (!btn.dataset.active) btn.style.background = 'rgba(255,255,255,0.1)'; };
        btn.onmouseleave = () => { if (!btn.dataset.active) btn.style.background = 'rgba(255,255,255,0.05)'; };
        btn.addEventListener('click', () => {
          btns.forEach(b => {
            b.dataset.active = '';
            b.style.background = 'rgba(255,255,255,0.05)';
            b.style.borderColor = 'rgba(255,255,255,0.1)';
            b.style.color = 'rgba(255,255,255,0.55)';
          });
          btn.dataset.active = 'true';
          btn.style.background = 'rgba(255,255,255,0.14)';
          btn.style.borderColor = 'rgba(255,255,255,0.2)';
          btn.style.color = '#fff';
          onChange(o.value);
        });
        btns.push(btn);
        wrap.appendChild(btn);
      });
      return { wrap };
    };

    this._inGameSettings = {
      createToggle, createSlider, createSelect, createCard,
    };

    settingsPanel.appendChild(settingsContent);
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
    if (this._pauseHideTimer) { clearTimeout(this._pauseHideTimer); this._pauseHideTimer = null; }
    this.pauseOverlay.style.display = 'flex';
    requestAnimationFrame(() => {
      this.pauseOverlay.style.opacity = '1';
    });
  }

  hidePauseMenu() {
    if (!this.pauseOverlay) return;
    this.pauseOverlay.style.opacity = '0';
    this._pauseHideTimer = setTimeout(() => {
      if (this.pauseOverlay) this.pauseOverlay.style.display = 'none';
      this._pauseHideTimer = null;
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
    const { wrap: volWrap } = s.createSlider(
      settings.get('masterVolume'), 0, 100,
      (v) => { settings.set('masterVolume', v); if (audioManager) audioManager.setMasterVolume(v); }
    );
    s.createCard('主音量', '整体输出音量', volWrap);

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
    const { wrap: qualWrap } = s.createSelect(
      settings.get('quality'),
      [{ value: 'low', label: '低' }, { value: 'medium', label: '中' }, { value: 'high', label: '高' }],
      (v) => settings.set('quality', v)
    );
    s.createCard('画质等级', '调整渲染质量以平衡性能', qualWrap);

    // Camera
    const { wrap: camWrap } = s.createSelect(
      settings.get('defaultCamera'),
      [{ value: 'free', label: '自由视角' }, { value: 'top', label: '俯视视角' }, { value: 'follow', label: '跟随视角' }],
      (v) => settings.set('defaultCamera', v)
    );
    s.createCard('默认视角', '进入游戏时的初始相机模式', camWrap);

    this._settingsBackBtn.onclick = () => this.hideInGameSettings();
    if (this._settingsHideTimer) { clearTimeout(this._settingsHideTimer); this._settingsHideTimer = null; }
    this.settingsOverlay.style.display = 'flex';
    requestAnimationFrame(() => {
      this.settingsOverlay.style.opacity = '1';
    });
  }

  hideInGameSettings() {
    if (!this.settingsOverlay) return;
    this.settingsOverlay.style.opacity = '0';
    this._settingsHideTimer = setTimeout(() => {
      if (this.settingsOverlay) this.settingsOverlay.style.display = 'none';
      this._settingsHideTimer = null;
    }, 300);
  }

  /**
   * Brief red flash overlay for foul/scratch feedback.
   */
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
      if (f) f.style.opacity = '0';
      this._flashTimer = null;
    }, animMs(350));
  }

  /**
   * Floating text that rises and fades — used for pocketed-ball feedback.
   */
  showFloatingText(text, screenX, screenY, color = '#d8b15f') {
    const uiLayer = document.getElementById('ui-layer');
    if (!uiLayer) return;
    const el = document.createElement('div');
    el.className = 'ui-float-text';
    el.textContent = text;
    el.style.cssText = `
      position: absolute; left: ${screenX}px; top: ${screenY}px;
      transform: translate(-50%, -50%);
      font-size: 18px; font-weight: 800; color: ${color};
      text-shadow: 0 2px 8px rgba(0,0,0,0.8);
      pointer-events: none; z-index: 10; white-space: nowrap;
      animation: floatTextUp calc(1.2s / var(--ui-anim-speed)) ease-out forwards;
    `;
    uiLayer.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, animMs(1200));
  }

  destroy() {
    if (this._messageTimer) {
      clearTimeout(this._messageTimer);
      this._messageTimer = null;
    }
    if (this._flashTimer) {
      clearTimeout(this._flashTimer);
      this._flashTimer = null;
    }
    const flash = document.getElementById('ui-red-flash');
    if (flash && flash.parentNode) flash.parentNode.removeChild(flash);
    const floats = document.querySelectorAll('.ui-float-text');
    floats.forEach(el => { if (el.parentNode) el.parentNode.removeChild(el); });
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
        inputs.forEach(i => {
          const clone = i.cloneNode(true);
          i.parentNode.replaceChild(clone, i);
        });
        const btns = c.querySelectorAll('button');
        btns.forEach(b => { b.onmouseenter = null; b.onmouseleave = null; b.onclick = null; });
      });
      this._inGameSettingCards = [];
      if (this.settingsOverlay.parentNode) this.settingsOverlay.parentNode.removeChild(this.settingsOverlay);
    }
    this.settingsOverlay = null;
    this._settingsBackBtn = null;
    this._inGameSettings = null;
  }
}
