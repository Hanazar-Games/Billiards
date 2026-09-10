import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Rules } from '../src/game/Rules.js';
import { TournamentEngine } from '../src/tournament/TournamentEngine.js';

const storage = new Map();
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key),
};
const noop = () => {};
const element = () => ({
  style: {}, children: [], dataset: {},
  appendChild(child) { this.children.push(child); child.parentNode = this; return child; },
  removeChild(child) { this.children = this.children.filter(c => c !== child); child.parentNode = null; },
  addEventListener: noop, removeEventListener: noop, setAttribute: noop,
  querySelectorAll: () => [], querySelector: () => null,
});
globalThis.document = {
  body: element(), head: element(), hidden: false,
  documentElement: { style: { setProperty: noop }, classList: { contains: () => false } },
  createElement: element, getElementById: () => null,
  addEventListener: noop, removeEventListener: noop,
  querySelector: () => null, querySelectorAll: () => [],
};
globalThis.window = new EventTarget();
globalThis.requestAnimationFrame = cb => setTimeout(cb, 0);
globalThis.cancelAnimationFrame = clearTimeout;

const { settings, SettingsStore } = await import('../src/core/SettingsStore.js');
const { KeyBindings } = await import('../src/input/KeyBindings.js');
const { GameLoop } = await import('../src/core/GameLoop.js');
const { BallReturnSystem } = await import('../src/fx/BallReturnSystem.js');
const { StatsPanel } = await import('../src/stats/StatsPanel.js');
const { AchievementPanel } = await import('../src/achievements/AchievementPanel.js');
const { InstantReplayController } = await import('../src/replay/InstantReplayController.js');
const { Game } = await import('../src/game/Game.js');
const { ChallengeManager } = await import('../src/challenges/ChallengeManager.js');
const { StatsTracker } = await import('../src/stats/StatsTracker.js');
const { careerStore } = await import('../src/career/CareerStore.js');
const { Minimap } = await import('../src/ui/Minimap.js');
const { Table } = await import('../src/game/Table.js');
const { Room } = await import('../src/game/Room.js');
const { NineBallRules } = await import('../src/game/NineBallRules.js');
const { DrillManager } = await import('../src/trainer/DrillManager.js');
const { AchievementSystem } = await import('../src/achievements/AchievementSystem.js');

test('ceiling light fixtures do not obscure the overhead table view', () => {
  const room = Object.assign(Object.create(Room.prototype), {
    _themeGroups: { downlightFixtures: { visible: true }, tableLightFixtures: { visible: true } },
    _lampDiffusers: [],
  });
  room.updateCameraVisibility({ position: new THREE.Vector3(0, 400, 0) });
  assert.equal(room._themeGroups.downlightFixtures.visible, false);
  assert.equal(room._themeGroups.tableLightFixtures.visible, false);
  room.updateCameraVisibility({ position: new THREE.Vector3(0, 100, 0) });
  assert.equal(room._themeGroups.downlightFixtures.visible, true);
  assert.equal(room._themeGroups.tableLightFixtures.visible, true);
});

test('AI shots cannot unlock personal achievements', () => {
  const system = new AchievementSystem();
  const before = system.store.getStat('totalShots');
  system.onShot({ mesh: { position: new THREE.Vector3() } }, 100, { x: 1, y: 1 }, 2, false);
  system.onPocket(1, null, 'vsai');
  system.onTurnEnd({ foul: false }, [1, 2, 3], 'vsai');
  assert.equal(system.store.getStat('totalShots'), before);
  assert.equal(system.store.isUnlocked('multi_pocket_3'), false);
});

test('a pocket on a foul cannot complete a soft-touch challenge', () => {
  const manager = new ChallengeManager('soft_touch');
  manager.start(); manager.onShot({ mesh: { position: new THREE.Vector3() } }, 5, { x: 0, y: 0 });
  manager.onPocket(1); manager.onTurnEnd({ foul: true, scratch: true });
  assert.equal(manager.completed, false);
});

