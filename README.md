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

## 📢 Current Version: v0.9.0

### v0.9.0 — "Gameplay Expansion" (Latest)
- **🎱 9-Ball Mode** — complete 9-ball rule engine with diamond rack layout
  - Balls 1-9 arranged in diamond: 1 at apex, 9 in center
  - Must hit lowest-numbered ball first each shot
  - Combination shots legal (hit 1, 1 hits 2, 2 drops = legal)
  - 9-ball pocketed on any legal shot = instant win
  - Break shot rules: must hit 1-ball first, scratch = foul
- **🌀 English Spin System** — apply spin to the cue ball for advanced shots
  - W/S: top/back spin (affects roll after collision)
  - A/D: left/right spin (affects rebound angle)
  - R: reset spin to center
  - Visual indicator shows spin position on a circular HUD
- **🎥 Camera Modes** — three viewing angles for different play styles
  - **1** — Free orbit (default): full camera control with right-click
  - **2** — Top-down: overhead view for precise aiming
  - **3** — Follow ball: camera tracks the cue ball automatically
- **🏠 Room Environment** — immersive billiard hall atmosphere
  - Dark wood floor beneath the table
  - 4 walls with baseboards surrounding the play area
  - Ceiling with hanging lamp fixture and warm point light
  - All environment meshes cast and receive shadows

### v0.8.0 — "Main Menu & Game Modes"
- **🎮 Full main menu system** — polished entry screen with animated title, glassmorphism buttons, and smooth fade transitions
- **🎯 Three game modes:**
  - **单人练习 (Free Play)** — no rules, no win/lose, unlimited shots; cue ball auto-respawns when pocketed
  - **本地双人对战 (Local 2P)** — standard 8-ball rules, two players take turns
  - **对战 AI (vs AI)** — standard 8-ball rules against the computer AI
- **⚙️ Settings screen** — in-menu sound toggle with persistent state
- **🔙 Return to menu** — back button during gameplay to exit current session
- **🧹 Clean session lifecycle** — `Game.dispose()` properly removes all resources between sessions

### v0.7.2 — "UI Visibility & Layout Fixes"
- ✅ **Fixed control panel completely invisible on dark background** — raised background opacity from `0.45 → 0.65` and border brightness from `0.15 → 0.3` so the top control bar is clearly visible against the `#111` page background
- ✅ **Fixed control panel awkward positioning** — moved from `top: 135px` to `top: 82px` directly beneath the player badges
- ✅ **Fixed top-bar excessive top margin** — reduced `margin-top` from `48px → 36px`
- ✅ **Fixed power bar container invisible on dark background** — raised background from `0.5 → 0.65` and border from `0.6 → 0.75`
- ✅ **Fixed control panel overflow on small screens** — added `flex-wrap: wrap`

### v0.7.1 — "Shot Trail Polish & Bug Fixes"
- ✅ **Fixed invisible trail bug** — disabled `frustumCulled` on trail lines and set `renderOrder = 10` so trails are always visible and draw on top of other transparent objects (the sparse `Float32Array` buffer caused incorrect bounding sphere calculation, which could randomly cull trails)
- ✅ **Fixed trail opacity too low** — initial opacity raised from 0.85 → 1.0 so trails are crisp and clearly visible against the green felt; fade-out curve now goes from 1.0 → 0.0 for a more satisfying disappearance
- ✅ **Fixed non-integer AudioBuffer lengths** — `AudioManager` now uses `Math.ceil()` for all `createBuffer()` sizes, preventing edge-case bugs where fractional sample rates could produce invalid buffer lengths

### v0.7.0 — "Shot Trail System"
- **Cue ball trail visualization** — a glowing cyan line traces the cue ball's path during every shot, helping players learn ball control and making spectacular shots more satisfying to watch
- **Real-time growth animation** — the trail visibly extends frame-by-frame as the ball moves, creating a satisfying "laser draw" effect
- **Smart distance filtering** — points are only recorded when the ball moves fast enough (`> 0.15`) and far enough from the last point, preventing clutter from tiny jitters
- **Smooth fade-out** — trails linger for 5 seconds after the shot ends, then ease-out cubic fade to transparent; old trails are automatically cleaned up
- **Max 3 trails retained** — prevents visual overload during long rallies
- **UI toggle** — "Trail" checkbox in the top control bar lets players enable/disable trails on demand
- **Robust edge-case handling** — gracefully stops recording when the cue ball is pocketed, reaches the point buffer limit, or the game is reset

