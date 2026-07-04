/**
 * LAN Room Server — Lightweight WebSocket relay for local-network multiplayer.
 *
 * Responsibilities:
 *   - Generate room IDs (4-6 uppercase alphanumeric)
 *   - Track room membership (host + guests)
 *   - Forward messages between peers
 *   - Enforce host-authority: only host may broadcast state snapshots
 *
 * The server does NOT run billiards physics; it only routes JSON messages.
 */
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

const PORT = process.env.LAN_SERVER_PORT || 3001;
const HOST = process.env.LAN_SERVER_HOST || '0.0.0.0';

// In-memory room storage: roomId -> Room
const rooms = new Map();

function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // omit 0, O, I, 1
  let id = '';
  const len = 4 + Math.floor(Math.random() * 3); // 4–6 chars
  for (let i = 0; i < len; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function ensureUniqueRoomId() {
  let id;
  do { id = generateRoomId(); } while (rooms.has(id));
  return id;
}

class Room {
  constructor(id, hostWs) {
    this.id = id;
    this.host = hostWs;
    this.guests = new Map(); // ws -> { id, nickname }
    this.nextGuestId = 2;
    this.started = false;
    this.maxPlayers = 2; // MVP: only 2-player matches
  }

  addGuest(ws, nickname = '') {
    const guestId = this.nextGuestId++;
    const info = { id: guestId, nickname: nickname || `玩家 ${guestId}` };
    this.guests.set(ws, info);
    return info;
  }

  removeGuest(ws) {
    const info = this.guests.get(ws);
    if (info) {
      this.guests.delete(ws);
      this.broadcast({ type: 'playerLeft', playerId: info.id });
    }
  }

  getPlayerList() {
    const list = [{ id: 1, nickname: 'Host', isHost: true }];
    for (const info of this.guests.values()) {
      list.push({ id: info.id, nickname: info.nickname, isHost: false });
    }
    return list;
  }

  broadcast(msg, excludeWs = null) {
    let payload;
    try {
      payload = JSON.stringify(msg);
    } catch {
      return;
    }
    if (this.host && this.host !== excludeWs && this.host.readyState === 1) {
      this.host.send(payload);
    }
    for (const [ws] of this.guests) {
      if (ws !== excludeWs && ws.readyState === 1) {
        ws.send(payload);
      }
    }
  }

  sendToHost(msg) {
    let payload;
    try {
      payload = JSON.stringify(msg);
    } catch {
      return;
    }
    if (this.host && this.host.readyState === 1) {
      this.host.send(payload);
    }
  }

  sendToGuest(guestWs, msg) {
    let payload;
    try {
      payload = JSON.stringify(msg);
    } catch {
      return;
    }
    if (guestWs && guestWs.readyState === 1) {
      guestWs.send(payload);
    }
  }
}

function send(ws, msg) {
  let payload;
  try {
    payload = JSON.stringify(msg);
  } catch {
    return;
  }
  if (ws && ws.readyState === 1) {
    ws.send(payload);
  }
}

// HTTP server (for health checks and CORS preflight)
const httpServer = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', rooms: rooms.size }));
});

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws, req) => {
  ws._room = null;
  ws._isHost = false;
  ws._playerId = null;

  ws.on('message', (raw) => {
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      send(ws, { type: 'error', error: 'Invalid JSON' });
      return;
    }

    if (!data || typeof data !== 'object') {
      send(ws, { type: 'error', error: 'Invalid message format' });
      return;
    }
    const { type } = data;

    if (type === 'createRoom') {
      if (ws._room) {
        send(ws, { type: 'error', error: 'Already in a room' });
        return;
      }
      const roomId = ensureUniqueRoomId();
      const room = new Room(roomId, ws);
      rooms.set(roomId, room);
      ws._room = room;
      ws._isHost = true;
      ws._playerId = 1;
      send(ws, {
        type: 'roomCreated',
        roomId,
        playerId: 1,
        maxPlayers: room.maxPlayers,
        playerList: room.getPlayerList(),
      });
      return;
    }

    if (type === 'joinRoom') {
      if (ws._room) {
        send(ws, { type: 'error', error: 'Already in a room' });
        return;
      }
      const roomId = String(data.roomId || '').toUpperCase().trim();
      const room = rooms.get(roomId);
      if (!room) {
        send(ws, { type: 'error', error: 'Room not found' });
        return;
      }
      if (room.started) {
        send(ws, { type: 'error', error: 'Game already started' });
        return;
      }
      if (room.guests.size >= room.maxPlayers - 1) {
        send(ws, { type: 'error', error: 'Room is full' });
        return;
      }
      const info = room.addGuest(ws, data.nickname);
      ws._room = room;
      ws._isHost = false;
      ws._playerId = info.id;
      send(ws, {
        type: 'joinedRoom',
        roomId,
        playerId: info.id,
        maxPlayers: room.maxPlayers,
        playerList: room.getPlayerList(),
      });
      // Notify host and other guests
      room.broadcast({
        type: 'playerJoined',
        playerId: info.id,
        nickname: info.nickname,
        maxPlayers: room.maxPlayers,
        playerList: room.getPlayerList(),
      }, ws);
      return;
    }

    if (type === 'startGame') {
      const room = ws._room;
      if (!room || !ws._isHost) {
        send(ws, { type: 'error', error: 'Only host can start game' });
        return;
      }
      room.started = true;
      room.broadcast({ type: 'startGame', mode: data.mode || '8ball', tableProfileId: data.tableProfileId || 'pool9ft', startedBy: ws._playerId });
      return;
    }

    if (type === 'leaveRoom') {
      const room = ws._room;
      if (!room) return;
      if (ws._isHost) {
        // Host left — destroy room
        room.broadcast({ type: 'roomClosed', reason: 'hostLeft' });
        for (const [gws] of room.guests) {
          gws._room = null;
          gws._isHost = false;
          gws._playerId = null;
          gws.close();
        }
        rooms.delete(room.id);
      } else {
        room.removeGuest(ws);
      }
      ws._room = null;
      ws._isHost = false;
      ws._playerId = null;
      return;
    }

    // ── Host-authority game messages ──
    const room = ws._room;
    if (!room) {
      send(ws, { type: 'error', error: 'Not in a room' });
      return;
    }

    if (type === 'shotInput') {
      // Guest sends shot intent → relay to host
      if (ws._isHost) {
        // Host shot: broadcast to all guests
        room.broadcast({ ...data, fromHost: true }, ws);
      } else {
        room.sendToHost({ ...data, fromPlayer: ws._playerId });
      }
      return;
    }

    if (type === 'stateSnapshot') {
      // Only host may broadcast snapshots
      if (!ws._isHost) {
        send(ws, { type: 'error', error: 'Only host may broadcast snapshots' });
        return;
      }
      room.broadcast({ ...data, fromHost: true }, ws);
      return;
    }

    if (type === 'turnResolved') {
      if (!ws._isHost) {
        send(ws, { type: 'error', error: 'Only host may broadcast turn results' });
        return;
      }
      room.broadcast({ ...data, fromHost: true }, ws);
      return;
    }

    if (type === 'pocketEvent') {
      // Host broadcasts pocket FX to all clients
      if (!ws._isHost) {
        send(ws, { type: 'error', error: 'Only host may broadcast pocket events' });
        return;
      }
      room.broadcast({ ...data, fromHost: true }, ws);
      return;
    }

    if (type === 'pushOutDeclare' || type === 'pushOutChoice') {
      // Guest sends push-out intent → relay to host
      if (ws._isHost) {
        room.broadcast({ ...data, fromHost: true }, ws);
      } else {
        room.sendToHost({ ...data, fromPlayer: ws._playerId });
      }
      return;
    }

    if (type === 'chat' || type === 'ping') {
      // Simple relay
      room.broadcast({ ...data, fromPlayer: ws._playerId }, ws);
      return;
    }

    // Unknown type — ignore silently
  });

  ws.on('close', () => {
    const room = ws._room;
    if (!room) return;
    if (ws._isHost) {
      room.broadcast({ type: 'roomClosed', reason: 'hostDisconnected' });
      for (const [gws] of room.guests) {
        gws._room = null;
        gws.close();
      }
      rooms.delete(room.id);
    } else {
      room.removeGuest(ws);
      if (room.guests.size === 0 && !room.started) {
        // Empty idle room: clean up
        if (room.host) room.host._room = null;
        rooms.delete(room.id);
      }
    }
  });

  ws.on('error', (err) => {
    console.warn('WebSocket error:', err.message);
  });
});

httpServer.listen(PORT, HOST, () => {
  console.log(`LAN Room Server listening on ws://${HOST}:${PORT}`);
  console.log(`HTTP health check: http://${HOST}:${PORT}`);
});
