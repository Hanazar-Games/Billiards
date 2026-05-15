/**
 * StatsPanel - Collapsible in-game statistics HUD.
 *
 * Lives in the bottom-right corner. Click the small button to expand
 * and see live match stats updated every turn.
 */
export class StatsPanel {
  constructor() {
    this.visible = false;
    this.lastStats = null;
    this._buildUI();
  }

  _buildUI() {
    const uiLayer = document.getElementById('ui-layer');
    if (!uiLayer) return;

    // Toggle button (small, bottom-right)
    this.toggleBtn = document.createElement('button');
    this.toggleBtn.textContent = '📊';
    this.toggleBtn.title = '对局统计';
    this.toggleBtn.style.cssText = `
      position: absolute;
      bottom: 90px;
      right: 12px;
      width: 36px;
      height: 36px;
      font-size: 18px;
      line-height: 1;
      background: rgba(0,0,0,0.5);
      color: #fff;
      border: 1px solid rgba(255,255,255,0.25);
      border-radius: 50%;
      cursor: pointer;
      pointer-events: auto;
      backdrop-filter: blur(4px);
      transition: background calc(0.2s / var(--ui-anim-speed)), transform 0.2s;
      z-index: 10;
    `;
    this.toggleBtn.onmouseenter = () => {
      this.toggleBtn.style.background = 'rgba(255,255,255,0.2)';
      this.toggleBtn.style.transform = 'scale(1.1)';
    };
    this.toggleBtn.onmouseleave = () => {
      this.toggleBtn.style.background = 'rgba(0,0,0,0.5)';
      this.toggleBtn.style.transform = 'scale(1)';
    };
    this.toggleBtn.onclick = () => this.toggle();
    uiLayer.appendChild(this.toggleBtn);

    // Panel container
    this.panel = document.createElement('div');
    this.panel.style.cssText = `
      position: absolute;
      bottom: 132px;
      right: 12px;
      width: 260px;
      max-height: 0;
      overflow: hidden;
      background: rgba(0,0,0,0.65);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 12px;
      backdrop-filter: blur(10px);
      pointer-events: auto;
      transition: max-height calc(0.35s / var(--ui-anim-speed)) ease, opacity 0.25s ease;
      opacity: 0;
      padding: 0 14px;
      color: #fff;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 13px;
      z-index: 10;
      user-select: none;
    `;
    uiLayer.appendChild(this.panel);

    // Content container (separate so padding works with transition)
    this.content = document.createElement('div');
    this.content.style.cssText = 'padding: 12px 0;';
    this.panel.appendChild(this.content);

    this._renderEmpty();
  }

  _renderEmpty() {
    this.content.innerHTML = `
      <div style="text-align:center;color:rgba(255,255,255,0.5);font-size:12px;">
        第一杆后显示统计
      </div>
    `;
  }

  toggle() {
    if (!this.panel || !this.toggleBtn) return;
    this.visible = !this.visible;
    if (this.visible) {
      this.panel.style.maxHeight = '520px';
      this.panel.style.opacity = '1';
      this.panel.style.padding = '0 14px';
      this.toggleBtn.style.background = 'rgba(255,255,255,0.25)';
    } else {
      this.panel.style.maxHeight = '0';
      this.panel.style.opacity = '0';
      this.panel.style.padding = '0 14px';
      this.toggleBtn.style.background = 'rgba(0,0,0,0.5)';
    }
  }

  hide() {
    if (!this.panel) return;
    if (this.visible) this.toggle();
  }

  reset() {
    this.lastStats = null;
    if (this.content) this._renderEmpty();
    if (this.visible) this.hide();
  }

