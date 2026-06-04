/**
 * TrainerResult — Post-drill summary overlay for Shot Trainer mode.
 *
 * Shows stars earned, feedback, historical comparison, and retry/exit buttons.
 */
export class TrainerResult {
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
    this.container.id = 'trainer-result';
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
      width: 420px; max-width: 90vw;
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
    this.subtitleEl.style.cssText = 'font-size: 14px; color: rgba(255,255,255,0.5); margin-bottom: 12px;';
    card.appendChild(this.subtitleEl);

    // New best banner
    this.newBestEl = document.createElement('div');
    this.newBestEl.style.cssText = `
      font-size: 13px; font-weight: 700; color: #ffd700;
      background: rgba(255,215,0,0.12);
      border: 1px solid rgba(255,215,0,0.3);
      border-radius: 8px;
      padding: 6px 14px;
      margin-bottom: 16px;
      display: none;
    `;
    card.appendChild(this.newBestEl);

    // Stars
    this.starsEl = document.createElement('div');
    this.starsEl.style.cssText = 'font-size: 36px; color: #ffd700; margin-bottom: 20px; letter-spacing: 4px;';
    card.appendChild(this.starsEl);

    // Feedback
    this.feedbackEl = document.createElement('div');
    this.feedbackEl.style.cssText = 'font-size: 14px; color: rgba(255,255,255,0.7); margin-bottom: 24px; line-height: 1.6;';
    card.appendChild(this.feedbackEl);

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
    exitBtn.textContent = '返回训练列表';
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

    const { powerError, isNewBestStars, isNewBestPowerError, completions, prevBestStars } = stats;

    const safeStars = Number.isFinite(stars) ? Math.max(0, Math.min(3, Math.floor(stars))) : 0;
    if (completed) {
      this.titleEl.textContent = '🎉 练习成功！';
      this.titleEl.style.color = '#00e676';
      this.starsEl.textContent = '★'.repeat(safeStars) + '☆'.repeat(3 - safeStars);
      this.subtitleEl.textContent = `${name} — 获得 ${safeStars} 星`;

      // New best banner
      const banners = [];
      if (isNewBestStars) banners.push('🌟 新纪录！');
      else if (isNewBestPowerError) banners.push('🎯 最佳力度！');
      if (banners.length > 0) {
        this.newBestEl.textContent = banners.join('  ');
        this.newBestEl.style.display = 'inline-block';
      } else {
        this.newBestEl.style.display = 'none';
      }

      // Feedback text based on stars
      if (safeStars === 3) {
        this.feedbackEl.textContent = '完美！你的击球精准度和控制力都达到了优秀水平。';
      } else if (safeStars === 2) {
        this.feedbackEl.textContent = '不错的表现！再微调一下力度或角度即可满分。';
      } else {
        this.feedbackEl.textContent = '完成了！继续保持练习，逐步提高稳定性。';
      }
    } else {
      this.titleEl.textContent = '💔 练习失败';
      this.titleEl.style.color = '#ff5252';
      this.starsEl.textContent = '☆☆☆';
      this.subtitleEl.textContent = name;
      this.newBestEl.style.display = 'none';
      this.feedbackEl.textContent = '目标球未进袋。建议查看瞄准提示，调整击球角度和力度。';
    }

    // Render stats
    const rows = [];
    if (Number.isFinite(stats.power)) rows.push(`💪 击球力度: ${Math.round(stats.power)}%`);
    if (Number.isFinite(powerError)) rows.push(`🎯 力度误差: ${powerError.toFixed(1)}` + (isNewBestPowerError ? ' (新最佳!)' : ''));
    if (Number.isFinite(stats.distance)) rows.push(`📏 走位偏差: ${stats.distance.toFixed(1)}cm`);
    if (Number.isFinite(completions)) rows.push(`✅ 累计完成: ${completions} 次`);
    if (Number.isFinite(stats.attempts)) rows.push(`🎯 累计尝试: ${stats.attempts} 次`);
    if (Number.isFinite(prevBestStars) && prevBestStars > 0 && !isNewBestStars) {
      rows.push(`🏆 历史最佳: ${prevBestStars} 星`);
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
      if (!this.container || this.container.style.display !== 'flex') return;
      if (e.key === 'Escape') {
        this.hide();
        if (this.onExit) this.onExit();
      } else if (e.key === 'Enter') {
        this.hide();
        if (this.onRetry) this.onRetry();
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
