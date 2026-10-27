/**
 * Dev only (tests): an OnlineMatchController fed by an in-page fake server that
 * decides like services/nakama does (packages/modes rules, the official table
 * with respotted balls), so browser tests drive the Game's online path without
 * a Nakama. The real controller runs; only the session is fake.
 */
import { OP, encodeTrajectory } from '@billiards/protocol';
import { MODES, createMatch, rackTable, applyRuling, respotBalls, currentSeat } from '@billiards/modes';
import { cushionContactInset } from '@billiards/sim/constants';
import { OnlineMatchController } from '../match/OnlineMatchController.js';
import { getTableProfile } from '../game/TableProfiles.js';
import { BALL, SHOT } from '../config.js';

class FakeSession extends EventTarget {
  constructor() { super(); this.sent = []; }
  send(op, body) { this.sent.push({ op, body }); }
  deliver(op, fields) { this.dispatchEvent(new CustomEvent('message', { detail: { op, ...fields } })); }
  connection(detail) { this.dispatchEvent(new CustomEvent('connection', { detail })); }
}

const plain = (ruling) => ({ fouls: ruling.fouls, ballInHand: ruling.ballInHand, nextSeat: ruling.nextSeat, winnerTeam: ruling.winnerTeam, respot: ruling.respot, messages: ruling.messages });

export function createFakeOnlineMatch({ modeId = '8ball', localSeat = 0, turnSeat = 0 } = {}) {
  const profile = getTableProfile('pool9ft');
  const mode = MODES[modeId];
  const config = {
    format: { kind: '1v1' },
    table: { width: profile.width, depth: profile.depth, ballRadius: BALL.radius, cushionInset: cushionContactInset(profile) },
    maxPower: SHOT.maxPower,
  };
  const session = new FakeSession();
  const controller = new OnlineMatchController({ session, matchId: 'fake', modeId, tableProfile: profile });
  const server = { match: createMatch(mode, config, () => 0.5, turnSeat), table: null, lastHeader: null, lastPayload: null };
  server.table = rackTable(mode.rackLayout(server.match.mode), 'pool9ft');

  const turn = (deadlineInMs = 45000) => ({ seat: currentSeat(server.match), turnId: server.match.turnId, deadlineInMs });
  const snapshotHeader = (over = {}) => ({
    protocolVersion: 1, simVersion: 1, mode: modeId, format: '1v1', phase: 'AWAITING_SHOT', you: { seat: localSeat },
    seats: [{ seat: 0, userId: 'a', username: 'ana', connected: true, timeouts: 0 }, { seat: 1, userId: 'b', username: 'bia', connected: true, timeouts: 0 }],
    turnId: server.match.turnId, match: server.match, table: server.table, turn: turn(), playback: null, end: null, ...over,
  });

  /** The server decides a shot: rules, respot, the official table (`tweak` lets a test change it). */
  function decide(seat, shot, sim, { seq = null, tweak = (t) => t } = {}) {
    const turnId = server.match.turnId;
    const ruling = mode.resolveShot(server.match.mode, seat, sim.events, sim.final, shot);
    const table = tweak(respotBalls(sim.final, ruling.respot, config.table));
    server.match = applyRuling(server.match, ruling);
    server.table = table;
    const durationMs = Math.ceil(sim.simSeconds * 10) * 100;
    const header = {
      kind: 'shot', turnId, seq, seat, shot, events: sim.events, final: sim.final, table, ruling: plain(ruling), match: server.match,
      durationMs, capped: !!sim.capped, nextTurn: ruling.winnerTeam === null ? turn(durationMs + 1000 + 45000) : null,
    };
    const payload = encodeTrajectory(sim.frames);
    server.lastHeader = header;
    server.lastPayload = payload;
    return { header, payload };
  }

  return {
    controller,
    session,
    server,
    config,
    get table() { return server.table; },
    get match() { return server.match; },
    snapshotHeader,
    /** The first snapshot (the match starts). */
    start(over) { session.deliver(OP.MATCH_SNAPSHOT, { header: snapshotHeader(over), payload: encodeTrajectory([]) }); },
    /** The last shot_request this client sent. */
    lastShotRequest() { return [...session.sent].reverse().find((m) => m.op === OP.SHOT_REQUEST)?.body ?? null; },
    /** Answers this client's pending shot with `sim` (a sim result for that shot). */
    answerShot(sim, options) {
      const body = this.lastShotRequest();
      const { header, payload } = decide(localSeat, body, sim, { seq: body.seq, ...options });
      session.deliver(OP.SHOT_RESULT, { header, payload });
      return header;
    },
    /** The opponent's shot, decided and sent to this client. */
    remoteShot(seat, shot, sim, options) {
      const { header, payload } = decide(seat, shot, sim, { seq: 1, ...options });
      session.deliver(OP.SHOT_RESULT, { header, payload });
      return header;
    },
    /** A turn timeout of the seat to play. */
    timeout() {
      const seat = currentSeat(server.match);
      const turnId = server.match.turnId;
      const ruling = mode.resolveTimeout(server.match.mode, seat);
      server.match = applyRuling(server.match, ruling);
      const header = {
        kind: 'timeout', turnId, seq: null, seat, shot: null, events: [], final: server.table, table: server.table, ruling: plain(ruling),
        match: server.match, durationMs: 0, capped: false, nextTurn: ruling.winnerTeam === null ? turn() : null,
      };
      session.deliver(OP.SHOT_RESULT, { header, payload: encodeTrajectory([]) });
      return header;
    },
    /** A return: the snapshot with the last shot playing from `offsetMs`. */
    snapshotWithPlayback(offsetMs) {
      session.deliver(OP.MATCH_SNAPSHOT, { header: snapshotHeader({ playback: { result: server.lastHeader, offsetMs } }), payload: server.lastPayload });
    },
    /** Decides a shot without sending it (a shot the client missed while away). */
    decideQuietly(seat, shot, sim, options) { return decide(seat, shot, sim, { seq: 1, ...options }).header; },
    end(body) { session.deliver(OP.MATCH_END, { body }); },
    /** The opponent's aim and ball in hand, as the server relays them. */
    aim(seat, aim) { session.deliver(OP.AIM_RELAY, { body: { seat, turnId: server.match.turnId, ...aim } }); },
    ballInHand(seat, x, z) { session.deliver(OP.BALL_IN_HAND_RELAY, { body: { seat, turnId: server.match.turnId, x, z } }); },
    seat(seat, connected) { session.deliver(OP.SEAT_UPDATE, { body: { seat, connected } }); },
  };
}
