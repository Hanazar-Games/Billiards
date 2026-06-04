/**
 * ShotAnalyzer — Physics analysis engine for recorded shots.
 *
 * Takes ShotRecorder output and computes:
 *   - Path smoothness & efficiency
 *   - Collision angles & energy transfer
 *   - Pocket accuracy
 *   - Overall shot quality score (0-100)
 *   - Improvement suggestions
 */

import { POCKETED_SENTINEL, BALL_COUNT, FLOATS_PER_FRAME } from '../replay/ShotRecorder.js';

/** Compute angle between two 2D vectors (in degrees). */
function angleBetween(ax, az, bx, bz) {
  const dot = ax * bx + az * bz;
  const magA = Math.sqrt(ax * ax + az * az);
  const magB = Math.sqrt(bx * bx + bz * bz);
  if (magA === 0 || magB === 0) return 0;
  const cos = Math.max(-1, Math.min(1, dot / (magA * magB)));
  return Math.acos(cos) * (180 / Math.PI);
}

/** Distance between two 2D points. */
function dist(x1, z1, x2, z2) {
  const dx = x1 - x2;
  const dz = z1 - z2;
  return Math.sqrt(dx * dx + dz * dz);
}

function isPocketedSentinel(x, z) {
  return x === POCKETED_SENTINEL && z === POCKETED_SENTINEL;
}

export class ShotAnalyzer {
  /**
   * Analyze recorded shot data.
   * @param {Object} replayData — output from ShotRecorder.getReplayData()
   * @param {Object} options
   * @param {Array} options.pocketPositions — [{x, z}, ...] 6 pockets
   * @param {number} options.tableWidth — play area width
   * @param {number} options.tableDepth — play area depth
   * @param {number} options.ballRadius — ball radius
   * @returns {Object} analysis result
   */
  static analyze(replayData, options = {}) {
    if (!replayData || !replayData.frames || replayData.frameCount < 2) {
      return null;
    }

    const frames = new Float32Array(replayData.frames);
    const frameCount = replayData.frameCount;
    const expectedLen = frameCount * FLOATS_PER_FRAME;
    if (frames.length < expectedLen) {
      return null;
    }
    // Guard against NaN/Inf in frame data (allow sentinel)
    for (let i = 0; i < expectedLen; i++) {
      const v = frames[i];
      if (Number.isNaN(v) || v === Infinity || v === -Infinity) {
        return null;
      }
    }
    const frameRate = (Number.isFinite(replayData.frameRate) && replayData.frameRate > 0)
      ? replayData.frameRate : 60;
    const meta = replayData.metadata || {};
    const pocketPositions = Array.isArray(options.pocketPositions) ? options.pocketPositions : [];
    const ballRadius = Number.isFinite(options.ballRadius) && options.ballRadius > 0
      ? options.ballRadius : 1;

    const analysis = {
      metadata: {
        mode: String(meta.mode || 'unknown'),
        power: Math.max(0, Number.isFinite(meta.maxPower) ? meta.maxPower : 0),
        spinUsed: Boolean(meta.spinUsed),
        duration: Math.max(0, Number.isFinite(meta.duration) ? meta.duration : 0),
        pocketedIds: Array.isArray(meta.pocketedIds)
          ? meta.pocketedIds.filter((id) => Number.isFinite(id))
          : [],
        collisionCount: Math.max(0, Number.isFinite(meta.collisionCount) ? meta.collisionCount : 0),
        cushionCount: Math.max(0, Number.isFinite(meta.cushionCount) ? meta.cushionCount : 0),
        tableProfileId: meta.tableProfileId != null ? String(meta.tableProfileId) : null,
      },
      paths: [],          // per-ball path data
      collisions: [],     // detected collision events
      pockets: [],        // detected pocket events
      score: 0,           // overall 0-100
      breakdown: {        // score components
        accuracy: 0,      // pocket precision
        efficiency: 0,    // path directness
        control: 0,       // cue ball behavior
        difficulty: 0,    // shot complexity bonus
      },
      suggestions: [],    // human-readable tips
    };

    // ── 1. Extract per-ball paths ──
    for (let b = 0; b < BALL_COUNT; b++) {
      const path = [];
      let wasPocketed = false;
      for (let f = 0; f < frameCount; f++) {
        const base = f * FLOATS_PER_FRAME + b * 2;
        const x = frames[base];
        const z = frames[base + 1];
        if (isPocketedSentinel(x, z)) {
          if (!wasPocketed && path.length > 0) {
            // Mark pocket frame
            path[path.length - 1].pocketed = true;
            wasPocketed = true;
          }
          continue;
        }
        path.push({ x, z, frame: f });
      }
      analysis.paths.push({
        ballId: b,
        points: path,
        pocketed: wasPocketed,
        totalDistance: ShotAnalyzer._computePathDistance(path),
      });
    }

    // ── 2. Detect collisions from path discontinuities ──
    analysis.collisions = ShotAnalyzer._detectCollisions(frames, frameCount, ballRadius, frameRate);

    // ── 3. Detect pocket events with timing ──
    analysis.pockets = ShotAnalyzer._detectPockets(analysis.paths, pocketPositions, ballRadius, frameRate);

    // ── 4. Score calculation ──
    ShotAnalyzer._computeScore(analysis, pocketPositions, ballRadius);

    // ── 5. Generate suggestions ──
    analysis.suggestions = ShotAnalyzer._generateSuggestions(analysis);

    return analysis;
  }

