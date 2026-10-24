/**
 * ChallengeResult — Post-challenge summary overlay.
 *
 * v2 adds:
 *   - Failure reason display
 *   - Achievement conditions (what you needed to do)
 *   - Star standards table
 *   - New-record banner
 *   - Retry / exit buttons (retry already existed)
 */
import { getChallenge, getStarConditions } from './ChallengeData.js';

export class ChallengeResult {
  constructor(onRetry, onExit) {
    this.onRetry = onRetry;
    this.onExit = onExit;
    this.container = null;
    this._shown = false;
    this._buildUI();
    this._setupKeyboard();
  }

  _buildUI() {
    this.container = document.createElement('div');
    this.container.id = 'challenge-result';
    this.container.style.cssText = `
      position: fixed; inset: 0;
      display: none; flex-direction: column;
      align-items: center; justify-content: center;
      background: rgba(0,0,0,0.85);
      backdrop-filter: blur(12px);
      z-index: 250;
      pointer-events: auto;
      padding: 20px;
    `;

    // Card
    const card = document.createElement('div');
    card.style.cssText = `
      width: 420px; max-width: 100%;
      padding: 32px;
      background: rgba(20,20,20,0.95);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 20px;
      text-align: center;
      max-height: 90vh;
      overflow-y: auto;
    `;

    // New record banner (hidden by default)
    this.bannerEl = document.createElement('div');
    this.bannerEl.style.cssText = `
      display: none; margin-bottom: 14px; padding: 8px 16px;
      background: linear-gradient(90deg, #d8b15f, #ffd700);
      color: #1a1200; font-size: 14px; font-weight: 800;
      border-radius: 8px; letter-spacing: 1px;
    `;
    this.bannerEl.textContent = '🏆 新纪录！';
    card.appendChild(this.bannerEl);

    // Title
    this.titleEl = document.createElement('div');
    this.titleEl.style.cssText = 'font-size: 28px; font-weight: 800; color: #fff; margin-bottom: 6px;';
    card.appendChild(this.titleEl);

    // Subtitle
    this.subtitleEl = document.createElement('div');
    this.subtitleEl.style.cssText = 'font-size: 14px; color: rgba(255,255,255,0.5); margin-bottom: 16px;';
    card.appendChild(this.subtitleEl);

    // Stars
    this.starsEl = document.createElement('div');
    this.starsEl.style.cssText = 'font-size: 36px; color: #ffd700; margin-bottom: 20px; letter-spacing: 4px;';
    card.appendChild(this.starsEl);

    // Failure reason
    this.failReasonEl = document.createElement('div');
    this.failReasonEl.style.cssText = `
      display: none; margin-bottom: 16px; padding: 10px 14px;
      background: rgba(255,82,82,0.12); border: 1px solid rgba(255,82,82,0.3);
      border-radius: 8px; color: #ff8a80; font-size: 13px; text-align: left;
    `;
    card.appendChild(this.failReasonEl);

    // Conditions block
    this.conditionsEl = document.createElement('div');
    this.conditionsEl.style.cssText = `
      margin-bottom: 16px; text-align: left;
      background: rgba(255,255,255,0.04); border-radius: 10px; padding: 14px;
    `;
    card.appendChild(this.conditionsEl);

    // Stats
    this.statsEl = document.createElement('div');
    this.statsEl.style.cssText = 'margin-bottom: 24px; text-align: left;';
    card.appendChild(this.statsEl);

    // Buttons
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display: flex; gap: 12px; justify-content: center;';

    const retryBtn = document.createElement('button');
    retryBtn.textContent = '再试一次';
    retryBtn.style.cssText = this._btnStyle('#00e676');
    retryBtn.onmouseenter = () => { retryBtn.style.filter = 'brightness(1.2)'; };
    retryBtn.onmouseleave = () => { retryBtn.style.filter = 'brightness(1)'; };
    retryBtn.onclick = () => {
      this.hide();
      if (this.onRetry) this.onRetry();
    };
    btnRow.appendChild(retryBtn);

    const exitBtn = document.createElement('button');
    exitBtn.textContent = '返回挑战列表';
    exitBtn.style.cssText = this._btnStyle('rgba(255,255,255,0.15)');
    exitBtn.onmouseenter = () => { exitBtn.style.background = 'rgba(255,255,255,0.25)'; };
    exitBtn.onmouseleave = () => { exitBtn.style.background = 'rgba(255,255,255,0.15)'; };
    exitBtn.onclick = () => {
      this.hide();
      if (this.onExit) this.onExit();
    };
    btnRow.appendChild(exitBtn);

    card.appendChild(btnRow);
    this.container.appendChild(card);
    document.body.appendChild(this.container);
  }

