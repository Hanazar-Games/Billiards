/**
 * NetworkClient — Frontend WebSocket client for LAN multiplayer rooms.
 *
 * Provides EventTarget-style API:
 *   client.addEventListener('roomCreated', (e) => ...)
 *   client.addEventListener('stateSnapshot', (e) => ...)
 *
 * Does NOT touch the DOM; all UI updates are driven by event listeners.
 */
export class NetworkClient extends EventTarget {
  constructor(serverUrl = null) {
    super();
    this.serverUrl = serverUrl || NetworkClient.inferServerUrl();
    this.ws = null;
    this.roomId = null;
    this.playerId = null;
    this.isHost = false;
    this.connected = false;
    this.playerList = [];
    this.reconnectTimer = null;
    this._pingInterval = null;
    this._connectTimer = null;
    this._connectPromise = null;
    this._rejectConnect = null;
  }

  static inferServerUrl() {
    // If the page is served from localhost or an IP, assume the WS server
    // is on the same host at port 3001.
    if (typeof window === 'undefined') return 'ws://localhost:3001';
    const { protocol, hostname } = window.location;
    const isSecure = protocol === 'https:';
    const wsProto = isSecure ? 'wss:' : 'ws:';
    // Allow override via query param ?ws=ws://x.x.x.x:3001
    const params = new URLSearchParams(window.location.search);
    const override = params.get('ws');
    if (override) return override;
    if (hostname.endsWith('.github.io')) return null;
    return `${wsProto}//${hostname}:3001`;
  }

