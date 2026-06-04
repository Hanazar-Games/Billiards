/**
 * ShotRecorder — Records every frame of a shot for playback.
 *
 * Records at 60fps (~16.67ms intervals) for up to 18 seconds (1080 frames).
 * Each frame stores X/Z position of all 16 balls as a flat Float32Array.
 *
 * Data format:
 *   frames: Float32Array[frameCount * 16 * 2]
 *     index = frameIdx * 32 + ballId * 2     → x
 *     index = frameIdx * 32 + ballId * 2 + 1 → z
 *   metadata: { startTime, endTime, mode, tableProfileId, pocketedIds[], collisionCount,
 *               cushionCount, spinUsed, maxPower, duration }
 */
const MAX_FRAMES = 1080; // 18 seconds @ 60fps
const FRAME_INTERVAL = 1 / 60; // ~16.67ms
export const BALL_COUNT = 16;
export const FLOATS_PER_FRAME = BALL_COUNT * 2; // x, z for each ball
export const POCKETED_SENTINEL = 999999;

export class ShotRecorder {
  constructor() {
    this.recording = false;
    this.frames = null;
    this.frameIndex = 0;
    this.accumulator = 0;
    this.metadata = null;
  }

  /** Start recording a new shot. Call when the cue ball is struck. */
  start(ballsManager, mode, power, spin, tableProfileId = null) {
    this.recording = true;
    this.frames = new Float32Array(MAX_FRAMES * FLOATS_PER_FRAME);
    this.frameIndex = 0;
    this.accumulator = 0;
    const safePower = Number.isFinite(power) ? Math.max(0, power) : 0;
    const sx = spin?.x ?? 0;
    const sy = spin?.y ?? 0;
    this.metadata = {
      startTime: performance.now(),
      endTime: null,
      mode: mode || 'unknown',
      tableProfileId: tableProfileId || null,
      pocketedIds: [],
      collisionCount: 0,
      cushionCount: 0,
      spinUsed: Math.abs(sx) > 0.05 || Math.abs(sy) > 0.05,
      maxPower: safePower,
      duration: 0,
    };
    // Record first frame immediately
    this._recordFrame(ballsManager);
  }

  /** Call every frame during SHOOTING state. Returns true if still recording. */
  update(dt, ballsManager) {
    if (!this.recording) return false;
    if (this.frameIndex >= MAX_FRAMES) {
      this.stop();
      return false;
    }

    this.accumulator += dt;
    while (this.accumulator >= FRAME_INTERVAL) {
      this.accumulator -= FRAME_INTERVAL;
      this._recordFrame(ballsManager);
      if (this.frameIndex >= MAX_FRAMES) {
        this.stop();
        return false;
      }
    }
    return true;
  }

  _recordFrame(ballsManager) {
    const base = this.frameIndex * FLOATS_PER_FRAME;
    for (let i = 0; i < BALL_COUNT; i++) {
      const ball = ballsManager.balls[i];
      if (ball && ball.mesh) {
        if (ball.pocketed || !ball.mesh.visible) {
          this.frames[base + i * 2] = POCKETED_SENTINEL;
          this.frames[base + i * 2 + 1] = POCKETED_SENTINEL;
        } else {
          const x = ball.mesh.position.x;
          const z = ball.mesh.position.z;
          // Defensive: guard against NaN/Inf from physics corruption
          if (!Number.isFinite(x) || !Number.isFinite(z)) {
            this.frames[base + i * 2] = POCKETED_SENTINEL;
            this.frames[base + i * 2 + 1] = POCKETED_SENTINEL;
          } else {
            this.frames[base + i * 2] = x;
            this.frames[base + i * 2 + 1] = z;
          }
        }
      } else {
        this.frames[base + i * 2] = 0;
        this.frames[base + i * 2 + 1] = 0;
      }
    }
    this.frameIndex++;
  }

  /** Stop recording. Call when all balls have stopped. */
  stop() {
    if (!this.recording) return;
    this.recording = false;
    this.metadata.endTime = performance.now();
    const dur = (this.metadata.endTime - this.metadata.startTime) / 1000;
    this.metadata.duration = Number.isFinite(dur) && dur >= 0 ? dur : 0;
  }

  /** Record a pocketed ball ID. */
  recordPocket(ballId) {
    if (!this.recording) return;
    if (!this.metadata.pocketedIds.includes(ballId)) {
      this.metadata.pocketedIds.push(ballId);
    }
  }

  /** Record a ball-ball collision. */
  recordCollision() {
    if (!this.recording) return;
    this.metadata.collisionCount++;
  }

  /** Record a ball-cushion collision. */
  recordCushion() {
    if (!this.recording) return;
    this.metadata.cushionCount++;
  }

  /**
   * Calculate excitement score (0-100) for this shot.
   * Higher = more interesting, worth saving for replay.
   */
  calculateScore() {
    const m = this.metadata;
    if (!m || this.frameIndex < 3) return 0;

    let score = 0;

    // Pocketed balls (excluding cue ball)
    const nonCue = (m.pocketedIds || []).filter((id) => id !== 0).length;
    score += nonCue * 20;

    // Collisions
    score += Math.min(Math.max(0, m.collisionCount || 0), 10) * 3;

    // Cushion hits
    score += Math.min(Math.max(0, m.cushionCount || 0), 8) * 2;

    // Spin used
    if (m.spinUsed) score += 10;

    // High power
    if ((m.maxPower || 0) >= 80) score += 5;

    // Duration (longer = more happened)
    if ((m.duration || 0) > 5) score += 5;

    return Math.min(100, Math.round(score));
  }

  /** Get the recorded data as a serializable object. */
  getReplayData() {
    if (this.frameIndex < 2) return null;

    // Trim unused frames
    const usedFloats = this.frameIndex * FLOATS_PER_FRAME;
    const trimmedFrames = this.frames.slice(0, usedFloats);

    // Final validation: ensure no NaN/Inf in trimmed data
    for (let i = 0; i < trimmedFrames.length; i++) {
      if (!Number.isFinite(trimmedFrames[i])) {
        trimmedFrames[i] = POCKETED_SENTINEL;
      }
    }

    return {
      metadata: { ...this.metadata },
      frames: Array.from(trimmedFrames),
      frameCount: this.frameIndex,
      frameRate: 60,
      score: this.calculateScore(),
    };
  }

  /**
   * Validate externally-loaded replay data.
   * Returns true if data is structurally sound and safe to load.
   */
  static validateReplayData(data) {
    if (!data || typeof data !== 'object') return false;
    if (!Array.isArray(data.frames)) return false;
    const fc = Number(data.frameCount);
    if (!Number.isFinite(fc) || fc < 2 || fc > MAX_FRAMES) return false;
    const expectedLen = fc * FLOATS_PER_FRAME;
    if (data.frames.length < expectedLen) return false;
    // Check for NaN/Inf in frame data (allow sentinel)
    for (let i = 0; i < expectedLen; i++) {
      const v = data.frames[i];
      if (Number.isNaN(v) || v === Infinity || v === -Infinity) return false;
    }
    if (!data.metadata || typeof data.metadata !== 'object') return false;
    return true;
  }

  /** Reset for next shot. */
  reset() {
    this.recording = false;
    this.frames = null;
    this.frameIndex = 0;
    this.accumulator = 0;
    this.metadata = null;
  }
}
