import { TABLE, BALL, BALL_COLORS, getBallType, BALL_TYPE } from '../config.js';
import { settings } from '../core/SettingsStore.js';

/**
 * Table Minimap — A lightweight 2D top-down radar of all balls.
 *
 * Renders on a small HTML5 Canvas overlay so players can see the whole
 * table layout at a glance without rotating the camera.
 */
export class Minimap {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'table-minimap';
    this.ctx = this.canvas.getContext('2d');
    this._balls = []; // { id, x, z, pocketed }
    this._enabled = settings.get('minimapEnabled') !== false;
    this._size = settings.get('minimapSize') || 140;
    this._opacity = settings.get('minimapOpacity') ?? 0.85;
    this._padding = 8;      // canvas internal padding in px
    this._pocketR = 3.5;    // pocket marker radius in px
    this._ballR = 4.2;      // ball marker radius in px
    this._scale = 1;        // world → canvas scale factor
    this._ox = 0;           // canvas origin X offset
    this._oz = 0;           // canvas origin Y offset
    this._pockets = null;   // pocket positions array
    this._cueTrail = [];    // recent cue-ball positions for trail drawing
    this._maxTrail = 40;
    this._dirty = true;     // only redraw when data changes
    this._resize();
    this._applyStyle();
    this._onSettings = (e) => {
      if (e.detail?.key === 'minimapEnabled') this.setEnabled(e.detail.value);
      if (e.detail?.key === 'minimapSize') { this._size = e.detail.value || 140; this._resize(); }
      if (e.detail?.key === 'minimapOpacity') { this._opacity = e.detail.value ?? 0.85; this._applyStyle(); }
    };
    window.addEventListener('settingsChanged', this._onSettings);
    this._onResize = () => this._resize();
    window.addEventListener('resize', this._onResize);
  }

  setEnabled(v) {
    this._enabled = v;
    this.canvas.style.display = v ? 'block' : 'none';
    if (v) this._dirty = true;
  }

  setPocketPositions(positions) {
    this._pockets = positions;
  }

  updateBallData(balls) {
    if (!balls || !balls.map) return;
    const mapped = balls.map((b) => ({
      id: b.id,
      x: b.mesh?.position?.x ?? b.body?.position?.x ?? 0,
      z: b.mesh?.position?.z ?? b.body?.position?.z ?? 0,
      pocketed: b.pocketed,
    }));
    // Quick dirty check: compare against previous data
    let dirty = mapped.length !== this._balls.length;
    if (!dirty) {
      for (let i = 0; i < mapped.length; i++) {
        const a = mapped[i], b = this._balls[i];
        if (a.id !== b.id || a.pocketed !== b.pocketed || Math.abs(a.x - b.x) > 0.1 || Math.abs(a.z - b.z) > 0.1) {
          dirty = true;
          break;
        }
      }
    }
    this._balls = mapped;

    // Record cue-ball trail
    const cue = this._balls.find(b => b.id === 0 && !b.pocketed);
    if (cue) {
      const last = this._cueTrail[this._cueTrail.length - 1];
      const dx = last ? (cue.x - last.x) : Infinity;
      const dz = last ? (cue.z - last.z) : Infinity;
      if (!last || dx * dx + dz * dz > 0.5) {
        this._cueTrail.push({ x: cue.x, z: cue.z });
        if (this._cueTrail.length > this._maxTrail) this._cueTrail.shift();
        dirty = true;
      }
    } else if (this._cueTrail.length > 0) {
      this._cueTrail = [];
      dirty = true;
    }

    if (dirty) this._dirty = true;
  }

  draw() {
    if (!this._enabled) return;
    if (!this._dirty) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const p = this._padding;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Helper: rounded rect fallback
    const drawRoundedRect = (x, y, rw, rh, r) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + rw - r, y);
      ctx.arcTo(x + rw, y, x + rw, y + r, r);
      ctx.lineTo(x + rw, y + rh - r);
      ctx.arcTo(x + rw, y + rh, x + rw - r, y + rh, r);
      ctx.lineTo(x + r, y + rh);
      ctx.arcTo(x, y + rh, x, y + rh - r, r);
      ctx.lineTo(x, y + r);
      ctx.arcTo(x, y, x + r, y, r);
      ctx.closePath();
    };

    // Felt
    ctx.fillStyle = '#0a3824';
    drawRoundedRect(p, p, w - p * 2, h - p * 2, 4);
    ctx.fill();

    // Table border (cushion edge)
    ctx.strokeStyle = 'rgba(216,177,95,0.45)';
    ctx.lineWidth = 1.5;
    drawRoundedRect(p, p, w - p * 2, h - p * 2, 4);
    ctx.stroke();

    // Pockets
    if (this._pockets) {
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      for (const pocket of this._pockets) {
        const cx = this._worldToCanvasX(pocket.x);
        const cy = this._worldToCanvasZ(pocket.z);
        ctx.beginPath();
        ctx.arc(cx, cy, this._pocketR, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Cue-ball trail
    if (this._cueTrail.length > 1) {
      ctx.beginPath();
      for (let i = 0; i < this._cueTrail.length; i++) {
        const pt = this._cueTrail[i];
        const px = this._worldToCanvasX(pt.x);
        const py = this._worldToCanvasZ(pt.z);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.stroke();
    }

    // Balls (draw in ID order so overlap is deterministic)
    for (const ball of this._balls) {
      if (ball.pocketed) continue;
      const cx = this._worldToCanvasX(ball.x);
      const cy = this._worldToCanvasZ(ball.z);
      this._drawBall(ctx, ball.id, cx, cy, this._ballR);
    }

    // Cue aim indicator (optional — subtle direction hint)
    // Not implemented to keep minimap clean; can be added later.
    this._dirty = false;
  }

  _drawBall(ctx, id, cx, cy, r) {
    const type = getBallType(id);
    const hex = BALL_COLORS[id];
    const col = typeof hex === 'number' ? `#${hex.toString(16).padStart(6, '0')}` : '#fff';

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);

    if (id === 0) {
      // Cue ball — pure white with soft shadow
      ctx.fillStyle = '#f0f0f0';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    } else if (id === 8) {
      // 8-ball — black with white circle
      ctx.fillStyle = '#111';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fill();
    } else if (type === BALL_TYPE.STRIPE) {
      // Stripe — colored fill with white stripe bar
      ctx.fillStyle = col;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      // White stripe
      ctx.fillStyle = 'rgba(255,255,255,0.72)';
      ctx.fillRect(cx - r, cy - r * 0.35, r * 2, r * 0.7);
    } else {
      // Solid
      ctx.fillStyle = col;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }

  _worldToCanvasX(wx) {
    return this._ox + wx * this._scale;
  }

  _worldToCanvasZ(wz) {
    return this._oz + wz * this._scale;
  }

  _resize() {
    const dpr = Math.min(window.devicePixelRatio, 2);
    const cssSize = Math.max(80, Math.min(260, this._size));
    this.canvas.width = cssSize * dpr;
    this.canvas.height = (cssSize * (TABLE.depth / TABLE.width)) * dpr;
    this.canvas.style.width = cssSize + 'px';
    this.canvas.style.height = (cssSize * (TABLE.depth / TABLE.width)) + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const p = this._padding;
    const cw = cssSize;
    const ch = cssSize * (TABLE.depth / TABLE.width);
    // Map table world bounds → canvas internal coords
    const halfW = TABLE.width / 2;
    const halfD = TABLE.depth / 2;
    this._scale = Math.min((cw - p * 2) / TABLE.width, (ch - p * 2) / TABLE.depth);
    this._ox = cw / 2; // world (0,0) is table center
    this._oz = ch / 2;
    this._dirty = true;
  }

  _applyStyle() {
    const s = this.canvas.style;
    s.position = 'absolute';
    s.bottom = '14px';
    s.right = '14px';
    s.zIndex = '8';
    s.pointerEvents = 'none';
    s.borderRadius = '8px';
    s.boxShadow = '0 8px 24px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.08)';
    s.opacity = String(this._opacity);
    s.display = this._enabled ? 'block' : 'none';
  }

  mount(parent) {
    if (parent && !this.canvas.parentNode) {
      parent.appendChild(this.canvas);
    }
  }

  unmount() {
    if (this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }

  dispose() {
    window.removeEventListener('settingsChanged', this._onSettings);
    if (this._onResize) window.removeEventListener('resize', this._onResize);
    this.unmount();
    this.canvas = null;
    this.ctx = null;
    this._balls = [];
    this._cueTrail = [];
    this._pockets = null;
  }
}