  connect() {
    if (this.connected && this.ws?.readyState === WebSocket.OPEN) return Promise.resolve();
    if (this._connectPromise) return this._connectPromise;
    const promise = new Promise((resolve, reject) => {
      if (!this.serverUrl) { reject(new Error('请填写联机服务器地址（wss://…）')); return; }
      let url;
      try { url = new URL(this.serverUrl); } catch { reject(new Error('服务器地址无效，请使用 ws:// 或 wss:// 地址')); return; }
      if (!['ws:', 'wss:'].includes(url.protocol)) { reject(new Error('服务器地址必须使用 ws:// 或 wss://')); return; }
      if (typeof window !== 'undefined' && window.location?.protocol === 'https:' && url.protocol !== 'wss:') {
        reject(new Error('HTTPS 页面需要 wss:// 安全联机服务器')); return;
      }
      let opened = false;
      clearTimeout(this._connectTimer);
      this._connectTimer = null;
      if (this.ws) {
        this.ws.onopen = this.ws.onmessage = this.ws.onerror = this.ws.onclose = null;
      }
      try {
        this.ws = new WebSocket(this.serverUrl);
      } catch (err) {
        reject(err);
        return;
      }

      const socket = this.ws;
      this._rejectConnect = reject;
      this._connectTimer = setTimeout(() => {
        reject(new Error('连接超时，请检查服务器地址和网络'));
        this.disconnect();
      }, 10000);
      this.ws.onopen = () => {
        if (this.ws !== socket) return;
        clearTimeout(this._connectTimer);
        this._connectTimer = null;
        this._rejectConnect = null;
        opened = true;
        this.connected = true;
        this._startPing();
        this.dispatchEvent(new CustomEvent('connected'));
        resolve();
      };

      this.ws.onmessage = (event) => {
        if (this.ws !== socket) return;
        let data;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }
        this._handleMessage(data);
      };

      this.ws.onerror = (err) => {
        reject(new Error('WebSocket connection failed'));
        if (this.ws === socket) {
          this.disconnect();
          this.dispatchEvent(new CustomEvent('disconnected'));
          this.dispatchEvent(new CustomEvent('error', { detail: { message: 'WebSocket error', original: err } }));
        }
      };

      this.ws.onclose = () => {
        if (!opened) reject(new Error('WebSocket closed'));
        if (this.ws === socket) {
          this.disconnect();
          this.dispatchEvent(new CustomEvent('disconnected'));
        }
      };
    });
    this._connectPromise = promise;
    const clearPending = () => {
      if (this._connectPromise !== promise) return;
      this._connectPromise = null;
      this._rejectConnect = null;
    };
    promise.then(clearPending, clearPending);
    return promise;
  }

  disconnect() {
    this._rejectConnect?.(new Error('连接已取消'));
    this._rejectConnect = null;
    this._connectPromise = null;
    clearTimeout(this._connectTimer);
    this._connectTimer = null;
    this._stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      const socket = this.ws;
      this.ws = null;
      socket.close();
    }
    this.connected = false;
    this.roomId = null;
    this.playerId = null;
    this.isHost = false;
    this.playerList = [];
  }

  _send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  _handleMessage(data) {
    const { type } = data;
    switch (type) {
      case 'roomCreated':
        this.roomId = data.roomId;
        this.playerId = data.playerId;
        this.isHost = true;
        this.playerList = data.playerList || [];
        this.dispatchEvent(new CustomEvent('roomCreated', { detail: data }));
        break;
      case 'joinedRoom':
        this.roomId = data.roomId;
        this.playerId = data.playerId;
        this.isHost = false;
        this.playerList = data.playerList || [];
        this.dispatchEvent(new CustomEvent('joinedRoom', { detail: data }));
        break;
      case 'playerJoined':
        this.playerList = data.playerList || this.playerList;
        this.dispatchEvent(new CustomEvent('playerJoined', { detail: data }));
        break;
      case 'playerLeft':
        this.playerList = data.playerList || this.playerList.filter(player => player.id !== data.playerId);
        this.dispatchEvent(new CustomEvent('playerLeft', { detail: data }));
        break;
      case 'startGame':
        this.dispatchEvent(new CustomEvent('startGame', { detail: data }));
        break;
      case 'stateSnapshot':
        this.dispatchEvent(new CustomEvent('stateSnapshot', { detail: data }));
        break;
      case 'turnResolved':
        this.dispatchEvent(new CustomEvent('turnResolved', { detail: data }));
        break;
      case 'shotInput':
        this.dispatchEvent(new CustomEvent('shotInput', { detail: data }));
        break;
      case 'roomClosed':
        this.disconnect();
        this.dispatchEvent(new CustomEvent('roomClosed', { detail: data }));
        break;
      case 'error':
        this.dispatchEvent(new CustomEvent('netError', { detail: data }));
        break;
      default:
        if (type) {
          this.dispatchEvent(new CustomEvent(type, { detail: data }));
        } else {
          console.warn('[NetworkClient] received message with no type:', data);
        }
    }
  }

  // ── Room actions ──

  createRoom() {
    return this._send({ type: 'createRoom' });
  }

  joinRoom(roomId, nickname = '') {
    if (!roomId) return false;
    return this._send({ type: 'joinRoom', roomId: String(roomId).toUpperCase().trim(), nickname });
  }

  leaveRoom() {
    const ok = this._send({ type: 'leaveRoom' });
    this.disconnect();
    return ok;
  }

  startGame(mode = '8ball', tableProfileId = 'pool9ft') {
    return this._send({ type: 'startGame', mode, tableProfileId });
  }

  // ── Game messages ──

  sendShotInput(aimDirection, power, cueTipOffset, ballPlacement = null, requestReset = false) {
    return this._send({
      type: 'shotInput',
      aimDirection: { x: aimDirection.x, y: aimDirection.y, z: aimDirection.z },
      power,
      cueTipOffset: { x: cueTipOffset.x, y: cueTipOffset.y },
      ballPlacement: ballPlacement ? { x: ballPlacement.x, y: ballPlacement.y, z: ballPlacement.z } : null,
      requestReset,
    });
  }

  sendStateSnapshot(snapshot) {
    return this._send({ type: 'stateSnapshot', snapshot });
  }

  sendTurnResolved(result) {
    return this._send({ type: 'turnResolved', result });
  }

  sendPocketEvent(ballId, pocketIndex, pocket) {
    return this._send({ type: 'pocketEvent', ballId, pocketIndex, pocket });
  }

  sendPushOutDeclare() {
    return this._send({ type: 'pushOutDeclare' });
  }

  sendPushOutChoice(choice) {
    return this._send({ type: 'pushOutChoice', choice });
  }

  // ── Ping keepalive ──

  _startPing() {
    this._stopPing();
    this._pingInterval = setInterval(() => {
      this._send({ type: 'ping', time: Date.now() });
    }, 15000);
  }

  _stopPing() {
    if (this._pingInterval) {
      clearInterval(this._pingInterval);
      this._pingInterval = null;
    }
  }
}
