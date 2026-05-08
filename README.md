# 🎱 3D Billiards

A browser-based 3D 8-ball pool game built with **Three.js** and **cannon-es** physics engine.

## 🎮 How to Play

| Control | Action |
|---------|--------|
| **Mouse Move** | Aim cue stick |
| **Left Click & Hold** | Charge shot power |
| **Left Click Release** | Shoot |
| **Right Click + Drag** | Orbit camera |
| **Mouse Wheel** | Zoom in/out |

### Rules
- Standard 8-ball rules apply
- Break shot determines player groups (Solids / Stripes)
- Pocket all your group balls, then legally pocket the 8-ball to win
- Scratching or fouling gives opponent ball-in-hand

### Single Player vs AI
- Check the **"vs AI"** box in the top control bar to play against the computer
- Choose difficulty: **Easy / Normal / Hard**
- AI has different accuracy levels and can make mistakes on Easy

### Aim Assist
- The **"Aim Line"** toggle shows a trajectory prediction line and ghost ball
- Green line = target ball path to pocket (if available)
- White line = cue ball path

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

## 📢 Current Version: v0.3.0

### v0.3.0 — "Smart Opponent" (Latest)
- ✅ **AI Opponent** with 3 difficulty levels (Easy/Normal/Hard)
- ✅ **Trajectory Prediction** — aim line + ghost ball visualization
- ✅ AI thinks, aims, charges, and shoots autonomously
- ✅ AI difficulty affects angle accuracy, power consistency, and mistake rate
- ✅ AI falls back to safety shots when no direct pocket is available
- ✅ Top control bar: AI toggle, difficulty selector, aim line toggle

### v0.2.0 — "First Playable"
- Complete 8-ball rule engine (group assignment, fouls, win/lose)
- Procedural stripe textures for 9-15 balls
- Pocket detection with distance-based trigger
- Full SFX system (cue hit, ball collision, cushion bounce, pocket, win/lose)
- Player turn indicator with group badges (Solids / Stripes)
- Power bar with gradient fill
- Camera orbit controls (right-click)
- Table legs and improved lighting (3-point setup)
- Cue ball respawn with collision avoidance
- "New Game" reset button
- Physics: linear factor locked to Y=0 to prevent ball jumping

---

## 📜 Version History

### v0.1.0 — "Hello Table"
- Basic Three.js scene with camera, lights, shadows
- cannon-es physics world with materials & contact materials
- Table mesh with felt, cushions, pockets, rails
- 16 balls with solid colors
- Basic cue stick mesh
- Mouse aim + charge + shoot input
- Ball physics sync and sleep detection
- Basic HTML UI overlay

## 📝 License

MIT License — Copyright (c) 2026 Hanazar Games
