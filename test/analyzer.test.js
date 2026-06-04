import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ShotAnalyzer } from '../src/analyzer/ShotAnalyzer.js';
import { POCKETED_SENTINEL } from '../src/replay/ShotRecorder.js';

const BALL_COUNT = 16;
const FLOATS_PER_FRAME = BALL_COUNT * 2;

/** Build fake replay data for testing. */
function makeReplayData(opts = {}) {
  const frameCount = opts.frameCount || 10;
  const frames = new Float32Array(frameCount * FLOATS_PER_FRAME);

  // Fill with default positions
  for (let f = 0; f < frameCount; f++) {
    for (let b = 0; b < BALL_COUNT; b++) {
      const base = f * FLOATS_PER_FRAME + b * 2;
      // Cue ball moves along Z, target ball stays near origin
      if (b === 0) {
        frames[base] = 0;
        frames[base + 1] = -50 + f * 10;
      } else if (b === 1) {
        frames[base] = 0;
        frames[base + 1] = 0;
      } else {
        frames[base] = 100 + b * 5;
        frames[base + 1] = 100 + b * 5;
      }
    }
  }

  // Pocket ball 1 at frame 5
  if (opts.pocketBall1 !== false) {
    for (let f = 5; f < frameCount; f++) {
      frames[f * FLOATS_PER_FRAME + 1 * 2] = POCKETED_SENTINEL;
      frames[f * FLOATS_PER_FRAME + 1 * 2 + 1] = POCKETED_SENTINEL;
    }
  }

  return {
    metadata: {
      mode: opts.mode || '8ball',
      maxPower: opts.power || 50,
      spinUsed: opts.spinUsed || false,
      duration: opts.duration || 1.5,
      pocketedIds: opts.pocketedIds || [1],
      collisionCount: opts.collisionCount || 1,
      cushionCount: opts.cushionCount || 0,
      tableProfileId: opts.tableProfileId || 'pool9ft',
    },
    frames: Array.from(frames),
    frameCount,
    frameRate: 60,
    score: opts.score || 40,
  };
}

const DEFAULT_TABLE_INFO = {
  width: 254,
  depth: 127,
  ballRadius: 2.8575,
  pocketPositions: [
    { x: -127, z: -63.5 },
    { x: 127, z: -63.5 },
    { x: -127, z: 0 },
    { x: 127, z: 0 },
    { x: -127, z: 63.5 },
    { x: 127, z: 63.5 },
  ],
};

