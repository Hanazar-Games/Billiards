/**
 * KeyBindings — Centralised keyboard-shortcut manager with presets.
 *
 * Supports 3 built-in presets (Mac / Windows / Mobile) plus user-defined
 * custom presets. All data persists through SettingsStore.
 */
import { settings } from '../core/SettingsStore.js';

// ── Action categories ──
export const ACTION_CATEGORIES = [
  {
    id: 'camera',
    label: '视角控制',
    actions: {
      cameraFree:   { label: '自由视角',         mac: '1',            win: '1',            mobile: '点击视角按钮' },
      cameraTop:    { label: '俯视视角',         mac: '2',            win: '2',            mobile: '双指上下滑动' },
      cameraFollow: { label: '跟随视角',         mac: '3',            win: '3',            mobile: '双击白球' },
      zoomIn:       { label: '放大',             mac: '⌘ + =',        win: 'Ctrl + =',     mobile: '双指外扩缩放' },
      zoomOut:      { label: '缩小',             mac: '⌘ + -',        win: 'Ctrl + -',     mobile: '双指内捏缩放' },
      orbitLeft:    { label: '轨道左旋',         mac: 'Shift + 左键拖动', win: 'Shift + 左键拖动', mobile: '双指左滑（自由视角）' },
      orbitRight:   { label: '轨道右旋',         mac: 'Shift + 右键拖动', win: 'Shift + 右键拖动', mobile: '双指右滑（自由视角）' },
    },
  },
  {
    id: 'aim',
    label: '瞄准与击球',
    actions: {
      aimUp:        { label: '上抬杆',           mac: '↑',            win: '↑',            mobile: '单指上滑' },
      aimDown:      { label: '下压杆',           mac: '↓',            win: '↓',            mobile: '单指下滑' },
      aimLeft:      { label: '左转',             mac: '←',            win: '←',            mobile: '单指左滑' },
      aimRight:     { label: '右转',             mac: '→',            win: '→',            mobile: '单指右滑' },
      shoot:        { label: '击球',             mac: 'Space',        win: 'Space',        mobile: '单指点击' },
      powerUp:      { label: '增加力度',         mac: 'Shift + ↑',    win: 'Shift + ↑',    mobile: '长按后上滑' },
      powerDown:    { label: '减小力度',         mac: 'Shift + ↓',    win: 'Shift + ↓',    mobile: '长按后下滑' },
      cancelShot:   { label: '取消击球',         mac: 'Esc',          win: 'Esc',          mobile: '双击空白处' },
    },
  },
  {
    id: 'spin',
    label: '杆法与旋转',
    actions: {
      spinUp:       { label: '高杆',             mac: 'W',            win: 'W',            mobile: '击球前上滑' },
      spinDown:     { label: '低杆',             mac: 'S',            win: 'S',            mobile: '击球前下滑' },
      spinLeft:     { label: '左塞',             mac: 'A',            win: 'A',            mobile: '击球前左滑' },
      spinRight:    { label: '右塞',             mac: 'D',            win: 'D',            mobile: '击球前右滑' },
      spinReset:    { label: '重置球杆',         mac: 'R',            win: 'R',            mobile: '双击空白处' },
      spinMaxTop:   { label: '最大高杆',         mac: 'Shift + W',    win: 'Shift + W',    mobile: '双指上滑' },
      spinMaxBottom:{ label: '最大低杆',         mac: 'Shift + S',    win: 'Shift + S',    mobile: '双指下滑' },
    },
  },
  {
    id: 'game',
    label: '游戏控制',
    actions: {
      pause:        { label: '暂停 / 继续',      mac: 'Esc',          win: 'Esc',          mobile: '三指点击' },
      undo:         { label: '撤销上一步',       mac: '⌘ + Z',        win: 'Ctrl + Z',     mobile: '左滑手势' },
      resetGame:    { label: '重新开始',         mac: '⌘ + R',        win: 'Ctrl + R',     mobile: '摇一摇' },
      toggleTrajectory:{ label:'显示/隐藏轨迹',  mac: 'T',            win: 'T',            mobile: '两指左滑' },
      toggleSound:  { label: '静音切换',         mac: 'M',            win: 'M',            mobile: '两指右滑' },
      screenshot:   { label: '截图',             mac: '⌘ + Shift + S',win: 'Ctrl + Shift + S', mobile: '不适用' },
      toggleFPS:    { label: 'FPS 显示',         mac: 'F',            win: 'F',            mobile: '不适用' },
    },
  },
  {
    id: 'ui',
    label: '界面操作',
    actions: {
      openSettings: { label: '打开设置',         mac: '⌘ + ,',        win: 'Ctrl + ,',     mobile: '点击 ⚙️' },
      closeModal:   { label: '关闭弹窗',         mac: 'Esc',          win: 'Esc',          mobile: '点击遮罩' },
      toggleFullscreen:{ label:'全屏切换',       mac: '⌘ + Ctrl + F', win: 'F11',          mobile: '不适用' },
      nextTab:      { label: '下一标签页',       mac: 'Tab',          win: 'Tab',          mobile: '左右滑动' },
      prevTab:      { label: '上一标签页',       mac: 'Shift + Tab',  win: 'Shift + Tab',  mobile: '右左滑动' },
    },
  },
];

