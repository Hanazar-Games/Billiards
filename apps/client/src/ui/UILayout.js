/**
 * UILayout — centralized HUD safe-zone manager.
 *
 * Tracks occupied edge zones and exposes them as CSS custom properties
 * so all HUD elements can avoid overlapping each other without
 * hard-coding magic bottom / right values.
 *
 * v2 supports multi-claim stacking per edge (priority-sorted cumulative
 * zones) alongside the original max-per-edge mode.  It can also observe
 * DOM elements via ResizeObserver so the safe zone always reflects
 * real rendered metrics (compact-hud, large-text, hudScale, etc.).
 */
export class UILayout {
  constructor() {
    this.root = typeof document !== 'undefined' ? document.documentElement : null;
    this._claims = new Map();      // id -> { side, size, priority, mode }
    this._scales = new Map();      // id -> number (visual scale multiplier)
    this._observers = new Map();   // id -> ResizeObserver
  }

  /**
   * Claim a safe-zone slice on one edge.
   *
   * @param {string} id — unique claim id
   * @param {string} side — 'bottom' | 'right' | 'left' | 'top'
   * @param {number} sizePx — pixels occupied from that edge
   * @param {Object|number} [options] — options object, or a number treated as priority
   * @param {number} [options.priority=0] — lower = closer to the edge, stacked first
   * @param {'stack'|'max'} [options.mode='max'] — 'stack' adds cumulatively; 'max' takes the largest
   */
  claim(id, side, sizePx, options = {}) {
    if (typeof options === 'number') options = { priority: options };
    const claim = {
      id,
      side,
      size: Math.max(0, Math.round(sizePx)),
      priority: options.priority ?? 0,
      mode: options.mode === 'stack' ? 'stack' : 'max',
    };
    this._claims.set(id, claim);
    this._update();
    return claim;
  }

  /** Release a previously claimed zone. */
  release(id) {
    this._stopObserving(id);
    this._scales.delete(id);
    if (this._claims.delete(id)) this._update();
  }

  /** Update an existing claim's size (convenience). */
  update(id, sizePx) {
    const c = this._claims.get(id);
    if (!c) return;
    const newSize = Math.max(0, Math.round(sizePx));
    if (c.size !== newSize) {
      c.size = newSize;
      this._update();
    }
  }

  /**
   * Update the visual scale multiplier for a claim.
   * When an element is scaled via CSS transform, its *visual* footprint
   * changes even though ResizeObserver sees the original layout box.
   * Multiply the measured size by this factor.
   */
  updateScale(id, scale) {
    const s = Number.isFinite(scale) ? scale : 1;
    const prev = this._scales.get(id) ?? 1;
    if (prev !== s) {
      this._scales.set(id, s);
      const c = this._claims.get(id);
      if (c) {
        // Reverse-engineer the layout size from the previous scale,
        // then apply the new scale so claim.size always reflects
        // the *visual* footprint.
        const layoutSize = prev !== 0 ? c.size / prev : c.size;
        const newSize = Math.max(0, Math.round(layoutSize * s));
        if (c.size !== newSize) {
          c.size = newSize;
          this._update();
        }
      }
    }
  }

  /**
   * Observe a DOM element and auto-maintain a claim for it.
   * Uses ResizeObserver when available; falls back to a one-time measurement.
   *
   * @param {string} id
   * @param {HTMLElement} element
   * @param {string} side
   * @param {Object} [options] — forwarded to claim()
   */
  observeElement(id, element, side, options = {}) {
    if (!element) return;

    this._stopObserving(id);

    // Layout size (padding + border, no CSS transforms) so we can apply
    // the visual scale multiplier consistently in _update().
    const measureLayout = () => {
      const raw = side === 'bottom' || side === 'top'
        ? element.offsetHeight
        : element.offsetWidth;
      return Math.max(0, Math.round(raw));
    };

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const box = entry.borderBoxSize?.[0];
          let raw;
          if (box) {
            raw = side === 'bottom' || side === 'top' ? box.blockSize : box.inlineSize;
          } else {
            raw = side === 'bottom' || side === 'top'
              ? entry.contentRect.height
              : entry.contentRect.width;
          }
          const scale = this._scales.get(id) ?? 1;
          this.update(id, Math.max(0, Math.round(raw * scale)));
        }
      });
      observer.observe(element);
      this._observers.set(id, observer);
    }

    // Initial claim using layout size (no transform)
    const scale = this._scales.get(id) ?? 1;
    this.claim(id, side, Math.round(measureLayout() * scale), options);
  }

  _stopObserving(id) {
    const obs = this._observers.get(id);
    if (obs) {
      try { obs.disconnect(); } catch (_) { /* ignore */ }
      this._observers.delete(id);
    }
  }

  _update() {
    const sides = ['bottom', 'right', 'left', 'top'];
    const detail = {};

    for (const side of sides) {
      const list = Array.from(this._claims.values())
        .filter(c => c.side === side)
        .sort((a, b) => a.priority - b.priority);

      let stackTotal = 0;
      let maxTotal = 0;

      for (const c of list) {
        if (c.mode === 'stack') {
          stackTotal += c.size;
        } else {
          maxTotal = Math.max(maxTotal, c.size);
        }
      }

      const total = Math.max(stackTotal, maxTotal);
      detail[side] = total;

      if (this.root) {
        this.root.style.setProperty(`--hud-${side}-safe`, `${total}px`);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hudLayoutChanged', { detail }));
    }
  }

  /**
   * Read the current safe-zone size for an edge from the CSS variable.
   * @param {string} side — 'bottom' | 'right' | 'left' | 'top'
   * @returns {number}
   */
  getSafe(side) {
    if (!this.root) return 0;
    const raw = getComputedStyle(this.root).getPropertyValue(`--hud-${side}-safe`).trim();
    return parseFloat(raw) || 0;
  }

  /**
   * Get the total stacked (cumulative) safe-zone for an edge.
   * This is the sum of all 'stack' mode claims, independent of 'max' claims.
   * @param {string} side
   * @returns {number}
   */
  getStackedSafe(side) {
    let total = 0;
    for (const c of this._claims.values()) {
      if (c.side === side && c.mode === 'stack') {
        total += c.size;
      }
    }
    return total;
  }

  /**
   * Get the largest max-mode claim for an edge.
   * @param {string} side
   * @returns {number}
   */
  getMaxSafe(side) {
    let max = 0;
    for (const c of this._claims.values()) {
      if (c.side === side && c.mode !== 'stack') {
        max = Math.max(max, c.size);
      }
    }
    return max;
  }

  /**
   * Get the end offset (distance from the edge) for a specific claim,
   * accounting for all lower-priority stack claims beneath it.
   * @param {string} id
   * @returns {number}
   */
  getOffset(id) {
    const target = this._claims.get(id);
    if (!target) return 0;

    const list = Array.from(this._claims.values())
      .filter(c => c.side === target.side)
      .sort((a, b) => a.priority - b.priority);

    let offset = 0;
    for (const c of list) {
      if (c.mode === 'stack') {
        offset += c.size;
      }
      if (c.id === id) break;
    }
    return offset;
  }

  /** @returns {Map<string, {side:string,size:number, priority:number, mode:string}>} */
  getClaims() {
    return new Map(this._claims);
  }
}

export const uiLayout = new UILayout();
