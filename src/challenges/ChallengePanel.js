/**
 * ChallengePanel — UI for browsing and selecting challenges.
 *
 * v2 adds:
 *   - Overall progress bar
 *   - Daily challenge banner
 *   - Featured challenge banner
 *   - Difficulty filter tabs
 *   - Lock states with requirements
 *   - Attempts / completions badges
 */
import {
  CHALLENGES,
  getDailyChallengeId,
  getFeaturedChallengeId,
  getProgress,
  getStarConditions,
  getDifficultyLabel,
  isUnlocked,
  getUnlockRequirement,
} from './ChallengeData.js';
import { ChallengeManager } from './ChallengeManager.js';
import { animMs } from '../core/AnimSpeed.js';

export class ChallengePanel {
  constructor(onSelectChallenge, onBack, { growthPath } = {}) {
    this.onSelectChallenge = onSelectChallenge;
    this.onBack = onBack;
    this.growthPath = growthPath;
    this.container = null;
    this.activeFilter = 0; // 0 = all
    this._buildUI();
    this._setupKeyboard();
  }

  _buildUI() {
    this.container = document.createElement('div');
    this.container.id = 'challenge-panel';
    this.container.style.cssText = `
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

    const wrap = document.createElement('div');
    wrap.style.cssText = 'width:100%;max-width:900px;display:flex;flex-direction:column;gap:18px;';
    this.container.appendChild(wrap);

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex; justify-content: space-between;
      align-items: center; width: 100%;
    `;
    const title = document.createElement('div');
    title.innerHTML = '<span style="font-size:28px;font-weight:850;color:#f4f7f4;">挑战模式</span>';
    header.appendChild(title);
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.title = '返回菜单';
    closeBtn.className = 'ui-action';
    closeBtn.style.cssText = 'width:40px;height:40px;font-size:20px;border-radius:50%;pointer-events:auto;';
    closeBtn.onclick = () => this.onBack?.();
    header.appendChild(closeBtn);
    wrap.appendChild(header);

    // Progress bar
    this.progressWrap = document.createElement('div');
    wrap.appendChild(this.progressWrap);

    // For You (Growth Path) banner
    this._forYouWrap = document.createElement('div');
    this._forYouWrap.style.cssText = 'display:none;flex-direction:column;gap:10px;';
    wrap.appendChild(this._forYouWrap);

    // Filter tabs
    const filterRow = document.createElement('div');
    filterRow.id = 'challenge-filters';
    filterRow.style.cssText = `
      display: flex; gap: 8px; flex-wrap: wrap;
    `;
    const filters = [
      { label: '全部', value: 0 },
      { label: '简单', value: 2 },
      { label: '中等', value: 3 },
      { label: '困难', value: 4 },
      { label: '大师', value: 5 },
    ];
    filters.forEach((f) => {
      const btn = document.createElement('button');
      btn.textContent = f.label;
      btn.dataset.difficulty = f.value;
      btn.style.cssText = this._filterBtnStyle(f.value === this.activeFilter);
      btn.onclick = () => {
        this.activeFilter = f.value;
        filterRow.querySelectorAll('button').forEach((b) => {
          b.style.cssText = this._filterBtnStyle(parseInt(b.dataset.difficulty, 10) === this.activeFilter);
        });
        this._renderList();
      };
      filterRow.appendChild(btn);
    });
    wrap.appendChild(filterRow);

    // Daily + Featured banners (horizontal on desktop, stacked on mobile)
    const banners = document.createElement('div');
    banners.id = 'challenge-banners';
    banners.style.cssText = `
      display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px;
    `;
    wrap.appendChild(banners);

    // Grid
    const grid = document.createElement('div');
    grid.id = 'challenge-grid';
    grid.style.cssText = `
      display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px; width: 100%;
    `;
    wrap.appendChild(grid);

    document.body.appendChild(this.container);
  }

  _filterBtnStyle(active) {
    const bg = active ? 'rgba(216,177,95,0.25)' : 'rgba(255,255,255,0.08)';
    const border = active ? 'rgba(216,177,95,0.6)' : 'rgba(255,255,255,0.12)';
    return `
      padding: 6px 16px; font-size: 13px; font-weight: 600; color: #fff;
      background: ${bg}; border: 1px solid ${border}; border-radius: 20px;
      cursor: pointer; transition: all 180ms ease; pointer-events: auto;
    `;
  }

