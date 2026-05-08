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
      display: none;
    `;
    this.resetBtn.onmouseenter = () => this.resetBtn.style.background = 'rgba(255,255,255,0.3)';
    this.resetBtn.onmouseleave = () => this.resetBtn.style.background = 'rgba(255,255,255,0.15)';
    document.getElementById('ui-layer').appendChild(this.resetBtn);
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
