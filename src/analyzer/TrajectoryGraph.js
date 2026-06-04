/**
 * TrajectoryGraph — Interactive Canvas 2D top-down trajectory visualizer.
 *
 * Renders:
 *   - Table outline with cushions
 *   - Pockets
 *   - Per-ball trajectories (colored paths)
 *   - Collision markers (numbered)
 *   - Playback scrubber
 *
 * Supports pan/zoom and animated playback.
 */

import { POCKETED_SENTINEL, BALL_COUNT, FLOATS_PER_FRAME } from '../replay/ShotRecorder.js';

// BALL_COUNT and FLOATS_PER_FRAME imported from ShotRecorder.js

const BALL_COLORS = [
  '#ffffff', // 0 cue ball
  '#f4d03f', '#1a5276', '#c0392b', '#8e44ad',
  '#e67e22', '#27ae60', '#922b21', '#2c3e50',
  '#f4d03f', '#1a5276', '#c0392b', '#8e44ad',
  '#e67e22', '#27ae60', '#922b21', // 1-15
];

export class TrajectoryGraph {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // View state
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this._dragging = false;
    this._lastMouse = { x: 0, y: 0 };

    // Data
    this.frames = null;
    this.frameCount = 0;
    this.frameRate = 60;
    this.playbackSpeed = 1.0;
    this.tableWidth = 0;
    this.tableDepth = 0;
    this.ballRadius = 0;
    this.pocketPositions = [];
    this.collisions = [];
    this.pockets = [];

    // Playback
    this.playing = false;
    this.currentFrame = 0;
    this.accumulator = 0;

    // Animation frame id
    this._animId = null;

