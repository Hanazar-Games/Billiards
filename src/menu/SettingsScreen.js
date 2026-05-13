/**
 * SettingsScreen — Full-featured settings overlay inspired by hanazargames.com.
 *
 * Layout: sidebar (category tabs) + content area (cards with controls).
 * Categories: Audio, Graphics, Gameplay, Controls, General.
 */
import { settings } from '../core/SettingsStore.js';

const CATEGORIES = [
  { id: 'audio',     label: '音频',     icon: '🔊' },
  { id: 'graphics',  label: '图形',     icon: '🎨' },
  { id: 'gameplay',  label: '游戏',     icon: '🎱' },
  { id: 'controls',  label: '控制',     icon: '🎮' },
  { id: 'general',   label: '通用',     icon: '⚙️' },
];

const QUALITY_OPTIONS = [
  { value: 'low',    label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high',   label: '高' },
];

const CAMERA_OPTIONS = [
  { value: 'free',   label: '自由视角' },
  { value: 'top',    label: '俯视视角' },
  { value: 'follow', label: '跟随视角' },
];

export class SettingsScreen {
  constructor(onBack) {
    this.onBack = onBack;
    this.audio = null;
    this.container = null;
    this._listeners = [];
    this._currentCategory = 'audio';
    this._buildUI();
  }

  setAudioManager(audioManager) {
    this.audio = audioManager;
    if (this.audio) {
      this.audio.toggleSound(settings.get('soundEnabled'));
      this.audio.setMasterVolume(settings.get('masterVolume'));
      this.audio.setMusicVolume(settings.get('musicVolume'));
      this.audio.setSFXVolume(settings.get('sfxVolume'));
    }
    this._syncAllControls();
  }

  _buildUI() {
    const layer = document.getElementById('menu-layer');
    if (!layer) return;

    this.container = document.createElement('div');
    this.container.id = 'settings-screen';
    this.container.style.cssText = `
      display: none;
      width: 100%; height: 100%;
      position: relative; z-index: 2;
      transition: opacity 0.35s ease, transform 0.35s var(--ease);
    `;

    // ── Header ──
    const header = document.createElement('div');
    header.style.cssText = `
      position: absolute; top: 0; left: 0; right: 0;
      height: 64px; display: flex; align-items: center;
      padding: 0 32px; gap: 16px;
      border-bottom: 1px solid var(--line);
      background: linear-gradient(180deg, rgba(12,15,18,0.92) 0%, rgba(12,15,18,0.72) 100%);
      backdrop-filter: blur(14px);
      z-index: 3;
    `;

    const backBtn = document.createElement('button');
    backBtn.textContent = '←';
    backBtn.style.cssText = `
      width: 40px; height: 40px; border-radius: 8px;
      background: rgba(255,255,255,0.06); border: 1px solid var(--line);
      color: var(--text); font-size: 18px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.2s ease; flex-shrink: 0;
    `;
    backBtn.onmouseenter = () => {
      backBtn.style.background = 'rgba(255,255,255,0.12)';
      backBtn.style.borderColor = 'var(--line-strong)';
    };
    backBtn.onmouseleave = () => {
      backBtn.style.background = 'rgba(255,255,255,0.06)';
      backBtn.style.borderColor = 'var(--line)';
    };
    backBtn.onclick = () => {
      this.hide();
      if (this.onBack) this.onBack();
    };
    header.appendChild(backBtn);

    const title = document.createElement('div');
    title.textContent = '设置';
    title.style.cssText = `
      font-size: 20px; font-weight: 800; color: var(--text);
      letter-spacing: 2px; flex: 1;
    `;
    header.appendChild(title);
    this.container.appendChild(header);

    // ── Body: Sidebar + Content ──
    const body = document.createElement('div');
    body.style.cssText = `
      display: flex; width: 100%; height: 100%;
      padding-top: 64px; box-sizing: border-box;
    `;

    // Sidebar
    const sidebar = document.createElement('div');
    sidebar.style.cssText = `
      width: 220px; flex-shrink: 0;
      border-right: 1px solid var(--line);
      background: rgba(10,12,14,0.6);
      display: flex; flex-direction: column;
      padding: 20px 12px; gap: 4px;
      overflow-y: auto;
    `;
    this._tabEls = new Map();
    CATEGORIES.forEach((cat, idx) => {
      const tab = document.createElement('button');
      tab.style.cssText = `
        display: flex; align-items: center; gap: 12px;
        padding: 12px 16px; border-radius: 8px;
        background: transparent; border: none;
        color: var(--muted); font-size: 14px; font-weight: 650;
        cursor: pointer; text-align: left;
        transition: all 0.2s ease;
        opacity: 0; transform: translateX(-8px);
        animation: settingsTabIn 0.35s var(--ease) ${0.05 + idx * 0.04}s forwards;
      `;
      tab.innerHTML = `<span style="font-size:18px;width:24px;text-align:center;flex-shrink:0;">${cat.icon}</span><span>${cat.label}</span>`;
      tab.onclick = () => this._switchCategory(cat.id);
      this._tabEls.set(cat.id, tab);
      sidebar.appendChild(tab);
    });
    body.appendChild(sidebar);

    // Content area
    this._contentArea = document.createElement('div');
    this._contentArea.style.cssText = `
      flex: 1; overflow-y: auto;
      padding: 28px 36px 48px;
      display: flex; flex-direction: column;
      gap: 20px;
    `;
    body.appendChild(this._contentArea);

    this.container.appendChild(body);
    layer.appendChild(this.container);

    this._switchCategory('audio');
  }

  _switchCategory(id) {
    this._currentCategory = id;
    // Update tab styles
    this._tabEls.forEach((el, catId) => {
      const active = catId === id;
      el.style.background = active ? 'rgba(24,164,106,0.18)' : 'transparent';
      el.style.color = active ? '#f4f7f4' : 'var(--muted)';
      el.style.borderLeft = active ? '3px solid var(--felt-bright)' : '3px solid transparent';
      el.style.paddingLeft = active ? '13px' : '16px';
    });

    // Build content
    this._contentArea.innerHTML = '';
    const cat = CATEGORIES.find(c => c.id === id);
    if (!cat) return;

    const sectionTitle = document.createElement('div');
    sectionTitle.textContent = cat.label;
    sectionTitle.style.cssText = `
      font-size: 26px; font-weight: 800; color: var(--text);
      margin-bottom: 4px; letter-spacing: 1px;
      opacity: 0; transform: translateY(6px);
      animation: settingsCardIn 0.4s var(--ease) 0.02s forwards;
    `;
    this._contentArea.appendChild(sectionTitle);

    const sectionDesc = document.createElement('div');
    const descMap = {
      audio: '调整音效、音乐与音量的平衡',
      graphics: '控制画面质量与视觉特效',
      gameplay: '游戏规则与视角偏好',
      controls: '鼠标与输入灵敏度',
      general: '语言与其他通用选项',
    };
    sectionDesc.textContent = descMap[id];
    sectionDesc.style.cssText = `
      font-size: 13px; color: var(--muted);
      margin-bottom: 16px; letter-spacing: 0.5px;
      opacity: 0; transform: translateY(6px);
      animation: settingsCardIn 0.4s var(--ease) 0.06s forwards;
    `;
    this._contentArea.appendChild(sectionDesc);

    const cards = this._buildCardsForCategory(id);
    cards.forEach((card, idx) => {
      card.style.animationDelay = `${0.1 + idx * 0.06}s`;
      this._contentArea.appendChild(card);
    });
  }

  _buildCardsForCategory(id) {
    switch (id) {
      case 'audio': return this._buildAudioCards();
      case 'graphics': return this._buildGraphicsCards();
      case 'gameplay': return this._buildGameplayCards();
      case 'controls': return this._buildControlsCards();
      case 'general': return this._buildGeneralCards();
      default: return [];
    }
  }

  _buildAudioCards() {
    const cards = [];

    // Master toggle
    cards.push(this._createCard('音效总开关', '开启或关闭所有游戏音效', [
      this._createToggle('soundEnabled', (val) => {
        settings.set('soundEnabled', val);
        if (this.audio) this.audio.toggleSound(val);
      }),
    ]));

    // Volume sliders
    cards.push(this._createCard('主音量', '控制整体输出音量', [
      this._createSlider('masterVolume', 0, 100, 1, (val) => {
        settings.set('masterVolume', val);
        if (this.audio) this.audio.setMasterVolume(val);
      }),
    ]));

    cards.push(this._createCard('音乐音量', '背景环境音的音量', [
      this._createSlider('musicVolume', 0, 100, 1, (val) => {
        settings.set('musicVolume', val);
        if (this.audio) this.audio.setMusicVolume(val);
      }),
    ]));

    cards.push(this._createCard('音效音量', '击球、碰撞、进球等音效', [
      this._createSlider('sfxVolume', 0, 100, 1, (val) => {
        settings.set('sfxVolume', val);
        if (this.audio) this.audio.setSFXVolume(val);
      }),
    ]));

    return cards;
  }

  _buildGraphicsCards() {
    const cards = [];

    cards.push(this._createCard('轨迹预测线', '显示白球击球后的运动轨迹', [
      this._createToggle('trajectoryEnabled', (val) => {
        settings.set('trajectoryEnabled', val);
        window.dispatchEvent(new CustomEvent('toggleTrajectory', { detail: val }));
      }),
    ]));

    cards.push(this._createCard('粒子效果', '击球火花与进球喷泉特效', [
      this._createToggle('particlesEnabled', (val) => {
        settings.set('particlesEnabled', val);
      }),
    ]));

    cards.push(this._createCard('击球拖尾', '球运动时的尾迹效果', [
      this._createToggle('shotTrailsEnabled', (val) => {
        settings.set('shotTrailsEnabled', val);
        window.dispatchEvent(new CustomEvent('toggleShotTrail', { detail: val }));
      }),
    ]));

    cards.push(this._createCard('画质等级', '调整渲染质量以平衡性能', [
      this._createSelect('quality', QUALITY_OPTIONS, (val) => {
        settings.set('quality', val);
      }),
    ]));

    return cards;
  }

  _buildGameplayCards() {
    const cards = [];

    cards.push(this._createCard('默认视角', '进入游戏时使用的初始相机模式', [
      this._createSelect('defaultCamera', CAMERA_OPTIONS, (val) => {
        settings.set('defaultCamera', val);
      }),
    ]));

    cards.push(this._createCard('自动追踪白球', '击球后相机自动跟随白球移动', [
      this._createToggle('autoFollowCueBall', (val) => {
        settings.set('autoFollowCueBall', val);
      }),
    ]));

    return cards;
  }

  _buildControlsCards() {
    const cards = [];

    cards.push(this._createCard('鼠标灵敏度', '调整瞄准时的鼠标响应速度', [
      this._createSlider('mouseSensitivity', 0.5, 2.0, 0.1, (val) => {
        settings.set('mouseSensitivity', val);
      }),
    ]));

    return cards;
  }

  _buildGeneralCards() {
    const cards = [];

    cards.push(this._createCard('重置所有设置', '将所有选项恢复为默认值', [
      this._createButton('重置', '⚠️ 重置', () => {
        if (confirm('确定要重置所有设置吗？此操作不可撤销。')) {
          settings.reset();
          this._syncAllControls();
        }
      }),
    ]));

    return cards;
  }

  // ── UI Component Builders ──

  _createCard(title, subtitle, controls) {
    const card = document.createElement('div');
    card.className = 'settings-card';
    card.style.cssText = `
      background: var(--panel-strong);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 20px 24px;
      display: flex; flex-direction: column; gap: 14px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.28);
      backdrop-filter: blur(14px);
      opacity: 0; transform: translateY(10px) scale(0.985);
      animation: settingsCardIn 0.45s var(--ease) both;
    `;

    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';

    const textWrap = document.createElement('div');
    textWrap.style.cssText = 'display: flex; flex-direction: column; gap: 2px;';

    const titleEl = document.createElement('div');
    titleEl.textContent = title;
    titleEl.style.cssText = 'font-size: 15px; font-weight: 750; color: var(--text);';
    textWrap.appendChild(titleEl);

    if (subtitle) {
      const subEl = document.createElement('div');
      subEl.textContent = subtitle;
      subEl.style.cssText = 'font-size: 12px; color: var(--muted);';
      textWrap.appendChild(subEl);
    }

    header.appendChild(textWrap);
    controls.forEach(c => header.appendChild(c));
    card.appendChild(header);

    return card;
  }

  _createToggle(key, onChange) {
    const wrap = document.createElement('label');
    wrap.style.cssText = `
      position: relative; display: inline-block;
      width: 48px; height: 26px; flex-shrink: 0; cursor: pointer;
    `;

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.dataset.settingKey = key;
    input.checked = settings.get(key);
    input.style.cssText = 'opacity: 0; width: 0; height: 0;';

    const slider = document.createElement('span');
    slider.style.cssText = `
      position: absolute; cursor: pointer; inset: 0;
      background: rgba(255,255,255,0.12);
      border-radius: 999px; transition: background 0.25s ease;
      border: 1px solid rgba(255,255,255,0.1);
    `;
    const knob = document.createElement('span');
    knob.style.cssText = `
      position: absolute; content: '';
      height: 20px; width: 20px; left: 2px; bottom: 2px;
      background: #fff; border-radius: 50%;
      transition: transform 0.25s var(--ease), background 0.25s ease;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    `;
    slider.appendChild(knob);

    const update = () => {
      const on = input.checked;
      slider.style.background = on ? 'var(--felt-bright)' : 'rgba(255,255,255,0.12)';
      slider.style.borderColor = on ? 'rgba(24,164,106,0.5)' : 'rgba(255,255,255,0.1)';
      knob.style.transform = on ? 'translateX(22px)' : 'translateX(0)';
    };
    update();

    input.addEventListener('change', () => {
      update();
      onChange(input.checked);
    });

    wrap.appendChild(input);
    wrap.appendChild(slider);
    this._listeners.push({ el: input, type: 'change', fn: () => {} });
    return wrap;
  }

  _createSlider(key, min, max, step, onChange) {
    const wrap = document.createElement('div');
    wrap.style.cssText = `
      display: flex; align-items: center; gap: 12px;
      min-width: 180px; flex-shrink: 0;
    `;

    const trackWrap = document.createElement('div');
    trackWrap.style.cssText = `
      position: relative; flex: 1; height: 24px;
      display: flex; align-items: center;
    `;

    const track = document.createElement('div');
    track.style.cssText = `
      width: 100%; height: 4px;
      background: rgba(255,255,255,0.1);
      border-radius: 999px; position: relative;
      overflow: hidden;
    `;

    const fill = document.createElement('div');
    fill.style.cssText = `
      height: 100%; width: 0%;
      background: linear-gradient(90deg, var(--felt-bright), var(--gold));
      border-radius: 999px; transition: width 0.1s ease;
    `;
    track.appendChild(fill);
    trackWrap.appendChild(track);

    const input = document.createElement('input');
    input.type = 'range';
    input.dataset.settingKey = key;
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = settings.get(key);
    input.style.cssText = `
      position: absolute; inset: 0; opacity: 0; cursor: pointer;
      width: 100%; height: 100%;
    `;

    const updateFill = () => {
      const pct = ((input.value - min) / (max - min)) * 100;
      fill.style.width = `${pct}%`;
    };
    updateFill();

    input.addEventListener('input', () => {
      updateFill();
      onChange(parseFloat(input.value));
    });
    trackWrap.appendChild(input);

    const valueLabel = document.createElement('div');
    valueLabel.dataset.sliderLabel = key;
    valueLabel.textContent = this._formatValue(key, input.value);
    valueLabel.style.cssText = `
      font-size: 13px; font-weight: 700; color: var(--text);
      min-width: 40px; text-align: right; font-variant-numeric: tabular-nums;
    `;
    input.addEventListener('input', () => {
      valueLabel.textContent = this._formatValue(key, input.value);
    });

    wrap.appendChild(trackWrap);
    wrap.appendChild(valueLabel);
    this._listeners.push({ el: input, type: 'input', fn: () => {} });
    return wrap;
  }

  _createSelect(key, options, onChange) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position: relative; flex-shrink: 0;';

    const select = document.createElement('select');
    select.dataset.settingKey = key;
    select.style.cssText = `
      appearance: none; -webkit-appearance: none;
      background: rgba(255,255,255,0.06);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 8px 32px 8px 14px;
      color: var(--text); font-size: 13px; font-weight: 650;
      cursor: pointer; min-width: 120px;
      transition: all 0.2s ease;
    `;
    select.onmouseenter = () => {
      select.style.background = 'rgba(255,255,255,0.1)';
      select.style.borderColor = 'var(--line-strong)';
    };
    select.onmouseleave = () => {
      select.style.background = 'rgba(255,255,255,0.06)';
      select.style.borderColor = 'var(--line)';
    };

    options.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      option.style.cssText = 'background: #1a1e22; color: #f4f7f4;';
      select.appendChild(option);
    });
    select.value = settings.get(key);

    select.addEventListener('change', () => onChange(select.value));

    const arrow = document.createElement('span');
    arrow.textContent = '▼';
    arrow.style.cssText = `
      position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
      font-size: 10px; color: var(--muted); pointer-events: none;
    `;

    wrap.appendChild(select);
    wrap.appendChild(arrow);
    this._listeners.push({ el: select, type: 'change', fn: () => {} });
    return wrap;
  }

  _createButton(label, title, onClick) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = `
      padding: 10px 24px; border-radius: 8px;
      background: rgba(185,18,63,0.15);
      border: 1px solid rgba(185,18,63,0.4);
      color: #ff6b8a; font-size: 13px; font-weight: 700;
      cursor: pointer; transition: all 0.2s ease;
      flex-shrink: 0;
    `;
    btn.onmouseenter = () => {
      btn.style.background = 'rgba(185,18,63,0.25)';
      btn.style.borderColor = 'rgba(185,18,63,0.6)';
    };
    btn.onmouseleave = () => {
      btn.style.background = 'rgba(185,18,63,0.15)';
      btn.style.borderColor = 'rgba(185,18,63,0.4)';
    };
    btn.onclick = onClick;
    return btn;
  }

  _formatValue(key, val) {
    if (key === 'mouseSensitivity') return parseFloat(val).toFixed(1) + 'x';
    return Math.round(val) + '%';
  }

  _syncAllControls() {
    // Re-render current category to sync values
    this._switchCategory(this._currentCategory);
  }

  show() {
    if (!this.container) return;
    this._syncAllControls();
    this.container.style.display = 'block';
    this.container.style.opacity = '0';
    this.container.style.transform = 'translateY(6px)';
    requestAnimationFrame(() => {
      this.container.style.opacity = '1';
      this.container.style.transform = 'translateY(0)';
    });
  }

  hide() {
    if (!this.container) return;
    this.container.style.opacity = '0';
    this.container.style.transform = 'translateY(6px)';
    setTimeout(() => {
      if (this.container) this.container.style.display = 'none';
    }, 350);
  }

  destroy() {
    this._listeners.forEach(({ el, type, fn }) => {
      el.removeEventListener(type, fn);
    });
    this._listeners = [];
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.audio = null;
  }
}
