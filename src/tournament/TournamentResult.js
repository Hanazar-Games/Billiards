/**
 * TournamentResult — Post-tournament ceremony overlay.
 *
 * Shows either:
 *   - Champion screen (gold trophy, stats, replay prompt)
 *   - Elimination screen (silver/bronze consolation, round reached)
 */

import { animMs } from '../core/AnimSpeed.js';

export class TournamentResult {
  constructor(onRematch, onBack) {
    this.onRematch = onRematch;
    this.onBack = onBack;
    this.container = null;
    this._timer = null;
    this._buildUI();
  }

  _buildUI() {
    const layer = document.getElementById('menu-layer');
    if (!layer) return;

    this.container = document.createElement('div');
    this.container.style.cssText = `
      display: none; flex-direction: column;
      align-items: center; justify-content: center;
      width: 100%; height: 100%;
      position: absolute; inset: 0;
      z-index: 3;
      background: rgba(5,7,8,0.88);
      backdrop-filter: blur(14px);
      transition: opacity calc(0.5s / var(--ui-anim-speed)) ease;
    `;

    this.card = document.createElement('div');
    this.card.style.cssText = `
      background: var(--panel-strong, rgba(20,24,28,0.95));
      border: 1px solid var(--line, rgba(255,255,255,0.12));
      border-radius: 20px;
      padding: 40px 44px;
      min-width: 340px; max-width: 480px;
      display: flex; flex-direction: column;
      align-items: center; gap: 18px;
      box-shadow: 0 32px 100px rgba(0,0,0,0.6);
      text-align: center;
      animation: panelIn calc(0.5s / var(--ui-anim-speed)) var(--ease) both;
    `;

    this.container.appendChild(this.card);
    layer.appendChild(this.container);
  }

  showChampion(playerName, opponentName, mode) {
    this._render({
      isChampion: true,
      playerName,
      opponentName,
      mode,
      trophyIcon: '🏆',
      trophyName: '冠军金杯',
      trophyColor: '#ffd700',
      headline: '锦标赛冠军',
      subline: `你在决赛中击败了 ${_esc(opponentName)}`,
    });
  }

  showEliminated(playerName, roundName, trophy) {
    this._render({
      isChampion: false,
      playerName,
      roundName,
      trophyIcon: trophy?.icon || '',
      trophyName: trophy?.name || '',
      trophyColor: trophy?.color || 'rgba(255,255,255,0.5)',
      headline: '锦标赛结束',
      subline: `你在 ${roundName} 中止步`,
    });
  }

  _render(data) {
    if (!this.container) return;
    this.card.innerHTML = '';

    // Trophy icon
    const icon = document.createElement('div');
    icon.textContent = data.trophyIcon;
    icon.style.cssText = `
      font-size: 56px; line-height: 1;
      filter: drop-shadow(0 8px 24px ${data.trophyColor}44);
      animation: titleFloat calc(3s / var(--ui-anim-speed)) ease-in-out infinite;
    `;
    this.card.appendChild(icon);

    // Headline
    const headline = document.createElement('div');
    headline.textContent = data.headline;
    headline.style.cssText = `
      font-size: 24px; font-weight: 900; color: #fff;
      letter-spacing: 3px; text-transform: uppercase;
    `;
    this.card.appendChild(headline);

    // Subline
    const sub = document.createElement('div');
    sub.textContent = data.subline;
    sub.style.cssText = `
      font-size: 14px; color: rgba(255,255,255,0.6);
      line-height: 1.5; max-width: 320px;
    `;
    this.card.appendChild(sub);

    // Trophy name badge
    if (data.trophyName) {
      const badge = document.createElement('div');
      badge.textContent = data.trophyName;
      badge.style.cssText = `
        padding: 6px 18px; border-radius: 999px;
        background: ${data.trophyColor}22;
        border: 1px solid ${data.trophyColor}55;
        color: ${data.trophyColor};
        font-size: 13px; font-weight: 800; letter-spacing: 1px;
      `;
      this.card.appendChild(badge);
    }

    // Action buttons
    const btnRow = document.createElement('div');
    btnRow.style.cssText = `
      display: flex; gap: 12px; width: 100%; margin-top: 8px;
    `;

    const rematchBtn = document.createElement('button');
    rematchBtn.type = 'button';
    rematchBtn.textContent = '再来一届';
    rematchBtn.style.cssText = `
      flex: 1; padding: 12px 0;
      background: linear-gradient(90deg, rgba(216,177,95,0.25), rgba(180,140,60,0.2));
      border: 1px solid rgba(216,177,95,0.55);
      border-radius: 10px; color: #f0d78c;
      font-size: 14px; font-weight: 800; cursor: pointer;
      pointer-events: auto; letter-spacing: 1px;
      transition: all calc(0.2s / var(--ui-anim-speed)) ease;
    `;
    rematchBtn.onmouseenter = () => {
      rematchBtn.style.background = 'linear-gradient(90deg, rgba(216,177,95,0.4), rgba(180,140,60,0.35))';
      rematchBtn.style.transform = 'translateY(-1px)';
    };
    rematchBtn.onmouseleave = () => {
      rematchBtn.style.background = 'linear-gradient(90deg, rgba(216,177,95,0.25), rgba(180,140,60,0.2))';
      rematchBtn.style.transform = 'translateY(0)';
    };
    rematchBtn.onclick = () => {
      this.hide();
      if (this.onRematch) this.onRematch();
    };
    btnRow.appendChild(rematchBtn);

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.textContent = '返回菜单';
    backBtn.style.cssText = `
      flex: 1; padding: 12px 0;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 10px; color: rgba(255,255,255,0.8);
      font-size: 14px; font-weight: 800; cursor: pointer;
      pointer-events: auto;
      transition: all calc(0.2s / var(--ui-anim-speed)) ease;
    `;
    backBtn.onmouseenter = () => {
      backBtn.style.background = 'rgba(255,255,255,0.12)';
      backBtn.style.borderColor = 'rgba(255,255,255,0.3)';
    };
    backBtn.onmouseleave = () => {
      backBtn.style.background = 'rgba(255,255,255,0.06)';
      backBtn.style.borderColor = 'rgba(255,255,255,0.15)';
    };
    backBtn.onclick = () => {
      this.hide();
      if (this.onBack) this.onBack();
    };
    btnRow.appendChild(backBtn);

    this.card.appendChild(btnRow);

    this.container.style.display = 'flex';
    this.container.style.opacity = '0';
    requestAnimationFrame(() => {
      if (this.container) this.container.style.opacity = '1';
    });
  }

  hide() {
    if (!this.container) return;
    this.container.style.opacity = '0';
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      if (this.container) this.container.style.display = 'none';
    }, animMs(400));
  }

  destroy() {
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
  }
}

function _esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
