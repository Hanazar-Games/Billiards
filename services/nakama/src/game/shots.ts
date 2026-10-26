// Shots and turns (spec §6, §7.2–7.4, F4-03): an accepted shot goes to the sim
// and through the mode's rules, and everyone gets the shot_result; a turn that
// runs out is a foul; a pending 9-ball push-out is answered with op 7. The next
// turn's clock starts once the playback ends. Every shot_result is kept in
// lastResult, for a player who reconnects during the playback.
import { applyRuling, currentSeat, placeCueBall, removeMatchSeat, respotBalls } from '@billiards/modes';
import type { MatchState, ModeStateBase, Ruling } from '@billiards/modes';
import { OP, SIM_VERSION, bytesToBase64, encodeTrajectory } from '@billiards/protocol';
import type { ShotRequest, ShotResultHeader } from '@billiards/protocol';
import { endMatch } from './end.ts';
import { broadcastEnvelope, sendJson, sendSnapshot } from './send.ts';
import { callSim } from './sim.ts';
import type { SimReply } from './sim.ts';
import { LIMITS, SECONDS, TICK_RATE, modeOf, presenceList, recordDecision } from './state.ts';
import type { GameEnv, GameState, GameTable } from './state.ts';

const TURN_TICKS = SECONDS.turn * TICK_RATE;
const MS_PER_TICK = 1000 / TICK_RATE;
/** Turns a seat lets run out in a row before it counts as abandonment. */
const ABANDON_TIMEOUTS = 3;

/** A shot_result without the match and the next turn, which come from the state. */
type Result = Omit<ShotResultHeader<MatchState, GameTable>, 'ruling' | 'table' | 'match' | 'nextTurn'> & { ruling: Ruling<ModeStateBase> };

/**
 * A shot that passed every check: recorded, announced, simulated (power 0 needs
 * no sim), ruled and sent to everyone. The sim's failure leaves the turn as it was.
 */
export function acceptShot(env: GameEnv, state: GameState, seat: number, shot: ShotRequest, seq: number, tick: number): void {
  const match = state.match as MatchState;
  const turnId = match.turnId;
  state.lastAccepted[seat] = { turnId, seq };
  match.seats[seat].timeouts = 0;
  sendJson(env.dispatcher, OP.SHOT_ACCEPTED, { turnId, seq, seat, shot });

  const table = state.table as GameTable;
  const initial = shot.cueBall ? placeCueBall(table, shot.cueBall) : table;
  let reply: SimReply = { trajectory: encodeTrajectory([]), events: [], final: initial, steps: 0, simSeconds: 0, capped: false };
  let simMs = 0;
  if (shot.power > 0) {
    const started = Date.now();
    const outcome = callSim(env.nk, { url: env.ctx.env.SIM_URL, secret: env.ctx.env.SIM_SECRET }, { simVersion: SIM_VERSION, table: initial, shot });
    simMs = Date.now() - started;
    if (!outcome.ok) return simFailed(env, state, seat, outcome.error, tick);
    reply = outcome.reply;
  }
  env.logger.info('shot resolved: matchId=%v turnId=%v seat=%v simMs=%v', env.ctx.matchId, turnId, seat, simMs);

  const ruling = modeOf(state).resolveShot(match.mode, seat, reply.events, reply.final, shot);
  state.table = respotBalls(reply.final, ruling.respot, match.mode.config.table);
  state.match = applyRuling(match, ruling);
  recordDecision(state, { turnId, seat, kind: 'shot', shot });

  const durationTicks = Math.ceil(reply.simSeconds * TICK_RATE) + SECONDS.playbackGrace * TICK_RATE;
  state.deadlineTick = tick + durationTicks + TURN_TICKS;
  publish(env, state, {
    kind: 'shot', turnId, seq, seat, shot, events: reply.events, final: reply.final, ruling,
    durationMs: Math.round(reply.simSeconds * 1000), capped: reply.capped,
  }, reply.trajectory, tick, durationTicks);
  if (ruling.winnerTeam !== null) endMatch(env, state, tick, ruling.winnerTeam, 'WIN');
}

/**
 * The sim failed twice: the shot never happened. The same request may be sent
 * again; everyone gets the error and the state, and the turn starts over.
 */
