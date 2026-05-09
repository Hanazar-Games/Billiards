/**
 * ReplayPanel — UI for browsing and playing back recorded shots.
 *
 * Two modes:
 *   1. Library list (from main menu) — grid of saved replays
 *   2. Playback controls (during replay) — overlay with play/pause/speed/time
 */
export class ReplayPanel {
  constructor(replayLibrary, onPlayReplay, onHideList, onExitReplay) {
    this.library = replayLibrary;
    this.onPlayReplay = onPlayReplay;
    this.onHideList = onHideList;
    this.onExitReplay = onExitReplay;
    this.listContainer = null;
    this.controlContainer = null;
    this._buildListUI();
    this._buildControlUI();
    this._setupKeyboard();
  }

  // ── Library List (Main Menu) ──

  _buildListUI() {
    this.listContainer = document.createElement('div');
    this.listContainer.id = 'replay-library';
    this.listContainer.style.cssText = `
      position: fixed; inset: 0;
      display: none; flex-direction: column;
      align-items: center;
      background: rgba(8,8,8,0.97);
      backdrop-filter: blur(20px);
      z-index: 200;
      padding: 40px 20px;
      overflow-y: auto;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex; justify-content: space-between;
      align-items: center; width: 100%;
      max-width: 900px; margin-bottom: 30px;
    `;

    const title = document.createElement('div');
    title.innerHTML = '🎬 <span style="font-size:28px;font-weight:800;color:#fff;">精彩回放</span>';
    header.appendChild(title);

    const count = document.createElement('div');
    count.id = 'replay-count';
    count.style.cssText = 'font-size:14px;color:rgba(255,255,255,0.6);';
    header.appendChild(count);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.title = '关闭';
    closeBtn.style.cssText = `
      width: 40px; height: 40px;
      font-size: 20px; color: #fff;
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 50%;
      cursor: pointer; transition: all 0.2s;
      pointer-events: auto;
    `;
    closeBtn.onmouseenter = () => closeBtn.style.background = 'rgba(255,255,255,0.2)';
    closeBtn.onmouseleave = () => closeBtn.style.background = 'rgba(255,255,255,0.1)';
    closeBtn.onclick = () => {
      this.hideList();
      if (this.onHideList) this.onHideList();
    };
    header.appendChild(closeBtn);

    this.listContainer.appendChild(header);

    // Grid
    const grid = document.createElement('div');
    grid.id = 'replay-grid';
    grid.style.cssText = `
      display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px; max-width: 900px; width: 100%;
    `;
    this.listContainer.appendChild(grid);

    document.body.appendChild(this.listContainer);
  }

  showList() {
    this.listContainer.style.display = 'flex';
    this._renderList();
  }

  hideList() {
    this.listContainer.style.display = 'none';
  }

