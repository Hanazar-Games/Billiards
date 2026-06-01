/**
 * SettingsStore — Persistent game settings backed by localStorage.
 *
 * Dispatches custom events so any module can react to changes:
 *   window.dispatchEvent(new CustomEvent('settingsChanged', { detail: { key, value } }));
 */

const STORAGE_KEY = 'billiards_settings_v1';

const DEFAULTS = {
  // ── Audio ──
  soundEnabled: true,
  masterVolume: 80,
  musicVolume: 60,
  sfxVolume: 80,
  muteWhenUnfocused: false,
  collisionVolumeScale: 1.0,
  pocketVolumeScale: 1.0,
  cueHitVolumeScale: 1.0,
  foulVolumeScale: 1.0,
  ambientVolumeScale: 1.0,
  hitFeedbackVolumeScale: 1.0,
  vibrationEnabled: false,
  lowLatencyMode: false,

  // ── Graphics & Performance ──
  trajectoryEnabled: false,
  particlesEnabled: true,
  shotTrailsEnabled: true,
  quality: 'high', // 'low' | 'medium' | 'high'
  shadowsEnabled: true,
  renderScale: 1.0,
  antialiasEnabled: true,
  maxPixelRatio: 2.0,
  toneMappingExposure: 1.08,
  fogEnabled: true,
  roomLightingQuality: 'high', // 'low' | 'medium' | 'high'
  reflectionQuality: 'medium', // 'off' | 'low' | 'medium'
  // NOTE: ballDetail / tableDetail removed — use ballTextureQuality / clothWearEnabled
  backgroundAnimationEnabled: true,
  vSync: true,
  fpsLimit: 'unlimited', // 'unlimited' | '30' | '60' | '120' | '144'
  fovZoomed: 45,
  dynamicFov: true,
  postProcess: true,
  bloom: true,
  chromaticAberration: false,
  filmGrain: false,
  vignette: false,

  // ── Visual Appearance ──
  cueTheme: 'default',
  // New modelling / appearance system (Phase 1)
  tableTheme: 'classic', // 'classic' | 'blackGold' | 'blueTournament' | 'redClub' | 'minimal'
  feltTheme: 'classicGreen', // 'classicGreen' | 'blue' | 'red' | 'black' | 'purple'
  woodTheme: 'darkWalnut', // 'classic' | 'darkWalnut' | 'lightOak' | 'blackLacquer'
  metalTrimTheme: 'nickel', // 'nickel' | 'gold' | 'blackChrome'
  clothNapEnabled: true,
  clothPatternStrength: 0.35,
  clothWearEnabled: true,
  ballTextureQuality: 'high', // 'medium' | 'high'
  ballNumberSize: 'normal', // 'small' | 'normal' | 'large'
  ballNumberContrast: 'normal', // 'normal' | 'high'
  cueBallMarkStyle: 'redDot', // 'redDot' | 'blueDot' | 'plain'
  pocketNetDetail: 'high', // 'off' | 'low' | 'high'
  pocketLeatherTheme: 'brown', // 'black' | 'brown' | 'darkRed'
  roomTheme: 'club', // 'club' | 'modern' | 'tournament' | 'minimal'
  floorTheme: 'tile', // 'tile' | 'wood' | 'dark'
  wallTheme: 'warm', // 'warm' | 'neutral' | 'dark'
  decorativePropsEnabled: true,
  wallDecorEnabled: true,
  plantsEnabled: true,
  ceilingGridEnabled: true,
  lampStyle: 'classic', // 'classic' | 'modern' | 'tournament'
  ambientLightTheme: 'warm', // 'warm' | 'neutral' | 'cool'
  tableLightIntensity: 1.0,
  // Legacy appearance keys (kept for backward compatibility, migrated where applicable)
  feltColorTheme: 'classic',
  woodColorTheme: 'classic',
  ballStyle: 'standard',
  ballNumbers: true,
  lightingStyle: 'warm',
  lightingIntensity: 1.0,
  ambientIntensity: 0.5,
  roomStyle: 'classic',
  tableReflection: true,
  ballReflection: true,
  depthOfField: false,
  colorBlindMode: 'off',
  pocketHighlightEnabled: true,
  cushionHighlightEnabled: false,
  cueOpacity: 1.0,

  // ── Camera & View ──
  defaultCamera: 'free', // 'free' | 'top' | 'follow'
  autoFollowCueBall: false,
  cameraFov: 45,
  cameraDamping: 1.0,
  zoomMinDistance: 80,
  zoomMaxDistance: 700,
  followCameraHeight: 1.0,
  followCameraDistance: 1.0,
  topCameraZoom: 1.0,
  cameraCollisionAvoidance: true,
  cameraAutoResetAfterShot: true,
  cameraResetDelay: 3.0,
  hideCueOnShot: true,
  topDownAngle: false,
  cameraShake: true,
  cameraSmoothing: true,
  cameraSmoothFactor: 0.5,

  // ── UI & HUD ──
  turnTimer: 'off', // 'off' | '30' | '60' | '90' | '120'
  minimapEnabled: true,
  minimapSize: 140,
  minimapOpacity: 0.85,
  hudScale: 1.0,
  hudOpacity: 0.9,
  messageDurationScale: 1.0,
  floatingTextEnabled: true,
  floatingTextScale: 1.0,
  compactHud: false,
  showShotPowerPercent: true,
  showSpinIndicator: true,
  // NOTE: showPlayerStatsPanel renamed to statsPanelEnabled for consistency
  // (Game.js already used statsPanelEnabled, SettingsScreen used showPlayerStatsPanel)
  showFPS: false,
  showBallLabels: false,
  showRemainingBalls: true,
  showComboCounter: true,
  showCrosshair: false,
  timerPosition: 'bottom', // 'top' | 'bottom'
  reducedMotion: false,
  highContrastUI: false,
  pauseBlurEnabled: true,

  // ── Minimap Appearance ──
  minimapPosition: 'bottom-right', // 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  minimapBallSize: 1.0,
  minimapShowCueTrail: true,
  minimapTrailLength: 40,
  minimapHighContrast: false,

  // ── Trajectory Appearance ──
  trajectoryOpacity: 0.7,
  trajectoryWidth: 1.0,
  trajectoryColorMode: 'default', // 'default' | 'highContrast' | 'colorBlind'
  trajectoryAnimationEnabled: true,

  // ── Trail & Particle FX ──
  trailOpacity: 0.75,
  trailWidth: 1.0,
  trailColorMode: 'ball', // 'ball' | 'white' | 'gold'
  collisionSparksEnabled: true,
  pocketFountainEnabled: true,
  impactShockwaveEnabled: true,
  ballReturnAnimationEnabled: true,

  // ── Control Comfort ──
  mouseSensitivity: 1.0,
  cameraRotateSens: 1.0,
  cameraPanSens: 1.0,
  cameraZoomSens: 1.0,
  shotPowerSens: 1.0,
  aimSens: 1.0,
  spinStepSens: 1.0,
  trackpadSens: 1.0,
  holdToCharge: true,
  powerBarSmoothing: 1.0,
  dragDeadzone: 4,
  doubleClickResetSpin: true,
  rightClickCancelShot: true,
  confirmShotOnRelease: true,
  keyboardAimStep: 1.0,
  keyboardFineAimMultiplier: 0.25,
  touchControlsEnabled: true,
  touchButtonScale: 1.0,

  // ── Replay & Stats ──
  shotAnalyzerEnabled: true,
  autoSaveReplays: true,
  replayQuality: 'standard', // 'compact' | 'standard' | 'high'
  replayMaxSaved: 50,
  replayShowHud: true,
  replayShowShotTrail: true,
  statsPanelEnabled: true,
  statsPrivacyMode: false,
  showShotData: true,
  showHeatmap: false,
  showWinProbability: false,
  showDetailedStats: true,
  shotHistoryTracking: true,
  replaySpeed: 1.0,
  instantReplayEnabled: true,
  autoInstantReplay: true,
  instantReplayThreshold: 35,

  // ── Accessibility ──
  invertMouseX: true,
  invertMouseY: true,
  largeTextMode: false,
  dyslexiaFriendlyFont: false,
  uiContrast: 'normal', // 'normal' | 'high'
  flashReduction: false,
  screenShakeReduction: false,
  subtitleEnabled: false,
  soundCueVisualHints: false,
  singleHandMode: false,
  leftHandMode: false,
  autoHints: true,
  hintFrequency: 3,
  voiceAnnounce: false,
  focusMode: false,
  focusOpacity: 0.3,

  // ── Language & Units ──
  language: 'zh', // 'zh' | 'en'
  unitSystem: 'metric', // 'metric' | 'imperial'
  numberFormat: 'auto', // 'auto' | 'plain'
  clockFormat: 'mmss', // 'mmss' | 'seconds'
  defaultTableProfile8Ball: 'pool9ft',
  defaultTableProfile9Ball: 'pool9ft',
  defaultTableProfileFreeplay: 'pool9ft',
  quickBreak: false,
  autoSkipAnimation: false,
  skipOpponentTurn: false,
  showOpponentTrajectory: false,
  speedUnit: 'kph', // 'kph' | 'mph' | 'mps'
  showPhysicsDebug: false,
  devMode: false,

  // ── Effects & UI Sensitivity ──
  screenShakeIntensity: 1.0,
  uiAnimSpeed: 1.0,
  fxAnimSpeed: 1.0,
  particleIntensity: 1.0,
  trailFadeDuration: 5.0,

  // ── Keybindings ──
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
};

