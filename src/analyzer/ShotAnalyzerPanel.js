/**
 * ShotAnalyzerPanel — DOM UI panel for shot analysis.
 *
 * Three tabs:
 *   1. Overview    — score, breakdown bars, metadata, suggestions
 *   2. Trajectory  — interactive Canvas graph
 *   3. Collisions  — detailed collision table
 */

import { ShotAnalyzer } from './ShotAnalyzer.js';
import { TrajectoryGraph } from './TrajectoryGraph.js';

const TAB_NAMES = ['概览', '轨迹图', '碰撞详情'];

const BALL_COLORS = [
  '#ffffff', // 0 cue ball
  '#f4d03f', '#1a5276', '#c0392b', '#8e44ad',
  '#e67e22', '#27ae60', '#922b21', '#2c3e50',
  '#f4d03f', '#1a5276', '#c0392b', '#8e44ad',
  '#e67e22', '#27ae60', '#922b21', // 1-15
];

export class ShotAnalyzerPanel {
  constructor() {
    this.analysis = null;
    this.graph = null;
    this._currentTab = 0;
    this._listeners = [];
    this._build();
  }

  // ── Build DOM ──

  _build() {
    this.overlay = document.createElement('div');
    this.overlay.id = 'shot-analyzer-overlay';
    this.overlay.style.cssText = `
      position: fixed; inset: 0;
      display: none; flex-direction: column;
      align-items: center; justify-content: center;
      background: rgba(6, 8, 10, 0.92);
      backdrop-filter: blur(16px);
      z-index: 250;
      padding: 20px;
    `;

    // Panel container
    this.panel = document.createElement('div');
    this.panel.style.cssText = `
      width: 100%; max-width: 760px; max-height: 90vh;
      background: rgba(14, 18, 22, 0.96);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 14px;
      display: flex; flex-direction: column;
      overflow: hidden;
      box-shadow: 0 28px 80px rgba(0,0,0,0.5);
    `;

    // Header
    this._buildHeader();

    // Tabs
    this._buildTabs();

    // Content area
    this.content = document.createElement('div');
    this.content.style.cssText = 'flex: 1; overflow-y: auto; min-height: 0; padding: 16px 20px;';
    this.panel.appendChild(this.content);

    this.overlay.appendChild(this.panel);
    document.body.appendChild(this.overlay);

    this._onKeyDown = (e) => {
      if (e.key === 'Escape' && this.isVisible()) {
        this.hide();
      }
    };
    window.addEventListener('keydown', this._onKeyDown);
  }

  _buildHeader() {
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
      padding: 14px 20px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    `;

    const left = document.createElement('div');
    left.style.cssText = 'display:flex; align-items:center; gap:10px;';

    this.titleEl = document.createElement('div');
    this.titleEl.textContent = '击球分析';
    this.titleEl.style.cssText = 'font-size:18px; font-weight:750; color:#f4f7f4;';
    left.appendChild(this.titleEl);

    this.scoreBadge = document.createElement('span');
    this.scoreBadge.style.cssText = `
      font-size: 13px; font-weight: 700; padding: 3px 10px; border-radius: 6px;
      background: rgba(0,230,118,0.15); color: #00e676; border: 1px solid rgba(0,230,118,0.3);
    `;
    left.appendChild(this.scoreBadge);

    header.appendChild(left);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      width: 34px; height: 34px; font-size: 18px; color: rgba(255,255,255,0.6);
      background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
      border-radius: 50%; cursor: pointer; transition: all 0.2s ease;
      pointer-events: auto;
    `;
    closeBtn.onmouseenter = () => { closeBtn.style.background = 'rgba(255,50,50,0.2)'; closeBtn.style.color = '#ff8a8a'; };
    closeBtn.onmouseleave = () => { closeBtn.style.background = 'rgba(255,255,255,0.06)'; closeBtn.style.color = 'rgba(255,255,255,0.6)'; };
    closeBtn.onclick = () => this.hide();
    header.appendChild(closeBtn);

    this.panel.appendChild(header);
  }

