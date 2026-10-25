// Development only: plays the sim corpus shots on the real table so a person
// can check them by eye (F1-09). main.js reaches this module only behind
// `import.meta.env.DEV`, so it never reaches a production bundle.
import { CORPUS } from '@billiards/sim/corpus';
import { BALL } from '../config.js';

/**
 * Sets up the table of a corpus shot and plays it through Game.shoot(), the
 * same path as a normal shot. The balls the corpus lists go to their places
 * and every other ball leaves the table.
 * @param {import('../game/Game.js').Game} game a game waiting in the AIM state
 * @param {string} name the corpus entry, such as 'draw-ref'
 * @returns {Promise<import('../sim/SimWorkerClient.js').SimResult>} the result of the shot played
 */
export function playReferenceShot(game, name) {
  const entry = CORPUS.find(e => e.name === name);
  if (!entry) {
    return Promise.reject(new Error(
      `unknown reference shot "${name}"; available: ${CORPUS.map(e => e.name).join(', ')}`));
  }
  if (!game) return Promise.reject(new Error('no game is running: start one from the menu first'));
  if (game.tableProfileId !== entry.table.tableProfileId) {
    return Promise.reject(new Error(
      `"${name}" is a ${entry.table.tableProfileId} shot, but this game is on ${game.tableProfileId}`));
  }
  if (game.state !== 'AIM' || game.playback || game.ballInHand || game.match?.status?.()?.pushOutPending) {
    return Promise.reject(new Error(
      `wait for the AIM state before a reference shot (state: ${game.state})`));
  }

  const { table, shot } = entry;
  const placed = new Map(table.balls.map(b => [b.id, b]));
  for (const ball of game.ballsManager.balls) {
    const spot = placed.get(ball.id);
    if (spot) ball.reset(spot.x, BALL.radius, spot.z);
    else ball.remove();
  }

  // The shot borrows the player's spin; the picker would not show the
  // corpus spin, so give it back when the shot ends, played or cancelled.
  const playerSpin = game.cueTipOffset;
  const shotSpin = { x: shot.spin.x, y: shot.spin.y };
  const restoreSpin = () => {
    // A reset during the shot already put the spin back to its own value.
    if (game.cueTipOffset !== shotSpin) return;
    game.cueTipOffset = playerSpin;
    game._updateCueTipPicker();
  };

  game.aimDirection.set(Math.cos(shot.angle), 0, Math.sin(shot.angle));
  game.cueTipOffset = shotSpin;
  game.power = shot.power;
  game.state = 'SHOOTING';
  try {
    game.shoot();
  } catch (err) {
    restoreSpin();
    return Promise.reject(err);
  }

  // The result arrives from the worker: wait for the playback to start, then
  // for it to end. A shot that never starts one (cancelled) leaves SHOOTING.
  return new Promise((resolve, reject) => {
    let started = false;
    const poll = () => {
      if (game.playback) started = true;
      if (started && !game.playback) {
        restoreSpin();
        resolve(game.lastShotResult);
      } else if (!started && game.state !== 'SHOOTING') {
        restoreSpin();
        reject(new Error(`the shot "${name}" was cancelled`));
      } else {
        requestAnimationFrame(poll);
      }
    };
    requestAnimationFrame(poll);
  });
}
