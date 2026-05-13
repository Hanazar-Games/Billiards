# 3D Billiards v1.2.3 — Latest Update

## What's New in v1.2.3

### Gameplay & Rules Overhaul

A full audit of game rules, AI behavior, and core mechanics uncovered and fixed **15+ issues** — from silent broken features to rule violations.

### Critical Fixes

| # | File | Issue |
|---|------|-------|
| 1 | `Game.js` | **Pocket FX/achievements/replay completely broken** — `isFirstTime` was always `false` because IDs were pre-added to `turnPocketedIds` in an accumulation loop, causing the visual FX loop to skip every ball. **Result:** no pocket flash, no fountain particles, no floating text (`+1`, `🎱 8号球!`), no achievement triggers, no replay pocket recording |
| 2 | `InputHandler.js` | **Soft-lock in CHARGING state** — releasing the mouse over a UI button (e.g., "Concede", "Settings") swallowed the `mouseup` event. `Game.state` remained `CHARGING` forever with no recovery. **Fix:** always notify game of mouse-up; added `Escape` key to cancel charging and ball-in-hand preview |
| 3 | `NineBallRules.js` | **9-ball mode broken after 1st ball pocketed** — `targetBall` was initialized to `1` and `setTargetBall()` was **never called anywhere in the codebase**. Every post-break shot validated against ball 1, so hitting the 2-ball (or any higher) first was incorrectly flagged as a foul |
| 4 | `NineBallRules.js` | **4-ball-to-rail break rule was dead code** — an early `return` at `pocketedIds.length === 0` made the rail-check branch unreachable. Dry breaks with <4 balls to rails were treated as legal |
| 5 | `NineBallRules.js` | **Foul shots did not track pocketed object balls** — the code skipped `trackPocketedBalls()` on foul, with a comment claiming "object balls are spotted on foul" (wrong for 9-ball). Pocketed balls vanished from game state, desynchronizing the table |
| 6 | `Rules.js` (8-ball) | **Illegal break not detected** — no 4-object-ball-to-cushion check on break. A break where nothing is pocketed and only 1–3 balls touch a cushion was treated as legal |
| 7 | `Rules.js` (8-ball) | **Mixed solid+stripe on open table incorrectly assigned group** — WPA Rule 3.9: pocketing both a solid and stripe on the same shot keeps the table open. The code used only `pocketedIds[0]` to determine group, ignoring mixed pockets |

### AI Improvements

| # | File | Change |
|---|------|--------|
| 8 | `AIPlayer.js` | **"Miss" mechanic reworked** — instead of abandoning the best shot for a completely random (often suicidal) alternative, the AI now **perturbs the best shot's angle and power** by a small noise amount. Looks humanly imperfect rather than intentionally stupid |
| 9 | `AIPlayer.js` | **Strategic spin for HARD difficulty** — no longer pure random spin. Hard AI now uses: **draw** (bottom spin) on powerful shots to control cue ball, **follow** (top spin) on soft shots for gentle roll, and tiny side spin on desperate shots to avoid straight-in scratches |
| 10 | `AIPlayer.js` | **Safety play enabled** — the previously-unused `safetyAwareness` setting is now active. When the best shot has a low score (<60) and safety awareness triggers, the AI plays a safety instead of a desperation shot |

### Gameplay Polish

| # | File | Change |
|---|------|--------|
| 11 | `Game.js` | **Physics safety timeout** — if balls somehow never reach zero velocity (floating-point edge case), the shot is force-resolved after **20 seconds** instead of soft-locking forever |
| 12 | `Game.js` | **Head-string placement fixed** — `isCueBallPlacementLegal` now correctly rejects positions past the head string (`z > headStringZ`). Previously it allowed half a ball radius past the line, giving the player an unfair advantage |
| 13 | `Game.js` | **Auto-follow camera switches back** — after a shot resolves, if `autoFollowCueBall` is enabled, the camera returns to the user's default camera mode (free/top) instead of staying stuck in follow mode |
| 14 | `Game.js` | **Game-over UI now updates stats** — `_updatePlayerStats()` is called when the game ends so the bottom HUD shows final remaining-ball counts |
| 15 | `Rules.js` / `NineBallRules.js` | **Distinct ball tracking for break rails** — `breakRailContacts` is now a `Set` of ball IDs instead of a raw counter, correctly implementing the "4 distinct object balls" requirement |

---

## Previous Releases

<details>
<summary><strong>v1.2.2</strong> — Cue Themes + Deep Bug-Fix Audit</summary>

### Cue Stick Themes

