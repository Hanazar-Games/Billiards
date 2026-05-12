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
  }

  start() {
    this.running = true;
    this.lastTime = performance.now();
    this.tick();
  }

  stop() {
    this.running = false;
    if (this.id !== null) {
      cancelAnimationFrame(this.id);
      this.id = null;
    }
  }

  tick = () => {
    if (!this.running) return;

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1); // cap at 100ms
    this.lastTime = now;

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
