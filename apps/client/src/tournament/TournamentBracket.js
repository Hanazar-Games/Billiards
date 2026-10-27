/**
 * TournamentBracket — Renders a single-elimination bracket as DOM nodes.
 *
 * Layout strategy (8 players):
 *   Round 0 (quarter): 4 matches, left column
 *   Round 1 (semi):    2 matches, middle column
 *   Round 2 (final):   1 match, right column
 *
 * Each match card shows both players, scores, and a connector line.
 */

import { animMs, isReducedMotion } from '../core/AnimSpeed.js';
import { TournamentEngine } from './TournamentEngine.js';
import { getStyleMeta } from './TournamentData.js';

export class TournamentBracket {
  constructor(container) {
    this.container = container;
    this.wrapper = null;
    this._staggerTimers = [];
  }

  render(rounds, currentRound, currentMatchIndex, champion) {
    if (!this.container) return;
    this.destroy();

    this.wrapper = document.createElement('div');
    this.wrapper.className = 'tournament-bracket';
    this.wrapper.style.cssText = `
      display: flex; align-items: center; justify-content: center;
      gap: 48px; padding: 24px 12px;
      overflow-x: auto; max-width: 100%;
    `;

    rounds.forEach((round, rIdx) => {
      const col = document.createElement('div');
      col.style.cssText = `
        display: flex; flex-direction: column;
        justify-content: center; gap: 20px;
        min-width: 220px;
      `;

      const roundTitle = document.createElement('div');
      roundTitle.textContent = TournamentEngine.getRoundName(rIdx);
      roundTitle.style.cssText = `
        text-align: center; font-size: 13px; font-weight: 700;
        color: rgba(216,177,95,0.8); letter-spacing: 2px;
        margin-bottom: 4px; text-transform: uppercase;
      `;
      col.appendChild(roundTitle);

      round.forEach((match, mIdx) => {
        const isCurrent = rIdx === currentRound && mIdx === currentMatchIndex && !match.played;
        const card = this._buildMatchCard(match, isCurrent);
        col.appendChild(card);
      });

      this.wrapper.appendChild(col);
    });

    // Champion column (optional)
    if (champion) {
      const champCol = document.createElement('div');
      champCol.style.cssText = `
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        min-width: 160px; gap: 8px;
      `;
      const champTitle = document.createElement('div');
      champTitle.textContent = '冠军';
      champTitle.style.cssText = `
        font-size: 13px; font-weight: 700;
        color: rgba(216,177,95,0.8); letter-spacing: 2px;
        text-transform: uppercase;
      `;
      champCol.appendChild(champTitle);

      const champCard = document.createElement('div');
      champCard.style.cssText = `
        padding: 18px 24px; border-radius: 12px;
        background: linear-gradient(135deg, rgba(216,177,95,0.25), rgba(180,140,60,0.15));
        border: 1px solid rgba(216,177,95,0.55);
        text-align: center; color: #fff;
        box-shadow: 0 8px 32px rgba(216,177,95,0.18);
        animation: ${isReducedMotion() ? 'none' : 'panelIn calc(0.5s / var(--ui-anim-speed)) var(--ease) both'};
      `;
      champCard.innerHTML = `
        <div style="font-size:32px;margin-bottom:6px;">🏆</div>
        <div style="font-size:16px;font-weight:800;">${_esc(champion.name)}</div>
        <div style="font-size:11px;color:rgba(255,255,255,0.55);margin-top:2px;">${_esc(champion.title || '')}</div>
      `;
      champCol.appendChild(champCard);
      this.wrapper.appendChild(champCol);
    }

    this.container.appendChild(this.wrapper);

    // Staggered entrance animation for cards
    this._staggerTimers.forEach(t => clearTimeout(t));
    this._staggerTimers = [];
    const cards = this.wrapper.querySelectorAll('.tournament-match-card');
    cards.forEach((card, i) => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(10px)';
      const t = setTimeout(() => {
        card.style.transition = `opacity calc(0.35s / var(--ui-anim-speed)) ease, transform calc(0.35s / var(--ui-anim-speed)) ease`;
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
      }, animMs(80 + i * 60));
      this._staggerTimers.push(t);
    });
  }

  _buildMatchCard(match, isCurrent) {
    const card = document.createElement('div');
    card.className = 'tournament-match-card';

    const p1 = match.player1 || { name: '???', color: 'rgba(255,255,255,0.3)' };
    const p2 = match.player2 || { name: '???', color: 'rgba(255,255,255,0.3)' };
    const winner = match.winner;

    const borderColor = isCurrent ? 'rgba(216,177,95,0.65)' : 'rgba(255,255,255,0.12)';
    const bg = isCurrent ? 'rgba(216,177,95,0.08)' : 'rgba(255,255,255,0.04)';
    const glow = isCurrent ? 'box-shadow: 0 0 18px rgba(216,177,95,0.12);' : '';

    card.style.cssText = `
      width: 220px; border-radius: 10px;
      background: ${bg}; border: 1px solid ${borderColor};
      padding: 10px 14px; ${glow}
      transition: all calc(0.25s / var(--ui-anim-speed)) ease;
    `;

    const rowStyle = (isWinner, isLoser) => `
      display: flex; align-items: center; justify-content: space-between;
      padding: 6px 8px; border-radius: 6px;
      background: ${isWinner ? 'rgba(255,255,255,0.08)' : 'transparent'};
      opacity: ${isLoser ? 0.5 : 1};
    `;

    const nameStyle = (color) => `
      font-size: 13px; font-weight: 700; color: ${color || '#fff'};
      display: flex; align-items: center; gap: 6px;
    `;

    const scoreStyle = `
      font-size: 13px; font-weight: 800;
      color: rgba(255,255,255,0.8); font-variant-numeric: tabular-nums;
    `;

    const tagStyle = `
      font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.45);
      background: rgba(255,255,255,0.06); padding: 1px 6px; border-radius: 4px;
      white-space: nowrap;
    `;

    const p1Winner = winner && winner.id === p1.id;
    const p2Winner = winner && winner.id === p2.id;

    const p1StyleMeta = p1.style && !p1.isPlayer ? getStyleMeta(p1.style) : null;
    const p2StyleMeta = p2.style && !p2.isPlayer ? getStyleMeta(p2.style) : null;

    card.innerHTML = `
      <div style="${rowStyle(p1Winner, !!winner && !p1Winner)}">
        <div style="${nameStyle(p1.color)}">
          ${p1.isPlayer ? '<span style="font-size:11px;">👤</span>' : '<span style="font-size:11px;">🤖</span>'}
          ${_esc(p1.name)}
          ${p1StyleMeta ? `<span style="${tagStyle}">${p1StyleMeta.icon} ${_esc(p1.style)}</span>` : ''}
        </div>
        <div style="${scoreStyle}">${match.played ? match.p1Score : '-'}</div>
      </div>
      <div style="height:1px;background:rgba(255,255,255,0.08);margin:4px 0;"></div>
      <div style="${rowStyle(p2Winner, !!winner && !p2Winner)}">
        <div style="${nameStyle(p2.color)}">
          ${p2.isPlayer ? '<span style="font-size:11px;">👤</span>' : '<span style="font-size:11px;">🤖</span>'}
          ${_esc(p2.name)}
          ${p2StyleMeta ? `<span style="${tagStyle}">${p2StyleMeta.icon} ${_esc(p2.style)}</span>` : ''}
        </div>
        <div style="${scoreStyle}">${match.played ? match.p2Score : '-'}</div>
      </div>
    `;

    if (isCurrent) {
      card.style.cursor = 'pointer';
    }

    return card;
  }

  destroy() {
    this._staggerTimers.forEach(t => clearTimeout(t));
    this._staggerTimers = [];
    if (this.wrapper && this.wrapper.parentNode) {
      this.wrapper.parentNode.removeChild(this.wrapper);
    }
    this.wrapper = null;
  }
}

function _esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
