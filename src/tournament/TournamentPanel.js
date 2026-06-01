/**
 * TournamentPanel — The main tournament UI.
 *
 * Three screens:
 *   1. Setup   — enter name, pick colour, choose mode
 *   2. Bracket — view bracket, see opponent info, start next match
 *   3. History — browse past tournaments
 */

import { animMs } from '../core/AnimSpeed.js';
import { TournamentEngine } from './TournamentEngine.js';
import { TournamentStore } from './TournamentStore.js';
import { TournamentBracket } from './TournamentBracket.js';
import { PLAYER_COLORS } from './TournamentData.js';
import { getEnabledProfilesForMode } from '../game/TableProfiles.js';

export class TournamentPanel {
  constructor(onStartMatch, onBack) {
    this.onStartMatch = onStartMatch;
    this.onBack = onBack;
    this.container = null;
    this.engine = new TournamentEngine();
    this.store = new TournamentStore();
    this.bracket = null;
    this._fadeTimer = null;
    this._buildUI();
  }

  _buildUI() {
    const layer = document.getElementById('menu-layer');
    if (!layer) return;

    this.container = document.createElement('div');
    this.container.id = 'tournament-panel';
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
      width: 100%; max-width: 720px; margin-bottom: 24px;
    `;

    const title = document.createElement('div');
    title.innerHTML = '🏆 冠军锦标赛';
    title.style.cssText = `
      font-size: 22px; font-weight: 800; color: #fff;
      letter-spacing: 2px;
    `;
    this.header.appendChild(title);

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.textContent = '← 返回';
    backBtn.className = 'ui-action';
    backBtn.style.cssText = `
      padding: 8px 18px; font-size: 13px; font-weight: 700;
      pointer-events: auto;
    `;
    backBtn.onclick = () => this._goBack();
    this.header.appendChild(backBtn);

    this.container.appendChild(this.header);

    // Content area (switches between setup / bracket / history)
    this.content = document.createElement('div');
    this.content.style.cssText = `
      width: 100%; max-width: 720px;
      display: flex; flex-direction: column; align-items: center; gap: 16px;
    `;
    this.container.appendChild(this.content);

    layer.appendChild(this.container);
  }

  // ── Public API ──

  show() {
    if (!this.container) return;
    this.container.style.display = 'flex';
    this.container.style.opacity = '0';
    requestAnimationFrame(() => {
      if (this.container) this.container.style.opacity = '1';
    });
    // Default to setup if no active tournament
    if (this.engine.state && this.engine.state.status === 'active') {
      this._showBracket();
    } else {
      this._showSetup();
    }
  }

  hide() {
    if (!this.container) return;
    this.container.style.opacity = '0';
    if (this._fadeTimer) clearTimeout(this._fadeTimer);
    this._fadeTimer = setTimeout(() => {
      if (this.container) this.container.style.display = 'none';
    }, animMs(350));
  }

  destroy() {
    if (this._fadeTimer) { clearTimeout(this._fadeTimer); this._fadeTimer = null; }
    if (this.bracket) { this.bracket.destroy(); this.bracket = null; }
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
  }

  /** Called by MenuSystem after a tournament game ends. */
  onGameEnd(playerWon) {
    const result = this.engine.recordGameResult(playerWon);
    if (result.tournamentOver) {
      this.store.record(this.engine.export());
    }
    return result;
  }

  getEngine() {
    return this.engine;
  }

  // ── Screen: Setup ──

  _showSetup() {
    this.content.innerHTML = '';
    if (this.bracket) { this.bracket.destroy(); this.bracket = null; }

    const card = this._createCard();

    const subtitle = document.createElement('div');
    subtitle.textContent = '创建你的选手，挑战8人单淘汰锦标赛';
    subtitle.style.cssText = `
      font-size: 13px; color: rgba(255,255,255,0.55);
      text-align: center; margin-bottom: 8px;
    `;
    card.appendChild(subtitle);

    // Name input
    const nameRow = document.createElement('div');
    nameRow.style.cssText = 'width:100%;';
    const nameLabel = document.createElement('div');
    nameLabel.textContent = '选手名称';
    nameLabel.style.cssText = 'font-size:12px;font-weight:700;color:rgba(255,255,255,0.6);margin-bottom:6px;';
    nameRow.appendChild(nameLabel);

    this._nameInput = document.createElement('input');
    this._nameInput.type = 'text';
    this._nameInput.value = '玩家';
    this._nameInput.maxLength = 12;
    this._nameInput.style.cssText = `
      width: 100%; padding: 10px 14px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 8px; color: #fff; font-size: 14px;
      outline: none; pointer-events: auto;
    `;
    this._nameInput.onfocus = () => {
      this._nameInput.style.borderColor = 'rgba(216,177,95,0.6)';
    };
    this._nameInput.onblur = () => {
      this._nameInput.style.borderColor = 'rgba(255,255,255,0.15)';
    };
    nameRow.appendChild(this._nameInput);
    card.appendChild(nameRow);

    // Colour picker
    const colorRow = document.createElement('div');
    colorRow.style.cssText = 'width:100%;';
    const colorLabel = document.createElement('div');
    colorLabel.textContent = '代表色';
    colorLabel.style.cssText = 'font-size:12px;font-weight:700;color:rgba(255,255,255,0.6);margin-bottom:6px;';
    colorRow.appendChild(colorLabel);

    const colorGrid = document.createElement('div');
    colorGrid.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;';
    this._selectedColorIndex = 0;
    PLAYER_COLORS.forEach((c, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.style.cssText = `
        width: 32px; height: 32px; border-radius: 50%;
        background: ${c}; border: 2px solid transparent;
        cursor: pointer; pointer-events: auto;
        transition: transform 0.15s ease;
      `;
      dot.onclick = () => {
        this._selectedColorIndex = i;
        Array.from(colorGrid.children).forEach((d, idx) => {
          d.style.borderColor = idx === i ? '#fff' : 'transparent';
          d.style.transform = idx === i ? 'scale(1.15)' : 'scale(1)';
        });
      };
      if (i === 0) {
        dot.style.borderColor = '#fff';
        dot.style.transform = 'scale(1.15)';
      }
      colorGrid.appendChild(dot);
    });
    colorRow.appendChild(colorGrid);
    card.appendChild(colorRow);

    // Mode select
    const modeRow = document.createElement('div');
    modeRow.style.cssText = 'width:100%;';
    const modeLabel = document.createElement('div');
    modeLabel.textContent = '比赛项目';
    modeLabel.style.cssText = 'font-size:12px;font-weight:700;color:rgba(255,255,255,0.6);margin-bottom:6px;';
    modeRow.appendChild(modeLabel);

    this._modeValue = '8ball';
    const modePills = this._createPills([
      { value: '8ball', label: '8 球' },
      { value: '9ball', label: '9 球' },
    ], '8ball', (v) => { this._modeValue = v; });
    modeRow.appendChild(modePills);
    card.appendChild(modeRow);

    // Start button
    const startBtn = document.createElement('button');
    startBtn.type = 'button';
    startBtn.textContent = '开始锦标赛';
    startBtn.style.cssText = `
      width: 100%; padding: 14px 0; margin-top: 8px;
      background: linear-gradient(90deg, rgba(216,177,95,0.25), rgba(180,140,60,0.2));
      border: 1px solid rgba(216,177,95,0.55);
      border-radius: 10px; color: #f0d78c;
      font-size: 15px; font-weight: 800; cursor: pointer;
      pointer-events: auto; letter-spacing: 2px;
      transition: all calc(0.2s / var(--ui-anim-speed)) ease;
    `;
    startBtn.onmouseenter = () => {
      startBtn.style.background = 'linear-gradient(90deg, rgba(216,177,95,0.4), rgba(180,140,60,0.35))';
      startBtn.style.transform = 'translateY(-1px)';
    };
    startBtn.onmouseleave = () => {
      startBtn.style.background = 'linear-gradient(90deg, rgba(216,177,95,0.25), rgba(180,140,60,0.2))';
      startBtn.style.transform = 'translateY(0)';
    };
    startBtn.onclick = () => this._startTournament();
    card.appendChild(startBtn);

    // History button
    const histBtn = document.createElement('button');
    histBtn.type = 'button';
    histBtn.textContent = '📜 历史记录';
    histBtn.style.cssText = `
      width: 100%; padding: 12px 0;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 10px; color: rgba(255,255,255,0.7);
      font-size: 14px; font-weight: 700; cursor: pointer;
      pointer-events: auto;
      transition: all calc(0.2s / var(--ui-anim-speed)) ease;
    `;
    histBtn.onmouseenter = () => {
      histBtn.style.background = 'rgba(255,255,255,0.1)';
      histBtn.style.borderColor = 'rgba(255,255,255,0.25)';
    };
    histBtn.onmouseleave = () => {
      histBtn.style.background = 'rgba(255,255,255,0.05)';
      histBtn.style.borderColor = 'rgba(255,255,255,0.12)';
    };
    histBtn.onclick = () => this._showHistory();
    card.appendChild(histBtn);

    this.content.appendChild(card);
  }

  // ── Screen: Bracket ──

  _showBracket() {
    this.content.innerHTML = '';
    if (!this.engine.state) return;

    const { rounds, currentRound, currentMatchIndex, champion, status } = this.engine.state;
    const match = this.engine.getCurrentMatch();

    // Status card
    const statusCard = this._createCard();
    statusCard.style.maxWidth = '520px';

    if (status === 'finished') {
      statusCard.innerHTML = `
        <div style="text-align:center;">
          <div style="font-size:40px;margin-bottom:8px;">🏆</div>
          <div style="font-size:18px;font-weight:800;color:#fff;">锦标赛已结束</div>
          <div style="font-size:13px;color:rgba(255,255,255,0.6);margin-top:4px;">
            冠军：${champion ? _esc(champion.name) : '???'}
          </div>
        </div>
      `;
    } else if (match) {
      const opponent = match.player1?.isPlayer ? match.player2 : match.player1;
      const roundName = TournamentEngine.getRoundName(match.round);
      const gamesNeeded = match.gamesNeeded;
      const formatLabel = gamesNeeded === 1 ? '单局决胜' : gamesNeeded === 3 ? '三局两胜' : '五局三胜';

      statusCard.innerHTML = `
        <div style="text-align:center;">
          <div style="font-size:12px;font-weight:700;color:rgba(216,177,95,0.8);letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">
            ${roundName} · ${formatLabel}
          </div>
          <div style="font-size:16px;font-weight:800;color:#fff;margin-bottom:4px;">
            下一场对手：${opponent ? _esc(opponent.name) : '???'}
          </div>
          <div style="font-size:12px;color:rgba(255,255,255,0.5);">
            ${opponent ? `${_esc(opponent.title || '')} · ${_esc(opponent.style || '')}` : ''}
          </div>
        </div>
      `;

      const playBtn = document.createElement('button');
      playBtn.type = 'button';
      playBtn.textContent = '开始比赛';
      playBtn.style.cssText = `
        width: 100%; padding: 12px 0; margin-top: 14px;
        background: linear-gradient(90deg, rgba(216,177,95,0.25), rgba(180,140,60,0.2));
        border: 1px solid rgba(216,177,95,0.55);
        border-radius: 10px; color: #f0d78c;
        font-size: 15px; font-weight: 800; cursor: pointer;
        pointer-events: auto; letter-spacing: 2px;
        transition: all calc(0.2s / var(--ui-anim-speed)) ease;
      `;
      playBtn.onmouseenter = () => {
        playBtn.style.background = 'linear-gradient(90deg, rgba(216,177,95,0.4), rgba(180,140,60,0.35))';
        playBtn.style.transform = 'translateY(-1px)';
      };
      playBtn.onmouseleave = () => {
        playBtn.style.background = 'linear-gradient(90deg, rgba(216,177,95,0.25), rgba(180,140,60,0.2))';
        playBtn.style.transform = 'translateY(0)';
      };
      playBtn.onclick = () => {
        if (this.onStartMatch) this.onStartMatch();
      };
      statusCard.appendChild(playBtn);
    } else {
      statusCard.innerHTML = `
        <div style="text-align:center;color:rgba(255,255,255,0.6);">
          等待下一场比赛…
        </div>
      `;
    }

    this.content.appendChild(statusCard);

    // Bracket visualization
    const bracketWrap = document.createElement('div');
    bracketWrap.style.cssText = `
      width: 100%; overflow-x: auto;
      display: flex; justify-content: center;
    `;
    this.content.appendChild(bracketWrap);

    this.bracket = new TournamentBracket(bracketWrap);
    this.bracket.render(rounds, currentRound, currentMatchIndex, champion);
  }

  // ── Screen: History ──

  _showHistory() {
    this.content.innerHTML = '';
    if (this.bracket) { this.bracket.destroy(); this.bracket = null; }

    const card = this._createCard();
    card.style.maxWidth = '520px';

    const title = document.createElement('div');
    title.textContent = '📜 锦标赛历史';
    title.style.cssText = `
      font-size: 16px; font-weight: 800; color: #fff;
      text-align: center; margin-bottom: 16px;
    `;
    card.appendChild(title);

    const history = this.store.getAll();
    if (history.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = '暂无锦标赛记录';
      empty.style.cssText = 'text-align:center;color:rgba(255,255,255,0.4);font-size:13px;padding:20px 0;';
      card.appendChild(empty);
    } else {
      history.forEach((h) => {
        const row = document.createElement('div');
        row.style.cssText = `
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 12px; border-radius: 8px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          margin-bottom: 8px;
        `;

        const isChampion = h.champion?.name === h.playerName;
        const trophyIcon = h.trophy ? h.trophy.icon : '';
        const trophyColor = h.trophy ? h.trophy.color : 'rgba(255,255,255,0.3)';

        row.innerHTML = `
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="font-size:20px;">${trophyIcon}</div>
            <div>
              <div style="font-size:13px;font-weight:700;color:#fff;">${_esc(h.playerName)}</div>
              <div style="font-size:11px;color:rgba(255,255,255,0.5);">
                ${new Date(h.createdAt).toLocaleDateString()} · ${h.mode === '9ball' ? '9 球' : '8 球'}
              </div>
            </div>
          </div>
          <div style="font-size:12px;font-weight:700;color:${trophyColor};">
            ${isChampion ? '冠军' : h.trophy ? h.trophy.name : '未获奖'}
          </div>
        `;
        card.appendChild(row);
      });

      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.textContent = '清空记录';
      clearBtn.style.cssText = `
        width: 100%; padding: 10px 0; margin-top: 8px;
        background: rgba(185,30,50,0.12);
        border: 1px solid rgba(185,30,50,0.35);
        border-radius: 8px; color: #ff8a9a;
        font-size: 13px; font-weight: 700; cursor: pointer;
        pointer-events: auto;
        transition: all calc(0.2s / var(--ui-anim-speed)) ease;
      `;
      clearBtn.onmouseenter = () => {
        clearBtn.style.background = 'rgba(185,30,50,0.22)';
      };
      clearBtn.onmouseleave = () => {
        clearBtn.style.background = 'rgba(185,30,50,0.12)';
      };
      clearBtn.onclick = () => {
        this.store.clear();
        this._showHistory();
      };
      card.appendChild(clearBtn);
    }

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.textContent = '← 返回';
    backBtn.className = 'ui-action';
    backBtn.style.cssText = `
      width: 100%; padding: 10px 0; margin-top: 8px;
      font-size: 13px; font-weight: 700; pointer-events: auto;
    `;
    backBtn.onclick = () => this._showSetup();
    card.appendChild(backBtn);

    this.content.appendChild(card);
  }

  // ── Helpers ──

  _createCard() {
    const card = document.createElement('div');
    card.style.cssText = `
      background: var(--panel-strong, rgba(20,24,28,0.92));
      border: 1px solid var(--line, rgba(255,255,255,0.12));
      border-radius: 16px;
      padding: 24px 28px;
      width: 100%; max-width: 460px;
      display: flex; flex-direction: column;
      gap: 16px; align-items: stretch;
      box-shadow: 0 24px 80px rgba(0,0,0,0.5);
      backdrop-filter: blur(12px);
      animation: panelIn calc(0.4s / var(--ui-anim-speed)) var(--ease) both;
    `;
    return card;
  }

  _createPills(options, defaultValue, onChange) {
    const wrap = document.createElement('div');
    wrap.style.cssText = `
      display: flex; gap: 8px; flex-wrap: wrap;
    `;
    options.forEach((opt) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.value = opt.value;
      btn.textContent = opt.label;
      const active = opt.value === defaultValue;
      btn.style.cssText = `
        flex: 1; min-width: 80px; padding: 8px 0;
        background: ${active ? 'rgba(216,177,95,0.18)' : 'rgba(255,255,255,0.05)'};
        border: 1px solid ${active ? 'rgba(216,177,95,0.55)' : 'rgba(255,255,255,0.12)'};
        border-radius: 8px; color: ${active ? '#f0d78c' : 'rgba(255,255,255,0.7)'};
        font-size: 13px; font-weight: 700; cursor: pointer;
        pointer-events: auto;
        transition: all calc(0.2s / var(--ui-anim-speed)) ease;
      `;
      btn.onclick = () => {
        Array.from(wrap.children).forEach((b) => {
          b.style.background = 'rgba(255,255,255,0.05)';
          b.style.borderColor = 'rgba(255,255,255,0.12)';
          b.style.color = 'rgba(255,255,255,0.7)';
        });
        btn.style.background = 'rgba(216,177,95,0.18)';
        btn.style.borderColor = 'rgba(216,177,95,0.55)';
        btn.style.color = '#f0d78c';
        if (onChange) onChange(opt.value);
      };
      wrap.appendChild(btn);
    });
    return wrap;
  }

  _startTournament() {
    const name = this._nameInput.value.trim() || '玩家';
    const colorIdx = this._selectedColorIndex || 0;
    const mode = this._modeValue || '8ball';

    // Pick a random table profile suitable for the mode
    const profiles = getEnabledProfilesForMode(mode);
    const tableProfileId = profiles.length > 0
      ? profiles[Math.floor(Math.random() * profiles.length)].id
      : null;

    this.engine.create(name, colorIdx, mode, tableProfileId);
    this._showBracket();
  }

  _goBack() {
    this.hide();
    if (this.onBack) this.onBack();
  }
}

function _esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
