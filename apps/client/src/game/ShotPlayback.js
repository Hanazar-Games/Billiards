// Moves the ball meshes along a simulated shot. The TrajectoryPlayer says
// where each ball is at the playback time; this puts the meshes there, keeps
// each ball's speed for the effects that read it, and lands the balls exactly
// on the final state when the shot ends.
import { BALL } from '../config.js';

export class ShotPlayback {
  /**
   * @param {import('./BallsManager.js').BallsManager} ballsManager
   * @param {import('../sim/TrajectoryPlayer.js').TrajectoryPlayer} player
   */
  constructor(ballsManager, player) {
    this._ballsManager = ballsManager;
    this._player = player;
  }

  /** The TrajectoryPlayer being played (read only). */
  get player() { return this._player; }

  /**
   * Advances the shot by `dt` seconds of simulated time and poses the meshes.
   * `events` are the shot events that playback passed; once `done`, the balls
   * are at the final state of the shot.
   * @param {number} dt
   * @returns {{ events: import('@billiards/sim').SimEvent[], done: boolean }}
   */
  update(dt) {
    const { poses, events, done } = this._player.advance(dt);
    const advanced = typeof dt === 'number' && dt > 0;
    for (const pose of poses) {
      const ball = this._ballsManager.getBall(pose.id);
      if (!ball) continue;
      const p = ball.mesh.position;
      if (advanced) ball.speed = Math.hypot(pose.x - p.x, pose.z - p.z) / dt;
      p.set(pose.x, BALL.radius, pose.z);
      ball.mesh.quaternion.set(pose.q[0], pose.q[1], pose.q[2], pose.q[3]);
    }
    if (done) this._ballsManager.applyTableState(this._finalState(poses));
    return { events, done };
  }

  // At the end the poses are exactly the final state's balls in play; every
  // other ball ends the shot pocketed.
  _finalState(poses) {
    const inPlay = new Map(poses.map(pose => [pose.id, pose]));
    return {
      balls: this._ballsManager.balls.map(ball => {
        const pose = inPlay.get(ball.id);
        return pose
          ? { id: ball.id, x: pose.x, z: pose.z, q: pose.q, pocketed: false }
          : { id: ball.id, x: ball.mesh.position.x, z: ball.mesh.position.z, pocketed: true };
      }),
    };
  }
}
