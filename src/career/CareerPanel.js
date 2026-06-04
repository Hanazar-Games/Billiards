/**
 * CareerPanel — Full-screen career statistics & shot style profiler UI.
 *
 * Displays: overview cards, style badges, mode win-rates, spin preference,
 * power distribution histogram, special-shot accuracy, and personal records.
 */

import { ShotProfiler } from './ShotProfiler.js';
import { careerStore } from './CareerStore.js';

const GLASS_BG = `
  background:
    linear-gradient(135deg, rgba(16,100,66,0.22), rgba(9,11,13,0.96) 42%),
    linear-gradient(25deg, rgba(122,26,38,0.16), rgba(9,11,13,0.96) 38%);
  backdrop-filter: blur(20px);
`;

const CARD_BG = 'background:rgba(12,15,18,0.68);border:1px solid rgba(255,255,255,0.08);border-radius:10px;';

const ACCENT_GOLD = 'rgba(216,177,95,1)';
const ACCENT_TEAL = 'rgba(78,205,196,1)';
const ACCENT_RED  = 'rgba(255,107,107,1)';

export class CareerPanel {
  constructor(onBack) {
    this.onBack = onBack;
    this.profiler = new ShotProfiler(careerStore);
    this.container = null;
    this._buildUI();
    this._setupKeyboard();
  }

  /* ── Lifecycle ── */

  show() {
    if (!this.container) this._buildUI();
    this._render();
    const wasHidden = this.container.style.display !== 'flex';
    this.container.style.display = 'flex';
    if (wasHidden) {
      this.container.style.animation = 'panelIn 260ms cubic-bezier(0.2,0.8,0.2,1) both';
    }
  }

  hide() {
    if (this.container) this.container.style.display = 'none';
  }

  destroy() {
    if (this._onKeyDown) {
      document.removeEventListener('keydown', this._onKeyDown);
      this._onKeyDown = null;
    }
    // Null all inline event handlers on close button before removal
    const closeBtn = this.container?.querySelector('#career-close-btn');
    if (closeBtn) {
      closeBtn.onmouseenter = null;
      closeBtn.onmouseleave = null;
      closeBtn.onclick = null;
    }
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.profiler = null;
  }

  /* ── Build ── */

  _buildUI() {
    if (this.container) return;

    this.container = document.createElement('div');
    this.container.id = 'career-panel';
    this.container.style.cssText = `
      position: fixed; inset: 0;
      display: none; flex-direction: column; align-items: center;
      padding: max(32px, env(safe-area-inset-top)) 20px max(40px, env(safe-area-inset-bottom));
      overflow-y: auto;
      z-index: 200;
      ${GLASS_BG}
    `;

    const wrap = document.createElement('div');
    wrap.style.cssText = `
      max-width: 960px; width: 100%;
      display: flex; flex-direction: column; gap: 22px;
      padding-bottom: env(safe-area-inset-bottom, 0);
    `;

    // Header
    wrap.appendChild(this._header());

    // Sections (populated in _render)
    this._overviewSection = document.createElement('div');
    this._overviewSection.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:14px;';
    // Mobile responsive: 2 columns on narrow screens
    const mq = document.createElement('style');
    mq.textContent = `
      @media (max-width: 600px) {
        #career-panel .overview-grid { grid-template-columns: repeat(2, 1fr) !important; }
        #career-panel .tips-grid { grid-template-columns: 1fr !important; }
      }
    `;
    mq.id = 'career-panel-mq';
    if (!document.getElementById('career-panel-mq')) document.head.appendChild(mq);
    wrap.appendChild(this._overviewSection);

    this._tipsSection = document.createElement('div');
    wrap.appendChild(this._tipsSection);

    this._styleSection = document.createElement('div');
    wrap.appendChild(this._styleSection);

    this._modeSection = document.createElement('div');
    wrap.appendChild(this._modeSection);

    this._spinSection = document.createElement('div');
    wrap.appendChild(this._spinSection);

    this._powerSection = document.createElement('div');
    wrap.appendChild(this._powerSection);

    this._specialSection = document.createElement('div');
    wrap.appendChild(this._specialSection);

    this._recordsSection = document.createElement('div');
    wrap.appendChild(this._recordsSection);

    this._emptyState = document.createElement('div');
    this._emptyState.style.cssText = `
      text-align:center;color:rgba(255,255,255,0.4);font-size:15px;padding:60px 20px;
    `;
    this._emptyState.textContent = '暂无生涯数据。开始一场比赛来建立你的击球档案！';
    wrap.appendChild(this._emptyState);

    this.container.appendChild(wrap);
    document.body.appendChild(this.container);
  }

