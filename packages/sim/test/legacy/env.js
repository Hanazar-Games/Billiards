// Minimal browser globals so the existing game modules load outside a browser
// (Node or goja). Only what the import graph and object construction touch.

export const SHIMS_USED = [];

function noteShim(name) {
  if (!SHIMS_USED.includes(name)) SHIMS_USED.push(name);
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A canvas 2D context whose every member is a no-op returning itself, so
// chained calls (createLinearGradient(...).addColorStop(...)) keep working
// and numeric reads coerce to 0.
function noopContext() {
  const proxy = new Proxy(function () {}, {
    get: (_, key) => (key === Symbol.toPrimitive ? () => 0 : proxy),
    apply: () => proxy,
    set: () => true,
  });
  return proxy;
}

function createMemoryStorage() {
  const data = new Map();
  return {
    get length() { return data.size; },
    key: (i) => [...data.keys()][i] ?? null,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)); },
    removeItem: (k) => { data.delete(k); },
    clear: () => { data.clear(); },
  };
}

export function installEnv({ seed }) {
  if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
      createElement: () => ({ width: 0, height: 0, style: {}, getContext: noopContext }),
    };
    noteShim('document');
  }
  if (typeof globalThis.localStorage === 'undefined') {
    globalThis.localStorage = createMemoryStorage();
    noteShim('localStorage');
  }
  Math.random = mulberry32(seed);
}
