/**
 * HighlightPanel — Full-screen gallery of memorable shots.
 *
 * Features:
 *   - Glassmorphism card grid with category filters
 *   - Star rating display (⭐ 1–3)
 *   - One-click replay launch
 *   - Export / delete per highlight
 *   - Reduced-motion safe
 */

import { animMs, isReducedMotion } from '../core/AnimSpeed.js';
import { highlightStore } from './HighlightStore.js';
import { CATEGORY_META } from './HighlightData.js';

export class HighlightPanel {
  constructor(onPlayReplay, onBack) {
    this.onPlayReplay = onPlayReplay;
    this.onBack = onBack;
    this.container = null;
    this._shown = false;
    this._filter = 'all';
    this._buildUI();
    this._setupKeyboard();
  }

  _buildUI() {
    const layer = document.getElementById('menu-layer');
    if (!layer) return;

    this.container = document.createElement('div');
    this.container.style.cssText = `
      display: none; flex-direction: column;
      align-items: center; justify-content: flex-start;
      width: 100%; height: 100%;
      position: absolute; inset: 0;
      z-index: 2; overflow-y: auto;
      padding: 32px 24px 100px;
      transition: opacity calc(0.35s / var(--ui-anim-speed)) ease;
    `;

    // Header
    this.header = document.createElement('div');
    this.header.style.cssText = `
      display: flex; align-items: center; justify-content: space-between;
      width: 100%; max-width: 800px; margin-bottom: 20px;
    `;

    const title = document.createElement('div');
    title.innerHTML = '✨ 精彩瞬间';
    title.style.cssText = `
      font-size: 22px; font-weight: 800; color: #fff;
      letter-spacing: 2px;
    `;
    this.header.appendChild(title);

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.textContent = '← 返回';
    backBtn.className = 'ui-action';
    backBtn.style.cssText = 'padding: 8px 18px; font-size: 13px; font-weight: 700; pointer-events: auto;';
    backBtn.onclick = () => this._goBack();
    this.header.appendChild(backBtn);
    this.container.appendChild(this.header);

    // Stats bar
    this.statsBar = document.createElement('div');
    this.statsBar.style.cssText = `
      width: 100%; max-width: 800px;
      display: flex; gap: 16px; flex-wrap: wrap;
      margin-bottom: 16px; padding: 12px 16px;
      background: rgba(255,255,255,0.04); border-radius: 12px;
      font-size: 12px; color: rgba(255,255,255,0.55);
    `;
    this.container.appendChild(this.statsBar);

    // Filter chips
    this.filterWrap = document.createElement('div');
    this.filterWrap.style.cssText = `
      width: 100%; max-width: 800px;
      display: flex; gap: 8px; flex-wrap: wrap;
      margin-bottom: 20px;
    `;
    this._buildFilters();
    this.container.appendChild(this.filterWrap);

    // Grid
    this.grid = document.createElement('div');
    this.grid.style.cssText = `
      width: 100%; max-width: 800px;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 16px;
    `;
    this.container.appendChild(this.grid);

    // Empty state
    this.emptyState = document.createElement('div');
    this.emptyState.style.cssText = `
      width: 100%; max-width: 800px; text-align: center;
      padding: 60px 20px; color: rgba(255,255,255,0.35);
      font-size: 15px; line-height: 1.6;
    `;
    this.emptyState.innerHTML = `
      <div style="font-size: 40px; margin-bottom: 12px;">📸</div>
      <div style="font-weight: 700; color: rgba(255,255,255,0.5); margin-bottom: 4px;">暂无精彩瞬间</div>
      <div>完成高难度进球、翻袋、长台进攻或连杆时，系统会自动记录</div>
    `;
    this.container.appendChild(this.emptyState);

    layer.appendChild(this.container);
  }