  /** Compute total distance of a path. */
  static _computePathDistance(points) {
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      total += dist(points[i - 1].x, points[i - 1].z, points[i].x, points[i].z);
    }
    return total;
  }

  /**
   * Detect collisions by looking for sudden direction changes.
   * Also detects ball-ball proximity events.
   */
  static _detectCollisions(frames, frameCount, ballRadius, frameRate = 60) {
    const collisions = [];
    const threshold = ballRadius * 1.8; // slightly less than 2R for proximity

    for (let f = 1; f < frameCount; f++) {
      const prevBase = (f - 1) * FLOATS_PER_FRAME;
      const base = f * FLOATS_PER_FRAME;

      for (let a = 0; a < BALL_COUNT; a++) {
        const ax = frames[base + a * 2];
        const az = frames[base + a * 2 + 1];
        if (isPocketedSentinel(ax, az)) continue;

        for (let b = a + 1; b < BALL_COUNT; b++) {
          const bx = frames[base + b * 2];
          const bz = frames[base + b * 2 + 1];
          if (isPocketedSentinel(bx, bz)) continue;

          const d = dist(ax, az, bx, bz);
          if (d < threshold) {
            // Check if this is a new collision (not already recorded at ~same time)
            const isNew = collisions.every((c) => {
              if (c.type !== 'ball-ball') return true;
              if (!((c.ballA === a && c.ballB === b) || (c.ballA === b && c.ballB === a))) return true;
              return Math.abs(c.frame - f) > 3; // at least 3 frames apart
            });

            if (isNew) {
              // Compute approach angle
              const aPrevX = frames[prevBase + a * 2];
              const aPrevZ = frames[prevBase + a * 2 + 1];
              const bPrevX = frames[prevBase + b * 2];
              const bPrevZ = frames[prevBase + b * 2 + 1];

              // Defensive: skip if prev frame has sentinel (shouldn't happen with
              // current ShotRecorder, but guards against corrupted/malformed data)
              if (isPocketedSentinel(aPrevX, aPrevZ) || isPocketedSentinel(bPrevX, bPrevZ)) continue;

              const aVx = ax - aPrevX;
              const aVz = az - aPrevZ;
              const bVx = bx - bPrevX;
              const bVz = bz - bPrevZ;

              // Line of centers at collision
              const cx = bx - ax;
              const cz = bz - az;

              const impactAngle = angleBetween(aVx, aVz, cx, cz);

              collisions.push({
                type: 'ball-ball',
                frame: f,
                time: f / frameRate,
                ballA: a,
                ballB: b,
                position: { x: (ax + bx) / 2, z: (az + bz) / 2 },
                impactAngle: Math.round(impactAngle),
                separation: d,
              });
            }
          }
        }
      }
    }

    return collisions.sort((a, b) => a.frame - b.frame);
  }

  /** Detect pocket entries with approximate timing. */
  static _detectPockets(paths, pocketPositions, ballRadius, frameRate = 60) {
    const pockets = [];
    if (!pocketPositions || pocketPositions.length === 0) return pockets;

    for (let b = 1; b < BALL_COUNT; b++) { // skip cue ball (0)
      const path = paths[b];
      if (!path || !path.pocketed || path.points.length === 0) continue;

      // The last valid position before pocketing is near the pocket
      const lastPoint = path.points[path.points.length - 1];
      if (!lastPoint) continue;

      // Find nearest pocket
      let nearestIdx = -1;
      let nearestDist = Infinity;
      for (let p = 0; p < pocketPositions.length; p++) {
        const pd = dist(lastPoint.x, lastPoint.z, pocketPositions[p].x, pocketPositions[p].z);
        if (pd < nearestDist) {
          nearestDist = pd;
          nearestIdx = p;
        }
      }

      if (nearestIdx >= 0) {
        pockets.push({
          ballId: b,
          pocketIndex: nearestIdx,
          frame: lastPoint.frame,
          time: lastPoint.frame / frameRate,
          position: { x: lastPoint.x, z: lastPoint.z },
          pocketPosition: pocketPositions[nearestIdx],
          accuracy: Math.max(0, Math.round((1 - nearestDist / (ballRadius * 3)) * 100)),
        });
      }
    }

    return pockets.sort((a, b) => a.frame - b.frame);
  }

  /** Compute overall shot quality score (0-100). */
  static _computeScore(analysis, pocketPositions, ballRadius) {
    const meta = analysis.metadata;
    const paths = analysis.paths;
    const collisions = analysis.collisions;
    const pockets = analysis.pockets;

    let accuracy = 0;
    let efficiency = 0;
    let control = 0;
    let difficulty = 0;

    // ── Accuracy: pocket precision ──
    if (pockets.length > 0) {
      const avgAccuracy = pockets.reduce((s, p) => s + (Number.isFinite(p.accuracy) ? p.accuracy : 0), 0) / pockets.length;
      accuracy = 30 + avgAccuracy * 0.4;
      // Bonus for multiple pockets
      if (pockets.length >= 2) accuracy += 10;
      if (pockets.length >= 3) accuracy += 10;
    } else {
      accuracy = 10; // minimum for attempting
    }

    // ── Efficiency: path directness ──
    const cuePath = paths[0];
    if (cuePath && cuePath.points.length > 1 && Number.isFinite(cuePath.totalDistance)) {
      const start = cuePath.points[0];
      const end = cuePath.points[cuePath.points.length - 1];
      const straightDist = dist(start.x, start.z, end.x, end.z);
      const pathRatio = Math.min(1, straightDist / (cuePath.totalDistance + 0.001));
      // Higher ratio = straighter path = more efficient
      efficiency = 20 + pathRatio * 40;
      // Cap if too many cushions (indicates excessive bouncing)
      if (meta.cushionCount > 3) efficiency -= (meta.cushionCount - 3) * 5;
    }

    // ── Control: cue ball behavior ──
    // Good control = cue ball doesn't scratch and stops reasonably
    const cuePocketed = meta.pocketedIds.includes(0);
    if (!cuePocketed) {
      control += 25;
      // Bonus for short cue ball travel (good position play)
      const cuePath = paths[0];
      if (cuePath && Number.isFinite(cuePath.totalDistance)) {
        if (cuePath.totalDistance < 150) control += 15;
        else if (cuePath.totalDistance < 300) control += 8;
      }
    }
    // Spin usage = controlled play
    if (meta.spinUsed) control += 10;

    // ── Difficulty bonus ──
    if (meta.collisionCount >= 3) difficulty += 5;
    if (meta.cushionCount >= 2) difficulty += 5;
    if (meta.spinUsed) difficulty += 5;
    if (meta.power >= 70) difficulty += 5;
    if (pockets.length >= 2) difficulty += 10;

    analysis.breakdown.accuracy = Math.max(0, Math.min(100, Math.round(accuracy || 0)));
    analysis.breakdown.efficiency = Math.max(0, Math.min(100, Math.round(efficiency || 0)));
    analysis.breakdown.control = Math.max(0, Math.min(100, Math.round(control || 0)));
    analysis.breakdown.difficulty = Math.max(0, Math.min(100, Math.round(difficulty || 0)));

    // Weighted total
    analysis.score = Math.round(
      analysis.breakdown.accuracy * 0.35 +
      analysis.breakdown.efficiency * 0.25 +
      analysis.breakdown.control * 0.25 +
      analysis.breakdown.difficulty * 0.15
    );
  }

  /** Generate improvement suggestions. */
  static _generateSuggestions(analysis) {
    const suggestions = [];
    const meta = analysis.metadata;
    const bd = analysis.breakdown;

    if (meta.pocketedIds.length === 0 || (meta.pocketedIds.length === 1 && meta.pocketedIds[0] === 0)) {
      suggestions.push('未进球 — 尝试调整瞄准点，使用辅助线确认球路');
    }

    if (meta.pocketedIds.includes(0)) {
      suggestions.push('母球落袋 — 注意控制力度，尝试使用低杆或减小力量');
    }

    if (bd.accuracy < 40 && meta.pocketedIds.filter(id => id !== 0).length > 0) {
      suggestions.push('进球角度偏差较大 — 练习薄球和角度球精准度');
    }

    if (bd.efficiency < 40) {
      suggestions.push('球路曲折 — 尝试更直接的进攻路线，减少不必要的库边反弹');
    }

    if (bd.control < 40) {
      suggestions.push('母球控制欠佳 — 练习走位，击球后留意母球停留位置');
    }

    if (!meta.spinUsed && bd.control < 60) {
      suggestions.push('未使用旋转 — 尝试高杆/低杆来控制母球走位');
    }

    if (meta.power > 85 && meta.cushionCount > 2) {
      suggestions.push('力度过大导致乱弹 — 尝试中等力度，让球局更可控');
    }

    if (meta.collisionCount === 0 && meta.pocketedIds.filter(id => id !== 0).length === 0) {
      suggestions.push('未碰到任何球 — 检查瞄准方向，确保母球能击中目标');
    }

    // Positive feedback
    if (bd.accuracy >= 80 && bd.control >= 70) {
      suggestions.push('🎯 出色的击球！精准度和母球控制都很优秀');
    }

    if (suggestions.length === 0) {
      suggestions.push('稳定的击球 — 继续保持！');
    }

    return suggestions;
  }

  /** Get a human-readable summary string. */
  static getSummaryText(analysis) {
    if (!analysis || !analysis.metadata) return '';
    const meta = analysis.metadata;
    const parts = [];
    const pocketedIds = Array.isArray(meta.pocketedIds) ? meta.pocketedIds : [];
    const nonCuePocketed = pocketedIds.filter(id => id !== 0).length;
    if (nonCuePocketed > 0) parts.push(`进球 ${nonCuePocketed}`);
    parts.push(`碰撞 ${meta.collisionCount || 0}`);
    parts.push(`库边 ${meta.cushionCount || 0}`);
    parts.push(`评分 ${Number.isFinite(analysis.score) ? analysis.score : 0}`);
    return parts.join(' · ');
  }
}