describe('ShotAnalyzer', () => {
  it('returns null for invalid data', () => {
    assert.strictEqual(ShotAnalyzer.analyze(null), null);
    assert.strictEqual(ShotAnalyzer.analyze({ frames: [], frameCount: 0 }), null);
    assert.strictEqual(ShotAnalyzer.analyze({ frames: [1, 2], frameCount: 1 }), null);
  });

  it('analyzes a basic shot with pocket', () => {
    const data = makeReplayData();
    const analysis = ShotAnalyzer.analyze(data, DEFAULT_TABLE_INFO);
    assert.ok(analysis);
    assert.ok(analysis.metadata);
    assert.strictEqual(analysis.metadata.mode, '8ball');
    assert.strictEqual(analysis.metadata.power, 50);
    assert.strictEqual(analysis.metadata.spinUsed, false);
    assert.strictEqual(analysis.metadata.pocketedIds.length, 1);
  });

  it('extracts ball paths correctly', () => {
    const data = makeReplayData({ frameCount: 10 });
    const analysis = ShotAnalyzer.analyze(data, DEFAULT_TABLE_INFO);
    assert.ok(analysis.paths);
    assert.strictEqual(analysis.paths.length, 16);
    // Cue ball has path points
    assert.ok(analysis.paths[0].points.length > 0);
    // Ball 1 should be marked pocketed
    assert.strictEqual(analysis.paths[1].pocketed, true);
  });

  it('detects ball-ball collisions', () => {
    // Create a scenario where cue ball (0) approaches ball 1 and collides
    const frameCount = 10;
    const frames = new Float32Array(frameCount * FLOATS_PER_FRAME);
    for (let f = 0; f < frameCount; f++) {
      for (let b = 0; b < BALL_COUNT; b++) {
        const base = f * FLOATS_PER_FRAME + b * 2;
        if (b === 0) {
          // Cue ball moves from (-10, -10) toward origin
          frames[base] = -10 + f * 2;
          frames[base + 1] = -10 + f * 2;
        } else if (b === 1) {
          frames[base] = 0;
          frames[base + 1] = 0;
        } else {
          // Spread other balls far apart to avoid spurious collisions
          frames[base] = 200 + b * 30;
          frames[base + 1] = 200 + b * 20;
        }
      }
    }
    // Pocket ball 1 after collision
    for (let f = 6; f < frameCount; f++) {
      frames[f * FLOATS_PER_FRAME + 1 * 2] = POCKETED_SENTINEL;
      frames[f * FLOATS_PER_FRAME + 1 * 2 + 1] = POCKETED_SENTINEL;
    }

    const data = {
      metadata: {
        mode: '8ball', maxPower: 60, spinUsed: false, duration: 1.0,
        pocketedIds: [1], collisionCount: 1, cushionCount: 0,
      },
      frames: Array.from(frames),
      frameCount,
      frameRate: 60,
      score: 40,
    };

    const analysis = ShotAnalyzer.analyze(data, DEFAULT_TABLE_INFO);
    assert.ok(analysis.collisions.length > 0, 'should detect at least one collision');
    const bb = analysis.collisions.find(c => c.type === 'ball-ball' && c.ballA === 0 && c.ballB === 1);
    assert.ok(bb, 'should have a ball-ball collision between 0 and 1');
    assert.ok(typeof bb.impactAngle === 'number');
  });

  it('detects pocket events', () => {
    const data = makeReplayData({ pocketedIds: [1, 5] });
    // Mark ball 5 as pocketed too
    for (let f = 7; f < 10; f++) {
      data.frames[f * FLOATS_PER_FRAME + 5 * 2] = POCKETED_SENTINEL;
      data.frames[f * FLOATS_PER_FRAME + 5 * 2 + 1] = POCKETED_SENTINEL;
    }

    const analysis = ShotAnalyzer.analyze(data, DEFAULT_TABLE_INFO);
    assert.ok(analysis.pockets.length >= 1);
    const p1 = analysis.pockets.find(p => p.ballId === 1);
    assert.ok(p1);
    assert.ok(typeof p1.accuracy === 'number');
  });

  it('computes score breakdown', () => {
    const data = makeReplayData({ power: 80, spinUsed: true, collisionCount: 3, cushionCount: 2 });
    const analysis = ShotAnalyzer.analyze(data, DEFAULT_TABLE_INFO);
    assert.ok(analysis.score >= 0 && analysis.score <= 100);
    assert.ok(analysis.breakdown.accuracy >= 0 && analysis.breakdown.accuracy <= 100);
    assert.ok(analysis.breakdown.efficiency >= 0 && analysis.breakdown.efficiency <= 100);
    assert.ok(analysis.breakdown.control >= 0 && analysis.breakdown.control <= 100);
    assert.ok(analysis.breakdown.difficulty >= 0 && analysis.breakdown.difficulty <= 100);
  });

  it('generates suggestions for missed shot', () => {
    const data = makeReplayData({ pocketedIds: [], pocketBall1: false });
    const analysis = ShotAnalyzer.analyze(data, DEFAULT_TABLE_INFO);
    assert.ok(analysis.suggestions.length > 0);
    const hasMissTip = analysis.suggestions.some(s => s.includes('未进球'));
    assert.ok(hasMissTip, 'should suggest something about missing');
  });

  it('generates positive feedback for excellent shot', () => {
    const data = makeReplayData({
      power: 50, spinUsed: true,
      pocketedIds: [1, 2, 3],
      collisionCount: 5, cushionCount: 1,
    });
    const analysis = ShotAnalyzer.analyze(data, DEFAULT_TABLE_INFO);
    // High pocket count + spin + multiple collisions should yield decent score
    assert.ok(analysis.score >= 40, `score should be decent, got ${analysis.score}`);
    // With good accuracy and control, should get positive feedback
    if (analysis.breakdown.accuracy >= 70 && analysis.breakdown.control >= 60) {
      const hasPositive = analysis.suggestions.some(s => s.includes('出色'));
      assert.ok(hasPositive, 'should have positive feedback for excellent shot');
    }
  });

  it('suggests spin for poor control', () => {
    const data = makeReplayData({ spinUsed: false, pocketedIds: [0, 1], power: 90 });
    const analysis = ShotAnalyzer.analyze(data, DEFAULT_TABLE_INFO);
    const hasSpinTip = analysis.suggestions.some(s => s.includes('旋转'));
    assert.ok(hasSpinTip, 'should suggest using spin');
  });

  it('getSummaryText returns readable string', () => {
    const data = makeReplayData();
    const analysis = ShotAnalyzer.analyze(data, DEFAULT_TABLE_INFO);
    const summary = ShotAnalyzer.getSummaryText(analysis);
    assert.ok(typeof summary === 'string');
    assert.ok(summary.length > 0);
    assert.ok(summary.includes('进球'));
  });

  it('handles empty pocket positions gracefully', () => {
    const data = makeReplayData();
    const analysis = ShotAnalyzer.analyze(data, { width: 100, depth: 50, ballRadius: 2 });
    assert.ok(analysis);
    assert.strictEqual(analysis.pockets.length, 0);
  });

  it('returns null for NaN in frame data', () => {
    const data = makeReplayData({ frameCount: 10 });
    data.frames[5] = NaN;
    assert.strictEqual(ShotAnalyzer.analyze(data, DEFAULT_TABLE_INFO), null);
  });

  it('returns null for Infinity in frame data', () => {
    const data = makeReplayData({ frameCount: 10 });
    data.frames[5] = Infinity;
    assert.strictEqual(ShotAnalyzer.analyze(data, DEFAULT_TABLE_INFO), null);
  });

  it('returns null when frames length < expected', () => {
    const data = makeReplayData({ frameCount: 10 });
    data.frames = data.frames.slice(0, 20);
    assert.strictEqual(ShotAnalyzer.analyze(data, DEFAULT_TABLE_INFO), null);
  });

  it('normalizes corrupted metadata', () => {
    const data = makeReplayData();
    data.metadata.maxPower = NaN;
    data.metadata.duration = -5;
    data.metadata.collisionCount = 'oops';
    data.metadata.pocketedIds = [1, NaN, 2, 'bad'];
    const analysis = ShotAnalyzer.analyze(data, DEFAULT_TABLE_INFO);
    assert.ok(analysis);
    assert.strictEqual(analysis.metadata.power, 0);
    assert.strictEqual(analysis.metadata.duration, 0);
    assert.strictEqual(analysis.metadata.collisionCount, 0);
    assert.deepStrictEqual(analysis.metadata.pocketedIds, [1, 2]);
  });

  it('getSummaryText returns empty string for null', () => {
    assert.strictEqual(ShotAnalyzer.getSummaryText(null), '');
    assert.strictEqual(ShotAnalyzer.getSummaryText({}), '');
  });

  it('score breakdown clamps to 0-100 even with weird data', () => {
    const data = makeReplayData({ power: NaN, collisionCount: -10, cushionCount: 999 });
    const analysis = ShotAnalyzer.analyze(data, DEFAULT_TABLE_INFO);
    assert.ok(analysis);
    assert.ok(analysis.breakdown.accuracy >= 0 && analysis.breakdown.accuracy <= 100);
    assert.ok(analysis.breakdown.efficiency >= 0 && analysis.breakdown.efficiency <= 100);
    assert.ok(analysis.breakdown.control >= 0 && analysis.breakdown.control <= 100);
    assert.ok(analysis.breakdown.difficulty >= 0 && analysis.breakdown.difficulty <= 100);
    assert.ok(analysis.score >= 0 && analysis.score <= 100);
  });
});
