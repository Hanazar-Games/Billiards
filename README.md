# 🎱 3D Billiards

A browser-based 3D 8-ball pool game built with **Three.js** and **cannon-es** physics engine.

**Current Version: v1.4.4**

## 🌐 LAN Multiplayer (局域网联机)

同一 Wi-Fi / 局域网下的玩家可以创建房间并对战。

### 启动步骤

1. **Host 机器** 同时启动前端 dev server 和房间服务器：
   ```bash
   npm run dev -- --host 0.0.0.0
   # 另开一个终端
   npm run host
   ```
2. **其他设备** 用浏览器访问 `http://<HOST_IP>:5173`
3. 点击主菜单 **局域网联机**
   - Host 端点击 **创建房间**，将房间号告知其他玩家
   - 其他玩家输入房间号，点击 **加入房间**
4. 当所有玩家就绪后，Host 点击 **开始游戏**

### 注意事项
- 需要 Node.js 运行 `npm run host` 启动 WebSocket 房间服务器（默认端口 3001）
- 如果前端不在默认端口 5173 运行，可通过 URL 参数指定服务器地址：
  `http://localhost:5173/?ws=ws://192.168.1.10:3001`
- 当前仅支持 2 人联机 8 球对战

## 🎮 How to Play

| Control | Action |
|---------|--------|
| **Mouse Move** | Aim cue stick |
| **Left Click & Hold** | Charge shot power |
| **Left Click Release** | Shoot |
| **Shift + Left Click Drag** | Pan camera |
| **Shift + Right Click Drag** | Orbit camera |
| **Mouse Wheel** | Zoom in/out |

### Rules
- Standard 8-ball rules apply
- Break shot determines player groups (Solids / Stripes)
- Pocket all your group balls, then legally pocket the 8-ball to win
- Scratching or fouling gives opponent ball-in-hand

### Single Player vs AI
- Choose **对战 AI** mode to play against the computer
- AI has different accuracy levels and can make mistakes on lower difficulties

### Aim Assist
- Trajectory prediction line and ghost ball are shown by default
- Green line = target ball path to pocket (if available)
- White line = cue ball path

### Sound
- Toggle sound in Settings to enable ambient background atmosphere + SFX
- All audio is procedurally generated via Web Audio API (no external files)

## 🚀 Quick Start

```bash
npm install
npm run dev
```

Then open `http://localhost:5173`

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| 3D Renderer | Three.js (r170+) |
| Physics | cannon-es |
| Build Tool | Vite |
| Language | JavaScript (ES2022) |

## 📝 License

MIT License — Copyright (c) 2026 Hanazar Games
