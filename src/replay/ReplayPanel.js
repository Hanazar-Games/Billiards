import { uiLayout } from '../ui/UILayout.js';

/**
 * ReplayPanel — UI for browsing and playing back recorded shots.
 *
 * Two modes:
 *   1. Library list (from main menu) — grid of saved replays
 *   2. Playback controls (during replay) — overlay with play/pause/speed/time
 */
export class ReplayPanel {
  constructor(replayLibrary, onPlayReplay, onHideList, onExitReplay, onAnalyzeReplay = null) {
    this.library = replayLibrary;
    this.onPlayReplay = onPlayReplay;
    this.onHideList = onHideList;
    this.onExitReplay = onExitReplay;
    this.onAnalyzeReplay = onAnalyzeReplay;
    this.listContainer = null;
    this.controlContainer = null;
    this._importTimeout = null;
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
      background:
        linear-gradient(135deg, rgba(16,100,66,0.22), rgba(9,11,13,0.96) 42%),
        linear-gradient(25deg, rgba(122,26,38,0.16), rgba(9,11,13,0.96) 38%);
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
    title.innerHTML = '<span style="font-size:28px;font-weight:850;color:#f4f7f4;">精彩回放</span>';
    header.appendChild(title);

    const count = document.createElement('div');
    count.id = 'replay-count';
    count.style.cssText = 'font-size:14px;color:rgba(255,255,255,0.6);';
    header.appendChild(count);

    const headerActions = document.createElement('div');
    headerActions.style.cssText = 'display:flex; gap:10px; align-items:center;';

    // Import / Export / Clear actions
    const exportBtn = document.createElement('button');
    exportBtn.textContent = '⬇ 导出';
    exportBtn.title = '导出全部回放为 JSON 文件';
    exportBtn.style.cssText = this._smallBtnStyle();
    exportBtn.onclick = () => this._exportReplays();
    headerActions.appendChild(exportBtn);

    const importBtn = document.createElement('button');
    importBtn.textContent = '⬆ 导入';
    importBtn.title = '从 JSON 文件导入回放';
    importBtn.style.cssText = this._smallBtnStyle();
    importBtn.onclick = () => this._importReplays();
    headerActions.appendChild(importBtn);

    const clearBtn = document.createElement('button');
    clearBtn.textContent = '清空';
    clearBtn.title = '删除全部回放';
    clearBtn.style.cssText = this._smallBtnStyle();
    clearBtn.onmouseenter = () => {
      clearBtn.style.background = 'rgba(255,50,50,0.2)';
      clearBtn.style.borderColor = 'rgba(255,50,50,0.4)';
    };
    clearBtn.onmouseleave = () => {
      clearBtn.style.background = 'rgba(255,255,255,0.08)';
      clearBtn.style.borderColor = 'rgba(255,255,255,0.15)';
    };
    clearBtn.onclick = () => {
      if (this.library.getCount() > 0 && confirm('确定要删除全部回放吗？此操作不可撤销。')) {
        this.library.clear();
        this._renderList();
      }
    };
    headerActions.appendChild(clearBtn);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.title = '关闭';
    closeBtn.className = 'ui-action';
    closeBtn.style.cssText = `
      width: 40px; height: 40px;
      font-size: 20px;
      border-radius: 50%;
      pointer-events: auto;
    `;
    closeBtn.onclick = () => {
      this.hideList();
      if (this.onHideList) this.onHideList();
    };
    headerActions.appendChild(closeBtn);

    header.appendChild(headerActions);
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
    this.listContainer.style.animation = 'panelIn 260ms cubic-bezier(0.2,0.8,0.2,1) both';
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
      const max = this.library?.getMaxReplays?.() ?? 50;
      countLabel.textContent = `${replays.length} / ${max} 已保存`;
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
        padding: 16px;
        background: rgba(12,15,18,0.7);
        border: 1px solid rgba(255,255,255,0.14);
        border-radius: 10px;
        transition: transform 180ms cubic-bezier(0.2,0.8,0.2,1), background 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        pointer-events: auto;
        box-shadow: 0 14px 38px rgba(0,0,0,0.25);
        display: flex; flex-direction: column; gap: 8px;
      `;
      card.onmouseenter = () => {
        card.style.background = 'rgba(20,26,30,0.86)';
        card.style.borderColor = 'rgba(216,177,95,0.45)';
        card.style.transform = 'translateY(-2px)';
        card.style.boxShadow = '0 20px 54px rgba(0,0,0,0.34)';
      };
      card.onmouseleave = () => {
        card.style.background = 'rgba(12,15,18,0.7)';
        card.style.borderColor = 'rgba(255,255,255,0.14)';
        card.style.transform = 'translateY(0)';
        card.style.boxShadow = '0 14px 38px rgba(0,0,0,0.25)';
      };

      const meta = replay.metadata || {};
      const modeLabel = meta.mode === '9ball' ? '9球' : (meta.mode === 'freeplay' ? '练习' : '8球');
      const spinLabel = meta.spinUsed ? '旋转 ✓' : '旋转 ✗';
      const duration = Number.isFinite(meta.duration) ? meta.duration.toFixed(1) + '秒' : 'N/A';
      const pockets = (meta.pocketedIds || []).filter((id) => id !== 0).length;
      const collisions = meta.collisionCount || 0;
      const cushions = meta.cushionCount || 0;

      // Row 1: score + mode + spin + date
      const row1 = document.createElement('div');
      row1.style.cssText = 'display:flex; justify-content:space-between; align-items:center; gap:8px;';

      const leftTags = document.createElement('div');
      leftTags.style.cssText = 'display:flex; gap:6px; align-items:center; flex-wrap:wrap;';

      const scoreBadge = document.createElement('span');
      scoreBadge.textContent = `精彩度 ${replay.score}`;
      const scoreColor = replay.score >= 60 ? '#ff1744' : replay.score >= 40 ? '#ff9100' : '#00e676';
      scoreBadge.style.cssText = `
        font-size: 12px; font-weight: 700; color: ${scoreColor};
        background: ${scoreColor}22;
        padding: 3px 8px; border-radius: 5px;
      `;
      leftTags.appendChild(scoreBadge);

      const modeTag = document.createElement('span');
      modeTag.textContent = modeLabel;
      modeTag.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.55);background:rgba(255,255,255,0.08);padding:3px 8px;border-radius:5px;';
      leftTags.appendChild(modeTag);

      const spinTag = document.createElement('span');
      spinTag.textContent = spinLabel;
      spinTag.style.cssText = `font-size:11px;color:${meta.spinUsed ? '#5ce6a0' : 'rgba(255,255,255,0.35)'};background:rgba(255,255,255,0.06);padding:3px 8px;border-radius:5px;`;
      leftTags.appendChild(spinTag);

      row1.appendChild(leftTags);

      const date = document.createElement('div');
      const d = new Date(replay.savedAt);
      date.textContent = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
      date.style.cssText = 'font-size: 11px; color: rgba(255,255,255,0.35); white-space:nowrap;';
      row1.appendChild(date);
      card.appendChild(row1);

      // Row 2: editable name
      const nameRow = document.createElement('div');
      const nameInput = document.createElement('input');
      nameInput.value = replay.name || '';
      nameInput.placeholder = '点击命名…';
      nameInput.style.cssText = `
        width: 100%; background: transparent; border: none;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        color: rgba(255,255,255,0.85); font-size: 14px; font-weight: 600;
        padding: 2px 0; outline: none;
        transition: border-color 0.2s ease;
      `;
      nameInput.onfocus = () => { nameInput.style.borderColor = 'rgba(216,177,95,0.5)'; };
      nameInput.onblur = () => {
        nameInput.style.borderColor = 'rgba(255,255,255,0.08)';
        const newName = nameInput.value.trim();
        if (newName !== (replay.name || '')) {
          this.library.updateName(replay.id, newName);
        }
      };
      nameInput.onkeydown = (e) => { if (e.key === 'Enter') nameInput.blur(); };
      nameRow.appendChild(nameInput);
      card.appendChild(nameRow);

      // Row 3: stats
      const stats = document.createElement('div');
      stats.style.cssText = 'font-size: 12px; color: rgba(255,255,255,0.55); line-height: 1.5;';
      stats.innerHTML = `时长 ${duration} · 进球 ${pockets} · 碰撞 ${collisions} · 库边 ${cushions}`;
      card.appendChild(stats);

      // Row 4: actions
      const btnRow = document.createElement('div');
      btnRow.style.cssText = 'display: flex; gap: 8px; margin-top: 4px;';

      const playBtn = document.createElement('button');
      playBtn.textContent = '▶ 播放';
      playBtn.title = '播放回放';
      playBtn.style.cssText = `
        flex: 1; padding: 9px 0;
        font-size: 13px; font-weight: 600; color: #fff;
        background: rgba(0,230,118,0.2);
        border: 1px solid rgba(0,230,118,0.4);
        border-radius: 8px;
        cursor: pointer; transition: all calc(0.2s / var(--ui-anim-speed));
        pointer-events: auto;
      `;
      playBtn.onmouseenter = () => { playBtn.style.background = 'rgba(0,230,118,0.3)'; };
      playBtn.onmouseleave = () => { playBtn.style.background = 'rgba(0,230,118,0.2)'; };
      playBtn.onclick = () => { if (this.onPlayReplay) this.onPlayReplay(replay); };
      btnRow.appendChild(playBtn);

      if (this.onAnalyzeReplay) {
        const analyzeBtn = document.createElement('button');
        analyzeBtn.textContent = '分析';
        analyzeBtn.title = '查看击球分析';
        analyzeBtn.style.cssText = `
          flex: 1; padding: 9px 0;
          font-size: 13px; font-weight: 600; color: #fff;
          background: rgba(68,138,255,0.2);
          border: 1px solid rgba(68,138,255,0.4);
          border-radius: 8px;
          cursor: pointer; transition: all calc(0.2s / var(--ui-anim-speed));
          pointer-events: auto;
        `;
        analyzeBtn.onmouseenter = () => { analyzeBtn.style.background = 'rgba(68,138,255,0.3)'; };
        analyzeBtn.onmouseleave = () => { analyzeBtn.style.background = 'rgba(68,138,255,0.2)'; };
        analyzeBtn.onclick = () => { if (this.onAnalyzeReplay) this.onAnalyzeReplay(replay); };
        btnRow.appendChild(analyzeBtn);
      }

      const exportOneBtn = document.createElement('button');
      exportOneBtn.textContent = '⬇';
      exportOneBtn.title = '导出此回放';
      exportOneBtn.style.cssText = `
        width: 38px; font-size: 14px; color: rgba(255,255,255,0.6);
        background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
        border-radius: 8px; cursor: pointer;
        transition: all calc(0.2s / var(--ui-anim-speed));
        pointer-events: auto;
      `;
      exportOneBtn.onmouseenter = () => {
        exportOneBtn.style.background = 'rgba(255,255,255,0.12)';
        exportOneBtn.style.color = '#fff';
      };
      exportOneBtn.onmouseleave = () => {
        exportOneBtn.style.background = 'rgba(255,255,255,0.06)';
        exportOneBtn.style.color = 'rgba(255,255,255,0.6)';
      };
      exportOneBtn.onclick = () => this._exportSingle(replay);
      btnRow.appendChild(exportOneBtn);

      const delBtn = document.createElement('button');
      delBtn.textContent = '🗑';
      delBtn.title = '删除回放';
      delBtn.style.cssText = `
        width: 38px; font-size: 14px; color: rgba(255,255,255,0.5);
        background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
        border-radius: 8px; cursor: pointer;
        transition: all calc(0.2s / var(--ui-anim-speed));
        pointer-events: auto;
      `;
      delBtn.onmouseenter = () => {
        delBtn.style.background = 'rgba(255,50,50,0.2)';
        delBtn.style.borderColor = 'rgba(255,50,50,0.4)';
        delBtn.style.color = '#ff8a8a';
      };
      delBtn.onmouseleave = () => {
        delBtn.style.background = 'rgba(255,255,255,0.06)';
        delBtn.style.borderColor = 'rgba(255,255,255,0.12)';
        delBtn.style.color = 'rgba(255,255,255,0.5)';
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
      position: fixed; bottom: calc(var(--hud-bottom-safe) + 24px); left: 50%;
      transform: translateX(-50%);
      display: none; align-items: center; gap: 14px;
      padding: 12px 24px;
      background: rgba(12,15,18,0.82);
      border: 1px solid rgba(255,255,255,0.16);
      border-radius: 8px;
      backdrop-filter: blur(12px);
      z-index: 150;
      pointer-events: auto;
      box-shadow: 0 16px 44px rgba(0,0,0,0.36);
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
      transition: width calc(0.1s / var(--ui-anim-speed)) linear;
    `;
    this.progressBar.appendChild(this.progressFill);
    this.controlContainer.appendChild(this.progressBar);

    // Exit button
    this.exitBtn = document.createElement('button');
    this.exitBtn.textContent = '✕';
    this.exitBtn.title = '退出回放';
    this.exitBtn.style.cssText = this._btnStyle('40px');
    this.controlContainer.appendChild(this.exitBtn);

    // Metadata display (power, pocketed, collisions, cushions)
    this.metaDisplay = document.createElement('div');
    this.metaDisplay.style.cssText = `
      display: flex; align-items: center; gap: 12px;
      padding-left: 10px; border-left: 1px solid rgba(255,255,255,0.12);
      font-size: 12px; color: rgba(255,255,255,0.6);
    `;
    this.controlContainer.appendChild(this.metaDisplay);

    document.body.appendChild(this.controlContainer);
  }

