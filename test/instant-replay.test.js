import assert from 'assert';
import * as THREE from 'three';
import { InstantReplayController } from '../src/replay/InstantReplayController.js';
import { settings } from '../src/core/SettingsStore.js';

// Mock minimal DOM for InstantReplayUI
if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
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
      setAttribute() {},
    }),
    body: {
      appendChild() {},
      removeChild() {},
    },
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

function makeMockBallsManager() {
  const balls = [];
  for (let i = 0; i < 16; i++) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1),
      new THREE.MeshBasicMaterial()
    );
    mesh.position.set(i * 2, 1, i * 2);
    balls.push({ id: i, mesh, pocketed: false, body: null });
  }
  return {
    balls,
    getCueBall() { return balls[0]; },
    getBall(id) { return balls.find((b) => b.id === id); },
  };
}

function makeReplayData(frameCount = 10) {
  const frames = [];
  for (let f = 0; f < frameCount; f++) {
    for (let i = 0; i < 16; i++) {
      frames.push(i * 2 + f * 0.1, i * 2 + f * 0.1);
    }
  }
  return {
    metadata: { startTime: 0, endTime: 1000, mode: 'local2p', score: 40 },
    frames,
    frameCount,
    frameRate: 60,
    score: 40,
  };
}

/* ── Static helpers ── */

test('shouldAutoTrigger returns true when score >= threshold and settings on', () => {
  settings.set('instantReplayEnabled', true);
  settings.set('autoInstantReplay', true);
  settings.set('instantReplayThreshold', 30);
  assert.strictEqual(InstantReplayController.shouldAutoTrigger({ score: 35 }), true);
});

test('shouldAutoTrigger returns false when score < threshold', () => {
  settings.set('instantReplayEnabled', true);
  settings.set('autoInstantReplay', true);
  settings.set('instantReplayThreshold', 50);
  assert.strictEqual(InstantReplayController.shouldAutoTrigger({ score: 35 }), false);
});

test('shouldAutoTrigger returns false when autoInstantReplay disabled', () => {
  settings.set('instantReplayEnabled', true);
  settings.set('autoInstantReplay', false);
  assert.strictEqual(InstantReplayController.shouldAutoTrigger({ score: 80 }), false);
});

test('shouldAutoTrigger returns false when instantReplayEnabled disabled', () => {
  settings.set('instantReplayEnabled', false);
  settings.set('autoInstantReplay', true);
  assert.strictEqual(InstantReplayController.shouldAutoTrigger({ score: 80 }), false);
});

test('shouldAutoTrigger returns false for null data', () => {
  assert.strictEqual(InstantReplayController.shouldAutoTrigger(null), false);
});

test('isEnabled reflects setting', () => {
  settings.set('instantReplayEnabled', true);
  assert.strictEqual(InstantReplayController.isEnabled(), true);
  settings.set('instantReplayEnabled', false);
  assert.strictEqual(InstantReplayController.isEnabled(), false);
});

/* ── Lifecycle ── */

test('constructor sets up components', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const controller = new InstantReplayController(scene, camera, null);
  assert.ok(controller.replayEngine);
  assert.ok(controller.cameraDirector);
  assert.ok(controller.ui);
  assert.strictEqual(controller.active, false);
  controller.dispose();
});

test('start returns false for invalid data', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const controller = new InstantReplayController(scene, camera, null);
  assert.strictEqual(controller.start(null), false);
  assert.strictEqual(controller.start({ frames: [], frameCount: 0 }), false);
  assert.strictEqual(controller.start({ frames: [1, 2], frameCount: 1 }), false);
  controller.dispose();
});

test('start returns true and sets active for valid data', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const bm = makeMockBallsManager();
  const controller = new InstantReplayController(scene, camera, bm);
  const result = controller.start(makeReplayData(10));
  assert.strictEqual(result, true);
  assert.strictEqual(controller.active, true);
  controller.skip();
  assert.strictEqual(controller.active, false);
  controller.dispose();
});

test('start returns false when already active', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const bm = makeMockBallsManager();
  const controller = new InstantReplayController(scene, camera, bm);
  controller.start(makeReplayData(10));
  assert.strictEqual(controller.start(makeReplayData(10)), false);
  controller.skip();
  controller.dispose();
});

test('skip ends replay and restores state', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const bm = makeMockBallsManager();
  const originalPos = bm.balls[0].mesh.position.clone();
  const controller = new InstantReplayController(scene, camera, bm);

  controller.start(makeReplayData(10));
  assert.strictEqual(controller.active, true);

  controller.skip();
  assert.strictEqual(controller.active, false);
  // Ball position should be restored
  assert.ok(bm.balls[0].mesh.position.equals(originalPos));
  controller.dispose();
});

