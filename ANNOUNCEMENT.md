# 3D Billiards v1.0.0 — Latest Update

3D Billiards v1.0.0 is the first full release of the browser-based pool game.

## What's New in This Update

### Intro / Loading Screen
- Full-screen animated loading screen on startup.
- Displays **Hanazar Products** → **Billiards** → **3D台球游戏** with elegant fade-in, gold divider, and glowing title.
- Live progress bar with bilingual loading text (English + 中文).
- Smooth opacity fade-out transition after all engine modules, audio, and menu UI are ready.

### Camera Controls Reworked
- **Shift + Left Click Drag** → Pan camera (平移视角)
- **Shift + Right Click Drag** → Orbit / rotate camera (旋转视角)
- Mouse Wheel → Zoom in/out
- InputHandler automatically suppresses game interaction while Shift is held, so camera controls never conflict with aiming or shooting.

### Refined Table Modeling
- **Cushion bevel faces** — sloped inner surfaces on every cushion, matching real rubber cushion geometry.
- **Pocket leather nets** — 5-layer alternating ring chains below each pocket mouth.
- **Pocket leather facings** — wide leather rings around pocket mouths.
- **Slate bed edge** — exposed grey stone perimeter under the cloth.
- **Rail top round-overs** — half-round tubes on rail outer edges.
- **Apron corner brackets** — cast-metal L-plates with bolt heads.

### Visual Polish
- **Table lights raised** from y=178 to y=235 for a taller, more dramatic room feel.
- **Lamp view-occlusion fade** — lights automatically fade to ~18% opacity when they sit between the camera and the table.
- **Cue anti-clipping** — when the cue ball is near a rail, the cue stick pullback is clamped so the butt never clips through the table frame.

### Physics Tuning
- Rolling resistance lowered from 55 to 22 cm/s² for more realistic ball roll distances.
- Linear and angular damping reduced so balls coast longer.
- Fixed "spinning in place after stop" — added cloth-friction angular decay when speed drops near zero.
- Roll coupling no longer re-accelerates a nearly-stopped ball from dead rest.

### Rule Fixes
- 8-ball break scratch + 8-ball pocketed → 8-ball is now correctly respotted.
- 8-ball win/loss check now happens after all foul checks are fully resolved.
- 9-ball foul branches now correctly remove the 9-ball from `pocketedBalls` before tracking.
- Achievement and challenge counters now use `effectivePocketedIds` (respotted balls excluded).
- AI now respects `ballInHandBehindLine` when placing the cue ball.
- AI now generates random cue-tip spin offsets based on difficulty.

### Stability
- `Game.dispose()` now properly removes cue-tip picker pointer listeners and ball `collide` listeners.
- `UI.setMessage()` timer leak fixed — old timers are cleared before new ones are set.
- `MenuSystem._quit()` now stops replay timeouts, sets state to `DESTROYED`, and cleans up physics/audio.

Run locally:

```bash
npm install
npm run dev
```

Then open `http://localhost:5173`.