  _btnStyle(width = 'auto') {
    return `
      padding: 8px 14px;
      font-size: 14px; color: #fff;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.16);
      border-radius: 8px;
      cursor: pointer; transition: all calc(0.2s / var(--ui-anim-speed));
      pointer-events: auto;
      min-width: ${width};
      text-align: center;
    `;
  }

  _smallBtnStyle() {
    return `
      padding: 6px 12px;
      font-size: 13px; font-weight: 600;
      color: rgba(255,255,255,0.7);
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 8px;
      cursor: pointer; transition: all calc(0.2s / var(--ui-anim-speed));
      pointer-events: auto;
    `;
  }

  _exportSingle(replay) {
    const data = JSON.stringify(replay, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const name = (replay.name || 'replay').replace(/[^\w\u4e00-\u9fa5]/g, '_');
    a.download = `billiards-replay-${name}-${replay.id.slice(-4)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  _exportReplays() {
    const data = this.library.exportAll();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `billiards-replays-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  _importReplays() {
    const input = document.createElement('input');
    input.id = 'replay-import-input';
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none';
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const count = this.library.importAll(ev.target.result);
        this._renderList();
        alert(count > 0 ? `成功导入 ${count} 条回放` : '导入失败：文件格式错误或数据无效');
      };
      reader.onerror = () => alert('文件读取失败');
      reader.readAsText(file);
    };
    document.body.appendChild(input);
    input.click();
    this._importTimeout = setTimeout(() => {
      if (input.parentNode) input.parentNode.removeChild(input);
      this._importTimeout = null;
    }, 5000);
  }

