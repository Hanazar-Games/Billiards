# 🎱 3D Billiards

A browser-based 3D 8-ball pool game built with **Three.js** and **cannon-es** physics engine.

**Current Version: v1.2.0**

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
