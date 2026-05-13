# 3D Billiards v1.2.0 — Latest Update

## What's New in v1.2.0

### Full Settings Panel — Sidebar + Cards Layout

A brand-new settings screen inspired by hanazargames.com, with a sidebar tab navigation and card-based controls:

- **Audio** — master sound toggle, master volume slider, music volume slider, SFX volume slider. All volumes are independently adjustable and persist across sessions.
- **Graphics** — trajectory prediction toggle, particle effects toggle, shot-trail toggle, quality preset (Low / Medium / High).
- **Gameplay** — default camera mode (Free / Top / Follow), auto-follow cue ball toggle.
- **Controls** — mouse sensitivity slider (0.5× – 2.0×), full key-bindings grid.
- **General** — one-click reset all settings to defaults.

Settings are persisted in `localStorage` via `SettingsStore`; every change dispatches a `settingsChanged` event so Game, Renderer, and AudioManager react instantly.

### In-Game Pause Menu

Press **ESC** (or click the ⚙️ gear in the top-right corner) during any match to open the pause overlay:

- **Resume** — instantly return to the match.
- **Settings** — opens a compact in-game settings panel with the most-used options (sound, volume, trajectory, trails, particles, quality, camera) without leaving the table.
- **Return to Main Menu** — cleanly disposes the current session and fades back to the menu.

The pause state freezes physics stepping and game logic; the 3D scene continues to render behind the translucent backdrop.

### Configurable Key Bindings

All 9 keyboard shortcuts are now editable from the Settings → Controls tab:

| Action | Default Key |
|--------|-------------|
| Free Camera | `1` |
| Top Camera | `2` |
| Follow Camera | `3` |
| High Spin (高杆) | `W` |
| Low Spin (低杆) | `S` |
| Left English (左塞) | `A` |
| Right English (右塞) | `D` |
| Reset Spin | `R` |
| Pause | `Esc` |

Click **修改** next to any action → the button turns gold and reads "按下新键…" → press any key → the new binding is saved immediately. Conflicting bindings are automatically swapped (the old owner is unbound). `KeyBindings` persists via `SettingsStore` and is shared across sessions.

### Camera & Input Improvements

- **Shift-release snap-to-view** — when you release Shift after adjusting the camera, the cue stick automatically re-aligns to the camera's current look direction. No more hunting for the mouse cursor to re-aim.
- **Trackpad two-finger pan** — while holding Shift, two-finger swipe on a Mac trackpad pans the camera (maps `wheel` events to `panCamera`). `OrbitControls` zoom is suppressed during Shift so the gesture feels native.
- **Mouse sensitivity** — a new slider in Settings → Controls scales camera pan, orbit, and wheel speed from 0.5× to 2.0×.

### Audio Volume Architecture

`AudioManager` now maintains three separate gain nodes:

- `_masterGain` — global on/off switch (`toggleSound`)
- `_bgmGain` — background-music volume (`setMusicVolume`)
- `_sfxGain` — sound-effects volume (`setSFXVolume`)

All BGM oscillators and noise floor route through `_bgmGain`; all SFX (cue hit, collision, cushion, pocket, win, foul) route through `_sfxGain`. This means you can mute music while keeping SFX loud, or vice-versa.

### Bug Fixes

- **SettingsScreen** — `_listeners` now stores the real event-handler references (was storing empty arrow functions), so `destroy()` correctly removes every listener.
- **KeyBindings.startListening()** — no longer uses `{ once: true }`. Modifier keys (Shift / Ctrl / Alt / Meta) are ignored without killing the listener, so you can hold Shift and then press your desired key.
- **KeyBindings** — now listens to `settingsChanged` and auto-reloads when the user hits "Reset All Settings".
- **Game.js spin controls** — restored missing `e.preventDefault()` calls so WASD keys don't scroll the page when used for spin.
- **UI.js in-game settings** — slider cards now correctly append the full control wrapper (including the value label), not just the inner track.
- **AudioManager.dispose()** — now nulls `_bgmGain` and `_sfxGain` alongside `_masterGain`.

---

## Previous Releases

<details>
<summary><strong>v1.1.0</strong> — Shot Impact FX, Audio Overhaul, Rule Fixes</summary>

### Shot Impact FX System — Feel Every Hit

A brand-new visual feedback layer makes every shot satisfying:

