/**
 * OnlineMatchController — the online match (spec §5.3, D063): the server
 * validates, simulates and decides; this controller gives the Game the same
 * interface as the LocalMatchController and events for what the server sends
 * without the player asking (the opponent's shot, a timeout, a push-out
 * choice, the snapshot of a return, the end). Messages: docs/protocol.md.
 */
import { MODES, currentSeat, placeCueBall } from '@billiards/modes';
import { OP, decodeTrajectory } from '@billiards/protocol';
import { matchStatus } from './matchStatus.js';

/** The countdown shown runs this much ahead of the server's, for the latency. */
const DEADLINE_MARGIN_MS = 500;

/** @param {string} message @param {object} fields */
const fail = (message, fields) => Object.assign(new Error(message), fields);

/** A shot_result header and its trajectory as the TrajectoryPlayer takes them. */
function toResult(header, payload) {
  return {
    frames: payload && payload.length ? decodeTrajectory(payload) : [],
    events: header.events ?? [],
    final: header.final,
    simSeconds: (header.durationMs ?? 0) / 1000,
    capped: !!header.capped,
  };
}

/**
 * The table a shot started from when the client never saw it (a reload during
 * the playback): the final table, with each moving ball where its trajectory
 * starts.
 */
function initialFromResult(result) {
  const start = new Map();
  for (const frame of result.frames) {
    for (const ball of frame.balls) if (!start.has(ball.id)) start.set(ball.id, ball);
  }
  return {
    ...result.final,
    balls: result.final.balls.map((ball) => {
      const first = start.get(ball.id);
      return first ? { ...ball, x: first.x, z: first.z, pocketed: false } : ball;
    }),
  };
}

export class OnlineMatchController extends EventTarget {
  /**
   * @param {{ session: EventTarget & { send(op: number, body?: object): void }, matchId: string,
   *   modeId: '8ball' | '9ball', tableProfile: { width: number, depth: number }, now?: () => number }} options
   */
  constructor({ session, matchId, modeId, tableProfile, now = () => Date.now() }) {
    super();
    if (!MODES[modeId]) throw new RangeError(`unknown mode ${modeId}`);
    this.session = session;
    this.matchId = matchId;
    this.modeId = modeId;
    this.mode = MODES[modeId];
    this.tableProfile = tableProfile;
    this.now = now;
    this.online = true;
    /** @type {import('@billiards/modes').MatchState | null} */
    this.match = null;
    /** The official table (the server's), after the last shot or snapshot. */
    this.table = null;
    this.localSeat = null;
    this.seats = [];
    /** @type {{ seat: number, turnId: number, deadlineAt: number } | null} */
    this.turn = null;
    this.end = null;
    this._seq = 0;
    this._pending = null;
    /** turnId:seq of the last shot result handled, so a return does not replay it. */
    this._lastShotKey = null;
    this._ready = new Promise((resolve, reject) => { this._readyResolve = resolve; this._readyReject = reject; });
    this._ready.catch(() => {});
    this._isReady = false;
    this._onMessage = (e) => this._handle(e.detail);
    this._onConnection = (e) => this.dispatchEvent(new CustomEvent('connection', { detail: e.detail }));
    session.addEventListener('message', this._onMessage);
    session.addEventListener('connection', this._onConnection);
  }

  /** The seat to play, like the LocalMatchController's. */
  get seat() {
    return this.match ? currentSeat(this.match) ?? this.match.mode.turn.currentSeat : 0;
  }

  get config() {
    return this.match?.mode.config ?? null;
  }

  /** Resolves on the first snapshot; rejects (with `end`) when the match ends before it. */
  whenReady() {
    return this._ready;
  }

  status() {
    return matchStatus(this.modeId, this.match);
  }

  /** What is left of the turn for the countdown (null without a turn). */
  deadlineMs() {
    return this.turn ? Math.max(0, this.turn.deadlineAt - this.now() - DEADLINE_MARGIN_MS) : null;
  }

  /** The balls of the official table, for Game.init (the Game then applies the whole table). */
  newRack() {
    return (this.table?.balls ?? []).filter((b) => !b.pocketed).map(({ id, x, z }) => ({ id, x, z }));
  }

  /**
   * Sends the shot; resolves when the server's shot_result for it arrives.
   * @returns {Promise<{ initial: object, result: object, ruling: object, table: object }>} rejects with
   *   `rejected` (shot_rejected, with the reason) or `stale` (the match moved on meanwhile)
   */
  submitShot(table, shot) {
    if (!this.turn || this.turn.seat !== this.localSeat) {
      return Promise.reject(fail('not this client\'s turn', { rejected: true, reason: 'NOT_YOUR_TURN' }));
    }
    this._settlePending(fail('stale shot result', { stale: true }));
    const body = { turnId: this.turn.turnId, seq: ++this._seq, angle: shot.angle, power: shot.power, spin: { x: shot.spin.x, y: shot.spin.y } };
    if (shot.cueBall) body.cueBall = { x: shot.cueBall.x, z: shot.cueBall.z };
    if (shot.pushOut) body.pushOut = true;
    const initial = shot.cueBall ? placeCueBall(table, shot.cueBall) : table;
    return new Promise((resolve, reject) => {
      this._pending = { turnId: body.turnId, seq: body.seq, body, initial, resolve, reject };
      this.session.send(OP.SHOT_REQUEST, body);
    });
  }

  /** Online the server runs the clock. */
  timeout() {
    throw new Error('the server decides timeouts online');
  }

  /** Answers a pending push-out; the ruling comes back as a `choice` event. */
  choosePushOut(accept) {
    if (!this.turn) return;
    this.session.send(OP.PUSH_OUT_CHOICE, { turnId: this.turn.turnId, accept: !!accept });
  }

