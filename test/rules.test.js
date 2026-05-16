import assert from 'assert';
import { Rules } from '../src/game/Rules.js';
import { NineBallRules } from '../src/game/NineBallRules.js';
import { GameStateSerializer } from '../src/net/GameStateSerializer.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

function createMockGame(rules) {
  return {
    mode: rules instanceof NineBallRules ? '9ball' : 'local2p',
    state: 'AIM',
    currentPlayer: 1,
    ballInHand: false,
    ballInHandBehindLine: false,
    ballsManager: {
      balls: [],
      getBall() { return null; },
    },
    ui: null,
    networkPlayer1Name: 'P1',
    networkPlayer2Name: 'P2',
    rules,
    cameraMode: 'free',
    _updatePlayerStats() {},
    _updateCamera() {},
  };
}

// ── NineBallRules ──
console.log('\nNineBallRules');

test('legal break with pocketed ball', () => {
  const rules = new NineBallRules();
  rules.startShot(1);
  rules.recordFirstHit(1);
  const result = rules.resolveShot([2], false);
  assert.strictEqual(result.foul, false);
  assert.strictEqual(result.nextPlayer, 1);
  assert.strictEqual(rules.breakShot, false);
});

test('legal break with no pocket but 4 balls to rail', () => {
  const rules = new NineBallRules();
  rules.startShot(1);
  rules.recordFirstHit(1);
  rules.recordCushionHit(2);
  rules.recordCushionHit(3);
  rules.recordCushionHit(4);
  rules.recordCushionHit(5);
  const result = rules.resolveShot([], false);
  assert.strictEqual(result.foul, false);
  assert.strictEqual(result.nextPlayer, 2);
});

test('illegal break: fewer than 4 balls hit rail', () => {
  const rules = new NineBallRules();
  rules.startShot(1);
  rules.recordFirstHit(1);
  rules.recordCushionHit(2);
  rules.recordCushionHit(3);
  const result = rules.resolveShot([], false);
  assert.strictEqual(result.foul, true);
  assert.strictEqual(result.ballInHand, true);
  assert.strictEqual(result.reasonCode, 'ILLEGAL_BREAK');
  assert.strictEqual(result.nextPlayer, 2);
});

test('illegal break: first hit not 1-ball', () => {
  const rules = new NineBallRules();
  rules.startShot(1);
  rules.recordFirstHit(2);
  const result = rules.resolveShot([], false);
  assert.strictEqual(result.foul, true);
  assert.strictEqual(result.ballInHand, true);
  assert.strictEqual(result.reasonCode, 'WRONG_FIRST_HIT');
  assert.strictEqual(result.nextPlayer, 2);
});

test('9-ball pocketed on break = win', () => {
  const rules = new NineBallRules();
  rules.startShot(1);
  rules.recordFirstHit(1);
  const result = rules.resolveShot([9], false);
  assert.strictEqual(result.gameOver, true);
  assert.strictEqual(result.winner, 1);
  assert.strictEqual(result.reasonCode, 'NINE_ON_BREAK_WIN');
});

test('break scratch', () => {
  const rules = new NineBallRules();
  rules.startShot(1);
  const result = rules.resolveShot([], true);
  assert.strictEqual(result.foul, true);
  assert.strictEqual(result.scratch, true);
  assert.strictEqual(result.ballInHand, true);
  assert.strictEqual(result.reasonCode, 'SCRATCH');
  assert.strictEqual(result.nextPlayer, 2);
});

test('normal shot wrong first hit', () => {
  const rules = new NineBallRules();
  rules.breakShot = false;
  rules.startShot(1);
  rules.recordFirstHit(2);
  const result = rules.resolveShot([], false);
  assert.strictEqual(result.foul, true);
  assert.strictEqual(result.ballInHand, true);
  assert.strictEqual(result.reasonCode, 'WRONG_FIRST_HIT');
  assert.strictEqual(result.nextPlayer, 2);
});

test('legal 9-ball win', () => {
  const rules = new NineBallRules();
  rules.breakShot = false;
  rules.pocketedBalls = [1, 2, 3, 4, 5, 6, 7, 8];
  rules.startShot(1);
  rules.recordFirstHit(9);
  const result = rules.resolveShot([9], false);
  assert.strictEqual(result.gameOver, true);
  assert.strictEqual(result.winner, 1);
  assert.strictEqual(result.reasonCode, 'LEGAL_NINE_WIN');
});

// ── Three consecutive fouls ──
console.log('\nThree consecutive fouls');

test('second consecutive foul shows warning', () => {
  const rules = new NineBallRules();

  // First foul
  rules.breakShot = false;
  rules.startShot(1);
  rules.resolveShot([], true);
  assert.strictEqual(rules.player1ConsecutiveFouls, 1);

  // Second foul
  rules.startShot(1);
  rules.resolveShot([], true);
  assert.strictEqual(rules.player1ConsecutiveFouls, 2);

  // Third foul
  rules.startShot(1);
  const result = rules.resolveShot([], true);
  assert.strictEqual(rules.player1ConsecutiveFouls, 3);
  assert.strictEqual(result.gameOver, true);
  assert.strictEqual(result.winner, 2);
  assert.strictEqual(result.reasonCode, 'THREE_FOUL_LOSS');
});