  _renderList() {
    const grid = document.getElementById('replay-grid');
    const countLabel = document.getElementById('replay-count');
    if (!grid) return;

    grid.innerHTML = '';
    const replays = this.library.getAll();

    if (countLabel) {
      countLabel.textContent = `${replays.length} / 30 已保存`;
    }

    if (replays.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = `
        text-align: center; color: rgba(255,255,255,0.4);
        font-size: 16px; padding: 60px 0; grid-column: 1 / -1;
      `;
      empty.textContent = '暂无精彩回放。打出高分球局后自动保存！';
      grid.appendChild(empty);
      return;
    }

    replays.forEach((replay) => {
      const card = document.createElement('div');
      card.style.cssText = `
        padding: 18px;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 14px;
        transition: all 0.2s;
        pointer-events: auto;
      `;
      card.onmouseenter = () => {
        card.style.background = 'rgba(255,255,255,0.12)';
        card.style.borderColor = 'rgba(255,255,255,0.3)';
      };
      card.onmouseleave = () => {
        card.style.background = 'rgba(255,255,255,0.06)';
        card.style.borderColor = 'rgba(255,255,255,0.12)';
      };

      const topRow = document.createElement('div');
      topRow.style.cssText = `
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 10px;
      `;

      const scoreBadge = document.createElement('div');
      scoreBadge.textContent = `精彩度 ${replay.score}`;
      const scoreColor = replay.score >= 60 ? '#ff1744' : replay.score >= 40 ? '#ff9100' : '#00e676';
      scoreBadge.style.cssText = `
        font-size: 13px; font-weight: 700; color: ${scoreColor};
        background: ${scoreColor}22;
        padding: 4px 10px; border-radius: 6px;
      `;
      topRow.appendChild(scoreBadge);

      const date = document.createElement('div');
      date.textContent = new Date(replay.savedAt).toLocaleDateString();
      date.style.cssText = 'font-size: 11px; color: rgba(255,255,255,0.4);';
      topRow.appendChild(date);

      card.appendChild(topRow);

      const details = document.createElement('div');
      details.style.cssText = `
        font-size: 13px; color: rgba(255,255,255,0.7);
        line-height: 1.6; margin-bottom: 14px;
      `;
      const meta = replay.metadata || {};
      const duration = meta.duration != null ? meta.duration.toFixed(1) + '秒' : 'N/A';
      const pockets = (meta.pocketedIds || []).filter((id) => id !== 0).length;
      const collisions = meta.collisionCount || 0;
      const cushions = meta.cushionCount || 0;
      details.innerHTML = `
        时长: ${duration} · 进球: ${pockets}个<br>
        碰撞: ${collisions}次 · 库边: ${cushions}次
      `;
      card.appendChild(details);

      const btnRow = document.createElement('div');
      btnRow.style.cssText = 'display: flex; gap: 8px;';

      const playBtn = document.createElement('button');
      playBtn.textContent = '▶ 播放';
      playBtn.title = '播放回放';
      playBtn.style.cssText = `
        flex: 1; padding: 10px 0;
        font-size: 14px; font-weight: 600; color: #fff;
        background: rgba(0,230,118,0.2);
        border: 1px solid rgba(0,230,118,0.4);
        border-radius: 8px;
        cursor: pointer; transition: all 0.2s;
        pointer-events: auto;
      `;
      playBtn.onmouseenter = () => {
        playBtn.style.background = 'rgba(0,230,118,0.3)';
      };
      playBtn.onmouseleave = () => {
        playBtn.style.background = 'rgba(0,230,118,0.2)';
      };
      playBtn.onclick = () => {
        if (this.onPlayReplay) this.onPlayReplay(replay);
      };
      btnRow.appendChild(playBtn);

      const delBtn = document.createElement('button');
      delBtn.textContent = '🗑';
      delBtn.title = '删除回放';
      delBtn.style.cssText = `
        width: 40px;
        font-size: 16px; color: rgba(255,255,255,0.6);
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 8px;
        cursor: pointer; transition: all 0.2s;
        pointer-events: auto;
      `;
      delBtn.onmouseenter = () => {
        delBtn.style.background = 'rgba(255,50,50,0.2)';
        delBtn.style.borderColor = 'rgba(255,50,50,0.4)';
      };
      delBtn.onmouseleave = () => {
        delBtn.style.background = 'rgba(255,255,255,0.08)';
        delBtn.style.borderColor = 'rgba(255,255,255,0.15)';
      };
      delBtn.onclick = () => {
        this.library.delete(replay.id);
        this._renderList();
      };
      btnRow.appendChild(delBtn);

      card.appendChild(btnRow);
      grid.appendChild(card);
    });
  }

  // ── Playback Controls (In-Game Overlay) ──

