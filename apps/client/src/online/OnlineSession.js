/**
 * OnlineSession — the online player's connection to Nakama (D063), over
 * @heroiclabs/nakama-js: a guest account per device, the room and profile
 * RPCs, the 1×1 queue, joining a billiards match with the protocol version,
 * the match messages decoded (docs/protocol.md) and the reconnection that
 * keeps the seat during the server's 60 s reserve (spec §7.4).
 */
import { Client } from '@heroiclabs/nakama-js';
import { OP, PROTOCOL_VERSION, decodeEnvelope } from '@billiards/protocol';

const DEVICE_KEY = 'billiards.online.deviceId';
const MATCH_KEY = 'billiards.online.matchId';
/** The server keeps a seat this long after a drop (spec §7.4). */
const RESERVE_MS = 60_000;
/** Waits before each reconnection attempt; the last repeats. */
const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000];
/** A room just created takes a moment to be listed (docs/f3/servidor-local.md). */
const ROOM_LOOKUP_MS = 3000;
const ROOM_LOOKUP_STEP_MS = 250;
/** Refresh the session when it expires within this margin. */
const SESSION_MARGIN_MS = 60_000;

/** Stable codes the server sends (docs/protocol.md); anything else is a network failure. */
const KNOWN_CODES = new Set([
  'USERNAME_INVALID', 'USERNAME_TAKEN', 'AVATAR_INVALID', 'PAYLOAD_INVALID', 'MODE_INVALID', 'ROOM_CODE_EXHAUSTED',
  'CODE_INVALID', 'ROOM_NOT_FOUND', 'ROOM_FULL', 'PROTOCOL_MISMATCH', 'MATCH_ENDED', 'NATIVE_API_CLOSED',
]);
/** Nakama's own messages that mean one of ours: a match it no longer knows has ended. */
const NAKAMA_MESSAGES = { 'Match not found': 'MATCH_ENDED' };
/** Join refusals that another attempt cannot fix. */
const FINAL_JOIN_CODES = new Set(['PROTOCOL_MISMATCH', 'MATCH_ENDED', 'ROOM_FULL']);

export class OnlineError extends Error {
  /** @param {string} code */
  constructor(code, cause) {
    super(code);
    this.code = code;
    if (cause) this.cause = cause;
  }
}

/** The server's message of a failed HTTP call (a Response) or socket call ({ message }), as an OnlineError. */
async function toOnlineError(err) {
  if (err instanceof OnlineError) return err;
  let message = null;
  if (typeof Response !== 'undefined' && err instanceof Response) {
    message = (await err.json().catch(() => ({}))).message ?? null;
  } else if (err && typeof err.message === 'string') {
    message = err.message;
  }
  if (NAKAMA_MESSAGES[message]) return new OnlineError(NAKAMA_MESSAGES[message], err);
  return new OnlineError(KNOWN_CODES.has(message) ? message : 'NETWORK', err);
}

export class OnlineSession extends EventTarget {
  /**
   * @param {{ config: { host: string, port: string, useSSL: boolean, serverKey: string },
   *   storage?: Storage, createClient?: (config: object) => any,
   *   setTimer?: typeof setTimeout, clearTimer?: typeof clearTimeout, now?: () => number }} options
   */
  constructor({ config, storage = globalThis.localStorage, createClient = (c) => new Client(c.serverKey, c.host, c.port, c.useSSL),
    setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = (t) => clearTimeout(t), now = () => Date.now() }) {
    super();
    this.config = config;
    this.storage = storage;
    this.client = createClient(config);
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.now = now;
    this.session = null;
    this.socket = null;
    /** The match this connection plays in (joinMatch), or null. */
    this.matchId = null;
    this._selfSessionId = null;
    this._closing = false;
    this._reconnect = null;
    this._queue = null;
  }

