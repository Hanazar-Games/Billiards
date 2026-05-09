/**
 * ChallengePanel — UI for browsing and selecting challenges.
 *
 * Features:
 *   - Glassmorphism grid of challenge cards
 *   - Star ratings (0-3) showing best performance
 *   - Difficulty indicator
 *   - Description and constraints
 */
import { CHALLENGES } from './ChallengeData.js';
import { ChallengeManager } from './ChallengeManager.js';

export class ChallengePanel {
  constructor(onSelectChallenge, onBack) {
    this.onSelectChallenge = onSelectChallenge;
    this.onBack = onBack;
    this.container = null;
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
    title.innerHTML = '🏅 <span style="font-size:28px;font-weight:800;color:#fff;">挑战模式</span>';
    header.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.title = '返回菜单';
    closeBtn.style.cssText = `
      width: 40px; height: 40px;
      font-size: 20px; color: #fff;
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 50%;
      cursor: pointer; transition: all 0.2s;
      pointer-events: auto;
    `;
    closeBtn.onmouseenter = () => {
      closeBtn.style.background = 'rgba(255,255,255,0.2)';
    };
    closeBtn.onmouseleave = () => {
      closeBtn.style.background = 'rgba(255,255,255,0.1)';
    };
    closeBtn.onclick = () => this.onBack?.();
    header.appendChild(closeBtn);

    this.container.appendChild(header);

    // Grid
    const grid = document.createElement('div');
    grid.id = 'challenge-grid';
    grid.style.cssText = `
      display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px; max-width: 900px; width: 100%;
    `;
    this.container.appendChild(grid);

    document.body.appendChild(this.container);
  }

  show() {
    this.container.style.display = 'flex';
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

  _renderList() {
    const grid = document.getElementById('challenge-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const bestData = ChallengeManager.getAllBest();

    CHALLENGES.forEach((ch) => {
      const best = bestData[ch.id] || { stars: 0 };
      const card = this._createCard(ch, best.stars);
      grid.appendChild(card);
    });
  }

  _createCard(ch, bestStars) {
    const card = document.createElement('div');
    card.style.cssText = `
      padding: 18px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 14px;
      transition: all 0.2s;
      pointer-events: auto;
      cursor: pointer;
    `;
    card.onmouseenter = () => {
      card.style.background = 'rgba(255,255,255,0.12)';
      card.style.borderColor = 'rgba(255,255,255,0.3)';
      card.style.transform = 'scale(1.02)';
    };
    card.onmouseleave = () => {
      card.style.background = 'rgba(255,255,255,0.06)';
      card.style.borderColor = 'rgba(255,255,255,0.12)';
      card.style.transform = 'scale(1)';
    };
    card.onclick = () => {
      if (this.onSelectChallenge) this.onSelectChallenge(ch);
    };

    // Top row: name + difficulty stars
    const topRow = document.createElement('div');
    topRow.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 8px;
    `;

    const name = document.createElement('div');
    name.style.cssText = 'font-size: 16px; font-weight: 700; color: #fff;';
    name.textContent = ch.name;
    topRow.appendChild(name);

    const diff = document.createElement('div');
    diff.style.cssText = 'font-size: 13px; color: #ffd700; letter-spacing: 1px;';
    diff.textContent = '★'.repeat(ch.difficulty) + '☆'.repeat(5 - ch.difficulty);
    topRow.appendChild(diff);

    card.appendChild(topRow);

    // Description
    const desc = document.createElement('div');
    desc.style.cssText = 'font-size: 13px; color: rgba(255,255,255,0.6); margin-bottom: 12px; line-height: 1.5;';
    desc.textContent = ch.desc;
    card.appendChild(desc);

    // Bottom row: best stars + mode tag
    const bottomRow = document.createElement('div');
    bottomRow.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
    `;

    const starDisplay = document.createElement('div');
    starDisplay.style.cssText = 'font-size: 14px; color: #ffd700;';
    starDisplay.textContent = bestStars > 0 ? '★'.repeat(bestStars) + '☆'.repeat(3 - bestStars) : '未通关';
    bottomRow.appendChild(starDisplay);

    const modeTag = document.createElement('span');
    modeTag.style.cssText = `
      font-size: 11px; color: rgba(255,255,255,0.4);
      background: rgba(255,255,255,0.08);
      padding: 2px 8px; border-radius: 4px;
    `;
    modeTag.textContent = ch.gameMode === 'freeplay' ? '练习' : '对战';
    bottomRow.appendChild(modeTag);

    card.appendChild(bottomRow);

    return card;
  }
}
