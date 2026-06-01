import { animMs } from '../core/AnimSpeed.js';

/**
 * BroadcastUI — Live broadcast overlay for Spectator Mode.
 *
 * Visual style mimics professional sports broadcasts:
 *   - Top bar: player names, scores, current turn indicator
 *   - Bottom-left: match timer + shot count
 *   - Bottom-right: commentary feed with typewriter effect
 *   - Center (brief): event badges like "FOUL", "BREAK SHOT", "GAME POINT"
 */

export class BroadcastUI {
  constructor() {
    this.container = null;
    this._topBar = null;
    this._commentaryBox = null;
    this._commentaryText = null;
    this._timerEl = null;
    this._shotCountEl = null;
    this._eventBadge = null;
    this._badgeTimer = null;
    this._hideTimer = null;
    this._matchStartTime = 0;
    this._shotCount = 0;
    this._visible = false;
  }

  mount(parent) {
    if (this.container) return;
    this.container = document.createElement('div');
    this.container.id = 'broadcast-overlay';
    this.container.style.cssText = `
      position: absolute; inset: 0;
      pointer-events: none;
      z-index: 18;
      font-family: 'Segoe UI', system-ui, sans-serif;
      display: none;
    `;

    // ── Top Bar ──
    this._topBar = document.createElement('div');
    this._topBar.id = 'broadcast-top-bar';
    this._topBar.style.cssText = `
      position: absolute; top: 0; left: 0; right: 0;
      display: flex; align-items: stretch; justify-content: center;
      height: 52px;
      background: linear-gradient(180deg, rgba(6,8,10,0.92) 0%, rgba(6,8,10,0.75) 60%, transparent 100%);
      pointer-events: none;
    `;

    // Left player
    this._p1Box = this._createPlayerBox('left');
    this._topBar.appendChild(this._p1Box.el);

    // Center info (match type / frame)
    this._centerBox = document.createElement('div');
    this._centerBox.id = 'broadcast-center-info';
    this._centerBox.style.cssText = `
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 0 16px; min-width: 90px; flex-shrink: 0;
    `;
    this._matchTypeEl = document.createElement('div');
    this._matchTypeEl.style.cssText = `font-size: 11px; font-weight: 700; color: rgba(216,177,95,0.9); letter-spacing: 2px; text-transform: uppercase;`;
    this._matchTypeEl.textContent = 'AI 对战观赛';
    this._centerBox.appendChild(this._matchTypeEl);
    this._topBar.appendChild(this._centerBox);

    // Right player
    this._p2Box = this._createPlayerBox('right');
    this._topBar.appendChild(this._p2Box.el);

    this.container.appendChild(this._topBar);

    // ── Bottom Left: Match Stats ──
    const statsBox = document.createElement('div');
    statsBox.style.cssText = `
      position: absolute; bottom: 18px; left: 18px;
      display: flex; flex-direction: column; gap: 6px;
    `;
    this._timerEl = this._createStatBadge('⏱ 00:00');
    this._shotCountEl = this._createStatBadge('🎱 杆数: 0');
    statsBox.appendChild(this._timerEl);
    statsBox.appendChild(this._shotCountEl);
    this.container.appendChild(statsBox);

    // ── Bottom Right: Commentary ──
    this._commentaryBox = document.createElement('div');
    this._commentaryBox.id = 'broadcast-commentary-box';
    this._commentaryBox.style.cssText = `
      position: absolute; bottom: 18px; right: 18px;
      width: min(380px, 32vw);
      min-height: 64px;
      background: rgba(8,10,12,0.82);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 10px;
      padding: 12px 16px;
      backdrop-filter: blur(12px);
      box-shadow: 0 12px 34px rgba(0,0,0,0.35);
      display: flex; flex-direction: column; gap: 6px;
    `;
    const commentaryHeader = document.createElement('div');
    commentaryHeader.style.cssText = `
      font-size: 10px; font-weight: 700; color: rgba(216,177,95,0.8);
      letter-spacing: 1.5px; text-transform: uppercase;
      display: flex; align-items: center; gap: 6px;
    `;
    commentaryHeader.innerHTML = '<span>📡</span> <span>实时解说</span>';
    this._commentaryBox.appendChild(commentaryHeader);

    this._commentaryText = document.createElement('div');
    this._commentaryText.style.cssText = `
      font-size: 14px; font-weight: 500; color: rgba(244,247,244,0.92);
      line-height: 1.5; min-height: 20px;
    `;
    this._commentaryText.textContent = '欢迎来到 AI 对战观赛模式……';
    this._commentaryBox.appendChild(this._commentaryText);

    // Typing cursor indicator
    this._cursorEl = document.createElement('span');
    this._cursorEl.textContent = '▎';
    this._cursorEl.style.cssText = `color: rgba(216,177,95,0.8); animation: blink 0.8s step-end infinite;`;
    this._commentaryText.appendChild(this._cursorEl);

    this.container.appendChild(this._commentaryBox);

    // ── Center Event Badge ──
    this._eventBadge = document.createElement('div');
    this._eventBadge.style.cssText = `
      position: absolute; top: 64px; left: 50%; transform: translateX(-50%);
      padding: 8px 24px;
      background: rgba(185,18,63,0.88);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 8px;
      font-size: 14px; font-weight: 800; color: #fff;
      letter-spacing: 2px; text-transform: uppercase;
      text-shadow: 0 2px 8px rgba(0,0,0,0.5);
      box-shadow: 0 8px 24px rgba(0,0,0,0.35);
      opacity: 0;
      transition: opacity calc(0.3s / var(--ui-anim-speed)) ease;
      pointer-events: none;
      z-index: 16;
    `;
    this.container.appendChild(this._eventBadge);

    // Inject blink keyframe + responsive media queries if not present
    let style = document.getElementById('broadcast-blink-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'broadcast-blink-style';
      style.dataset.refcount = '0';
      style.textContent = `
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        .broadcast-p1-active .broadcast-player-left { border-color: rgba(216,177,95,0.7); background: rgba(140,110,40,0.45); }
        .broadcast-p2-active .broadcast-player-right { border-color: rgba(90,165,230,0.7); background: rgba(35,90,140,0.45); }
        @media (max-width: 760px) {
          #broadcast-commentary-box { width: min(320px, 46vw) !important; padding: 10px 12px !important; bottom: 12px !important; right: 12px !important; }
          #broadcast-top-bar { height: 44px !important; }
          .broadcast-player-left, .broadcast-player-right { padding: 6px 10px !important; gap: 8px !important; }
          #broadcast-center-info { padding: 0 8px !important; min-width: 70px !important; }
        }
        @media (max-width: 520px) {
          #broadcast-commentary-box { width: calc(100vw - 140px) !important; bottom: 10px !important; right: 10px !important; }
          #broadcast-top-bar { height: 40px !important; }
        }
      `;
      document.head.appendChild(style);
    }
    if (style) {
      style.dataset.refcount = String(parseInt(style.dataset.refcount || '0', 10) + 1);
    }

    parent.appendChild(this.container);
  }

