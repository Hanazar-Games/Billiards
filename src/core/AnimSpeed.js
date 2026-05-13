import { settings } from './SettingsStore.js';

const CSS_VAR = '--ui-anim-speed';

/**
 * Return a duration in milliseconds scaled by the user's uiAnimSpeed setting.
 * @param {number} baseMs - base duration at 1.0x speed
 * @returns {number} scaled duration
 */
function _clampSpeed(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function animMs(baseMs) {
  return baseMs / _clampSpeed(settings.get('uiAnimSpeed'));
}

/**
 * Return a duration scaled by the user's fxAnimSpeed setting.
 * Used for gameplay FX (particles, trails, shockwaves) — separate from UI speed.
 * @param {number} baseMs - base duration at 1.0x speed
 * @returns {number} scaled duration
 */
export function fxAnimMs(baseMs) {
  return baseMs / _clampSpeed(settings.get('fxAnimSpeed'));
}

/**
 * Return a duration in seconds scaled by the user's uiAnimSpeed setting.
 * Useful for cssText strings that need "0.3s" format.
 * @param {number} baseSec - base duration in seconds at 1.0x speed
 * @returns {string} e.g. "0.3s"
 */
export function animSec(baseSec) {
  return (baseSec / _clampSpeed(settings.get('uiAnimSpeed'))).toFixed(3).replace(/\.?0+$/, '') + 's';
}

/**
 * Sync the CSS custom property with the current uiAnimSpeed value.
 * Call once at boot and whenever settings change.
 */
export function syncAnimSpeedCss() {
  document.documentElement.style.setProperty(CSS_VAR, String(_clampSpeed(settings.get('uiAnimSpeed'))));
}

/**
 * Auto-sync CSS variable on settings changes.
 * Call once at boot.
 */
export function autoSyncAnimSpeed() {
  syncAnimSpeedCss();
  window.addEventListener('settingsChanged', (e) => {
    if (e.detail?.key === 'uiAnimSpeed') {
      syncAnimSpeedCss();
    }
  });
}