    this._bindEvents();
  }

  /** Load shot data and prepare for rendering. */
  load(data, tableInfo = {}) {
    if (!data || !data.frames || data.frameCount < 2) {
      this.frames = null;
      this.frameCount = 0;
      this.tableWidth = 0;
      this.tableDepth = 0;
      this.ballRadius = 0;
      this.pocketPositions = [];
      this.collisions = [];
      this.pockets = [];
      this.currentFrame = 0;
      this.accumulator = 0;
      this.playing = false;
      return false;
    }

    const frames = new Float32Array(data.frames);
    const expectedLen = data.frameCount * FLOATS_PER_FRAME;
    if (frames.length < expectedLen) {
      this.frames = null;
      this.frameCount = 0;
      return false;
    }
    // Guard against NaN/Inf
    for (let i = 0; i < expectedLen; i++) {
      const v = frames[i];
      if (Number.isNaN(v) || v === Infinity || v === -Infinity) {
        this.frames = null;
        this.frameCount = 0;
        return false;
      }
    }

    this.frames = frames;
    this.frameCount = data.frameCount;
    this.frameRate = (Number.isFinite(data.frameRate) && data.frameRate > 0) ? data.frameRate : 60;
    this.tableWidth = Number.isFinite(tableInfo.width) && tableInfo.width > 0 ? tableInfo.width : 600;
    this.tableDepth = Number.isFinite(tableInfo.depth) && tableInfo.depth > 0 ? tableInfo.depth : 300;
    this.ballRadius = Number.isFinite(tableInfo.ballRadius) && tableInfo.ballRadius > 0 ? tableInfo.ballRadius : 10;
    this.pocketPositions = Array.isArray(tableInfo.pocketPositions) ? tableInfo.pocketPositions : [];
    this.collisions = Array.isArray(tableInfo.collisions) ? tableInfo.collisions : [];
    this.pockets = Array.isArray(tableInfo.pockets) ? tableInfo.pockets : [];
    this.currentFrame = 0;
    this.accumulator = 0;
    this.playing = false;

    this._fitView();
    this.render(0);
    return true;
  }

  /** Start animated playback. */
  play() {
    this.playing = true;
    this._scheduleRender();
  }

  /** Set playback speed multiplier (e.g. 0.5, 1.0, 2.0). */
  setPlaybackSpeed(speed) {
    this.playbackSpeed = Math.max(0.1, Math.min(5.0, speed));
  }

  /** Pause playback. */
  pause() {
    this.playing = false;
    if (this._animId) {
      cancelAnimationFrame(this._animId);
      this._animId = null;
    }
  }

  /** Stop and reset to start. */
  stop() {
    this.pause();
    this.currentFrame = 0;
    this.accumulator = 0;
    this.render(0);
  }

  /** Seek to specific frame. */
  seek(frame) {
    this.currentFrame = Math.max(0, Math.min(this.frameCount - 1, Math.round(frame)));
    this.render(this.currentFrame);
  }

  /** Seek to ratio (0.0 - 1.0). */
  seekRatio(ratio) {
    this.seek(ratio * (this.frameCount - 1));
  }

  /** Get current progress ratio. */
  getProgress() {
    if (this.frameCount <= 1) return 0;
    return this.currentFrame / (this.frameCount - 1);
  }

  /** Update playback by dt seconds. */
  update(dt) {
    if (!this.playing || !this.frames) return;

    const interval = 1 / this.frameRate;
    this.accumulator += dt * this.playbackSpeed;

    while (this.accumulator >= interval) {
      this.accumulator -= interval;
      this.currentFrame++;
      if (this.currentFrame >= this.frameCount) {
        this.currentFrame = this.frameCount - 1;
        this.playing = false;
        break;
      }
    }

    this.render(this.currentFrame);
  }

  /** Render a specific frame. */
  render(frameIdx) {
    if (!this.frames) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = '#0a0e0a';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(this.offsetX + w / 2, this.offsetY + h / 2);
    ctx.scale(this.scale, this.scale);

    // Draw table
    this._drawTable(ctx);

    // Draw trajectories (full paths, faded)
    this._drawTrajectories(ctx, frameIdx);

    // Draw collision markers
    this._drawCollisions(ctx, frameIdx);

    // Draw balls at current frame
    this._drawBalls(ctx, frameIdx);

    // Draw pockets
    this._drawPockets(ctx);

    ctx.restore();

    // Draw frame indicator
    this._drawFrameIndicator(ctx, frameIdx);
  }

  _drawTable(ctx) {
    const hw = this.tableWidth / 2;
    const hd = this.tableDepth / 2;
    const cushion = this.ballRadius * 2.5;

    // Wood border
    ctx.fillStyle = '#3d2817';
    ctx.fillRect(-hw - cushion, -hd - cushion, (hw + cushion) * 2, (hd + cushion) * 2);

    // Cushions
    ctx.fillStyle = '#1a3a1a';
    ctx.fillRect(-hw, -hd - cushion * 0.5, hw * 2, cushion * 0.5); // top
    ctx.fillRect(-hw, hd, hw * 2, cushion * 0.5); // bottom
    ctx.fillRect(-hw - cushion * 0.5, -hd, cushion * 0.5, hd * 2); // left
    ctx.fillRect(hw, -hd, cushion * 0.5, hd * 2); // right

    // Playing surface
    ctx.fillStyle = '#0d4a1c';
    ctx.fillRect(-hw, -hd, hw * 2, hd * 2);

    // Border lines
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-hw, -hd, hw * 2, hd * 2);
  }

  _drawTrajectories(ctx, upToFrame) {
    const r = this.ballRadius;
    const maxFrame = Math.min(upToFrame, this.frameCount - 1);

    for (let b = 0; b < BALL_COUNT; b++) {
      const color = BALL_COLORS[b] || '#888';
      ctx.strokeStyle = color + '44'; // low alpha
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      let started = false;
      for (let f = 0; f <= maxFrame; f++) {
        const base = f * FLOATS_PER_FRAME + b * 2;
        const x = this.frames[base];
        const z = this.frames[base + 1];
        const isSentinel = x === POCKETED_SENTINEL && z === POCKETED_SENTINEL;
        const isInvalid = !Number.isFinite(x) || !Number.isFinite(z);
        if (isSentinel || isInvalid) {
          started = false;
          continue;
        }
        if (!started) {
          ctx.moveTo(x, z);
          started = true;
        } else {
          ctx.lineTo(x, z);
        }
      }
      ctx.stroke();
    }
  }

  _drawBalls(ctx, frameIdx) {
    const r = this.ballRadius;
    const f = Math.min(frameIdx, this.frameCount - 1);

    for (let b = 0; b < BALL_COUNT; b++) {
      const base = f * FLOATS_PER_FRAME + b * 2;
      const x = this.frames[base];
      const z = this.frames[base + 1];
      const isSentinel = x === POCKETED_SENTINEL && z === POCKETED_SENTINEL;
      const isInvalid = !Number.isFinite(x) || !Number.isFinite(z);
      if (isSentinel || isInvalid) continue;

      const color = BALL_COLORS[b] || '#888';

      ctx.beginPath();
      ctx.arc(x, z, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Stroke
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Number (for balls 1-15)
      if (b >= 1 && b < BALL_COUNT) {
        ctx.fillStyle = b >= 9 ? '#fff' : '#000';
        ctx.font = `${Math.max(8, r * 0.8)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(b), x, z);
      }

      // Highlight cue ball
      if (b === 0) {
        ctx.beginPath();
        ctx.arc(x, z, r + 2, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  _drawCollisions(ctx, upToFrame) {
    if (!this.collisions || this.collisions.length === 0) return;

    const r = this.ballRadius;
    let visibleIdx = 0;

    for (const c of this.collisions) {
      if (c.frame > upToFrame) continue;
      visibleIdx++;

      const alpha = Math.max(0, 1.0 - 0.7 * (upToFrame - c.frame) / (this.frameCount - c.frame + 1));
      const x = c.position?.x ?? 0;
      const z = c.position?.z ?? 0;

      // Ring
      ctx.beginPath();
      ctx.arc(x, z, r * 1.8, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 200, 50, ${Math.max(0.2, alpha * 0.8)})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Number
      ctx.fillStyle = `rgba(255, 220, 100, ${Math.max(0.4, alpha)})`;
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(visibleIdx), x, z - r * 2.2);
    }
  }

  _drawPockets(ctx) {
    const r = this.ballRadius * 1.6;
    for (const p of this.pocketPositions) {
      ctx.beginPath();
      ctx.arc(p.x, p.z, r, 0, Math.PI * 2);
      ctx.fillStyle = '#0a0a0a';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  _drawFrameIndicator(ctx, frameIdx) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const progress = this.frameCount > 1 ? frameIdx / (this.frameCount - 1) : 0;
    const barW = w * 0.8;
    const barH = 3;
    const barX = (w - barW) / 2;
    const barY = h - 16;

    // Background
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(barX, barY, barW, barH);

    // Fill
    ctx.fillStyle = 'rgba(0, 230, 118, 0.7)';
    ctx.fillRect(barX, barY, barW * progress, barH);

    // Time text
    const safeRate = (Number.isFinite(this.frameRate) && this.frameRate > 0) ? this.frameRate : 60;
    const time = (frameIdx / safeRate).toFixed(1);
    const total = (this.frameCount / safeRate).toFixed(1);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${time}s / ${total}s`, w - 10, barY - 4);
  }

  _fitView() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const padding = 40;

    const contentW = this.tableWidth + this.ballRadius * 6;
    const contentH = this.tableDepth + this.ballRadius * 6;

    const scaleX = (w - padding * 2) / contentW;
    const scaleY = (h - padding * 2) / contentH;
    this.scale = Math.min(scaleX, scaleY);
    this.offsetX = 0;
    this.offsetY = 0;
  }

  resize(width, height) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.frames) this.render(this.currentFrame);
  }

  _scheduleRender() {
    if (this._animId) return;
    let lastTime = performance.now();
    const loop = (now) => {
      if (!this.playing) {
        this._animId = null;
        return;
      }
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      this.update(dt);
      this._animId = this.playing ? requestAnimationFrame(loop) : null;
    };
    this._animId = requestAnimationFrame(loop);
  }

  _bindEvents() {
    this._onMouseDown = (e) => {
      this._dragging = true;
      this._lastMouse = { x: e.clientX, y: e.clientY };
    };
    this._onMouseMove = (e) => {
      if (!this._dragging) return;
      const dx = e.clientX - this._lastMouse.x;
      const dy = e.clientY - this._lastMouse.y;
      this.offsetX += dx;
      this.offsetY += dy;
      this._lastMouse = { x: e.clientX, y: e.clientY };
      if (this.frames) this.render(this.currentFrame);
    };
    this._onMouseUp = () => {
      this._dragging = false;
    };
    this._onWheel = (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      this.scale *= zoomFactor;
      this.scale = Math.max(0.2, Math.min(5, this.scale));
      if (this.frames) this.render(this.currentFrame);
    };

    this.canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mouseup', this._onMouseUp);
    this.canvas.addEventListener('wheel', this._onWheel, { passive: false });
  }

  destroy() {
    this.pause();
    if (this._onMouseDown) {
      this.canvas.removeEventListener('mousedown', this._onMouseDown);
      window.removeEventListener('mousemove', this._onMouseMove);
      window.removeEventListener('mouseup', this._onMouseUp);
      this.canvas.removeEventListener('wheel', this._onWheel, { passive: false });
      this._onMouseDown = null;
      this._onMouseMove = null;
      this._onMouseUp = null;
      this._onWheel = null;
    }
    this.frames = null;
    this.canvas = null;
    this.ctx = null;
  }
}