  _createPlayerBox(side) {
    const el = document.createElement('div');
    const isLeft = side === 'left';
    el.className = `broadcast-player-${side}`;
    el.style.cssText = `
      flex: 1; display: flex; align-items: center;
      gap: 12px; padding: 8px 20px;
      border-bottom: 2px solid transparent;
      transition: background calc(0.3s / var(--ui-anim-speed)) ease, border-color calc(0.3s / var(--ui-anim-speed)) ease;
      ${isLeft ? 'justify-content: flex-end; flex-direction: row-reverse;' : 'justify-content: flex-start;'}
    `;

    const nameEl = document.createElement('div');
    nameEl.className = `broadcast-player-name-${side}`;
    nameEl.style.cssText = `
      font-size: 15px; font-weight: 700; color: rgba(244,247,244,0.92);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: min(160px, 22vw);
    `;
    nameEl.textContent = isLeft ? 'AI Alpha' : 'AI Beta';

    const detailEl = document.createElement('div');
    detailEl.style.cssText = `
      font-size: 11px; font-weight: 600; color: rgba(244,247,244,0.55);
      letter-spacing: 0.5px;
    `;
    detailEl.textContent = isLeft ? '先手' : '后手';

    const textCol = document.createElement('div');
    textCol.style.cssText = 'display: flex; flex-direction: column; gap: 1px;';
    textCol.appendChild(nameEl);
    textCol.appendChild(detailEl);

    const avatar = document.createElement('div');
    avatar.style.cssText = `
      width: 32px; height: 32px; border-radius: 50%;
      background: ${isLeft ? 'linear-gradient(135deg, #c4a35a, #8c6e28)' : 'linear-gradient(135deg, #4a9fd4, #1e5a7d)'};
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; font-weight: 800; color: #fff;
      flex-shrink: 0;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    `;
    avatar.textContent = isLeft ? 'A' : 'B';

    if (isLeft) {
      el.appendChild(textCol);
      el.appendChild(avatar);
    } else {
      el.appendChild(avatar);
      el.appendChild(textCol);
    }

    return { el, nameEl, detailEl, avatar };
  }