The cue stick is no longer locked to a single wood finish. Six distinct colorways are now available in **Settings → Gameplay → 球杆皮肤**:

| Theme | Style | Description |
|-------|-------|-------------|
| **经典木** (default) | Warm maple | Traditional tournament cue — light shaft, dark wrap, brass rings |
| **黑檀木** | Stealth black | Matte black shaft with graphite accents and silver hardware |
| **冰蓝** | Cool blue | Icy blue taper with navy wrap and chrome rings |
| **赤焰** | Crimson red | Rich red wrap on a warm maple base, copper rings |
| **翡翠** | Emerald green | Forest-green wrap with sage shaft and gold hardware |
| **鎏金** | Liquid gold | Golden shaft with dark wrap and bright gold rings |

Selection applies **instantly** — no restart required. The theme persists across sessions via `SettingsStore`.

### Bug Fixes & Hardening (Deep Audit Round 2)

A second full-system audit uncovered and fixed **16 issues** across UI/UX, audio, memory, and visual state:

| # | File | Issue | Severity |
|---|------|-------|----------|
| 1 | `SettingsScreen.js` | `_rowSelect` pill buttons never updated visual `active` state after click — quality, camera, and cue-theme selectors appeared broken | 🔴 Critical |
| 2 | `MenuSystem.js` | `_startChallenge()` did not pass `this.audio` to `Game`, causing challenge mode to create an orphan `AudioManager`. After ~6 challenges the browser exhausts its `AudioContext` limit and all audio permanently dies | 🔴 Critical |
| 3 | `SettingsScreen.js` | `destroy()` never cleared `_tabEls` Map, retaining 6 complete DOM subtrees and preventing garbage collection | 🟠 High |
| 4 | `UI.js` | `destroy()` did not clear `_pauseHideTimer` or `_settingsHideTimer`; stale timeouts could fire after UI destruction | 🟠 High |
| 5 | `MainMenuScreen.js` | `hide()` timeout accessed `this.container.style` without null-checking — threw if `destroy()` was called during the 400 ms fade | 🟠 High |
| 6 | `MainMenuScreen.js` | `_fadeOut()` timeout did not guard `this.container`; callback could execute against destroyed state | 🟠 High |
| 7 | `Game.js` | `resetGame()` removed balls from physics world but **never removed** their `collide` event listeners, leaking closures over `this.audio` on every reset | 🟠 High |
| 8 | `Minimap.js` | No `resize` or DPR-change listener — minimap became pixelated or incorrectly sized after window resize | 🟠 High |
| 9 | `MenuSystem.js` | Async transition methods (`_startGame`, `_startChallenge`) did not re-check `this.state` after `await _delay()`, allowing stale callbacks to overwrite a newer state | 🟠 High |
| 10 | `UI.js` | `showFloatingText()` timeouts were untracked; rapid pocket events accumulated leaked closures and detached DOM nodes | 🟡 Medium |
| 11 | `SettingsScreen.js` | `_toast()` used untracked nested timeouts; toasts could remain in DOM after screen destruction | 🟡 Medium |
| 12 | `SettingsScreen.js` | `hide()` timeout was untracked; rapid show/hide toggles queued overlapping timers | 🟡 Medium |
| 13 | `MenuSystem.js` | `_quit()` did not nullify `this.mainMenu` / `this.settingsScreen` after `destroy()`, compounding memory leaks | 🟡 Medium |
| 14 | `index.html` | `<html lang="en">` contradicted the Chinese UI; screen readers mispronounced content | 🟡 Medium |
| 15 | `index.html` | `mask-image` lacked `-webkit-mask-image` prefix — Safari rendered the decorative grid overlay fully opaque instead of fading | 🟡 Medium |
| 16 | `UI.js` | `_flashTimer` was not initialized in the constructor, creating an implicit global on first `flashRed()` call | 🟢 Low |
</details>

<details>
<summary><strong>v1.2.1</strong> — Animation Sync, Error Modal, Strike Snap, Foul Flash, Floating Text, Minimap</summary>

### Global Animation Speed Control

Every animation and transition in the game is now wired to the **UI Animation Speed** slider in Settings → Controls → Effects & UI:

- **CSS animations/transitions** — intro screen, menu buttons, player badges, settings panel, error modal, floating text, pause overlay, and all inline `style.cssText` transitions use `calc(duration / var(--ui-anim-speed))`
- **JS timeouts** — toast dismissal, menu fade-outs, replay auto-stop, strike-hide delay, floating-text removal, and all `setTimeout` calls scale via the new `animMs()` utility
- **New `src/core/AnimSpeed.js`** — centralized `animMs(baseMs)`, `animSec(baseSec)`, and `syncAnimSpeedCss()` with automatic `settingsChanged` listener

