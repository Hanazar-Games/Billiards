// Plays a simulated shot back at the render rate. The sim samples the balls at
// 30 Hz; this turns those samples into poses at any time, and hands out the
// shot events (collisions, pockets) when playback passes their time. No
// Three.js here: quaternions are plain [x, y, z, w] arrays.

/**
 * @typedef {{ id: number, x: number, z: number, q: import('@billiards/sim').Quat }} Pose
 */

export class TrajectoryPlayer {
  /**
   * Key poses sit at 0 (`initial`), at each frame's `t`, and at `simSeconds`
   * (`final`). A frame lists only the balls that moved, so a ball missing from
   * a frame repeats its previous pose. A ball without `q` has the identity
   * rotation.
   *
   * Between two key poses a ball turns along the short arc, which shows a ball
   * that turned more than half a turn spinning the wrong way. With
   * `ballRadius`, a ball that moved more than half a turn of rolling
   * (distance / radius > π) turns instead along the arc that agrees with
   * rolling along its path. Without it, always the short arc.
   * @param {{
   *   initial: import('@billiards/sim').TableState,
   *   frames: import('@billiards/protocol').TrajectoryFrame[],
   *   events: import('@billiards/sim').SimEvent[],
   *   final: import('@billiards/sim').TableState,
   *   simSeconds: number,
   *   ballRadius?: number
   * }} shot
   */
  constructor({ initial, frames, events, final, simSeconds, ballRadius }) {
    if (!Number.isFinite(simSeconds) || simSeconds < 0) {
      throw new RangeError(`TrajectoryPlayer: invalid simSeconds ${simSeconds}`);
    }
    // 0 leaves every ball on the short arc.
    this._ballRadius = Number.isFinite(ballRadius) && ballRadius > 0 ? ballRadius : 0;
    this._duration = simSeconds;
    this._final = final;
    this._time = 0;
    this._finished = false;
    // Sorted by time (the sort is stable) so that a pointer can walk them.
    this._events = [...events].sort((a, b) => a.t - b.t);
    this._nextEvent = 0;

    const pocketAt = new Map();
    for (const e of this._events) {
      if (e.type === 'pocket' && !pocketAt.has(e.ball)) pocketAt.set(e.ball, e.t);
    }

    // The pose each ball holds right now while the key poses are being built.
    const current = new Map();
    for (const b of initial.balls) {
      if (!b.pocketed) current.set(b.id, { x: b.x, z: b.z, q: b.q ?? identity() });
    }
    /** @type {number[]} */
    this._times = [0];
    // Per ball, one pose per key time. pocketAt is when the ball leaves the
    // table (Infinity if it never does).
    this._tracks = [...current.keys()].sort((a, b) => a - b)
      .map(id => ({ id, pocketAt: pocketAt.get(id) ?? Infinity, x: [], z: [], q: [] }));
    this._snapshot(current);

    for (const frame of frames) {
      for (const b of frame.balls) {
        const was = current.get(b.id);
        if (was) current.set(b.id, { x: b.x, z: b.z, q: b.q ?? was.q });
      }
      // A frame at (or past) the end folds into the final key; so does one that
      // is not later than the previous key, whose data the next key carries.
      if (frame.t > this._times[this._times.length - 1] && frame.t < simSeconds) {
        this._times.push(frame.t);
        this._snapshot(current);
      }
    }
    if (simSeconds > 0) {
      // The final state wins for the balls still in play. A pocketed ball keeps
      // its last pose: the sim parks it at (0, 0), which is no place to slide to.
      for (const b of final.balls) {
        if (!b.pocketed && current.has(b.id)) current.set(b.id, { x: b.x, z: b.z, q: b.q ?? identity() });
      }
      this._times.push(simSeconds);
      this._snapshot(current);
    }
  }

  /** Length of the shot in seconds. */
  get duration() { return this._duration; }

  /** Playback position in seconds, from 0 to `duration`. */
  get time() { return this._time; }

  /**
   * Moves playback forward by `dt` seconds.
   * `poses` are the balls on the table at the new time; once the shot is over
   * (`done`) they are the exact final state. `events` are those that fell in
   * (previous time, new time], the first call also taking t = 0; at the end all
   * the remaining ones come out. A `dt` that is not a number above 0 does not
   * advance: no events, and the poses of the current time.
   * @param {number} dt
   * @returns {{ poses: Pose[], events: import('@billiards/sim').SimEvent[], done: boolean }}
   */
  advance(dt) {
    if (typeof dt !== 'number' || !(dt > 0)) {
      return { poses: this._finished ? this._finalPoses() : this._posesAt(this._time), events: [], done: this._finished };
    }
    const next = this._time + dt;
    this._finished = next >= this._duration;
    this._time = this._finished ? this._duration : next;

    const events = [];
    while (this._nextEvent < this._events.length && (this._finished || this._events[this._nextEvent].t <= this._time)) {
      events.push(this._events[this._nextEvent++]);
    }
    const poses = this._finished ? this._finalPoses() : this._posesAt(this._time);
    return { poses, events, done: this._finished };
  }

