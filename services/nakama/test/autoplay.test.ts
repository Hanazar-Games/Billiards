// The test bot of the integration suite (test/integration/autoplay.ts) plays a whole 8-ball match
// through the real match handler, with the real sim behind the fake nk: the match ends with a
// winner, the server refuses nothing the bot sends and the history record matches the shots.
// This is the offline check of the bot; the integration test plays the same match over the sockets.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OP } from '@billiards/protocol';
import { message, startedGame } from './fakes.ts';
import { chooseShot } from './integration/autoplay.ts';

const MAX_SHOTS = 200;

test('o bot de teste joga uma partida inteira de 8-ball até um vencedor', () => {
  const game = startedGame();
  const bySeat = (seat: number) => (seat === game.seat ? game.shooter : game.waiter);
  const results: any[] = [];
  let ends: any[] = [];
  let tick = 1;

  while (results.length < MAX_SHOTS) {
    const match = game.state.match!;
    const seat = match.mode.turn.currentSeat;
    game.clear();
    const shot = chooseShot({ match, table: game.state.table! }, seat);
    game.loop(tick, [message(bySeat(seat), OP.SHOT_REQUEST, { ...shot, turnId: match.turnId, seq: results.length + 1 })]);
    const sent = game.out();
    assert.deepEqual(sent.filter((m) => m.op === OP.SHOT_REJECTED || m.op === OP.ERROR), [], `the shot ${results.length + 1} was refused`);
    const result = sent.find((m) => m.op === OP.SHOT_RESULT);
    assert.ok(result, `no shot_result for the shot ${results.length + 1}`);
    results.push(result.header);
    if (!result.header.nextTurn) {
      ends = sent.filter((m) => m.op === OP.MATCH_END);
      break;
    }
    tick += 5;   // the bots shoot at once: well inside the turn's clock
  }

  assert.equal(ends.length, 1, `no end after ${results.length} shots`);
  const end = ends[0].body;
  assert.equal(end.reason, 'WIN');
  assert.ok(end.winnerTeam === 0 || end.winnerTeam === 1);
  assert.deepEqual(end.summary, { turns: results.length, shots: results.length });
  assert.ok(results.every((r) => r.kind === 'shot'));

  const written = game.nk.writes.filter((w) => w.collection === 'match_history');
  assert.equal(written.length, 1);
  assert.deepEqual([written[0].value.winnerTeam, written[0].value.reason], [end.winnerTeam, 'WIN']);
  // Every decision is a shot here: the bot never lets a turn run out, and 8-ball has no choices.
  assert.deepEqual((written[0].value.decisions as unknown[]), results.map((r) => ({ turnId: r.turnId, seat: r.seat, kind: 'shot', shot: r.shot })));
});
