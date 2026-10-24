import assert from 'assert';
import { UILayout } from '../src/ui/UILayout.js';

// Minimal DOM mock for Node test environment
if (typeof globalThis.document === 'undefined') {
  const styleMap = new Map();
  const mockRoot = {
    style: {
      setProperty(prop, val) { styleMap.set(prop, val); },
      getPropertyValue(prop) { return styleMap.get(prop) || ''; },
    },
  };
  globalThis.document = {
    documentElement: mockRoot,
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
if (!globalThis.window.getComputedStyle) {
  globalThis.window.getComputedStyle = (el) => ({
    getPropertyValue(prop) {
      if (el && el.style) return el.style.getPropertyValue(prop) || '';
      return '';
    },
  });
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

test('claim single bottom zone updates CSS var', () => {
  const layout = new UILayout();
  layout.claim('bottomHud', 'bottom', 40);
  assert.strictEqual(layout.getSafe('bottom'), 40);
  layout.release('bottomHud');
  assert.strictEqual(layout.getSafe('bottom'), 0);
  layout.release('bottomHud'); // idempotent
});

test('stack mode accumulates sizes', () => {
  const layout = new UILayout();
  layout.claim('a', 'bottom', 30, { mode: 'stack' });
  layout.claim('b', 'bottom', 20, { mode: 'stack' });
  assert.strictEqual(layout.getSafe('bottom'), 50);
  layout.release('a');
  assert.strictEqual(layout.getSafe('bottom'), 20);
  layout.release('b');
  assert.strictEqual(layout.getSafe('bottom'), 0);
});

test('max mode takes largest size', () => {
  const layout = new UILayout();
  layout.claim('a', 'right', 60, { mode: 'max' });
  layout.claim('b', 'right', 40, { mode: 'max' });
  assert.strictEqual(layout.getSafe('right'), 60);
  layout.release('a');
  assert.strictEqual(layout.getSafe('right'), 40);
  layout.release('b');
});

test('mixed stack and max on same side', () => {
  const layout = new UILayout();
  layout.claim('stackA', 'left', 10, { mode: 'stack' });
  layout.claim('maxA', 'left', 25, { mode: 'max' });
  assert.strictEqual(layout.getSafe('left'), 25); // max(10, 25) = 25
  layout.claim('stackB', 'left', 15, { mode: 'stack' });
  assert.strictEqual(layout.getSafe('left'), 25); // max(25, 25) = 25
  layout.release('maxA');
  assert.strictEqual(layout.getSafe('left'), 25); // stack total = 25
});

test('getOffset accounts for lower-priority stack claims', () => {
  const layout = new UILayout();
  layout.claim('a', 'bottom', 10, { mode: 'stack', priority: 0 });
  layout.claim('b', 'bottom', 20, { mode: 'stack', priority: 1 });
  layout.claim('c', 'bottom', 30, { mode: 'stack', priority: 2 });
  assert.strictEqual(layout.getOffset('a'), 10);
  assert.strictEqual(layout.getOffset('b'), 30);
  assert.strictEqual(layout.getOffset('c'), 60);
  layout.release('b');
  assert.strictEqual(layout.getOffset('c'), 40);
});

test('update changes existing claim size', () => {
  const layout = new UILayout();
  layout.claim('x', 'top', 10);
  assert.strictEqual(layout.getSafe('top'), 10);
  layout.update('x', 30);
  assert.strictEqual(layout.getSafe('top'), 30);
  layout.release('x');
});

test('getStackedSafe returns only stack total', () => {
  const layout = new UILayout();
  layout.claim('s', 'right', 5, { mode: 'stack' });
  layout.claim('m', 'right', 100, { mode: 'max' });
  assert.strictEqual(layout.getStackedSafe('right'), 5);
  assert.strictEqual(layout.getMaxSafe('right'), 100);
  layout.release('s');
  layout.release('m');
});

test('claims snapshot via getClaims', () => {
  const layout = new UILayout();
  layout.claim('a', 'bottom', 10);
  const claims = layout.getClaims();
  assert.strictEqual(claims.size, 1);
  assert.strictEqual(claims.get('a').size, 10);
  layout.release('a');
});

test('priority sorting works correctly', () => {
  const layout = new UILayout();
  layout.claim('high', 'bottom', 5, { priority: 5, mode: 'stack' });
  layout.claim('low', 'bottom', 10, { priority: 1, mode: 'stack' });
  // low priority (1) comes first, then high (5)
  assert.strictEqual(layout.getOffset('low'), 10);
  assert.strictEqual(layout.getOffset('high'), 15);
  layout.release('high');
  layout.release('low');
});

test('updateScale adjusts visual footprint', () => {
  const layout = new UILayout();
  layout.claim('x', 'bottom', 40);
  layout.updateScale('x', 1.5);
  assert.strictEqual(layout.getSafe('bottom'), 60);
  layout.updateScale('x', 1);
  assert.strictEqual(layout.getSafe('bottom'), 40);
  layout.release('x');
});

// ── Summary ──

console.log(`\nUILayout tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