// Flatten for quick lookup
export const ACTIONS = {};
ACTION_CATEGORIES.forEach(cat => {
  Object.assign(ACTIONS, cat.actions);
});

const ACTION_KEYS = Object.keys(ACTIONS);

// Which actions can actually be bound via keyboard (not mobile-only descriptions)
const KEYBOARD_BINDABLE = new Set([
  'cameraFree','cameraTop','cameraFollow','zoomIn','zoomOut',
  'aimUp','aimDown','aimLeft','aimRight','shoot','powerUp','powerDown','cancelShot',
  'spinUp','spinDown','spinLeft','spinRight','spinReset','spinMaxTop','spinMaxBottom',
  'pause','undo','resetGame','toggleTrajectory','toggleSound','screenshot','toggleFPS',
  'openSettings','closeModal','toggleFullscreen','nextTab','prevTab',
]);

// Default bindings used when resetting (Windows-style as baseline)
const DEFAULT_BINDINGS = {
  cameraFree:   '1',
  cameraTop:    '2',
  cameraFollow: '3',
  zoomIn:       '=',
  zoomOut:      '-',
  aimUp:        'arrowup',
  aimDown:      'arrowdown',
  aimLeft:      'arrowleft',
  aimRight:     'arrowright',
  shoot:        ' ',
  powerUp:      'shift+arrowup',
  powerDown:    'shift+arrowdown',
  cancelShot:   'escape',
  spinUp:       'w',
  spinDown:     's',
  spinLeft:     'a',
  spinRight:    'd',
  spinReset:    'r',
  spinMaxTop:   'shift+w',
  spinMaxBottom:'shift+s',
  pause:        'escape',
  undo:         'ctrl+z',
  resetGame:    'ctrl+r',
  toggleTrajectory:'t',
  toggleSound:  'm',
  screenshot:   'ctrl+shift+s',
  toggleFPS:    'f',
  openSettings: 'ctrl+,',
  closeModal:   'escape',
  toggleFullscreen:'f11',
  nextTab:      'tab',
  prevTab:      'shift+tab',
};

// Presets stored separately so user can switch
const PRESET_MAC = {
  cameraFree:   '1',
  cameraTop:    '2',
  cameraFollow: '3',
  zoomIn:       '=',
  zoomOut:      '-',
  aimUp:        'arrowup',
  aimDown:      'arrowdown',
  aimLeft:      'arrowleft',
  aimRight:     'arrowright',
  shoot:        ' ',
  powerUp:      'shift+arrowup',
  powerDown:    'shift+arrowdown',
  cancelShot:   'escape',
  spinUp:       'w',
  spinDown:     's',
  spinLeft:     'a',
  spinRight:    'd',
  spinReset:    'r',
  spinMaxTop:   'shift+w',
  spinMaxBottom:'shift+s',
  pause:        'escape',
  undo:         'meta+z',
  resetGame:    'meta+r',
  toggleTrajectory:'t',
  toggleSound:  'm',
  screenshot:   'meta+shift+s',
  toggleFPS:    'f',
  openSettings: 'meta+,',
  closeModal:   'escape',
  toggleFullscreen:'meta+ctrl+f',
  nextTab:      'tab',
  prevTab:      'shift+tab',
};

const PRESET_WIN = { ...DEFAULT_BINDINGS };

export class KeyBindings {
  constructor() {
    this._bindings = this._load();
    this._currentPreset = settings.get('keybindingPreset') || 'win';
    this._waitingAction = null;
    this._waitingCallback = null;
    this._keyDownHandler = this._onKeyDown.bind(this);
    this._onSettingsChanged = (e) => {
      if (e.detail?.key === 'keyBindings') {
        this._bindings = this._load();
      }
    };
    window.addEventListener('settingsChanged', this._onSettingsChanged);
  }

  _load() {
    const stored = settings.get('keyBindings') || {};
    const result = {};
    for (const key of ACTION_KEYS) {
      result[key] = stored[key] ?? DEFAULT_BINDINGS[key] ?? '';
    }
    return result;
  }

  _save() {
    settings.set('keyBindings', { ...this._bindings });
  }

  getBinding(action) {
    return this._bindings[action] ?? ACTIONS[action]?.win ?? '';
  }

  getDisplayBinding(action, preset) {
    preset = preset || this._currentPreset;
    if (preset === 'mac') return ACTIONS[action]?.mac ?? '—';
    if (preset === 'win') return ACTIONS[action]?.win ?? '—';
    if (preset === 'mobile') return ACTIONS[action]?.mobile ?? '—';
    return this._formatChord(this.getBinding(action));
  }

  setBinding(action, key) {
    if (!ACTIONS[action]) return false;
    key = key.toLowerCase().trim();
    if (!key) return false;
    // Check for conflicts
    const conflicts = this.getConflicts(action, key);
    if (conflicts.length > 0) {
      for (const other of conflicts) {
        this._bindings[other] = '';
      }
    }
    this._bindings[action] = key;
    this._save();
    return true;
  }

