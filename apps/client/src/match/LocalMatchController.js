/**
 * LocalMatchController — the offline match (spec §5.3): it validates a shot,
 * simulates it in the sim worker and decides it with packages/modes, the same
 * shape the server will send online (F4). Without a mode (free play, trainer)
 * it only simulates.
 */
import { MODES, createMatch, applyRuling, removeMatchSeat, currentSeat, placeCueBall, eightBallStatus, nineBallStatus } from '@billiards/modes';
import { BALL, SHOT } from '../config.js';
import { simClient as defaultSimClient } from '../sim/SimWorkerClient.js';

/** @param {string} message @param {object} fields */
const fail = (message, fields) => Object.assign(new Error(message), fields);

/** Rejects with /simulation timed out/ if `promise` takes longer than `ms`. */
function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(fail('simulation timed out', { timedOut: true })), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export class LocalMatchController {
  /**
   * @param {{ modeId?: '8ball' | '9ball' | null, tableProfile: { width: number, depth: number },
   *   format?: import('@billiards/modes').MatchFormat, simClient?: { simulate: Function, dispose?: Function },
   *   simTimeoutMs?: number }} options
   */
  constructor({ modeId = null, tableProfile, format = { kind: '1v1' }, simClient = defaultSimClient, simTimeoutMs = 10000 }) {
    if (modeId !== null && !MODES[modeId]) throw new RangeError(`unknown mode ${modeId}`);
    this.modeId = modeId;
    this.mode = modeId ? MODES[modeId] : null;
    this.tableProfile = tableProfile;
    this.format = format;
    this.simClient = simClient;
    this.simTimeoutMs = simTimeoutMs;
    /** @type {import('@billiards/modes').MatchState | null} */
    this.match = null;
    this._epoch = 0;
    this.newRack();
  }

  /** @returns {import('@billiards/modes').MatchConfig} */
  get config() {
    return {
      format: this.format,
      table: { width: this.tableProfile.width, depth: this.tableProfile.depth, ballRadius: BALL.radius },
      maxPower: SHOT.maxPower,
    };
  }

  /** The seat to play (0 without a mode). */
  get seat() {
    return this.match ? currentSeat(this.match) ?? this.match.mode.turn.currentSeat : 0;
  }

  /** A new match on its break; pending shots become stale. Returns the rack (8-ball's without a mode). */
  newRack(firstSeat = 0) {
    this._epoch++;
    const mode = this.mode ?? MODES['8ball'];
    const match = createMatch(mode, this.config, Math.random, firstSeat);
    this.match = this.mode ? match : null;
    return mode.rackLayout(match.mode);
  }

  /**
   * @param {{ tableProfileId: string, balls: object[] }} table the table before the shot
   * @param {import('@billiards/modes').ShotRequest} shot
   * @returns {Promise<{ initial: object, result: object, ruling: object | null }>} rejects with
   *   `rejected` (invalid shot, nothing simulated), `stale` (the match changed meanwhile) or the sim's error
   */
  async submitShot(table, shot) {
    const epoch = this._epoch;
    const seat = this.seat;
    if (this.mode) {
      const validation = this.mode.validateShot(this.match.mode, seat, shot);
      if (!validation.ok) throw fail(`shot rejected: ${validation.reason}`, { rejected: true, reason: validation.reason });
    }
    const initial = shot.cueBall ? placeCueBall(table, shot.cueBall) : table;
    let result;
    if (!(shot.power > 0)) {
      // The sim refuses power ≤ 0; nothing moves, as in the legacy game.
      result = { frames: [], events: [], final: initial, steps: 0, simSeconds: 0, capped: false };
    } else {
      try {
        const request = this.simClient.simulate(initial, { angle: shot.angle, power: shot.power, spin: { x: shot.spin.x, y: shot.spin.y } });
        result = await withTimeout(request, this.simTimeoutMs);
      } catch (err) {
        // A worker that never answers is replaced on the next shot.
        if (err.timedOut) this.simClient.dispose?.();
        if (epoch !== this._epoch) throw fail('stale shot result', { stale: true });
        throw err;
      }
    }
    if (epoch !== this._epoch) throw fail('stale shot result', { stale: true });
    const ruling = this.mode ? this.resolveEvents(result.events, result.final, shot) : null;
    return { initial, result, ruling };
  }

  /**
   * Decides the seat to play's shot from its sim events and applies the
   * ruling (submitShot does it after the sim; tests can drive it directly).
   */
  resolveEvents(events, final = null, shot = { angle: 0, power: 1, spin: { x: 0, y: 0 } }) {
    const ruling = this.mode.resolveShot(this.match.mode, this.seat, events, final, shot);
    this.match = applyRuling(this.match, ruling);
    return ruling;
  }

  /** The turn timer ran out: a foul for the seat to play. */
  timeout() {
    const ruling = this.mode.resolveTimeout(this.match.mode, this.seat);
    this.match = applyRuling(this.match, ruling);
    return ruling;
  }

  /** Answers a pending 9-ball push-out: accept plays on, pass hands the shot back. */
  choosePushOut(accept) {
    const ruling = this.mode.applyChoice(this.match.mode, this.seat, { kind: 'push_out', accept });
    this.match = applyRuling(this.match, ruling);
    return ruling;
  }

  /** The seat concedes; the other team wins. */
  concede(seat) {
    this.match = removeMatchSeat(this.match, this.mode, seat);
  }

  /** The legacy getStatus() shape, for the HUD, the AI and the spectator; null without a mode. */
  status() {
    if (!this.match) return null;
    const m = this.match.mode;
    const eight = this.modeId === '8ball' ? eightBallStatus(m) : null;
    const nine = this.modeId === '9ball' ? nineBallStatus(m) : null;
    return {
      currentPlayer: this.seat + 1,
      breakShot: m.breakShot,
      gameOver: m.winnerTeam !== null,
      winner: m.winnerTeam === null ? null : m.winnerTeam + 1,
      ballInHand: m.ballInHand ? { player: m.ballInHand.seat + 1, kitchen: m.ballInHand.zone === 'kitchen' } : null,
      player1Group: eight?.groups[0] ?? null,
      player2Group: eight?.groups[1] ?? null,
      player1Remaining: eight?.remaining[0] ?? 7,
      player2Remaining: eight?.remaining[1] ?? 7,
      targetBall: nine?.targetBall ?? null,
      pocketedCount: m.pocketed.length,
      player1ConsecutiveFouls: m.fouls?.[0] ?? 0,
      player2ConsecutiveFouls: m.fouls?.[1] ?? 0,
      pushOutAvailable: !!m.pushOut?.available,
      pushOutPending: !!m.pushOut?.pending,
    };
  }

  /** The match state, plain JSON (LAN snapshots). */
  toJSON() {
    return this.match;
  }

  /** Takes a match state from a snapshot; pending shots become stale. */
  restore(match) {
    this._epoch++;
    this.match = match ? structuredClone(match) : null;
  }

  /** Pending shots become stale. */
  dispose() {
    this._epoch++;
  }
}
