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
const { keyBindings } = await import('../src/input/KeyBindings.js');
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
const { ShotRecorder } = await import('../src/replay/ShotRecorder.js');
const { GameStateSerializer } = await import('../src/net/GameStateSerializer.js');
const { applyShotInput } = await import('../src/game/ShotInput.js');
const { MenuSystem } = await import('../src/menu/MenuSystem.js');
const { LanRoomPanel } = await import('../src/menu/LanRoomPanel.js');
const { NetworkClient } = await import('../src/net/NetworkClient.js');
const { BALL, SHOT } = await import('../src/config.js');

test('natural instant replay completion restores the camera before returning', () => {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(10, 300, 200); camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const original = camera.matrixWorld.clone();
  const ball = { id: 0, pocketed: false, mesh: new THREE.Object3D() };
  const manager = { balls: [ball], getCueBall: () => ball };
  const recorder = new ShotRecorder();
  recorder.start(manager, 'freeplay', 50, {}); recorder.update(0.05, manager); recorder.stop();
  const replay = new InstantReplayController(new THREE.Scene(), camera, manager);
  let finished = 0;
  try {
    assert.equal(replay.start(recorder.getReplayData(), { onComplete: () => finished++ }), true);
    for (let i = 0; i < 10; i++) replay.update(0.05);
    camera.updateMatrixWorld();
    assert.equal(finished, 1);
    assert.ok(camera.matrixWorld.equals(original));
  } finally { replay.dispose(); }
});

test('instant replay completion can dispose the controller synchronously', () => {
  const ball = { id: 0, pocketed: false, mesh: new THREE.Object3D() };
  const manager = { balls: [ball], getCueBall: () => ball };
  const recorder = new ShotRecorder();
  recorder.start(manager, 'freeplay', 50, {}); recorder.update(0.05, manager); recorder.stop();
  const replay = new InstantReplayController(new THREE.Scene(), new THREE.PerspectiveCamera(), manager);
  replay.start(recorder.getReplayData(), { onComplete: () => replay.dispose() });
  assert.doesNotThrow(() => { for (let i = 0; i < 10; i++) replay.update(0.05); });
});

test('canonical 9-ball mode uses nine-ball rules', () => {
  assert.equal(MenuSystem.prototype._getModeConfig('9ball').mode, '9ball');
});

test('starting a LAN game transfers the room connection without leaving', async () => {
  let left = 0;
  const client = { isHost: true, playerId: 1, leaveRoom: () => left++, removeEventListener: noop };
  const panel = Object.assign(Object.create(LanRoomPanel.prototype), { client, _clientListeners: [] });
  const menu = Object.assign(Object.create(MenuSystem.prototype), { lanRoomPanel: panel });
  menu._startGame = async (_mode, connection) => {
    menu._hideAllPanels();
    assert.equal(connection, client);
  };
  await menu._startNetworkGame(client, '9ball');
  assert.equal(left, 0);
});

test('closing the LAN lobby releases its socket and ping loop', () => {
  let disconnected = false;
  const panel = Object.assign(Object.create(LanRoomPanel.prototype), {
    _clientListeners: [], client: { leaveRoom: noop, removeEventListener: noop, disconnect: () => { disconnected = true; } },
  });
  panel.destroy();
  assert.equal(disconnected, true);
});

function remoteGame() {
  const calls = [];
  const cue = { setPosition: (...args) => calls.push(args), mesh: { position: new THREE.Vector3() } };
  return {
    state: 'AIM', currentPlayer: 2, networkMode: 'lan', ballInHand: true,
    ballsManager: { getCueBall: () => cue }, ui: { setMessage: noop },
    isCueBallPlacementLegal: () => true, _endBallInHand: noop, _broadcastSnapshot: noop,
    aimDirection: new THREE.Vector3(0, 0, 1), lockedAimDirection: new THREE.Vector3(),
    shoot() { calls.push('shot'); }, calls,
  };
}

test('either seated player can request a rematch after game over', () => {
  const game = Object.assign(remoteGame(), { state: 'GAME_OVER', currentPlayer: 1 });
  let resets = 0;
  game._onResetButtonClicked = () => resets++;
  assert.equal(applyShotInput(game, { fromPlayer: 2, requestReset: true }), true);
  assert.equal(resets, 1);
  game.state = 'SHOOTING';
  assert.equal(applyShotInput(game, { fromPlayer: 2, requestReset: true }), false);
  game.state = 'GAME_OVER';
  assert.equal(applyShotInput(game, { fromPlayer: 3, requestReset: true }), false);
});