  getConflicts(action, key) {
    key = key.toLowerCase().trim();
    const conflicts = [];
    for (const [otherAction, boundKey] of Object.entries(this._bindings)) {
      if (otherAction !== action && boundKey === key) {
        conflicts.push(otherAction);
      }
    }
    return conflicts;
  }

  /** Apply a built-in preset. */
  applyPreset(name) {
    if (name === 'mac') {
      Object.assign(this._bindings, PRESET_MAC);
    } else if (name === 'win') {
      Object.assign(this._bindings, PRESET_WIN);
    } else if (name === 'mobile') {
      // Mobile has no keyboard bindings; clear all
      ACTION_KEYS.forEach(k => { this._bindings[k] = ''; });
    } else {
      return false;
    }
    this._currentPreset = name;
    settings.set('keybindingPreset', name);
    this._save();
    return true;
  }

  getCurrentPreset() {
    return this._currentPreset;
  }

  /** Save current bindings as a named custom preset. */
  saveCustomPreset(name) {
    const presets = settings.get('customKeybindingPresets') || {};
    presets[name] = { ...this._bindings };
    settings.set('customKeybindingPresets', presets);
    return true;
  }

  /** Load a named custom preset. */
  loadCustomPreset(name) {
    const presets = settings.get('customKeybindingPresets') || {};
    if (!presets[name]) return false;
    Object.assign(this._bindings, presets[name]);
    this._currentPreset = 'custom:' + name;
    settings.set('keybindingPreset', this._currentPreset);
    this._save();
    return true;
  }

  /** Delete a named custom preset. */
  deleteCustomPreset(name) {
    const presets = settings.get('customKeybindingPresets') || {};
    delete presets[name];
    settings.set('customKeybindingPresets', presets);
  }

  /** List all custom preset names. */
  listCustomPresets() {
    const presets = settings.get('customKeybindingPresets') || {};
    return Object.keys(presets);
  }

  resetToDefaults() {
    for (const key of ACTION_KEYS) {
      this._bindings[key] = DEFAULT_BINDINGS[key] ?? '';
    }
    this._currentPreset = 'win';
    settings.set('keybindingPreset', 'win');
    this._save();
  }

  /** Check if a pressed key matches the binding for an action. */
  matches(action, pressedKey, modifiers = {}) {
    const bound = this.getBinding(action);
    if (!bound) return false;
    const boundLower = bound.toLowerCase().trim();
    const pressedLower = pressedKey.toLowerCase().trim();

    // Handle simple single-key bindings
    if (!boundLower.includes('+')) {
      return pressedLower === boundLower;
    }

    // Handle chord bindings like "ctrl+z", "shift+tab", "meta+shift+s"
    const parts = boundLower.split('+').map(s => s.trim());
    const mainKey = parts.pop();
    if (pressedLower !== mainKey) return false;

    // Check required modifiers
    const reqMods = { ctrl: false, shift: false, alt: false, meta: false };
    parts.forEach(p => { if (p in reqMods) reqMods[p] = true; });

    return modifiers.ctrl === reqMods.ctrl &&
           modifiers.shift === reqMods.shift &&
           modifiers.alt === reqMods.alt &&
           modifiers.meta === reqMods.meta;
  }

  /** Enter "listening" mode: the next key pressed becomes the new binding for action. */
  startListening(action, onKey) {
    this.cancelListening();
    this._waitingAction = action;
    this._waitingCallback = onKey;
    window.addEventListener('keydown', this._keyDownHandler);
  }

  cancelListening() {
    window.removeEventListener('keydown', this._keyDownHandler);
    this._waitingAction = null;
    this._waitingCallback = null;
  }

  _onKeyDown(e) {
    if (!this._waitingAction || !this._waitingCallback) return;
    // Ignore modifier-only keys
    if (['shift', 'control', 'alt', 'meta'].includes(e.key.toLowerCase())) return;
    const key = e.key.toLowerCase();
    const chord = [];
    if (e.ctrlKey) chord.push('ctrl');
    if (e.shiftKey) chord.push('shift');
    if (e.altKey) chord.push('alt');
    if (e.metaKey) chord.push('meta');
    chord.push(key);
    const result = chord.join('+');
    window.removeEventListener('keydown', this._keyDownHandler);
    this._waitingCallback(this._waitingAction, result);
    this._waitingAction = null;
    this._waitingCallback = null;
  }

  _formatChord(chord) {
    if (!chord) return '—';
    const map = {
      escape: 'Esc',
      arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→',
      ' ': 'Space',
      meta: '⌘', ctrl: 'Ctrl', shift: '⇧', alt: '⌥',
    };
    return chord.split('+').map(k => map[k] || k.toUpperCase()).join(' + ');
  }

  isBindable(action) {
    return KEYBOARD_BINDABLE.has(action);
  }
}

export const keyBindings = new KeyBindings();