  _createStatBadge(text) {
    const el = document.createElement('div');
    el.style.cssText = `
      background: rgba(8,10,12,0.72);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 6px;
      padding: 5px 10px;
      font-size: 12px; font-weight: 600;
      color: rgba(244,247,244,0.75);
      backdrop-filter: blur(8px);
      white-space: nowrap;
    `;
    el.textContent = text;
    return el;
  }

  setPlayerNames(p1Name, p2Name) {
    this._p1Box.nameEl.textContent = p1Name || 'AI Alpha';
    this._p2Box.nameEl.textContent = p2Name || 'AI Beta';
  }

  setActivePlayer(playerNum) {
    this.container.classList.remove('broadcast-p1-active', 'broadcast-p2-active');
    if (playerNum === 1) this.container.classList.add('broadcast-p1-active');
    else if (playerNum === 2) this.container.classList.add('broadcast-p2-active');
  }

  setCommentary(text, isTyping = false) {
    if (!this._commentaryText) return;
    // Remove cursor, update text, re-append cursor
    if (this._cursorEl && this._cursorEl.parentNode) {
      this._cursorEl.parentNode.removeChild(this._cursorEl);
    }
    this._commentaryText.textContent = text || '';
    if (isTyping) {
      this._commentaryText.appendChild(this._cursorEl);
    }
  }

  showEventBadge(text, durationMs = 2500) {
    if (!this._eventBadge) return;
    this._eventBadge.textContent = text;
    this._eventBadge.style.opacity = '1';
    if (this._badgeTimer) clearTimeout(this._badgeTimer);
    this._badgeTimer = setTimeout(() => {
      if (this._eventBadge) this._eventBadge.style.opacity = '0';
    }, durationMs);
  }

  hideEventBadge() {
    if (this._eventBadge) this._eventBadge.style.opacity = '0';
    if (this._badgeTimer) { clearTimeout(this._badgeTimer); this._badgeTimer = null; }
  }

  setMatchTimer(seconds) {
    if (!this._timerEl) return;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    this._timerEl.textContent = h > 0 ? `⏱ ${h}:${m}:${s}` : `⏱ ${m}:${s}`;
  }

  setShotCount(count) {
    if (!this._shotCountEl) return;
    this._shotCountEl.textContent = `🎱 杆数: ${count}`;
  }

  show() {
    if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; }
    if (this.container) {
      this.container.style.display = 'block';
      this._showRafId = requestAnimationFrame(() => {
        this._showRafId = null;
        if (this.container) this.container.style.opacity = '1';
      });
    }
    this._visible = true;
    this._matchStartTime = performance.now();
  }

  hide() {
    if (this.container) {
      this.container.style.opacity = '0';
      if (this._hideTimer) clearTimeout(this._hideTimer);
      this._hideTimer = setTimeout(() => {
        if (this.container) this.container.style.display = 'none';
        this._hideTimer = null;
      }, animMs(300));
    }
    this._visible = false;
  }

  update(dt) {
    if (!this._visible) return;
    const elapsed = (performance.now() - this._matchStartTime) / 1000;
    this.setMatchTimer(elapsed);
  }

  reset() {
    this.hideEventBadge();
    this.setCommentary('');
    this.setShotCount(0);
    this._shotCount = 0;
    if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; }
    if (this._showRafId) { cancelAnimationFrame(this._showRafId); this._showRafId = null; }
  }

  destroy() {
    this.hide();
    if (this._showRafId) { cancelAnimationFrame(this._showRafId); this._showRafId = null; }
    if (this._badgeTimer) { clearTimeout(this._badgeTimer); this._badgeTimer = null; }
    if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; }
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this._topBar = null;
    this._p1Box = null;
    this._p2Box = null;
    this._centerBox = null;
    this._matchTypeEl = null;
    this._timerEl = null;
    this._shotCountEl = null;
    this._commentaryBox = null;
    this._commentaryText = null;
    this._cursorEl = null;
    this._eventBadge = null;
    this._visible = false;
    this._matchStartTime = 0;
    // Decrement refcount and remove style only when no instances remain
    const style = document.getElementById('broadcast-blink-style');
    if (style) {
      const rc = Math.max(0, parseInt(style.dataset.refcount || '0', 10) - 1);
      style.dataset.refcount = String(rc);
      if (rc <= 0 && style.parentNode) {
        style.parentNode.removeChild(style);
      }
    }
  }
}