test('third consecutive foul = loss', () => {
  const rules = new NineBallRules();

  // Player 1 fouls twice
  rules.breakShot = false;
  rules.startShot(1);
  rules.resolveShot([], true);
  rules.startShot(1);
  const result2 = rules.resolveShot([], true);
  assert.ok(result2.message.includes('已连续两次犯规'));

  // Player 1 fouls third time
  rules.startShot(1);
  const result3 = rules.resolveShot([], true);
  assert.strictEqual(result3.gameOver, true);
  assert.strictEqual(result3.winner, 2);
  assert.strictEqual(result3.reasonCode, 'THREE_FOUL_LOSS');
});

test('legal shot resets consecutive fouls', () => {
  const rules = new NineBallRules();

  // Player 1 fouls
  rules.breakShot = false;
  rules.startShot(1);
  rules.resolveShot([], true);
  assert.strictEqual(rules.player1ConsecutiveFouls, 1);

  // Player 2 plays legally
  rules.startShot(2);
  rules.recordFirstHit(1);
  rules.resolveShot([2], false);
  assert.strictEqual(rules.player2ConsecutiveFouls, 0);

  // Player 1 fouls again — should be 2nd, not 3rd
  rules.startShot(1);
  rules.resolveShot([], true);
  assert.strictEqual(rules.player1ConsecutiveFouls, 2);
  assert.strictEqual(rules.gameOver, false);
});

test('threeFoulLoss disabled does not end game', () => {
  const rules = new NineBallRules({ threeFoulLoss: false });

  rules.breakShot = false;
  for (let i = 0; i < 3; i++) {
    rules.startShot(1);
    rules.resolveShot([], true);
  }
  assert.strictEqual(rules.gameOver, false);
  assert.strictEqual(rules.player1ConsecutiveFouls, 3);
});

// ── Push-out ──
console.log('\nPush-out');

test('push-out available after legal break', () => {
  const rules = new NineBallRules();
  rules.startShot(1);
  rules.recordFirstHit(1);
  rules.resolveShot([2], false);
  assert.strictEqual(rules.pushOutAvailable, true);
});

test('declarePushOut succeeds when available', () => {
  const rules = new NineBallRules();
  rules.pushOutAvailable = true;
  assert.strictEqual(rules.declarePushOut(), true);
  assert.strictEqual(rules.pushOutDeclared, true);
  assert.strictEqual(rules.pushOutAvailable, false);
});

test('declarePushOut fails when not available', () => {
  const rules = new NineBallRules();
  assert.strictEqual(rules.declarePushOut(), false);
});

test('push-out shot does not require lowest ball', () => {
  const rules = new NineBallRules();
  rules.breakShot = false;
  rules.pushOutDeclared = true;
  rules.startShot(1);
  rules.recordFirstHit(2); // hit 2 instead of 1
  const result = rules.resolveShot([], false);
  assert.strictEqual(result.foul, false);
  assert.strictEqual(result.pushOutPending, true);
});

test('push-out shot does not require rail contact', () => {
  const rules = new NineBallRules();
  rules.breakShot = false;
  rules.pushOutDeclared = true;
  rules.startShot(1);
  rules.recordFirstHit(1);
  // No rail contact, no pocket
  const result = rules.resolveShot([], false);
  assert.strictEqual(result.foul, false);
  assert.strictEqual(result.pushOutPending, true);
});

test('push-out scratch is still a foul', () => {
  const rules = new NineBallRules();
  rules.breakShot = false;
  rules.pushOutDeclared = true;
  rules.startShot(1);
  const result = rules.resolveShot([], true);
  assert.strictEqual(result.foul, true);
  assert.strictEqual(result.scratch, true);
  assert.strictEqual(result.pushOutPending, undefined);
});

test('push-out enters pending state after shot', () => {
  const rules = new NineBallRules();
  rules.breakShot = false;
  rules.pushOutDeclared = true;
  rules.startShot(1);
  rules.recordFirstHit(1);
  const result = rules.resolveShot([], false);
  assert.strictEqual(result.pushOutPending, true);
  assert.strictEqual(rules.pushOutPending, true);
  assert.strictEqual(rules.pushOutPlayer, 1);
});

test('9-ball pocketed on push-out is spotted, not a win', () => {
  const rules = new NineBallRules();
  rules.breakShot = false;
  rules.pushOutDeclared = true;
  rules.startShot(1);
  rules.recordFirstHit(1);
  const result = rules.resolveShot([9], false);
  assert.strictEqual(result.gameOver, false);
  assert.strictEqual(result.pushOutPending, true);
  assert.strictEqual(result.respotNineBall, true);
  assert.strictEqual(rules.pocketedBalls.includes(9), false);
});

