/**
 * The Game's online path (D063): what the OnlineMatchController reports
 * without the player asking — the opponent's shot, a timeout, a push-out
 * choice, the snapshot of a return, the seats, the connection and the end —
 * played through the same playback and turn flow as a local shot. Every
 * online shot ends on the server's official table (Game._advancePlayback).
 */
import { isCueBallPlacementValid } from '@billiards/modes';
import { ONLINE_TEXT as T, onlineEndText } from '../match/onlineText.js';
import { BALL, SHOT } from '../config.js';

/** Back to the menu this long after a lost connection, a takeover or the end. */
const LEAVE_DELAY_MS = 3000;
const END_DELAY_MS = 8000;

/** Hooks the controller's events into the game; returns what removes them. */
export function installOnline(game, controller) {
  const offs = [];
  const on = (type, fn) => {
    const handler = (e) => { if (game.state !== 'DISPOSED') fn(e.detail); };
    controller.addEventListener(type, handler);
    offs.push(() => controller.removeEventListener(type, handler));
  };
  on('remoteShot', (d) => playRemoteShot(game, d, 0));
  on('timeout', (d) => applyServerTimeout(game, d));
  on('choice', (d) => applyChoice(game, d));
  on('snapshot', (d) => applySnapshot(game, d));
  on('seat', (d) => {
    if (d.seat !== controller.localSeat) game.ui.setMessage(d.connected ? T.opponentBack : T.opponentAway, 4000, 2);
  });
  on('connection', (d) => onConnection(game, d));
  on('aim', (d) => showRemoteAim(game, d));
  on('ballInHand', (d) => showRemoteBallInHand(game, d));
  on('end', (d) => {
    if (game.state === 'SHOOTING') game._pendingOnlineEnd = d; // shown when the shot finishes playing
    else showOnlineEnd(game, d);
  });
  on('error', (d) => {
    if (d.code === 'SIM_FAILED') game.ui.setMessage(T.simFailed, 4000, 2);
    else console.warn('[online] server error', d.code);
  });
  return () => { for (const off of offs) off(); };
}

/** The first turn of an online game (after Game.init). */
export function enterOnlineTurn(game) {
  const controller = game.match;
  game.currentPlayer = controller.seat + 1;
  game.ui.setPlayerTurn(game.currentPlayer);
  const status = controller.status();
  if (status) game.ui.setPlayerGroups(status.player1Group, status.player2Group);
  game._updatePlayerStats?.();
  const hand = status?.ballInHand;
  if (hand && hand.player === game.localPlayerId && game.isLocalPlayerTurn()) {
    game.startBallInHand('', hand.kitchen);
  } else {
    game._enterAimState({ resetPower: true, showCue: true, showTrajectory: true, updateAim: false });
  }
}

/** Anything the local player was doing (aiming, charging, placing the ball, a shot in flight) stops. */
function interruptLocal(game) {
  game._abandonShot();
  game.charging = false;
  game.dragStart = null;
  game.power = 0;
  game.ui.setPower(0);
  game.ballInHand = false;
  game.ballInHandValid = false;
  game.ballInHandBehindLine = false;
  game._placedCueBall = null;
  game._pushOutDeclared = false;
  game.ui.hidePushOutChoice?.();
}

/**
 * Plays a shot the server decided, from `offsetMs` into it (a return): the
 * events before the offset are dropped, so nothing sounds twice.
 */
export function playRemoteShot(game, { initial, result, ruling, table, seat, shot }, offsetMs = 0) {
  interruptLocal(game);
  if (Number.isInteger(seat)) game.currentPlayer = seat + 1;
  game.ballsManager.applyTableState(initial);
  game.state = 'SHOOTING';
  game.turnPocketedIds = [];
  game._shotRuling = ruling;
  game._officialTable = table;
  game.cue?.hide();
  game.setAimTrajectoryVisible(false);
  if (!result.frames.length || offsetMs / 1000 >= result.simSeconds) {
    finishShotNow(game);
    return;
  }
  const cue = game.ballsManager.getCueBall();
  const impact = offsetMs === 0 && shot && cue
    ? { force: shot.power, at: cue.mesh.position.clone(), direction: game.aimDirection.clone().set(Math.cos(shot.angle), 0, Math.sin(shot.angle)) }
    : null;
  game._startPlayback(initial, result, impact);
  if (offsetMs > 0) {
    const { done } = game.playback.update(offsetMs / 1000);
    if (done) finishShotNow(game);
  }
}

