export class UI {
  constructor() {
    this.player1Badge = document.getElementById('player1');
    this.player2Badge = document.getElementById('player2');
    this.message = document.getElementById('message');
    this.powerFill = document.getElementById('power-bar-fill');
    this._messageTimer = null;
    this._messageId = 0; // monotonic counter to prevent stale timers clearing new messages
    this._aiListeners = []; // { el, type, fn }

    this.player1Group = document.createElement('div');
    this.player1Group.id = 'player1-group';
    this.player1Group.style.cssText = 'font-size:12px;opacity:0.8;margin-top:4px;';
    if (this.player1Badge) this.player1Badge.appendChild(this.player1Group);

    this.player2Group = document.createElement('div');
    this.player2Group.id = 'player2-group';
    this.player2Group.style.cssText = 'font-size:12px;opacity:0.8;margin-top:4px;';
    if (this.player2Badge) this.player2Badge.appendChild(this.player2Group);

    // Reset button
    this.resetBtn = document.createElement('button');
    this.resetBtn.textContent = 'New Game';
    this.resetBtn.style.cssText = `
      position: absolute; top: 70px; left: 50%; transform: translateX(-50%);
      padding: 9px 18px; font-size: 13px; font-weight: 750;
      background: rgba(18,20,23,0.62); color: #fff; border: 1px solid rgba(255,255,255,0.22);
      border-radius: 8px; cursor: pointer; pointer-events: auto; backdrop-filter: blur(10px);
      display: none; transition: background 0.2s;
      box-shadow: 0 10px 30px rgba(0,0,0,0.28);
    `;
    this.resetBtn.onmouseenter = () => this.resetBtn.style.background = 'rgba(255,255,255,0.18)';
    this.resetBtn.onmouseleave = () => this.resetBtn.style.background = 'rgba(18,20,23,0.62)';
    const uiLayer = document.getElementById('ui-layer');
    if (uiLayer) uiLayer.appendChild(this.resetBtn);

    // AI controls container
    this.aiPanel = document.createElement('div');
    this.aiPanel.style.cssText = `
      position: absolute; top: 122px; left: 50%; transform: translateX(-50%);
      display: flex; gap: 12px; align-items: center; flex-wrap: wrap;
      pointer-events: auto; background: rgba(10,12,15,0.58);
      padding: 9px 14px; border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.16);
      backdrop-filter: blur(12px);
      box-shadow: 0 12px 32px rgba(0,0,0,0.26);
    `;

    // AI toggle
    this.aiToggle = document.createElement('label');
    this.aiToggle.style.cssText = 'display:flex;align-items:center;gap:6px;color:#fff;font-size:13px;font-weight:600;cursor:pointer;';
    this.aiToggle.innerHTML = `
      <input type="checkbox" id="ai-toggle" style="cursor:pointer;">
      <span>vs AI</span>
    `;
    this.aiPanel.appendChild(this.aiToggle);

    // Difficulty select
    this.diffSelect = document.createElement('select');
    this.diffSelect.id = 'ai-difficulty';
    this.diffSelect.style.cssText = `
      background: rgba(255,255,255,0.1); color: #fff; border: 1px solid rgba(255,255,255,0.2);
      border-radius: 6px; padding: 4px 9px; font-size: 12px; cursor: pointer;
    `;
    this.diffSelect.innerHTML = `
      <option value="easy" style="background:#333;">Easy</option>
      <option value="normal" style="background:#333;" selected>Normal</option>
      <option value="hard" style="background:#333;">Hard</option>
    `;
    this.aiPanel.appendChild(this.diffSelect);

    // Trajectory toggle
    this.trajToggle = document.createElement('label');
    this.trajToggle.style.cssText = 'display:flex;align-items:center;gap:6px;color:#fff;font-size:13px;font-weight:600;cursor:pointer;margin-left:4px;';
    this.trajToggle.innerHTML = `
      <input type="checkbox" id="traj-toggle" checked style="cursor:pointer;">
      <span>Aim Line</span>
    `;
    this.aiPanel.appendChild(this.trajToggle);

    // Shot trail toggle
    this.trailToggle = document.createElement('label');
    this.trailToggle.style.cssText = 'display:flex;align-items:center;gap:6px;color:#fff;font-size:13px;font-weight:600;cursor:pointer;margin-left:4px;';
    this.trailToggle.innerHTML = `
      <input type="checkbox" id="trail-toggle" checked style="cursor:pointer;">
      <span>Trail</span>
    `;
    this.aiPanel.appendChild(this.trailToggle);

    // Sound toggle
    this.soundToggle = document.createElement('label');
    this.soundToggle.style.cssText = 'display:flex;align-items:center;gap:6px;color:#fff;font-size:13px;font-weight:600;cursor:pointer;margin-left:4px;border-left:1px solid rgba(255,255,255,0.18);padding-left:12px;';
    this.soundToggle.innerHTML = `
      <input type="checkbox" id="sound-toggle" style="cursor:pointer;">
      <span>Sound</span>
    `;
    this.aiPanel.appendChild(this.soundToggle);

    if (uiLayer) uiLayer.appendChild(this.aiPanel);
  }