test('acceptPushOut gives turn to opponent', () => {
  const rules = new NineBallRules();
  rules.currentPlayer = 2;
  rules.pushOutPending = true;
  rules.pushOutPlayer = 1;
  const decision = rules.acceptPushOut();
  assert.strictEqual(decision.nextPlayer, 2);
  assert.strictEqual(rules.pushOutPending, false);
});

test('passPushOut gives turn back to original player', () => {
  const rules = new NineBallRules();
  rules.currentPlayer = 2;
  rules.pushOutPending = true;
  rules.pushOutPlayer = 1;
  const decision = rules.passPushOut();
  assert.strictEqual(decision.nextPlayer, 1);
  assert.strictEqual(rules.pushOutPending, false);
});

// ── Rules (8-ball) ──
console.log('\nRules (8-ball)');

test('scratch on normal shot', () => {
  const rules = new Rules();
  rules.breakShot = false;
  rules.player1Group = 'solid';
  rules.startShot(1);
  rules.recordFirstHit(1);
  const result = rules.resolveShot([], true);
  assert.strictEqual(result.foul, true);
  assert.strictEqual(result.scratch, true);
  assert.strictEqual(result.ballInHand, true);
  assert.strictEqual(result.reasonCode, 'SCRATCH');
  assert.strictEqual(result.nextPlayer, 2);
});

test('early eight = loss', () => {
  const rules = new Rules();
  rules.breakShot = false;
  rules.player1Group = 'solid';
  rules.player1Pocketed = [1, 2, 3, 4, 5, 6];
  rules.startShot(1);
  rules.recordFirstHit(8);
  const result = rules.resolveShot([8], false);
  assert.strictEqual(result.gameOver, true);
  assert.strictEqual(result.winner, 2);
  assert.strictEqual(result.foul, true);
  assert.strictEqual(result.reasonCode, 'EARLY_EIGHT');
});

test('8-ball on break is respotted', () => {
  const rules = new Rules();
  rules.startShot(1);
  rules.recordFirstHit(1);
  const result = rules.resolveShot([8], false);
  assert.strictEqual(result.foul, false);
  assert.strictEqual(result.respotEightBall, true);
  assert.strictEqual(result.reasonCode, 'EIGHT_ON_BREAK_RESPOT');
  assert.strictEqual(result.nextPlayer, 1);
});

test('legal 8-ball win', () => {
  const rules = new Rules();
  rules.breakShot = false;
  rules.player1Group = 'solid';
  rules.player1Pocketed = [1, 2, 3, 4, 5, 6, 7];
  rules.startShot(1);
  rules.recordFirstHit(8);
  const result = rules.resolveShot([8], false);
  assert.strictEqual(result.gameOver, true);
  assert.strictEqual(result.winner, 1);
  assert.strictEqual(result.reasonCode, 'LEGAL_EIGHT_WIN');
});

// ── GameStateSerializer ──
console.log('\nGameStateSerializer');

test('serializer round-trips 9-ball state', () => {
  const rules = new NineBallRules();
  rules.pocketedBalls = [1, 2, 3];
  rules.player1ConsecutiveFouls = 2;
  rules.player2ConsecutiveFouls = 1;
  rules.pushOutAvailable = true;
  rules.pushOutPending = false;
  rules.pushOutPlayer = null;
  rules.breakShot = false;

  const game = createMockGame(rules);
  const snapshot = GameStateSerializer.serializeGameState(game);

  const freshRules = new NineBallRules();
  const freshGame = createMockGame(freshRules);
  GameStateSerializer.applyGameState(freshGame, snapshot);

  assert.deepStrictEqual(freshRules.pocketedBalls, [1, 2, 3]);
  assert.strictEqual(freshRules.player1ConsecutiveFouls, 2);
  assert.strictEqual(freshRules.player2ConsecutiveFouls, 1);
  assert.strictEqual(freshRules.pushOutAvailable, true);
  assert.strictEqual(freshRules.breakShot, false);
});

test('serializer round-trips 8-ball state', () => {
  const rules = new Rules();
  rules.player1Group = 'solid';
  rules.player2Group = 'stripe';
  rules.player1Pocketed = [1, 2, 3];
  rules.player2Pocketed = [9, 10];
  rules.breakShot = false;
  rules.gameOver = false;

  const game = createMockGame(rules);
  const snapshot = GameStateSerializer.serializeGameState(game);

  const freshRules = new Rules();
  const freshGame = createMockGame(freshRules);
  GameStateSerializer.applyGameState(freshGame, snapshot);

  assert.strictEqual(freshRules.player1Group, 'solid');
  assert.strictEqual(freshRules.player2Group, 'stripe');
  assert.deepStrictEqual(freshRules.player1Pocketed, [1, 2, 3]);
  assert.deepStrictEqual(freshRules.player2Pocketed, [9, 10]);
  assert.strictEqual(freshRules.breakShot, false);
});

// ── Summary ──
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