test('update runs without error when active', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const bm = makeMockBallsManager();
  const controller = new InstantReplayController(scene, camera, bm);
  controller.start(makeReplayData(10));
  controller.update(0.016);
  controller.update(0.05);
  controller.skip();
  controller.dispose();
});

test('update is no-op when not active', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const controller = new InstantReplayController(scene, camera, null);
  controller.update(0.016); // should not throw
  controller.dispose();
});

test('dispose cleans up even when active', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const bm = makeMockBallsManager();
  const controller = new InstantReplayController(scene, camera, bm);
  controller.start(makeReplayData(10));
  controller.dispose();
  assert.strictEqual(controller.active, false);
  assert.strictEqual(controller.replayEngine, null);
});

/* ── onComplete callback ── */

test('onComplete is called after skip', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const bm = makeMockBallsManager();
  const controller = new InstantReplayController(scene, camera, bm);
  let called = false;
  controller.start(makeReplayData(10), { onComplete: () => { called = true; } });
  controller.skip();
  assert.strictEqual(called, true);
  controller.dispose();
});

/* ── Camera state save/restore ── */

test('camera state is restored after replay', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(10, 20, 30);
  camera.lookAt(0, 0, 0);
  const originalPos = camera.position.clone();

  const bm = makeMockBallsManager();
  const controller = new InstantReplayController(scene, camera, bm);
  controller.start(makeReplayData(10));
  controller.skip();

  assert.ok(camera.position.equals(originalPos));
  controller.dispose();
});

/* ── Camera director cinematic logic ── */

test('camera director receives replay metadata', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const bm = makeMockBallsManager();
  const controller = new InstantReplayController(scene, camera, bm);
  const data = makeReplayData(10);
  data.metadata.collisionCount = 5;
  data.metadata.pocketedIds = [3];

  controller.start(data);
  assert.ok(controller.cameraDirector._metadata);
  assert.strictEqual(controller.cameraDirector._hasCollisions, true);
  assert.strictEqual(controller.cameraDirector._hasPockets, true);
  controller.skip();
  controller.dispose();
});

test('camera director reducedMotion uses stable overhead', async () => {
  const { InstantReplayCamera } = await import('../src/replay/InstantReplayCamera.js');
  settings.set('reducedMotion', true);
  const camera = new THREE.PerspectiveCamera();
  const director = new InstantReplayCamera(camera);
  director.setReplayData({ metadata: { pocketedIds: [3], collisionCount: 0 } });

  const bm = makeMockBallsManager();
  // progress 0.5 should land in overhead phase for reduced motion
  director.update(0.5, 3, bm);
  // Overhead position is high Y
  assert.ok(director._targetPos.y > 80);
  settings.set('reducedMotion', false);
});

test('camera director normal mode switches through cinematic phases', async () => {
  const { InstantReplayCamera } = await import('../src/replay/InstantReplayCamera.js');
  settings.set('reducedMotion', false);
  const camera = new THREE.PerspectiveCamera();
  const director = new InstantReplayCamera(camera);
  director.setReplayData({ metadata: { pocketedIds: [], collisionCount: 0 } });

  const bm = makeMockBallsManager();
  // Impact phase — low, close to cue ball
  director.update(0.02, 3, bm);
  const impactY = director._targetPos.y;
  assert.ok(impactY < 15);

  // Action phase — higher follow cam
  director.update(0.15, 3, bm);
  const actionY = director._targetPos.y;
  assert.ok(actionY > impactY);

  // Settle phase — wide side
  director.update(0.95, 3, bm);
  const settleX = Math.abs(director._targetPos.x);
  assert.ok(settleX > 40);
});

test('camera director collision-aware side angle for heavy collisions', async () => {
  const { InstantReplayCamera } = await import('../src/replay/InstantReplayCamera.js');
  settings.set('reducedMotion', false);
  const camera = new THREE.PerspectiveCamera();
  const director = new InstantReplayCamera(camera);
  director.setReplayData({ metadata: { pocketedIds: [], collisionCount: 6 } });

  const bm = makeMockBallsManager();
  director.update(0.12, 3, bm);
  const sideX = Math.abs(director._targetPos.x);
  // Side angle should be far from center
  assert.ok(sideX > 40);
});

/* ── Summary ── */

console.log(`\n▶ Instant Replay`);
console.log(`  ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
