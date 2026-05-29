/**
 * ShotReplay — Playback engine for recorded shots.
 *
 * Replays a recorded shot by interpolating ball positions from frame data.
 * Supports variable playback speed and pause.
 *
 * Playback speeds: 0.1x, 0.25x, 0.5x, 1.0x
 */
import { POCKETED_SENTINEL } from './ShotRecorder.js';
import { BALL } from '../config.js';

const SPEEDS = [0.1, 0.25, 0.5, 1.0];
// frameInterval is now per-replay (set in load)

export class ShotReplay {
  constructor(scene, ballsManager) {
    this.scene = scene;
    this.ballsManager = ballsManager;
    this.playing = false;
    this.paused = false;
    this.speedIndex = 3; // default 1.0x
    this.currentFrame = 0;
    this.frameCount = 0;
    this.frames = null;
    this.accumulator = 0;
    this.onComplete = null;
    this.onProgress = null; // callback(currentFrame, frameCount)
  }

  /** Load replay data and prepare for playback. */
  load(data) {
    if (!data || !data.frames || data.frameCount < 2) {
      this.frames = null;
      this.frameCount = 0;
      return false;
    }

    this.frames = new Float32Array(data.frames);
    this.frameCount = data.frameCount;
    this.frameRate = (typeof data.frameRate === 'number' && data.frameRate > 0 && isFinite(data.frameRate))
      ? data.frameRate : 20;
    this.frameInterval = 1 / this.frameRate;
    this.currentFrame = 0;
    this.accumulator = 0;
    this.speedIndex = 3;
    this.paused = false;
    this.playing = false;

    // Move all balls to frame 0
    this._applyFrame(0);
    return true;
  }

  /** Start playback. */
  play() {
    this.playing = true;
    this.paused = false;
  }

  /** Pause playback. */
  pause() {
    this.paused = true;
  }

  /** Resume from pause. */
  resume() {
    this.paused = false;
  }

  /** Stop playback and reset to start. */
  stop() {
    this.playing = false;
    this.paused = false;
    this.currentFrame = 0;
    this.accumulator = 0;
    this._applyFrame(0);
  }

  /** Toggle play/pause. */
  toggle() {
    if (!this.playing) {
      this.play();
    } else {
      this.paused = !this.paused;
    }
  }

  /** Set playback speed by index (0=0.1x, 1=0.25x, 2=0.5x, 3=1.0x). */
  setSpeed(index) {
    this.speedIndex = Math.max(0, Math.min(SPEEDS.length - 1, index));
  }

  /** Cycle to next speed. */
  nextSpeed() {
    this.speedIndex = (this.speedIndex + 1) % SPEEDS.length;
    return SPEEDS[this.speedIndex];
  }

  getSpeed() {
    return SPEEDS[this.speedIndex];
  }

  getSpeedLabel() {
    const s = SPEEDS[this.speedIndex];
    return s < 1 ? `${Math.round(s * 100)}%` : '1.0x';
  }

  /** Seek to a specific frame. */
  seek(frame) {
    this.currentFrame = Math.max(0, Math.min(this.frameCount - 1, Math.round(frame)));
    this.accumulator = this.currentFrame * (this.frameInterval || (1 / 60));
    this._applyFrame(this.currentFrame);
    if (this.onProgress) {
      this.onProgress(this.currentFrame, this.frameCount);
    }
  }

  /** Seek to a progress ratio (0.0 - 1.0). */
  seekRatio(ratio) {
    const clamped = Math.max(0, Math.min(1, ratio));
    this.seek(clamped * (this.frameCount - 1));
  }

  /** Update playback. Call every frame with dt. */
  update(dt) {
    if (!this.playing || this.paused || !this.frames) return;

    const speed = SPEEDS[this.speedIndex];
    this.accumulator += dt * speed;

    const interval = this.frameInterval || (1 / 60);
    const totalFrames = this.accumulator / interval;
    const frameIdx = Math.floor(totalFrames);
    const alpha = totalFrames - frameIdx;

    if (frameIdx >= this.frameCount - 1) {
      this.currentFrame = this.frameCount - 1;
      this._applyFrame(this.currentFrame);
      this.playing = false;
      if (this.onComplete) this.onComplete();
      if (this.onProgress) this.onProgress(this.currentFrame, this.frameCount);
      return;
    }

    this.currentFrame = frameIdx;
    this._applyInterpolated(this.currentFrame, alpha);
    if (this.onProgress) {
      this.onProgress(this.currentFrame, this.frameCount);
    }
  }

  _applyFrame(frameIdx) {
    if (!this.frames || !this.ballsManager) return;
    const base = frameIdx * 32; // 16 balls * 2 floats

    for (let i = 0; i < 16; i++) {
      const ball = this.ballsManager.balls[i];
      if (!ball) continue;

      const x = this.frames[base + i * 2];
      const z = this.frames[base + i * 2 + 1];

      if (x === POCKETED_SENTINEL && z === POCKETED_SENTINEL) {
        ball.mesh.visible = false;
        continue;
      }

      ball.mesh.visible = true;
      ball.mesh.position.x = x;
      ball.mesh.position.z = z;
      ball.mesh.position.y = BALL.radius;
    }
  }

  /** Apply frame with linear interpolation between current and next frame. */
  _applyInterpolated(frameIdx, alpha) {
    if (!this.frames || !this.ballsManager) return;
    const base1 = frameIdx * 32;
    const nextIdx = Math.min(frameIdx + 1, this.frameCount - 1);
    const base2 = nextIdx * 32;

    for (let i = 0; i < 16; i++) {
      const ball = this.ballsManager.balls[i];
      if (!ball) continue;

      const x1 = this.frames[base1 + i * 2];
      const z1 = this.frames[base1 + i * 2 + 1];
      const x2 = this.frames[base2 + i * 2];
      const z2 = this.frames[base2 + i * 2 + 1];

      if (x1 === POCKETED_SENTINEL && z1 === POCKETED_SENTINEL) {
        ball.mesh.visible = false;
        continue;
      }

      ball.mesh.visible = true;
      ball.mesh.position.x = x1 + (x2 - x1) * alpha;
      ball.mesh.position.z = z1 + (z2 - z1) * alpha;
      ball.mesh.position.y = BALL.radius;
    }
  }

  /** Get current progress ratio (0.0 - 1.0). */
  getProgress() {
    if (this.frameCount <= 1) return 0;
    return this.currentFrame / (this.frameCount - 1);
  }

  /** Get current time in seconds. */
  getCurrentTime() {
    return this.currentFrame * (this.frameInterval || (1 / 60));
  }

  /** Get total duration in seconds. */
  getDuration() {
    return this.frameCount * (this.frameInterval || (1 / 60));
  }
}
