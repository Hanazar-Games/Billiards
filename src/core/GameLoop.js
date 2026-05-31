import { settings } from './SettingsStore.js';

export class GameLoop {
  constructor({ update, render }) {
    this.update = update;
    this.render = render;
    this.running = false;
    this.lastTime = 0;
    this.accumulator = 0;
    this.id = null;
    this._errorCount = 0;
    this._maxErrors = 3;
    this._fpsLimitMs = 0;
    this._lastFrameTime = 0;
  }

  _getFrameIntervalMs() {
    const limit = settings.get('fpsLimit');
    if (limit === 'unlimited' || !limit) return 0;
    const fps = parseInt(limit, 10);
    return fps > 0 ? 1000 / fps : 0;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this._lastFrameTime = this.lastTime;
    this._fpsLimitMs = this._getFrameIntervalMs();
    this.tick();
  }

  stop() {
    this.running = false;
    if (this.id !== null) {
      cancelAnimationFrame(this.id);
      clearTimeout(this.id);
      this.id = null;
    }
  }

  tick = () => {
    if (!this.running) return;

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1); // cap at 100ms
    this.lastTime = now;

    // FPS limiter
    this._fpsLimitMs = this._getFrameIntervalMs();
    if (this._fpsLimitMs > 0) {
      const elapsed = now - this._lastFrameTime;
      if (elapsed < this._fpsLimitMs) {
        const delay = this._fpsLimitMs - elapsed;
        this.id = setTimeout(() => {
          if (!this.running) return;
          this.id = requestAnimationFrame(this.tick);
        }, delay);
        return;
      }
      this._lastFrameTime = now;
    }

    try {
      this.update(dt);
      this.render();
      this._errorCount = 0; // reset on success
    } catch (err) {
      console.error('GameLoop error:', err);
      this._errorCount++;
      if (this._errorCount >= this._maxErrors) {
        console.error(`GameLoop: ${this._maxErrors} consecutive errors, stopping.`);
        this.stop();
        return;
      }
    }

    this.id = requestAnimationFrame(this.tick);
  };
}
