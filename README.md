# 🎱 3D Billiards

A browser-based 3D pool game built with **Three.js** and **cannon-es** physics engine.

**Current Version: v1.7.6**

## 🎮 Game Modes

| Mode | Description |
|------|-------------|
| **8-Ball** | Standard 8-ball rules. Break to assign groups (Solids / Stripes), clear your group, then legally pocket the 8-ball. |
| **9-Ball** | WPA 9-ball rules. Must hit the lowest-numbered ball first. Legal push-out after a legal break. Three consecutive fouls = loss. |
| **Free Play** | Practice mode with no rules. Cue ball auto-resets when pocketed. |
| **Local 2P** | Two players take turns on the same device. |
| **VS AI** | Play against the computer with adjustable difficulty. |
| **LAN Multiplayer** | Host a room on your local network and play with a friend. |

## 🎱 Table Profiles (球桌类型)

从 v1.6.0 开始，游戏支持多种标准球桌尺寸与袋口风格。桌型在对局开始时由房主（或比赛设置面板）锁定，整局游戏中不可中途切换。

### 当前可玩桌型

| 桌型 | 尺寸 (W×D) | 袋口风格 | 支持模式 |
|------|-----------|----------|---------|
| **WPA 9ft Tournament** | 254 × 127 cm | 美式标准 | 全部 |
| **WPA 8ft / Pro 8** | 234 × 117 cm | 美式标准 | 全部 |
| **7ft Bar Box** | 198 × 99 cm | 美式酒吧台（稍宽松） | 全部 |
| **Chinese 8-ball** | 254 × 126 cm | 中式八球（ tighter 袋口） | 8-Ball 及练习/对战/比赛 |

### 预留桌型（尚未开放）

| 桌型 | 说明 |
|------|------|
| **Snooker 12ft** | 357 × 178 cm，需斯诺克规则与 22 球组 |
| **Carom 10ft** | 284 × 142 cm，无袋口，需开伦规则 |

### 模式-桌型兼容性

- **8-Ball / 本地对战 / VS AI / 练习 / LAN**：pool9ft、pool8ft、bar7ft、chinese8
- **9-Ball**：pool9ft、pool8ft、bar7ft（**不含 chinese8**）
- **LAN 联机**：桌型由房主在选择界面锁定，所有客户端自动同步房主所选桌型；guest 无法本地切换

> 注：袋口尺寸、袋口检测半径、球台边界等参数全部随桌型联动。切换桌型后，rack 位置、自由球放置边界、轨迹预测范围、球杆防穿帮边界、房间尺寸等都会自动适配。

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

### 高级用法

- 如果前端不在默认端口 5173 运行，可通过 URL 参数指定服务器地址：
  ```
  http://localhost:5173/?ws=ws://192.168.1.10:3001
  ```
- 支持 8 球和 9 球两种联机模式

### 当前限制

- Host-authority 架构：Host 运行物理并广播状态，Client 只接收状态快照
- 仅支持 2 人对战（1 Host + 1 Guest）
- 网络断开时会自动返回主菜单

## 🎯 Features

- **物理引擎**：cannon-es 刚体碰撞 + 自定义台球物理（滚动摩擦、旋转衰减、侧旋）
- **回放系统**：自动记录每局精彩击球，支持回放库浏览
- **成就系统**：内置成就追踪与解锁提示
- **挑战模式**：完成特定击球挑战
- **大型设置系统**：10+ 分类、80+ 参数，覆盖音频、图形、外观、相机、HUD、控制、辅助功能等
- **程序化建模主题**：球桌（台呢、木材、金属包边）、房间（地板、墙壁、灯光）、球体表面风格均可实时切换
- **规则自动化测试**：28 项测试覆盖 8 球、9 球、三次犯规、Push-out、状态序列化

## 🕹️ Controls

| Control | Action |
|---------|--------|
| **Mouse Move** | Aim cue stick |
| **Left Click & Hold** | Charge shot power |
| **Left Click Release** | Shoot (or stop charging if `confirmShotOnRelease` is off) |
| **Enter** | Confirm shot when `confirmShotOnRelease` is disabled |
| **Shift + Left Click Drag** | Pan camera |
| **Shift + Right Click Drag** | Orbit camera |
| **Mouse Wheel** | Zoom in/out |
| **1 / 2 / 3** | Switch camera: Free / Top / Follow |
| **W / A / S / D** | Adjust cue tip offset (English / Spin) |
| **R** | Reset spin to center |

## 🚀 Quick Start

```bash
npm install
npm run dev
```

Then open `http://localhost:5173`

### Development Commands

```bash
npm run build          # Production build
npm run test:rules     # Run 27 rule engine tests
npm run host           # Start LAN room server (port 3001)
```

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| 3D Renderer | Three.js (r170+) |
| Physics | cannon-es |
| Build Tool | Vite |
| Language | JavaScript (ES2022) |
| Testing | Node.js assert (custom test runner) |

## 📝 License

MIT License — Copyright (c) 2026 Hanazar Games
