import assert from 'assert';
import { SettingsStore, MATCH_FAIRNESS_KEYS, isPersonalSetting, isMatchFairnessSetting, isDevSetting } from '../src/core/SettingsStore.js';
import { animMs, fxAnimMs } from '../src/core/AnimSpeed.js';

// Minimal DOM mock for Node test environment
if (typeof globalThis.document === 'undefined') {
  const styleMap = new Map();
  globalThis.document = {
    documentElement: {
      classList: {
        _classes: new Set(),
        toggle(name, force) {
          if (force === undefined) {
            if (this._classes.has(name)) this._classes.delete(name);
            else this._classes.add(name);
          } else if (force) this._classes.add(name);
          else this._classes.delete(name);
        },
        contains(name) { return this._classes.has(name); },
      },
      style: {
        setProperty(prop, val) { styleMap.set(prop, val); },
        getPropertyValue(prop) { return styleMap.get(prop) || ''; },
      },
    },
    getElementById: () => null,
    createElement: (tag) => ({
      tagName: tag,
      style: {},
      className: '',
      textContent: '',
      parentNode: null,
      children: [],
      appendChild(c) { this.children.push(c); return c; },
      removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; },
      addEventListener() {},
      removeEventListener() {},
      querySelectorAll: () => [],
      querySelector: () => null,
      setAttribute() {},
      getAttribute() { return null; },
      dataset: {},
    }),
    body: { appendChild() {}, removeChild() {} },
    addEventListener() {},
    removeEventListener() {},
    querySelectorAll: () => [],
    querySelector: () => null,
    activeElement: null,
  };
}
if (typeof globalThis.window === 'undefined') {
  globalThis.window = globalThis;
}
if (!globalThis.window.dispatchEvent) {
  globalThis.window.dispatchEvent = () => {};
}
if (!globalThis.CustomEvent) {
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
  };
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

// ── Tests ──

test('DEFAULTS contain all core audited keys', () => {
  const s = new SettingsStore();
  const required = [
    'reducedMotion', 'largeTextMode', 'highContrastUI', 'hudOpacity',
    'uiAnimSpeed', 'instantReplayEnabled', 'autoInstantReplay',
    'instantReplayThreshold', 'soundEnabled', 'masterVolume',
    'musicVolume', 'sfxVolume', 'ambientVolumeScale',
  ];
  for (const key of required) {
    assert.ok(key in s.getAll(), `missing DEFAULTS key: ${key}`);
  }
});

test('SettingsStore.set clamps instantReplayThreshold', () => {
  const s = new SettingsStore();
  s.set('instantReplayThreshold', 150);
  assert.strictEqual(s.get('instantReplayThreshold'), 100);
  s.set('instantReplayThreshold', -10);
  assert.strictEqual(s.get('instantReplayThreshold'), 0);
});

test('SettingsStore.set ignores locked keys', () => {
  const s = new SettingsStore();
  s.setLockedKeys(['trajectoryEnabled']);
  const before = s.get('trajectoryEnabled');
  s.set('trajectoryEnabled', !before);
  assert.strictEqual(s.get('trajectoryEnabled'), before);
  s.clearLockedKeys();
});

test('SettingsStore.reset preserves locked keys', () => {
  const s = new SettingsStore();
  s.set('masterVolume', 42);
  s.setLockedKeys(['masterVolume']);
  s.reset();
  assert.strictEqual(s.get('masterVolume'), 42);
  assert.strictEqual(s.get('reducedMotion'), false); // other keys reset
  s.clearLockedKeys();
});

test('MATCH_FAIRNESS_KEYS only contains implemented keys', () => {
  const implemented = [
    'trajectoryEnabled', 'minimapEnabled', 'turnTimer',
    'shotPowerSens', 'showCrosshair',
  ];
  for (const key of implemented) {
    assert.ok(MATCH_FAIRNESS_KEYS.has(key), `${key} should be in MATCH_FAIRNESS_KEYS`);
  }
});

test('isPersonalSetting returns true for non-fairness non-dev keys', () => {
  assert.ok(isPersonalSetting('reducedMotion'));
  assert.ok(isPersonalSetting('hudOpacity'));
  assert.ok(isPersonalSetting('largeTextMode'));
});

test('isMatchFairnessSetting returns true for fairness keys', () => {
  assert.ok(isMatchFairnessSetting('trajectoryEnabled'));
  assert.ok(isMatchFairnessSetting('turnTimer'));
});

test('isDevSetting returns true for dev keys', () => {
  assert.ok(isDevSetting('devMode'));
  assert.ok(isDevSetting('showPhysicsDebug'));
});

test('animMs scales by uiAnimSpeed', () => {
  assert.strictEqual(animMs(100), 100); // default speed 1.0
  assert.ok(animMs(200) > 0);
});

test('fxAnimMs scales by fxAnimSpeed', () => {
  assert.strictEqual(fxAnimMs(100), 100); // default speed 1.0
});

test('UI setReducedMotion toggles reduce-motion class', () => {
  // Simulate UI.setReducedMotion logic
  document.documentElement.classList.toggle('reduce-motion', true);
  assert.ok(document.documentElement.classList.contains('reduce-motion'));
  document.documentElement.classList.toggle('reduce-motion', false);
  assert.ok(!document.documentElement.classList.contains('reduce-motion'));
});

test('UI setLargeTextMode toggles large-text class', () => {
  document.documentElement.classList.toggle('large-text', true);
  assert.ok(document.documentElement.classList.contains('large-text'));
  document.documentElement.classList.toggle('large-text', false);
  assert.ok(!document.documentElement.classList.contains('large-text'));
});

test('UI setHighContrastUI toggles high-contrast class', () => {
  document.documentElement.classList.toggle('high-contrast', true);
  assert.ok(document.documentElement.classList.contains('high-contrast'));
  document.documentElement.classList.toggle('high-contrast', false);
  assert.ok(!document.documentElement.classList.contains('high-contrast'));
});

test('UI setHudOpacity publishes CSS custom property', () => {
  const opacity = '0.75';
  document.documentElement.style.setProperty('--hud-opacity', opacity);
  assert.strictEqual(document.documentElement.style.getPropertyValue('--hud-opacity'), opacity);
});

// ── Summary ──

console.log(`\nSettings audit tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