test('a training scratch cannot award completion stars', () => {
  const drill = new DrillManager('straight_shot');
  drill.start(); drill.onPocket(1);
  drill.onBallsStopped({ pocketed: true, mesh: { position: new THREE.Vector3() } });
  assert.equal(drill.completed, false);
  assert.equal(drill.stars, 0);
});

test('individual appearance changes preserve the other preset colors', () => {
  const store = new SettingsStore();
  store.set('tableTheme', 'blackGold');
  store.set('feltTheme', 'blue');
  assert.equal(store.get('tableTheme'), 'custom');
  assert.equal(store.get('woodTheme'), 'blackLacquer');
  assert.equal(store.get('metalTrimTheme'), 'gold');
  store.set('roomTheme', 'modern');
  store.set('floorTheme', 'wood');
  assert.equal(store.get('roomTheme'), 'custom');
  assert.equal(store.get('wallTheme'), 'neutral');
});

test('repeated table bevels and room bulbs share their theme material', () => {
  for (const type of [Table, Room]) {
    const object = Object.assign(Object.create(type.prototype), { _materials: {} });
    const first = object._mat('repeated', { color: 0x123456 });
    const second = object._mat('repeated', { color: 0x123456 });
    try { assert.equal(first, second); } finally { first.dispose(); second.dispose(); }
  }
});

test('host fairness overrides never overwrite personal preferences', () => {
  const store = new SettingsStore();
  store.set('trajectoryEnabled', true);
  store.setLockedKeys(['trajectoryEnabled']);
  store.updateLockedValue('trajectoryEnabled', false);
  assert.equal(store.get('trajectoryEnabled'), false);
  store.set('musicVolume', 37);
  assert.equal(new SettingsStore().get('trajectoryEnabled'), true);
  store.clearLockedKeys();
  assert.equal(store.get('trajectoryEnabled'), true);
});

test('minimap draws in CSS pixels on a retina canvas', () => {
  let cleared;
  const ctx = new Proxy({ clearRect: (...args) => { cleared = args; } }, {
    get: (target, key) => target[key] ?? noop,
  });
  const map = Object.assign(Object.create(Minimap.prototype), {
    canvas: { width: 280, height: 560, style: { width: '140px', height: '280px' } },
    ctx, _enabled: true, _dirty: true, _padding: 8, _balls: [], _cueTrail: [],
  });
  map.draw();
  assert.deepEqual(cleared, [0, 0, 140, 280]);
});

test('quarterfinal elimination does not award an NPC semifinal trophy', () => {
  const engine = new TournamentEngine();
  engine.create('Player', 0);
  engine.recordGameResult(false);
  assert.equal(engine.state.trophy, null);
});

test('losing one semifinal game keeps the series active', () => {
  const engine = new TournamentEngine();
  engine.create('Player', 0);
  engine.recordGameResult(true);
  assert.equal(engine.recordGameResult(false).tournamentOver, false);
  assert.equal(engine.getCurrentMatch().played, false);
  assert.equal(engine.recordGameResult(false).tournamentOver, true);
  assert.equal(engine.state.trophy.name, '四强铜杯');
});

test('zero is a valid instant replay threshold', () => {
  const store = new SettingsStore();
  store.set('instantReplayThreshold', 0);
  assert.equal(store.get('instantReplayThreshold'), 0);
});

test('instant replay binding survives save and reload', () => {
  const keys = new KeyBindings();
  try {
    assert.equal(keys.matches('instantReplay', 'r', { shift: true, ctrl: false, alt: false, meta: false }), true);
    assert.equal(keys.setBinding('instantReplay', 'shift+i'), true);
    assert.equal(keys.getBinding('instantReplay'), 'shift+i');
  } finally { keys.dispose(); }
});

test('limited frames preserve elapsed simulation time', t => {
  settings.set('fpsLimit', '30');
  let now = 10;
  t.mock.method(performance, 'now', () => now);
  t.mock.method(globalThis, 'setTimeout', () => 1);
  t.mock.method(globalThis, 'requestAnimationFrame', () => 2);
  const updates = [];
  const loop = new GameLoop({ update: dt => updates.push(dt), render: noop });
  loop.running = true;
  loop.tick();
  now = 40;
  loop.tick();
  assert.deepEqual(updates, [0.04]);
  settings.set('fpsLimit', 'unlimited');
});