  // Appends the current pose of every ball as the key pose of the last key time.
  _snapshot(current) {
    for (const track of this._tracks) {
      const pose = current.get(track.id);
      track.x.push(pose.x);
      track.z.push(pose.z);
      track.q.push(pose.q);
    }
  }

  _finalPoses() {
    return this._final.balls
      .filter(b => !b.pocketed)
      .map(b => ({ id: b.id, x: b.x, z: b.z, q: b.q ? [...b.q] : identity() }));
  }

  // Poses at a time before the end: position linear, rotation along the arc
  // _rotation picks, and without the balls already in a pocket.
  _posesAt(time) {
    const times = this._times;
    // Largest i with times[i] <= time; time < duration keeps i + 1 in range.
    let lo = 0;
    let hi = times.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (times[mid] <= time) lo = mid; else hi = mid;
    }
    const span = times[hi] - times[lo];
    const alpha = span > 0 ? (time - times[lo]) / span : 0;

    const poses = [];
    for (const track of this._tracks) {
      if (time >= track.pocketAt) continue;
      poses.push({
        id: track.id,
        x: track.x[lo] + (track.x[hi] - track.x[lo]) * alpha,
        z: track.z[lo] + (track.z[hi] - track.z[lo]) * alpha,
        q: this._rotation(track, lo, hi, alpha)
      });
    }
    return poses;
  }

  // Rotation of a ball between its key poses lo and hi. The samples come 30
  // times a second, so a ball turning more than half a turn per sample looks
  // like one turning less the other way. When the ball moved more than half a
  // turn of rolling, the arc whose axis agrees with rolling along that path
  // wins; otherwise the short arc.
  _rotation(track, lo, hi, alpha) {
    const a = track.q[lo];
    const b = track.q[hi];
    if (this._ballRadius > 0) {
      const dx = track.x[hi] - track.x[lo];
      const dz = track.z[hi] - track.z[lo];
      if (Math.hypot(dx, dz) / this._ballRadius > Math.PI) {
        const arc = rollingArc(a, b, dx, dz);
        if (arc) return normalize(multiply(axisAngle(arc.axis, arc.angle * alpha), a));
      }
    }
    return nlerp(a, b, alpha);
  }
}

function identity() {
  return [0, 0, 0, 1];
}

// The world-frame turn from a to b (b = turn · a, the way the sim integrates
// the spin) as an axis and an angle: the short arc (up to π) unless its axis
// points against rolling along (dx, dz), and then the long arc, 2π minus that
// about the opposite axis. On the XZ plane with y up, rolling along d turns
// the ball about up × d = (dz, 0, −dx). Null when a and b are the same.
function rollingArc(a, b, dx, dz) {
  const r = multiply(b, [-a[0], -a[1], -a[2], a[3]]);
  const sign = r[3] < 0 ? -1 : 1;
  const sinHalf = Math.hypot(r[0], r[1], r[2]);
  if (sinHalf === 0) return null;
  let axis = [sign * r[0] / sinHalf, sign * r[1] / sinHalf, sign * r[2] / sinHalf];
  let angle = 2 * Math.atan2(sinHalf, sign * r[3]);
  if (axis[0] * dz - axis[2] * dx < 0) {
    axis = [-axis[0], -axis[1], -axis[2]];
    angle = 2 * Math.PI - angle;
  }
  return { axis, angle };
}

function axisAngle(axis, angle) {
  const s = Math.sin(angle / 2);
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(angle / 2)];
}

// Hamilton product a·b of [x, y, z, w] quaternions.
function multiply(a, b) {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]
  ];
}

function normalize(q) {
  const len = Math.hypot(q[0], q[1], q[2], q[3]);
  return [q[0] / len, q[1] / len, q[2] / len, q[3] / len];
}

// Normalized linear interpolation along the short arc (b and -b are the same
// rotation, so b flips when it points away from a).
function nlerp(a, b, alpha) {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const sign = dot < 0 ? -1 : 1;
  const q = [0, 0, 0, 0];
  for (let i = 0; i < 4; i++) q[i] = a[i] * (1 - alpha) + sign * b[i] * alpha;
  const len = Math.hypot(q[0], q[1], q[2], q[3]);
  if (len === 0) return [...a];
  return [q[0] / len, q[1] / len, q[2] / len, q[3] / len];
}
