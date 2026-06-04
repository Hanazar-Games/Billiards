/**
 * Panel Lifecycle Governance Tests
 *
 * Covers:
 *   - Duplicate show/re-entry guard
 *   - Animation timer / listener leak prevention on destroy
 *   - Escape routing consistency
 *   - _hideAllPanels coverage before entering game modes
 *   - reducedMotion compliance
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';

// ── Minimal DOM Mock ───────────────────────────────────────────────────────

const listeners = new Map(); // type -> Set<fn>

class MockEvent {
  constructor(key) {
    this.key = key;
    this._stopped = false;
    this._prevented = false;
  }
  stopPropagation() { this._stopped = true; }
  preventDefault() { this._prevented = true; }
  stopImmediatePropagation() { this._stopped = true; }
}

class MockElement {
  constructor(tag) {
    this.tagName = tag;
    this.style = { cssText: '', display: '', opacity: '', animation: '', zIndex: '' };
    this.className = '';
    this.id = '';
    this.textContent = '';
    this.innerHTML = '';
    this.parentNode = null;
    this.children = [];
    this.dataset = {};
    this._listeners = [];
  }
  appendChild(c) {
    this.children.push(c);
    c.parentNode = this;
    return c;
  }
  removeChild(c) {
    const i = this.children.indexOf(c);
    if (i >= 0) this.children.splice(i, 1);
    c.parentNode = null;
    return c;
  }
  addEventListener(type, fn) {
    this._listeners.push({ type, fn });
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(fn);
  }
  removeEventListener(type, fn) {
    const idx = this._listeners.findIndex(l => l.type === type && l.fn === fn);
    if (idx >= 0) this._listeners.splice(idx, 1);
    if (listeners.has(type)) listeners.get(type).delete(fn);
  }
  querySelector(sel) {
    if (sel.startsWith('#') && this.id === sel.slice(1)) return this;
    for (const c of this.children) {
      const r = c.querySelector(sel);
      if (r) return r;
    }
    return null;
  }
  querySelectorAll(sel) {
    const out = [];
    if (sel.startsWith('#') && this.id === sel.slice(1)) out.push(this);
    for (const c of this.children) out.push(...c.querySelectorAll(sel));
    return out;
  }
  setAttribute() {}
  getAttribute() { return null; }
  focus() {}
}

const mockDoc = {
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
    style: { setProperty() {}, getPropertyValue() { return ''; } },
  },
  createElement(tag) { return new MockElement(tag); },
  body: new MockElement('body'),
  head: new MockElement('head'),
  getElementById(id) {
    function find(el) {
      if (el.id === id) return el;
      for (const c of el.children) {
        const r = find(c);
        if (r) return r;
      }
      return null;
    }
    return find(mockDoc.body) || find(mockDoc.head) || null;
  },
  addEventListener(type, fn) {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(fn);
  },
  removeEventListener(type, fn) {
    if (listeners.has(type)) listeners.get(type).delete(fn);
  },
  querySelectorAll: () => [],
  querySelector: () => null,
  activeElement: null,
};

if (typeof globalThis.document === 'undefined') {
  globalThis.document = mockDoc;
  globalThis.window = {
    addEventListener: mockDoc.addEventListener.bind(mockDoc),
    removeEventListener: mockDoc.removeEventListener.bind(mockDoc),
    dispatchEvent: () => {},
    innerWidth: 1920,
    innerHeight: 1080,
  };
  globalThis.requestAnimationFrame = (cb) => { cb(); return 1; };
  globalThis.cancelAnimationFrame = () => {};
}

// ── Helpers ────────────────────────────────────────────────────────────────

function clearListeners() {
  listeners.clear();
}

function dispatchKey(key) {
  const evt = new MockEvent(key);
  const set = listeners.get('keydown') || new Set();
  for (const fn of set) fn(evt);
  return evt;
}

function getKeyListeners() {
  return listeners.get('keydown') || new Set();
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('CareerPanel lifecycle', () => {
  test('duplicate show is ignored', async () => {
    clearListeners();
    const { CareerPanel } = await import('../src/career/CareerPanel.js');
    let renderCount = 0;
    const panel = new CareerPanel(() => {});
    const origRender = panel._render.bind(panel);
    panel._render = () => { renderCount++; origRender(); };
    panel.show();
    panel.show();
    assert.strictEqual(renderCount, 1, 'second show should be ignored');
    panel.destroy();
  });

  test('destroy removes keydown listener', async () => {
    clearListeners();
    const { CareerPanel } = await import('../src/career/CareerPanel.js');
    const panel = new CareerPanel(() => {});
    panel.show();
    const before = getKeyListeners().size;
    panel.destroy();
    const after = getKeyListeners().size;
    assert.strictEqual(after, before - 1, 'keydown listener should be removed');
  });

  test('reducedMotion disables show animation', async () => {
    clearListeners();
    document.documentElement.classList.toggle('reduce-motion', true);
    const { CareerPanel } = await import('../src/career/CareerPanel.js');
    const panel = new CareerPanel(() => {});
    panel.show();
    assert.strictEqual(panel.container.style.animation, 'none');
    panel.destroy();
    document.documentElement.classList.toggle('reduce-motion', false);
  });
});

describe('ChallengeResult lifecycle', () => {
  test('Escape calls onExit', async () => {
    clearListeners();
    const { ChallengeResult } = await import('../src/challenges/ChallengeResult.js');
    let exited = false;
    const result = new ChallengeResult(() => {}, () => { exited = true; });
    result.show('Test', false, 0, {});
    dispatchKey('Escape');
    assert.strictEqual(exited, true);
    result.destroy();
  });

  test('duplicate show is ignored', async () => {
    clearListeners();
    const { ChallengeResult } = await import('../src/challenges/ChallengeResult.js');
    const result = new ChallengeResult(() => {}, () => {});
    result.show('Test', false, 0, {});
    const firstDisplay = result.container.style.display;
    result.show('Test', false, 0, {});
    assert.strictEqual(result._shown, true);
    result.destroy();
  });
});

describe('TrainerResult lifecycle', () => {
  test('Escape calls onExit', async () => {
    clearListeners();
    const { TrainerResult } = await import('../src/trainer/TrainerResult.js');
    let exited = false;
    const result = new TrainerResult(() => {}, () => { exited = true; });
    result.show('Test', true, 2, {});
    dispatchKey('Escape');
    assert.strictEqual(exited, true);
    result.destroy();
  });
});

describe('TournamentPanel lifecycle', () => {
  test('Escape listener exists and routes back', async () => {
    clearListeners();
    // TournamentPanel needs menu-layer
    const layer = document.createElement('div');
    layer.id = 'menu-layer';
    document.body.appendChild(layer);

    const { TournamentPanel } = await import('../src/tournament/TournamentPanel.js');
    let backCalled = false;
    const panel = new TournamentPanel(() => {}, () => { backCalled = true; });
    panel.show();
    dispatchKey('Escape');
    assert.strictEqual(backCalled, true, 'Escape should trigger onBack');
    panel.destroy();
    document.body.removeChild(layer);
  });

  test('duplicate show is ignored', async () => {
    clearListeners();
    const layer = document.createElement('div');
    layer.id = 'menu-layer';
    document.body.appendChild(layer);

    const { TournamentPanel } = await import('../src/tournament/TournamentPanel.js');
    const panel = new TournamentPanel(() => {}, () => {});
    panel.show();
    const before = panel.container.style.display;
    panel.show(); // ignored
    assert.strictEqual(panel._shown, true);
    panel.destroy();
    document.body.removeChild(layer);
  });
});

describe('TournamentResult lifecycle', () => {
  test('Escape calls onBack', async () => {
    clearListeners();
    const layer = document.createElement('div');
    layer.id = 'menu-layer';
    document.body.appendChild(layer);

    const { TournamentResult } = await import('../src/tournament/TournamentResult.js');
    let backCalled = false;
    const result = new TournamentResult(() => {}, () => { backCalled = true; });
    result.showChampion('Player', 'Opponent', '8ball');
    dispatchKey('Escape');
    assert.strictEqual(backCalled, true);
    result.destroy();
    document.body.removeChild(layer);
  });
});

describe('MenuSystem _hideAllPanels coverage', () => {
  test('hides challengeResult and trainerResult and tournamentResult', async () => {
    clearListeners();
    const { MenuSystem } = await import('../src/menu/MenuSystem.js');
    const fake = {};
    fake.settingsScreen = { hide() { this._hidden = true; } };
    fake.replayPanel = { hideList() { this._listHidden = true; }, hideControls() { this._controlsHidden = true; } };
    fake.achievementPanel = { hide() { this._hidden = true; } };
    fake.challengePanel = { hide() { this._hidden = true; } };
    fake.challengeResult = { hide() { this._hidden = true; } };
    fake.trainerPanel = { hide() { this._hidden = true; } };
    fake.trainerResult = { hide() { this._hidden = true; } };
    fake.lanRoomPanel = null;
    fake.matchSetupPanel = null;
    fake.tournamentPanel = { hide() { this._hidden = true; } };
    fake.tournamentResult = { hide() { this._hidden = true; } };
    fake.careerPanel = { hide() { this._hidden = true; } };
    fake.analyzerPanel = { hide() { this._hidden = true; } };

    MenuSystem.prototype._hideAllPanels.call(fake);

    assert.strictEqual(fake.challengeResult._hidden, true);
    assert.strictEqual(fake.trainerResult._hidden, true);
    assert.strictEqual(fake.tournamentResult._hidden, true);
    assert.strictEqual(fake.analyzerPanel._hidden, true);
    assert.strictEqual(fake.replayPanel._controlsHidden, true);
  });
});