  /** This client concedes (the seat argument of the local controller is ignored). */
  concede() {
    this.session.send(OP.CONCEDE);
  }

  /** The match state, plain JSON. */
  toJSON() {
    return this.match;
  }

  /** Stops listening; the match goes on on the server (leaving is a concession or a drop). */
  dispose() {
    this.session.removeEventListener('message', this._onMessage);
    this.session.removeEventListener('connection', this._onConnection);
    this._settlePending(fail('stale shot result', { stale: true }));
  }

  _emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  _settlePending(error, value) {
    const pending = this._pending;
    if (!pending) return null;
    this._pending = null;
    if (error) pending.reject(error);
    else pending.resolve(value);
    return pending;
  }

  _setTurn(turn) {
    this.turn = turn ? { seat: turn.seat, turnId: turn.turnId, deadlineAt: this.now() + turn.deadlineInMs } : null;
  }

  _handle({ op, header, payload, body }) {
    switch (op) {
      case OP.MATCH_SNAPSHOT: return this._onSnapshot(header, payload);
      case OP.SHOT_RESULT: return this._onResult(header, payload);
      case OP.SHOT_REJECTED: return this._onRejected(body);
      case OP.SEAT_UPDATE: return this._onSeat(body);
      case OP.MATCH_END: return this._onEnd(body);
      case OP.ERROR: return this._emit('error', { code: body?.code });
      default: return undefined;
    }
  }

  _onSnapshot(header, payload) {
    this.localSeat = header.you?.seat ?? this.localSeat;
    this.seats = header.seats ?? this.seats;
    const previousTable = this.table;
    this.match = header.match;
    this.table = header.table;
    this._setTurn(header.turn);
    if (header.end) this.end = header.end;

    let playback = null;
    let continuing = false;
    const pending = this._pending;
    const replay = header.playback;
    if (replay) {
      const result = toResult(replay.result, payload);
      const key = `${replay.result.turnId}:${replay.result.seq}`;
      if (pending && replay.result.kind === 'shot' && replay.result.turnId === pending.turnId && replay.result.seq === pending.seq) {
        // Our own shot was accepted while we were away: it plays from the start, as a reply.
        this._lastShotKey = key;
        this._settlePending(null, { initial: pending.initial, result, ruling: replay.result.ruling, table: replay.result.table });
        continuing = true;
      } else if (key === this._lastShotKey) {
        continuing = true; // the Game already has this shot
      } else {
        const shot = replay.result.shot;
        const before = previousTable ? (shot?.cueBall ? placeCueBall(previousTable, shot.cueBall) : previousTable) : initialFromResult(result);
        this._lastShotKey = key;
        playback = { initial: before, result, ruling: replay.result.ruling, table: replay.result.table, seat: replay.result.seat, offsetMs: replay.offsetMs };
      }
    }
    if (this._pending && !continuing) {
      if (this.turn && this.turn.turnId === this._pending.turnId && this.turn.seat === this.localSeat) {
        // Not decided yet: the same (turnId, seq) again is idempotent on the server.
        this.session.send(OP.SHOT_REQUEST, this._pending.body);
        continuing = true;
      } else {
        this._settlePending(fail('stale shot result', { stale: true }));
      }
    }
    this._emit('snapshot', { header, playback, continuing });
    if (!this._isReady) {
      this._isReady = true;
      this._readyResolve();
    }
  }

  _onResult(header, payload) {
    const previousTable = this.table;
    this.match = header.match;
    this.table = header.table;
    this._setTurn(header.nextTurn);
    const ruling = header.ruling;
    if (header.kind === 'shot') {
      const result = toResult(header, payload);
      this._lastShotKey = `${header.turnId}:${header.seq}`;
      const pending = this._pending;
      if (pending && pending.turnId === header.turnId && pending.seq === header.seq) {
        this._settlePending(null, { initial: pending.initial, result, ruling, table: header.table });
        return;
      }
      const shot = header.shot;
      const initial = shot?.cueBall ? placeCueBall(previousTable, shot.cueBall) : previousTable;
      this._emit('remoteShot', { initial, result, ruling, table: header.table, seat: header.seat });
      return;
    }
    // A timeout or a choice ends any shot of ours still in flight: the server refuses it.
    this._settlePending(fail('stale shot result', { stale: true }));
    this._emit(header.kind === 'timeout' ? 'timeout' : 'choice', { ruling, table: header.table, seat: header.seat });
  }

  _onRejected(body) {
    const pending = this._pending;
    if (!pending) return;
    if (body?.seq !== pending.seq && body?.seq !== null) return;
    this._settlePending(fail(`shot rejected: ${body?.reason}`, { rejected: true, reason: body?.reason }));
  }

  _onSeat(body) {
    const seat = this.seats.find((s) => s.seat === body?.seat);
    if (seat) seat.connected = !!body.connected;
    this._emit('seat', { seat: body?.seat, connected: !!body?.connected });
  }

  _onEnd(body) {
    const team = this.localSeat === null || !this.match ? null : this.match.mode.turn.seats[this.localSeat]?.team ?? this.localSeat;
    const won = body?.winnerTeam === null || body?.winnerTeam === undefined || team === null ? null : body.winnerTeam === team;
    this.end = { winnerTeam: body?.winnerTeam ?? null, reason: body?.reason, summary: body?.summary };
    this.turn = null;
    this._settlePending(fail('the match ended', { stale: true }));
    const detail = { ...this.end, won };
    if (!this._isReady) {
      this._isReady = true;
      this._readyReject(Object.assign(new Error('the match ended before it started'), { end: detail }));
    }
    this._emit('end', detail);
  }
}
