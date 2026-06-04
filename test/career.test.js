/**
 * CareerStore & ShotProfiler Unit Tests
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { CareerStore } from '../src/career/CareerStore.js';
import { ShotProfiler } from '../src/career/ShotProfiler.js';

describe('CareerStore', () => {
  let store;

  test('constructor loads defaults when storage empty', () => {
    store = new CareerStore();
    assert.strictEqual(store.getGamesPlayed(), 0);
    assert.strictEqual(store.getShotsTaken(), 0);
    assert.strictEqual(store.getWinRate(), 0);
  });

  test('recordShot increments shots and totals', () => {
    store = new CareerStore();
    store.recordShot({ power: 50, spin: { x: 0, y: 0 }, pocketedCount: 1, isFoul: false });
    assert.strictEqual(store.getShotsTaken(), 1);
    const totals = store.getTotals();
    assert.strictEqual(totals.ballsPocketed, 1);
    assert.strictEqual(totals.totalShotPower, 50);
  });

  test('recordShot distributes power into buckets', () => {
    store = new CareerStore();
    store.recordShot({ power: 15 }); // bucket 0
    store.recordShot({ power: 25 }); // bucket 1
    store.recordShot({ power: 45 }); // bucket 2
    store.recordShot({ power: 65 }); // bucket 3
    store.recordShot({ power: 85 }); // bucket 4
    const style = store.getShotStyle();
    assert.deepStrictEqual(style.powerBuckets, [1, 1, 1, 1, 1]);
  });

  test('recordShot tracks spin usage', () => {
    store = new CareerStore();
    store.recordShot({ spin: { x: 0, y: 0.5 } });   // top
    store.recordShot({ spin: { x: 0, y: -0.5 } });  // bottom
    store.recordShot({ spin: { x: 0.5, y: 0 } });   // left
    store.recordShot({ spin: { x: -0.5, y: 0 } });  // right
    store.recordShot({ spin: { x: 0, y: 0 } });     // center
    const style = store.getShotStyle();
    assert.strictEqual(style.spin.top, 1);
    assert.strictEqual(style.spin.bottom, 1);
    assert.strictEqual(style.spin.left, 1);
    assert.strictEqual(style.spin.right, 1);
    assert.strictEqual(style.spin.center, 1);
  });

  test('recordShot clamps power to 0-100', () => {
    store = new CareerStore();
    store.recordShot({ power: -10 });
    store.recordShot({ power: 150 });
    const style = store.getShotStyle();
    assert.strictEqual(style.powerBuckets[0], 1); // -10 -> 0
    assert.strictEqual(style.powerBuckets[4], 1); // 150 -> 100
  });

  test('recordShot updates records', () => {
    store = new CareerStore();
    store.recordShot({ power: 88, pocketedCount: 3, collisions: 5, cushions: 2 });
    const rec = store.getRecords();
    assert.strictEqual(rec.highestShotPower, 88);
    assert.strictEqual(rec.highestBallsInOneTurn, 3);
    assert.strictEqual(rec.mostCollisionsInOneShot, 5);
    assert.strictEqual(rec.mostCushionsInOneShot, 2);
  });

  test('recordGame increments counters', () => {
    store = new CareerStore();
    store.recordGame({ mode: 'vsai', result: 'win', difficulty: 'hard' });
    store.recordGame({ mode: 'vsai', result: 'loss', difficulty: 'hard' });
    assert.strictEqual(store.getGamesPlayed(), 2);
    assert.strictEqual(store.getGamesWon(), 1);
    assert.strictEqual(store.getGamesLost(), 1);
    assert.strictEqual(store.getWinRate(), 0.5);
  });

  test('recordGame tracks per-mode stats', () => {
    store = new CareerStore();
    store.recordGame({ mode: 'local2p', result: 'win' });
    store.recordGame({ mode: 'local2p', result: 'win' });
    store.recordGame({ mode: 'local2p', result: 'loss' });
    const local2p = store.getByMode('local2p');
    assert.strictEqual(local2p.played, 3);
    assert.strictEqual(local2p.won, 2);
    assert.strictEqual(local2p.lost, 1);
  });

  test('recordGame tracks vsai by difficulty', () => {
    store = new CareerStore();
    store.recordGame({ mode: 'vsai', result: 'win', difficulty: 'easy' });
    store.recordGame({ mode: 'vsai', result: 'win', difficulty: 'easy' });
    store.recordGame({ mode: 'vsai', result: 'loss', difficulty: 'hard' });
    const vsai = store.getByMode('vsai');
    assert.strictEqual(vsai.byDifficulty.easy.played, 2);
    assert.strictEqual(vsai.byDifficulty.easy.won, 2);
    assert.strictEqual(vsai.byDifficulty.hard.played, 1);
    assert.strictEqual(vsai.byDifficulty.hard.lost, 1);
  });

  test('recordGame maintains recent games buffer (max 50)', () => {
    store = new CareerStore();
    for (let i = 0; i < 55; i++) {
      store.recordGame({ mode: 'freeplay', result: null });
    }
    const recent = store.getRecentGames();
    assert.strictEqual(recent.length, 50);
    // All entries should have mode 'freeplay'
    assert(recent.every(g => g.mode === 'freeplay'));
  });

  test('recordGame tracks fastest win', () => {
    store = new CareerStore();
    store.recordGame({ mode: 'vsai', result: 'win', durationSeconds: 120 });
    store.recordGame({ mode: 'vsai', result: 'win', durationSeconds: 60 });
    const rec = store.getRecords();
    assert.strictEqual(rec.fastestWinSeconds, 60);
  });

  test('recordStreak updates max consecutive', () => {
    store = new CareerStore();
    store.recordStreak(3);
    store.recordStreak(5);
    store.recordStreak(4, true); // end of game
    const rec = store.getRecords();
    assert.strictEqual(rec.maxConsecutivePockets, 5);
    assert.strictEqual(rec.maxConsecutivePocketsInGame, 4);
  });

  test('reset clears all data', () => {
    store = new CareerStore();
    store.recordShot({ power: 50 });
    store.recordGame({ mode: 'vsai', result: 'win' });
    store.reset();
    assert.strictEqual(store.getShotsTaken(), 0);
    assert.strictEqual(store.getGamesPlayed(), 0);
  });
});

describe('ShotProfiler', () => {
  let store, profiler;

  test('analyzeStyle returns empty for no data', () => {
    store = new CareerStore();
    profiler = new ShotProfiler(store);
    const labels = profiler.analyzeStyle();
    assert.strictEqual(labels.length, 0);
  });

  test('analyzeStyle detects power hitter', () => {
    store = new CareerStore();
    profiler = new ShotProfiler(store);
    // 10 heavy shots (>60% power)
    for (let i = 0; i < 10; i++) store.recordShot({ power: 85 });
    const labels = profiler.analyzeStyle();
    assert(labels.some(l => l.id === 'powerHitter'));
  });

  test('analyzeStyle detects touch player', () => {
    store = new CareerStore();
    profiler = new ShotProfiler(store);
    for (let i = 0; i < 10; i++) store.recordShot({ power: 15 });
    const labels = profiler.analyzeStyle();
    assert(labels.some(l => l.id === 'touchPlayer'));
  });

  test('analyzeStyle detects spin artist', () => {
    store = new CareerStore();
    profiler = new ShotProfiler(store);
    for (let i = 0; i < 10; i++) store.recordShot({ spin: { x: 0.5, y: 0.5 } });
    const labels = profiler.analyzeStyle();
    assert(labels.some(l => l.id === 'spinArtist'));
  });

  test('analyzeStyle detects straight shooter', () => {
    store = new CareerStore();
    profiler = new ShotProfiler(store);
    for (let i = 0; i < 10; i++) store.recordShot({ spin: { x: 0, y: 0 } });
    const labels = profiler.analyzeStyle();
    assert(labels.some(l => l.id === 'straightShooter'));
  });

  test('getAveragePower calculates correctly', () => {
    store = new CareerStore();
    profiler = new ShotProfiler(store);
    store.recordShot({ power: 50 });
    store.recordShot({ power: 70 });
    assert.strictEqual(profiler.getAveragePower(), '60.0');
  });

  test('getPocketRate calculates correctly', () => {
    store = new CareerStore();
    profiler = new ShotProfiler(store);
    store.recordShot({ pocketedCount: 1 });
    store.recordShot({ pocketedCount: 0 });
    store.recordShot({ pocketedCount: 1 });
    assert.strictEqual(profiler.getPocketRate(), '66.7');
  });

  test('getFoulRate calculates correctly', () => {
    store = new CareerStore();
    profiler = new ShotProfiler(store);
    store.recordShot({ isFoul: true });
    store.recordShot({ isFoul: false });
    store.recordShot({ isFoul: false });
    assert.strictEqual(profiler.getFoulRate(), '33.3');
  });

  test('getModeBreakdown returns only played modes', () => {
    store = new CareerStore();
    profiler = new ShotProfiler(store);
    store.recordGame({ mode: 'vsai', result: 'win' });
    store.recordGame({ mode: 'local2p', result: 'loss' });
    const breakdown = profiler.getModeBreakdown();
    assert.strictEqual(breakdown.length, 2);
    assert(breakdown.some(m => m.mode === 'vsai'));
    assert(breakdown.some(m => m.mode === 'local2p'));
  });

  test('getSpecialShots returns empty when no data', () => {
    store = new CareerStore();
    profiler = new ShotProfiler(store);
    assert.deepStrictEqual(profiler.getSpecialShots(), []);
  });

  test('getSpecialShots includes long shots with rate', () => {
    store = new CareerStore();
    profiler = new ShotProfiler(store);
    for (let i = 0; i < 5; i++) store.recordShot({ isLongShot: true, pocketedCount: i < 2 ? 1 : 0 });
    const specials = profiler.getSpecialShots();
    assert.strictEqual(specials.length, 1);
    assert.strictEqual(specials[0].name, '长台进攻');
    assert.strictEqual(specials[0].rate, '40.0');
  });

  test('getSummary returns complete overview', () => {
    store = new CareerStore();
    profiler = new ShotProfiler(store);
    store.recordShot({ power: 60, pocketedCount: 1 });
    store.recordGame({ mode: 'vsai', result: 'win', durationSeconds: 90 });
    const summary = profiler.getSummary();
    assert.strictEqual(summary.games, 1);
    assert.strictEqual(summary.won, 1);
    assert.strictEqual(summary.winRate, '100.0');
    assert.strictEqual(summary.shots, 1);
    assert.strictEqual(summary.avgPower, '60.0');
    assert.strictEqual(summary.pocketRate, '100.0');
  });

  test('getTrainingTips returns empty for insufficient data', () => {
    store = new CareerStore();
    profiler = new ShotProfiler(store);
    const tips = profiler.getTrainingTips();
    assert.deepStrictEqual(tips, []);
  });

  test('getTrainingTips detects heavy power preference', () => {
    store = new CareerStore();
    profiler = new ShotProfiler(store);
    for (let i = 0; i < 12; i++) store.recordShot({ power: 85 });
    const tips = profiler.getTrainingTips();
    assert(tips.length > 0);
    assert(tips.some(t => t.category === '力度' && t.title === '降低平均发力'));
  });

  test('getTrainingTips detects light power preference', () => {
    store = new CareerStore();
    profiler = new ShotProfiler(store);
    for (let i = 0; i < 12; i++) store.recordShot({ power: 15 });
    const tips = profiler.getTrainingTips();
    assert(tips.length > 0);
    assert(tips.some(t => t.category === '力度' && t.title === '适当增加发力'));
  });

  test('getTrainingTips detects low spin usage', () => {
    store = new CareerStore();
    profiler = new ShotProfiler(store);
    for (let i = 0; i < 12; i++) store.recordShot({ spin: { x: 0, y: 0 } });
    const tips = profiler.getTrainingTips();
    assert(tips.length > 0);
    assert(tips.some(t => t.category === '旋转' && t.title === '尝试更多杆法'));
  });

  test('getTrainingTips detects long shot weakness', () => {
    store = new CareerStore();
    profiler = new ShotProfiler(store);
    for (let i = 0; i < 10; i++) store.recordShot({ power: 50 });
    for (let i = 0; i < 5; i++) store.recordShot({ isLongShot: true, pocketedCount: 0 });
    const tips = profiler.getTrainingTips();
    assert(tips.some(t => t.category === '长台' && t.title === '强化长台稳定性'));
  });

  test('getTrainingTips detects thin cut strength', () => {
    store = new CareerStore();
    profiler = new ShotProfiler(store);
    for (let i = 0; i < 10; i++) store.recordShot({ power: 50 });
    for (let i = 0; i < 5; i++) store.recordShot({ isThinCut: true, pocketedCount: 1 });
    const tips = profiler.getTrainingTips();
    assert(tips.some(t => t.category === '薄球' && t.title === '薄球值得信赖'));
  });

  test('getTrainingTips detects mode weakness', () => {
    store = new CareerStore();
    profiler = new ShotProfiler(store);
    for (let i = 0; i < 10; i++) store.recordShot({ power: 50 });
    for (let i = 0; i < 5; i++) store.recordGame({ mode: 'vsai', result: 'loss' });
    const tips = profiler.getTrainingTips();
    assert(tips.some(t => t.category === '模式'));
  });

  test('getTrainingTips caps at 5 tips', () => {
    store = new CareerStore();
    profiler = new ShotProfiler(store);
    // Create data that would generate many tips
    for (let i = 0; i < 20; i++) store.recordShot({ power: 85, spin: { x: 0, y: 0 }, isFoul: true });
    for (let i = 0; i < 5; i++) store.recordShot({ isLongShot: true, pocketedCount: 0 });
    for (let i = 0; i < 5; i++) store.recordShot({ isThinCut: true, pocketedCount: 0 });
    for (let i = 0; i < 5; i++) store.recordGame({ mode: 'vsai', result: 'loss' });
    const tips = profiler.getTrainingTips();
    assert(tips.length >= 2 && tips.length <= 5);
  });
});
