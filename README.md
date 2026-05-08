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

### Sound
- **"Sound"** toggle enables all audio: ambient background atmosphere + SFX
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

## 📢 Current Version: v0.5.1

### v0.5.1 — "Final Polish" (Latest)
- ✅ Removed redundant `trajectoryEnabled` flag — trajectory visibility now directly synced with toggle state
- ✅ Pocket SFX deduplication — single `playPocket()` call regardless of how many balls drop simultaneously
- ✅ Removed unused `BALL` import from Game.js
- ✅ Removed unused `opponentGroup` variable from Rules.js
- ✅ Cleaned empty comment block in break shot handling
- ✅ Added "no ball hit" foul rule — cue ball missing all balls with no pocket now correctly awards foul

### v0.5.0 — "Audio & AI Polish"
- **Sound toggle now controls ALL audio** — BGM ambience + all SFX unified under one master switch with `_canPlay()` guard
- **Fixed AI break shot targeting 8-ball** — break shot correctly excludes 8-ball; AI only attempts 8-ball after clearing its group
- **Fixed AI safety shot awareness** — `safetyAwareness` difficulty setting now actually used
- **Fixed UI overlap** — top control bar stays clear of player badges on all screen sizes
- **Trajectory state persistence** — aim line toggle state preserved across turns and resets

### v0.4.0 — "Polished Table"
- Fixed trajectory predictor crash when `toPocket` was used as Vector3 instead of `.dir`
- Fixed ghost ball clamping logic that placed it at wrong position on angled shots
- Fixed too-permissive collision threshold in trajectory raycast
- Added ambient background atmosphere (drone + noise floor) with on/off toggle

### v0.3.0 — "Smart Opponent"
- **AI Opponent** with 3 difficulty levels (Easy/Normal/Hard)
- **Trajectory Prediction** — aim line + ghost ball visualization
- AI thinks, aims, charges, and shoots autonomously
- AI difficulty affects angle accuracy, power consistency, and mistake rate
- AI falls back to safety shots when no direct pocket is available

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