  _btnStyle(bg) {
    return `
      padding: 12px 24px;
      font-size: 15px; font-weight: 600; color: #fff;
      background: ${bg};
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 10px;
      cursor: pointer; transition: all calc(0.2s / var(--ui-anim-speed));
      pointer-events: auto;
    `;
  }

  show(name, completed, stars, stats = {}) {
    if (this._shown) return;
    this._shown = true;
    this.container.style.display = 'flex';
    const challenge = stats.challengeId ? getChallenge(stats.challengeId) : null;

    // Banner
    if (stats.isNewRecord) {
      this.bannerEl.style.display = 'block';
      this.bannerEl.textContent = stars === 3 ? '🏆 完美新纪录！' : '🏆 新纪录！';
    } else {
      this.bannerEl.style.display = 'none';
    }

    const safeStars = Number.isFinite(stars) ? Math.max(0, Math.min(3, Math.floor(stars))) : 0;
    if (completed) {
      this.titleEl.textContent = '🎉 挑战成功！';
      this.titleEl.style.color = '#00e676';
      this.starsEl.textContent = '★'.repeat(safeStars) + '☆'.repeat(3 - safeStars);
      this.subtitleEl.textContent = `${name} — 获得 ${safeStars} 星`;
      this.failReasonEl.style.display = 'none';
    } else {
      this.titleEl.textContent = '💔 挑战失败';
      this.titleEl.style.color = '#ff5252';
      this.starsEl.textContent = '☆☆☆';
      this.subtitleEl.textContent = name;
      this.failReasonEl.style.display = 'block';
      this.failReasonEl.textContent = `失败原因：${stats.failureReason || '未达到挑战条件'}`;
    }

    // Conditions block
    const condRows = [];
    if (challenge) {
      condRows.push(`<div style="font-size:12px;color:rgba(255,255,255,0.35);margin-bottom:6px;">挑战条件</div>`);
      condRows.push(`<div style="font-size:13px;color:rgba(255,255,255,0.8);margin-bottom:4px;">${challenge.desc}</div>`);
      const starText = getStarConditions(challenge);
      if (starText) {
        condRows.push(`<div style="font-size:12px;color:#d8b15f;margin-top:6px;">${starText}</div>`);
      }
    }
    this.conditionsEl.innerHTML = condRows.join('');

    // Stats rows
    const rows = [];
    if (typeof stats.duration === 'number') rows.push(`⏱ 用时: ${stats.duration.toFixed(1)}s`);
    if (stats.totalShots !== undefined) rows.push(`🎯 总杆数: ${stats.totalShots}`);
    if (stats.fouls !== undefined) rows.push(`⚠ 犯规: ${stats.fouls}`);
    if (stats.spinPockets !== undefined) rows.push(`🌀 旋转进球: ${stats.spinPockets}`);
    if (stats.breakPocketed !== undefined) rows.push(`🎱 开球进袋: ${stats.breakPocketed}`);
    if (stats.consecutivePockets !== undefined) rows.push(`🔥 最高连击: ${stats.consecutivePockets}`);
    if (stats.totalBallsPocketed !== undefined) rows.push(`🎱 总进球: ${stats.totalBallsPocketed}`);
    if (Number.isFinite(stats.bestStars)) {
      const safeBest = Math.max(0, Math.min(3, Math.floor(stats.bestStars)));
      const bestStr = '★'.repeat(safeBest) + '☆'.repeat(3 - safeBest);
      rows.push(`⭐ 历史最佳: ${bestStr}`);
    }

    this.statsEl.innerHTML = rows.length
      ? rows.map((r) => `<div style="padding:4px 0;color:rgba(255,255,255,0.7);font-size:13px;">${r}</div>`).join('')
      : '<div style="color:rgba(255,255,255,0.4);font-size:13px;">暂无详细数据</div>';
  }

  hide() {
    this._shown = false;
    this.container.style.display = 'none';
  }

  _setupKeyboard() {
    this._onKeyDown = (e) => {
      if (e.key === 'Escape' && this.container && this.container.style.display === 'flex') { e.stopPropagation();
        this.hide();
        if (this.onExit) this.onExit();
      }
    };
    window.addEventListener('keydown', this._onKeyDown);
  }

  destroy() {
    this._shown = false;
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
  }
}