test('ball return works with reduced motion', () => {
  settings.set('reducedMotion', true);
  const effect = new BallReturnSystem(new THREE.Scene());
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1), new THREE.MeshBasicMaterial());
  try {
    assert.doesNotThrow(() => effect.animateBallReturn(mesh, new THREE.Vector3()));
    assert.equal(effect.active.length, 1);
  } finally {
    effect.dispose(); mesh.geometry.dispose(); mesh.material.dispose();
    settings.set('reducedMotion', false);
  }
});

test('closing a game summary schedules its removal', t => {
  let finish;
  t.mock.method(globalThis, 'setTimeout', fn => { finish = fn; return 1; });
  const panel = Object.assign(Object.create(StatsPanel.prototype), { _gameOverOverlay: { style: {} } });
  panel._hideGameOver();
  finish();
  assert.equal(panel._gameOverOverlay.style.display, 'none');
});

test('all simultaneous achievement toasts become visible', t => {
  const frames = new Map();
  let id = 0;
  t.mock.method(globalThis, 'requestAnimationFrame', fn => { frames.set(++id, fn); return id; });
  t.mock.method(globalThis, 'cancelAnimationFrame', key => frames.delete(key));
  const panel = new AchievementPanel({});
  try {
    ['first_win', 'combo_3', 'spin_shot'].forEach(key => panel.showToast(key));
    for (const fn of frames.values()) fn();
    assert.deepEqual(panel._activeToasts.map(entry => entry.element.style.opacity), ['1', '1', '1']);
  } finally { panel.destroy(); }
});

test('late ball-manager injection reaches the replay engine', () => {
  const replay = new InstantReplayController(new THREE.Scene(), new THREE.PerspectiveCamera(), null);
  const manager = { balls: [] };
  replay.setBallsManager(manager);
  assert.equal(replay.replayEngine.ballsManager, manager);
  replay.dispose();
});

test('8-ball accounts for balls pocketed before groups and by opponents', () => {
  const rules = new Rules();
  rules.startShot(1); rules.recordFirstHit(1); rules.resolveShot([1, 9], false);
  rules.startShot(1); rules.recordFirstHit(2); rules.resolveShot([2], false);
  assert.deepEqual(rules.player1Pocketed, [1, 2]);
  assert.deepEqual(rules.player2Pocketed, [9]);
  rules.startShot(2); rules.recordFirstHit(10); rules.resolveShot([3, 10], false);
  assert.ok(rules.player1Pocketed.includes(3));
  assert.ok(rules.player2Pocketed.includes(10));
});

test('8-ball cannot be won alongside the last group ball', () => {
  const rules = new Rules();
  rules.breakShot = false;
  rules.player1Group = 'solid'; rules.player2Group = 'stripe';
  rules.player1Pocketed = [1, 2, 3, 4, 5, 6];
  rules.startShot(1); rules.recordFirstHit(7);
  const result = rules.resolveShot([7, 8], false);
  assert.equal(result.winner, 2);
});

test('tournament fills both semifinal slots and plays the announced series', () => {
  const engine = new TournamentEngine();
  engine.create('Player', 0, '9ball');
  assert.equal(engine.getModeConfigForCurrentMatch().mode, '9ball');
  engine.recordGameResult(true);
  const semi = engine.getCurrentMatch();
  assert.ok(semi.player1 && semi.player2);
  const result = engine.recordGameResult(true);
  assert.equal(result.finished, false);
  assert.equal(engine.getCurrentMatch(), semi);
  engine.recordGameResult(true);
  const final = engine.getCurrentMatch();
  assert.ok(final.player1 && final.player2);
  for (let i = 0; i < 3; i++) engine.recordGameResult(true);
  assert.equal(engine.state.champion.isPlayer, true);
});