function simFailed(env: GameEnv, state: GameState, seat: number, error: string, tick: number): void {
  const turnId = (state.match as MatchState).turnId;
  state.simFailures++;
  delete state.lastAccepted[seat];
  env.logger.warn('sim failed: matchId=%v turnId=%v seat=%v error=%v failures=%v', env.ctx.matchId, turnId, seat, error, state.simFailures);
  sendJson(env.dispatcher, OP.ERROR, { code: 'SIM_FAILED' });
  if (state.simFailures >= LIMITS.simFailures) {
    endMatch(env, state, tick, null, 'ABORTED');
    return;
  }
  state.deadlineTick = tick + TURN_TICKS;
  sendSnapshot(env.dispatcher, state, presenceList(state), tick);
}

/**
 * The seat to play let its turn run out: a foul, by the mode's rules. The third
 * in a row by the same seat (a shot starts the count over) is an abandonment.
 */
export function turnTimeout(env: GameEnv, state: GameState, tick: number): void {
  const match = state.match as MatchState;
  const seat = currentSeat(match) as number;
  const mode = modeOf(state);
  const ruling = mode.resolveTimeout(match.mode, seat);
  recordDecision(state, { turnId: match.turnId, seat, kind: 'timeout' });
  const next = applyRuling(match, ruling);
  next.seats[seat].timeouts++;
  state.match = next;
  if (next.seats[seat].timeouts >= ABANDON_TIMEOUTS) {
    state.match = removeMatchSeat(next, mode, seat);
    endMatch(env, state, tick, state.match.mode.winnerTeam, 'ABANDON');
    return;
  }
  state.deadlineTick = tick + TURN_TICKS;
  publishWithoutShot(env, state, 'timeout', match.turnId, seat, ruling, tick);
  if (ruling.winnerTeam !== null) endMatch(env, state, tick, ruling.winnerTeam, 'WIN');
}

/** The seat to play answers a pending 9-ball push-out (intake checked it). */
export function pushOutChoice(env: GameEnv, state: GameState, seat: number, accept: boolean, tick: number): void {
  const match = state.match as MatchState;
  const ruling = modeOf(state).applyChoice(match.mode, seat, { kind: 'push_out', accept });
  state.match = applyRuling(match, ruling);
  recordDecision(state, { turnId: match.turnId, seat, kind: 'choice', accept });
  state.deadlineTick = tick + TURN_TICKS;
  publishWithoutShot(env, state, 'choice', match.turnId, seat, ruling, tick);
}

/** A result with no shot and no playback: the table stays as it is. */
function publishWithoutShot(env: GameEnv, state: GameState, kind: 'timeout' | 'choice', turnId: number, seat: number,
  ruling: Ruling<ModeStateBase>, tick: number): void {
  const table = state.table as GameTable;
  publish(env, state, { kind, turnId, seq: null, seat, shot: null, events: [], final: table, ruling, durationMs: 0, capped: false },
    encodeTrajectory([]), tick, 0);
}

/** shot_result to everyone, with the state's match, table and next turn; kept as lastResult. */
function publish(env: GameEnv, state: GameState, result: Result, trajectory: Uint8Array, tick: number, durationTicks: number): void {
  const match = state.match as MatchState;
  const seat = currentSeat(match);
  const { ruling } = result;
  const header: ShotResultHeader<MatchState, GameTable> = {
    kind: result.kind,
    turnId: result.turnId,
    seq: result.seq,
    seat: result.seat,
    shot: result.shot,
    events: result.events,
    final: result.final,
    table: state.table as GameTable,
    ruling: {
      fouls: ruling.fouls, ballInHand: ruling.ballInHand, nextSeat: ruling.nextSeat,
      winnerTeam: ruling.winnerTeam, respot: ruling.respot, messages: ruling.messages,
    },
    match,
    durationMs: result.durationMs,
    capped: result.capped,
    nextTurn: seat === null ? null : { seat, turnId: match.turnId, deadlineInMs: (state.deadlineTick - tick) * MS_PER_TICK },
  };
  broadcastEnvelope(env.dispatcher, OP.SHOT_RESULT, header, trajectory);
  state.lastResult = { header, trajectory: bytesToBase64(trajectory), tick, durationTicks };
}
