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
    this.reconnectTimer = null;
    this._pingInterval = null;
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
    return `${wsProto}//${hostname}:3001`;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this._connectResolved = false;
      if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
        resolve();
        return;
      }
      if (this.ws) {
        this.ws.onopen = this.ws.onmessage = this.ws.onerror = this.ws.onclose = null;
      }
      try {
        this.ws = new WebSocket(this.serverUrl);
      } catch (err) {
        reject(err);
        return;
      }

      this.ws.onopen = () => {
        this._connectResolved = true;
        this.connected = true;
        this._startPing();
        this.dispatchEvent(new CustomEvent('connected'));
        resolve();
      };

      this.ws.onmessage = (event) => {
        let data;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }
        this._handleMessage(data);
      };

      this.ws.onerror = (err) => {
        this.dispatchEvent(new CustomEvent('error', { detail: { message: 'WebSocket error', original: err } }));
        reject(new Error('WebSocket connection failed'));
      };

      this.ws.onclose = () => {
        this.connected = false;
        this._stopPing();
        this.dispatchEvent(new CustomEvent('disconnected'));
        if (!this._connectResolved) {
          reject(new Error('WebSocket closed'));
        }
      };
    });
  }

  disconnect() {
    this._stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.roomId = null;
    this.playerId = null;
    this.isHost = false;
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
        this.dispatchEvent(new CustomEvent('roomCreated', { detail: data }));
        break;
      case 'joinedRoom':
        this.roomId = data.roomId;
        this.playerId = data.playerId;
        this.isHost = false;
        this.dispatchEvent(new CustomEvent('joinedRoom', { detail: data }));
        break;
      case 'playerJoined':
        this.dispatchEvent(new CustomEvent('playerJoined', { detail: data }));
        break;
      case 'playerLeft':
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
        this.dispatchEvent(new CustomEvent('roomClosed', { detail: data }));
        this.disconnect();
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
    return this._send({ type: 'joinRoom', roomId: roomId.toUpperCase().trim(), nickname });
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
