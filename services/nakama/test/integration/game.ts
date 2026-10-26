// Game bots for the F4 integration tests (spec §9.3): a bot joined to a
// billiards match with the version metadata, every message it receives decoded
// (the envelope of 101 and 105, the JSON of the others) and helpers to wait for
// a message, send, shoot and reconnect.
import type { MatchData, Socket } from '@heroiclabs/nakama-js';
import { OP, PROTOCOL_VERSION, decodeEnvelope } from '@billiards/protocol';
import type { ShotRequest, SnapshotHeader } from '@billiards/protocol';
import { call, newBot, openSocket, rpc, withTimeout, type Bot } from './bot.ts';

/** The join metadata of a client of this protocol version. */
export const JOIN_METADATA = { protocolVersion: String(PROTOCOL_VERSION) };

export interface Received { op: number; header?: any; payload?: Uint8Array; body?: any }

export interface GameBot {
  bot: Bot;
  matchId: string;
  /** The socket the bot plays on (the newest after reconnect()). */
  socket: Socket;
  /** From the latest snapshot. */
  seat: number | null;
  /** The current turn id, from the latest snapshot or shot_result. */
  turnId: number;
  /** The latest snapshot header. */
  snapshot: SnapshotHeader<any, any> | null;
  received: Received[];
  /** The first message with `op` (and `predicate`) no earlier waitFor returned, already received or still to come. */
  waitFor(op: number, predicate?: (m: Received) => boolean, ms?: number): Promise<Received>;
  /** `body` goes as JSON, a string as it is. */
  send(op: number, body: unknown): Promise<void>;
  /** A shot_request for the current turn id; `seq` defaults to this bot's next one. */
  shoot(shot: ShotRequest, seq?: number): Promise<void>;
  /** A new socket joins the match again; the old one stays open. */
  reconnect(): Promise<void>;
}

function decode(data: MatchData): Received {
  const op = data.op_code;
  const bytes = data.data ?? new Uint8Array(0);
  if (op === OP.MATCH_SNAPSHOT || op === OP.SHOT_RESULT) {
    const { header, payload } = decodeEnvelope(bytes);
    return { op, header, payload };
  }
  const text = new TextDecoder().decode(bytes);
  try {
    return { op, body: JSON.parse(text) };
  } catch {
    return { op, body: text };
  }
}

function gameBot(bot: Bot, matchId: string, socket: Socket): GameBot {
  type Waiter = { op: number; predicate: (m: Received) => boolean; resolve: (m: Received) => void };
  const consumed = new Set<Received>();
  const waiters = new Set<Waiter>();
  let nextSeq = 1;

  const game: GameBot = {
    bot,
    matchId,
    socket,
    seat: null,
    turnId: 0,
    snapshot: null,
    received: [],
    waitFor(op, predicate = () => true, ms = 10000) {
      const found = game.received.find((m) => !consumed.has(m) && m.op === op && predicate(m));
      if (found) {
        consumed.add(found);
        return Promise.resolve(found);
      }
      let waiter!: Waiter;
      const arrived = new Promise<Received>((resolve) => { waiter = { op, predicate, resolve }; waiters.add(waiter); });
      return withTimeout(arrived, ms, `op ${op}`).finally(() => waiters.delete(waiter));
    },
    send(op, body) {
      return game.socket.sendMatchState(matchId, op, typeof body === 'string' ? body : JSON.stringify(body));
    },
    shoot(shot, seq = nextSeq++) {
      return game.send(OP.SHOT_REQUEST, { ...shot, turnId: game.turnId, seq });
    },
    async reconnect() {
      const next = await openSocket(bot);
      next.onmatchdata = onData;
      await call(next.joinMatch(matchId, undefined, JOIN_METADATA));
      game.socket = next;
    },
  };

  function onData(data: MatchData): void {
    const m = decode(data);
    game.received.push(m);
    if (m.op === OP.MATCH_SNAPSHOT) {
      game.snapshot = m.header;
      game.seat = m.header.you.seat;
      game.turnId = m.header.turnId;
    } else if (m.op === OP.SHOT_RESULT && m.header.match) {
      game.turnId = m.header.match.turnId;
    }
    for (const waiter of waiters) {
      if (waiter.op !== m.op || !waiter.predicate(m)) continue;
      consumed.add(m);
      waiters.delete(waiter);
      waiter.resolve(m);
      break;
    }
  }

  socket.onmatchdata = onData;
  return game;
}

/** Joins with the version metadata; the bot records every message from then on. */
export async function joinGame(bot: Bot, matchId: string): Promise<GameBot> {
  const socket = await bot.socket();
  const game = gameBot(bot, matchId, socket);
  await call(socket.joinMatch(matchId, undefined, JOIN_METADATA));
  return game;
}

/** Two new bots in a private room, in join order, once both have the start snapshot. */
export async function startPrivateGame(mode = '8ball'): Promise<{ bots: [GameBot, GameBot]; matchId: string }> {
  const [a, b] = await Promise.all([newBot(), newBot()]);
  const { matchId } = await rpc(a, 'create_private_match', { mode, format: '1v1' });
  const first = await joinGame(a, matchId);
  const second = await joinGame(b, matchId);
  await Promise.all([first.waitFor(OP.MATCH_SNAPSHOT), second.waitFor(OP.MATCH_SNAPSHOT)]);
  return { bots: [first, second], matchId };
}

/** The bot whose turn it is and the other, by the latest snapshot. */
export function byTurn(bots: [GameBot, GameBot]): { shooter: GameBot; waiter: GameBot } {
  const seat = bots[0].snapshot!.turn!.seat;
  return bots[0].seat === seat ? { shooter: bots[0], waiter: bots[1] } : { shooter: bots[1], waiter: bots[0] };
}
