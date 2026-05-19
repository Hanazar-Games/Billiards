import { onboarding } from '../core/OnboardingStore.js';
import { animMs } from '../core/AnimSpeed.js';

/**
 * OnboardingTips — Lightweight non-blocking first-time guidance.
 *
 * Uses a small bottom-center card that does not pause the game.
 * Each tip shows once; clicking "知道了" dismisses it permanently.
 */

const TIPS = {
  aim: {
    title: '新手引导 (1/3)',
    text: '移动鼠标瞄准目标球，虚线会显示预计路线。',
  },
  charge: {
    title: '新手引导 (2/3)',
    text: '按住左键向后拖动球杆蓄力，松开后击球。拖得越远力量越大。',
  },
  spin: {
    title: '新手引导 (3/3)',
    text: '左下角可调整击球点（高杆/低杆/侧塞），让白球走位更灵活。',
  },
  foul: {
    title: '犯规提示',
    text: (msg) => `${msg} 提示：白球不能落袋，且必须先碰合法目标球，击球后需有球碰库或进袋。`,
  },
  ballInHand: {
    title: '自由球',
    text: '白球进袋或犯规后获得自由球。移动鼠标选择位置，左键确认摆放。',
  },
  settings: {
    title: '设置提示',
    text: '这里可以开关辅助线、小地图和音效。按 F11 或点击上方按钮可随时回来调整。',
  },
};

export class OnboardingTips {
  constructor() {
    this._card = null;
    this._hideTimer = null;
  }

  /**
   * Show a one-time tip card.
   * @param {string} key - tip key in TIPS
   * @param {string} [dynamicText] - optional replacement text (for foul reasons)
   * @param {number} [autoDismissMs] - auto-hide after ms (0 = no auto-hide)
   */
  show(key, dynamicText = null, autoDismissMs = 0) {
    const tip = TIPS[key];
    if (!tip) return;

    this._ensureCard();
    if (!this._card) return;

    const text = typeof tip.text === 'function'
      ? tip.text(dynamicText ?? '')
      : tip.text;

    this._card.querySelector('.ob-title').textContent = tip.title;
    this._card.querySelector('.ob-text').textContent = text;
    this._card.style.opacity = '1';
    this._card.style.transform = 'translateX(-50%) translateY(0)';

    if (this._hideTimer) clearTimeout(this._hideTimer);
    if (autoDismissMs > 0) {
      this._hideTimer = setTimeout(() => this.hide(), animMs(autoDismissMs));
    }
  }

  hide() {
    if (!this._card) return;
    this._card.style.opacity = '0';
    this._card.style.transform = 'translateX(-50%) translateY(20px)';
    if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; }
  }

  destroy() {
    this.hide();
    if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; }
    if (this._card && this._card.parentNode) {
      this._card.parentNode.removeChild(this._card);
    }
    this._card = null;
  }

  _ensureCard() {
    if (this._card && this._card.parentNode) return;
    const uiLayer = document.getElementById('ui-layer');
    if (!uiLayer) return;

    const card = document.createElement('div');
    card.id = 'onboarding-tip';
    card.style.cssText = `
      position: absolute;
      bottom: 140px;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      max-width: 420px;
      padding: 14px 20px;
      background: rgba(12, 16, 22, 0.92);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 12px;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(12px);
      color: #fff;
      font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
      z-index: 20;
      opacity: 0;
      transition: opacity calc(0.35s / var(--ui-anim-speed)) ease,
                  transform calc(0.35s / var(--ui-anim-speed)) ease;
      pointer-events: auto;
      user-select: none;
    `;

    const title = document.createElement('div');
    title.className = 'ob-title';
    title.style.cssText = `
      font-size: 13px;
      font-weight: 700;
      color: #ffd700;
      margin-bottom: 6px;
      letter-spacing: 0.5px;
    `;

    const text = document.createElement('div');
    text.className = 'ob-text';
    text.style.cssText = `
      font-size: 12.5px;
      line-height: 1.55;
      color: rgba(255, 255, 255, 0.88);
    `;

    const row = document.createElement('div');
    row.style.cssText = 'display: flex; align-items: center; justify-content: space-between; margin-top: 10px;';

    const gotIt = document.createElement('button');
    gotIt.textContent = '知道了';
    gotIt.style.cssText = `
      padding: 5px 14px;
      font-size: 12px;
      font-weight: 700;
      color: #111;
      background: #ffd700;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      transition: filter 0.15s;
    `;
    gotIt.onmouseenter = () => { gotIt.style.filter = 'brightness(1.15)'; };
    gotIt.onmouseleave = () => { gotIt.style.filter = 'brightness(1)'; };
    gotIt.onclick = () => { this.hide(); };

    row.appendChild(gotIt);

    card.appendChild(title);
    card.appendChild(text);
    card.appendChild(row);

    uiLayer.appendChild(card);
    this._card = card;
  }
}

/**
 * Convenience: show a tip once and mark it in onboarding store.
 */
export function showOnce(tipsInstance, storeKey, tipKey, dynamicText = null, autoDismissMs = 0) {
  if (onboarding.get(storeKey)) return;
  try {
    tipsInstance.show(tipKey, dynamicText, autoDismissMs);
    onboarding.set(storeKey, true);
  } catch (e) {
    // Tip display failed (e.g. missing ui-layer), don't mark as shown so it retries next time
  }
}