  show() {
    this.container.style.display = 'flex';
    this.container.style.animation = 'panelIn 260ms cubic-bezier(0.2,0.8,0.2,1) both';
    this._renderList();
  }

  hide() {
    this.container.style.display = 'none';
  }

  _setupKeyboard() {
    this._onKeyDown = (e) => {
      if (e.key === 'Escape' && this.container && this.container.style.display === 'flex') {
        if (this.onBack) this.onBack();
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

  // ── Rendering ──

  _renderList() {
    const grid = this.container.querySelector('#challenge-grid');
    const banners = this.container.querySelector('#challenge-banners');
    const progressWrap = this.progressWrap;
    if (!grid || !banners || !progressWrap) return;

    grid.innerHTML = '';
    banners.innerHTML = '';
    progressWrap.innerHTML = '';
    this._forYouWrap.innerHTML = '';
    this._forYouWrap.style.display = 'none';

    const bestData = ChallengeManager.getAllBest();
    const progress = getProgress(bestData);

    // Progress bar
    this._renderProgressBar(progressWrap, progress);

    // Growth Path recommendations
    this._recommendedIds = new Set();
    if (this.growthPath) {
      const recs = this.growthPath.analyze();
      const chRecs = recs.filter((r) => r.type === 'challenge');
      if (chRecs.length > 0) {
        this._forYouWrap.style.display = 'flex';
        this._renderForYou(chRecs, bestData);
        for (const r of chRecs) this._recommendedIds.add(r.id);
      }
    }

    // Daily & Featured
    const dailyId = getDailyChallengeId();
    const featuredId = getFeaturedChallengeId(bestData);
    const daily = CHALLENGES.find((c) => c.id === dailyId);
    const featured = CHALLENGES.find((c) => c.id === featuredId);
    if (daily) banners.appendChild(this._createBanner(daily, bestData, 'daily'));
    if (featured && featured.id !== dailyId) banners.appendChild(this._createBanner(featured, bestData, 'featured'));

    // Filtered list
    const list = this.activeFilter === 0
      ? CHALLENGES
      : CHALLENGES.filter((c) => c.difficulty === this.activeFilter);

    list.forEach((ch) => {
      const best = bestData[ch.id] || { stars: 0 };
      const unlocked = isUnlocked(ch, bestData);
      const isRecommended = this._recommendedIds.has(ch.id);
      const card = this._createCard(ch, best, unlocked, isRecommended);
      grid.appendChild(card);
    });
  }

  _renderProgressBar(container, progress) {
    const barWrap = document.createElement('div');
    barWrap.style.cssText = `
      background: rgba(255,255,255,0.06); border-radius: 10px; padding: 12px 16px;
      display: flex; align-items: center; gap: 12px;
    `;

    const pct = progress.percent;
    const barBg = document.createElement('div');
    barBg.style.cssText = 'flex:1;height:10px;background:rgba(255,255,255,0.1);border-radius:5px;overflow:hidden;';
    const barFill = document.createElement('div');
    barFill.style.cssText = `
      width: ${pct}%; height: 100%; background: linear-gradient(90deg, #d8b15f, #ffd700);
      border-radius: 5px; transition: width 400ms ease;
    `;
    barBg.appendChild(barFill);

    const label = document.createElement('div');
    label.style.cssText = 'font-size:13px;color:rgba(255,255,255,0.7);white-space:nowrap;';
    label.textContent = `${progress.earned}/${progress.max} ★　${pct}%`;

    barWrap.appendChild(barBg);
    barWrap.appendChild(label);
    container.appendChild(barWrap);
  }

  _createBanner(ch, bestData, kind) {
    const best = bestData[ch.id] || { stars: 0 };
    const unlocked = isUnlocked(ch, bestData);
    const el = document.createElement('div');
    const accent = kind === 'daily' ? '#ff6b6b' : '#4ecdc4';
    const label = kind === 'daily' ? '📅 每日挑战' : '🔥 精选挑战';
    el.style.cssText = `
      padding: 16px; border-radius: 10px; cursor: pointer; pointer-events: auto;
      background: ${unlocked ? `linear-gradient(135deg, ${accent}22, rgba(12,15,18,0.9))` : 'rgba(12,15,18,0.7)'};
      border: 1px solid ${unlocked ? accent + '55' : 'rgba(255,255,255,0.1)'};
      transition: transform 180ms ease, box-shadow 180ms ease;
    `;
    el.onmouseenter = () => { if (unlocked) { el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 12px 32px rgba(0,0,0,0.3)'; } };
    el.onmouseleave = () => { el.style.transform = 'translateY(0)'; el.style.boxShadow = 'none'; };
    el.onclick = () => { if (unlocked && this.onSelectChallenge) this.onSelectChallenge(ch); };

    const top = document.createElement('div');
    top.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;';
    const name = document.createElement('div');
    name.style.cssText = 'font-size:15px;font-weight:780;color:#f4f7f4;';
    name.textContent = ch.name;
    const tag = document.createElement('span');
    tag.style.cssText = `font-size:11px;font-weight:700;color:${accent};background:${accent}22;padding:2px 8px;border-radius:4px;`;
    tag.textContent = label;
    top.appendChild(name);
    top.appendChild(tag);
    el.appendChild(top);

    const desc = document.createElement('div');
    desc.style.cssText = 'font-size:12px;color:rgba(255,255,255,0.55);margin-bottom:8px;';
    desc.textContent = unlocked ? ch.desc : getUnlockRequirement(ch);
    el.appendChild(desc);

    const bottom = document.createElement('div');
    bottom.style.cssText = 'display:flex;justify-content:space-between;align-items:center;';
    const stars = document.createElement('div');
    stars.style.cssText = 'font-size:14px;color:#ffd700;';
    stars.textContent = best.stars > 0 ? '★'.repeat(best.stars) + '☆'.repeat(3 - best.stars) : '未通关';
    bottom.appendChild(stars);
    const diff = document.createElement('span');
    diff.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.35);';
    diff.textContent = getDifficultyLabel(ch.difficulty);
    bottom.appendChild(diff);
    el.appendChild(bottom);

    return el;
  }

  _renderForYou(chRecs, bestData) {
    const title = document.createElement('div');
    title.style.cssText = `
      font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.7);
      letter-spacing: 0.5px;
    `;
    title.textContent = '🌱 为你推荐';
    this._forYouWrap.appendChild(title);

    const row = document.createElement('div');
    row.style.cssText = `
      display: flex; gap: 10px; flex-wrap: wrap;
    `;

    for (const r of chRecs.slice(0, 3)) {
      const ch = CHALLENGES.find((c) => c.id === r.id);
      const unlocked = ch ? isUnlocked(ch, bestData) : false;
      const chip = document.createElement('button');
      chip.style.cssText = `
        padding: 8px 14px; font-size: 13px; font-weight: 700; color: #fff;
        background: linear-gradient(135deg, rgba(255,107,107,0.25), rgba(255,107,107,0.10));
        border: 1px solid rgba(255,107,107,0.45); border-radius: 8px;
        cursor: ${unlocked ? 'pointer' : 'default'}; pointer-events: auto; transition: all 180ms ease;
        display: flex; align-items: center; gap: 8px;
        opacity: ${unlocked ? '1' : '0.5'};
      `;
      chip.innerHTML = `
        <span style="font-size:11px;color:#ff6b6b;background:rgba(255,107,107,0.15);padding:2px 6px;border-radius:4px;">挑战</span>
        <span>${r.name}</span>
      `;
      if (unlocked) {
        chip.onmouseenter = () => {
          chip.style.borderColor = 'rgba(255,107,107,0.8)';
          chip.style.transform = 'translateY(-1px)';
        };
        chip.onmouseleave = () => {
          chip.style.borderColor = 'rgba(255,107,107,0.45)';
          chip.style.transform = 'translateY(0)';
        };
        chip.onclick = () => {
          if (this.onSelectChallenge && ch) this.onSelectChallenge(ch);
        };
      }
      row.appendChild(chip);
    }

    this._forYouWrap.appendChild(row);
  }

  _createCard(ch, best, unlocked, isRecommended = false) {
    const card = document.createElement('div');
    const borderColor = isRecommended
      ? 'rgba(255,107,107,0.55)'
      : (unlocked ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.06)');
    card.style.cssText = `
      padding: 18px;
      background: ${unlocked ? 'rgba(12,15,18,0.7)' : 'rgba(12,15,18,0.45)'};
      border: 1px solid ${borderColor};
      border-radius: 8px;
      transition: transform 180ms cubic-bezier(0.2,0.8,0.2,1), background 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
      pointer-events: ${unlocked ? 'auto' : 'none'};
      cursor: ${unlocked ? 'pointer' : 'default'};
      box-shadow: 0 14px 38px rgba(0,0,0,0.25);
      position: relative; overflow: hidden;
    `;
    if (unlocked) {
      card.onmouseenter = () => {
        card.style.background = 'rgba(20,26,30,0.86)';
        card.style.borderColor = isRecommended ? 'rgba(255,107,107,0.8)' : 'rgba(216,177,95,0.45)';
        card.style.transform = 'translateY(-2px)';
        card.style.boxShadow = '0 20px 54px rgba(0,0,0,0.34)';
      };
      card.onmouseleave = () => {
        card.style.background = 'rgba(12,15,18,0.7)';
        card.style.borderColor = borderColor;
        card.style.transform = 'translateY(0)';
        card.style.boxShadow = '0 14px 38px rgba(0,0,0,0.25)';
      };
      card.onclick = () => {
        if (this.onSelectChallenge) this.onSelectChallenge(ch);
      };
    }

    // Top row: name + difficulty
    const topRow = document.createElement('div');
    topRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;';
    const name = document.createElement('div');
    name.style.cssText = `font-size:16px;font-weight:780;color:${unlocked ? '#f4f7f4' : 'rgba(255,255,255,0.4)'};`;
    name.textContent = ch.name;
    topRow.appendChild(name);
    const diff = document.createElement('div');
    diff.style.cssText = 'font-size:13px;color:#ffd700;letter-spacing:1px;';
    diff.textContent = '★'.repeat(ch.difficulty) + '☆'.repeat(5 - ch.difficulty);
    topRow.appendChild(diff);
    card.appendChild(topRow);

    // Description or lock reason
    const desc = document.createElement('div');
    desc.style.cssText = 'font-size:13px;color:rgba(255,255,255,0.6);margin-bottom:12px;line-height:1.5;min-height:38px;';
    desc.textContent = unlocked ? ch.desc : `🔒 ${getUnlockRequirement(ch)}`;
    card.appendChild(desc);

    // Star conditions hint (small)
    if (unlocked) {
      const hint = document.createElement('div');
      hint.style.cssText = 'font-size:11px;color:rgba(216,177,95,0.7);margin-bottom:10px;';
      hint.textContent = getStarConditions(ch);
      card.appendChild(hint);
    }

    // Bottom row
    const bottomRow = document.createElement('div');
    bottomRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;';

    const starDisplay = document.createElement('div');
    starDisplay.style.cssText = 'font-size:14px;color:#ffd700;';
    starDisplay.textContent = best.stars > 0 ? '★'.repeat(best.stars) + '☆'.repeat(3 - best.stars) : (unlocked ? '未通关' : '🔒 锁定');
    bottomRow.appendChild(starDisplay);

    const badges = document.createElement('div');
    badges.style.cssText = 'display:flex;gap:6px;align-items:center;';

    if ((best.attempts || 0) > 0) {
      const attemptsBadge = document.createElement('span');
      attemptsBadge.style.cssText = 'font-size:10px;color:rgba(255,255,255,0.35);background:rgba(255,255,255,0.06);padding:2px 6px;border-radius:4px;';
      attemptsBadge.textContent = `尝试 ${best.attempts}`;
      badges.appendChild(attemptsBadge);
    }
    if ((best.completions || 0) > 0) {
      const compBadge = document.createElement('span');
      compBadge.style.cssText = 'font-size:10px;color:#00e676;background:rgba(0,230,118,0.08);padding:2px 6px;border-radius:4px;';
      compBadge.textContent = `完成 ${best.completions}`;
      badges.appendChild(compBadge);
    }

    const modeTag = document.createElement('span');
    modeTag.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.4);background:rgba(255,255,255,0.08);padding:2px 8px;border-radius:4px;';
    modeTag.textContent = ch.gameMode === 'freeplay' ? '练习' : '对战';
    badges.appendChild(modeTag);

    bottomRow.appendChild(badges);
    card.appendChild(bottomRow);

    return card;
  }
}