  _header() {
    const el = document.createElement('div');
    el.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:16px;';

    const title = document.createElement('h2');
    title.textContent = '🏆 生涯统计';
    title.style.cssText = `
      margin:0;font-size:26px;font-weight:800;color:${ACCENT_GOLD};letter-spacing:1px;
      text-shadow:0 2px 12px rgba(216,177,95,0.25);
    `;

    const close = document.createElement('button');
    close.id = 'career-close-btn';
    close.textContent = '✕';
    close.style.cssText = `
      width:38px;height:38px;border-radius:10px;
      background:rgba(12,15,18,0.7);border:1px solid rgba(255,255,255,0.12);
      color:rgba(255,255,255,0.7);font-size:18px;cursor:pointer;
      display:flex;align-items:center;justify-content:center;
      transition:all 0.2s ease;
    `;
    close.onmouseenter = () => {
      close.style.background = 'rgba(255,255,255,0.1)';
      close.style.color = '#fff';
    };
    close.onmouseleave = () => {
      close.style.background = 'rgba(12,15,18,0.7)';
      close.style.color = 'rgba(255,255,255,0.7)';
    };
    close.onclick = () => this.onBack?.();

    el.appendChild(title);
    el.appendChild(close);
    return el;
  }

  /* ── Render ── */

  _render() {
    const summary = this.profiler.getSummary();
    const hasData = summary.games > 0 || summary.shots > 0;

    if (!hasData) {
      this._emptyState.style.display = 'block';
      this._overviewSection.innerHTML = '';
      this._tipsSection.innerHTML = '';
      this._styleSection.innerHTML = '';
      this._modeSection.innerHTML = '';
      this._spinSection.innerHTML = '';
      this._powerSection.innerHTML = '';
      this._specialSection.innerHTML = '';
      this._recordsSection.innerHTML = '';
      return;
    }

    this._emptyState.style.display = 'none';
    this._renderOverview(summary);
    this._renderTrainingTips();
    this._renderStyleTags(summary.labels);
    this._renderModeBreakdown();
    this._renderSpinPreference();
    this._renderPowerDistribution();
    this._renderSpecialShots();
    this._renderRecords(summary);
  }

  _renderTrainingTips() {
    const tips = this.profiler.getTrainingTips();
    this._tipsSection.innerHTML = '';
    if (!tips || tips.length === 0) return;

    const title = this._sectionTitle('🎯 训练建议 / 下一步提升');
    this._tipsSection.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'tips-grid';
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;';

    for (const tip of tips) {
      const card = document.createElement('div');
      card.style.cssText = `${CARD_BG} padding:14px 16px;display:flex;flex-direction:column;gap:6px;`;

      const header = document.createElement('div');
      header.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:2px;';

      const icon = document.createElement('span');
      icon.textContent = tip.icon;
      icon.style.cssText = 'font-size:18px;';

      const category = document.createElement('span');
      category.textContent = tip.category;
      category.style.cssText = 'font-size:11px;font-weight:700;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.6px;';

      const name = document.createElement('span');
      name.textContent = tip.title;
      name.style.cssText = `font-weight:800;color:${ACCENT_GOLD};font-size:14px;margin-left:auto;text-align:right;`;

      header.appendChild(icon);
      header.appendChild(category);
      header.appendChild(name);

      const text = document.createElement('div');
      text.textContent = tip.text;
      text.style.cssText = 'font-size:12.5px;color:rgba(255,255,255,0.75);line-height:1.55;';

      card.appendChild(header);
      card.appendChild(text);
      grid.appendChild(card);
    }

    this._tipsSection.appendChild(grid);
  }

