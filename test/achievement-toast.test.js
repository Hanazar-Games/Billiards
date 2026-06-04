/**
 * Achievement Toast Layout & Queue Tests
 *
 * Covers:
 *   - Toast container uses UILayout safe-zone (top/right) instead of hard-coded bottom/right
 *   - Multiple toasts queue when max visible is reached
 *   - Queue drains automatically when a toast dismisses
 *   - destroy() cleans all active toasts, timers and RAF
 *   - reducedMotion shortens transition duration and dwell time
 *   - Unknown achievement ids are silently ignored
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';

// Minimal DOM mock
if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    documentElement: {
      classList: { toggle() {}, contains() { return false; } },
      style: { setProperty() {} },
    },
    createElement(tag) {
      return {
        tagName: tag, style: {}, className: '', textContent: '', innerHTML: '',
        parentNode: null, children: [], dataset: {},
        appendChild(c) { this.children.push(c); return c; },
        removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; },
        addEventListener() {}, removeEventListener() {},
        querySelectorAll: () => [], querySelector: () => null,
        setAttribute() {}, getAttribute() { return null; },
      };
    },
    body: { appendChild() {}, removeChild() {}, children: [] },
    head: { appendChild() {}, removeChild() {} },
    addEventListener() {}, removeEventListener() {},
    getElementById: () => null,
    querySelectorAll: () => [], querySelector: () => null,
  };
  globalThis.window = {
    addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
    innerWidth: 1920, innerHeight: 1080,
  };
}

// We need requestAnimationFrame / cancelAnimationFrame
globalThis.requestAnimationFrame = (fn) => { return setTimeout(fn, 0); };
globalThis.cancelAnimationFrame = (id) => { clearTimeout(id); };

// Stub isReducedMotion before importing AchievementPanel
const moduleCache = new Map();

describe('AchievementPanel toast layout & queue', () => {
  test('toast container uses top/right safe-zone', async () => {
    const { AchievementPanel } = await import('../src/achievements/AchievementPanel.js');
    const panel = new AchievementPanel({ getAllAchievements: () => [] });
    assert.ok(panel.toastContainer);
    const style = panel.toastContainer.style.cssText;
    assert.ok(style.includes('hud-top-safe'), 'should reference hud-top-safe');
    assert.ok(style.includes('hud-right-safe'), 'should reference hud-right-safe');
    assert.ok(!style.includes('bottom: 24px'), 'should not hard-code bottom');
    panel.destroy();
  });

  test('queues toasts beyond max visible', async () => {
    const { AchievementPanel } = await import('../src/achievements/AchievementPanel.js');
    const panel = new AchievementPanel({ getAllAchievements: () => [] });
    panel.showToast('first_win');
    panel.showToast('combo_3');
    panel.showToast('spin_shot');
    panel.showToast('bank_shot'); // should queue
    assert.strictEqual(panel._activeToasts.length, 3);
    assert.strictEqual(panel._toastQueue.length, 1);
    assert.strictEqual(panel._toastQueue[0], 'bank_shot');
    panel.destroy();
  });

  test('deduplicates queue entries', async () => {
    const { AchievementPanel } = await import('../src/achievements/AchievementPanel.js');
    const panel = new AchievementPanel({ getAllAchievements: () => [] });
    panel.showToast('first_win');
    panel.showToast('combo_3');
    panel.showToast('spin_shot');
    panel.showToast('bank_shot');
    panel.showToast('bank_shot'); // duplicate, should not add again
    assert.strictEqual(panel._toastQueue.length, 1);
    panel.destroy();
  });

  test('destroy clears active toasts and queue', async () => {
    const { AchievementPanel } = await import('../src/achievements/AchievementPanel.js');
    const panel = new AchievementPanel({ getAllAchievements: () => [] });
    panel.showToast('first_win');
    panel.showToast('combo_3');
    panel.showToast('spin_shot');
    panel.showToast('bank_shot');
    panel.destroy();
    assert.strictEqual(panel._activeToasts.length, 0);
    assert.strictEqual(panel._toastQueue.length, 0);
    assert.strictEqual(panel._toastRaf, null);
  });

  test('ignores unknown achievement id', async () => {
    const { AchievementPanel } = await import('../src/achievements/AchievementPanel.js');
    const panel = new AchievementPanel({ getAllAchievements: () => [] });
    panel.showToast('nonexistent_id_12345');
    assert.strictEqual(panel._activeToasts.length, 0);
    assert.strictEqual(panel._toastQueue.length, 0);
    panel.destroy();
  });

  test('reducedMotion sets transition to 0.01ms', async () => {
    const originalContains = document.documentElement.classList.contains;
    document.documentElement.classList.contains = (cls) => cls === 'reduce-motion';

    const { AchievementPanel } = await import('../src/achievements/AchievementPanel.js?t=' + Date.now());
    const panel = new AchievementPanel({ getAllAchievements: () => [] });
    panel.showToast('first_win');
    const toast = panel._activeToasts[0]?.element;
    assert.ok(toast);
    assert.ok(toast.style.cssText.includes('0.01ms'), 'transition should be 0.01ms under reduced motion');
    panel.destroy();

    document.documentElement.classList.contains = originalContains;
  });

  test('queue drains when a toast is removed', async () => {
    const { AchievementPanel } = await import('../src/achievements/AchievementPanel.js');
    const panel = new AchievementPanel({ getAllAchievements: () => [] });
    panel.showToast('first_win');
    panel.showToast('combo_3');
    panel.showToast('spin_shot');
    panel.showToast('bank_shot'); // queued
    assert.strictEqual(panel._activeToasts.length, 3);
    assert.strictEqual(panel._toastQueue.length, 1);

    // Manually remove first active toast
    const first = panel._activeToasts[0];
    panel._removeToastEntry(first);
    assert.strictEqual(panel._activeToasts.length, 3); // 2 remaining + 1 from queue
    assert.strictEqual(panel._toastQueue.length, 0);
    panel.destroy();
  });
});