  /**
   * Signs in the device's guest account and connects the socket; again, keeps
   * what is open (or being reconnected), and after a lost connection starts over.
   */
  async start() {
    if (this.session && (this.socket || this._reconnect) && !this._closing) return { userId: this.session.user_id, username: this.session.username };
    this._closing = false;
    try {
      this.session = await this.client.authenticateDevice(this._deviceId(), true);
      await this._connectSocket();
    } catch (err) {
      throw await toOnlineError(err);
    }
    return { userId: this.session.user_id, username: this.session.username };
  }

  /** profile_update; resolves with the stored (normalized) username. */
  async setUsername(name) {
    const out = await this._rpc('profile_update', { username: name });
    this.session.username = out.username;
    return out.username;
  }

  /** @returns {Promise<{ matchId: string, code: string }>} */
  async createRoom(mode) {
    const { matchId, code } = await this._rpc('create_private_match', { mode, format: '1v1' });
    return { matchId, code };
  }

  /** The match of a room code; a room just created may need a few tries. */
  async joinByCode(code) {
    const started = this.now();
    for (;;) {
      try {
        return (await this._rpc('join_by_code', { code })).matchId;
      } catch (err) {
        if (err.code !== 'ROOM_NOT_FOUND' || this.now() - started >= ROOM_LOOKUP_MS) throw err;
        await new Promise((resolve) => this.setTimer(resolve, ROOM_LOOKUP_STEP_MS));
      }
    }
  }

  /** Enters the 1×1 queue of `mode`; resolves with the match the matchmaker forms. */
  async queue(mode) {
    if (this._queue) throw new OnlineError('ALREADY_QUEUED');
    let ticket;
    const socket = this.socket;
    try {
      ticket = (await socket.addMatchmaker(`+properties.mode:${mode} +properties.format:1v1`, 2, 2, { mode, format: '1v1' })).ticket;
    } catch (err) {
      throw await toOnlineError(err);
    }
    // The connection dropped while the ticket was on its way: it died with that session.
    if (this.socket !== socket) throw new OnlineError('NETWORK');
    return new Promise((resolve, reject) => { this._queue = { ticket, resolve, reject }; });
  }

  async cancelQueue() {
    const queue = this._queue;
    if (!queue) return;
    this._queue = null;
    queue.reject(new OnlineError('CANCELLED'));
    try {
      await this.socket.removeMatchmaker(queue.ticket);
    } catch (err) {
      console.warn('[online] could not remove the matchmaker ticket', err);
    }
  }

  /** Joins a billiards match with the protocol version and remembers it for a later return. */
  async joinMatch(matchId) {
    try {
      const match = await this.socket.joinMatch(matchId, undefined, { protocolVersion: String(PROTOCOL_VERSION) });
      this._selfSessionId = match?.self?.session_id ?? null;
    } catch (err) {
      const error = await toOnlineError(err);
      if (error.code === 'MATCH_ENDED') this.forgetMatch();
      throw error;
    }
    this.matchId = matchId;
    this.storage.setItem(MATCH_KEY, matchId);
  }

  async leaveMatch() {
    const matchId = this.matchId;
    this.forgetMatch();
    if (matchId) await this.socket?.leaveMatch(matchId).catch(() => {});
  }

  /** The match to return to after a reload, or null. */
  storedMatchId() {
    return this.storage.getItem(MATCH_KEY);
  }

  forgetMatch() {
    this.matchId = null;
    this.storage.removeItem(MATCH_KEY);
  }

  /** Sends a match message: `body` as JSON, nothing as an empty body. */
  send(op, body) {
    if (!this.socket || !this.matchId) return;
    this.socket.sendMatchState(this.matchId, op, body === undefined ? '' : JSON.stringify(body));
  }

  /** Tests: closes the socket as a network drop would, so the reconnection runs. */
  dropConnection() {
    this.socket?.disconnect(true);
  }

  close() {
    this._closing = true;
    if (this._reconnect) this.clearTimer(this._reconnect.timer);
    this._reconnect = null;
    this.socket?.disconnect(false);
  }

  async _rpc(id, input) {
    try {
      await this._ensureFreshSession();
      return (await this.client.rpc(this.session, id, input)).payload ?? {};
    } catch (err) {
      throw await toOnlineError(err);
    }
  }