  _buildTabs() {
    const tabsRow = document.createElement('div');
    tabsRow.style.cssText = `
      display: flex; gap: 0;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      padding: 0 20px;
    `;

    this.tabButtons = [];
    TAB_NAMES.forEach((name, idx) => {
      const btn = document.createElement('button');
      btn.textContent = name;
      btn.style.cssText = `
        padding: 10px 18px; font-size: 13px; font-weight: 600;
        color: rgba(255,255,255,0.45); background: transparent;
        border: none; border-bottom: 2px solid transparent;
        cursor: pointer; transition: all 0.2s ease;
        pointer-events: auto;
      `;
      btn.onclick = () => this._switchTab(idx);
      tabsRow.appendChild(btn);
      this.tabButtons.push(btn);
    });

    this.panel.appendChild(tabsRow);
  }

  // ── Public API ──

  /**
   * Show analysis for a recorded shot.
   * @param {Object} replayData — from ShotRecorder.getReplayData()
   * @param {Object} tableInfo — { width, depth, ballRadius, pocketPositions }
   */
  show(replayData, tableInfo = {}) {
    this._tableInfo = tableInfo;
    this.analysis = ShotAnalyzer.analyze(replayData, tableInfo);
    if (!this.analysis) {
      console.warn('ShotAnalyzerPanel: no analysis data');
      return;
    }

    // Update header
    const score = this.analysis.score;
    this.scoreBadge.textContent = `评分 ${score}`;
    const scoreColor = score >= 80 ? '#00e676' : score >= 60 ? '#ffab00' : score >= 40 ? '#ff9100' : '#ff5252';
    const scoreBg = score >= 80 ? 'rgba(0,230,118,0.15)' : score >= 60 ? 'rgba(255,171,0,0.15)' : score >= 40 ? 'rgba(255,145,0,0.15)' : 'rgba(255,82,82,0.15)';
    const scoreBorder = score >= 80 ? 'rgba(0,230,118,0.3)' : score >= 60 ? 'rgba(255,171,0,0.3)' : score >= 40 ? 'rgba(255,145,0,0.3)' : 'rgba(255,82,82,0.3)';
    this.scoreBadge.style.color = scoreColor;
    this.scoreBadge.style.background = scoreBg;
    this.scoreBadge.style.borderColor = scoreBorder;

    this.overlay.style.display = 'flex';
    this._switchTab(0);
  }

  hide() {
    this.overlay.style.display = 'none';
    if (this.graph) this.graph.pause();
  }

  isVisible() {
    return this.overlay && this.overlay.style.display === 'flex';
  }

  // ── Tab switching ──

  _cleanupGraph() {
    if (this.graph) {
      this.graph.destroy();
      this.graph = null;
    }
    if (this._ro) {
      this._ro.disconnect();
      this._ro = null;
    }
  }

  _switchTab(idx) {
    this._currentTab = idx;

    // Update tab styles
    this.tabButtons.forEach((btn, i) => {
      if (i === idx) {
        btn.style.color = '#f4f7f4';
        btn.style.borderBottomColor = 'rgba(216,177,95,0.8)';
      } else {
        btn.style.color = 'rgba(255,255,255,0.45)';
        btn.style.borderBottomColor = 'transparent';
      }
    });

    // Clean up trajectory tab resources before wiping DOM
    this._cleanupGraph();

    // Render content
    this.content.innerHTML = '';
    switch (idx) {
      case 0: this._renderOverview(); break;
      case 1: this._renderTrajectory(); break;
      case 2: this._renderCollisions(); break;
    }
  }

  // ── Overview Tab ──

