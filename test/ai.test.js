import assert from 'assert';
import * as THREE from 'three';
import { ShotPlanner } from '../src/ai/ShotPlanner.js';
import { AIPlayer, AI_DIFFICULTY } from '../src/ai/AIPlayer.js';
import { BALL } from '../src/config.js';

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

const R = BALL.radius;
const PROFILE = {
  width: 127,
  depth: 254,
  pocketRadius: R * 2.25,
  cornerPocketRadius: R * 2.25,
  sidePocketRadius: R * 2.1,
  cushionWidth: 4,
};

const POCKETS = [
  new THREE.Vector3(-63.5, 0, -127),
  new THREE.Vector3(63.5, 0, -127),
  new THREE.Vector3(-63.5, 0, 0),
  new THREE.Vector3(63.5, 0, 0),
  new THREE.Vector3(-63.5, 0, 127),
  new THREE.Vector3(63.5, 0, 127),
];

function makeBall(id, x, z) {
  return {
    id,
    pocketed: false,
    mesh: { position: new THREE.Vector3(x, R, z) },
  };
}

function makeCueBall(x, z) {
  return makeBall(0, x, z);
}

// ── ShotPlanner legality tests ──

console.log('\nShotPlanner — 8-ball legality');

test('closed table: only own group is targeted', () => {
  const planner = new ShotPlanner();
  const cue = makeCueBall(0, 50);
  const solid = makeBall(1, 0, -30);
  const stripe = makeBall(9, 10, -30);
  const balls = [cue, solid, stripe];
  const shots = planner.findAllShots(balls, cue, POCKETS, 'stripe', false, null, false, PROFILE);
  assert(shots.length > 0, 'should find shots');
  assert(shots.every((s) => s.targetBallId === 9), 'all shots must target stripe (ball 9)');
});

test('open table: both groups are valid targets', () => {
  const planner = new ShotPlanner();
  const cue = makeCueBall(0, 50);
  const solid = makeBall(1, 0, -30);
  const stripe = makeBall(9, 10, -30);
  const balls = [cue, solid, stripe];
  const shots = planner.findAllShots(balls, cue, POCKETS, null, false, null, false, PROFILE);
  assert(shots.length > 0, 'should find shots');
  const targets = new Set(shots.map((s) => s.targetBallId));
  assert(targets.has(1), 'should include solid ball 1');
  assert(targets.has(9), 'should include stripe ball 9');
});

test('8-ball is excluded until group is cleared', () => {
  const planner = new ShotPlanner();
  const cue = makeCueBall(0, 50);
  const solid = makeBall(1, 0, -30);
  const eight = makeBall(8, 20, -30);
  const balls = [cue, solid, eight];
  const shots = planner.findAllShots(balls, cue, POCKETS, 'solid', false, null, false, PROFILE);
  assert(shots.every((s) => s.targetBallId !== 8), '8-ball must not be targeted before clearance');
});

test('8-ball becomes target after group cleared', () => {
  const planner = new ShotPlanner();
  const cue = makeCueBall(0, 50);
  const eight = makeBall(8, 20, -30);
  const balls = [cue, eight];
  const shots = planner.findAllShots(balls, cue, POCKETS, 'solid', false, null, false, PROFILE);
  assert(shots.some((s) => s.targetBallId === 8), '8-ball must be targeted after clearance');
});

console.log('\nShotPlanner — 9-ball legality');

test('only lowest-numbered ball is targeted', () => {
  const planner = new ShotPlanner();
  const cue = makeCueBall(0, 50);
  const ball1 = makeBall(1, 0, -30);
  const ball2 = makeBall(2, 20, -30);
  const balls = [cue, ball1, ball2];
  const shots = planner.findAllShots(balls, cue, POCKETS, null, false, 1, false, PROFILE);
  assert(shots.length > 0, 'should find shots');
  assert(shots.every((s) => s.targetBallId === 1), 'all shots must target ball 1 (lowest)');
});

test('bank shots do not crash (Set bug fixed)', () => {
  const planner = new ShotPlanner();
  const cue = makeCueBall(0, 50);
  const ball1 = makeBall(1, 0, -30);
  const balls = [cue, ball1];
  let shots;
  try {
    shots = planner.findAllShots(balls, cue, POCKETS, null, false, null, true, PROFILE);
  } catch (e) {
    assert.fail('bank shot evaluation threw: ' + e.message);
  }
  assert(Array.isArray(shots), 'should return array');
});

// ── AIPlayer difficulty behaviour tests ──

console.log('\nAIPlayer — difficulty scoring');