/** The shot is over at once: the official table and the turn's result. */
function finishShotNow(game) {
  game.playback = null;
  if (game._officialTable) {
    game.ballsManager.applyTableState(game._officialTable);
    game._officialTable = null;
  }
  game.resolveTurn(game.turnPocketedIds ?? []);
  flushOnlineEnd(game);
}

/** The local player concedes: the server ends the match and its match_end shows the result. */
export function concedeOnline(game) {
  if (game.state === 'GAME_OVER') return;
  game.match.concede();
  game.ui.setMessage(T.conceding, 0, 2);
}

function applyServerTimeout(game, { ruling, table }) {
  interruptLocal(game);
  game.ballsManager.applyTableState(table);
  game._isBreakShot = false;
  game.state = 'AIM';
  game.resolveTurn([], game._turnResult(ruling));
  flushOnlineEnd(game);
}

function applyChoice(game, { ruling, table }) {
  game.ui.hidePushOutChoice?.();
  if (table) game.ballsManager.applyTableState(table);
  if (ruling.nextSeat !== null) game.currentPlayer = ruling.nextSeat + 1;
  game.ui.setPlayerTurn(game.currentPlayer);
  game.ui.setMessage(game.isLocalPlayerTurn() ? T.yourTurn : T.opponentTurn, 3000, 2);
  game._enterAimState({ resetPower: true, showCue: true, showTrajectory: true, updateAim: false });
  game._updatePlayerStats?.();
}

function applySnapshot(game, { header, playback, continuing }) {
  if (continuing) return; // the shot in flight or on screen goes on
  interruptLocal(game);
  game.playback = null;
  game._officialTable = null;
  if (playback) {
    playRemoteShot(game, playback, playback.offsetMs);
    return;
  }
  game.ballsManager.applyTableState(header.table);
  enterOnlineTurn(game);
}

function onConnection(game, { state, reason }) {
  if (state === 'reconnecting') {
    game._hostPaused = true;
    game.ui.setMessage(T.reconnecting, 0, 2);
  } else if (state === 'online') {
    game._hostPaused = false;
    game.ui.setMessage(T.reconnected, 2000, 2);
  } else if (state === 'offline' || state === 'replaced') {
    game._hostPaused = true;
    const text = state === 'replaced' ? T.replaced : reason === 'MATCH_ENDED' ? T.endedWhileAway : T.connectionLost;
    game.ui.setMessage(text, 0, 3);
    leaveSoon(game, LEAVE_DELAY_MS);
  }
}

/** A match_end that came while a shot was still playing: shown when it ends. */
export function flushOnlineEnd(game) {
  const end = game._pendingOnlineEnd;
  if (!end || game.state === 'SHOOTING') return;
  game._pendingOnlineEnd = null;
  showOnlineEnd(game, end);
}

export function showOnlineEnd(game, end) {
  game._pendingOnlineEnd = null;
  game.state = 'GAME_OVER';
  game.ui.setHUDState('GAME_OVER');
  game.ui.setMessage(onlineEndText(end), 0, 3);
  game.ui.hidePushOutButton?.();
  game.ui.hidePushOutChoice?.();
  game.ui.hideTurnTimer?.();
  game.cue?.hide();
  game.match.session?.forgetMatch?.();
  game.ui.showResetButton(() => game.onReturnToMenu?.(), T.backToMenu);
  leaveSoon(game, END_DELAY_MS);
}

function leaveSoon(game, ms) {
  if (game._onlineLeaveTimer) clearTimeout(game._onlineLeaveTimer);
  game._onlineLeaveTimer = setTimeout(() => {
    game._onlineLeaveTimer = null;
    if (game.state !== 'DISPOSED') game.onReturnToMenu?.();
  }, ms);
}

