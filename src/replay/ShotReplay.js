/**
 * ShotReplay — Playback engine for recorded shots.
 *
 * Replays a recorded shot by interpolating ball positions from frame data.
 * Supports variable playback speed and pause.
 *
 * Playback speeds: 0.1x, 0.25x, 0.5x, 1.0x
 */
const SPEEDS = [0.1, 0.25, 0.5, 1.0];
const FRAME_INTERVAL = 0.05; // original recording interval = 50ms

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
    if (!data || !data.frames || data.frameCount < 2) return false;

    this.frames = new Float32Array(data.frames);
    this.frameCount = data.frameCount;
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
    this._applyFrame(this.currentFrame);
    if (this.onProgress) {
      this.onProgress(this.currentFrame, this.frameCount);
    }
  }

  /** Seek to a progress ratio (0.0 - 1.0). */
  seekRatio(ratio) {
    this.seek(ratio * (this.frameCount - 1));
  }

  /** Update playback. Call every frame with dt. */
  update(dt) {
    if (!this.playing || this.paused || !this.frames) return;

    const speed = SPEEDS[this.speedIndex];
    this.accumulator += dt * speed;

    while (this.accumulator >= FRAME_INTERVAL) {
      this.accumulator -= FRAME_INTERVAL;
      this.currentFrame++;

      if (this.currentFrame >= this.frameCount) {
        this.currentFrame = this.frameCount - 1;
        this._applyFrame(this.currentFrame);
        this.playing = false;
        if (this.onComplete) this.onComplete();
        if (this.onProgress) this.onProgress(this.currentFrame, this.frameCount);
        return;
      }

      this._applyFrame(this.currentFrame);
      if (this.onProgress) {
        this.onProgress(this.currentFrame, this.frameCount);
      }
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

      // Zeroed position after frame 0 means ball was pocketed during recording.
      // In the original game, pocketed balls have mesh.visible = false.
      if (x === 0 && z === 0 && frameIdx > 0) {
        ball.mesh.visible = false;
        continue;
      }

      ball.mesh.visible = true;
      ball.mesh.position.x = x;
      ball.mesh.position.z = z;
    }
  }

  /** Get current progress ratio (0.0 - 1.0). */
  getProgress() {
    if (this.frameCount <= 1) return 0;
    return this.currentFrame / (this.frameCount - 1);
  }

  /** Get current time in seconds. */
  getCurrentTime() {
    return this.currentFrame * FRAME_INTERVAL;
  }

  /** Get total duration in seconds. */
  getDuration() {
    return this.frameCount * FRAME_INTERVAL;
  }
}