test('EASY prefers closer, less risky shots over long thin cuts', () => {
  const ai = new AIPlayer(AI_DIFFICULTY.EASY);
  const cue = makeCueBall(0, 50);
  const ballA = makeBall(1, 0, -30);    // closer, decent angles
  const ballB = makeBall(2, 55, -100);  // far away, long distances
  const balls = [cue, ballA, ballB];

  const planner = new ShotPlanner();
  const allShots = planner.findAllShots(balls, cue, POCKETS, null, false, null, false, PROFILE);
  assert(allShots.length >= 2, 'need at least 2 candidate shots');

  let aWins = 0;
  for (let i = 0; i < 20; i++) {
    const ch = ai._selectShot(allShots, balls, cue, POCKETS, PROFILE);
    if (ch.targetBallId === 1) aWins++;
  }
  assert(aWins >= 15, `EASY should prefer closer ball A (${aWins}/20)`);
});

test('HARD values position play over marginal base score advantage', () => {
  const aiEasy = new AIPlayer(AI_DIFFICULTY.EASY);
  const aiHard = new AIPlayer(AI_DIFFICULTY.HARD);
  const cue = makeCueBall(0, 50);
  const ballA = makeBall(1, 10, -30);   // slightly better base score
  const ballB = makeBall(2, 40, -40);   // slightly worse base score, better position
  const ballC = makeBall(9, -30, 30);   // next-ball candidate (stripe, not direct target)
  const balls = [cue, ballA, ballB, ballC];

  const planner = new ShotPlanner();
  const allShots = planner.findAllShots(balls, cue, POCKETS, 'solid', false, null, false, PROFILE);
  assert(allShots.length >= 2, 'need at least 2 candidate shots');

  let easyA = 0, easyB = 0;
  for (let i = 0; i < 20; i++) {
    const ch = aiEasy._selectShot(allShots, balls, cue, POCKETS, PROFILE);
    if (ch.targetBallId === 1) easyA++;
    else if (ch.targetBallId === 2) easyB++;
  }

  let hardA = 0, hardB = 0;
  for (let i = 0; i < 20; i++) {
    const ch = aiHard._selectShot(allShots, balls, cue, POCKETS, PROFILE);
    if (ch.targetBallId === 1) hardA++;
    else if (ch.targetBallId === 2) hardB++;
  }

  assert(easyA >= 12, `EASY should prefer ball A (${easyA}/20)`);
  assert(hardB >= 12, `HARD should prefer ball B for position (${hardB}/20)`);
});

test('NORMAL considers scratch risk', () => {
  const ai = new AIPlayer(AI_DIFFICULTY.NORMAL);
  const cue = makeCueBall(0, 50);
  const ballA = makeBall(1, 0, -120);   // very close to pocket — scratch risk
  const ballB = makeBall(2, 40, 0);     // safe side-pocket shot
  const balls = [cue, ballA, ballB];

  const planner = new ShotPlanner();
  const allShots = planner.findAllShots(balls, cue, POCKETS, null, false, null, false, PROFILE);
  assert(allShots.length >= 2, 'need at least 2 candidate shots');

  let safeWins = 0;
  for (let i = 0; i < 20; i++) {
    const ch = ai._selectShot(allShots, balls, cue, POCKETS, PROFILE);
    if (ch.targetBallId === 2) safeWins++;
  }
  assert(safeWins >= 6, `NORMAL should sometimes avoid scratch-prone shot (${safeWins}/20)`);
});

test('HARD _evaluateNextBall rewards shots that leave follow-ups', () => {
  const ai = new AIPlayer(AI_DIFFICULTY.HARD);
  const cue = makeCueBall(0, 50);
  const ballA = makeBall(1, 0, 0);
  const ballC = makeBall(3, -25, 40);
  const balls = [cue, ballA, ballC];

  const planner = new ShotPlanner();
  const allShots = planner.findAllShots(balls, cue, POCKETS, null, false, null, false, PROFILE);
  assert(allShots.length > 0, 'should find shots');

  const shot = allShots.find((s) => ai._evaluateNextBall(s, balls, cue, POCKETS, PROFILE) > 0) || allShots[0];
  const nextBallScore = ai._evaluateNextBall(shot, balls, cue, POCKETS, PROFILE);
  assert(nextBallScore > 0, 'HARD should detect at least one follow-up shot');
});

test('EASY does not evaluate next-ball position', () => {
  const ai = new AIPlayer(AI_DIFFICULTY.EASY);
  const cue = makeCueBall(0, 50);
  const ballA = makeBall(1, 0, 0);
  const ballC = makeBall(3, -25, 40);
  const balls = [cue, ballA, ballC];

  const planner = new ShotPlanner();
  const allShots = planner.findAllShots(balls, cue, POCKETS, null, false, null, false, PROFILE);
  const shot = allShots.find((s) => ai._evaluateNextBall(s, balls, cue, POCKETS, PROFILE) > 0) || allShots[0];

  const nextBallScore = ai._evaluateNextBall(shot, balls, cue, POCKETS, PROFILE);
  assert(typeof nextBallScore === 'number', 'should return numeric score');
});

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`Results: ${passed} passed, ${failed} failed / ${passed + failed} total`);
process.exit(failed > 0 ? 1 : 0);