  _addTrackedListener(el, type, fn) {
    el.addEventListener(type, fn);
    this._aiListeners.push({ el, type, fn });
  }

  setupAIControls(onAIToggle, onDiffChange, onSoundToggle) {
    const checkbox = this.aiToggle.querySelector('input');
    const onAIChange = (e) => {
      const enabled = e.target.checked;
      onAIToggle(enabled);
      this.diffSelect.disabled = !enabled;
      this.diffSelect.style.opacity = enabled ? '1' : '0.4';
      if (this.player2Badge) {
        this.player2Badge.childNodes[0].textContent = enabled ? 'AI' : 'Player 2';
      }
    };
    this._addTrackedListener(checkbox, 'change', onAIChange);

    const onDiff = (e) => onDiffChange(e.target.value);
    this._addTrackedListener(this.diffSelect, 'change', onDiff);

    const trajCheckbox = this.trajToggle.querySelector('input');
    const onTraj = (e) => window.dispatchEvent(new CustomEvent('toggleTrajectory', { detail: e.target.checked }));
    this._addTrackedListener(trajCheckbox, 'change', onTraj);

    const trailCheckbox = this.trailToggle.querySelector('input');
    const onTrail = (e) => window.dispatchEvent(new CustomEvent('toggleShotTrail', { detail: e.target.checked }));
    this._addTrackedListener(trailCheckbox, 'change', onTrail);

    const soundCheckbox = this.soundToggle.querySelector('input');
    const onSound = (e) => { if (onSoundToggle) onSoundToggle(e.target.checked); };
    this._addTrackedListener(soundCheckbox, 'change', onSound);
  }

  setPower(pct) {
    if (this.powerFill) {
      this.powerFill.style.width = Math.max(0, Math.min(100, pct)) + '%';
    }
  }

  setMessage(text, duration = 0) {
    if (this.message) {
      this.message.textContent = text;
      this._messageId++;
      const id = this._messageId;
      if (this._messageTimer) {
        clearTimeout(this._messageTimer);
        this._messageTimer = null;
      }
      if (duration > 0) {
        this._messageTimer = setTimeout(() => {
          this._messageTimer = null;
          if (this.message && this._messageId === id) {
            this.message.textContent = '';
          }
        }, duration);
      }
    }
  }

  setPlayerTurn(player) {
    if (!this.player1Badge || !this.player2Badge) return;
    if (player === 1) {
      this.player1Badge.classList.add('active');
      this.player2Badge.classList.remove('active');
    } else {
      this.player1Badge.classList.remove('active');
      this.player2Badge.classList.add('active');
    }
  }

  setPlayerGroups(p1Group, p2Group) {
    if (p1Group) {
      this.player1Group.textContent = p1Group === 'solid' ? '● Solids' : '◯ Stripes';
    } else {
      this.player1Group.textContent = '';
    }
    if (p2Group) {
      this.player2Group.textContent = p2Group === 'solid' ? '● Solids' : '◯ Stripes';
    } else {
      this.player2Group.textContent = '';
    }
  }

  showResetButton(onClick) {
    this.resetBtn.style.display = 'block';
    this.resetBtn.onclick = onClick;
  }

  hideResetButton() {
    this.resetBtn.style.display = 'none';
    this.resetBtn.onclick = null;
  }

  destroy() {
    if (this._messageTimer) {
      clearTimeout(this._messageTimer);
      this._messageTimer = null;
    }
    // Remove all tracked event listeners
    for (const { el, type, fn } of this._aiListeners) {
      el.removeEventListener(type, fn);
    }
    this._aiListeners = [];

    if (this.player1Group && this.player1Group.parentNode) {
      this.player1Group.parentNode.removeChild(this.player1Group);
    }
    if (this.player2Group && this.player2Group.parentNode) {
      this.player2Group.parentNode.removeChild(this.player2Group);
    }
    if (this.resetBtn) {
      this.resetBtn.onmouseenter = null;
      this.resetBtn.onmouseleave = null;
      this.resetBtn.onclick = null;
      if (this.resetBtn.parentNode) this.resetBtn.parentNode.removeChild(this.resetBtn);
    }
    if (this.aiPanel && this.aiPanel.parentNode) {
      this.aiPanel.parentNode.removeChild(this.aiPanel);
    }
    this.player1Badge = null;
    this.player2Badge = null;
    this.message = null;
    this.powerFill = null;
    this.player1Group = null;
    this.player2Group = null;
    this.resetBtn = null;
    this.aiPanel = null;
    this.aiToggle = null;
    this.diffSelect = null;
    this.trajToggle = null;
    this.trailToggle = null;
    this.soundToggle = null;
  }
}