  showControls() {
    this.controlContainer.style.display = 'flex';
    uiLayout.claim('replayControls', 'bottom', 84);
  }

  hideControls() {
    this.controlContainer.style.display = 'none';
    uiLayout.release('replayControls');
  }

  updateControls(replayEngine) {
    if (!replayEngine) return;
    const progress = replayEngine.getProgress();
    const current = replayEngine.getCurrentTime().toFixed(1);
    const total = replayEngine.getDuration().toFixed(1);
    const playText = replayEngine.playing && !replayEngine.paused ? '⏸' : '▶';
    const speedText = replayEngine.getSpeedLabel();
    const timeText = `${current} / ${total}s`;
    const progressPct = `${progress * 100}%`;

    if (this._lastPlayText !== playText) {
      this.playBtn.textContent = playText;
      this._lastPlayText = playText;
    }
    if (this._lastSpeedText !== speedText) {
      this.speedBtn.textContent = speedText;
      this._lastSpeedText = speedText;
    }
    if (this._lastTimeText !== timeText) {
      this.timeDisplay.textContent = timeText;
      this._lastTimeText = timeText;
    }
    if (this._lastProgressPct !== progressPct) {
      this.progressFill.style.width = progressPct;
      this._lastProgressPct = progressPct;
    }

    // Update metadata if available on the loaded replay data
    const meta = replayEngine._meta;
    if (meta && this.metaDisplay) {
      const parts = [];
      if (meta.maxPower > 0) parts.push(`力度 ${Math.round(meta.maxPower)}`);
      const nonCue = (meta.pocketedIds || []).filter(id => id !== 0).length;
      if (nonCue > 0) parts.push(`进球 ${nonCue}`);
      if (meta.collisionCount > 0) parts.push(`碰撞 ${meta.collisionCount}`);
      if (meta.cushionCount > 0) parts.push(`库边 ${meta.cushionCount}`);
      if (meta.spinUsed) parts.push('旋转');
      const metaText = parts.join('  ·  ');
      if (this._lastMetaText !== metaText) {
        this.metaDisplay.textContent = metaText;
        this._lastMetaText = metaText;
      }
    } else if (this.metaDisplay) {
      if (this._lastMetaText !== '') {
        this.metaDisplay.textContent = '';
        this._lastMetaText = '';
      }
    }
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
    uiLayout.release('replayControls');
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
    if (this._importTimeout) { clearTimeout(this._importTimeout); this._importTimeout = null; }
    document.querySelectorAll("#replay-import-input").forEach(el => { if (el.parentNode) el.parentNode.removeChild(el); });
  }
}