  _buildFilters() {
    this.filterWrap.innerHTML = '';
    const chips = [
      { key: 'all', label: '全部', icon: '🔥' },
      ...Object.entries(CATEGORY_META).map(([k, v]) => ({ key: k, label: v.label, icon: v.icon })),
    ];
    for (const chip of chips) {
      const btn = document.createElement('button');
      btn.type = 'button';
      const active = this._filter === chip.key;
      btn.style.cssText = `
        padding: 6px 14px; border-radius: 999px; font-size: 12px; font-weight: 700;
        cursor: pointer; pointer-events: auto; border: 1px solid ${active ? 'rgba(216,177,95,0.6)' : 'rgba(255,255,255,0.12)'}};
        background: ${active ? 'rgba(216,177,95,0.18)' : 'rgba(255,255,255,0.05)'};
        color: ${active ? '#f0d78c' : 'rgba(255,255,255,0.7)'};
        transition: all calc(0.2s / var(--ui-anim-speed)) ease;
      `;
      btn.textContent = `${chip.icon} ${chip.label}`;
      btn.onclick = () => {
        this._filter = chip.key;
        this._render();
      };
      this.filterWrap.appendChild(btn);
    }
  }

  show() {
    if (!this.container || this._shown) return;
    this._shown = true;
    if (this._fadeTimer) { clearTimeout(this._fadeTimer); this._fadeTimer = null; }
    this.container.style.display = 'flex';
    this.container.style.opacity = '0';
    if (!isReducedMotion()) {
      this._showRaf = requestAnimationFrame(() => {
        this._showRaf = null;
        if (this.container) this.container.style.opacity = '1';
      });
    } else {
      this.container.style.opacity = '1';
    }
    this._render();
  }

  hide() {
    this._shown = false;
    if (!this.container) return;
    this.container.style.opacity = '0';
    if (this._fadeTimer) clearTimeout(this._fadeTimer);
    this._fadeTimer = setTimeout(() => {
      if (this.container) this.container.style.display = 'none';
      this._fadeTimer = null;
    }, animMs(350));
  }

  destroy() {
    this._shown = false;
    if (this._fadeTimer) { clearTimeout(this._fadeTimer); this._fadeTimer = null; }
    if (this._showRaf) { cancelAnimationFrame(this._showRaf); this._showRaf = null; }
    if (this._onKeyDown) {
      window.removeEventListener('keydown', this._onKeyDown);
      this._onKeyDown = null;
    }
    if (this._confirmOverlay) {
      if (this._confirmOverlay.parentNode) this._confirmOverlay.parentNode.removeChild(this._confirmOverlay);
      this._confirmOverlay = null;
    }
    if (this.container) {
      this.container.innerHTML = '';
      if (this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
      }
    }
    this.container = null;
    this.grid = null;
    this.statsBar = null;
    this.emptyState = null;
    this.filterWrap = null;
    this.header = null;
  }

  _setupKeyboard() {
    this._onKeyDown = (e) => {
      if (e.key === 'Escape' && this._shown) { e.stopPropagation(); this._goBack(); }
    };
    window.addEventListener('keydown', this._onKeyDown);
  }

  _goBack() {
    this.hide();
    if (this.onBack) this.onBack();
  }

  _render() {
    const all = highlightStore.getAll();
    const filtered = this._filter === 'all'
      ? all
      : all.filter(h => h.tags.includes(this._filter));

    // Stats
    const stats = highlightStore.getStats();
    this.statsBar.innerHTML = `
      <span>🎬 共 ${stats.total} 条</span>
      <span>⭐ 平均 ${stats.avgStars} 星</span>
      <span>🏅 三星 ${stats.threeStarCount} 条</span>
    `;

    // Grid
    this.grid.innerHTML = '';
    if (filtered.length === 0) {
      this.grid.style.display = 'none';
      this.emptyState.style.display = 'block';
      return;
    }
    this.grid.style.display = 'grid';
    this.emptyState.style.display = 'none';

    for (const h of filtered) {
      this.grid.appendChild(this._createCard(h));
    }
  }

