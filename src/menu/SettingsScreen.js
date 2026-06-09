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
import { onboarding } from '../core/OnboardingStore.js';


const CATEGORIES = [
  { id: 'audio',         label: '音频',  icon: '🔊' },
  { id: 'graphics',      label: '图形',  icon: '🎨' },
  { id: 'appearance',    label: '外观',  icon: '🎱' },
  { id: 'camera',        label: '相机',  icon: '📷' },
  { id: 'hud',           label: '界面',  icon: '📊' },
  { id: 'controls',      label: '控制',  icon: '🎮' },
  { id: 'replay',        label: '回放',  icon: '⏪' },
  { id: 'accessibility', label: '辅助',  icon: '♿' },
  { id: 'other',         label: '其他',  icon: '⚙️' },
  { id: 'about',         label: '关于',  icon: 'ℹ️' },
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
const BALL_STYLE_OPTIONS = [
  { value: 'standard', label: '标准' },
  { value: 'glossy', label: '高光' },
  { value: 'matte', label: '哑光' },
  { value: 'neon', label: '霓虹' },
  { value: 'retro', label: '复古' },
];
const MINIMAP_POS_OPTIONS = [
  { value: 'bottom-right', label: '右下' },
  { value: 'bottom-left', label: '左下' },
  { value: 'top-right', label: '右上' },
  { value: 'top-left', label: '左上' },
];

const TRAJECTORY_COLOR_MODE_OPTIONS = [
  { value: 'default', label: '默认' },
  { value: 'highContrast', label: '高对比' },
  { value: 'colorBlind', label: '色盲友好' },
];
const COLOR_BLIND_MODE_OPTIONS = [
  { value: 'off', label: '关闭' },
  { value: 'protanopia', label: '红色盲' },
  { value: 'deuteranopia', label: '绿色盲' },
  { value: 'tritanopia', label: '蓝色盲' },
];
const TIMER_POS_OPTIONS = [
  { value: 'top', label: '顶部' },
  { value: 'bottom', label: '底部' },
];
const TURN_TIMER_OPTIONS = [
  { value: 'off', label: '关闭' },
  { value: '30', label: '30秒' },
  { value: '60', label: '60秒' },
  { value: '90', label: '90秒' },
  { value: '120', label: '120秒' },
];
const FPS_LIMIT_OPTIONS = [
  { value: 'unlimited', label: '无限制' },
  { value: '30', label: '30 FPS' },
  { value: '60', label: '60 FPS' },
  { value: '120', label: '120 FPS' },
  { value: '144', label: '144 FPS' },
];
const LANGUAGE_OPTIONS = [
  { value: 'zh', label: '简体中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
];
const UNIT_OPTIONS = [
  { value: 'metric', label: '公制 (cm/m)' },
  { value: 'imperial', label: '英制 (in/ft)' },
];
const TABLE_THEME_OPTIONS_V2 = [
  { value: 'classic', label: '经典俱乐部' },
  { value: 'blackGold', label: '黑金奢华' },
  { value: 'blueTournament', label: '蓝色赛事' },
  { value: 'redClub', label: '红色会所' },
  { value: 'minimal', label: '极简现代' },
];
const FELT_THEME_OPTIONS = [
  { value: 'classicGreen', label: '经典绿' },
  { value: 'blue', label: '皇家蓝' },
  { value: 'red', label: '中国红' },
  { value: 'black', label: '暗夜黑' },
  { value: 'purple', label: '紫罗兰' },
];
const WOOD_THEME_OPTIONS = [
  { value: 'classic', label: '经典木' },
  { value: 'darkWalnut', label: '深胡桃' },
  { value: 'lightOak', label: '浅色橡木' },
  { value: 'blackLacquer', label: '黑漆' },
];
const METAL_TRIM_OPTIONS = [
  { value: 'nickel', label: '镍银' },
  { value: 'gold', label: '镀金' },
  { value: 'blackChrome', label: '黑铬' },
];
const POCKET_LEATHER_OPTIONS = [
  { value: 'brown', label: '棕色' },
  { value: 'black', label: '黑色' },
  { value: 'darkRed', label: '暗红' },
];
const BALL_TEXTURE_QUALITY_OPTIONS = [
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
];
const BALL_NUMBER_SIZE_OPTIONS = [
  { value: 'small', label: '小' },
  { value: 'normal', label: '正常' },
  { value: 'large', label: '大' },
];
const BALL_NUMBER_CONTRAST_OPTIONS = [
  { value: 'normal', label: '正常' },
  { value: 'high', label: '高对比' },
];
const CUE_BALL_MARK_OPTIONS = [
  { value: 'redDot', label: '红点' },
  { value: 'blueDot', label: '蓝点' },
  { value: 'plain', label: '无标记' },
];
const POCKET_NET_DETAIL_OPTIONS = [
  { value: 'off', label: '关闭' },
  { value: 'low', label: '低' },
  { value: 'high', label: '高' },
];
const ROOM_THEME_OPTIONS_V2 = [
  { value: 'club', label: '经典俱乐部' },
  { value: 'modern', label: '现代简约' },
  { value: 'tournament', label: '赛事大厅' },
  { value: 'minimal', label: '极简' },
];
const FLOOR_THEME_OPTIONS = [
  { value: 'tile', label: '瓷砖' },
  { value: 'wood', label: '木地板' },
  { value: 'dark', label: '深色' },
];
const WALL_THEME_OPTIONS = [
  { value: 'warm', label: '暖色' },
  { value: 'neutral', label: '中性' },
  { value: 'dark', label: '暗色' },
];
const ROOM_LIGHTING_QUALITY_OPTIONS = [
  { value: 'low', label: '低（仅台球灯）' },
  { value: 'medium', label: '中（简化辅助灯）' },
  { value: 'high', label: '高（完整照明）' },
];

const LAMP_STYLE_OPTIONS = [
  { value: 'classic', label: '经典' },
  { value: 'modern', label: '现代' },
  { value: 'tournament', label: '赛事' },
];
const AMBIENT_LIGHT_OPTIONS = [
  { value: 'warm', label: '暖光' },
  { value: 'neutral', label: '自然' },
  { value: 'cool', label: '冷光' },
];

const SPEED_UNIT_OPTIONS = [
  { value: 'kph', label: '公里/小时' },
  { value: 'mph', label: '英里/小时' },
  { value: 'mps', label: '米/秒' },
];

const TABLE_PROFILE_OPTIONS = [
  { value: 'pool9ft', label: 'WPA 9尺 锦标赛' },
  { value: 'pool8ft', label: 'WPA 8尺 / Pro 8' },
  { value: 'bar7ft', label: '7尺 酒吧台' },
  { value: 'chinese8', label: '中式八球' },
];

export class SettingsScreen {
  constructor(onBack, mountContainer = null) {
    this.onBack = onBack;
    this._mountContainer = mountContainer;
    this.audio = null;
    this.container = null;
    this._listeners = [];
    this._currentCategory = 'audio';
    this._tabEls = new Map();
    this._contentArea = null;
    this._toastTimers = [];
    this._hideTimer = null;
    this._saveToastTimer = null;
    this._settingsTipTimer = null;
    this._confirmHandlers = new Set();
    this._lockedKeys = new Set();
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

  setBackHandler(onBack) {
    this.onBack = onBack;
  }

  setZIndex(zIndex) {
    if (this.container) this.container.style.zIndex = String(zIndex);
  }

  setAudioManager(audioManager) {
    this.audio = audioManager;
    if (this.audio) {
      this.audio.toggleSound(settings.get('soundEnabled'));
      this.audio.setMasterVolume(settings.get('masterVolume'));
      this.audio.setMusicVolume(settings.get('musicVolume'));
      this.audio.setSFXVolume(settings.get('sfxVolume'));
      if (this.audio.setAmbientVolume) {
        this.audio.setAmbientVolume((settings.get('ambientVolumeScale') ?? 1.0) * 100);
      }
    }
    this._syncAllControls();
  }

  setLockedKeys(keys) {
    if (keys == null) {
      this._lockedKeys = new Set();
    } else if (Array.isArray(keys) || keys instanceof Set) {
      this._lockedKeys = new Set(keys);
    } else {
      this._lockedKeys = new Set();
    }
  }

  _isLocked(key) {
    return this._lockedKeys.has(key);
  }

  _buildUI() {
    const layer = this._mountContainer || document.getElementById('menu-layer');
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
      badge.textContent = cat.icon;
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
    this._contentArea.className = 'settings-content-wrap';
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
    if (!this._contentArea) return;
    if (id === this._currentCategory) return;
    if (this._switchTimer) { clearTimeout(this._switchTimer); this._switchTimer = null; }
    // Cancel any pending keybinding listen to prevent global listener leak
    keyBindings.cancelListening();
    // Dismiss any open confirmation dialogs before switching categories
    document.querySelectorAll('.settings-confirm-backdrop').forEach(el => {
      if (el._keydownHandler) {
        window.removeEventListener('keydown', el._keydownHandler);
        this._confirmHandlers.delete(el._keydownHandler);
      }
      if (el.parentNode) el.parentNode.removeChild(el);
    });
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

    // Defensive: ensure switching class is cleared (timer already cancelled above)
    if (this._contentArea) this._contentArea.classList.remove('switching');

    // Lightweight fade transition: dim content, swap, restore opacity
    const reduced = document.documentElement.classList.contains('reduce-motion');
    if (reduced) {
      this._contentArea.innerHTML = '';
      const builder = `_build${id[0].toUpperCase() + id.slice(1)}Content`;
      if (typeof this[builder] === 'function') {
        this[builder]();
      }
      return;
    }

    this._contentArea.classList.add('switching');
    this._switchTimer = setTimeout(() => {
      this._switchTimer = null;
      if (!this.container) return; // defensive: destroyed while switching
      this._contentArea.innerHTML = '';
      this._contentArea.scrollTop = 0;
      const builder = `_build${id[0].toUpperCase() + id.slice(1)}Content`;
      if (typeof this[builder] === 'function') {
        this[builder]();
      }
      requestAnimationFrame(() => {
        if (this._contentArea) this._contentArea.classList.remove('switching');
      });
    }, animMs(120));
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

    this._rowSlider('环境音效', Math.round((settings.get('ambientVolumeScale') ?? 1.0) * 100), 0, 100, '%', (v) => {
      settings.set('ambientVolumeScale', v / 100);
      if (this.audio) this.audio.setAmbientVolume && this.audio.setAmbientVolume(v);
    });

    this._rowSlider('击球反馈音', Math.round((settings.get('hitFeedbackVolumeScale') ?? 1.0) * 100), 0, 100, '%', (v) => {
      settings.set('hitFeedbackVolumeScale', v / 100);
    });

    this._row('震动反馈', this._createSwitch(settings.get('vibrationEnabled'), (v) => {
      settings.set('vibrationEnabled', v);
    }));

    this._row('低延迟模式',
      this._createSwitch(settings.get('lowLatencyMode'), (v) => {
        settings.set('lowLatencyMode', v);
        if (this.audio && this.audio.reinit) this.audio.reinit();
      }),
      '减少音频缓冲，可能降低音质'
    );
  }

  _buildGraphicsContent() {
    this._sectionTitle('图形');
    this._sectionSubtitle('控制画面质量与视觉特效');

    this._row('轨迹预测线',
      this._createSwitch(settings.get('trajectoryEnabled'), (v) => {
        settings.set('trajectoryEnabled', v);
        window.dispatchEvent(new CustomEvent('toggleTrajectory', { detail: v }));
      }, this._isLocked('trajectoryEnabled'), '由房主/比赛锁定'),
      this._isLocked('trajectoryEnabled') ? '由房主/比赛锁定' : '联机/竞技模式可能由房主统一锁定',
      this._isLocked('trajectoryEnabled')
    );
    this._rowSlider('轨迹透明度', Math.round((settings.get('trajectoryOpacity') ?? 0.7) * 100), 20, 100, '%', (v) => settings.set('trajectoryOpacity', v / 100));
    this._rowSelect('轨迹颜色模式', TRAJECTORY_COLOR_MODE_OPTIONS, settings.get('trajectoryColorMode') || 'default', (v) => settings.set('trajectoryColorMode', v));
    this._row('轨迹动画', this._createSwitch(settings.get('trajectoryAnimationEnabled') !== false, (v) => settings.set('trajectoryAnimationEnabled', v)));

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
    this._row('碰撞火花', this._createSwitch(settings.get('collisionSparksEnabled') !== false, (v) => settings.set('collisionSparksEnabled', v)));
    this._row('进袋喷泉', this._createSwitch(settings.get('pocketFountainEnabled') !== false, (v) => settings.set('pocketFountainEnabled', v)));
    this._row('击球冲击波', this._createSwitch(settings.get('impactShockwaveEnabled') !== false, (v) => settings.set('impactShockwaveEnabled', v)));
    this._row('球回移动画', this._createSwitch(settings.get('ballReturnAnimationEnabled') !== false, (v) => settings.set('ballReturnAnimationEnabled', v)));
    this._rowSlider('拖尾淡出时间', Math.round((settings.get('trailFadeDuration') ?? 5.0) * 10), 20, 100, '', (v) => {
      settings.set('trailFadeDuration', v / 10);
    }, '', (v) => (v / 10).toFixed(1) + 's');

    // ── Rendering ──
    this._sectionTitle('渲染', true);
    this._rowDisabled('垂直同步', this._createDisabledSwitch(settings.get('vSync'), () => {}, '由浏览器帧率控制，暂不可调'), '由浏览器帧率控制，暂不可调', '暂不可用');
    this._rowSelect('帧率限制', FPS_LIMIT_OPTIONS, settings.get('fpsLimit'), (v) => settings.set('fpsLimit', v));
    this._rowDisabled('渲染缩放', this._createDisabledValue(String((settings.get('renderScale') ?? 1.0).toFixed(1)) + 'x'), '修改后需刷新页面生效', '需重启');
    this._rowDisabled('视野范围 (FOV)', this._createDisabledValue(String(settings.get('cameraFov') ?? 45) + '°'), '', '实时生效');
    this._rowDisabled('瞄准 FOV', this._createDisabledSwitch(settings.get('fovZoomed') !== false, () => {}), '', '未实现');
    this._rowDisabled('动态 FOV', this._createDisabledSwitch(settings.get('dynamicFov') !== false, () => {}), '', '未实现');

    // ── Post-processing ──
    this._sectionTitle('后处理', true);
    this._rowDisabled('后处理效果', this._createDisabledSwitch(settings.get('postProcess'), () => {}), '需要 EffectComposer 支持');
    this._rowDisabled('泛光 (Bloom)', this._createDisabledSwitch(settings.get('bloom'), () => {}));
    this._rowDisabled('色差效果', this._createDisabledSwitch(settings.get('chromaticAberration'), () => {}));
    this._rowDisabled('胶片颗粒', this._createDisabledSwitch(settings.get('filmGrain'), () => {}));
    this._rowDisabled('暗角效果', this._createDisabledSwitch(settings.get('vignette'), () => {}));
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
    this._rowSliderIn(shotWrap, '击球力度灵敏度', Math.round(settings.get('shotPowerSens') * 100), 50, 200, '%', (v) => settings.set('shotPowerSens', v / 100), this._isLocked('shotPowerSens') ? '由房主/比赛锁定' : '联机/竞技模式可能由房主统一锁定', null, this._isLocked('shotPowerSens'));
    this._rowDisabledIn(shotWrap, '瞄准响应速度', this._createDisabledValue(String(Math.round(settings.get('aimSens') * 100)) + '%'), '键盘瞄准系统尚未实现');
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
    const currentPreset = (keyBindings.getCurrentPreset() || '').split(':')[0] || 'win';
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
    const displayPreset = (keyBindings.getCurrentPreset() || '').split(':')[0] || 'win';
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

  _buildAppearanceContent() {
    this._sectionTitle('外观');
    this._sectionSubtitle('球桌、球体与房间视觉风格');

    // ── Table ──
    const tableWrap = this._createCollapsible('球桌', true);
    this._rowSelectIn(tableWrap, '整体主题', TABLE_THEME_OPTIONS_V2, settings.get('tableTheme'), (v) => settings.set('tableTheme', v));
    this._rowSelectIn(tableWrap, '台呢颜色', FELT_THEME_OPTIONS, settings.get('feltTheme'), (v) => settings.set('feltTheme', v));
    this._rowSelectIn(tableWrap, '木材风格', WOOD_THEME_OPTIONS, settings.get('woodTheme'), (v) => settings.set('woodTheme', v));
    this._rowSelectIn(tableWrap, '金属包边', METAL_TRIM_OPTIONS, settings.get('metalTrimTheme'), (v) => settings.set('metalTrimTheme', v));
    this._rowToggleIn(tableWrap, '台呢绒感', settings.get('clothNapEnabled'), (v) => settings.set('clothNapEnabled', v));
    this._rowSliderIn(tableWrap, '台呢纹理强度', Math.round((settings.get('clothPatternStrength') ?? 0.35) * 100), 0, 100, '%', (v) => settings.set('clothPatternStrength', v / 100));
    this._rowToggleIn(tableWrap, '磨损效果', settings.get('clothWearEnabled'), (v) => settings.set('clothWearEnabled', v));

    // ── Balls ──
    const ballWrap = this._createCollapsible('球', true);
    this._rowSelectIn(ballWrap, '球体风格', BALL_STYLE_OPTIONS, settings.get('ballStyle'), (v) => settings.set('ballStyle', v));
    this._rowSelectIn(ballWrap, '贴图质量', BALL_TEXTURE_QUALITY_OPTIONS, settings.get('ballTextureQuality'), (v) => settings.set('ballTextureQuality', v));
    this._rowToggleIn(ballWrap, '显示号码', settings.get('ballNumbers'), (v) => settings.set('ballNumbers', v));
    this._rowSelectIn(ballWrap, '号码大小', BALL_NUMBER_SIZE_OPTIONS, settings.get('ballNumberSize'), (v) => settings.set('ballNumberSize', v));
    this._rowSelectIn(ballWrap, '号码对比度', BALL_NUMBER_CONTRAST_OPTIONS, settings.get('ballNumberContrast'), (v) => settings.set('ballNumberContrast', v));
    this._rowSelectIn(ballWrap, '白球标记', CUE_BALL_MARK_OPTIONS, settings.get('cueBallMarkStyle'), (v) => settings.set('cueBallMarkStyle', v));

    // ── Pockets ──
    const pocketWrap = this._createCollapsible('袋口', true);
    this._rowSelectIn(pocketWrap, '网袋细节', POCKET_NET_DETAIL_OPTIONS, settings.get('pocketNetDetail'), (v) => settings.set('pocketNetDetail', v));
    this._rowSelectIn(pocketWrap, '皮革颜色', POCKET_LEATHER_OPTIONS, settings.get('pocketLeatherTheme'), (v) => settings.set('pocketLeatherTheme', v));

    // ── Room ──
    const roomWrap = this._createCollapsible('房间', true);
    this._rowSelectIn(roomWrap, '房间主题', ROOM_THEME_OPTIONS_V2, settings.get('roomTheme'), (v) => settings.set('roomTheme', v));
    this._rowSelectIn(roomWrap, '地板材质', FLOOR_THEME_OPTIONS, settings.get('floorTheme'), (v) => settings.set('floorTheme', v));
    this._rowSelectIn(roomWrap, '墙壁色调', WALL_THEME_OPTIONS, settings.get('wallTheme'), (v) => settings.set('wallTheme', v));
    this._rowToggleIn(roomWrap, '装饰道具', settings.get('decorativePropsEnabled'), (v) => settings.set('decorativePropsEnabled', v));
    this._rowToggleIn(roomWrap, '墙面装饰', settings.get('wallDecorEnabled'), (v) => settings.set('wallDecorEnabled', v));
    this._rowToggleIn(roomWrap, '植物', settings.get('plantsEnabled'), (v) => settings.set('plantsEnabled', v));
    this._rowToggleIn(roomWrap, '天花板网格', settings.get('ceilingGridEnabled'), (v) => settings.set('ceilingGridEnabled', v));

    // ── Lighting ──
    const lightWrap = this._createCollapsible('灯光', true);
    this._rowSelectIn(lightWrap, '房间灯光质量', ROOM_LIGHTING_QUALITY_OPTIONS, settings.get('roomLightingQuality'), (v) => settings.set('roomLightingQuality', v));
    this._rowSelectIn(lightWrap, '灯具风格', LAMP_STYLE_OPTIONS, settings.get('lampStyle'), (v) => settings.set('lampStyle', v));
    this._rowSelectIn(lightWrap, '环境光色调', AMBIENT_LIGHT_OPTIONS, settings.get('ambientLightTheme'), (v) => settings.set('ambientLightTheme', v));
    this._rowSliderIn(lightWrap, '桌面灯光强度', Math.round((settings.get('tableLightIntensity') ?? 1.0) * 100), 20, 200, '%', (v) => settings.set('tableLightIntensity', v / 100));

    // ── Cue (non-collapsible, quick access) ──
    this._sectionTitle('球杆', true);
    this._rowSelect('球杆皮肤', CUE_THEME_OPTIONS, settings.get('cueTheme'), (v) => settings.set('cueTheme', v));
  }

  _buildCameraContent() {
    this._sectionTitle('相机');
    this._sectionSubtitle('视角、跟随与运动偏好');

    this._rowSelect('默认视角', CAMERA_OPTIONS, settings.get('defaultCamera'), (v) => settings.set('defaultCamera', v));
    this._row('自动追踪白球', this._createSwitch(settings.get('autoFollowCueBall'), (v) => settings.set('autoFollowCueBall', v)));
    this._rowSlider('相机过渡速度', Math.round(settings.get('cameraDamping') * 100), 30, 200, '%', (v) => settings.set('cameraDamping', v / 100));
    this._row('击球后自动复位', this._createSwitch(settings.get('cameraAutoResetAfterShot'), (v) => settings.set('cameraAutoResetAfterShot', v)));
    this._rowSlider('复位延迟', Math.round(settings.get('cameraResetDelay') * 10), 10, 60, '', (v) => settings.set('cameraResetDelay', v / 10), '', (v) => (v / 10).toFixed(1) + 's');
    this._row('自由相机边界', this._createSwitch(settings.get('cameraCollisionAvoidance'), (v) => settings.set('cameraCollisionAvoidance', v)));
    this._row('击球时隐藏球杆', this._createSwitch(settings.get('hideCueOnShot'), (v) => settings.set('hideCueOnShot', v)));
    this._row('俯视角度', this._createSwitch(settings.get('topDownAngle'), (v) => settings.set('topDownAngle', v)));
    this._row('击球震动', this._createSwitch(settings.get('cameraShake'), (v) => settings.set('cameraShake', v)));
    this._rowSlider('震动强度', Math.round(settings.get('screenShakeIntensity') * 100), 0, 200, '%', (v) => settings.set('screenShakeIntensity', v / 100));
    this._row('平滑插值', this._createSwitch(settings.get('cameraSmoothing'), (v) => settings.set('cameraSmoothing', v)));
    this._rowSlider('插值因子', Math.round(settings.get('cameraSmoothFactor') * 100), 10, 100, '%', (v) => settings.set('cameraSmoothFactor', v / 100));
  }

  _buildHudContent() {
    this._sectionTitle('界面');
    this._sectionSubtitle('HUD、小地图与信息显示');

    this._row('显示小地图', this._createSwitch(settings.get('minimapEnabled') !== false, (v) => settings.set('minimapEnabled', v), this._isLocked('minimapEnabled'), '由房主/比赛锁定'), this._isLocked('minimapEnabled') ? '由房主/比赛锁定' : '联机/竞技模式可能由房主统一锁定', this._isLocked('minimapEnabled'));
    this._rowSlider('小地图尺寸', settings.get('minimapSize') || 140, 80, 260, 'px', (v) => settings.set('minimapSize', v));
    this._rowSlider('小地图透明度', Math.round((settings.get('minimapOpacity') ?? 0.85) * 100), 20, 100, '%', (v) => settings.set('minimapOpacity', v / 100));
    this._rowSelect('小地图位置', MINIMAP_POS_OPTIONS, settings.get('minimapPosition') || 'bottom-right', (v) => settings.set('minimapPosition', v));
    this._rowSlider('小地图球大小', Math.round((settings.get('minimapBallSize') ?? 1.0) * 100), 50, 200, '%', (v) => settings.set('minimapBallSize', v / 100));
    this._row('小地图白球拖尾', this._createSwitch(settings.get('minimapShowCueTrail') !== false, (v) => settings.set('minimapShowCueTrail', v)));
    this._rowSlider('小地图拖尾长度', settings.get('minimapTrailLength') || 40, 10, 100, '', (v) => settings.set('minimapTrailLength', v));
    this._row('小地图高对比度', this._createSwitch(settings.get('minimapHighContrast') === true, (v) => settings.set('minimapHighContrast', v)), '增强球和边界可见度');
    this._rowDisabled('显示球号标签', this._createDisabledSwitch(settings.get('showBallLabels'), () => {}), '3D 场景中尚未实现球号标签显示');
    this._row('显示力度条', this._createSwitch(settings.get('showShotPowerPercent'), (v) => settings.set('showShotPowerPercent', v)));
    this._row('显示旋转指示', this._createSwitch(settings.get('showSpinIndicator'), (v) => settings.set('showSpinIndicator', v)));
    this._row('显示剩余球数', this._createSwitch(settings.get('showRemainingBalls'), (v) => settings.set('showRemainingBalls', v)));
    this._row('显示连击计数', this._createSwitch(settings.get('showComboCounter'), (v) => {
      settings.set('showComboCounter', v);
      if (window.dispatchEvent) window.dispatchEvent(new CustomEvent('toggleComboCounter', { detail: v }));
    }), '击球连续进球时显示');
    this._row('显示准星', this._createSwitch(settings.get('showCrosshair'), (v) => settings.set('showCrosshair', v), this._isLocked('showCrosshair'), '由房主/比赛锁定'), this._isLocked('showCrosshair') ? '由房主/比赛锁定' : '联机/竞技模式可能由房主统一锁定', this._isLocked('showCrosshair'));
    this._row('显示击球统计', this._createSwitch(settings.get('statsPanelEnabled'), (v) => settings.set('statsPanelEnabled', v)));
    this._row('紧凑 HUD', this._createSwitch(settings.get('compactHud'), (v) => settings.set('compactHud', v)), '压缩底部 HUD 高度和按钮尺寸');
    this._rowSlider('UI 缩放', Math.round(settings.get('hudScale') * 100), 50, 200, '%', (v) => settings.set('hudScale', v / 100));
    this._rowSelect('计时器位置', TIMER_POS_OPTIONS, settings.get('timerPosition') || 'top', (v) => settings.set('timerPosition', v));
    this._row('显示 FPS', this._createSwitch(settings.get('showFPS'), (v) => settings.set('showFPS', v)));
    this._row('浮动文字', this._createSwitch(settings.get('floatingTextEnabled') !== false, (v) => settings.set('floatingTextEnabled', v)), '进球/犯规时显示浮动提示');
    this._rowSelect('回合计时器', TURN_TIMER_OPTIONS, settings.get('turnTimer') || 'off', (v) => settings.set('turnTimer', v), this._isLocked('turnTimer') ? '由房主/比赛锁定' : '联机/竞技模式可能由房主统一锁定', this._isLocked('turnTimer'), '由房主/比赛锁定');
  }

  _buildReplayContent() {
    this._sectionTitle('回放与分析');
    this._sectionSubtitle('回放记录与击球分析');

    this._row('击球分析器', this._createSwitch(settings.get('shotAnalyzerEnabled'), (v) => settings.set('shotAnalyzerEnabled', v)), '每次击球后显示详细分析面板');
    this._row('自动保存回放', this._createSwitch(settings.get('autoSaveReplays'), (v) => settings.set('autoSaveReplays', v)), '自动将击球回放保存到回放库');
    this._rowSlider('最大回放数', settings.get('replayMaxSaved'), 10, 100, ' 条', (v) => settings.set('replayMaxSaved', v), '超过上限时自动删除最旧的回放');
    this._rowDisabled('显示击球数据', this._createDisabledSwitch(settings.get('showShotData'), () => {}), '数据统计面板尚未实现');
    this._rowDisabled('显示热力图', this._createDisabledSwitch(settings.get('showHeatmap'), () => {}), '数据统计面板尚未实现');
    this._rowDisabled('显示胜率预测', this._createDisabledSwitch(settings.get('showWinProbability'), () => {}), '数据统计面板尚未实现');
    this._rowDisabled('显示详细统计', this._createDisabledSwitch(settings.get('showDetailedStats'), () => {}), '数据统计面板尚未实现');
    this._rowDisabled('击球历史追踪', this._createDisabledSwitch(settings.get('shotHistoryTracking'), () => {}), '数据统计面板尚未实现');
    this._rowSlider('回放速度', Math.round((settings.get('replaySpeed') ?? 1.0) * 4), 1, 8, 'x', (v) => settings.set('replaySpeed', v / 4), '回放库和轨迹图的默认播放速度', (v) => (v / 4).toFixed(2) + 'x');

    this._sectionTitle('即时回放');
    this._sectionSubtitle('击球后自动/手动回放上一杆');
    this._row('启用即时回放', this._createSwitch(settings.get('instantReplayEnabled') !== false, (v) => settings.set('instantReplayEnabled', v)), '按 R 键或在 AIM 状态点击按钮回放上一杆');
    this._row('自动回放精彩球', this._createSwitch(settings.get('autoInstantReplay') !== false, (v) => settings.set('autoInstantReplay', v)), '精彩进球（评分达标）后自动进入慢动作回放');
    this._rowSlider('回放触发阈值', settings.get('instantReplayThreshold') || 35, 10, 80, ' 分', (v) => settings.set('instantReplayThreshold', v), '分数越高，自动回放越严格', (v) => `${v} 分`);
  }

  _buildAccessibilityContent() {
    this._sectionTitle('辅助功能');
    this._sectionSubtitle('可访问性与操作辅助');

    const cbmVal = settings.get('colorBlindMode') || 'off';
    const cbmLabel = COLOR_BLIND_MODE_OPTIONS.find(o => o.value === cbmVal)?.label || '关闭';
    this._rowDisabled('色盲模式', this._createDisabledValue(cbmLabel), '色彩滤镜系统尚未实现');
    this._row('高对比度', this._createSwitch(settings.get('highContrastUI'), (v) => settings.set('highContrastUI', v)));
    this._row('大字体模式', this._createSwitch(settings.get('largeTextMode'), (v) => settings.set('largeTextMode', v)));
    this._rowSlider('界面透明度', Math.round(settings.get('hudOpacity') * 100), 30, 100, '%', (v) => settings.set('hudOpacity', v / 100));
    this._row('减弱动态效果', this._createSwitch(settings.get('reducedMotion'), (v) => settings.set('reducedMotion', v)));
    this._rowDisabled('单手柄模式', this._createDisabledSwitch(settings.get('singleHandMode'), () => {}), '需要触屏/手柄输入系统');
    this._rowDisabled('左撇子模式', this._createDisabledSwitch(settings.get('leftHandMode'), () => {}), '需要 UI 布局镜像系统');
    this._rowDisabled('自动提示', this._createDisabledSwitch(settings.get('autoHints'), () => {}), '需要 AI 提示引擎');
    this._rowDisabled('提示频率', this._createDisabledSwitch(false, () => {}), '需要 AI 提示引擎');
    this._row('击球确认', this._createSwitch(settings.get('confirmShotOnRelease'), (v) => settings.set('confirmShotOnRelease', v)));
    this._rowDisabled('语音播报', this._createDisabledSwitch(settings.get('voiceAnnounce'), () => {}), '需要 Web Speech API 集成');
    this._rowDisabled('音效可视化', this._createDisabledSwitch(settings.get('soundCueVisualHints'), () => {}), '需要音频频谱分析系统');
    this._rowDisabled('聚焦模式', this._createDisabledSwitch(settings.get('focusMode'), () => {}), '需要场景模糊渲染管线');
    this._rowDisabled('聚焦透明度', this._createDisabledSwitch(false, () => {}), '需要场景模糊渲染管线');
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
          if (this.audio) {
            this.audio.toggleSound(settings.get('soundEnabled'));
            this.audio.setMasterVolume(settings.get('masterVolume'));
            this.audio.setSFXVolume(settings.get('sfxVolume'));
            this.audio.setMusicVolume(settings.get('musicVolume'));
            if (this.audio.setAmbientVolume) this.audio.setAmbientVolume((settings.get('ambientVolumeScale') ?? 1.0) * 100);
            if (this.audio.reinit) this.audio.reinit();
          }
          this._toast('已恢复为默认设置');
        }
      );
    });

    // ── Game Preferences ──
    this._sectionTitle('游戏偏好', true);
    this._sectionSubtitle('个人化的游戏行为设置');
    this._rowDisabled('快速发球', this._createDisabledSwitch(settings.get('quickBreak'), () => {}), '需要发球动画跳过系统');
    this._rowDisabled('自动跳过动画', this._createDisabledSwitch(settings.get('autoSkipAnimation'), () => {}), '需要回合间动画系统');
    this._rowDisabled('跳过对手回合', this._createDisabledSwitch(settings.get('skipOpponentTurn'), () => {}), '需要 AI 自动代打系统');
    this._rowDisabled('显示对手轨迹', this._createDisabledSwitch(settings.get('showOpponentTrajectory'), () => {}), '需要对手轨迹预测系统');
    this._rowSelect('默认球桌 (8球)', TABLE_PROFILE_OPTIONS, settings.get('defaultTableProfile8Ball'), (v) => settings.set('defaultTableProfile8Ball', v), '仅影响新对局的默认选择，比赛/联机中由房主锁定');
    this._rowSelect('默认球桌 (9球)', TABLE_PROFILE_OPTIONS.filter(o => o.value !== 'chinese8'), settings.get('defaultTableProfile9Ball'), (v) => settings.set('defaultTableProfile9Ball', v), '仅影响新对局的默认选择，比赛/联机中由房主锁定');
    this._rowSelect('默认球桌 (练习)', TABLE_PROFILE_OPTIONS, settings.get('defaultTableProfileFreeplay'), (v) => settings.set('defaultTableProfileFreeplay', v), '仅影响新对局的默认选择');
    this._rowDisabled('语言', this._createDisabledValue('简体中文'), '当前仅支持简体中文');
    this._rowDisabled('距离单位', this._createDisabledValue('公制 (cm/m)'));
    this._rowDisabled('速度单位', this._createDisabledValue('公里/小时'));
    if (settings.get('devMode')) {
      this._row('显示物理调试', this._createSwitch(settings.get('showPhysicsDebug'), (v) => settings.set('showPhysicsDebug', v)));
    }
    this._row('开发者模式', this._createSwitch(settings.get('devMode'), (v) => {
      settings.set('devMode', v);
      this._syncAllControls();
    }));

    // ── Import / Export ──
    this._sectionTitle('配置管理', true);
    this._sectionSubtitle('导出或导入设置 JSON');

    const exportWrap = document.createElement('div');
    exportWrap.style.cssText = 'display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px;';
    const exportClipboardBtn = this._presetButton('复制到剪贴板', () => {
      const data = JSON.stringify(settings.getAll(), null, 2);
      if (navigator.clipboard) {
        navigator.clipboard.writeText(data)
          .then(() => this._toast('配置已复制到剪贴板'))
          .catch(() => this._toast('复制失败，请手动复制'));
      } else {
        this._toast('当前浏览器不支持剪贴板 API');
      }
    });
    const exportFileBtn = this._presetButton('下载文件', () => {
      const data = JSON.stringify(settings.getAll(), null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'billiards-settings.json';
      a.click();
      if (this._blobRevokeTimer) clearTimeout(this._blobRevokeTimer);
      this._blobRevokeTimer = setTimeout(() => { URL.revokeObjectURL(url); this._blobRevokeTimer = null; }, 60000);
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
        const allKeys = Object.keys(settings.getAll());
        Object.keys(data).forEach((key) => {
          if (allKeys.includes(key)) {
            settings.set(key, data[key]);
            count++;
          }
        });
        this._toast(`已导入 ${count} 项配置`);
        this._syncAllControls();
        if (this.audio) {
          this.audio.toggleSound(settings.get('soundEnabled'));
          this.audio.setMasterVolume(settings.get('masterVolume'));
          this.audio.setSFXVolume(settings.get('sfxVolume'));
          this.audio.setMusicVolume(settings.get('musicVolume'));
          if (this.audio.setAmbientVolume) this.audio.setAmbientVolume((settings.get('ambientVolumeScale') ?? 1.0) * 100);
          if (this.audio.reinit) this.audio.reinit();
        }
        // Note: importText is gone after _syncAllControls rebuilds the DOM, so no need to clear
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
        if (!this.container) return;
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

    this._button('重置新手引导', () => {
      this._showConfirmDialog(
        '重置新手引导',
        '确定要重新显示所有新手引导提示吗？下次进入游戏、犯规或打开设置时会再次显示。',
        () => {
          onboarding.reset();
          this._toast('新手引导已重置');
        }
      );
    });

    this._button('清除本地缓存', () => {
      this._showConfirmDialog(
        '清除本地缓存',
        '确定要清除所有本地存储的数据吗？包括设置、成就、回放记录等。此操作不可撤销。',
        () => {
          try {
            const keys = [];
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (k && k.startsWith('billiards_')) keys.push(k);
            }
            keys.forEach(k => localStorage.removeItem(k));
            this._toast('本地缓存已清除，刷新后生效');
          } catch (e) {
            console.warn('[SettingsScreen] Failed to clear localStorage:', e);
            this._toast('清除失败：浏览器可能限制了本地存储访问');
          }
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
      const onLinkEnter = () => {
        a.style.background = 'rgba(255,255,255,0.12)';
        a.style.borderColor = 'rgba(255,255,255,0.25)';
        a.style.color = '#fff';
      };
      const onLinkLeave = () => {
        a.style.background = 'rgba(255,255,255,0.06)';
        a.style.borderColor = 'rgba(255,255,255,0.1)';
        a.style.color = 'rgba(255,255,255,0.65)';
      };
      a.addEventListener('mouseenter', onLinkEnter);
      a.addEventListener('mouseleave', onLinkLeave);
      this._listeners.push({ el: a, type: 'mouseenter', fn: onLinkEnter });
      this._listeners.push({ el: a, type: 'mouseleave', fn: onLinkLeave });
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

  _row(label, control, tooltip = '', disabled = false) {
    const row = document.createElement('div');
    row.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
      padding: 14px 0; border-bottom: 1px solid rgba(255,255,255,0.06);
      ${disabled ? 'opacity:0.45; cursor:not-allowed;' : ''}
    `;
    if (disabled) row.title = tooltip || '由房主/比赛锁定';
    const left = document.createElement('div');
    left.style.cssText = 'display: flex; flex-direction: column; gap: 2px;';
    const lblWrap = document.createElement('div');
    lblWrap.style.cssText = 'display: flex; align-items: center; gap: 6px;';
    const lbl = document.createElement('span');
    lbl.textContent = label;
    lbl.style.cssText = 'font-size: 15px; font-weight: 500; color: rgba(255,255,255,0.85);';
    lblWrap.appendChild(lbl);
    if (disabled) {
      const badge = document.createElement('span');
      badge.textContent = '🔒';
      badge.title = tooltip || '由房主/比赛锁定';
      badge.style.cssText = 'font-size:11px;color:rgba(216,177,95,0.9);cursor:help;';
      lblWrap.appendChild(badge);
    }
    left.appendChild(lblWrap);
    if (tooltip) {
      const tip = document.createElement('span');
      tip.textContent = tooltip;
      tip.style.cssText = 'font-size: 11px; color: rgba(255,255,255,0.35);';
      left.appendChild(tip);
    }
    row.appendChild(left);
    row.appendChild(control);
    this._contentArea.appendChild(row);
  }

  _rowSlider(label, value, min, max, unit, onChange, tooltip = '', formatLabel = null) {
    const row = document.createElement('div');
    row.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
      padding: 14px 0; border-bottom: 1px solid rgba(255,255,255,0.06);
      gap: 20px;
    `;
    const left = document.createElement('div');
    left.style.cssText = 'display: flex; flex-direction: column; gap: 2px; flex-shrink: 0;';
    const lbl = document.createElement('span');
    lbl.textContent = label;
    lbl.style.cssText = 'font-size: 15px; font-weight: 500; color: rgba(255,255,255,0.85);';
    left.appendChild(lbl);
    if (tooltip) {
      const tip = document.createElement('span');
      tip.textContent = tooltip;
      tip.style.cssText = 'font-size: 11px; color: rgba(255,255,255,0.35);';
      left.appendChild(tip);
    }
    row.appendChild(left);

    const slider = this._createSlider(value, min, max, unit, onChange, formatLabel);
    slider.style.flex = '1';
    slider.style.maxWidth = '320px';
    row.appendChild(slider);
    this._contentArea.appendChild(row);
  }

  _rowSliderIn(container, label, value, min, max, unit, onChange, tooltip = '', formatLabel = null, disabled = false) {
    const row = document.createElement('div');
    row.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.06);
      gap: 16px;
      ${disabled ? 'opacity:0.45; cursor:not-allowed;' : ''}
    `;
    if (disabled) row.title = tooltip || '由房主/比赛锁定';
    const left = document.createElement('div');
    left.style.cssText = 'display: flex; flex-direction: column; gap: 2px; flex-shrink: 0;';
    const lblWrap = document.createElement('div');
    lblWrap.style.cssText = 'display: flex; align-items: center; gap: 6px;';
    const lbl = document.createElement('span');
    lbl.textContent = label;
    lbl.style.cssText = 'font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.8);';
    lblWrap.appendChild(lbl);
    if (disabled) {
      const badge = document.createElement('span');
      badge.textContent = '🔒';
      badge.title = tooltip || '由房主/比赛锁定';
      badge.style.cssText = 'font-size:11px;color:rgba(216,177,95,0.9);cursor:help;';
      lblWrap.appendChild(badge);
    }
    left.appendChild(lblWrap);
    if (tooltip) {
      const tip = document.createElement('span');
      tip.textContent = tooltip;
      tip.style.cssText = 'font-size: 11px; color: rgba(255,255,255,0.35);';
      left.appendChild(tip);
    }
    row.appendChild(left);
    const slider = this._createSlider(value, min, max, unit, onChange, formatLabel, disabled, tooltip || '由房主/比赛锁定');
    slider.style.flex = '1';
    slider.style.maxWidth = '260px';
    row.appendChild(slider);
    container.appendChild(row);
  }

  _rowToggleIn(container, label, checked, onChange, tooltip = '') {
    const row = document.createElement('div');
    row.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.06);
    `;
    const left = document.createElement('div');
    left.style.cssText = 'display: flex; flex-direction: column; gap: 2px;';
    const lbl = document.createElement('span');
    lbl.textContent = label;
    lbl.style.cssText = 'font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.8);';
    left.appendChild(lbl);
    if (tooltip) {
      const tip = document.createElement('span');
      tip.textContent = tooltip;
      tip.style.cssText = 'font-size: 11px; color: rgba(255,255,255,0.35);';
      left.appendChild(tip);
    }
    row.appendChild(left);
    row.appendChild(this._createSwitch(checked, onChange));
    container.appendChild(row);
  }

  _createDisabledSwitch(checked, onChange, title = '此功能尚未实现，敬请期待') {
    // Always use a no-op callback so disabled controls cannot mutate settings,
    // even if the user bypasses the disabled state via DevTools.
    const wrap = this._createSwitch(checked, () => {});
    wrap.style.opacity = '0.45';
    wrap.style.cursor = 'not-allowed';
    wrap.title = title;
    const input = wrap.querySelector('input[type="checkbox"]');
    if (input) {
      input.disabled = true;
    }
    return wrap;
  }

  _createDisabledValue(text) {
    const el = document.createElement('span');
    el.textContent = text;
    el.style.cssText = `
      font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.35);
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
      border-radius: 6px; padding: 4px 10px; letter-spacing: 0.3px;
      flex-shrink: 0;
    `;
    return el;
  }

  _rowDisabled(label, control, tooltip = '', badgeText = '未实现') {
    const row = document.createElement('div');
    row.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
      padding: 14px 0; border-bottom: 1px solid rgba(255,255,255,0.06);
      opacity: 0.5;
    `;
    const left = document.createElement('div');
    left.style.cssText = 'display: flex; flex-direction: column; gap: 2px;';
    const lblWrap = document.createElement('div');
    lblWrap.style.cssText = 'display: flex; align-items: center; gap: 8px;';
    const lbl = document.createElement('span');
    lbl.textContent = label;
    lbl.style.cssText = 'font-size: 15px; font-weight: 500; color: rgba(255,255,255,0.6);';
    lblWrap.appendChild(lbl);
    const badge = document.createElement('span');
    badge.textContent = badgeText;
    badge.style.cssText = `
      font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.55);
      background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.18);
      border-radius: 4px; padding: 2px 7px; letter-spacing: 0.5px;
      flex-shrink: 0;
    `;
    lblWrap.appendChild(badge);
    left.appendChild(lblWrap);
    if (tooltip) {
      const tip = document.createElement('span');
      tip.textContent = tooltip;
      tip.style.cssText = 'font-size: 11px; color: rgba(255,255,255,0.25);';
      left.appendChild(tip);
    }
    row.appendChild(left);
    row.appendChild(control);
    this._contentArea.appendChild(row);
  }

  _rowDisabledIn(container, label, control, tooltip = '', badgeText = '未实现') {
    const row = document.createElement('div');
    row.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.06);
      opacity: 0.5;
    `;
    const left = document.createElement('div');
    left.style.cssText = 'display: flex; flex-direction: column; gap: 2px; flex-shrink: 0;';
    const lblWrap = document.createElement('div');
    lblWrap.style.cssText = 'display: flex; align-items: center; gap: 6px;';
    const lbl = document.createElement('span');
    lbl.textContent = label;
    lbl.style.cssText = 'font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.8);';
    lblWrap.appendChild(lbl);
    const badge = document.createElement('span');
    badge.textContent = badgeText;
    badge.style.cssText = `
      font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.55);
      background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.18);
      border-radius: 4px; padding: 2px 7px; letter-spacing: 0.5px;
      flex-shrink: 0;
    `;
    lblWrap.appendChild(badge);
    left.appendChild(lblWrap);
    if (tooltip) {
      const tip = document.createElement('span');
      tip.textContent = tooltip;
      tip.style.cssText = 'font-size: 11px; color: rgba(255,255,255,0.35);';
      left.appendChild(tip);
    }
    row.appendChild(left);
    row.appendChild(control);
    container.appendChild(row);
  }

  _rowSelectIn(container, label, options, value, onChange, disabled = false, disabledTitle = '') {
    const row = document.createElement('div');
    row.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.06);
      gap: 12px;
      ${disabled ? 'opacity:0.45; cursor:not-allowed;' : ''}
    `;
    if (disabled && disabledTitle) row.title = disabledTitle;
    const left = document.createElement('span');
    left.textContent = label;
    left.style.cssText = 'font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.8); flex-shrink: 0;';
    row.appendChild(left);

    const pills = document.createElement('div');
    pills.style.cssText = 'display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end;';
    const btns = [];
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.textContent = opt.label;
      const active = opt.value === value;
      btn.dataset.active = active ? 'true' : '';
      btn.disabled = disabled;
      btn.style.cssText = `
        padding: 5px 12px; border-radius: 999px;
        background: ${active ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.05)'};
        border: 1px solid ${active ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)'};
        color: ${active ? '#fff' : 'rgba(255,255,255,0.55)'};
        font-size: 12px; font-weight: 600; cursor: ${disabled ? 'not-allowed' : 'pointer'};
        transition: all calc(0.2s / var(--ui-anim-speed)) ease;
      `;
      if (!disabled) {
        btn.onmouseenter = () => {
          if (!btn.dataset.active) btn.style.background = 'rgba(255,255,255,0.1)';
        };
        btn.onmouseleave = () => {
          if (!btn.dataset.active) btn.style.background = 'rgba(255,255,255,0.05)';
        };
      }
      const clickFn = () => {
        if (disabled) return;
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

  _rowSelect(label, options, value, onChange, tooltip = '', disabled = false, disabledTitle = '') {
    const row = document.createElement('div');
    row.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
      padding: 14px 0; border-bottom: 1px solid rgba(255,255,255,0.06);
      ${disabled ? 'opacity:0.45; cursor:not-allowed;' : ''}
    `;
    if (disabled && disabledTitle) row.title = disabledTitle;
    const left = document.createElement('div');
    left.style.cssText = 'display: flex; flex-direction: column; gap: 2px;';
    const lbl = document.createElement('span');
    lbl.textContent = label;
    lbl.style.cssText = 'font-size: 15px; font-weight: 500; color: rgba(255,255,255,0.85);';
    left.appendChild(lbl);
    if (tooltip) {
      const tip = document.createElement('span');
      tip.textContent = tooltip;
      tip.style.cssText = 'font-size: 11px; color: rgba(255,255,255,0.35);';
      left.appendChild(tip);
    }
    row.appendChild(left);

    const pills = document.createElement('div');
    pills.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap;';
    const btns = [];
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.textContent = opt.label;
      const active = opt.value === value;
      btn.dataset.active = active ? 'true' : '';
      btn.disabled = disabled;
      btn.style.cssText = `
        padding: 7px 16px; border-radius: 999px;
        background: ${active ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.05)'};
        border: 1px solid ${active ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)'};
        color: ${active ? '#fff' : 'rgba(255,255,255,0.55)'};
        font-size: 13px; font-weight: 600; cursor: ${disabled ? 'not-allowed' : 'pointer'};
        transition: all calc(0.2s / var(--ui-anim-speed)) ease;
      `;
      if (!disabled) {
        btn.onmouseenter = () => {
          if (!btn.dataset.active) btn.style.background = 'rgba(255,255,255,0.1)';
        };
        btn.onmouseleave = () => {
          if (!btn.dataset.active) btn.style.background = 'rgba(255,255,255,0.05)';
        };
      }
      const clickFn = () => {
        if (disabled) return;
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

  _createSwitch(checked, onChange, disabled = false, disabledTitle = '') {
    const wrap = document.createElement('label');
    wrap.style.cssText = `
      position: relative; display: inline-block;
      width: 48px; height: 28px; cursor: ${disabled ? 'not-allowed' : 'pointer'}; flex-shrink: 0;
      ${disabled ? 'opacity:0.45;' : ''}
    `;
    if (disabled && disabledTitle) wrap.title = disabledTitle;
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    input.disabled = disabled;
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

    const fn = () => { if (disabled) return; update(); onChange(input.checked); };
    if (!disabled) {
      input.addEventListener('change', fn);
      this._listeners.push({ el: input, type: 'change', fn });
    }

    wrap.appendChild(input);
    wrap.appendChild(track);
    wrap.appendChild(knob);
    return wrap;
  }

  _createSlider(value, min, max, unit, onChange, formatLabel, disabled = false, disabledTitle = '') {
    const wrap = document.createElement('div');
    wrap.style.cssText = `display: flex; align-items: center; gap: 14px; width: 100%;${disabled ? ' opacity:0.45; cursor:not-allowed;' : ''}`;
    if (disabled && disabledTitle) wrap.title = disabledTitle;

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
      background: ${disabled ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.6)'};
      border-radius: 999px; transition: width calc(0.08s / var(--ui-anim-speed)) ease;
    `;
    track.appendChild(fill);
    trackWrap.appendChild(track);

    const thumb = document.createElement('div');
    thumb.style.cssText = `
      position: absolute; top: 50%; left: 0%;
      width: 18px; height: 18px; border-radius: 50%;
      background: ${disabled ? 'rgba(255,255,255,0.5)' : '#fff'};
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      transform: translate(-50%, -50%);
      pointer-events: none; transition: left calc(0.08s / var(--ui-anim-speed)) ease;
    `;
    trackWrap.appendChild(thumb);

    const input = document.createElement('input');
    input.type = 'range';
    input.min = min; input.max = max; input.step = 1;
    input.value = value;
    input.disabled = disabled;
    input.style.cssText = `
      position: absolute; inset: 0; opacity: 0; cursor: ${disabled ? 'not-allowed' : 'pointer'};
      width: 100%; height: 100%;
    `;

    const update = () => {
      const pct = max === min ? 0 : ((input.value - min) / (max - min)) * 100;
      fill.style.width = `${pct}%`;
      thumb.style.left = `${pct}%`;
    };
    update();

    const fn = () => { if (disabled) return; update(); onChange(parseFloat(input.value)); };
    if (!disabled) {
      input.addEventListener('input', fn);
      this._listeners.push({ el: input, type: 'input', fn });
    }

    trackWrap.appendChild(input);

    const label = document.createElement('span');
    label.textContent = formatLabel ? formatLabel(value) : (value + unit);
    label.style.cssText = `
      font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.55);
      min-width: 44px; text-align: right; font-variant-numeric: tabular-nums;
    `;
    if (!disabled) {
      const labelFn = () => { label.textContent = formatLabel ? formatLabel(input.value) : (input.value + unit); };
      input.addEventListener('input', labelFn);
      this._listeners.push({ el: input, type: 'input', fn: labelFn });
    }

    wrap.appendChild(trackWrap);
    wrap.appendChild(label);
    return wrap;
  }

  _formatKey(key) {
    if (typeof key !== 'string') return '—';
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
    // Enforce max concurrent toasts to prevent DOM buildup
    const existing = document.querySelectorAll('[data-settings-toast="true"]');
    if (existing.length >= 3) existing[0].remove();
    const el = document.createElement('div');
    el.dataset.settingsToast = 'true';
    el.textContent = text;
    const reduced = document.documentElement.classList.contains('reduce-motion');
    el.style.cssText = `
      position: fixed; bottom: 32px; left: 50%; transform: translateX(-50%);
      padding: 10px 20px; border-radius: 10px;
      background: rgba(30,30,30,0.92); border: 1px solid rgba(255,255,255,0.1);
      color: #fff; font-size: 13px; font-weight: 600;
      z-index: 200; pointer-events: none;
      ${reduced ? '' : `animation: settingsCardIn calc(0.3s / var(--ui-anim-speed)) ease both;`}
    `;
    document.body.appendChild(el);
    if (!this._toastTimers) this._toastTimers = [];
    const fadeTimer = setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = reduced ? 'opacity 0.05s ease' : `opacity calc(0.3s / var(--ui-anim-speed)) ease`;
      const removeTimer = setTimeout(() => {
        if (el.parentNode) el.remove();
        if (this._toastTimers) {
          this._toastTimers = this._toastTimers.filter(t => t !== removeTimer);
        }
      }, reduced ? 60 : animMs(300));
      if (!this._toastTimers) this._toastTimers = [];
      this._toastTimers.push(removeTimer);
      // Remove the now-fired fade timer from tracking
      this._toastTimers = this._toastTimers.filter(t => t !== fadeTimer);
    }, animMs(2000));
    if (!this._toastTimers) this._toastTimers = [];
    this._toastTimers.push(fadeTimer);
  }

  _syncAllControls() {
    const cat = this._currentCategory;
    this._currentCategory = ''; // force rebuild
    this._switchCategory(cat);
  }

  /**
   * Shows a styled confirmation dialog inside the settings modal.
   * Replaces native confirm() for a consistent visual style.
   */
  _showConfirmDialog(title, message, onConfirm, onCancel = null) {
    // Backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'settings-confirm-backdrop';
    backdrop.style.cssText = `
      position: fixed; inset: 0; z-index: 110;
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

    const close = () => {
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
      window.removeEventListener('keydown', onKeyDown);
      this._confirmHandlers.delete(onKeyDown);
    };

    const onKeyDown = (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        close();
        if (onCancel) onCancel();
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopImmediatePropagation();
        close();
        onConfirm();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    backdrop._keydownHandler = onKeyDown;
    this._confirmHandlers.add(onKeyDown);

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
    if (!this.container || this._shown) return;
    this._shown = true;
    if (this._showRaf) { cancelAnimationFrame(this._showRaf); this._showRaf = null; }
    if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; }
    this._syncAllControls();
    this.container.style.display = 'flex';
    this._showRaf = requestAnimationFrame(() => {
      this._showRaf = null;
      if (this.container) this.container.style.opacity = '1';
    });
    // First-time settings tip
    if (!onboarding.get('settingsExplained')) {
      onboarding.set('settingsExplained', true);
      // Show after a short delay so the modal is fully visible
      this._settingsTipTimer = setTimeout(() => {
        if (this.container && this.container.style.display !== 'none') {
          this._toast('提示：轨迹线、小地图和音效开关可在「图形」和「音频」分类中找到');
        }
        this._settingsTipTimer = null;
      }, 600);
    }
  }

  hide() {
    this._shown = false;
    if (!this.container) return;
    if (this._showRaf) { cancelAnimationFrame(this._showRaf); this._showRaf = null; }
    keyBindings.cancelListening();
    this.container.style.opacity = '0';
    if (this._hideTimer) clearTimeout(this._hideTimer);
    if (this._settingsTipTimer) { clearTimeout(this._settingsTipTimer); this._settingsTipTimer = null; }
    this._hideTimer = setTimeout(() => { if (this.container) this.container.style.display = 'none'; }, animMs(300));
    // Dismiss any open confirmation dialogs
    for (const handler of this._confirmHandlers) {
      window.removeEventListener('keydown', handler);
    }
    this._confirmHandlers.clear();
    document.querySelectorAll('.settings-confirm-backdrop').forEach(el => {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
  }

  destroy() {
    this._shown = false;
    keyBindings.cancelListening();
    if (this._switchTimer) { clearTimeout(this._switchTimer); this._switchTimer = null; }
    if (this._showRaf) { cancelAnimationFrame(this._showRaf); this._showRaf = null; }
    this._listeners.forEach(({ el, type, fn }) => {
      el.removeEventListener(type, fn);
    });
    this._listeners = [];
    if (this._toastTimers) { this._toastTimers.forEach(t => clearTimeout(t)); this._toastTimers = []; }
    if (this._blobRevokeTimer) { clearTimeout(this._blobRevokeTimer); this._blobRevokeTimer = null; }
    if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; }
    if (this._saveToastTimer) { clearTimeout(this._saveToastTimer); this._saveToastTimer = null; }
    if (this._settingsTipTimer) { clearTimeout(this._settingsTipTimer); this._settingsTipTimer = null; }
    if (this._onSettingsChangedToast) {
      window.removeEventListener('settingsChanged', this._onSettingsChangedToast);
      this._onSettingsChangedToast = null;
    }
    this._tabEls.forEach(({ tab }) => {
      if (tab) { tab.onclick = null; }
    });
    this._tabEls.clear();
    // Remove any lingering confirm backdrops and their keydown listeners
    for (const handler of this._confirmHandlers) {
      window.removeEventListener('keydown', handler);
    }
    this._confirmHandlers.clear();
    document.querySelectorAll('.settings-confirm-backdrop').forEach(el => {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    // Remove any lingering toast elements
    document.querySelectorAll('[data-settings-toast="true"]').forEach(el => {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    if (this.container) {
      this.container.innerHTML = '';
      if (this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
      }
    }
    this.container = null;
    this._contentArea = null;
    this.audio = null;
  }
}