test('mouse movement cannot change AI, remote, or paused aiming and placement', () => {
  for (const extra of [{ aiEnabled: true, currentPlayer: 2 },
    { networkMode: 'lan', localPlayerId: 1, currentPlayer: 2 }, { paused: true }, { _hostPaused: true }]) {
    const game = Object.assign(gameForTurn(), extra, { renderer: {} });
    let changes = 0;
    game.updateAimDirection = game.updateDragPower = game.updateBallInHandPreview = () => changes++;
    game.updateTrajectory = noop;
    for (const state of ['AIM', 'CHARGING']) {
      game.state = state; game.onMouseMove();
      game.ballInHand = true; game.onMouseMove(); game.ballInHand = false;
    }
    assert.equal(changes, 0, JSON.stringify(extra));
  }
});

test('LAN rematches clear the client summary, pause and old clock', () => {
  const calls = [];
  const game = { state: 'GAME_OVER', currentPlayer: 1, localPlayerId: 2,
    paused: true, _pausedAt: 5, _settingsOpen: true, gameStartTime: 1, _rackId: 0,
    rules: new NineBallRules(), statsTracker: new StatsTracker(),
    ballsManager: { getBall: noop },
    ui: { setPlayerTurn: noop, setHUDState: noop, setPower: noop,
      hidePauseMenu: () => calls.push('pause'), hideResetButton: () => calls.push('reset'),
      clearMessage: noop, setMessage: noop },
    inGameSettings: { hide: () => calls.push('settings') },
    statsPanel: { reset: () => calls.push('summary'), update: noop },
  };
  const host = { state: 'AIM', currentPlayer: 1, _rackId: 1, statsTracker: new StatsTracker(), rules: new NineBallRules() };
  GameStateSerializer.applyGameState(game, GameStateSerializer.serializeGameState(host));
  assert.equal(game.paused, false);
  assert.equal(game._settingsOpen, false);
  assert.deepEqual(calls.sort(), ['pause', 'reset', 'settings', 'summary']);
  assert.ok(Math.abs(performance.now() - game.gameStartTime) < 100);
});

test('LAN idle snapshots preserve a local ball-in-hand preview', () => {
  const position = new THREE.Vector3(20, BALL.radius, -50);
  const ball = { pocketed: false, mesh: { visible: true, position, quaternion: new THREE.Quaternion() } };
  const game = { state: 'AIM', currentPlayer: 2, localPlayerId: 2, ballInHand: true,
    ballsManager: { getBall: () => ball } };
  GameStateSerializer.applyGameState(game, { state: 'AIM', currentPlayer: 2, ballInHand: true,
    balls: [{ id: 0, x: 0, y: BALL.radius, z: -90, vx: 0, vy: 0, vz: 0, qx: 0, qy: 0, qz: 0, qw: 1, visible: true }] });
  assert.deepEqual(position.toArray(), [20, BALL.radius, -50]);
});

test('remote push-out declarations cannot arrive after the shot starts or while paused', () => {
  const game = Object.assign(gameForTurn('9ball'), { currentPlayer: 2, rules: new NineBallRules() });
  game.setNetworkController(new EventTarget(), 'host', 1);
  game._broadcastSnapshot = noop;
  for (const extra of [{ state: 'SHOOTING' }, { state: 'AIM', paused: true }]) {
    Object.assign(game, extra); game.rules.pushOutAvailable = true; game.rules.pushOutDeclared = false;
    game._onNetPushOutDeclare({ detail: { fromPlayer: 2 } });
    assert.equal(game.rules.pushOutDeclared, false);
  }
});

test('late close events from an old socket cannot disconnect a new connection', async t => {
  const OriginalSocket = globalThis.WebSocket;
  globalThis.WebSocket = class {
    static OPEN = 1; static CONNECTING = 0;
    constructor() { this.readyState = 0; }
    close() { this.readyState = 3; }
  };
  t.after(() => { globalThis.WebSocket = OriginalSocket; });
  const client = new NetworkClient('ws://localhost');
  t.after(() => client.disconnect());
  const first = client.connect(); client.ws.readyState = 1; client.ws.onopen(); await first;
  const lateClose = client.ws.onclose;
  client.disconnect();
  const second = client.connect(); client.ws.readyState = 1; client.ws.onopen(); await second;
  lateClose();
  assert.equal(client.connected, true);
  assert.ok(client._pingInterval);
});