  _renderOverview(s) {
    const cards = [
      { icon: '🎱', label: '总局数', value: String(s.games), color: ACCENT_GOLD },
      { icon: '🏅', label: '胜率', value: `${s.winRate}%`, color: ACCENT_TEAL },
      { icon: '🎯', label: '总击球', value: String(s.shots), color: 'rgba(168,224,99,1)' },
      { icon: '🔥', label: '最长连杆', value: String(s.maxConsecutive), color: ACCENT_RED },
    ];

    this._overviewSection.innerHTML = '';
    for (const c of cards) {
      const card = document.createElement('div');
      card.style.cssText = `${CARD_BG} padding:16px;text-align:center;transition:transform 0.2s ease;cursor:default;`;
      card.onmouseenter = () => { card.style.transform = 'translateY(-2px)'; };
      card.onmouseleave = () => { card.style.transform = 'translateY(0)'; };

      const icon = document.createElement('div');
      icon.textContent = c.icon;
      icon.style.cssText = 'font-size:22px;margin-bottom:6px;';

      const value = document.createElement('div');
      value.textContent = c.value;
      value.style.cssText = `font-size:22px;font-weight:800;color:${c.color};margin-bottom:2px;`;

      const label = document.createElement('div');
      label.textContent = c.label;
      label.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:0.8px;';

      card.appendChild(icon);
      card.appendChild(value);
      card.appendChild(label);
      this._overviewSection.appendChild(card);
    }
  }

  _renderStyleTags(labels) {
    this._styleSection.innerHTML = '';
    if (!labels || labels.length === 0) return;

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;';

    for (const tag of labels) {
      const badge = document.createElement('div');
      badge.style.cssText = `
        ${CARD_BG} padding:8px 16px;display:flex;align-items:center;gap:8px;
        border-color:rgba(216,177,95,0.25);
      `;

      const name = document.createElement('span');
      name.textContent = tag.label;
      name.style.cssText = `font-weight:700;color:${ACCENT_GOLD};font-size:14px;`;

      const desc = document.createElement('span');
      desc.textContent = tag.desc;
      desc.style.cssText = 'font-size:12px;color:rgba(255,255,255,0.65);';

      badge.appendChild(name);
      badge.appendChild(desc);
      wrap.appendChild(badge);
    }

    this._styleSection.appendChild(wrap);
  }

  _renderModeBreakdown() {
    const modes = this.profiler.getModeBreakdown();
    this._modeSection.innerHTML = '';
    if (modes.length === 0) return;

    const title = this._sectionTitle('🎮 模式战绩');
    this._modeSection.appendChild(title);

    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;';

    for (const m of modes) {
      const card = document.createElement('div');
      card.style.cssText = `${CARD_BG} padding:14px 16px;`;

      const header = document.createElement('div');
      header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;';

      const name = document.createElement('span');
      name.textContent = m.label;
      name.style.cssText = 'font-weight:700;color:rgba(255,255,255,0.85);font-size:14px;';

      const rate = document.createElement('span');
      rate.textContent = `${m.winRate}%`;
      rate.style.cssText = `font-weight:800;color:${ACCENT_TEAL};font-size:15px;`;

      header.appendChild(name);
      header.appendChild(rate);

      // Bar
      const barWrap = document.createElement('div');
      barWrap.style.cssText = 'height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;margin-bottom:8px;';
      const bar = document.createElement('div');
      const pct = Math.min(100, parseFloat(m.winRate) || 0);
      bar.style.cssText = `height:100%;width:${pct}%;background:${ACCENT_TEAL};border-radius:3px;transition:width 0.6s ease;`;
      barWrap.appendChild(bar);

      const footer = document.createElement('div');
      footer.style.cssText = 'display:flex;gap:12px;font-size:11px;color:rgba(255,255,255,0.4);';
      footer.innerHTML = `
        <span>胜 ${m.won}</span>
        <span>负 ${m.lost}</span>
        <span>总 ${m.played}</span>
      `;

      card.appendChild(header);
      card.appendChild(barWrap);
      card.appendChild(footer);
      grid.appendChild(card);
    }

    this._modeSection.appendChild(grid);
  }

