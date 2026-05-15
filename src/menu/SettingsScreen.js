/**
 * SettingsScreen — hanazargames.com-inspired settings modal.
 *
 * Layout: centered modal (large rounded corners) + left sidebar (letter badges)
 *         + right content (section titles, row items with dividers).
 */
import { settings } from '../core/SettingsStore.js';
import { keyBindings, ACTIONS, ACTION_CATEGORIES } from '../input/KeyBindings.js';
import { animMs } from '../core/AnimSpeed.js';
import { VERSION_TAG } from '../core/Version.js';


const CATEGORIES = [
  { id: 'audio',     label: '音频', letter: 'A' },
  { id: 'graphics',  label: '图形', letter: 'G' },
  { id: 'gameplay',  label: '游戏', letter: 'P' },
  { id: 'controls',  label: '控制', letter: 'C' },
  { id: 'other',     label: '其他', letter: 'O' },
  { id: 'about',     label: '关于', letter: '?' },
];

const QUALITY_OPTIONS = [
  { value: 'low',    label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high',   label: '高' },
];

const CAMERA_OPTIONS = [
  { value: 'free',   label: '自由' },
  { value: 'top',    label: '俯视' },
  { value: 'follow', label: '跟随' },
];

const CUE_THEME_OPTIONS = [
  { value: 'default', label: '经典木' },
  { value: 'black',   label: '黑檀木' },
  { value: 'blue',    label: '冰蓝' },
  { value: 'red',     label: '赤焰' },
  { value: 'green',   label: '翡翠' },
  { value: 'gold',    label: '鎏金' },
];

export class SettingsScreen {
  constructor(onBack) {
    this.onBack = onBack;
    this.audio = null;
    this.container = null;
    this._listeners = [];
    this._currentCategory = 'audio';
    this._tabEls = new Map();
    this._contentArea = null;
    this._toastTimers = [];
    this._hideTimer = null;
    this._saveToastTimer = null;
    this._buildUI();

    // Debounced save toast for settings changes while modal is open
    this._onSettingsChangedToast = (e) => {
      if (!e.detail?.key) return;
      if (this._saveToastTimer) clearTimeout(this._saveToastTimer);
      this._saveToastTimer = setTimeout(() => {
        if (this.container && this.container.style.display !== 'none') {
          this._toast('设置已保存');
        }
      }, 400);
    };
    window.addEventListener('settingsChanged', this._onSettingsChangedToast);
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

    // ── Modal overlay ──
    this.container = document.createElement('div');
    this.container.id = 'settings-screen';
    this.container.style.cssText = `
      display: none; position: fixed; inset: 0; z-index: 90;
      align-items: center; justify-content: center;
      background: rgba(0,0,0,0.65);
      backdrop-filter: blur(8px);
      opacity: 0; transition: opacity calc(0.3s / var(--ui-anim-speed)) ease;
    `;

    // ── Panel ──
    const panel = document.createElement('div');
    panel.style.cssText = `
      width: min(860px, 92vw); height: min(620px, 84vh);
      background: #161616;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 24px;
      display: flex; flex-direction: column;
      overflow: hidden;
      box-shadow: 0 40px 100px rgba(0,0,0,0.6);
    `;

    // ── Header ──
    const header = document.createElement('div');
    header.style.cssText = `
      height: 64px; padding: 0 24px;
      display: flex; align-items: center; justify-content: space-between;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      flex-shrink: 0;
    `;
    const title = document.createElement('div');
    title.textContent = '设置';
    title.style.cssText = 'font-size: 20px; font-weight: 700; color: #fff; letter-spacing: 0.5px;';
    header.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&#x2715;';
    closeBtn.style.cssText = `
      width: 36px; height: 36px; border-radius: 10px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      color: rgba(255,255,255,0.6); font-size: 16px;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: all calc(0.2s / var(--ui-anim-speed)) ease;
    `;
    closeBtn.onmouseenter = () => {
      closeBtn.style.background = 'rgba(255,255,255,0.12)';
      closeBtn.style.color = '#fff';
    };
    closeBtn.onmouseleave = () => {
      closeBtn.style.background = 'rgba(255,255,255,0.06)';
      closeBtn.style.color = 'rgba(255,255,255,0.6)';
    };
    closeBtn.onclick = () => { this.hide(); if (this.onBack) this.onBack(); };
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // ── Body: sidebar + content ──
    const body = document.createElement('div');
    body.style.cssText = 'display: flex; flex: 1; overflow: hidden;';

    // Sidebar
    const sidebar = document.createElement('div');
    sidebar.style.cssText = `
      width: 200px; flex-shrink: 0;
      border-right: 1px solid rgba(255,255,255,0.08);
      padding: 16px 10px;
      display: flex; flex-direction: column; gap: 2px;
      overflow-y: auto;
    `;
    CATEGORIES.forEach((cat) => {
      const tab = document.createElement('div');
      tab.style.cssText = `
        display: flex; align-items: center; gap: 12px;
        padding: 10px 14px; border-radius: 12px;
        cursor: pointer; transition: all calc(0.18s / var(--ui-anim-speed)) ease;
        user-select: none;
      `;
      const badge = document.createElement('div');
      badge.textContent = cat.letter;
      badge.style.cssText = `
        width: 28px; height: 28px; border-radius: 8px;
        background: rgba(255,255,255,0.08);
        display: flex; align-items: center; justify-content: center;
        font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.55);
        flex-shrink: 0; transition: all calc(0.18s / var(--ui-anim-speed)) ease;
      `;
      const label = document.createElement('span');
      label.textContent = cat.label;
      label.style.cssText = 'font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.55); transition: color calc(0.18s / var(--ui-anim-speed)) ease;';
      tab.appendChild(badge);
      tab.appendChild(label);
      tab.onclick = () => this._switchCategory(cat.id);
      this._tabEls.set(cat.id, { tab, badge, label });
      sidebar.appendChild(tab);
    });
    body.appendChild(sidebar);

    // Content area
    this._contentArea = document.createElement('div');
    this._contentArea.style.cssText = `
      flex: 1; overflow-y: auto;
      padding: 28px 36px 40px;
    `;
    body.appendChild(this._contentArea);
    panel.appendChild(body);
    this.container.appendChild(panel);
    layer.appendChild(this.container);

    this._switchCategory('audio');
  }

  _switchCategory(id) {
    // Cancel any pending keybinding listen to prevent global listener leak
    keyBindings.cancelListening();
    this._currentCategory = id;
    this._tabEls.forEach((els, catId) => {
      const active = catId === id;
      els.tab.style.background = active ? 'rgba(255,255,255,0.08)' : 'transparent';
      els.badge.style.background = active ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)';
      els.badge.style.color = active ? '#fff' : 'rgba(255,255,255,0.55)';
      els.label.style.color = active ? '#fff' : 'rgba(255,255,255,0.55)';
    });

    // Clear content listeners to prevent memory leak on tab switches
    this._listeners.forEach(({ el, type, fn }) => {
      if (el) el.removeEventListener(type, fn);
    });
    this._listeners = [];

    this._contentArea.innerHTML = '';
    const builder = `_build${id[0].toUpperCase() + id.slice(1)}Content`;
    if (typeof this[builder] === 'function') {
      this[builder]();
    }
  }

  // ──────────────────────────
  //  Content Builders
  // ──────────────────────────

  _buildAudioContent() {
    this._sectionTitle('音频');
    this._sectionSubtitle('调整游戏音效与音乐的平衡');

    this._row('音效总开关',
      this._createSwitch(settings.get('soundEnabled'), (v) => {
        settings.set('soundEnabled', v);
        if (this.audio) this.audio.toggleSound(v);
      })
    );

    this._rowSlider('主音量', settings.get('masterVolume'), 0, 100, '%', (v) => {
      settings.set('masterVolume', v);
      if (this.audio) this.audio.setMasterVolume(v);
    });

    this._rowSlider('音效音量', settings.get('sfxVolume'), 0, 100, '%', (v) => {
      settings.set('sfxVolume', v);
      if (this.audio) this.audio.setSFXVolume(v);
    });

    this._rowSlider('音乐音量', settings.get('musicVolume'), 0, 100, '%', (v) => {
      settings.set('musicVolume', v);
      if (this.audio) this.audio.setMusicVolume(v);
    });
  }

  _buildGraphicsContent() {
    this._sectionTitle('图形');
    this._sectionSubtitle('控制画面质量与视觉特效');

    this._row('轨迹预测线',
      this._createSwitch(settings.get('trajectoryEnabled'), (v) => {
        settings.set('trajectoryEnabled', v);
        window.dispatchEvent(new CustomEvent('toggleTrajectory', { detail: v }));
      })
    );

    this._row('粒子效果',
      this._createSwitch(settings.get('particlesEnabled'), (v) => {
        settings.set('particlesEnabled', v);
      })
    );

    this._row('击球拖尾',
      this._createSwitch(settings.get('shotTrailsEnabled'), (v) => {
        settings.set('shotTrailsEnabled', v);
        window.dispatchEvent(new CustomEvent('toggleShotTrail', { detail: v }));
      })
    );

    this._rowSelect('画质等级', QUALITY_OPTIONS, settings.get('quality'), (v) => {
      settings.set('quality', v);
    });

    this._row('阴影效果',
      this._createSwitch(settings.get('shadowsEnabled'), (v) => {
        settings.set('shadowsEnabled', v);
      })
    );

    // ── Presets ──
    this._sectionTitle('预设方案', true);
    this._sectionSubtitle('一键切换推荐配置');
    const presetWrap = document.createElement('div');
    presetWrap.style.cssText = 'display:flex; gap:10px; flex-wrap:wrap;';
    const perfBtn = this._presetButton('性能模式', () => {
      settings.set('quality', 'low');
      settings.set('particlesEnabled', false);
      settings.set('shotTrailsEnabled', false);
      settings.set('shadowsEnabled', false);
      settings.set('particleIntensity', 0.5);
      this._toast('已切换为性能模式');
      this._syncAllControls();
    });
    const balancedBtn = this._presetButton('均衡模式', () => {
      settings.set('quality', 'medium');
      settings.set('particlesEnabled', true);
      settings.set('shotTrailsEnabled', true);
      settings.set('shadowsEnabled', true);
      settings.set('particleIntensity', 1.0);
      this._toast('已切换为均衡模式');
      this._syncAllControls();
    });
    const qualityBtn = this._presetButton('画质优先', () => {
      settings.set('quality', 'high');
      settings.set('particlesEnabled', true);
      settings.set('shotTrailsEnabled', true);
      settings.set('shadowsEnabled', true);
      settings.set('particleIntensity', 1.0);
      this._toast('已切换为画质优先');
      this._syncAllControls();
    });
    presetWrap.appendChild(perfBtn);
    presetWrap.appendChild(balancedBtn);
    presetWrap.appendChild(qualityBtn);
    this._contentArea.appendChild(presetWrap);

    // ── FX Animation ──
    this._sectionTitle('特效动画', true);
    this._rowSlider('FX 动画速度', Math.round((settings.get('fxAnimSpeed') ?? 1.0) * 100), 50, 200, '%', (v) => {
      settings.set('fxAnimSpeed', v / 100);
    });
    this._rowSlider('粒子效果强度', Math.round((settings.get('particleIntensity') ?? 1.0) * 100), 20, 200, '%', (v) => {
      settings.set('particleIntensity', v / 100);
    });
    this._rowSlider('拖尾淡出时间', Math.round((settings.get('trailFadeDuration') ?? 5.0) * 10), 20, 100, 's', (v) => {
      settings.set('trailFadeDuration', v / 10);
    });
  }

  _buildGameplayContent() {
    this._sectionTitle('游戏');
    this._sectionSubtitle('游戏规则与视角偏好');

    this._rowSelect('默认视角', CAMERA_OPTIONS, settings.get('defaultCamera'), (v) => {
      settings.set('defaultCamera', v);
    });

    // ── Presets ──
    this._sectionTitle('预设方案', true);
    this._sectionSubtitle('一键切换推荐配置');
    const gpPresetWrap = document.createElement('div');
    gpPresetWrap.style.cssText = 'display:flex; gap:10px; flex-wrap:wrap;';
    const beginnerBtn = this._presetButton('新手模式', () => {
      settings.set('trajectoryEnabled', true);
      settings.set('minimapEnabled', true);
      settings.set('autoFollowCueBall', true);
      settings.set('defaultCamera', 'follow');
      this._toast('已切换为新手模式');
      this._syncAllControls();
    });
    const proBtn = this._presetButton('高手模式', () => {
      settings.set('trajectoryEnabled', false);
      settings.set('minimapEnabled', false);
      settings.set('autoFollowCueBall', false);
      settings.set('defaultCamera', 'free');
      this._toast('已切换为高手模式');
      this._syncAllControls();
    });
    gpPresetWrap.appendChild(beginnerBtn);
    gpPresetWrap.appendChild(proBtn);
    this._contentArea.appendChild(gpPresetWrap);

    // ── Minimap ──
    this._sectionTitle('小地图', true);
    this._row('显示小地图',
      this._createSwitch(settings.get('minimapEnabled'), (v) => {
        settings.set('minimapEnabled', v);
      })
    );
    this._rowSlider('小地图尺寸', settings.get('minimapSize'), 80, 260, 'px', (v) => {
      settings.set('minimapSize', v);
    });
    this._rowSlider('小地图透明度', Math.round(settings.get('minimapOpacity') * 100), 20, 100, '%', (v) => {
      settings.set('minimapOpacity', v / 100);
    });

    this._row('自动追踪白球',
      this._createSwitch(settings.get('autoFollowCueBall'), (v) => {
        settings.set('autoFollowCueBall', v);
      })
    );

    // ── Cue Theme ──
    this._sectionTitle('球杆外观', true);
    this._rowSelect('球杆皮肤', CUE_THEME_OPTIONS, settings.get('cueTheme'), (v) => {
      settings.set('cueTheme', v);
    });
  }

  _buildControlsContent() {
    this._sectionTitle('控制');
    this._sectionSubtitle('灵敏度设置与键盘快捷键');

    // ── Camera sensitivity (expandable) ──
    const camWrap = this._createCollapsible('视角控制灵敏度', true);
    this._rowToggleIn(camWrap, '反转鼠标 X 轴', settings.get('invertMouseX'), (v) => settings.set('invertMouseX', v));
    this._rowToggleIn(camWrap, '反转鼠标 Y 轴', settings.get('invertMouseY'), (v) => settings.set('invertMouseY', v));
    this._rowSliderIn(camWrap, '鼠标灵敏度', Math.round(settings.get('mouseSensitivity') * 100), 50, 200, '%', (v) => settings.set('mouseSensitivity', v / 100));
    this._rowSliderIn(camWrap, '视角旋转速度', Math.round(settings.get('cameraRotateSens') * 100), 30, 200, '%', (v) => settings.set('cameraRotateSens', v / 100));
    this._rowSliderIn(camWrap, '视角平移速度', Math.round(settings.get('cameraPanSens') * 100), 30, 200, '%', (v) => settings.set('cameraPanSens', v / 100));
    this._rowSliderIn(camWrap, '滚轮缩放速度', Math.round(settings.get('cameraZoomSens') * 100), 30, 200, '%', (v) => settings.set('cameraZoomSens', v / 100));

    // ── Shot & aim sensitivity (expandable) ──
    const shotWrap = this._createCollapsible('击球与瞄准灵敏度', true);
    this._rowSliderIn(shotWrap, '击球力度灵敏度', Math.round(settings.get('shotPowerSens') * 100), 50, 200, '%', (v) => settings.set('shotPowerSens', v / 100));
    this._rowSliderIn(shotWrap, '瞄准响应速度', Math.round(settings.get('aimSens') * 100), 50, 200, '%', (v) => settings.set('aimSens', v / 100));
    this._rowSliderIn(shotWrap, '球杆旋转步长', Math.round(settings.get('spinStepSens') * 100), 30, 200, '%', (v) => settings.set('spinStepSens', v / 100));
    this._rowSliderIn(shotWrap, '触控板灵敏度', Math.round(settings.get('trackpadSens') * 100), 30, 200, '%', (v) => settings.set('trackpadSens', v / 100));

    // ── Effects & UI sensitivity (expandable) ──
    const fxWrap = this._createCollapsible('特效与界面灵敏度', false);
    this._rowSliderIn(fxWrap, '屏幕震动强度', Math.round(settings.get('screenShakeIntensity') * 100), 0, 200, '%', (v) => settings.set('screenShakeIntensity', v / 100));
    this._rowSliderIn(fxWrap, '界面动画速度', Math.round(settings.get('uiAnimSpeed') * 100), 50, 150, '%', (v) => settings.set('uiAnimSpeed', v / 100));

    // ── Keybindings (collapsed by default) ──
    const kbWrap = this._createCollapsible('快捷键', false);

    // Preset selector
    const presetWrap = document.createElement('div');
    presetWrap.style.cssText = 'display: flex; gap: 10px; justify-content: center; margin: 8px 0 16px;';
    const presets = [
      { id: 'mac',    label: 'Mac',    icon: '⌘' },
      { id: 'win',    label: 'Win',    icon: '⊞' },
      { id: 'mobile', label: '触屏',   icon: '☰' },
    ];
    const currentPreset = keyBindings.getCurrentPreset().split(':')[0] || 'win';
    presets.forEach(p => {
      const btn = document.createElement('button');
      const active = currentPreset === p.id;
      btn.style.cssText = `
        display: flex; align-items: center; gap: 6px;
        padding: 7px 16px; border-radius: 999px;
        background: ${active ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.05)'};
        border: 1px solid ${active ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)'};
        color: ${active ? '#fff' : 'rgba(255,255,255,0.55)'};
        font-size: 12px; font-weight: 600; cursor: pointer;
        transition: all calc(0.2s / var(--ui-anim-speed)) ease;
      `;
      btn.innerHTML = `<span style="font-size:14px;">${p.icon}</span><span>${p.label}</span>`;
      btn.onmouseenter = () => { if (!active) btn.style.background = 'rgba(255,255,255,0.1)'; };
      btn.onmouseleave = () => { if (!active) btn.style.background = 'rgba(255,255,255,0.05)'; };
      const clickFn = () => { keyBindings.applyPreset(p.id); this._switchCategory('controls'); };
      btn.addEventListener('click', clickFn);
      this._listeners.push({ el: btn, type: 'click', fn: clickFn });
      presetWrap.appendChild(btn);
    });
    kbWrap.appendChild(presetWrap);

    // Keybindings by category
    const displayPreset = keyBindings.getCurrentPreset().split(':')[0] || 'win';
    ACTION_CATEGORIES.forEach(cat => {
      const catTitle = document.createElement('div');
      catTitle.textContent = cat.label;
      catTitle.style.cssText = `
        font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.45);
        text-transform: uppercase; letter-spacing: 1px;
        margin-top: 12px; margin-bottom: 6px; padding-left: 4px;
      `;
      kbWrap.appendChild(catTitle);
      Object.entries(cat.actions).forEach(([actionKey, def]) => {
        const isMobile = displayPreset === 'mobile';
        const displayKey = keyBindings.getDisplayBinding(actionKey, displayPreset);
        this._keyRowIn(kbWrap, def.label, displayKey, actionKey, !isMobile && keyBindings.isBindable(actionKey), (newKey) => {
          keyBindings.setBinding(actionKey, newKey);
        });
      });
    });

    // ── Custom presets (collapsed by default) ──
    const customWrap = this._createCollapsible('自定义预设', false);
    const sub = document.createElement('div');
    sub.textContent = '保存你当前的快捷键配置';
    sub.style.cssText = 'font-size: 12px; color: rgba(255,255,255,0.4); text-align: center; margin-bottom: 10px;';
    customWrap.appendChild(sub);

    const saveWrap = document.createElement('div');
    saveWrap.style.cssText = 'display: flex; gap: 10px; margin-bottom: 10px;';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = '预设名称…';
    input.style.cssText = `
      flex: 1; padding: 9px 12px; border-radius: 10px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.1);
      color: #fff; font-size: 13px; outline: none;
      transition: border-color calc(0.2s / var(--ui-anim-speed)) ease;
    `;
    input.onfocus = () => { input.style.borderColor = 'rgba(255,255,255,0.25)'; };
    input.onblur = () => { input.style.borderColor = 'rgba(255,255,255,0.1)'; };
    saveWrap.appendChild(input);

    const saveBtn = document.createElement('button');
    saveBtn.textContent = '保存';
    saveBtn.style.cssText = `
      padding: 9px 16px; border-radius: 10px;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.15);
      color: rgba(255,255,255,0.8); font-size: 13px; font-weight: 600;
      cursor: pointer; transition: all calc(0.2s / var(--ui-anim-speed)) ease; flex-shrink: 0;
    `;
    saveBtn.onmouseenter = () => { saveBtn.style.background = 'rgba(255,255,255,0.14)'; saveBtn.style.color = '#fff'; };
    saveBtn.onmouseleave = () => { saveBtn.style.background = 'rgba(255,255,255,0.08)'; saveBtn.style.color = 'rgba(255,255,255,0.8)'; };
    const onSave = () => {
      const name = input.value.trim();
      if (!name) { this._toast('请输入预设名称'); return; }
      keyBindings.saveCustomPreset(name);
      input.value = '';
      this._toast(`预设「${name}」已保存`);
      this._switchCategory('controls');
    };
    saveBtn.addEventListener('click', onSave);
    this._listeners.push({ el: saveBtn, type: 'click', fn: onSave });
    saveWrap.appendChild(saveBtn);
    customWrap.appendChild(saveWrap);

    const customPresets = keyBindings.listCustomPresets();
    if (customPresets.length > 0) {
      customPresets.forEach(name => {
        const row = document.createElement('div');
        row.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05);';
        const lbl = document.createElement('span');
        lbl.textContent = name;
        lbl.style.cssText = 'font-size: 13px; color: rgba(255,255,255,0.7);';
        row.appendChild(lbl);
        const right = document.createElement('div');
        right.style.cssText = 'display: flex; gap: 6px;';
        const loadBtn = document.createElement('button');
        loadBtn.textContent = '加载';
        loadBtn.style.cssText = 'padding: 4px 10px; border-radius: 6px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.5); font-size: 11px; font-weight: 600; cursor: pointer; transition: all calc(0.2s / var(--ui-anim-speed)) ease;';
        loadBtn.onmouseenter = () => { loadBtn.style.background = 'rgba(255,255,255,0.1)'; loadBtn.style.color = '#fff'; };
        loadBtn.onmouseleave = () => { loadBtn.style.background = 'rgba(255,255,255,0.05)'; loadBtn.style.color = 'rgba(255,255,255,0.5)'; };
        const onLoad = () => { keyBindings.loadCustomPreset(name); this._toast(`已加载预设「${name}」`); this._switchCategory('controls'); };
        loadBtn.addEventListener('click', onLoad);
        this._listeners.push({ el: loadBtn, type: 'click', fn: onLoad });
        right.appendChild(loadBtn);
        const delBtn = document.createElement('button');
        delBtn.textContent = '删除';
        delBtn.style.cssText = 'padding: 4px 10px; border-radius: 6px; background: rgba(185,18,63,0.06); border: 1px solid rgba(185,18,63,0.25); color: rgba(255,100,100,0.7); font-size: 11px; font-weight: 600; cursor: pointer; transition: all calc(0.2s / var(--ui-anim-speed)) ease;';
        delBtn.onmouseenter = () => { delBtn.style.background = 'rgba(185,18,63,0.12)'; delBtn.style.borderColor = 'rgba(185,18,63,0.4)'; };
        delBtn.onmouseleave = () => { delBtn.style.background = 'rgba(185,18,63,0.06)'; delBtn.style.borderColor = 'rgba(185,18,63,0.25)'; };
        const onDel = () => { keyBindings.deleteCustomPreset(name); this._toast(`预设「${name}」已删除`); this._switchCategory('controls'); };
        delBtn.addEventListener('click', onDel);
        this._listeners.push({ el: delBtn, type: 'click', fn: onDel });
        right.appendChild(delBtn);
        row.appendChild(right);
        customWrap.appendChild(row);
      });
    }
    const resetBtn = document.createElement('button');
    resetBtn.textContent = '恢复为默认快捷键';
    resetBtn.style.cssText = `
      width: 100%; padding: 12px; margin-top: 10px;
      background: rgba(185,18,63,0.08);
      border: 1px solid rgba(185,18,63,0.35);
      border-radius: 10px;
      color: #ff6b8a; font-size: 13px; font-weight: 600;
      cursor: pointer; transition: all calc(0.2s / var(--ui-anim-speed)) ease;
    `;
    resetBtn.onmouseenter = () => { resetBtn.style.background = 'rgba(185,18,63,0.15)'; resetBtn.style.borderColor = 'rgba(185,18,63,0.5)'; };
    resetBtn.onmouseleave = () => { resetBtn.style.background = 'rgba(185,18,63,0.08)'; resetBtn.style.borderColor = 'rgba(185,18,63,0.35)'; };
    const onReset = () => {
      if (confirm('确定要恢复为默认快捷键吗？所有自定义修改将丢失。')) {
        keyBindings.resetToDefaults();
        this._toast('已恢复为默认快捷键');
        this._switchCategory('controls');
      }
    };
    resetBtn.addEventListener('click', onReset);
    this._listeners.push({ el: resetBtn, type: 'click', fn: onReset });
    customWrap.appendChild(resetBtn);
  }

  _buildOtherContent() {
    this._sectionTitle('其他');
    this._sectionSubtitle('重置设置与数据管理');

    this._dangerButton('重置所有设置', () => {
      this._showConfirmDialog(
        '重置所有设置',
        '确定要恢复为默认设置吗？此操作不可撤销，所有自定义配置将丢失。',
        () => {
          settings.reset();
          this._syncAllControls();
          this._toast('已恢复为默认设置');
        }
      );
    });

    // ── Import / Export ──
    this._sectionTitle('配置管理', true);
    this._sectionSubtitle('导出或导入设置 JSON');

    const exportWrap = document.createElement('div');
    exportWrap.style.cssText = 'display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px;';
    const exportClipboardBtn = this._presetButton('复制到剪贴板', () => {
      const data = JSON.stringify(settings.getAll(), null, 2);
      navigator.clipboard?.writeText(data);
      this._toast('配置已复制到剪贴板');
    });
    const exportFileBtn = this._presetButton('下载文件', () => {
      const data = JSON.stringify(settings.getAll(), null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'billiards-settings.json';
      a.click();
      URL.revokeObjectURL(url);
      this._toast('配置已下载');
    });
    exportWrap.appendChild(exportClipboardBtn);
    exportWrap.appendChild(exportFileBtn);
    this._contentArea.appendChild(exportWrap);

    // Import area
    const importWrap = document.createElement('div');
    importWrap.style.cssText = 'display:flex; flex-direction:column; gap:8px;';
    const importText = document.createElement('textarea');
    importText.placeholder = '在此粘贴配置 JSON，或点击下方选择文件导入…';
    importText.style.cssText = `
      width: 100%; height: 100px; padding: 10px 12px; resize: vertical;
      background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px; color: rgba(255,255,255,0.7); font-size: 12px;
      font-family: 'SFMono-Regular', Consolas, monospace; line-height: 1.5;
      outline: none;
    `;
    importText.onfocus = () => { importText.style.borderColor = 'rgba(255,255,255,0.25)'; };
    importText.onblur = () => { importText.style.borderColor = 'rgba(255,255,255,0.1)'; };
    importWrap.appendChild(importText);

    const importBtnRow = document.createElement('div');
    importBtnRow.style.cssText = 'display:flex; gap:10px; align-items:center;';

    const importApplyBtn = this._presetButton('导入配置', () => {
      const raw = importText.value.trim();
      if (!raw) { this._toast('请输入配置 JSON'); return; }
      try {
        const data = JSON.parse(raw);
        if (typeof data !== 'object' || data === null) throw new Error('格式错误');
        let count = 0;
        Object.keys(data).forEach((key) => {
          if (key in settings.getAll()) {
            settings.set(key, data[key]);
            count++;
          }
        });
        this._toast(`已导入 ${count} 项配置`);
        this._syncAllControls();
        importText.value = '';
      } catch (e) {
        this._toast('导入失败：JSON 格式错误或包含无效数据');
      }
    });
    importApplyBtn.style.background = 'rgba(24,119,201,0.12)';
    importApplyBtn.style.color = '#6bb3ff';
    importApplyBtn.style.borderColor = 'rgba(24,119,201,0.4)';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.style.display = 'none';
    fileInput.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        importText.value = ev.target.result;
        this._toast('文件已读取，点击「导入配置」以应用');
      };
      reader.onerror = () => this._toast('文件读取失败');
      reader.readAsText(file);
    };
    importWrap.appendChild(fileInput);

    const importFileBtn = this._presetButton('选择文件…', () => fileInput.click());
    importFileBtn.style.background = 'rgba(255,255,255,0.06)';
    importFileBtn.style.color = 'rgba(255,255,255,0.7)';
    importFileBtn.style.borderColor = 'rgba(255,255,255,0.15)';

    importBtnRow.appendChild(importFileBtn);
    importBtnRow.appendChild(importApplyBtn);
    importWrap.appendChild(importBtnRow);
    this._contentArea.appendChild(importWrap);

    this._button('清除本地缓存', () => {
      this._showConfirmDialog(
        '清除本地缓存',
        '确定要清除所有本地存储的数据吗？包括设置、成就、回放记录等。此操作不可撤销。',
        () => {
          const keys = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('billiards_')) keys.push(k);
          }
          keys.forEach(k => localStorage.removeItem(k));
          this._toast('本地缓存已清除，刷新后生效');
        }
      );
    });
  }

  _buildAboutContent() {
    this._sectionTitle('关于');

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:12px;padding-top:12px;';

    const logo = document.createElement('div');
    logo.textContent = '🎱 3D Billiards';
    logo.style.cssText = 'font-size: 22px; font-weight: 800; color: #fff;';
    wrap.appendChild(logo);

    const desc = document.createElement('div');
    desc.textContent = '一个基于 Three.js 与 cannon-es 的 3D 台球游戏';
    desc.style.cssText = 'font-size: 13px; color: rgba(255,255,255,0.45); text-align: center; line-height: 1.5;';
    wrap.appendChild(desc);

    const ver = document.createElement('div');
    ver.textContent = '版本 ' + VERSION_TAG.replace('v', '');
    ver.style.cssText = 'font-size: 13px; color: rgba(255,255,255,0.35); margin-top: 8px;';
    wrap.appendChild(ver);

    const copy = document.createElement('div');
    copy.textContent = '© 2026 Hanazar Games. 保留所有权利。';
    copy.style.cssText = 'font-size: 12px; color: rgba(255,255,255,0.25); margin-top: 4px;';
    wrap.appendChild(copy);

    // ── Links ──
    const linksWrap = document.createElement('div');
    linksWrap.style.cssText = 'display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin-top:10px;';

    const makeLink = (text, url) => {
      const a = document.createElement('a');
      a.textContent = text;
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.style.cssText = `
        display:inline-block;padding:7px 14px;border-radius:8px;
        background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);
        color:rgba(255,255,255,0.65);font-size:12px;font-weight:600;
        text-decoration:none;cursor:pointer;
        transition:all calc(0.2s / var(--ui-anim-speed)) ease;
      `;
      a.onmouseenter = () => {
        a.style.background = 'rgba(255,255,255,0.12)';
        a.style.borderColor = 'rgba(255,255,255,0.25)';
        a.style.color = '#fff';
      };
      a.onmouseleave = () => {
        a.style.background = 'rgba(255,255,255,0.06)';
        a.style.borderColor = 'rgba(255,255,255,0.1)';
        a.style.color = 'rgba(255,255,255,0.65)';
      };
      return a;
    };

    linksWrap.appendChild(makeLink('🏠 Hanazar Games', 'https://github.com/Hanazar-Games'));
    linksWrap.appendChild(makeLink('📁 项目仓库', 'https://github.com/Hanazar-Games/Billiards'));
    linksWrap.appendChild(makeLink('🐛 问题反馈', 'https://github.com/Hanazar-Games/Billiards/issues'));
    linksWrap.appendChild(makeLink('👤 开发者', 'https://github.com/hanazarochikawa'));
    wrap.appendChild(linksWrap);

    this._contentArea.appendChild(wrap);
  }

  // ──────────────────────────
  //  UI Primitives
  // ──────────────────────────

  _sectionTitle(text, compact = false) {
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = `
      font-size: ${compact ? '16px' : '18px'}; font-weight: 600;
      color: #fff; text-align: center;
      margin-top: ${compact ? '24px' : '0'};
      margin-bottom: ${compact ? '4px' : '8px'};
    `;
    this._contentArea.appendChild(el);
  }

  _createCollapsible(title, defaultOpen = false) {
    const block = document.createElement('div');
    block.style.cssText = `
      margin: 8px 0 16px;
      background: rgba(255,255,255,0.02);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 12px;
      overflow: hidden;
    `;

    const header = document.createElement('div');
    header.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 14px;
      cursor: pointer; user-select: none;
      transition: background calc(0.2s / var(--ui-anim-speed)) ease;
    `;
    header.onmouseenter = () => { header.style.background = 'rgba(255,255,255,0.03)'; };
    header.onmouseleave = () => { header.style.background = 'transparent'; };

    const label = document.createElement('span');
    label.textContent = title;
    label.style.cssText = 'font-size: 15px; font-weight: 600; color: rgba(255,255,255,0.85);';
    header.appendChild(label);

    const arrow = document.createElement('span');
    arrow.textContent = '▸';
    arrow.style.cssText = `
      font-size: 13px; color: rgba(255,255,255,0.35);
      transform: rotate(${defaultOpen ? 90 : 0}deg);
      transition: transform calc(0.25s / var(--ui-anim-speed)) cubic-bezier(0.4,0,0.2,1);
      display: inline-block;
    `;
    header.appendChild(arrow);
    block.appendChild(header);

    const body = document.createElement('div');
    body.style.cssText = `
      max-height: ${defaultOpen ? '2000px' : '0px'};
      overflow: hidden;
      transition: max-height calc(0.35s / var(--ui-anim-speed)) cubic-bezier(0.4,0,0.2,1);
      padding: ${defaultOpen ? '0 14px 10px' : '0 14px'};
    `;
    block.appendChild(body);

    let isOpen = defaultOpen;
    const toggle = () => {
      isOpen = !isOpen;
      arrow.style.transform = `rotate(${isOpen ? 90 : 0}deg)`;
      body.style.maxHeight = isOpen ? '2000px' : '0px';
      body.style.padding = isOpen ? '0 14px 10px' : '0 14px';
    };
    header.addEventListener('click', toggle);
    this._listeners.push({ el: header, type: 'click', fn: toggle });

    this._contentArea.appendChild(block);
    return body;
  }

  _sectionSubtitle(text) {
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = `
      font-size: 13px; color: rgba(255,255,255,0.4);
      text-align: center; margin-bottom: 20px;
    `;
    this._contentArea.appendChild(el);
  }

  _row(label, control) {
    const row = document.createElement('div');
    row.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
      padding: 14px 0; border-bottom: 1px solid rgba(255,255,255,0.06);
    `;
    const lbl = document.createElement('span');
    lbl.textContent = label;
    lbl.style.cssText = 'font-size: 15px; font-weight: 500; color: rgba(255,255,255,0.85);';
    row.appendChild(lbl);
    row.appendChild(control);
    this._contentArea.appendChild(row);
  }

  _rowSlider(label, value, min, max, unit, onChange) {
    const row = document.createElement('div');
    row.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
      padding: 14px 0; border-bottom: 1px solid rgba(255,255,255,0.06);
      gap: 20px;
    `;
    const left = document.createElement('span');
    left.textContent = label;
    left.style.cssText = 'font-size: 15px; font-weight: 500; color: rgba(255,255,255,0.85); flex-shrink: 0;';
    row.appendChild(left);

    const slider = this._createSlider(value, min, max, unit, onChange);
    slider.style.flex = '1';
    slider.style.maxWidth = '320px';
    row.appendChild(slider);
    this._contentArea.appendChild(row);
  }

  _rowSliderIn(container, label, value, min, max, unit, onChange) {
    const row = document.createElement('div');
    row.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.06);
      gap: 16px;
    `;
    const left = document.createElement('span');
    left.textContent = label;
    left.style.cssText = 'font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.8); flex-shrink: 0;';
    row.appendChild(left);
    const slider = this._createSlider(value, min, max, unit, onChange);
    slider.style.flex = '1';
    slider.style.maxWidth = '260px';
    row.appendChild(slider);
    container.appendChild(row);
  }

  _rowToggleIn(container, label, checked, onChange) {
    const row = document.createElement('div');
    row.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.06);
    `;
    const left = document.createElement('span');
    left.textContent = label;
    left.style.cssText = 'font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.8);';
    row.appendChild(left);
    row.appendChild(this._createSwitch(checked, onChange));
    container.appendChild(row);
  }

  _keyRowIn(container, label, displayKey, actionKey, bindable, onBind) {
    const row = document.createElement('div');
    row.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
      padding: 9px 0; border-bottom: 1px solid rgba(255,255,255,0.05);
    `;
    const lbl = document.createElement('span');
    lbl.textContent = label;
    lbl.style.cssText = 'font-size: 13px; font-weight: 500; color: rgba(255,255,255,0.75);';
    row.appendChild(lbl);
    const right = document.createElement('div');
    right.style.cssText = 'display: flex; align-items: center; gap: 8px;';
    const keyTag = document.createElement('span');
    keyTag.textContent = this._formatKey(displayKey);
    keyTag.style.cssText = `
      padding: 4px 8px; border-radius: 6px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.5);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px; font-weight: 600;
    `;
    right.appendChild(keyTag);
    if (bindable) {
      const bindBtn = document.createElement('button');
      bindBtn.textContent = '修改';
      bindBtn.style.cssText = `
        padding: 4px 10px; border-radius: 6px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.1);
        color: rgba(255,255,255,0.4);
        font-size: 11px; font-weight: 600; cursor: pointer;
        transition: all calc(0.2s / var(--ui-anim-speed)) ease;
      `;
      bindBtn.onmouseenter = () => { bindBtn.style.background = 'rgba(255,255,255,0.1)'; bindBtn.style.color = 'rgba(255,255,255,0.8)'; };
      bindBtn.onmouseleave = () => { bindBtn.style.background = 'rgba(255,255,255,0.04)'; bindBtn.style.color = 'rgba(255,255,255,0.4)'; };
      const onClick = () => {
        if (bindBtn.dataset.waiting === 'true') return;
        bindBtn.dataset.waiting = 'true';
        bindBtn.textContent = '按下新键…';
        bindBtn.style.color = '#d8b15f';
        bindBtn.style.borderColor = 'rgba(216,177,95,0.4)';
        keyBindings.startListening(actionKey, (action, newKey) => {
          bindBtn.dataset.waiting = 'false';
          bindBtn.textContent = '修改';
          bindBtn.style.color = 'rgba(255,255,255,0.4)';
          bindBtn.style.borderColor = 'rgba(255,255,255,0.1)';
          keyTag.textContent = this._formatKey(newKey);
          onBind(newKey);
        });
      };
      bindBtn.addEventListener('click', onClick);
      this._listeners.push({ el: bindBtn, type: 'click', fn: onClick });
      right.appendChild(bindBtn);
    }
    row.appendChild(right);
    container.appendChild(row);
  }

  _rowSelect(label, options, value, onChange) {
    const row = document.createElement('div');
    row.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
      padding: 14px 0; border-bottom: 1px solid rgba(255,255,255,0.06);
    `;
    const lbl = document.createElement('span');
    lbl.textContent = label;
    lbl.style.cssText = 'font-size: 15px; font-weight: 500; color: rgba(255,255,255,0.85);';
    row.appendChild(lbl);

    const pills = document.createElement('div');
    pills.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap;';
    const btns = [];
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.textContent = opt.label;
      const active = opt.value === value;
      btn.dataset.active = active ? 'true' : '';
      btn.style.cssText = `
        padding: 7px 16px; border-radius: 999px;
        background: ${active ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.05)'};
        border: 1px solid ${active ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)'};
        color: ${active ? '#fff' : 'rgba(255,255,255,0.55)'};
        font-size: 13px; font-weight: 600; cursor: pointer;
        transition: all calc(0.2s / var(--ui-anim-speed)) ease;
      `;
      btn.onmouseenter = () => {
        if (!btn.dataset.active) btn.style.background = 'rgba(255,255,255,0.1)';
      };
      btn.onmouseleave = () => {
        if (!btn.dataset.active) btn.style.background = 'rgba(255,255,255,0.05)';
      };
      const clickFn = () => {
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
        onChange(opt.value);
      };
      btn.addEventListener('click', clickFn);
      this._listeners.push({ el: btn, type: 'click', fn: clickFn });
      btns.push(btn);
      pills.appendChild(btn);
    });
    row.appendChild(pills);
    this._contentArea.appendChild(row);
  }

  _keyRow(label, displayKey, actionKey, bindable, onBind) {
    const row = document.createElement('div');
    row.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
      padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06);
    `;
    const lbl = document.createElement('span');
    lbl.textContent = label;
    lbl.style.cssText = 'font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.8);';
    row.appendChild(lbl);

    const right = document.createElement('div');
    right.style.cssText = 'display: flex; align-items: center; gap: 10px;';

    const keyTag = document.createElement('span');
    keyTag.textContent = this._formatKey(displayKey);
    keyTag.style.cssText = `
      padding: 5px 10px; border-radius: 8px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      color: rgba(255,255,255,0.55);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px; font-weight: 600;
    `;
    right.appendChild(keyTag);

    if (bindable) {
      const bindBtn = document.createElement('button');
      bindBtn.textContent = '修改';
      bindBtn.style.cssText = `
        padding: 5px 12px; border-radius: 8px;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.1);
        color: rgba(255,255,255,0.45);
        font-size: 12px; font-weight: 600; cursor: pointer;
        transition: all calc(0.2s / var(--ui-anim-speed)) ease;
      `;
      bindBtn.onmouseenter = () => {
        bindBtn.style.background = 'rgba(255,255,255,0.1)';
        bindBtn.style.color = 'rgba(255,255,255,0.8)';
      };
      bindBtn.onmouseleave = () => {
        bindBtn.style.background = 'rgba(255,255,255,0.05)';
        bindBtn.style.color = 'rgba(255,255,255,0.45)';
      };

      const onClick = () => {
        if (bindBtn.dataset.waiting === 'true') return;
        bindBtn.dataset.waiting = 'true';
        bindBtn.textContent = '按下新键…';
        bindBtn.style.color = '#d8b15f';
        bindBtn.style.borderColor = 'rgba(216,177,95,0.4)';
        keyBindings.startListening(actionKey, (action, newKey) => {
          bindBtn.dataset.waiting = 'false';
          bindBtn.textContent = '修改';
          bindBtn.style.color = 'rgba(255,255,255,0.45)';
          bindBtn.style.borderColor = 'rgba(255,255,255,0.1)';
          keyTag.textContent = this._formatKey(newKey);
          onBind(newKey);
        });
      };
      bindBtn.addEventListener('click', onClick);
      this._listeners.push({ el: bindBtn, type: 'click', fn: onClick });
      right.appendChild(bindBtn);
    }

    row.appendChild(right);
    this._contentArea.appendChild(row);
  }

  _dangerButton(label, onClick) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = `
      width: 100%; padding: 14px; margin-top: 8px; margin-bottom: 12px;
      background: rgba(185,18,63,0.08);
      border: 1px solid rgba(185,18,63,0.35);
      border-radius: 12px;
      color: #ff6b8a; font-size: 15px; font-weight: 600;
      cursor: pointer; transition: all calc(0.2s / var(--ui-anim-speed)) ease;
    `;
    btn.onmouseenter = () => {
      btn.style.background = 'rgba(185,18,63,0.15)';
      btn.style.borderColor = 'rgba(185,18,63,0.5)';
    };
    btn.onmouseleave = () => {
      btn.style.background = 'rgba(185,18,63,0.08)';
      btn.style.borderColor = 'rgba(185,18,63,0.35)';
    };
    const fn = onClick;
    btn.addEventListener('click', fn);
    this._listeners.push({ el: btn, type: 'click', fn });
    this._contentArea.appendChild(btn);
  }

  _button(label, onClick) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = `
      width: 100%; padding: 14px; margin-bottom: 10px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      color: rgba(255,255,255,0.7); font-size: 15px; font-weight: 600;
      cursor: pointer; transition: all calc(0.2s / var(--ui-anim-speed)) ease;
    `;
    btn.onmouseenter = () => {
      btn.style.background = 'rgba(255,255,255,0.1)';
      btn.style.borderColor = 'rgba(255,255,255,0.18)';
      btn.style.color = '#fff';
    };
    btn.onmouseleave = () => {
      btn.style.background = 'rgba(255,255,255,0.05)';
      btn.style.borderColor = 'rgba(255,255,255,0.1)';
      btn.style.color = 'rgba(255,255,255,0.7)';
    };
    const fn = onClick;
    btn.addEventListener('click', fn);
    this._listeners.push({ el: btn, type: 'click', fn });
    this._contentArea.appendChild(btn);
  }

  _presetButton(label, onClick) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = `
      padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600;
      background: rgba(24,164,106,0.1); color: #5ce6a0;
      border: 1px solid rgba(24,164,106,0.35); cursor: pointer;
      transition: all calc(0.2s / var(--ui-anim-speed)) ease;
    `;
    btn.onmouseenter = () => {
      btn.style.background = 'rgba(24,164,106,0.2)';
      btn.style.borderColor = 'rgba(24,164,106,0.5)';
      btn.style.color = '#7fffb3';
    };
    btn.onmouseleave = () => {
      btn.style.background = 'rgba(24,164,106,0.1)';
      btn.style.borderColor = 'rgba(24,164,106,0.35)';
      btn.style.color = '#5ce6a0';
    };
    const fn = onClick;
    btn.addEventListener('click', fn);
    this._listeners.push({ el: btn, type: 'click', fn });
    return btn;
  }

  // ── Components ──

  _createSwitch(checked, onChange) {
    const wrap = document.createElement('label');
    wrap.style.cssText = `
      position: relative; display: inline-block;
      width: 48px; height: 28px; cursor: pointer; flex-shrink: 0;
    `;
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    input.style.cssText = 'opacity: 0; width: 0; height: 0; position: absolute;';

    const track = document.createElement('span');
    const knob = document.createElement('span');

    const update = () => {
      const on = input.checked;
      track.style.cssText = `
        position: absolute; inset: 0; border-radius: 999px;
        background: ${on ? '#34c759' : 'rgba(255,255,255,0.15)'};
        transition: background calc(0.25s / var(--ui-anim-speed)) ease;
      `;
      knob.style.cssText = `
        position: absolute; top: 2px; left: 2px;
        width: 24px; height: 24px; border-radius: 50%;
        background: #fff;
        box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        transition: transform calc(0.25s / var(--ui-anim-speed)) cubic-bezier(0.2,0.8,0.2,1);
        transform: translateX(${on ? '20px' : '0'});
      `;
    };
    update();

    const fn = () => { update(); onChange(input.checked); };
    input.addEventListener('change', fn);
    this._listeners.push({ el: input, type: 'change', fn });

    wrap.appendChild(input);
    wrap.appendChild(track);
    wrap.appendChild(knob);
    return wrap;
  }

  _createSlider(value, min, max, unit, onChange) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display: flex; align-items: center; gap: 14px; width: 100%;';

    const trackWrap = document.createElement('div');
    trackWrap.style.cssText = 'position: relative; flex: 1; height: 20px; display: flex; align-items: center;';

    const track = document.createElement('div');
    track.style.cssText = `
      width: 100%; height: 4px;
      background: rgba(255,255,255,0.1);
      border-radius: 999px; position: relative;
    `;
    const fill = document.createElement('div');
    fill.style.cssText = `
      height: 100%; width: 0%;
      background: rgba(255,255,255,0.6);
      border-radius: 999px; transition: width calc(0.08s / var(--ui-anim-speed)) ease;
    `;
    track.appendChild(fill);
    trackWrap.appendChild(track);

    const thumb = document.createElement('div');
    thumb.style.cssText = `
      position: absolute; top: 50%; left: 0%;
      width: 18px; height: 18px; border-radius: 50%;
      background: #fff;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      transform: translate(-50%, -50%);
      pointer-events: none; transition: left calc(0.08s / var(--ui-anim-speed)) ease;
    `;
    trackWrap.appendChild(thumb);

    const input = document.createElement('input');
    input.type = 'range';
    input.min = min; input.max = max; input.step = 1;
    input.value = value;
    input.style.cssText = `
      position: absolute; inset: 0; opacity: 0; cursor: pointer;
      width: 100%; height: 100%;
    `;

    const update = () => {
      const pct = ((input.value - min) / (max - min)) * 100;
      fill.style.width = `${pct}%`;
      thumb.style.left = `${pct}%`;
    };
    update();

    const fn = () => { update(); onChange(parseFloat(input.value)); };
    input.addEventListener('input', fn);
    this._listeners.push({ el: input, type: 'input', fn });

    trackWrap.appendChild(input);

    const label = document.createElement('span');
    label.textContent = value + unit;
    label.style.cssText = `
      font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.55);
      min-width: 44px; text-align: right; font-variant-numeric: tabular-nums;
    `;
    const labelFn = () => { label.textContent = input.value + unit; };
    input.addEventListener('input', labelFn);
    this._listeners.push({ el: input, type: 'input', fn: labelFn });

    wrap.appendChild(trackWrap);
    wrap.appendChild(label);
    return wrap;
  }

  _formatKey(key) {
    if (!key) return '—';
    const map = {
      escape: 'Esc',
      arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→',
      ' ': 'Space',
      meta: '⌘', ctrl: 'Ctrl', shift: '⇧', alt: '⌥',
    };
    // Handle chords like "ctrl+z", "shift+tab", "meta+shift+s"
    if (key.includes('+')) {
      return key.split('+').map(k => map[k.trim()] || k.trim().toUpperCase()).join(' + ');
    }
    return map[key.toLowerCase()] || key.toUpperCase();
  }

  _toast(text) {
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = `
      position: fixed; bottom: 32px; left: 50%; transform: translateX(-50%);
      padding: 10px 20px; border-radius: 10px;
      background: rgba(30,30,30,0.92); border: 1px solid rgba(255,255,255,0.1);
      color: #fff; font-size: 13px; font-weight: 600;
      z-index: 200; pointer-events: none;
      animation: settingsCardIn calc(0.3s / var(--ui-anim-speed)) ease both;
    `;
    document.body.appendChild(el);
    if (!this._toastTimers) this._toastTimers = [];
    const fadeTimer = setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity calc(0.3s / var(--ui-anim-speed)) ease';
      const removeTimer = setTimeout(() => { if (el.parentNode) el.remove(); }, animMs(300));
      if (!this._toastTimers) this._toastTimers = [];
      this._toastTimers.push(removeTimer);
      // Remove the now-fired fade timer from tracking
      this._toastTimers = this._toastTimers.filter(t => t !== fadeTimer);
    }, 2000);
    if (!this._toastTimers) this._toastTimers = [];
    this._toastTimers.push(fadeTimer);
  }

  _syncAllControls() {
    this._switchCategory(this._currentCategory);
  }

  /**
   * Shows a styled confirmation dialog inside the settings modal.
   * Replaces native confirm() for a consistent visual style.
   */
  _showConfirmDialog(title, message, onConfirm, onCancel = null) {
    // Backdrop
    const backdrop = document.createElement('div');
    backdrop.style.cssText = `
      position: fixed; inset: 0; z-index: 100;
      background: rgba(0,0,0,0.55);
      backdrop-filter: blur(6px);
      display: flex; align-items: center; justify-content: center;
      animation: settingsCardIn calc(0.25s / var(--ui-anim-speed)) ease both;
    `;

    // Card
    const card = document.createElement('div');
    card.style.cssText = `
      width: min(420px, 90vw);
      background: #1a1a1a;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 24px 60px rgba(0,0,0,0.5);
    `;

    const titleEl = document.createElement('div');
    titleEl.textContent = title;
    titleEl.style.cssText = 'font-size: 17px; font-weight: 700; color: #fff; margin-bottom: 8px;';
    card.appendChild(titleEl);

    const msgEl = document.createElement('div');
    msgEl.textContent = message;
    msgEl.style.cssText = 'font-size: 13px; color: rgba(255,255,255,0.6); line-height: 1.5; margin-bottom: 20px;';
    card.appendChild(msgEl);

    const btnWrap = document.createElement('div');
    btnWrap.style.cssText = 'display: flex; justify-content: flex-end; gap: 10px;';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '取消';
    cancelBtn.style.cssText = `
      padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600;
      background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.7);
      border: 1px solid rgba(255,255,255,0.1); cursor: pointer;
      transition: all calc(0.2s / var(--ui-anim-speed)) ease;
    `;
    cancelBtn.onmouseenter = () => {
      cancelBtn.style.background = 'rgba(255,255,255,0.12)';
      cancelBtn.style.color = '#fff';
    };
    cancelBtn.onmouseleave = () => {
      cancelBtn.style.background = 'rgba(255,255,255,0.06)';
      cancelBtn.style.color = 'rgba(255,255,255,0.7)';
    };

    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = '确定';
    confirmBtn.style.cssText = `
      padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600;
      background: rgba(185,18,63,0.15); color: #ff8a9a;
      border: 1px solid rgba(185,18,63,0.4); cursor: pointer;
      transition: all calc(0.2s / var(--ui-anim-speed)) ease;
    `;
    confirmBtn.onmouseenter = () => {
      confirmBtn.style.background = 'rgba(185,18,63,0.25)';
      confirmBtn.style.color = '#ffb3c0';
    };
    confirmBtn.onmouseleave = () => {
      confirmBtn.style.background = 'rgba(185,18,63,0.15)';
      confirmBtn.style.color = '#ff8a9a';
    };

    const close = () => { if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop); };

    cancelBtn.onclick = () => { close(); if (onCancel) onCancel(); };
    confirmBtn.onclick = () => { close(); onConfirm(); };
    backdrop.onclick = (e) => { if (e.target === backdrop) { close(); if (onCancel) onCancel(); } };

    btnWrap.appendChild(cancelBtn);
    btnWrap.appendChild(confirmBtn);
    card.appendChild(btnWrap);
    backdrop.appendChild(card);
    document.body.appendChild(backdrop);
  }

  show() {
    if (!this.container) return;
    this._syncAllControls();
    this.container.style.display = 'flex';
    requestAnimationFrame(() => {
      if (this.container) this.container.style.opacity = '1';
    });
  }

  hide() {
    if (!this.container) return;
    this.container.style.opacity = '0';
    if (this._hideTimer) clearTimeout(this._hideTimer);
    this._hideTimer = setTimeout(() => { if (this.container) this.container.style.display = 'none'; }, animMs(300));
  }

  destroy() {
    this._listeners.forEach(({ el, type, fn }) => {
      el.removeEventListener(type, fn);
    });
    this._listeners = [];
    if (this._toastTimers) { this._toastTimers.forEach(t => clearTimeout(t)); this._toastTimers = []; }
    if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; }
    if (this._saveToastTimer) { clearTimeout(this._saveToastTimer); this._saveToastTimer = null; }
    if (this._onSettingsChangedToast) {
      window.removeEventListener('settingsChanged', this._onSettingsChangedToast);
      this._onSettingsChangedToast = null;
    }
    this._tabEls.forEach(({ tab }) => {
      if (tab) { tab.onclick = null; }
    });
    this._tabEls.clear();
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.audio = null;
  }
}
