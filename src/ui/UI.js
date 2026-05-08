export class UI {
  constructor() {
    this.player1Badge = document.getElementById('player1');
    this.player2Badge = document.getElementById('player2');
    this.message = document.getElementById('message');
    this.powerFill = document.getElementById('power-bar-fill');

    this.player1Group = document.createElement('div');
    this.player1Group.id = 'player1-group';
    this.player1Group.style.cssText = 'font-size:12px;opacity:0.8;margin-top:4px;';
    this.player1Badge.appendChild(this.player1Group);

    this.player2Group = document.createElement('div');
    this.player2Group.id = 'player2-group';
    this.player2Group.style.cssText = 'font-size:12px;opacity:0.8;margin-top:4px;';
    this.player2Badge.appendChild(this.player2Group);

    // Reset button
    this.resetBtn = document.createElement('button');
    this.resetBtn.textContent = 'New Game';
    this.resetBtn.style.cssText = `
      position: absolute; top: 20px; left: 50%; transform: translateX(-50%);
      padding: 8px 20px; font-size: 14px; font-weight: bold;
      background: rgba(255,255,255,0.15); color: #fff; border: 1px solid rgba(255,255,255,0.3);
      border-radius: 6px; cursor: pointer; pointer-events: auto; backdrop-filter: blur(4px);
      display: none; transition: background 0.2s;
    `;
    this.resetBtn.onmouseenter = () => this.resetBtn.style.background = 'rgba(255,255,255,0.3)';
    this.resetBtn.onmouseleave = () => this.resetBtn.style.background = 'rgba(255,255,255,0.15)';
    document.getElementById('ui-layer').appendChild(this.resetBtn);

    // AI controls container
    this.aiPanel = document.createElement('div');
    this.aiPanel.style.cssText = `
      position: absolute; top: 135px; left: 50%; transform: translateX(-50%);
      display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
      pointer-events: auto; background: rgba(0,0,0,0.45);
      padding: 8px 16px; border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.15);
      backdrop-filter: blur(6px);
    `;

    // AI toggle
    this.aiToggle = document.createElement('label');
    this.aiToggle.style.cssText = 'display:flex;align-items:center;gap:6px;color:#fff;font-size:13px;cursor:pointer;';
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
      border-radius: 4px; padding: 3px 8px; font-size: 12px; cursor: pointer;
    `;
    this.diffSelect.innerHTML = `
      <option value="easy" style="background:#333;">Easy</option>
      <option value="normal" style="background:#333;" selected>Normal</option>
      <option value="hard" style="background:#333;">Hard</option>
    `;
    this.aiPanel.appendChild(this.diffSelect);

    // Trajectory toggle
    this.trajToggle = document.createElement('label');
    this.trajToggle.style.cssText = 'display:flex;align-items:center;gap:6px;color:#fff;font-size:13px;cursor:pointer;margin-left:4px;';
    this.trajToggle.innerHTML = `
      <input type="checkbox" id="traj-toggle" checked style="cursor:pointer;">
      <span>Aim Line</span>
    `;
    this.aiPanel.appendChild(this.trajToggle);

    // Shot trail toggle
    this.trailToggle = document.createElement('label');
    this.trailToggle.style.cssText = 'display:flex;align-items:center;gap:6px;color:#fff;font-size:13px;cursor:pointer;margin-left:4px;';
    this.trailToggle.innerHTML = `
      <input type="checkbox" id="trail-toggle" checked style="cursor:pointer;">
      <span>Trail</span>
    `;
    this.aiPanel.appendChild(this.trailToggle);

    // Sound toggle
    this.soundToggle = document.createElement('label');
    this.soundToggle.style.cssText = 'display:flex;align-items:center;gap:6px;color:#fff;font-size:13px;cursor:pointer;margin-left:4px;border-left:1px solid rgba(255,255,255,0.2);padding-left:10px;';
    this.soundToggle.innerHTML = `
      <input type="checkbox" id="sound-toggle" style="cursor:pointer;">
      <span>Sound</span>
    `;
    this.aiPanel.appendChild(this.soundToggle);

    document.getElementById('ui-layer').appendChild(this.aiPanel);
  }

  setupAIControls(onAIToggle, onDiffChange, onSoundToggle) {
    const checkbox = this.aiToggle.querySelector('input');
    checkbox.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      onAIToggle(enabled);
      this.diffSelect.disabled = !enabled;
      this.diffSelect.style.opacity = enabled ? '1' : '0.4';
      this.player2Badge.childNodes[0].textContent = enabled ? 'AI' : 'Player 2';
    });

    this.diffSelect.addEventListener('change', (e) => {
      onDiffChange(e.target.value);
    });

    const trajCheckbox = this.trajToggle.querySelector('input');
    trajCheckbox.addEventListener('change', (e) => {
      window.dispatchEvent(new CustomEvent('toggleTrajectory', { detail: e.target.checked }));
    });

    const trailCheckbox = this.trailToggle.querySelector('input');
    trailCheckbox.addEventListener('change', (e) => {
      window.dispatchEvent(new CustomEvent('toggleShotTrail', { detail: e.target.checked }));
    });

    const soundCheckbox = this.soundToggle.querySelector('input');
    soundCheckbox.addEventListener('change', (e) => {
      if (onSoundToggle) onSoundToggle(e.target.checked);
    });
  }

  setPower(pct) {
    if (this.powerFill) {
      this.powerFill.style.width = Math.max(0, Math.min(100, pct)) + '%';
    }
  }

  setMessage(text, duration = 0) {
    if (this.message) {
      this.message.textContent = text;
      if (duration > 0) {
        setTimeout(() => {
          if (this.message.textContent === text) {
            this.message.textContent = '';
          }
        }, duration);
      }
    }
  }

  setPlayerTurn(player) {
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
}
