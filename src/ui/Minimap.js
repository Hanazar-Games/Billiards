import { BALL, BALL_COLORS, getBallType, BALL_TYPE } from '../config.js';
import { getDefaultTableProfile } from '../game/TableProfiles.js';
import { settings } from '../core/SettingsStore.js';
import { uiLayout } from './UILayout.js';

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
    this._baseBallR = 4.2;  // base ball marker radius in px
    this._ballR = this._baseBallR * (settings.get('minimapBallSize') ?? 1.0); // scaled by minimapBallSize
    this._showCueTrail = settings.get('minimapShowCueTrail') !== false;
    this._maxTrail = settings.get('minimapTrailLength') || 40;
    this._highContrast = settings.get('minimapHighContrast') === true;
    this._scale = 1;        // world → canvas scale factor
    this._ox = 0;           // canvas origin X offset
    this._oz = 0;           // canvas origin Y offset
    this._pockets = null;   // pocket positions array
    this._cueTrail = [];    // recent cue-ball positions for trail drawing
    this._dirty = true;     // only redraw when data changes
    this._profile = getDefaultTableProfile();
    this._resize();
    this._applyStyle();
    this._onSettings = (e) => {
      if (e.detail?.key === 'minimapEnabled') this.setEnabled(e.detail.value);
      if (e.detail?.key === 'minimapSize') { this._size = e.detail.value || 140; this._resize(); }
      if (e.detail?.key === 'minimapOpacity') { this._opacity = e.detail.value ?? 0.85; this._applyStyle(); }
      if (e.detail?.key === 'minimapPosition') { this._applyStyle(); }
      if (e.detail?.key === 'minimapBallSize') {
        this._ballR = this._baseBallR * (e.detail.value ?? 1.0);
        this._dirty = true;
      }
      if (e.detail?.key === 'minimapShowCueTrail') {
        this._showCueTrail = e.detail.value !== false;
        this._dirty = true;
      }
      if (e.detail?.key === 'minimapTrailLength') {
        this._maxTrail = e.detail.value || 40;
        // Trim existing trail if needed
        while (this._cueTrail.length > this._maxTrail) this._cueTrail.shift();
        this._dirty = true;
      }
      if (e.detail?.key === 'minimapHighContrast') {
        this._highContrast = e.detail.value === true;
        this._dirty = true;
      }
    };
    window.addEventListener('settingsChanged', this._onSettings);
    this._onResize = () => this._resize();
    window.addEventListener('resize', this._onResize);
    this._onLayoutChange = () => this._applyStyle();
    window.addEventListener('hudLayoutChanged', this._onLayoutChange);
  }

  setTableProfile(profile) {
    this._profile = profile || this._profile;
    this._resize();
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
    ctx.fillStyle = this._highContrast ? '#0f4a30' : '#0a3824';
    drawRoundedRect(p, p, w - p * 2, h - p * 2, 4);
    ctx.fill();

    // Table border (cushion edge)
    ctx.strokeStyle = this._highContrast ? 'rgba(255,220,140,0.6)' : 'rgba(216,177,95,0.45)';
    ctx.lineWidth = this._highContrast ? 2.0 : 1.5;
    drawRoundedRect(p, p, w - p * 2, h - p * 2, 4);
    ctx.stroke();

    // Pockets
    if (this._pockets) {
      ctx.fillStyle = this._highContrast ? '#000000' : 'rgba(0,0,0,0.65)';
      for (const pocket of this._pockets) {
        const cx = this._worldToCanvasX(pocket.x);
        const cy = this._worldToCanvasZ(pocket.z);
        ctx.beginPath();
        ctx.arc(cx, cy, this._pocketR, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Cue-ball trail
    if (this._showCueTrail && this._cueTrail.length > 1) {
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
      ctx.lineWidth = this._highContrast ? 2.2 : 1.8;
      ctx.strokeStyle = this._highContrast ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.35)';
      ctx.stroke();
    }

    // Balls (draw in ID order so overlap is deterministic)
    for (const ball of this._balls) {
      if (ball.pocketed) continue;
      const cx = this._worldToCanvasX(ball.x);
      const cy = this._worldToCanvasZ(ball.z);
      this._drawBall(ctx, ball.id, cx, cy, this._ballR);
    }

    this._dirty = false;
  }

  _drawBall(ctx, id, cx, cy, r) {
    const type = getBallType(id);
    const hex = BALL_COLORS[id];
    const col = typeof hex === 'number' ? `#${hex.toString(16).padStart(6, '0')}` : '#fff';
    const strokeCol = this._highContrast ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.25)';
    const strokeWidth = this._highContrast ? 1.2 : 0.8;

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);

    if (id === 0) {
      // Cue ball — pure white with soft shadow
      ctx.fillStyle = '#f0f0f0';
      ctx.fill();
      ctx.strokeStyle = strokeCol;
      ctx.lineWidth = strokeWidth;
      ctx.stroke();
      if (this._highContrast) {
        // Highlight ring for cue ball in high contrast mode
        ctx.beginPath();
        ctx.arc(cx, cy, r + 1.5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1.0;
        ctx.stroke();
      }
    } else if (id === 8) {
      // 8-ball — black with white circle
      ctx.fillStyle = '#111';
      ctx.fill();
      ctx.strokeStyle = this._highContrast ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.35)';
      ctx.lineWidth = strokeWidth;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = this._highContrast ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.55)';
      ctx.fill();
    } else if (type === BALL_TYPE.STRIPE) {
      // Stripe — colored fill with white stripe bar
      ctx.fillStyle = col;
      ctx.fill();
      ctx.strokeStyle = strokeCol;
      ctx.lineWidth = strokeWidth;
      ctx.stroke();
      // White stripe
      ctx.fillStyle = this._highContrast ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.72)';
      ctx.fillRect(cx - r, cy - r * 0.35, r * 2, r * 0.7);
    } else {
      // Solid
      ctx.fillStyle = col;
      ctx.fill();
      ctx.strokeStyle = strokeCol;
      ctx.lineWidth = strokeWidth;
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
    if (!this._profile) {
      this._profile = getDefaultTableProfile();
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssSize = Math.max(80, Math.min(260, this._size));
    this.canvas.width = cssSize * dpr;
    this.canvas.height = (cssSize * (this._profile.depth / this._profile.width)) * dpr;
    this.canvas.style.width = cssSize + 'px';
    this.canvas.style.height = (cssSize * (this._profile.depth / this._profile.width)) + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const p = this._padding;
    const cw = cssSize;
    const ch = cssSize * (this._profile.depth / this._profile.width);
    // Map table world bounds → canvas internal coords
    const halfW = this._profile.width / 2;
    const halfD = this._profile.depth / 2;
    this._scale = Math.min((cw - p * 2) / this._profile.width, (ch - p * 2) / this._profile.depth);
    this._ox = cw / 2; // world (0,0) is table center
    this._oz = ch / 2;
    this._dirty = true;
  }

  _applyStyle() {
    const s = this.canvas.style;
    let pos = settings.get('minimapPosition') || 'bottom-right';

    // If a right-side panel is open and we'd overlap, flip to the opposite side
    const rightSafe = uiLayout.getSafe('right');
    const leftSafe = uiLayout.getSafe('left');
    if (rightSafe > 80 && pos.includes('right')) {
      pos = pos.replace('right', 'left');
    } else if (leftSafe > 80 && pos.includes('left')) {
      pos = pos.replace('left', 'right');
    }

    s.position = 'absolute';
    s.zIndex = '8';
    s.pointerEvents = 'none';
    s.borderRadius = '8px';
    s.boxShadow = '0 8px 24px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.08)';
    s.opacity = String(this._opacity);
    s.display = this._enabled ? 'block' : 'none';
    // Reset all position props
    s.top = s.bottom = s.left = s.right = 'auto';
    const [v, h] = pos.split('-');
    const baseOffset = 14;
    const bottomSafe = uiLayout.getSafe('bottom');
    const topSafe = uiLayout.getSafe('top');
    if (v === 'top') s.top = `${topSafe + baseOffset}px`;
    else s.bottom = `${bottomSafe + baseOffset}px`;
    if (h === 'left') s.left = `${baseOffset}px`;
    else s.right = `${baseOffset}px`;
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
    if (this._onLayoutChange) window.removeEventListener('hudLayoutChanged', this._onLayoutChange);
    this.unmount();
    this.canvas = null;
    this.ctx = null;
    this._balls = [];
    this._cueTrail = [];
    this._pockets = null;
  }
}