  _renderOverview() {
    const a = this.analysis;
    const meta = a.metadata;
    const bd = a.breakdown;

    // Score breakdown bars
    const breakdownSection = document.createElement('div');
    breakdownSection.style.cssText = 'margin-bottom: 18px;';
    const breakdownTitle = document.createElement('div');
    breakdownTitle.textContent = '评分细项';
    breakdownTitle.style.cssText = 'font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.5); margin-bottom: 10px;';
    breakdownSection.appendChild(breakdownTitle);

    const breakdowns = [
      { label: '精准度', value: bd.accuracy, color: '#00e676' },
      { label: '效率', value: bd.efficiency, color: '#448aff' },
      { label: '控制', value: bd.control, color: '#ffab00' },
      { label: '难度', value: bd.difficulty, color: '#e040fb' },
    ];

    breakdowns.forEach((item) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex; align-items:center; gap:10px; margin-bottom:8px;';

      const label = document.createElement('div');
      label.textContent = item.label;
      label.style.cssText = 'width: 60px; font-size: 12px; color: rgba(255,255,255,0.6);';
      row.appendChild(label);

      const barWrap = document.createElement('div');
      barWrap.style.cssText = 'flex:1; height: 8px; background: rgba(255,255,255,0.06); border-radius: 4px; overflow: hidden;';

      const barFill = document.createElement('div');
      barFill.style.cssText = `
        width: ${item.value}%; height: 100%;
        background: ${item.color};
        border-radius: 4px;
        transition: width 0.6s cubic-bezier(0.2,0.8,0.2,1);
      `;
      barWrap.appendChild(barFill);
      row.appendChild(barWrap);

      const val = document.createElement('div');
      val.textContent = String(item.value);
      val.style.cssText = `width: 30px; font-size: 12px; font-weight: 700; color: ${item.color}; text-align: right;`;
      row.appendChild(val);

      breakdownSection.appendChild(row);
    });
    this.content.appendChild(breakdownSection);

    // Metadata grid
    const metaSection = document.createElement('div');
    metaSection.style.cssText = `
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
      margin-bottom: 18px; padding: 12px;
      background: rgba(255,255,255,0.03); border-radius: 10px;
    `;

    const metaItems = [
      { label: '力度', value: `${meta.power}%` },
      { label: '旋转', value: meta.spinUsed ? '使用 ✓' : '未使用' },
      { label: '时长', value: `${meta.duration.toFixed(1)}s` },
      { label: '进球', value: String(meta.pocketedIds.filter(id => id !== 0).length) },
      { label: '碰撞', value: String(meta.collisionCount) },
      { label: '库边', value: String(meta.cushionCount) },
    ];

    metaItems.forEach((item) => {
      const cell = document.createElement('div');
      cell.style.cssText = 'text-align: center;';
      const v = document.createElement('div');
      v.textContent = item.value;
      v.style.cssText = 'font-size: 16px; font-weight: 700; color: #f4f7f4;';
      const l = document.createElement('div');
      l.textContent = item.label;
      l.style.cssText = 'font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 2px;';
      cell.appendChild(v);
      cell.appendChild(l);
      metaSection.appendChild(cell);
    });
    this.content.appendChild(metaSection);