function _deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj);
  if (Array.isArray(obj)) return obj.map(_deepClone);
  const cloned = {};
  for (const key of Object.keys(obj)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    cloned[key] = _deepClone(obj[key]);
  }
  return cloned;
}

export class SettingsStore {
  constructor() {
    this._data = _deepClone(DEFAULTS);
    this._lockedKeys = new Set();
    this._load();
  }

  /** Temporarily lock keys so settings.set() silently ignores them.
   *  Used in LAN client / match mode to prevent local mutation of fairness settings. */
  setLockedKeys(keys) {
    if (keys == null) {
      this._lockedKeys = new Set();
    } else if (Array.isArray(keys) || keys instanceof Set) {
      this._lockedKeys = new Set(keys);
    } else {
      this._lockedKeys = new Set();
    }
  }

  clearLockedKeys() {
    this._lockedKeys = new Set();
  }

  isLocked(key) {
    return this._lockedKeys.has(key);
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          this._data = _deepClone(DEFAULTS);
          for (const key of Object.keys(parsed)) {
            if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
            if (key in DEFAULTS) {
              const defVal = DEFAULTS[key];
              const val = parsed[key];
              // Basic type validation: only overwrite if types match or both are objects
              if (typeof defVal === typeof val || (typeof defVal === 'object' && typeof val === 'object')) {
                this._data[key] = _deepClone(val);
              }
            } else {
              // Allow unknown keys (forward compatibility) but still clone
              this._data[key] = _deepClone(val);
            }
          }
        }
      }
    } catch (e) {
      console.warn('Settings load failed, using defaults');
      this._data = _deepClone(DEFAULTS);
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
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') return;
    if (this._lockedKeys.has(key)) {
      if (this.get('devMode')) {
        console.warn('[SettingsStore] Ignored mutation of locked key:', key);
      }
      return;
    }
    if (this._data[key] === value) return;
    this._data[key] = value;
    this._save();
    this._notify(key, value);
  }

  getAll() {
    return { ...this._data };
  }

  reset() {
    // Preserve locked keys so competitive settings aren't wiped in LAN/match mode
    const lockedSnapshot = {};
    for (const key of this._lockedKeys) {
      if (key in this._data) lockedSnapshot[key] = this._data[key];
    }
    this._data = { ..._deepClone(DEFAULTS), ...lockedSnapshot };
    this._save();
    Object.keys(DEFAULTS).forEach((key) => {
      if (!this._lockedKeys.has(key)) {
        this._notify(key, this._data[key]);
      }
    });
  }

  /**
   * Update a locked key's in-memory value without triggering events or saving.
   * Used by the network client to reflect host-authority fairness values in the UI.
   */
  updateLockedValue(key, value) {
    if (!this._lockedKeys.has(key)) return;
    this._data[key] = value;
  }

  resetKey(key) {
    if (key in DEFAULTS) {
      this.set(key, DEFAULTS[key]);
    }
  }
}