  /**
   * Update the panel with fresh live stats.
   * @param {Object} stats - output from StatsTracker.getLiveStats()
   */
  update(stats) {
    if (!this.content) return;
    this.lastStats = stats;
    if (!stats || !stats.player1 || !stats.player2) return;

    const p1 = stats.player1;
    const p2 = stats.player2;
    const streakText = stats.longestStreak.count > 0
      ? `玩家 ${stats.longestStreak.player}：${stats.longestStreak.count} 连击`
      : '-';

    this.content.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <span style="font-weight:bold;font-size:14px;">📊 对局统计</span>
        <span style="color:rgba(255,255,255,0.6);font-size:11px;">${stats.duration}</span>
      </div>

      <div style="display:flex;gap:6px;margin-bottom:10px;">
        <div style="flex:1;background:rgba(220,20,60,0.35);padding:8px;border-radius:8px;text-align:center;">
          <div style="font-weight:bold;font-size:13px;">玩家 1</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.7);margin-top:2px;">${p1.pocketed} 进球</div>
        </div>
        <div style="flex:1;background:rgba(30,144,255,0.35);padding:8px;border-radius:8px;text-align:center;">
          <div style="font-weight:bold;font-size:13px;">玩家 2</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.7);margin-top:2px;">${p2.pocketed} 进球</div>
        </div>
      </div>

      <div style="margin-bottom:6px;font-size:11px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.5px;">
        玩家 1 详情
      </div>
      ${this._renderPlayerStats(p1)}

      <div style="margin:10px 0 6px;font-size:11px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.5px;">
        玩家 2 详情
      </div>
      ${this._renderPlayerStats(p2)}

      <div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.1);">
        <div style="display:flex;justify-content:space-between;font-size:11px;">
          <span style="color:rgba(255,255,255,0.5);">出杆：</span>
          <span>${stats.totalTurns}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:11px;margin-top:3px;">
          <span style="color:rgba(255,255,255,0.5);">最高连击：</span>
          <span>${streakText}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:11px;margin-top:3px;">
          <span style="color:rgba(255,255,255,0.5);">碰撞：</span>
          <span>${stats.totalCollisions}</span>
        </div>
      </div>
    `;
  }

  _renderPlayerStats(p) {
    const row = (label, value) => `
      <div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0;">
        <span style="color:rgba(255,255,255,0.6);">${label}</span>
        <span>${value}</span>
      </div>
    `;

    return `
      <div>
        ${row('出杆', p.shots)}
        ${row('进球', p.pocketed)}
        ${row('犯规', p.fouls)}
        ${row('Scratches', p.scratches)}
        ${row('平均力度', typeof p.avgPower === 'number' ? p.avgPower.toFixed(1) : 'N/A')}
        ${row('最大力度', p.maxPower)}
        ${row('进球率', p.pocketRate)}
        ${row('最高连击', p.streak)}
      </div>
    `;
  }

  /** Show end-of-game summary with highlighted winner. */
  showGameOver(summary, aiEnabled) {
    if (!this.content) return;
    if (!summary || !summary.player1 || !summary.player2 || !summary.match) {
      console.warn('StatsPanel.showGameOver: invalid summary', summary);
      return;
    }
    this.lastStats = summary;
    if (!this.visible) {
      this.toggle();
    } else {
      // Already visible — refresh content without toggling
      this.panel.style.maxHeight = '520px';
      this.panel.style.opacity = '1';
    }

    const p1 = summary.player1;
    const p2 = summary.player2;
    const winnerName = summary.winner === 1 ? '玩家 1' : (aiEnabled ? 'AI' : '玩家 2');

    this.content.innerHTML = `
      <div style="text-align:center;margin-bottom:12px;">
        <div style="font-weight:bold;font-size:16px;color:#ffd700;">🏆 ${winnerName} 获胜！</div>
        <div style="font-size:11px;color:rgba(255,255,255,0.5);margin-top:4px;">
          对局时长 ${this._fmtTime(summary.duration)}
        </div>
      </div>

      <div style="display:flex;gap:6px;margin-bottom:12px;">
        <div style="flex:1;background:rgba(220,20,60,0.3);padding:10px;border-radius:8px;">
          <div style="font-weight:bold;text-align:center;margin-bottom:6px;">玩家 1</div>
          ${this._renderFinalPlayer(p1)}
        </div>
        <div style="flex:1;background:rgba(30,144,255,0.3);padding:10px;border-radius:8px;">
          <div style="font-weight:bold;text-align:center;margin-bottom:6px;">${aiEnabled ? 'AI' : '玩家 2'}</div>
          ${this._renderFinalPlayer(p2)}
        </div>
      </div>

      <div style="text-align:center;font-size:11px;color:rgba(255,255,255,0.4);">
        总出杆：${summary.totalTurns} · 碰撞：${summary.match.totalBallCollisions + summary.match.totalCushionCollisions}
      </div>
    `;
  }

  _renderFinalPlayer(p) {
    return `
      <div style="font-size:11px;line-height:1.6;">
        <div style="display:flex;justify-content:space-between;"><span>出杆</span><span>${Math.round(p.shots)}</span></div>
        <div style="display:flex;justify-content:space-between;"><span>进球</span><span>${Math.round(p.ballsPocketed)}</span></div>
        <div style="display:flex;justify-content:space-between;"><span>犯规</span><span>${Math.round(p.fouls)}</span></div>
        <div style="display:flex;justify-content:space-between;"><span>平均力度</span><span>${typeof p.avgPower === 'number' ? p.avgPower.toFixed(1) : 'N/A'}</span></div>
        <div style="display:flex;justify-content:space-between;"><span>最大力度</span><span>${Math.round(p.maxPower)}</span></div>
      </div>
    `;
  }

  _fmtTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  destroy() {
    if (this.toggleBtn && this.toggleBtn.parentNode) {
      this.toggleBtn.onmouseenter = null;
      this.toggleBtn.onmouseleave = null;
      this.toggleBtn.onclick = null;
      this.toggleBtn.parentNode.removeChild(this.toggleBtn);
    }
    if (this.panel && this.panel.parentNode) {
      this.panel.parentNode.removeChild(this.panel);
    }
    this.toggleBtn = null;
    this.panel = null;
    this.content = null;
  }
}