### v0.6.3 — "Collision System Restoration"
- ✅ **Fixed ball collision SFX double-play** — moved `playBallCollision()` inside the `ball.id < otherBall.id` dedup branch so each collision plays exactly once (was playing twice, once per body)
- ✅ **Fixed relative velocity calculation** — replaced `Math.abs(v - vOther)` (scalar difference) with `ball.body.velocity.distanceTo(otherBall.body.velocity)` (true vector magnitude). Head-on collisions now correctly report high relative velocity instead of 0
- ✅ **Fixed accidental shot when releasing mouse over UI** — `InputHandler.handleMouseUp()` now ignores releases over BUTTON/INPUT/SELECT/LABEL elements, preventing unintended shots when the user clicks the stats toggle or AI controls mid-charge

### v0.6.2 — "The Silent Killer Fix"
- 🚨 **FIXED: collision `otherBody` computation was completely inverted** — In cannon-es, `e.body` is ALREADY the other body. The ternary `e.body === e.contact.bi ? e.contact.bj : e.contact.bi` was returning the listener's own body 100% of the time. This meant:
  - **Ball-ball collision SFX never played** (relVel was always 0)
  - **First-hit tracking never worked** — `recordFirstHit()` was never called, so "hit wrong group first" fouls were never detected
  - **Collision sparks never spawned**
  - **Ball-cushion SFX never played** — the cushion branch was unreachable
  - **Stats collision counters were always zero**
- ✅ **Fixed: `const otherBody = e.body`** — All SFX, first-hit detection, sparks, and collision stats now work correctly for the first time
- ✅ **Fixed AI turn race condition** — `startAITurn()` now guards against `resetGame()` being called during the 400ms aim pause
- ✅ **Fixed pocket flash stacking** — multiple balls dropping into the same pocket now trigger only one flash (prevents opaque gold blob)
- ✅ **Fixed StatsPanel content overflow** — `max-height` increased from 420px to 520px so all stats rows are visible
- ✅ **Fixed "Turns:" label → "Shots:"** — accurately reflects that `totalTurns` counts shots, not turns
- ✅ **Fixed pocketRate cap** — capped at 100% display (previously could show 200%+ after multi-ball shots)

### v0.6.1 — "Stats & FX Bug-Fix Sweep"
- ✅ **Fixed pocketed balls lost across frames** — `turnPocketedIds` now accumulates all pocketed balls throughout a shot, preventing missed pockets when balls stop at different times
- ✅ **Fixed pocket flash wrong position** — `checkPockets()` now returns exact `pocketIndex`; flash spawns at the correct pocket instead of using post-removal ball position
- ✅ **Fixed double-counted ball collisions** — stats and sparks now use `ball.id < otherBall.id` deduplication (cannon-es fires collide on both bodies)
- ✅ **Fixed cue ball counted as pocketed** — filtered `id !== 0` from `recordPocket` so scratches no longer inflate pocket stats
- ✅ **Fixed collision sparks white** — each burst now picks a random color from the palette instead of defaulting to white
- ✅ **Fixed negative/NaN dt crash** — `ParticleSystem.update()` clamps `dt` to `[0, 0.05]` with finiteness check
- ✅ **Fixed StatsPanel null-reference crashes** — all public methods now guard against missing DOM elements
- ✅ **Fixed stale stats on new game** — `reset()` clears panel content and collapses it after every `resetGame()`
- ✅ **Fixed StatsPanel overlapping power bar** — toggle button moved to `bottom: 90px` to clear the power bar container
- ✅ **Added `user-select: none` to stats panel** — prevents accidental text selection during gameplay
- ✅ **Added input validation to StatsTracker** — rejects invalid `player` and `power` values with warnings
- ✅ **Removed unused `sizes`/`colors` arrays from ParticleSystem** — cleans dead allocation code

### v0.6.0 — "Stats & Visual FX Overhaul"
- **Match Statistics Tracker** — comprehensive stats: shots, pockets, fouls, scratches, power averages, streaks, collisions
- **Live Stats Panel** — collapsible bottom-right HUD showing real-time match data; auto-expands on game over with winner summary
- **Visual Particle Effects** — Three.js Points-based FX: chalk dust on cue hit, colorful sparks on ball-ball collisions, golden flash on pocketed balls

### v0.5.1 — "Final Polish"
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