- **Impact Shockwave** — a translucent coloured ring blooms from the cue ball on impact. Gentle taps give a subtle teal ripple; power breaks explode with bold orange-red blasts.
- **Screen Shake** — the camera rattles perpendicular to the shot line, scaled by power. No more static camera on a hard break.
- **Power Label** — a large cinematic tier label flashes in the centre of the screen:
  - 0–22% → **轻推** (soft, teal)
  - 22–42% → **中力** (medium, green)
  - 42–62% → **重拳** (hard, orange)
  - 62–82% → **暴杆** (power, red)
  - 82–100% → **MAX** (gold)
- **Pocket Fountain** — when a ball drops, a short spray of coloured particles erupts from the pocket, tinted to match the ball (solids blue, stripes red, 8-ball black, 9-ball gold).

### Audio Lifecycle Overhaul

- **Single shared AudioManager** — MenuSystem and Game now share one instance. Previously each new game created a fresh AudioContext; after ~6 sessions Chrome would silently break all audio. That limit is now impossible to hit.
- **Smart BGM switching** — menu ambient drone fades out when entering a game/challenge and smoothly resumes on return.
- **Tab-switch resilience** — switching browser tabs auto-pauses BGM to save battery; returning auto-resumes if sound is enabled.
- **Browser autoplay policy** — global gesture listeners pre-unlock the AudioContext on first click/key/touch, so the first shot is never silent.
- **SFX rate-limiting** — collision and cushion sounds now have a 40 ms cooldown, preventing machine-gun distortion during break shots.

### Rule Engine Fixes

- **8-ball group assignment** — no longer assigns a group when the first hit is `null` (complete miss).
- **8-ball cleared-group check** — now counts balls pocketed on the current shot, fixing the false foul when the 7th group ball and 8-ball drop together.
- **9-ball foul tracking** — pocketed non-9 balls on a foul are no longer permanently retained; they are correctly spotted.
- **9-ball break validation** — added WPA 4-ball-to-rail rule. If fewer than 4 balls hit a rail on break (and nothing is pocketed), it's a foul.
- **NineBallRules.getStatus()** — no longer mutates `this.targetBall` as a side effect.

### Table Geometry Fixes

Fixed 10 overlapping/clipping geometry issues in `Table.js`:
- Slate edge no longer z-fights with playing surface
- Rail top inserts, round-overs, and bevels no longer clip into each other
- Apron trims and corner caps no longer overlap rails
- Pocket jaws, rings, drop cylinder, and cup no longer intersect cushions or each other

### UI/UX Hardening

- `UI.setMessage()` now uses a monotonic ID so stale timers can never clear newer messages.
- `UI.destroy()` properly removes all tracked event listeners (AI toggle, difficulty, trajectory, trail, sound).
- `SettingsScreen` now syncs its checkbox with the actual AudioManager state when opened.
- Menu navigation consistently hides all overlapping panels (`challengeResult` included).
- `_startMenuLoop()` deduplication prevents multiple concurrent render loops.

### Game State & Memory

- `resetGame()` now clears: challenge timeout, screen shake, camera mode, game start time, charging state, drag start, turn pocketed IDs, break-shot flag, and the challenge HUD.
- `dispose()` now: cancels active screen shake, disposes Cue geometries/materials, nulls `aiPlayer`, `recorder`, `challengeManager`, `statsTracker`, `onReturnToMenu`.
- Pocketed ball bodies are now removed from the physics world instead of being left at y = ‑1000.
- `confirmBallInHandPlacement()` now correctly clears `ballInHandBehindLine`.
- `updateBallInHandPreview()` now invalidates placement when the mouse leaves the table.

### Performance

- `updateDragPower()` no longer calls `getBoundingClientRect()` every frame — uses the cached rect.
- `ScreenShake` no longer allocates a `new THREE.Vector3()` per trigger or per update frame.
- `ImpactShockwave` uses `mesh.scale` instead of rebuilding RingGeometry every frame.

### Stability

- `GameLoop` now has an error boundary: catches exceptions in `update()`/`render()`, stops the loop after 3 consecutive errors instead of freezing forever.
</details>

<details>
<summary><strong>v1.0.0</strong> — Initial Release</summary>

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

### Performance & Deployment
- **GitHub Pages deployment fixed** — `base: '/Billiards/'` ensures asset URLs resolve correctly on subpath hosting.
- **Production build shrunk from 3.6MB → 760KB** by disabling sourcemaps and splitting vendor chunks (three.js / cannon-es load in parallel).
- **Cached canvas rect** — eliminated forced reflow from `getBoundingClientRect()` every frame.
- **Reused temp vectors** — removed per-frame `new THREE.Vector3()` allocation in aim direction update.
- **Removed redundant controls.enabled toggle** in follow-camera mode.
</details>

---

Run locally:

```bash
npm install
npm run dev
```

Then open `http://localhost:5173`.
