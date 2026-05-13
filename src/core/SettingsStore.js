/**
 * SettingsStore — Persistent game settings backed by localStorage.
 *
 * Dispatches custom events so any module can react to changes:
 *   window.dispatchEvent(new CustomEvent('settingsChanged', { detail: { key, value } }));
 */

const STORAGE_KEY = 'billiards_settings_v1';

const DEFAULTS = {
  // Audio
  soundEnabled: true,
  masterVolume: 80,
  musicVolume: 60,
  sfxVolume: 80,

  // Graphics
  trajectoryEnabled: true,
  particlesEnabled: true,
  shotTrailsEnabled: true,
  quality: 'high', // 'low' | 'medium' | 'high'

  // Game
  defaultCamera: 'free', // 'free' | 'top' | 'follow'
  autoFollowCueBall: false,

  // Controls — Camera
  mouseSensitivity: 1.0,
  cameraRotateSens: 1.0,
  cameraPanSens: 1.0,
  cameraZoomSens: 1.0,

  // Controls — Shot & Aim
  shotPowerSens: 1.0,
  aimSens: 1.0,
  spinStepSens: 1.0,
  trackpadSens: 1.0,

  // Controls — Effects & UI
  screenShakeIntensity: 1.0,
  uiAnimSpeed: 1.0,

  // Mouse inversion
  invertMouseX: true,
  invertMouseY: true,

  // Minimap
  minimapEnabled: true,
  minimapSize: 140,
  minimapOpacity: 0.85,

  // Keybindings
  keybindingPreset: 'win',
  customKeybindingPresets: {},
  keyBindings: {
    cameraFree: '1',
    cameraTop: '2',
    cameraFollow: '3',
    spinUp: 'w',
    spinDown: 's',
    spinLeft: 'a',
    spinRight: 'd',
    spinReset: 'r',
    pause: 'escape',
  },

  // General
  language: 'zh', // 'zh' | 'en'
};

export class SettingsStore {
  constructor() {
    this._data = { ...DEFAULTS };
    this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this._data = { ...DEFAULTS, ...parsed };
      }
    } catch (e) {
      console.warn('Settings load failed, using defaults');
    }
  }

  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._data));
    } catch (e) {
      console.warn('Settings save failed');
    }
  }

  _notify(key, value) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('settingsChanged', { detail: { key, value } }));
    }
  }

  get(key) {
    return this._data[key];
  }

  set(key, value) {
    if (this._data[key] === value) return;
    this._data[key] = value;
    this._save();
    this._notify(key, value);
  }

  getAll() {
    return { ...this._data };
  }

  reset() {
    this._data = { ...DEFAULTS };
    this._save();
    Object.keys(DEFAULTS).forEach((key) => this._notify(key, DEFAULTS[key]));
  }

  resetKey(key) {
    if (key in DEFAULTS) {
      this.set(key, DEFAULTS[key]);
    }
  }
}

export const settings = new SettingsStore();
