import { animMs, isReducedMotion } from '../core/AnimSpeed.js';
import { uiLayout } from '../ui/UILayout.js';

/**
 * InstantReplayUI — HUD overlay for instant replay mode.
 *
 * Shows a "即时回放" label, playback progress bar, speed badge,
 * and a skip button. All elements are pointer-events aware only
 * where needed (skip button).
 */
export class InstantReplayUI {
  constructor() {
    this.container = null;
    this._labelEl = null;
    this._progressFill = null;
    this._speedEl = null;
    this._skipBtn = null;
    this._onSkip = null;
    this._showRaf = null;
    this._hideTimer = null;
  }

  show(onSkip) {
    this._onSkip = onSkip;
    this._ensureDOM();
    if (!this.container) return;

    if (this._hideTimer) {
      clearTimeout(this._hideTimer);
      this._hideTimer = null;
    }
    this.container.style.display = 'flex';
    if (this._showRaf) cancelAnimationFrame(this._showRaf);
    this._showRaf = requestAnimationFrame(() => {
      this._showRaf = null;
      if (this.container) this.container.style.opacity = '1';
    });
  }

  hide() {
    if (!this.container) return;
    this.container.style.opacity = '0';
    if (this._hideTimer) clearTimeout(this._hideTimer);
    this._hideTimer = setTimeout(() => {
      this._hideTimer = null;
      if (this.container) this.container.style.display = 'none';
    }, animMs(300));
  }

  setProgress(ratio) {
    if (!this._progressFill) return;
    const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
    this._progressFill.style.width = `${pct}%`;
  }

  setSpeedLabel(label) {
    if (!this._speedEl) return;
    this._speedEl.textContent = label;
  }

  _ensureDOM() {
    if (this.container) return;
    const uiLayer = document.getElementById('ui-layer');
    if (!uiLayer) return;

    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 35;
      display: none;
      opacity: 0;
      transition: opacity calc(0.3s / var(--ui-anim-speed)) ease;
    `;

    // Top-left label wrap
    const labelWrap = document.createElement('div');
    labelWrap.style.cssText = `
      position: absolute;
      top: calc(var(--hud-top-safe) + 16px);
      left: calc(var(--hud-left-safe) + 16px);
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(0,0,0,0.6);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 8px;
      padding: 8px 14px;
      backdrop-filter: blur(8px);
      pointer-events: none;
    `;

    const icon = document.createElement('span');
    icon.textContent = '🔁';
    icon.style.cssText = 'font-size: 16px;';
    labelWrap.appendChild(icon);

    this._labelEl = document.createElement('span');
    this._labelEl.textContent = '即时回放';
    this._labelEl.style.cssText = `
      font-size: 13px;
      font-weight: 700;
      color: #fff;
      letter-spacing: 0.5px;
    `;
    labelWrap.appendChild(this._labelEl);

    this._speedEl = document.createElement('span');
    this._speedEl.textContent = '0.5x';
    this._speedEl.style.cssText = `
      font-size: 11px;
      color: rgba(255,255,255,0.6);
      margin-left: 4px;
    `;
    labelWrap.appendChild(this._speedEl);

    this.container.appendChild(labelWrap);

    // Bottom progress bar (elevated to avoid overlapping power bar, minimap, stats panel)
    const progressWrap = document.createElement('div');
    progressWrap.style.cssText = `
      position: absolute;
      bottom: calc(var(--hud-bottom-safe) + 24px);
      left: 50%;
      transform: translateX(-50%);
      width: min(400px, 80vw);
      height: 4px;
      background: rgba(255,255,255,0.15);
      border-radius: 2px;
      overflow: hidden;
    `;

    this._progressFill = document.createElement('div');
    this._progressFill.style.cssText = `
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #ffd700, #ff8c00);
      border-radius: 2px;
      transition: ${isReducedMotion() ? 'none' : 'width calc(0.08s / var(--ui-anim-speed)) linear'};
    `;
    progressWrap.appendChild(this._progressFill);
    this.container.appendChild(progressWrap);

    // Skip button (top-right, pointer-events: auto) — avoids bottom HUD overlap
    this._skipBtn = document.createElement('button');
    this._skipBtn.textContent = '跳过';
    this._skipBtn.style.cssText = `
      position: absolute;
      top: calc(var(--hud-top-safe) + 16px);
      right: calc(var(--hud-right-safe) + 16px);
      padding: 6px 14px;
      font-size: 12px;
      font-weight: 700;
      color: rgba(255,255,255,0.8);
      background: rgba(0,0,0,0.5);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 6px;
      cursor: pointer;
      pointer-events: auto;
      backdrop-filter: blur(4px);
      transition: all calc(0.2s / var(--ui-anim-speed)) ease;
    `;
    this._skipBtn.onmouseenter = () => {
      if (this._skipBtn) this._skipBtn.style.background = 'rgba(255,255,255,0.15)';
    };
    this._skipBtn.onmouseleave = () => {
      if (this._skipBtn) this._skipBtn.style.background = 'rgba(0,0,0,0.5)';
    };
    this._skipBtn.onclick = () => {
      if (this._onSkip) this._onSkip();
    };
    this.container.appendChild(this._skipBtn);

    uiLayer.appendChild(this.container);
  }

  destroy() {
    this.hide();
    if (this._showRaf) {
      cancelAnimationFrame(this._showRaf);
      this._showRaf = null;
    }
    if (this._hideTimer) {
      clearTimeout(this._hideTimer);
      this._hideTimer = null;
    }
    if (this._skipBtn) {
      this._skipBtn.onmouseenter = null;
      this._skipBtn.onmouseleave = null;
      this._skipBtn.onclick = null;
      this._skipBtn = null;
    }
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this._labelEl = null;
    this._progressFill = null;
    this._speedEl = null;
    this._onSkip = null;
  }
}
