/**
 * TrainerPanel — UI for browsing and selecting shot trainer drills.
 *
 * Features:
 *   - Glassmorphism grid of drill cards grouped by category
 *   - Star ratings (0-3) showing best performance
 *   - Lock state for drills that aren't unlocked yet
 *   - Difficulty indicator and description
 */
import { DRILLS, DRILL_CATEGORIES } from './DrillData.js';
import { DrillManager } from './DrillManager.js';

export class TrainerPanel {
  constructor(onSelectDrill, onBack) {
    this.onSelectDrill = onSelectDrill;
    this.onBack = onBack;
    this.container = null;
    this._buildUI();
    this._setupKeyboard();
  }

  _buildUI() {
    this.container = document.createElement('div');
    this.container.id = 'trainer-panel';
    this.container.style.cssText = `
      position: fixed; inset: 0;
      display: none; flex-direction: column;
      align-items: center;
      background:
        linear-gradient(135deg, rgba(16,80,100,0.22), rgba(9,11,13,0.96) 42%),
        linear-gradient(25deg, rgba(26,80,122,0.16), rgba(9,11,13,0.96) 38%);
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
    title.innerHTML = '<span style="font-size:28px;font-weight:850;color:#f4f7f4;">击球训练</span>';
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

    // Content area
    this.contentEl = document.createElement('div');
    this.contentEl.style.cssText = `
      max-width: 900px; width: 100%;
      display: flex; flex-direction: column; gap: 28px;
    `;
    this.container.appendChild(this.contentEl);

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
    if (!this.contentEl) return;
    this.contentEl.innerHTML = '';

    const bestData = DrillManager.getAllBest();

    // Group drills by category
    const categories = ['BASIC', 'INTERMEDIATE', 'ADVANCED'];
    for (const catKey of categories) {
      const catDrills = DRILLS.filter((d) => d.category === catKey);
      if (catDrills.length === 0) continue;

      const catInfo = DRILL_CATEGORIES[catKey];
      const section = document.createElement('div');

      // Category header
      const catHeader = document.createElement('div');
      catHeader.style.cssText = `
        font-size: 14px; font-weight: 700; color: ${catInfo.color};
        text-transform: uppercase; letter-spacing: 2px;
        margin-bottom: 12px; padding-left: 4px;
      `;
      catHeader.textContent = catInfo.label;
      section.appendChild(catHeader);

      // Grid
      const grid = document.createElement('div');
      grid.style.cssText = `
        display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 16px;
      `;

      catDrills.forEach((drill) => {
        const best = bestData[drill.id] || { stars: 0 };
        const unlocked = DrillManager.isUnlocked(drill.id);
        const card = this._createCard(drill, best.stars, unlocked);
        grid.appendChild(card);
      });

      section.appendChild(grid);
      this.contentEl.appendChild(section);
    }
  }

  _createCard(drill, bestStars, unlocked) {
    const card = document.createElement('div');
    card.style.cssText = `
      padding: 18px;
      background: ${unlocked ? 'rgba(12,15,18,0.7)' : 'rgba(8,10,12,0.85)'};
      border: 1px solid ${unlocked ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.06)'};
      border-radius: 8px;
      transition: transform 180ms cubic-bezier(0.2,0.8,0.2,1), background 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
      pointer-events: ${unlocked ? 'auto' : 'none'};
      cursor: ${unlocked ? 'pointer' : 'default'};
      box-shadow: 0 14px 38px rgba(0,0,0,0.25);
      position: relative;
    `;

    if (unlocked) {
      card.onmouseenter = () => {
        card.style.background = 'rgba(20,26,30,0.86)';
        card.style.borderColor = 'rgba(95,177,216,0.45)';
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
        if (this.onSelectDrill) this.onSelectDrill(drill);
      };
    }

    // Top row: name + difficulty stars
    const topRow = document.createElement('div');
    topRow.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 8px;
    `;

    const name = document.createElement('div');
    name.style.cssText = `font-size: 16px; font-weight: 780; color: ${unlocked ? '#f4f7f4' : 'rgba(255,255,255,0.35)'};`;
    name.textContent = drill.name;
    topRow.appendChild(name);

    const diff = document.createElement('div');
    diff.style.cssText = 'font-size: 13px; color: #ffd700; letter-spacing: 1px;';
    diff.textContent = '★'.repeat(drill.difficulty) + '☆'.repeat(5 - drill.difficulty);
    topRow.appendChild(diff);

    card.appendChild(topRow);

    // Description
    const desc = document.createElement('div');
    desc.style.cssText = 'font-size: 13px; color: rgba(255,255,255,0.6); margin-bottom: 12px; line-height: 1.5;';
    desc.textContent = unlocked ? drill.desc : '完成前置练习以解锁';
    card.appendChild(desc);

    // Bottom row: best stars + lock icon
    const bottomRow = document.createElement('div');
    bottomRow.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
    `;

    if (unlocked) {
      const starDisplay = document.createElement('div');
      starDisplay.style.cssText = 'font-size: 14px; color: #ffd700;';
      starDisplay.textContent = bestStars > 0 ? '★'.repeat(bestStars) + '☆'.repeat(3 - bestStars) : '未练习';
      bottomRow.appendChild(starDisplay);
    } else {
      const lockDisplay = document.createElement('div');
      lockDisplay.style.cssText = 'font-size: 14px; color: rgba(255,255,255,0.25);';
      lockDisplay.textContent = '🔒 锁定';
      bottomRow.appendChild(lockDisplay);
    }

    const typeTag = document.createElement('span');
    typeTag.style.cssText = `
      font-size: 11px; color: rgba(255,255,255,0.4);
      background: rgba(255,255,255,0.08);
      padding: 2px 8px; border-radius: 4px;
    `;
    typeTag.textContent = this._typeLabel(drill.type);
    bottomRow.appendChild(typeTag);

    card.appendChild(bottomRow);

    return card;
  }

  _typeLabel(type) {
    const map = {
      straight: '直球',
      cut: '角度',
      long: '长台',
      thin: '薄球',
      rail: '贴库',
      combo: '组合',
      position: '走位',
      bank: '库边',
    };
    return map[type] || type;
  }
}
