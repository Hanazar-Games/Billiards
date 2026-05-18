import { NetworkClient } from '../net/NetworkClient.js';
import { animMs } from '../core/AnimSpeed.js';
import { getEnabledProfilesForMode } from '../game/TableProfiles.js';

/**
 * LanRoomPanel — UI for creating/joining LAN multiplayer rooms.
 *
 * Lifecycle:
 *   1. Show panel (create or join UI)
 *   2. Connect to WS server
 *   3. Create room → wait for guest
 *   4. Join room → wait for host start
 *   5. Host clicks "Start Game" → onStartGame callback
 */
export class LanRoomPanel {
  constructor(onStartGame, onCancel) {
    this.onStartGame = onStartGame;
    this.onCancel = onCancel;
    this.client = null;
    this.container = null;
    this._state = 'idle'; // idle | connecting | creating | joined | ready | disconnected
    this._fadeTimer = null;
  }

  show() {
    if (this.container) return;
    const layer = document.getElementById('menu-layer');
    if (!layer) return;

    this.container = document.createElement('div');
    this.container.id = 'lan-room-panel';
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
      min-width: 360px;
      max-width: 420px;
      display: flex; flex-direction: column;
      gap: 16px; align-items: stretch;
      box-shadow: 0 24px 80px rgba(0,0,0,0.5);
      backdrop-filter: blur(12px);
    `;

    // Title
    const title = document.createElement('div');
    title.textContent = '🌐 局域网联机';
    title.style.cssText = `
      font-size: 20px; font-weight: 800; color: #fff;
      text-align: center; letter-spacing: 2px; margin-bottom: 4px;
    `;
    card.appendChild(title);

    // Status
    this._statusEl = document.createElement('div');
    this._statusEl.style.cssText = `
      font-size: 13px; color: rgba(255,255,255,0.55);
      text-align: center; min-height: 20px;
    `;
    this._statusEl.textContent = '准备连接…';
    card.appendChild(this._statusEl);

    // Room ID display
    this._roomIdEl = document.createElement('div');
    this._roomIdEl.style.cssText = `
      font-size: 28px; font-weight: 700; color: #d8b15f;
      text-align: center; letter-spacing: 6px;
      font-family: monospace; display: none;
    `;
    card.appendChild(this._roomIdEl);

    // Player list
    this._playerListEl = document.createElement('div');
    this._playerListEl.style.cssText = `
      display: flex; flex-direction: column; gap: 6px;
      font-size: 13px; color: rgba(255,255,255,0.75);
    `;
    card.appendChild(this._playerListEl);

    // Join input row
    this._joinRow = document.createElement('div');
    this._joinRow.style.cssText = `
      display: flex; gap: 8px; align-items: center;
    `;
    this._joinInput = document.createElement('input');
    this._joinInput.type = 'text';
    this._joinInput.placeholder = '输入房间号';
    this._joinInput.maxLength = 6;
    this._joinInput.style.cssText = `
      flex: 1; padding: 10px 14px; font-size: 14px;
      background: rgba(255,255,255,0.06); color: #fff;
      border: 1px solid rgba(255,255,255,0.15); border-radius: 8px;
      outline: none; text-transform: uppercase;
    `;
    this._joinInput.addEventListener('input', () => {
      this._joinInput.value = this._joinInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    });
    this._joinRow.appendChild(this._joinInput);
    card.appendChild(this._joinRow);

    // Buttons row
    const btnRow = document.createElement('div');
    btnRow.style.cssText = `
      display: flex; gap: 10px; justify-content: center; margin-top: 4px;
    `;

    this._createBtn = this._makeBtn('创建房间', () => this._onCreateRoom());
    this._joinBtn = this._makeBtn('加入房间', () => this._onJoinRoom());
    this._startBtn = this._makeBtn('开始游戏', () => this._onStartGame());
    this._startBtn.style.display = 'none';
    this._cancelBtn = this._makeBtn('返回', () => this.hide());

    // Table profile selector (host only, hidden until room created)
    this._tableSelectWrap = document.createElement('div');
    this._tableSelectWrap.id = 'lan-table-select-wrap';
    this._tableSelectWrap.style.cssText = 'display:none;gap:8px;align-items:center;margin-right:12px;';
    const tableLabel = document.createElement('span');
    tableLabel.textContent = '球桌:';
    tableLabel.style.cssText = 'font-size:12px;color:rgba(255,255,255,0.55);';
    this._tableSelectWrap.appendChild(tableLabel);
    this._tableSelect = document.createElement('select');
    this._tableSelect.style.cssText = 'padding:6px 10px;border-radius:6px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:#fff;font-size:13px;cursor:pointer;';
    this._populateTableSelect();
    this._tableSelectWrap.appendChild(this._tableSelect);

    btnRow.appendChild(this._createBtn);
    btnRow.appendChild(this._joinBtn);
    btnRow.appendChild(this._tableSelectWrap);
    btnRow.appendChild(this._startBtn);
    btnRow.appendChild(this._cancelBtn);
    card.appendChild(btnRow);

    this.container.appendChild(card);
    layer.appendChild(this.container);

    requestAnimationFrame(() => {
      if (this.container) this.container.style.opacity = '1';
    });

    // Auto-connect
    this._connect();
  }

  _makeBtn(text, onClick) {
    const btn = document.createElement('button');
    btn.className = 'ui-action';
    btn.textContent = text;
    btn.style.cssText = `
      padding: 10px 20px; font-size: 14px; font-weight: 700;
      color: #fff; background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.2); border-radius: 8px;
      cursor: pointer; transition: all 0.2s ease;
    `;
    btn.onmouseenter = () => {
      btn.style.background = 'rgba(255,255,255,0.2)';
      btn.style.borderColor = 'rgba(255,255,255,0.4)';
    };
    btn.onmouseleave = () => {
      btn.style.background = 'rgba(255,255,255,0.1)';
      btn.style.borderColor = 'rgba(255,255,255,0.2)';
    };
    btn.onclick = onClick;
    return btn;
  }

  async _connect() {
    this._setStatus('正在连接服务器…');
    this.client = new NetworkClient();
    this.client.addEventListener('connected', () => {
      this._setStatus('已连接服务器', 'connected');
      this._state = 'idle';
    });
    this.client.addEventListener('disconnected', () => {
      this._setStatus('连接已断开', 'disconnected');
      this._state = 'disconnected';
    });
    this.client.addEventListener('netError', (e) => {
      this._setStatus('错误：' + (e.detail?.error || '未知错误'), 'error');
    });
    this.client.addEventListener('roomCreated', (e) => {
      this._onRoomCreated(e.detail);
    });
    this.client.addEventListener('joinedRoom', (e) => {
      this._onJoinedRoom(e.detail);
    });
    this.client.addEventListener('playerJoined', (e) => {
      this._updatePlayerList(e.detail.playerList);
      const currentCount = e.detail.playerList?.length || 1;
      const maxCount = e.detail.maxPlayers || 2;
      this._setStatus(`玩家 ${e.detail.nickname || e.detail.playerId} 加入房间 (${currentCount}/${maxCount})`, 'connected');
    });
    this.client.addEventListener('playerLeft', (e) => {
      this._updatePlayerList(this.client.playerList || []);
      this._setStatus(`玩家 ${e.detail.playerId} 离开房间`, 'warning');
    });
    this.client.addEventListener('startGame', (e) => {
      this._onRemoteStartGame(e.detail);
    });
    this.client.addEventListener('roomClosed', (e) => {
      const reason = e.detail?.reason;
      const msg = reason === 'hostLeft' ? '房主已离开，房间关闭'
        : reason === 'hostDisconnected' ? '房主连接断开，房间关闭'
        : '房间已关闭';
      this._setStatus(msg, 'error');
      this._resetToIdle();
    });
    try {
      await this.client.connect();
    } catch (err) {
      this._setStatus('无法连接服务器：' + (err.message || '请确认 host 已启动'));
    }
  }

  _onCreateRoom() {
    if (!this.client || !this.client.connected) {
      this._setStatus('尚未连接到服务器');
      return;
    }
    this.client.createRoom();
    this._setStatus('正在创建房间…');
    this._state = 'creating';
  }

  _onRoomCreated(detail) {
    this._roomId = detail.roomId;
    this._roomIdEl.textContent = detail.roomId;
    this._roomIdEl.style.display = 'block';
    const max = detail.maxPlayers || 2;
    this._setStatus(`房间已创建，等待玩家加入… (1/${max})`, 'connected');
    this._createBtn.style.display = 'none';
    this._joinBtn.style.display = 'none';
    this._joinRow.style.display = 'none';
    this._startBtn.style.display = 'inline-block';
    if (this._tableSelectWrap) this._tableSelectWrap.style.display = 'flex';
    this._updatePlayerList(detail.playerList);
    this._state = 'ready';
  }

  _onJoinRoom() {
    const roomId = this._joinInput.value.trim();
    if (!roomId) {
      this._setStatus('请输入房间号');
      return;
    }
    if (!this.client || !this.client.connected) {
      this._setStatus('尚未连接到服务器');
      return;
    }
    this.client.joinRoom(roomId);
    this._setStatus('正在加入房间…');
    this._state = 'joining';
  }

  _onJoinedRoom(detail) {
    this._roomId = detail.roomId;
    this._roomIdEl.textContent = detail.roomId;
    this._roomIdEl.style.display = 'block';
    const current = detail.playerList?.length || 1;
    const max = detail.maxPlayers || 2;
    this._setStatus(`已加入房间，等待房主开始游戏… (${current}/${max})`, 'connected');
    this._createBtn.style.display = 'none';
    this._joinBtn.style.display = 'none';
    this._joinRow.style.display = 'none';
    this._startBtn.style.display = 'none';
    if (this._tableSelectWrap) this._tableSelectWrap.style.display = 'none';
    this._updatePlayerList(detail.playerList);
    this._state = 'joined';
  }

  _onStartGame() {
    if (!this.client || !this.client.isHost) return;
    const tableProfileId = this._tableSelect?.value || 'pool9ft';
    this.client.startGame('8ball', tableProfileId);
    // Local callback is triggered by startGame event as well
  }

  _onRemoteStartGame(detail) {
    this._setStatus('游戏开始！');
    if (this.onStartGame) {
      this.onStartGame(this.client, detail.mode, detail.tableProfileId);
    }
  }

  _populateTableSelect() {
    if (!this._tableSelect) return;
    this._tableSelect.innerHTML = '';
    const profiles = getEnabledProfilesForMode('lan', '8ball');
    for (const p of profiles) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.labelZh || p.label;
      this._tableSelect.appendChild(opt);
    }
  }

  _updatePlayerList(list) {
    this._playerListEl.innerHTML = '';
    if (!list || list.length === 0) return;
    const header = document.createElement('div');
    header.textContent = '玩家列表';
    header.style.cssText = 'font-weight: 700; color: rgba(255,255,255,0.5); font-size: 11px; text-transform: uppercase; letter-spacing: 1px;';
    this._playerListEl.appendChild(header);
    for (const p of list) {
      const row = document.createElement('div');
      const tag = p.isHost ? ' (房主)' : '';
      row.textContent = `• ${p.nickname}${tag}`;
      row.style.cssText = 'padding-left: 4px;';
      this._playerListEl.appendChild(row);
    }
  }

  _setStatus(text, tone = 'neutral') {
    if (!this._statusEl) return;
    this._statusEl.textContent = text;
    const colors = {
      neutral: 'rgba(255,255,255,0.55)',
      connected: '#7ab860',
      disconnected: '#ff6b6b',
      error: '#ff6b6b',
      warning: '#d8b15f',
    };
    this._statusEl.style.color = colors[tone] || colors.neutral;
  }

  _resetToIdle() {
    this._roomIdEl.style.display = 'none';
    this._createBtn.style.display = 'inline-block';
    this._joinBtn.style.display = 'inline-block';
    this._joinRow.style.display = 'flex';
    this._startBtn.style.display = 'none';
    this._playerListEl.innerHTML = '';
    this._state = 'idle';
  }

  hide(skipCallback = false) {
    if (this.client) {
      this.client.leaveRoom();
      this.client = null;
    }
    if (!this.container) return;
    this.container.style.opacity = '0';
    if (this._fadeTimer) clearTimeout(this._fadeTimer);
    this._fadeTimer = setTimeout(() => {
      if (this.container && this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
      }
      this.container = null;
      if (!skipCallback && this.onCancel) this.onCancel();
    }, animMs(400));
  }

  destroy() {
    if (this._fadeTimer) { clearTimeout(this._fadeTimer); this._fadeTimer = null; }
    if (this.client) {
      this.client.leaveRoom();
      this.client = null;
    }
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
  }
}
