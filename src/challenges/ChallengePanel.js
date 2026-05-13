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
import { animMs } from '../core/AnimSpeed.js';


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
    title.innerHTML = '<span style="font-size:28px;font-weight:850;color:#f4f7f4;">挑战模式</span>';
    header.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.title = '返回菜单';
    closeBtn.className = 'ui-action';
    closeBtn.style.cssText = `
      width: 40px; height: 40px;
      font-size: 20px;
      border-radius: 50%;
      pointer-events: auto;
    `;
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
      background: rgba(12,15,18,0.7);
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: 8px;
      transition: transform 180ms cubic-bezier(0.2,0.8,0.2,1), background 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
      pointer-events: auto;
      cursor: pointer;
      box-shadow: 0 14px 38px rgba(0,0,0,0.25);
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
    name.style.cssText = 'font-size: 16px; font-weight: 780; color: #f4f7f4;';
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