export const settings = new SettingsStore();

// ── Fairness helpers ──

/** Settings that affect match fairness and should be host-controlled in competitive modes.
 *  All keys here MUST be actually implemented in game systems.
 */
export const MATCH_FAIRNESS_KEYS = new Set([
  'trajectoryEnabled',
  'minimapEnabled',
  'turnTimer',
  'shotPowerSens',
  'showCrosshair',
  // NOTE: removed dormant keys — add back only when implemented:
  // 'showWinProbability', 'showOpponentTrajectory', 'skipOpponentTurn',
  // 'autoHints', 'hintFrequency'
]);

/** Reserved fairness keys for features not yet implemented.
 *  These are NOT enforced until the corresponding game system is built.
 *  Currently empty — all fairness keys are actively implemented.
 */
export const MATCH_FAIRNESS_RESERVED = new Set([]);

/** Settings that are debug/dev-only and should be hidden/protected in normal use. */
export const DEV_KEYS = new Set([
  'showPhysicsDebug',
  'devMode',
]);

/** Settings that are purely personal/local and safe to customize independently. */
export const PERSONAL_SETTINGS_KEYS = new Set(
  Object.keys(DEFAULTS).filter(k => !MATCH_FAIRNESS_KEYS.has(k) && !DEV_KEYS.has(k))
);

export function isPersonalSetting(key) {
  return PERSONAL_SETTINGS_KEYS.has(key);
}

export function isMatchFairnessSetting(key) {
  return MATCH_FAIRNESS_KEYS.has(key);
}

export function isDevSetting(key) {
  return DEV_KEYS.has(key);
}