### Pre-Load Error Modal

If anything goes wrong during game initialization, a full-screen error modal now appears instead of a tiny text dump:

- **Centered dark card** with red border, backdrop blur, and slide-in animation
- **Loading phase tracker** — shows exactly which boot phase failed (`core-modules`, `engine-init`, `menu-build`, `finalize`)
- **Timestamped error blocks** — each error gets its own block with time, phase, message, source file, and line number
- **HTML-safe rendering** — all error text is escaped; no XSS injection from crafted error messages
- **🔄 Reload button** + close button at the bottom
- **Global `error` / `unhandledrejection` listeners** also upgraded to the same modal format, with circular-reference guards for promise rejections

### Cue Strike Animation

When you shoot, the cue stick no longer vanishes instantly. It now **snaps forward so the tip touches the ball surface** for ~70 ms, then hides. This gives a visceral "hit" frame that makes power shots feel significantly more satisfying.

### Foul Red Flash

Scratch or foul? The entire screen now pulses with a **brief radial red vignette** — instant visual feedback that something went wrong, independent of the audio cue.

### Pocket Floating Text

Every pocketed ball spawns a **floating score label** above the pocket:

- Normal balls: `+{number}` in gold
- 8-ball: `🎱 8号球!` in white
- Cue ball (scratch): `⚠️ 白球` in red

Text rises, scales up slightly, then fades and shrinks over ~1.2 s.

### Real-Time Minimap

A 220×120 table minimap appears in the bottom-right corner during gameplay:

- **Ball dots** colored by type (solids / stripes / 8-ball / cue ball)
- **Pocket markers** with brief white flash on score
- **White-ball trail** showing recent movement path
- Toggle, size, and opacity controls in Settings → Gameplay

### Bug Fixes (Deep Audit Round 1)

A full-system audit uncovered and fixed **15+ issues**:

| # | File | Issue |
|---|------|-------|
| 1 | `Renderer.js` | `panCamera` double-applied `mouseSensitivity` — pan speed scaled with the square of the slider |
| 2 | `Renderer.js` | Shift + vertical two-finger trackpad pan was broken (`isMouseWheel` check ran before the Shift branch) |
| 3 | `Ball.js` | `applyImpulse` passed **world coordinates** (`this.body.position`) as the hit point instead of body-relative `(0,0,0)`, injecting a massive, position-dependent torque on every shot |
| 4 | `ScreenShake.js` | Overlapping triggers permanently baked old offset into camera position, causing infinite drift on rapid shots |
| 5 | `AudioManager.js` | `toggleSound(true)` reset master gain to `1.0`, discarding the user's master-volume slider value |
| 6 | `AudioManager.js` | Every one-shot SFX (cue hit, collision, cushion, pocket, win, foul) created Oscillator/BufferSource nodes that were **never disconnected** — native audio node leak over long sessions |
| 7 | `UI.js` | `flashRed()` overlapping timers caused premature fade-out on rapid fouls |
| 8 | `UI.js` | `destroy()` did not clean up floating-text DOM nodes or pending flash timeout |
| 9 | `SettingsScreen.js` | `_createSlider` had an untracked `input` listener, leaking through tab switches |
| 10 | `SettingsScreen.js` | `_toast` fade-out transition was hardcoded `0.3s`, out of sync with `animMs(300)` |
| 11 | `Game.js` | `shoot()` strike-hide timeout could crash if `Game.dispose()` was called within 70 ms |
| 12 | `Game.js` | Pocket visual FX (particles + floating text) could spawn **twice** for the same ball across consecutive physics frames |
| 13 | `Game.js` | Floating text allocated a new `THREE.Vector3()` every pocketed ball per frame |
| 14 | `MainMenuScreen.js` | `hide()` used hardcoded `400 ms` and CSS `transform 0.35s` ignored animation speed |
| 15 | `MenuSystem.js` | Menu fade-outs used hardcoded `0.5s` transitions and `500 ms` delays |

### GitHub Pages 404 Fix

- `.github/workflows/deploy.yml` now declares `permissions: contents: write` (GitHub tightened default token permissions)
- Build step now copies `dist/index.html` → `dist/404.html` so GitHub Pages serves the SPA fallback on any unknown subpath
</details>

<details>
<summary><strong>v1.2.0</strong> — Settings Overhaul, Pause Menu, Key Bindings</summary>

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
</details>

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