/** The countdown of an online turn comes from the server's deadline. */
export function updateOnlineTimer(game) {
  const ms = game.match.deadlineMs();
  if (ms === null || game.state === 'GAME_OVER') {
    game.ui.hideTurnTimer();
    return;
  }
  const turnId = game.match.turn?.turnId;
  if (turnId !== game._onlineTimerTurnId) {
    game._onlineTimerTurnId = turnId;
    game._onlineTimeUpShown = false;
  }
  game._turnTimerRemaining = ms / 1000;
  game.ui.setTurnTimer(ms / 1000, game._turnTimerMax);
  if (ms === 0 && !game._onlineTimeUpShown && game.isLocalPlayerTurn() && ['AIM', 'CHARGING'].includes(game.state)) {
    game._onlineTimeUpShown = true;
    game.ui.setMessage(T.timeUp, 3000, 2);
  }
}

/**
 * On the local turn, what the player aims or drags goes to the server when it
 * changes (the controller paces it); called every frame.
 */
export function sendOnlinePresence(game) {
  if (!game._canAdjustShot()) return;
  if (game.ballInHand) {
    const cue = game.ballsManager.getCueBall();
    if (!cue || cue.pocketed) return;
    const { x, z } = cue.mesh.position;
    const turnId = game.match.turn?.turnId;
    const last = game._sentBallInHand;
    if (last && last.turnId === turnId && last.x === x && last.z === z) return;
    game._sentBallInHand = { turnId, x, z };
    game.match.sendBallInHand({ x, z });
    return;
  }
  const angle = Math.atan2(game.aimDirection.z, game.aimDirection.x);
  // The tip offset never leaves the unit circle, as in Game._simulateShot.
  const spinLength = Math.max(1, Math.hypot(game.cueTipOffset.x, game.cueTipOffset.y));
  const spin = { x: game.cueTipOffset.x / spinLength, y: game.cueTipOffset.y / spinLength };
  const power = game.state === 'CHARGING' ? game.power : 0;
  const turnId = game.match.turn?.turnId;
  const last = game._sentAim;
  if (last && last.turnId === turnId && last.angle === angle && last.spin.x === spin.x && last.spin.y === spin.y && last.power === power) return;
  game._sentAim = { turnId, angle, spin, power };
  game.match.sendAim({ angle, spin, power });
}

/** The opponent's turn: the cue follows their aim (and pulls back with their power). */
function showRemoteAim(game, { seat, angle, power }) {
  if (seat + 1 !== game.currentPlayer || game.isLocalPlayerTurn() || !['AIM', 'CHARGING'].includes(game.state)) return;
  if (!Number.isFinite(angle)) return;
  game.aimDirection.set(Math.cos(angle), 0, Math.sin(angle));
  const cue = game.ballsManager.getCueBall();
  if (!cue || cue.pocketed) return;
  const maxPower = game.match.config?.maxPower ?? SHOT.maxPower;
  const pullback = Number.isFinite(power) ? (Math.min(Math.max(power, 0), maxPower) / maxPower) * 40 : 0;
  game.cue?.setAim(cue.mesh.position, game.aimDirection, pullback);
}

/** The opponent drags the cue ball in hand: it moves here too (the server checks the real placement). */
function showRemoteBallInHand(game, { seat, x, z }) {
  if (seat + 1 !== game.currentPlayer || game.isLocalPlayerTurn() || game.state !== 'AIM') return;
  if (!Number.isFinite(x) || !Number.isFinite(z)) return;
  if (game.match.status()?.ballInHand?.player !== seat + 1) return;
  const cue = game.ballsManager.getCueBall();
  if (!cue) return;
  cue.reset(x, BALL.radius, z);
  game.cue?.setAim(cue.mesh.position, game.aimDirection);
}

/** The server's placement rule (D062): inside the cushion nose and clear of the balls, once quantized. */
export function onlinePlacementAllowed(game, x, z) {
  const geometry = game.match.config?.table;
  if (!geometry) return true;
  const q = (v) => Math.round(v * 100) / 100;
  return isCueBallPlacementValid(game.ballsManager.toTableState(game.tableProfileId), { x: q(x), z: q(z) }, geometry);
}
