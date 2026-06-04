/**
 * TournamentResult — Post-tournament ceremony overlay.
 *
 * Shows either:
 *   - Champion screen (gold trophy, stats, replay prompt)
 *   - Elimination screen (silver/bronze consolation, round reached)
 *
 * v2 adds:
 *   - Season context (total entries, championships, streak)
 *   - Opponents faced list with style tags
 *   - Rich post-match summary
 */

import { animMs } from '../core/AnimSpeed.js';
import { getStyleMeta } from './TournamentData.js';

export class TournamentResult {
  constructor(onRematch, onBack) {
    this.onRematch = onRematch;
    this.onBack = onBack;
    this.container = null;
    this._timer = null;
    this._shown = false;
    this._buildUI();
    this._setupKeyboard();
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
      min-width: 340px; max-width: 520px;
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
    if (this._shown) return;
    this._shown = true;
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
    if (this._shown) return;
    this._shown = true;
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

  /** v2 rich summary with opponents list and season context. */
  showSummary(summary, seasonStats) {
    if (!summary || this._shown) return;
    this._shown = true;
    if (summary.isChampion) {
      const finalOpponent = summary.opponentsFaced[summary.opponentsFaced.length - 1];
      this._render({
        isChampion: true,
        playerName: summary.player?.name,
        opponentName: finalOpponent?.name,
        mode: summary.mode,
        trophyIcon: '🏆',
        trophyName: '冠军金杯',
        trophyColor: '#ffd700',
        headline: '锦标赛冠军',
        subline: `你在决赛中击败了 ${_esc(finalOpponent?.name || '???')}`,
      });
    } else {
      const lastMatch = summary.opponentsFaced[summary.opponentsFaced.length - 1];
      const roundName = lastMatch ? (lastMatch.round === 0 ? '八强赛' : lastMatch.round === 1 ? '半决赛' : '决赛') : '八强赛';
      this._render({
        isChampion: false,
        playerName: summary.player?.name,
        roundName,
        trophyIcon: summary.trophy?.icon || '',
        trophyName: summary.trophy?.name || '',
        trophyColor: summary.trophy?.color || 'rgba(255,255,255,0.5)',
        headline: '锦标赛结束',
        subline: `你在 ${roundName} 中止步`,
      });
    }
    // Append extra content to card
    this._appendOpponentsList(summary.opponentsFaced);
    this._appendSeasonContext(seasonStats, summary.isChampion);
  }

  _render(data) {
    if (!this.container) return;
    this.container.style.display = 'flex';
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
  }

  _appendOpponentsList(opponentsFaced) {
    if (!opponentsFaced || opponentsFaced.length === 0) return;
    const wrap = document.createElement('div');
    wrap.style.cssText = `
      width: 100%; display: flex; flex-direction: column; gap: 6px;
      margin-top: 4px;
    `;

    const label = document.createElement('div');
    label.textContent = '本届赛事击败的对手';
    label.style.cssText = `
      font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.45);
      text-transform: uppercase; letter-spacing: 1px;
      text-align: left;
    `;
    wrap.appendChild(label);

    const row = document.createElement('div');
    row.style.cssText = `
      display: flex; flex-wrap: wrap; gap: 6px;
      justify-content: center;
    `;

    for (const opp of opponentsFaced) {
      if (!opp.playerWon) continue; // only show defeated opponents
      const meta = getStyleMeta(opp.style);
      const chip = document.createElement('span');
      chip.style.cssText = `
        font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.75);
        background: rgba(255,255,255,0.06); padding: 4px 10px; border-radius: 6px;
        border: 1px solid rgba(255,255,255,0.1);
      `;
      const roundNames = ['八强', '四强', '决赛'];
      chip.textContent = `${meta.icon} ${_esc(opp.name)} (${roundNames[opp.round] || ''})`;
      row.appendChild(chip);
    }

    if (row.children.length > 0) {
      wrap.appendChild(row);
      this.card.appendChild(wrap);
    }
  }

  _appendSeasonContext(seasonStats, isChampion) {
    if (!seasonStats) return;
    const ctx = document.createElement('div');
    ctx.style.cssText = `
      width: 100%; padding: 10px 12px; margin-top: 4px;
      background: rgba(255,255,255,0.04); border-radius: 10px;
      font-size: 12px; color: rgba(255,255,255,0.55);
      line-height: 1.6;
    `;

    const parts = [`这是你第 ${seasonStats.totalEntered} 次参赛`];
    if (isChampion) {
      parts.push(`累计夺冠 ${seasonStats.championships} 次`);
      if (seasonStats.currentStreak > 1) {
        parts.push(`当前连胜 ${seasonStats.currentStreak} 届 🔥`);
      }
    }
    if (seasonStats.bestStreak > 0) {
      parts.push(`最佳连胜纪录 ${seasonStats.bestStreak} 届`);
    }

    ctx.textContent = parts.join(' · ');
    this.card.appendChild(ctx);

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
    this._shown = false;
    if (!this.container) return;
    this.container.style.opacity = '0';
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      if (this.container) this.container.style.display = 'none';
    }, animMs(400));
  }

  destroy() {
    this._shown = false;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    if (this._onKeyDown) {
      window.removeEventListener('keydown', this._onKeyDown);
      this._onKeyDown = null;
    }
    if (this.container) {
      this.container.innerHTML = '';
      if (this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
      }
    }
    this.container = null;
    this.card = null;
  }

  _setupKeyboard() {
    this._onKeyDown = (e) => {
      if (e.key === 'Escape' && this._shown) {
        this.hide();
        if (this.onBack) this.onBack();
      }
    };
    window.addEventListener('keydown', this._onKeyDown);
  }
}

function _esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
