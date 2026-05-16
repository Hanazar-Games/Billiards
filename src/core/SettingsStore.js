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
  uiSoundVolumeScale: 1.0,
  ambientVolumeScale: 1.0,
  hitFeedbackVolumeScale: 1.0,
  audioDynamicRange: 'normal', // 'quiet' | 'normal' | 'cinematic'
  vibrationEnabled: false,
  lowLatencyMode: false,

  // ── Graphics & Performance ──
  trajectoryEnabled: true,
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
  ballDetail: 'high', // 'medium' | 'high'
  tableDetail: 'high', // 'medium' | 'high'
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
  feltColorTheme: 'classic', // 'classic' | 'blue' | 'red' | 'black' | 'purple' | 'wood'
  woodColorTheme: 'classic', // 'classic' | 'dark' | 'light' | 'walnut'
  ballStyle: 'standard', // 'standard' | 'glossy' | 'matte' | 'neon' | 'retro'
  ballNumbers: true,
  lightingStyle: 'warm', // 'warm' | 'cool' | 'neutral' | 'dramatic' | 'studio'
  lightingIntensity: 1.0,
  ambientIntensity: 0.5,
  roomStyle: 'classic', // 'classic' | 'modern' | 'pub' | 'neon' | 'outdoor'
  tableReflection: true,
  ballReflection: true,
  depthOfField: false,
  ballNumberSize: 'normal', // 'small' | 'normal' | 'large'
  ballNumberContrast: 'normal', // 'normal' | 'high'
  colorBlindMode: 'off', // 'off' | 'protanopia' | 'deuteranopia' | 'tritanopia'
  pocketHighlightEnabled: true,
  cushionHighlightEnabled: false,
  cueOpacity: 1.0,
  tableWearEnabled: true,

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
  showPlayerStatsPanel: true,
  showFPS: false,
  showBallLabels: false,
  showRemainingBalls: true,
  showComboCounter: true,
  showCrosshair: true,
  timerPosition: 'top', // 'top' | 'bottom' | 'center'
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
  quickBreak: false,
  autoSkipAnimation: false,
  skipOpponentTurn: false,
  showOpponentTrajectory: true,
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

// ── Fairness helpers ──

/** Settings that affect match fairness and should be host-controlled in competitive modes. */
export const MATCH_FAIRNESS_KEYS = new Set([
  'trajectoryEnabled',
  'minimapEnabled',
  'turnTimer',
  'shotPowerSens',
  'aimSens',
]);

/** Settings that are purely personal/local and safe to customize independently. */
export const PERSONAL_SETTINGS_KEYS = new Set(
  Object.keys(DEFAULTS).filter(k => !MATCH_FAIRNESS_KEYS.has(k))
);

export function isPersonalSetting(key) {
  return PERSONAL_SETTINGS_KEYS.has(key);
}

export function isMatchFairnessSetting(key) {
  return MATCH_FAIRNESS_KEYS.has(key);
}
