export class GameLoop {
  constructor({ update, render }) {
    this.update = update;
    this.render = render;
    this.running = false;
    this.lastTime = 0;
    this.accumulator = 0;
    this.id = null;
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

    this.update(dt);
    this.render();

    this.id = requestAnimationFrame(this.tick);
  };
}
