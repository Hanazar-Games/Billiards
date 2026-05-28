/**
 * UILayout — centralized HUD safe-zone manager.
 *
 * Tracks occupied edge zones and exposes them as CSS custom properties
 * so all HUD elements can avoid overlapping each other without
 * hard-coding magic bottom / right values.
 */
export class UILayout {
  constructor() {
    this.root = document.documentElement;
    this._claims = new Map();
  }

  /**
   * Claim a safe-zone slice on one edge.
   * @param {string} id — unique claim id
   * @param {string} side — 'bottom' | 'right' | 'left' | 'top'
   * @param {number} sizePx — pixels occupied from that edge
   */
  claim(id, side, sizePx) {
    this._claims.set(id, { side, size: Math.max(0, Math.round(sizePx)) });
    this._update();
  }

  /** Release a previously claimed zone. */
  release(id) {
    if (this._claims.delete(id)) this._update();
  }

  /** Update an existing claim (convenience). */
  update(id, side, sizePx) {
    if (this._claims.has(id)) {
      this._claims.set(id, { side, size: Math.max(0, Math.round(sizePx)) });
      this._update();
    }
  }

  _update() {
    const sides = ['bottom', 'right', 'left', 'top'];
    for (const side of sides) {
      let max = 0;
      for (const c of this._claims.values()) {
        if (c.side === side && c.size > max) max = c.size;
      }
      this.root.style.setProperty(`--hud-${side}-safe`, `${max}px`);
    }
    window.dispatchEvent(new CustomEvent('hudLayoutChanged', {
      detail: Object.fromEntries(
        sides.map(s => [s, this.getSafe(s)])
      ),
    }));
  }

  /**
   * Read the current safe-zone size for an edge.
   * @param {string} side — 'bottom' | 'right' | 'left' | 'top'
   * @returns {number}
   */
  getSafe(side) {
    const raw = getComputedStyle(this.root).getPropertyValue(`--hud-${side}-safe`).trim();
    return parseFloat(raw) || 0;
  }
}

export const uiLayout = new UILayout();
