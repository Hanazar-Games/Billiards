/**
 * PowerLabel — On-screen shot-power tier announcement.
 *
 * When the cue strikes the ball we flash a Chinese/English label
 * in the centre of the screen that scales up and fades out,
 * giving immediate feedback on how hard the shot was.
 */
import { settings } from '../core/SettingsStore.js';
import { SHOT } from '../config.js';

const TIERS = [
  { threshold: 0.00, label: '轻推', color: '#4ecdc4', scale: 0.9 },
  { threshold: 0.22, label: '中力', color: '#a8e063', scale: 1.0 },
  { threshold: 0.42, label: '重拳', color: '#ff9f43', scale: 1.15 },
  { threshold: 0.62, label: '暴杆', color: '#ff6b6b', scale: 1.35 },
  { threshold: 0.82, label: 'MAX',  color: '#ffd700', scale: 1.25 },
];

export class PowerLabel {
  constructor() {
    this.el = null;
    this._ensureElement();
    this._animId = null;
    this._startTime = 0;
    this._duration = 0;
  }

  _ensureElement() {
    if (this.el) return;
    if (!document.body) return;
    this.el = document.createElement('div');
    this.el.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) scale(0);
      font-size: 56px;
      font-weight: 900;
      letter-spacing: 6px;
      text-shadow: 0 0 24px currentColor, 0 4px 16px rgba(0,0,0,0.5);
      pointer-events: none;
      opacity: 0;
      z-index: 100;
      font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
      transition: none;
      user-select: none;
      white-space: nowrap;
    `;
    document.body.appendChild(this.el);
  }

  /**
   * Trigger a power label animation.
   * @param {number} power — shot power (0 … SHOT.maxPower)
   */
  show(power) {
    const maxPower = SHOT.maxPower;
    const t = Math.min(power / maxPower, 1.0);

    // Find tier
    let tier = TIERS[0];
    for (let i = TIERS.length - 1; i >= 0; i--) {
      if (t >= TIERS[i].threshold) {
        tier = TIERS[i];
        break;
      }
    }

    this._ensureElement();
    this.el.textContent = tier.label;
    this.el.style.color = tier.color;

    const duration = 0.55 + t * 0.35; // 0.55s … 0.9s
    const speed = Math.max(0.2, settings.get('fxAnimSpeed') ?? 1.0);
    this._startTime = performance.now();
    this._duration = (duration * 1000) / speed;
    this._tierScale = tier.scale;

    if (this._animId) cancelAnimationFrame(this._animId);
    this._tick();
  }

  _tick = () => {
    if (!this.el) {
      this._animId = null;
      return;
    }
    const elapsed = performance.now() - this._startTime;
    const p = Math.min(elapsed / this._duration, 1.0);

    // Phase 1: scale up (0 … 0.35)
    // Phase 2: hold + fade (0.35 … 1.0)
    let scale, opacity;
    if (p < 0.35) {
      const sp = p / 0.35;
      scale = sp * this._tierScale;
      opacity = sp;
    } else {
      const fp = (p - 0.35) / 0.65;
      scale = this._tierScale * (1 - fp * 0.15);
      opacity = 1 - fp * fp;
    }

    this.el.style.transform = `translate(-50%, -50%) scale(${scale})`;
    this.el.style.opacity = String(opacity);

    if (p < 1.0) {
      this._animId = requestAnimationFrame(this._tick);
    } else {
      this.el.style.opacity = '0';
      this._animId = null;
    }
  };

  dispose() {
    if (this._animId) {
      cancelAnimationFrame(this._animId);
      this._animId = null;
    }
    if (this.el && this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
      this.el = null;
    }
  }
}