function gameForTurn(mode = 'freeplay') {
  const cue = { pocketed: false, mesh: { position: new THREE.Vector3() } };
  return Object.assign(Object.create(Game.prototype), {
    state: 'SHOOTING', mode, currentPlayer: 1, aiEnabled: false,
    cueTipOffset: { x: 0, y: 0 }, _lastShotPower: 55, _isBreakShot: false,
    trails: { stopRecording: noop },
    recorder: { stop: noop, getReplayData: () => null, reset: noop },
    ballsManager: { getCueBall: () => cue },
    ui: new Proxy({}, { get: () => noop }), audio: null,
    statsTracker: new StatsTracker(), statsPanel: { update: noop, showGameOver: noop },
    onboardingTips: { show: noop },
    achievements: new Proxy({}, { get: () => noop }),
    rules: { resolveShot: () => ({ nextPlayer: 1, foul: false }), getStatus: () => ({}) },
    _enterAimState() { this.state = 'AIM'; }, _updatePlayerStats: noop, _shouldTriggerAI: () => false,
  });
}

test('charging counts toward the turn deadline and grants ball-in-hand', t => {
  const game = gameForTurn('9ball');
  t.after(() => clearTimeout(game._cameraResetTimer));
  game.rules = new NineBallRules();
  game.state = 'CHARGING';
  game._turnTimerEnabled = true; game._turnTimerRemaining = 0.1; game._turnTimerMax = 30;
  game.startBallInHand = () => { game.ballInHand = true; };
  game._updateTurnTimer(0.2);
  assert.equal(game.currentPlayer, 2);
  assert.equal(game.rules.player1ConsecutiveFouls, 1);
  assert.equal(game.ballInHand, true);
});

test('third timed-out turn ends 9-ball before the game is disposed', () => {
  const game = gameForTurn('9ball');
  game.rules = new NineBallRules(); game.rules.player1ConsecutiveFouls = 2;
  game.state = 'AIM'; game._turnTimerEnabled = true; game._turnTimerRemaining = 0.1;
  let winner;
  game.onGameEnd = value => { winner = value; game.state = 'DISPOSED'; game.ui = null; };
  assert.doesNotThrow(() => game._updateTurnTimer(0.2));
  assert.equal(winner, 2);
});

test('conceding while the AI is shooting credits the AI with the win', () => {
  const game = gameForTurn('vsai'); game.aiEnabled = true; game.currentPlayer = 2;
  let winner;
  game.onGameEnd = value => { winner = value; game.state = 'DISPOSED'; game.ui = null; };
  assert.doesNotThrow(() => game._concede());
  assert.equal(winner, 2);
});

test('pausing does not consume the shot safety deadline', t => {
  const game = gameForTurn(); game._shotStartTime = 100; game.gameStartTime = 100;
  let now = 1000;
  t.mock.method(performance, 'now', () => now);
  game._showPause(); now = 31000; game._hidePause();
  assert.equal(game._shotStartTime, 30100);
});

test('freeplay challenges evaluate the actual completed shot', t => {
  t.mock.method(careerStore, 'recordShot', noop);
  const game = gameForTurn();
  game.challengeManager = new ChallengeManager('soft_touch');
  game.challengeManager.start();
  game.challengeManager.onShot(game.ballsManager.getCueBall(), 5, { x: 0, y: 0 });
  game.challengeManager.onPocket(1);
  game.resolveTurn([1]);
  assert.equal(game.challengeManager.completed, true);
});

test('career records percentages and excludes AI turns', t => {
  settings.set('cameraAutoResetAfterShot', false);
  const shots = [];
  t.mock.method(careerStore, 'recordShot', shot => shots.push(shot));
  const game = gameForTurn('vsai');
  game.aiEnabled = true;
  game.resolveTurn([]);
  assert.equal(shots[0].power, 50);
  game.currentPlayer = 2;
  game.resolveTurn([]);
  assert.equal(shots.length, 1);
});

test('a completed drill may synchronously dispose its game', () => {
  const game = gameForTurn('trainer');
  game.recorder.getReplayData = () => ({ metadata: {}, score: 35 });
  game.drillManager = { onBallsStopped: noop, completed: true, stars: 3 };
  game.onTrainerComplete = () => { game.state = 'DISPOSED'; game.statsTracker = null; };
  assert.doesNotThrow(() => game.resolveTurn([1]));
});