  _buildControlUI() {
    this.controlContainer = document.createElement('div');
    this.controlContainer.id = 'replay-controls';
    this.controlContainer.style.cssText = `
      position: fixed; bottom: 24px; left: 50%;
      transform: translateX(-50%);
      display: none; align-items: center; gap: 14px;
      padding: 12px 24px;
      background: rgba(20,20,20,0.9);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 14px;
      backdrop-filter: blur(12px);
      z-index: 150;
      pointer-events: auto;
    `;

    // Play/Pause button
    this.playBtn = document.createElement('button');
    this.playBtn.textContent = '⏸';
    this.playBtn.title = '播放 / 暂停';
    this.playBtn.style.cssText = this._btnStyle();
    this.controlContainer.appendChild(this.playBtn);

    // Speed button
    this.speedBtn = document.createElement('button');
    this.speedBtn.textContent = '1.0x';
    this.speedBtn.title = '切换播放速度';
    this.speedBtn.style.cssText = this._btnStyle('80px');
    this.controlContainer.appendChild(this.speedBtn);

    // Time display
    this.timeDisplay = document.createElement('div');
    this.timeDisplay.textContent = '0.0 / 0.0s';
    this.timeDisplay.style.cssText = `
      font-size: 13px; color: rgba(255,255,255,0.8);
      font-variant-numeric: tabular-nums;
      min-width: 100px; text-align: center;
    `;
    this.controlContainer.appendChild(this.timeDisplay);

    // Progress bar
    this.progressBar = document.createElement('div');
    this.progressBar.style.cssText = `
      width: 200px; height: 6px;
      background: rgba(255,255,255,0.15);
      border-radius: 3px;
      overflow: hidden; cursor: pointer;
    `;
    this.progressFill = document.createElement('div');
    this.progressFill.style.cssText = `
      width: 0%; height: 100%;
      background: linear-gradient(90deg, #00e676, #00bcd4);
      border-radius: 3px;
      transition: width 0.1s linear;
    `;
    this.progressBar.appendChild(this.progressFill);
    this.controlContainer.appendChild(this.progressBar);

    // Exit button
    this.exitBtn = document.createElement('button');
    this.exitBtn.textContent = '✕';
    this.exitBtn.title = '退出回放';
    this.exitBtn.style.cssText = this._btnStyle('40px');
    this.controlContainer.appendChild(this.exitBtn);

    document.body.appendChild(this.controlContainer);
  }

  _btnStyle(width = 'auto') {
    return `
      padding: 8px 14px;
      font-size: 14px; color: #fff;
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 8px;
      cursor: pointer; transition: all 0.2s;
      pointer-events: auto;
      min-width: ${width};
      text-align: center;
    `;
  }

  showControls() {
    this.controlContainer.style.display = 'flex';
  }

  hideControls() {
    this.controlContainer.style.display = 'none';
  }

  updateControls(replayEngine) {
    if (!replayEngine) return;
    const progress = replayEngine.getProgress();
    const current = replayEngine.getCurrentTime().toFixed(1);
    const total = replayEngine.getDuration().toFixed(1);

    this.playBtn.textContent = replayEngine.playing && !replayEngine.paused ? '⏸' : '▶';
    this.speedBtn.textContent = replayEngine.getSpeedLabel();
    this.timeDisplay.textContent = `${current} / ${total}s`;
    this.progressFill.style.width = `${progress * 100}%`;
  }

  _setupKeyboard() {
    this._onKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (this.listContainer && this.listContainer.style.display === 'flex') {
          this.hideList();
          if (this.onHideList) this.onHideList();
        }
        if (this.controlContainer && this.controlContainer.style.display === 'flex') {
          if (this.onExitReplay) this.onExitReplay();
        }
      }
    };
    window.addEventListener('keydown', this._onKeyDown);
  }

  destroy() {
    if (this.listContainer && this.listContainer.parentNode) {
      this.listContainer.parentNode.removeChild(this.listContainer);
    }
    if (this.controlContainer && this.controlContainer.parentNode) {
      this.controlContainer.parentNode.removeChild(this.controlContainer);
    }
    this.listContainer = null;
    this.controlContainer = null;
    if (this._onKeyDown) {
      window.removeEventListener('keydown', this._onKeyDown);
      this._onKeyDown = null;
    }
  }
}