test('GitHub Pages never invents a relay on the static hosting domain', t => {
  const previous = window.location;
  t.after(() => { window.location = previous; });
  window.location = { protocol: 'https:', hostname: 'hanazar-games.github.io', search: '' };
  assert.equal(NetworkClient.inferServerUrl(), null);
  window.location.search = '?ws=wss%3A%2F%2Frelay.example%2Fpool';
  assert.equal(NetworkClient.inferServerUrl(), 'wss://relay.example/pool');
});

test('HTTPS relay validation rejects mixed content before opening a socket', async t => {
  const previous = window.location;
  const socket = globalThis.WebSocket;
  t.after(() => { window.location = previous; });
  t.after(() => { globalThis.WebSocket = socket; });
  globalThis.WebSocket = class { constructor() { throw new Error('Socket attempted before validation'); } };
  window.location = { protocol: 'https:', hostname: 'hanazar-games.github.io', search: '' };
  await assert.rejects(new NetworkClient('ws://192.168.1.10:3001').connect(), /wss:\/\//);
  await assert.rejects(new NetworkClient().connect(), /服务器地址/);
});

test('a connecting lobby keeps its return button available', () => {
  const button = () => ({ disabled: false, style: {} });
  const panel = Object.assign(Object.create(LanRoomPanel.prototype), {
    _createBtn: button(), _joinBtn: button(), _startBtn: button(), _cancelBtn: button(),
  });
  panel._setButtonsDisabled(true);
  assert.equal(panel._cancelBtn.disabled, false);
  assert.equal(panel._createBtn.disabled, true);
});

test('room-closed listeners see the cleared connection and roster', () => {
  const client = new NetworkClient('ws://localhost');
  client.roomId = 'ABCDEF'; client.playerList = [{ id: 1 }, { id: 2 }]; client.connected = true;
  let state;
  client.addEventListener('roomClosed', () => { state = [client.connected, client.roomId, client.playerList.length]; });
  client._handleMessage({ type: 'roomClosed', reason: 'hostLeft' });
  assert.deepEqual(state, [false, null, 0]);
});

test('an unresponsive WebSocket handshake times out and releases the socket', async t => {
  let timeout;
  t.mock.method(globalThis, 'setTimeout', callback => { timeout = callback; return 1; });
  const previous = globalThis.WebSocket;
  t.after(() => { globalThis.WebSocket = previous; });
  globalThis.WebSocket = class { constructor() { this.readyState = 0; } close() { this.readyState = 3; } };
  const client = new NetworkClient('ws://localhost');
  const connection = client.connect();
  if (!timeout) { client.ws.onclose(); await assert.rejects(connection); assert.fail('No handshake deadline was scheduled'); }
  const rejected = assert.rejects(connection, /超时/);
  timeout();
  await rejected;
  assert.equal(client.ws, null);
});

test('cancelling a handshake settles all callers and permits an immediate retry', async t => {
  const previous = globalThis.WebSocket;
  t.after(() => { globalThis.WebSocket = previous; });
  globalThis.WebSocket = class {
    static OPEN = 1; static CONNECTING = 0;
    constructor() { this.readyState = 0; }
    close() { this.readyState = 3; }
  };
  const client = new NetworkClient('ws://localhost');
  t.after(() => client.disconnect());
  const pending = client.connect();
  const repeated = client.connect();
  const outcomes = [];
  for (const promise of [pending, repeated]) {
    promise.then(() => outcomes.push('connected'), error => outcomes.push(error.message));
  }
  client.disconnect();
  const retry = client.connect();
  const socket = client.ws;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(outcomes.length, 2);
  assert.ok(outcomes.every(message => message.includes('取消')));
  assert.equal(client.ws, socket);
  socket.readyState = 1; socket.onopen();
  await retry;
  assert.equal(client.connected, true);
});

test('unexpected transport closure clears the room before notifying the lobby', async t => {
  const previous = globalThis.WebSocket;
  t.after(() => { globalThis.WebSocket = previous; });
  globalThis.WebSocket = class {
    constructor() { this.readyState = 0; }
    close() { this.readyState = 3; }
  };
  for (const event of ['onclose', 'onerror']) {
    const client = new NetworkClient('ws://localhost');
    t.after(() => client.disconnect());
    const connecting = client.connect(); client.ws.onopen(); await connecting;
    client.roomId = 'ABCDEF'; client.playerList = [{ id: 1 }]; client.isHost = true;
    let state;
    client.addEventListener('disconnected', () => { state = [client.connected, client.roomId, client.playerList.length, client.isHost]; });
    client.ws[event]();
    assert.deepEqual(state, [false, null, 0, false], event);
  }
});

test('the live statistics clock stops when the game ends', t => {
  let now = 1000;
  t.mock.method(performance, 'now', () => now);
  const stats = new StatsTracker();
  now = 61000; stats.endGame(1);
  now = 121000;
  assert.equal(stats.getLiveStats().duration, '1:00');
});

test('keyboard spin stays inside the same rim as the pointer picker', () => {
  const game = gameForTurn(); game.state = 'AIM'; game.cueTipOffset = { x: 0.88, y: 0.88 };
  game._setupSpinControls();
  try {
    game._onKeyDown({ key: keyBindings.getBinding('spinUp'), preventDefault: noop });
    assert.ok(Math.hypot(game.cueTipOffset.x, game.cueTipOffset.y) <= 0.88 + 1e-10);
  } finally { window.removeEventListener('keydown', game._onKeyDown); }
});

test('Enter-confirmed shots switch the HUD to shooting', () => {
  const game = gameForTurn(); game.state = 'AIM'; game.power = 55; game.shoot = noop;
  let hud;
  game.ui = { setHUDState: state => { hud = state; }, hideReplayHint: noop };
  const previous = settings.get('confirmShotOnRelease');
  settings.set('confirmShotOnRelease', false);
  game._setupSpinControls();
  try {
    game._onKeyDown({ key: 'Enter', preventDefault: noop });
    assert.equal(game.state, 'SHOOTING');
    assert.equal(hud, 'SHOOTING');
  } finally {
    window.removeEventListener('keydown', game._onKeyDown);
    settings.set('confirmShotOnRelease', previous);
  }
});

test('remote ball placement cannot be made by the wrong player', () => {
  const game = remoteGame();
  assert.equal(applyShotInput(game, { fromPlayer: 1, ballPlacement: { x: 0, y: 3, z: 0 } }), false);
  assert.deepEqual(game.calls, []);
});

test('remote placement stays on the cloth and rejects non-finite coordinates', () => {
  const game = remoteGame();
  assert.equal(applyShotInput(game, { fromPlayer: 2, ballPlacement: { x: NaN, z: 0 } }), false);
  assert.equal(applyShotInput(game, { fromPlayer: 2, ballPlacement: { x: 10, y: -1000, z: 20 } }), true);
  assert.deepEqual(game.calls, [[10, BALL.radius, 20]]);
});

test('remote shots cannot bypass pause, placement, or the turn deadline', () => {
  for (const extra of [{ paused: true }, { ballInHand: true }, { _turnTimerEnabled: true, _turnTimerRemaining: 0 }]) {
    const game = Object.assign(remoteGame(), { ballInHand: false }, extra);
    assert.equal(applyShotInput(game, { fromPlayer: 2, power: 50, aimDirection: { x: 0, z: 1 } }), false);
    assert.deepEqual(game.calls, []);
  }
});

test('remote shots reject invalid numbers and cap force and spin', () => {
  for (const aim of [{ x: Infinity, z: 1 }, { x: 0, z: 0 }]) {
    const game = Object.assign(remoteGame(), { ballInHand: false });
    assert.equal(applyShotInput(game, { fromPlayer: 2, power: 50, aimDirection: aim }), false);
  }
  const game = Object.assign(remoteGame(), { ballInHand: false });
  assert.equal(applyShotInput(game, { fromPlayer: 2, power: 10000, aimDirection: { x: 0, z: 1 }, cueTipOffset: { x: 20, y: -20 } }), true);
  assert.equal(game.power, SHOT.maxPower);
  assert.ok(Math.hypot(game.cueTipOffset.x, game.cueTipOffset.y) <= 1);
});

test('snapshots synchronize host timer and ball-in-hand HUD', () => {
  const host = { state: 'AIM', currentPlayer: 2, ballInHand: true,
    _turnTimerEnabled: true, _turnTimerMax: 30, _turnTimerRemaining: 12, paused: true };
  const snapshot = GameStateSerializer.serializeGameState(host);
  let hud;
  const client = { state: 'SHOOTING', ballsManager: { balls: [], getBall: noop },
    ui: { setPlayerTurn: noop, setHUDState: state => { hud = state; } } };
  GameStateSerializer.applyGameState(client, snapshot);
  assert.equal(client._turnTimerRemaining, 12);
  assert.equal(client._hostPaused, true);
  assert.equal(hud, 'BALL_IN_HAND');
});

test('idle snapshots preserve local charging until the host changes the turn', () => {
  const game = { state: 'CHARGING', currentPlayer: 2, localPlayerId: 2,
    ballsManager: { balls: [], getBall: noop } };
  const snapshot = { balls: [], state: 'AIM', currentPlayer: 2, ballInHand: false };
  GameStateSerializer.applyGameState(game, snapshot);
  assert.equal(game.state, 'CHARGING');
  GameStateSerializer.applyGameState(game, { ...snapshot, currentPlayer: 1 });
  assert.equal(game.state, 'AIM');
});

test('LAN clients receive shot statistics and one-shot result audio', () => {
  const stats = new StatsTracker(); stats.startTurn(1); stats.recordShot(1, 50);
  const host = { state: 'SHOOTING', currentPlayer: 1, _lastShotPower: 55, statsTracker: stats, rules: new Rules() };
  const heard = [];
  let summaries = 0;
  const client = { state: 'AIM', localPlayerId: 2, currentPlayer: 1, rules: new Rules(),
    ballsManager: { balls: [], getBall: noop }, statsTracker: new StatsTracker(),
    statsPanel: { update: noop, showGameOver: () => summaries++ },
    audio: { playCueHit: () => heard.push('cue'), playFoul: () => heard.push('foul'), playWin: () => heard.push('win') } };
  const shot = GameStateSerializer.serializeGameState(host);
  GameStateSerializer.applyGameState(client, shot); GameStateSerializer.applyGameState(client, shot);
  assert.equal(client.statsTracker.playerStats[1].avgPower ?? client.statsTracker.getSummary().player1.avgPower, 50);
  assert.deepEqual(heard, ['cue']);
  host.state = 'GAME_OVER'; host.rules.gameOver = true; host.rules.winner = 2; stats.endGame(2);
  const end = GameStateSerializer.serializeGameState(host);
  GameStateSerializer.applyGameState(client, end); GameStateSerializer.applyGameState(client, end);
  assert.deepEqual(heard, ['cue', 'win']); assert.equal(summaries, 1);
});

test('LAN shots that retain the turn return to aiming after settlement', () => {
  const stats = new StatsTracker(); stats.startTurn(2);
  const game = { state: 'SHOOTING', currentPlayer: 2, localPlayerId: 2,
    statsTracker: stats, ballsManager: { balls: [], getBall: noop } };
  GameStateSerializer.applyGameState(game, { state: 'AIM', currentPlayer: 2, balls: [], ballInHand: false, stats: stats.getSummary() });
  assert.equal(game.state, 'AIM');
});

test('mouse release cannot shoot for the remote player', () => {
  const game = gameForTurn(); game.state = 'CHARGING'; game.power = 50;
  game.networkMode = 'lan'; game.localPlayerId = 2;
  let shots = 0; game.shoot = () => shots++;
  game.onMouseUp({ type: 'mouseup' });
  assert.equal(shots, 0);
});

test('focus loss and pointer cancellation cancel charging without shooting', () => {
  for (const type of ['blur', 'pointercancel', 'lostpointercapture']) {
    const game = gameForTurn(); game.state = 'CHARGING'; game.power = 80;
    let shots = 0; game.shoot = () => shots++;
    game.onMouseUp({ type });
    assert.equal(shots, 0, type); assert.equal(game.state, 'AIM');
  }
});

test('human releases and Escape do not cancel or fire an AI charge', () => {
  const game = gameForTurn('vsai'); game.state = 'CHARGING'; game.power = 80;
  game.aiEnabled = true; game.currentPlayer = 2;
  let shots = 0; game.shoot = () => shots++;
  game.onMouseUp({ type: 'mouseup' });
  assert.equal(shots, 0);
  game._setupSpinControls();
  try {
    game._onKeyDown({ key: 'Escape' });
    assert.equal(game.state, 'CHARGING'); assert.equal(game.paused, true);
  } finally { window.removeEventListener('keydown', game._onKeyDown); }
});

test('pause time is excluded from stats and timed challenges', t => {
  const game = gameForTurn(); game.gameStartTime = 100;
  game.statsTracker.gameStartTime = 100;
  game.challengeManager = { startTime: 100 };
  let now = 1000; t.mock.method(performance, 'now', () => now);
  game._showPause(); now = 31000; game._hidePause();
  assert.equal(game.statsTracker.gameStartTime, 30100);
  assert.equal(game.challengeManager.startTime, 30100);
});

test('an illegal break cannot complete the perfect-break challenge', () => {
  const game = gameForTurn('local2p');
  game.challengeManager = new ChallengeManager('perfect_break'); game.challengeManager.start();
  game.rules = new Rules(); game.rules.startShot(1); game.rules.recordFirstHit(1);
  game._isBreakShot = true; game.ballsManager.getCueBall().pocketed = true;
  game.ballsManager.resetCueBallIfPocketed = noop; game.startBallInHand = noop;
  game.resolveTurn([1, 2, 3, 4]);
  assert.equal(game.challengeManager.completed, false);
  clearTimeout(game._cameraResetTimer);
});

test('freeplay turn completion awards eligible shot achievements', () => {
  const game = gameForTurn();
  let result;
  game.achievements = { onTurnEnd: (value, ids) => { result = { value, ids }; }, onFoul: noop };
  game.resolveTurn([1, 2, 3]);
  assert.deepEqual(result?.ids, [1, 2, 3]);
});

test('newly available higher challenge stars can be earned beyond the minimum', () => {
  const manager = new ChallengeManager('streak_3'); manager.start();
  for (let i = 0; i < 5; i++) {
    manager.onShot({ mesh: { position: new THREE.Vector3() } }, 50, {});
    manager.onPocket(i + 1); manager.onTurnEnd({ foul: false });
    if (i === 2) assert.equal(manager.completed, false);
  }
  assert.equal(manager.completed, true); assert.equal(manager.stars, 3);
});

test('ending a qualifying streak attempt preserves earned stars and duration', t => {
  let now = 1000; t.mock.method(performance, 'now', () => now);
  const manager = new ChallengeManager('streak_3'); manager.start();
  for (let i = 0; i < 3; i++) {
    manager.onShot({ mesh: { position: new THREE.Vector3() } }, 50, {});
    manager.onPocket(i + 1); manager.onTurnEnd({ foul: false });
  }
  now = 21000; manager.finish();
  assert.equal(manager.completed, true); assert.equal(manager.stars, 1);
  assert.equal(manager.gameDuration, 20);
});

test('opponent shots do not satisfy personal challenge requirements', () => {
  const manager = new ChallengeManager('spin_win'); manager.start();
  manager.onShot({ mesh: { position: new THREE.Vector3() } }, 50, { x: 1, y: 0 }, 2);
  manager.onPocket(1); manager.onTurnEnd({ foul: false }); manager.onGameEnd(1);
  assert.equal(manager.completed, false); assert.equal(manager.spinPocketCount, 0);
  assert.equal(manager.totalShots, 0);
});

test('a rebound pause key also resumes play', () => {
  const old = keyBindings.getBinding('pause');
  keyBindings.setBinding('pause', 'p');
  const game = gameForTurn(); game.state = 'AIM'; game._setupSpinControls();
  try {
    game._onKeyDown({ key: 'p' }); assert.equal(game.paused, true);
    game._onKeyDown({ key: 'p' }); assert.equal(game.paused, false);
  } finally { window.removeEventListener('keydown', game._onKeyDown); keyBindings.setBinding('pause', old); }
});

test('AI spin is protected from player key presses during charging', () => {
  const game = gameForTurn('vsai'); game.aiEnabled = true; game.currentPlayer = 2;
  game.state = 'CHARGING'; game._setupSpinControls(); game._updateCueTipPicker = noop;
  try {
    game._onKeyDown({ key: 'w', preventDefault: noop });
    assert.deepEqual(game.cueTipOffset, { x: 0, y: 0 });
  } finally { window.removeEventListener('keydown', game._onKeyDown); }
});

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

test('a shot event that ends the turn stops the playback before it resolves the turn again', () => {
  const game = gameForTurn(); game.playbackRate = 1;
  const events = [{ t: 1, type: 'ball_cushion', ball: 0, speed: 1 }, { t: 1.01, type: 'ball_cushion', ball: 0, speed: 1 }];
  // The last advance of the shot: two events, and done.
  const playback = { update: () => ({ events, done: true }) };
  game.playback = playback;
  let resolved = 0; const handled = [];
  game.resolveTurn = () => { resolved++; game.state = 'AIM'; };
  // The first event ends the turn some other way (a forced result), keeping the playback.
  game._onSimEvent = e => { handled.push(e); if (handled.length === 1) game.resolveTurn(); };
  game._advancePlayback(1 / 60);
  assert.equal(resolved, 1);
  assert.deepEqual(handled, [events[0]]);
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