  _createCard(h) {
    const card = document.createElement('div');
    card.style.cssText = `
      background: var(--panel-strong, rgba(20,24,28,0.95));
      border: 1px solid var(--line, rgba(255,255,255,0.12));
      border-radius: 14px;
      padding: 16px;
      display: flex; flex-direction: column; gap: 10px;
      transition: transform calc(0.2s / var(--ui-anim-speed)) ease, border-color calc(0.2s / var(--ui-anim-speed)) ease;
      pointer-events: auto;
    `;
    card.onmouseenter = () => {
      card.style.transform = 'translateY(-2px)';
      card.style.borderColor = 'rgba(255,255,255,0.25)';
    };
    card.onmouseleave = () => {
      card.style.transform = 'translateY(0)';
      card.style.borderColor = 'var(--line, rgba(255,255,255,0.12))';
    };

    // Title row
    const titleRow = document.createElement('div');
    titleRow.style.cssText = 'display: flex; align-items: center; justify-content: space-between;';

    const title = document.createElement('div');
    title.textContent = h.title;
    title.style.cssText = 'font-size: 14px; font-weight: 800; color: #fff;';
    titleRow.appendChild(title);

    const stars = document.createElement('div');
    stars.textContent = '⭐'.repeat(h.starRating);
    stars.style.cssText = 'font-size: 13px; letter-spacing: 1px;';
    titleRow.appendChild(stars);
    card.appendChild(titleRow);

    // Tags
    const tagRow = document.createElement('div');
    tagRow.style.cssText = 'display: flex; gap: 6px; flex-wrap: wrap;';
    for (const tag of h.tags) {
      const meta = CATEGORY_META[tag];
      const chip = document.createElement('span');
      chip.textContent = meta ? `${meta.icon} ${meta.label}` : tag;
      chip.style.cssText = `
        font-size: 11px; font-weight: 600;
        padding: 3px 8px; border-radius: 6px;
        background: ${meta ? meta.color + '18' : 'rgba(255,255,255,0.06)'};
        color: ${meta ? meta.color : 'rgba(255,255,255,0.6)'};
        border: 1px solid ${meta ? meta.color + '33' : 'rgba(255,255,255,0.1)'};
      `;
      tagRow.appendChild(chip);
    }
    card.appendChild(tagRow);

    // Summary
    const summary = document.createElement('div');
    summary.textContent = h.summary;
    summary.style.cssText = 'font-size: 12px; color: rgba(255,255,255,0.5); line-height: 1.4;';
    card.appendChild(summary);

    // Meta row
    const metaRow = document.createElement('div');
    metaRow.style.cssText = 'display: flex; align-items: center; justify-content: space-between; margin-top: 2px;';

    const date = document.createElement('span');
    date.textContent = new Date(h.savedAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    date.style.cssText = 'font-size: 11px; color: rgba(255,255,255,0.35);';
    metaRow.appendChild(date);

    const mode = document.createElement('span');
    mode.textContent = this._modeLabel(h.mode);
    mode.style.cssText = 'font-size: 11px; color: rgba(255,255,255,0.35);';
    metaRow.appendChild(mode);
    card.appendChild(metaRow);

    // Actions
    const actions = document.createElement('div');
    actions.style.cssText = 'display: flex; gap: 8px; margin-top: 4px;';

    const playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.textContent = '▶ 回放';
    playBtn.style.cssText = `
      flex: 1; padding: 8px 0; border-radius: 8px;
      background: rgba(216,177,95,0.18); border: 1px solid rgba(216,177,95,0.45);
      color: #f0d78c; font-size: 13px; font-weight: 800; cursor: pointer;
      pointer-events: auto; transition: all calc(0.2s / var(--ui-anim-speed)) ease;
    `;
    playBtn.onmouseenter = () => { playBtn.style.background = 'rgba(216,177,95,0.3)'; };
    playBtn.onmouseleave = () => { playBtn.style.background = 'rgba(216,177,95,0.18)'; };
    playBtn.onclick = () => {
      if (this.onPlayReplay) this.onPlayReplay(h.replayData);
    };
    actions.appendChild(playBtn);

    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.textContent = '⬇ 导出';
    exportBtn.style.cssText = `
      padding: 8px 12px; border-radius: 8px;
      background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15);
      color: rgba(255,255,255,0.7); font-size: 13px; font-weight: 700; cursor: pointer;
      pointer-events: auto; transition: all calc(0.2s / var(--ui-anim-speed)) ease;
    `;
    exportBtn.onmouseenter = () => { exportBtn.style.background = 'rgba(255,255,255,0.12)'; };
    exportBtn.onmouseleave = () => { exportBtn.style.background = 'rgba(255,255,255,0.06)'; };
    exportBtn.onclick = () => this._exportHighlight(h);
    actions.appendChild(exportBtn);

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.textContent = '🗑';
    delBtn.style.cssText = `
      padding: 8px 12px; border-radius: 8px;
      background: rgba(185,18,63,0.12); border: 1px solid rgba(185,18,63,0.35);
      color: #ff8a9a; font-size: 13px; font-weight: 700; cursor: pointer;
      pointer-events: auto; transition: all calc(0.2s / var(--ui-anim-speed)) ease;
    `;
    delBtn.onmouseenter = () => { delBtn.style.background = 'rgba(185,18,63,0.22)'; };
    delBtn.onmouseleave = () => { delBtn.style.background = 'rgba(185,18,63,0.12)'; };
    delBtn.onclick = () => {
      this._showConfirm('确定要删除这条精彩瞬间吗？', () => {
        highlightStore.delete(h.id);
        this._render();
      });
    };
    actions.appendChild(delBtn);

    card.appendChild(actions);
    return card;
  }

  _modeLabel(mode) {
    const map = {
      freeplay: '练习', local2p: '本地对战', vsai: 'VS AI',
      nineball: '9球', trainer: '训练', challenge: '挑战',
      tournament: '锦标赛', spectator: '观赛', network: '联机',
      match: '比赛', unknown: '未知',
    };
    return map[mode] || mode;
  }

  _exportHighlight(h) {
    let url = null;
    try {
      const blob = new Blob([JSON.stringify(h.replayData, null, 2)], { type: 'application/json' });
      url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `highlight-${h.id}.json`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Delay revoke to ensure the browser has started the download
      setTimeout(() => { if (url) URL.revokeObjectURL(url); }, 30000);
    } catch (e) {
      console.warn('Export highlight failed', e);
      if (url) URL.revokeObjectURL(url);
    }
  }

  _showConfirm(message, onConfirm) {
    if (this._confirmOverlay) return; // already showing
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.55);
      backdrop-filter: blur(6px);
      transition: opacity calc(0.2s / var(--ui-anim-speed)) ease;
      opacity: 0; pointer-events: auto;
    `;
    const box = document.createElement('div');
    box.style.cssText = `
      background: var(--panel-strong, rgba(20,24,28,0.95));
      border: 1px solid var(--line, rgba(255,255,255,0.12));
      border-radius: 16px; padding: 24px 28px;
      max-width: 360px; width: 90%;
      display: flex; flex-direction: column; gap: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    `;
    const msg = document.createElement('div');
    msg.textContent = message;
    msg.style.cssText = 'font-size: 15px; color: #fff; line-height: 1.5; font-weight: 600;';
    box.appendChild(msg);
    const btns = document.createElement('div');
    btns.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end;';
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = '取消';
    cancelBtn.style.cssText = `
      padding: 8px 18px; border-radius: 8px; font-size: 13px; font-weight: 700;
      background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15);
      color: rgba(255,255,255,0.7); cursor: pointer; pointer-events: auto;
      transition: all calc(0.15s / var(--ui-anim-speed)) ease;
    `;
    cancelBtn.onmouseenter = () => { cancelBtn.style.background = 'rgba(255,255,255,0.12)'; };
    cancelBtn.onmouseleave = () => { cancelBtn.style.background = 'rgba(255,255,255,0.06)'; };
    const okBtn = document.createElement('button');
    okBtn.type = 'button';
    okBtn.textContent = '确定';
    okBtn.style.cssText = `
      padding: 8px 18px; border-radius: 8px; font-size: 13px; font-weight: 700;
      background: rgba(185,18,63,0.18); border: 1px solid rgba(185,18,63,0.45);
      color: #ff8a9a; cursor: pointer; pointer-events: auto;
      transition: all calc(0.15s / var(--ui-anim-speed)) ease;
    `;
    okBtn.onmouseenter = () => { okBtn.style.background = 'rgba(185,18,63,0.28)'; };
    okBtn.onmouseleave = () => { okBtn.style.background = 'rgba(185,18,63,0.18)'; };
    const close = () => {
      overlay.style.opacity = '0';
      setTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        if (this._confirmOverlay === overlay) this._confirmOverlay = null;
      }, animMs(200));
    };
    cancelBtn.onclick = close;
    okBtn.onclick = () => { close(); if (onConfirm) onConfirm(); };
    btns.appendChild(cancelBtn);
    btns.appendChild(okBtn);
    box.appendChild(btns);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    this._confirmOverlay = overlay;
    requestAnimationFrame(() => { overlay.style.opacity = '1'; });
  }
}