  _renderSpinPreference() {
    const spins = this.profiler.getSpinPreference();
    this._spinSection.innerHTML = '';
    if (spins.length === 0) return;

    const title = this._sectionTitle('🔄 杆法偏好');
    this._spinSection.appendChild(title);

    const wrap = document.createElement('div');
    wrap.style.cssText = `${CARD_BG} padding:16px 20px;display:flex;flex-direction:column;gap:10px;`;

    const maxCount = Math.max(1, spins[0]?.count || 1);
    for (const s of spins) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:12px;';

      const label = document.createElement('span');
      label.textContent = s.name;
      label.style.cssText = 'width:48px;font-size:13px;color:rgba(255,255,255,0.6);';

      const barWrap = document.createElement('div');
      barWrap.style.cssText = 'flex:1;height:8px;background:rgba(255,255,255,0.06);border-radius:4px;overflow:hidden;';
      const bar = document.createElement('div');
      const w = (s.count / maxCount) * 100;
      const colors = ['rgba(216,177,95,0.9)', 'rgba(78,205,196,0.9)', 'rgba(168,224,99,0.9)', 'rgba(255,159,67,0.9)', 'rgba(255,107,107,0.9)'];
      bar.style.cssText = `height:100%;width:${w}%;background:${colors[spins.indexOf(s) % colors.length]};border-radius:4px;`;
      barWrap.appendChild(bar);

      const pct = document.createElement('span');
      pct.textContent = `${s.pct}%`;
      pct.style.cssText = 'width:40px;text-align:right;font-size:12px;color:rgba(255,255,255,0.6);font-variant-numeric:tabular-nums;';

      row.appendChild(label);
      row.appendChild(barWrap);
      row.appendChild(pct);
      wrap.appendChild(row);
    }