    // Suggestions
    if (a.suggestions && a.suggestions.length > 0) {
      const sugSection = document.createElement('div');
      const sugTitle = document.createElement('div');
      sugTitle.textContent = '分析与建议';
      sugTitle.style.cssText = 'font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.5); margin-bottom: 10px;';
      sugSection.appendChild(sugTitle);

      a.suggestions.forEach((text) => {
        const row = document.createElement('div');
        row.style.cssText = `
          padding: 8px 12px; margin-bottom: 6px;
          background: rgba(255,255,255,0.04);
          border-left: 3px solid rgba(216,177,95,0.6);
          border-radius: 0 6px 6px 0;
          font-size: 13px; color: rgba(255,255,255,0.75); line-height: 1.5;
        `;
        row.textContent = text;
        sugSection.appendChild(row);
      });
      this.content.appendChild(sugSection);
    }
  }

  // ── Trajectory Tab ──

  _renderTrajectory() {
    const canvasWrap = document.createElement('div');
    canvasWrap.style.cssText = `
      width: 100%; aspect-ratio: 2 / 1;
      background: rgba(0,0,0,0.3);
      border-radius: 10px;
      overflow: hidden;
      position: relative;
    `;

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'width: 100%; height: 100%; display: block; cursor: grab;';
    canvasWrap.appendChild(canvas);
    this.content.appendChild(canvasWrap);

    // Playback controls
    const controls = document.createElement('div');
    controls.style.cssText = `
      display: flex; align-items: center; gap: 10px;
      margin-top: 10px; padding: 8px 12px;
      background: rgba(255,255,255,0.03); border-radius: 8px;
    `;

    const playBtn = document.createElement('button');
    playBtn.textContent = '▶';
    playBtn.style.cssText = this._ctrlBtnStyle();
    controls.appendChild(playBtn);

    const stopBtn = document.createElement('button');
    stopBtn.textContent = '⏹';
    stopBtn.style.cssText = this._ctrlBtnStyle();
    controls.appendChild(stopBtn);

    const speedBtn = document.createElement('button');
    speedBtn.textContent = '1.0x';
    speedBtn.style.cssText = this._ctrlBtnStyle('70px');
    controls.appendChild(speedBtn);

    const timeLabel = document.createElement('div');
    timeLabel.style.cssText = 'font-size: 12px; color: rgba(255,255,255,0.5); font-variant-numeric: tabular-nums;';
    timeLabel.textContent = '0.0s / 0.0s';
    controls.appendChild(timeLabel);

    this.content.appendChild(controls);

    // Init graph (size will be set by ResizeObserver after layout)
    this.graph = new TrajectoryGraph(canvas);

    // Build table info for graph
    const meta = this.analysis.metadata;
    const ti = this._tableInfo || {};
    const tableInfo = {
      width: ti.width || 600,
      depth: ti.depth || 300,
      ballRadius: ti.ballRadius || 10,
      pocketPositions: ti.pocketPositions || [],
      collisions: this.analysis.collisions,
      pockets: this.analysis.pockets,
    };

    // We need to attach the replay data. The analysis doesn't carry the raw frames,
    // so we need to pass them through. Let's store them on load.
    // For now, we reconstruct from the paths... actually no, let's just
    // add a method to ShotAnalyzer to carry raw data, or we store it here.

    // NOTE: The analysis doesn't have the raw frames. We need to store the replayData
    // when show() is called. Let's fix that.
    if (this._lastReplayData) {
      this.graph.load(this._lastReplayData, tableInfo);
      this.graph.render(0);
    }

    // Controls logic
    const speeds = [0.25, 0.5, 1.0, 2.0];
    let speedIdx = 2;
    playBtn.onclick = () => {
      if (this.graph.playing) {
        this.graph.pause();
        playBtn.textContent = '▶';
      } else {
        this.graph.play();
        playBtn.textContent = '⏸';
      }
    };
    stopBtn.onclick = () => {
      this.graph.stop();
      playBtn.textContent = '▶';
    };
    speedBtn.onclick = () => {
      speedIdx = (speedIdx + 1) % speeds.length;
      const speed = speeds[speedIdx];
      speedBtn.textContent = speed + 'x';
      if (this.graph) this.graph.setPlaybackSpeed(speed);
    };

    // Update time label
    const updateTime = () => {
      if (!this.graph || !this.content?.isConnected) return;
      const current = (this.graph.currentFrame / this.graph.frameRate).toFixed(1);
      const total = (this.graph.frameCount / this.graph.frameRate).toFixed(1);
      timeLabel.textContent = `${current}s / ${total}s`;
      if (this.graph.playing) {
        requestAnimationFrame(updateTime);
      }
    };
    playBtn.addEventListener('click', updateTime);

    // Handle resize
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        this.graph?.resize(width, height);
      }
    });
    ro.observe(canvasWrap);
    this._ro = ro;
  }

  _ctrlBtnStyle(width = 'auto') {
    return `
      padding: 6px 12px; font-size: 13px; font-weight: 600;
      color: #fff; background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.14); border-radius: 6px;
      cursor: pointer; transition: all 0.2s ease;
      pointer-events: auto; min-width: ${width}; text-align: center;
    `;
  }

  // ── Collisions Tab ──

  _renderCollisions() {
    if (!this.analysis.collisions || this.analysis.collisions.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = '本次击球没有检测到碰撞';
      empty.style.cssText = 'text-align: center; color: rgba(255,255,255,0.4); padding: 40px 0; font-size: 14px;';
      this.content.appendChild(empty);
      return;
    }

    const table = document.createElement('div');
    table.style.cssText = 'width: 100%;';

    // Header row
    const header = document.createElement('div');
    header.style.cssText = `
      display: grid; grid-template-columns: 50px 80px 1fr 80px 80px;
      gap: 8px; padding: 8px 12px;
      font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.4);
      border-bottom: 1px solid rgba(255,255,255,0.08);
    `;
    ['#', '时间', '碰撞球', '角度', '类型'].forEach((h) => {
      const cell = document.createElement('div');
      cell.textContent = h;
      header.appendChild(cell);
    });
    table.appendChild(header);

    this.analysis.collisions.forEach((c, i) => {
      const row = document.createElement('div');
      row.style.cssText = `
        display: grid; grid-template-columns: 50px 80px 1fr 80px 80px;
        gap: 8px; padding: 10px 12px;
        font-size: 13px; color: rgba(255,255,255,0.75);
        border-bottom: 1px solid rgba(255,255,255,0.04);
        transition: background 0.15s ease;
      `;
      row.onmouseenter = () => { row.style.background = 'rgba(255,255,255,0.04)'; };
      row.onmouseleave = () => { row.style.background = 'transparent'; };

      const numCell = document.createElement('div');
      numCell.textContent = String(i + 1);
      numCell.style.cssText = 'color: rgba(216,177,95,0.8); font-weight: 700;';
      row.appendChild(numCell);

      const timeCell = document.createElement('div');
      timeCell.textContent = c.time?.toFixed(2) + 's';
      row.appendChild(timeCell);

      const ballsCell = document.createElement('div');
      if (c.type === 'ball-ball') {
        const aColor = BALL_COLORS[c.ballA] || '#888';
        const bColor = BALL_COLORS[c.ballB] || '#888';
        ballsCell.innerHTML = `
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${aColor};vertical-align:middle;margin-right:4px;"></span>
          ${c.ballA}号
          <span style="margin:0 6px;color:rgba(255,255,255,0.3);">↔</span>
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${bColor};vertical-align:middle;margin-right:4px;"></span>
          ${c.ballB}号
        `;
      } else {
        ballsCell.textContent = '库边';
      }
      row.appendChild(ballsCell);

      const angleCell = document.createElement('div');
      angleCell.textContent = c.impactAngle != null ? `${c.impactAngle}°` : '—';
      row.appendChild(angleCell);

      const typeCell = document.createElement('div');
      typeCell.textContent = c.type === 'ball-ball' ? '球-球' : '球-库';
      typeCell.style.cssText = 'font-size: 11px; color: rgba(255,255,255,0.45);';
      row.appendChild(typeCell);

      table.appendChild(row);
    });

    this.content.appendChild(table);
  }

  /** Store raw replay data for trajectory tab. */
  setReplayData(data) {
    this._lastReplayData = data;
  }

  destroy() {
    this.hide();
    if (this._onKeyDown) {
      window.removeEventListener('keydown', this._onKeyDown);
      this._onKeyDown = null;
    }
    if (this.graph) {
      this.graph.destroy();
      this.graph = null;
    }
    if (this._ro) {
      this._ro.disconnect();
      this._ro = null;
    }
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    this.overlay = null;
    this.panel = null;
    this.content = null;
  }
}
