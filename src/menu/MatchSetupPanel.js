import { animMs } from '../core/AnimSpeed.js';

/**
 * MatchSetupPanel — Pre-game configuration for local match mode.
 *
 * Lets two local players enter names, pick 8-ball or 9-ball,
 * and choose the match format (1 / 3 / 5 games).
 */
export class MatchSetupPanel {
  constructor(onStart, onCancel) {
    this.onStart = onStart;
    this.onCancel = onCancel;
    this.container = null;
    this._fadeTimer = null;
    this._buildUI();
  }

  _buildUI() {
    const layer = document.getElementById('menu-layer');
    if (!layer) return;

    this.container = document.createElement('div');
    this.container.id = 'match-setup-panel';
    this.container.style.cssText = `
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      width: 100%; height: 100%;
      position: absolute; inset: 0;
      z-index: 2;
      transition: opacity calc(0.35s / var(--ui-anim-speed)) ease;
    `;

    const card = document.createElement('div');
    card.style.cssText = `
      background: var(--panel-strong, rgba(20,24,28,0.92));
      border: 1px solid var(--line, rgba(255,255,255,0.12));
      border-radius: 16px;
      padding: 32px 36px;
      min-width: 380px;
      max-width: 460px;
      display: flex; flex-direction: column;
      gap: 18px; align-items: stretch;
      box-shadow: 0 24px 80px rgba(0,0,0,0.5);
      backdrop-filter: blur(12px);
    `;

    // Title
    const title = document.createElement('div');
    title.textContent = '🏆 本地比赛';
    title.style.cssText = `
      font-size: 20px; font-weight: 800; color: #fff;
      text-align: center; letter-spacing: 2px; margin-bottom: 4px;
    `;
    card.appendChild(title);

    // Player names
    const nameRow = document.createElement('div');
    nameRow.style.cssText = 'display:flex;gap:12px;';

    const p1Wrap = this._createNameInput('玩家 1', 'player1-name');
    const p2Wrap = this._createNameInput('玩家 2', 'player2-name');
    nameRow.appendChild(p1Wrap);
    nameRow.appendChild(p2Wrap);
    card.appendChild(nameRow);

    this._p1Input = p1Wrap.querySelector('input');
    this._p2Input = p2Wrap.querySelector('input');

    // Game mode
    card.appendChild(this._createSectionTitle('比赛项目'));
    this._modeSelect = this._createPillSelect([
      { value: '8ball', label: '8 球' },
      { value: '9ball', label: '9 球' },
    ], '8ball');
    card.appendChild(this._modeSelect);

    // Match format
    card.appendChild(this._createSectionTitle('赛制'));
    this._formatSelect = this._createPillSelect([
      { value: 1, label: '单局决胜' },
      { value: 3, label: '三局两胜' },
      { value: 5, label: '五局三胜' },
    ], 1);
    card.appendChild(this._formatSelect);

    // Buttons
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:10px;justify-content:center;margin-top:6px;';

    const startBtn = this._makeBtn('开始比赛', () => this._onStart(), true);
    const cancelBtn = this._makeBtn('返回', () => this.hide(), false);
    btnRow.appendChild(startBtn);
    btnRow.appendChild(cancelBtn);
    card.appendChild(btnRow);

    this.container.appendChild(card);
    layer.appendChild(this.container);

    requestAnimationFrame(() => {
      if (this.container) this.container.style.opacity = '1';
    });
  }

  _createNameInput(placeholder, id) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:4px;';
    const label = document.createElement('div');
    label.textContent = placeholder;
    label.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:1px;';
    wrap.appendChild(label);
    const input = document.createElement('input');
    input.type = 'text';
    input.id = id;
    input.maxLength = 12;
    input.placeholder = placeholder;
    input.style.cssText = `
      padding: 10px 12px; font-size: 14px;
      background: rgba(255,255,255,0.06); color: #fff;
      border: 1px solid rgba(255,255,255,0.15); border-radius: 8px;
      outline: none; width: 100%; box-sizing: border-box;
    `;
    wrap.appendChild(input);
    return wrap;
  }

  _createSectionTitle(text) {
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = 'font-size:12px;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:1px;margin-top:4px;';
    return el;
  }

  _createPillSelect(options, defaultValue) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;';
    this._selectedValues = this._selectedValues || {};
    const groupName = 'pill-' + Math.random().toString(36).slice(2);

    options.forEach((o) => {
      const btn = document.createElement('button');
      const active = o.value === defaultValue;
      btn.dataset.value = o.value;
      btn.textContent = o.label;
      btn.style.cssText = `
        flex:1; padding: 10px 0; border-radius: 10px;
        background: ${active ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.05)'};
        border: 1px solid ${active ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)'};
        color: ${active ? '#fff' : 'rgba(255,255,255,0.55)'};
        font-size: 13px; font-weight: 700; cursor: pointer;
        transition: all 0.2s ease;
      `;
      btn.onclick = () => {
        wrap.querySelectorAll('button').forEach((b) => {
          b.style.background = 'rgba(255,255,255,0.05)';
          b.style.borderColor = 'rgba(255,255,255,0.1)';
          b.style.color = 'rgba(255,255,255,0.55)';
        });
        btn.style.background = 'rgba(255,255,255,0.14)';
        btn.style.borderColor = 'rgba(255,255,255,0.25)';
        btn.style.color = '#fff';
        wrap.dataset.selected = o.value;
      };
      wrap.appendChild(btn);
    });
    wrap.dataset.selected = defaultValue;
    return wrap;
  }

  _makeBtn(text, onClick, primary = false) {
    const btn = document.createElement('button');
    btn.className = 'ui-action';
    btn.textContent = text;
    btn.style.cssText = `
      padding: 10px 24px; font-size: 14px; font-weight: 700;
      color: #fff; background: ${primary ? 'rgba(16,100,66,0.45)' : 'rgba(255,255,255,0.1)'};
      border: 1px solid ${primary ? 'rgba(16,100,66,0.6)' : 'rgba(255,255,255,0.2)'};
      border-radius: 8px; cursor: pointer; transition: all 0.2s ease;
    `;
    btn.onmouseenter = () => {
      btn.style.background = primary ? 'rgba(16,100,66,0.6)' : 'rgba(255,255,255,0.2)';
    };
    btn.onmouseleave = () => {
      btn.style.background = primary ? 'rgba(16,100,66,0.45)' : 'rgba(255,255,255,0.1)';
    };
    btn.onclick = onClick;
    return btn;
  }

  _onStart() {
    const p1Name = (this._p1Input.value || '玩家 1').trim();
    const p2Name = (this._p2Input.value || '玩家 2').trim();
    const mode = this._modeSelect.dataset.selected || '8ball';
    const gamesNeeded = parseInt(this._formatSelect.dataset.selected || '1', 10);
    if (this.onStart) {
      this.onStart({ p1Name, p2Name, mode, gamesNeeded });
    }
  }

  hide() {
    if (!this.container) return;
    this.container.style.opacity = '0';
    if (this._fadeTimer) clearTimeout(this._fadeTimer);
    this._fadeTimer = setTimeout(() => {
      if (this.container && this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
      }
      this.container = null;
      if (this.onCancel) this.onCancel();
    }, animMs(400));
  }

  destroy() {
    if (this._fadeTimer) { clearTimeout(this._fadeTimer); this._fadeTimer = null; }
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
  }
}