    this._spinSection.appendChild(wrap);
  }

  _renderPowerDistribution() {
    const style = careerStore.getShotStyle();
    const buckets = style.powerBuckets || [0, 0, 0, 0, 0];
    const total = buckets.reduce((a, b) => a + b, 0);
    this._powerSection.innerHTML = '';
    if (total === 0) return;

    const title = this._sectionTitle('💪 力度分布');
    this._powerSection.appendChild(title);

    const wrap = document.createElement('div');
    wrap.style.cssText = `${CARD_BG} padding:20px;display:flex;align-items:flex-end;justify-content:center;gap:18px;height:120px;`;

    const labels = ['轻推\n0-20%', '柔和\n20-40%', '中等\n40-60%', '重击\n60-80%', '暴杆\n80-100%'];
    const maxVal = Math.max(1, ...buckets);

    for (let i = 0; i < 5; i++) {
      const col = document.createElement('div');
      col.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:6px;flex:1;max-width:80px;';

      const count = document.createElement('span');
      count.textContent = String(buckets[i]);
      count.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.4);font-variant-numeric:tabular-nums;';

      const barWrap = document.createElement('div');
      barWrap.style.cssText = 'width:32px;background:rgba(255,255,255,0.06);border-radius:4px;flex:1;position:relative;overflow:hidden;';

      const bar = document.createElement('div');
      const h = (buckets[i] / maxVal) * 100;
      const gradient = `linear-gradient(180deg, rgba(216,177,95,0.9), rgba(216,177,95,0.3))`;
      bar.style.cssText = `
        position:absolute;bottom:0;left:0;right:0;
        height:${h}%;background:${gradient};border-radius:4px;
        transition:height 0.5s ease;
      `;
      barWrap.appendChild(bar);

      const lbl = document.createElement('span');
      lbl.textContent = labels[i];
      lbl.style.cssText = 'font-size:10px;color:rgba(255,255,255,0.55);text-align:center;white-space:pre-line;line-height:1.3;';

      col.appendChild(count);
      col.appendChild(barWrap);
      col.appendChild(lbl);
      wrap.appendChild(col);
    }

    this._powerSection.appendChild(wrap);
  }

  _renderSpecialShots() {
    const specials = this.profiler.getSpecialShots();
    this._specialSection.innerHTML = '';
    if (specials.length === 0) return;

    const title = this._sectionTitle('✨ 特殊击球');
    this._specialSection.appendChild(title);

    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;';

    for (const s of specials) {
      const card = document.createElement('div');
      card.style.cssText = `${CARD_BG} padding:14px 16px;`;

      const header = document.createElement('div');
      header.style.cssText = 'display:flex;justify-content:space-between;margin-bottom:8px;';

      const name = document.createElement('span');
      name.textContent = s.name;
      name.style.cssText = 'font-weight:700;color:rgba(255,255,255,0.8);font-size:14px;';

      const rate = document.createElement('span');
      rate.textContent = `${s.rate}${s.name === '开球' ? ' 球/局' : '%'}`;
      rate.style.cssText = `font-weight:800;color:${ACCENT_GOLD};font-size:14px;`;

      header.appendChild(name);
      header.appendChild(rate);

      const footer = document.createElement('div');
      footer.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.55);';
      if (s.name === '开球') {
        footer.textContent = `共 ${s.attempts} 局开球，进 ${s.success} 球`;
      } else {
        footer.textContent = `尝试 ${s.attempts} 次，成功 ${s.success} 次`;
      }

      card.appendChild(header);
      card.appendChild(footer);
      grid.appendChild(card);
    }

    this._specialSection.appendChild(grid);
  }

  _renderRecords(summary) {
    this._recordsSection.innerHTML = '';
    const rec = careerStore.getRecords();

    const items = [
      { icon: '🔥', label: '最长连杆', value: `${rec.maxConsecutivePockets} 球` },
      { icon: '⚡', label: '单局最高连杆', value: `${rec.maxConsecutivePocketsInGame} 球` },
      { icon: '💪', label: '最高力度', value: `${rec.highestShotPower}%` },
      { icon: '🎯', label: '单杆最多进球', value: `${rec.highestBallsInOneTurn} 球` },
      { icon: '💥', label: '单杆最多碰撞', value: `${rec.mostCollisionsInOneShot} 次` },
      { icon: '🧱', label: '单杆最多碰库', value: `${rec.mostCushionsInOneShot} 次` },
    ];

    if (Number.isFinite(rec.fastestWinSeconds) && rec.fastestWinSeconds > 0) {
      const min = Math.floor(rec.fastestWinSeconds / 60);
      const sec = String(Math.floor(rec.fastestWinSeconds % 60)).padStart(2, '0');
      items.splice(2, 0, { icon: '⏱️', label: '最快胜利', value: `${min}:${sec}` });
    }

    const title = this._sectionTitle('📜 最佳记录');
    this._recordsSection.appendChild(title);

    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;';

    for (const item of items) {
      const card = document.createElement('div');
      card.style.cssText = `${CARD_BG} padding:12px 14px;display:flex;align-items:center;gap:10px;`;

      const icon = document.createElement('span');
      icon.textContent = item.icon;
      icon.style.cssText = 'font-size:18px;';

      const col = document.createElement('div');
      col.style.cssText = 'display:flex;flex-direction:column;';

      const val = document.createElement('span');
      val.textContent = item.value;
      val.style.cssText = `font-weight:800;color:${ACCENT_GOLD};font-size:15px;`;

      const lbl = document.createElement('span');
      lbl.textContent = item.label;
      lbl.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.4);';

      col.appendChild(val);
      col.appendChild(lbl);
      card.appendChild(icon);
      card.appendChild(col);
      grid.appendChild(card);
    }

    this._recordsSection.appendChild(grid);
  }

  _sectionTitle(text) {
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = `
      font-size:15px;font-weight:700;color:rgba(255,255,255,0.7);
      letter-spacing:0.5px;margin-bottom:6px;margin-top:4px;
    `;
    return el;
  }

  _setupKeyboard() {
    this._onKeyDown = (e) => {
      if (e.key === 'Escape' && this.container && this.container.style.display === 'flex') {
        if (this.onBack) this.onBack();
      }
    };
    document.addEventListener('keydown', this._onKeyDown);
  }
}
