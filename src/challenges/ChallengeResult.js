/**
 * ChallengeResult — Post-challenge summary overlay.
 *
 * Shows stars earned, stats, and retry/exit buttons.
 */
export class ChallengeResult {
  constructor(onRetry, onExit) {
    this.onRetry = onRetry;
    this.onExit = onExit;
    this.container = null;
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
    `;

    // Card
    const card = document.createElement('div');
    card.style.cssText = `
      width: 400px; max-width: 90vw;
      padding: 36px;
      background: rgba(20,20,20,0.95);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 20px;
      text-align: center;
    `;

    // Title
    this.titleEl = document.createElement('div');
    this.titleEl.style.cssText = 'font-size: 28px; font-weight: 800; color: #fff; margin-bottom: 8px;';
    card.appendChild(this.titleEl);

    // Subtitle
    this.subtitleEl = document.createElement('div');
    this.subtitleEl.style.cssText = 'font-size: 14px; color: rgba(255,255,255,0.5); margin-bottom: 20px;';
    card.appendChild(this.subtitleEl);

    // Stars
    this.starsEl = document.createElement('div');
    this.starsEl.style.cssText = 'font-size: 36px; color: #ffd700; margin-bottom: 24px; letter-spacing: 4px;';
    card.appendChild(this.starsEl);

    // Stats
    this.statsEl = document.createElement('div');
    this.statsEl.style.cssText = 'margin-bottom: 28px; text-align: left;';
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
      cursor: pointer; transition: all 0.2s;
      pointer-events: auto;
    `;
  }

  show(name, completed, stars, stats = {}) {
    this.container.style.display = 'flex';

    if (completed) {
      this.titleEl.textContent = '🎉 挑战成功！';
      this.titleEl.style.color = '#00e676';
      this.starsEl.textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
      this.subtitleEl.textContent = `${name} — 获得 ${stars} 星`;
    } else {
      this.titleEl.textContent = '💔 挑战失败';
      this.titleEl.style.color = '#ff5252';
      this.starsEl.textContent = '☆☆☆';
      this.subtitleEl.textContent = name;
    }

    // Render stats
    const rows = [];
    if (typeof stats.duration === 'number') rows.push(`⏱ 用时: ${stats.duration.toFixed(1)}s`);
    if (stats.fouls !== undefined) rows.push(`⚠ 犯规: ${stats.fouls}`);
    if (stats.spinPockets !== undefined) rows.push(`🌀 旋转进球: ${stats.spinPockets}`);
    if (stats.breakPocketed !== undefined) rows.push(`🎱 开球进袋: ${stats.breakPocketed}`);

    this.statsEl.innerHTML = rows.length
      ? rows.map((r) => `<div style="padding:4px 0;color:rgba(255,255,255,0.7);font-size:13px;">${r}</div>`).join('')
      : '<div style="color:rgba(255,255,255,0.4);font-size:13px;">暂无详细数据</div>';
  }

  hide() {
    this.container.style.display = 'none';
  }

  _setupKeyboard() {
    this._onKeyDown = (e) => {
      if (e.key === 'Escape' && this.container && this.container.style.display === 'flex') {
        this.hide();
        if (this.onExit) this.onExit();
      }
    };
    window.addEventListener('keydown', this._onKeyDown);
  }

  destroy() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    if (this._onKeyDown) {
      window.removeEventListener('keydown', this._onKeyDown);
      this._onKeyDown = null;
    }
  }
}