  _deviceId() {
    let deviceId = this.storage.getItem(DEVICE_KEY);
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      this.storage.setItem(DEVICE_KEY, deviceId);
    }
    return deviceId;
  }

  async _ensureFreshSession() {
    const at = (this.now() + SESSION_MARGIN_MS) / 1000;
    if (!this.session?.isexpired(at)) return;
    try {
      if (this.session.isrefreshexpired?.(at)) throw new Error('refresh token expired');
      this.session = await this.client.sessionRefresh(this.session);
    } catch {
      // The refresh token can outlive nothing (Nakama's lasts 1 h by default): the device signs in again.
      this.session = await this.client.authenticateDevice(this._deviceId(), true);
    }
  }

  async _connectSocket() {
    const socket = this.client.createSocket(this.config.useSSL, false);
    socket.ondisconnect = () => {
      if (socket === this.socket && !this._closing) this._dropped();
    };
    socket.onmatchdata = (data) => this._onMatchData(data);
    socket.onmatchpresence = (event) => this._onPresence(event);
    socket.onmatchmakermatched = (matched) => {
      const queue = this._queue;
      if (!queue || (matched.ticket && matched.ticket !== queue.ticket)) return;
      this._queue = null;
      queue.resolve(matched.match_id);
    };
    await socket.connect(this.session, true);
    this.socket = socket;
  }

  _onMatchData(data) {
    if (this.matchId && data.match_id && data.match_id !== this.matchId) return;
    const op = data.op_code;
    const bytes = data.data ?? new Uint8Array(0);
    let detail;
    try {
      if (op === OP.MATCH_SNAPSHOT || op === OP.SHOT_RESULT) {
        const { header, payload } = decodeEnvelope(bytes);
        detail = { op, header, payload };
      } else {
        detail = { op, body: JSON.parse(new TextDecoder().decode(bytes)) };
      }
    } catch (err) {
      console.warn(`[online] dropped a malformed message (op ${op})`, err);
      return;
    }
    this.dispatchEvent(new CustomEvent('message', { detail }));
  }

  /** The server took this connection out of the match (a newer tab, or a kick): never fight it. */
  _onPresence(event) {
    if (!this._selfSessionId || (this.matchId && event.match_id !== this.matchId)) return;
    if (event.leaves?.some((p) => p.session_id === this._selfSessionId)) {
      this._closing = true;
      this._emitConnection({ state: 'replaced' });
    }
  }

  _dropped() {
    if (this._reconnect) return;
    // The dead socket goes; a new one replaces it only once connected. A queue ticket
    // belongs to the socket's session on the server, so the search ends here.
    this.socket = null;
    const queue = this._queue;
    this._queue = null;
    queue?.reject(new OnlineError('NETWORK'));
    this._reconnect = { since: this.now(), attempt: 0, timer: null };
    this._emitConnection({ state: 'reconnecting' });
    this._scheduleAttempt();
  }

  _scheduleAttempt() {
    const r = this._reconnect;
    const delay = RETRY_DELAYS_MS[Math.min(r.attempt, RETRY_DELAYS_MS.length - 1)];
    r.timer = this.setTimer(() => this._attempt(), delay);
  }

  async _attempt() {
    const r = this._reconnect;
    if (!r || this._closing) return;
    r.attempt++;
    try {
      await this._ensureFreshSession();
      await this._connectSocket();
      if (this.matchId) await this.joinMatch(this.matchId);
    } catch (err) {
      const error = await toOnlineError(err);
      if (FINAL_JOIN_CODES.has(error.code)) {
        this._reconnect = null;
        this._emitConnection({ state: 'offline', reason: error.code });
        return;
      }
      if (this.now() - r.since >= RESERVE_MS) {
        this._reconnect = null;
        this._emitConnection({ state: 'offline' });
        return;
      }
      this._scheduleAttempt();
      return;
    }
    this._reconnect = null;
    this._emitConnection({ state: 'online' });
  }

  _emitConnection(detail) {
    this.dispatchEvent(new CustomEvent('connection', { detail }));
  }
}
