# 3D Billiards v1.3.9 — Latest Update

## What's New in v1.3.9

### 🏆 本地比赛模式 — Local Match Mode

A new **tournament-style local 2-player mode** that elevates casual local play into a proper match experience.

| # | Feature | Detail |
|---|---------|--------|
| 1 | **Player names** | Both players can enter custom names (max 12 chars) before the match starts |
| 2 | **Game mode selection** | Choose between **8-ball** (standard group clearing) or **9-ball** (diamond rack, hit lowest first) |
| 3 | **Match formats** | **单局决胜** (1 game) / **三局两胜** (best of 3) / **五局三胜** (best of 5) |
| 4 | **Live score HUD** | Bottom center HUD shows real-time score: `PlayerA 2 : 1 PlayerB  ·  第 3/5 局` |
| 5 | **Match end flow** | When a game ends, the screen shows the current series score with a **"下一局"** button; when the match is decided, a **"返回菜单"** button appears with the final result |

### New Files

| File | Purpose |
|------|---------|
| `src/menu/MatchSetupPanel.js` | Pre-match configuration UI — name inputs, mode pills, format pills, start/cancel buttons |
| `src/core/MatchEngine.js` | Lightweight tournament tracker — score counting, wins-needed logic, match-over detection |

### Modified Files

| File | Change |
|------|--------|
| `MainMenuScreen.js` | Added **"本地比赛"** button between "本地双人对战" and "对战 AI" |
| `MenuSystem.js` | Integrated match lifecycle: `_showMatchSetup()` → `_startMatchGame()` → `_onMatchGameEnd()` → `_restartMatchRound()` or `_returnToMenu()` |
| `Game.js` | Added `setMatchMode()`; match-end delegates to `onMatchGameEnd` callback instead of local reset; per-frame HUD score sync |
| `UI.js` | Added `_hudScore` element in bottom HUD; new `setMatchScore()` API; `showResetButton()` accepts optional label param |

---

## Previous Releases

<details>
<summary><strong>v1.3.8</strong> — Deep UI/UX/SFX/BGM Bug Audit</summary>

### Deep UI/UX/SFX/BGM Bug Audit — Network, Audio, Serialization & Memory

A seventh-round deep audit uncovered **12 issues** spanning the new LAN multiplayer module, audio lifecycle, network serialization, and memory hygiene.

### LAN Multiplayer & Network Fixes

| # | File | Issue | Fix |
|---|------|-------|-----|
| 1 | `Game.js` | **Network listener leak on dispose** — `setNetworkController()` added anonymous arrow functions as `addEventListener` callbacks for `stateSnapshot` / `shotInput` / `pocketEvent`; `dispose()` never removed them, trapping the entire Game instance in closure memory | Refactored to named methods (`_onStateSnapshot`, `_onNetShotInput`, `_onNetPocketEvent`) and explicitly `removeEventListener` in `dispose()` |
| 2 | `Game.js` | **Network disconnect unhandled** — if the WebSocket dropped during a match, the client/host had no feedback and the game simply froze | Added `_onNetDisconnected` handler that shows a toast and auto-returns to the main menu after 3 seconds; timer is cleared in `dispose()` |
| 3 | `Game.js` | **Host could concede in LAN** — `_concede()` only blocked the client; the host could still click "认输", leaving guests in a broken state | Changed guard from `networkRole === 'client'` to `networkMode` so **both** host and client are blocked |
| 4 | `Game.js` | **Remote reset bypassed cleanup** — `applyRemoteShot()` called `this.resetGame()` directly when `requestReset` was true, skipping `_cleanupAfterShot()` and state guards | Routed through `this._onResetButtonClicked()` |
| 5 | `server/lan-server.js` | **JSON.parse non-object crash** — `JSON.parse("null")` passed silently, then `const { type } = data` destructured `null` and threw | Added `if (!data || typeof data !== 'object')` guard before destructuring |
| 6 | `server/lan-server.js` | **Dead code** — `closeWithError()` was defined but never called anywhere | Removed unused function |

### Audio & SFX Fixes

| # | File | Issue | Fix |
|---|------|-------|-----|
| 7 | `AudioManager.js` | **BGM wrongly restarts after tab switch** — `stopBGM()` preserved `_bgmWasPlaying` for `visibilitychange`, but MenuSystem's game-entry `stopBGM()` was indistinguishable from a temporary pause; switching tabs after entering a game could resurrect BGM | Added `preserveFlag` parameter to `stopBGM()`; MenuSystem now calls `stopBGM(false)` when entering a game/challenge, explicitly clearing the flag |
| 8 | `AudioManager.js` | **Fallback disconnect after dispose** — `_autoDisconnect()` used a 5-second `setTimeout` fallback for nodes without `onended`; if `dispose()` was called in between, the callback tried to disconnect nodes on a closed AudioContext | Added `if (!this.ctx) return` guard inside the fallback callback |

### Serialization & UI Fixes

| # | File | Issue | Fix |
|---|------|-------|-----|
| 9 | `GameStateSerializer.js` | **angularVelocity never synced** — ball rotation state was missing from snapshots; client-side balls visually spun incorrectly because angular velocity was never restored | Added `avx` / `avy` / `avz` to `serializeGameState()` and `applyGameState()` |
| 10 | `UI.js` | **`_lastMessage` missing** — `GameStateSerializer` referenced `game.ui._lastMessage` to avoid duplicate message updates, but the field did not exist in `UI.js` | Added `_lastMessage` tracking in `setMessage()` and cleanup in `destroy()` |
| 11 | `UI.js` | **`_onInGameSettingsClose` leak** — the callback reference was not nulled in `destroy()` | Added `this._onInGameSettingsClose = null` in `destroy()` |

### MenuSystem Fixes

| # | File | Issue | Fix |
|---|------|-------|-----|
| 12 | `MenuSystem.js` | **`_delayTimer` leak on quit** — `_quit()` cleared `_replayCompleteTimeout` but not `_delayTimer`, so a pending menu-transition timeout could fire after destruction | Added `clearTimeout(this._delayTimer)` in `_quit()` |

---

## Previous Releases

<details>
<summary><strong>v1.3.6</strong> — LAN Multiplayer Room</summary>

### LAN Multiplayer Room — Local Network 2-Player 8-Ball

A complete host-authoritative multiplayer prototype for playing 8-ball over the same Wi-Fi / LAN.

| # | Feature | Detail |
|---|---------|--------|
| 1 | **Create Room** | Host clicks "局域网联机" → "创建房间" → 4-6 char alphanumeric room ID is generated |
| 2 | **Join Room** | Guest enters room ID and clicks "加入房间" |
| 3 | **Host-Authoritative Sync** | Host runs full physics + rules; clients render snapshots at ~20 Hz |
| 4 | **Shot Relay** | When it's your turn, aim and shoot normally — `shotInput` is sent to host, host executes the physics shot, then broadcasts the resulting state |
| 5 | **Client-Side Prediction** | Client immediately enters `SHOOTING` state and hides the cue; visual ball positions are overwritten by host snapshots as they arrive |
| 6 | **Turn Enforcement** | Only the current player's client accepts mouse input; others are ignored |

### New Files

| File | Purpose |
|------|---------|
| `server/lan-server.js` | Node.js WebSocket relay — creates/joins rooms, forwards messages, enforces host-only broadcasts |
| `src/net/NetworkClient.js` | Frontend WebSocket client — EventTarget API, auto-reconnects, handles all message types |
| `src/net/GameStateSerializer.js` | Serializes ball positions/velocities/quaternions, rules state, and UI info into compact snapshots |
| `src/menu/LanRoomPanel.js` | In-menu room UI — create/join buttons, player list, room ID display, start-game button |

### Modified Files (Minimal Intrusion)

| File | Change |
|------|--------|
| `Game.js` | Added `networkMode`/`networkRole`/`localPlayerId`; `setNetworkController()` wires snapshot/shotInput listeners; `shoot()` sends `shotInput` on client; `update()` skips physics/rules on client; `resolveTurn()` broadcasts final state from host |
| `MenuSystem.js` | `_startGame()` accepts optional `networkClient/role/localPlayerId`; GameLoop skips `physics.step()` for client; added `_showLanRoom()` and `_startNetworkGame()` |
| `MainMenuScreen.js` | Added "局域网联机" button with callback |
| `package.json` | Added `"host": "node server/lan-server.js"` script; added `ws` dependency |
| `README.md` | Added LAN multiplayer setup instructions |
</details>

<details>
<summary><strong>v1.3.5</strong> — Comprehensive Bug Audit & Hardening</summary>

### Comprehensive Bug Audit & Hardening — Memory, Physics, Camera, AI

A full-system fifth-round audit fixed **9 critical issues** spanning memory leaks, physics lifecycle, camera state, and build consistency.

### Critical Memory & Lifecycle Fixes

| # | File | Issue | Fix |
|---|------|-------|-----|
| 1 | `Game.js` | **Dispose order crash** — `physics.removeBody()` was called before `removeEventListener('collide')`, causing cannon-es to dereference freed bodies | Reordered: remove listeners **first**, then destroy bodies |
| 2 | `Cue.js` | **Geometry/material leak on reset** — cue-stick mesh segments were never disposed, leaking GPU memory every `resetGame()` | Added `dispose()` that traverses and releases all child geometries/materials |
| 3 | `BallsManager.js` | **Double-add physics body** — `resetCueBallIfPocketed()` unconditionally called `this.physics.addBody(cue.body)` even when the body was still in the world | Now safely checks state before re-adding; prevents cannon-es assertion failures |
| 4 | `Table.js` | **Null-physics crash on dispose** — `dispose()` threw if `this.physics` was already nulled (double-dispose or error path) | Added `if (this.physics)` guard before iterating bodies |

### Camera & AI Fixes

| # | File | Issue | Fix |
|---|------|-------|-----|
| 5 | `Renderer.js` | **Double camera reset on boot** — constructor called `_resetCameraFree()` and then `Game.init()` called it again, causing a jarring position snap | Removed duplicate initialization; camera is set once in the constructor |
| 6 | `Game.js` | **Follow camera broken** — `defaultCamera === 'follow'` had no reset path in `resetGame()` or settings change | Added `_resetCameraFollow()`; wired into `resetGame()`, `_applySettings()`, and `_handleSettingsChange()` |
| 7 | `AIPlayer.js` | **Runtime ReferenceError** — `SHOT.minPower` / `SHOT.maxPower` were used but `SHOT` was never imported | Added missing `import { SHOT } from '../config.js';` |
| 8 | `Room.js` | **Variable shadowing in lamp opacity** — `updateLampOpacity()` mixed `camera.position` and a local `camPos`, causing NaN or wrong opacity calculations | Unified all references to the single `camPos` parameter |

### Build Consistency

| # | File | Fix |
|---|------|-----|
| 9 | `index.html` / `MainMenuScreen.js` / `README.md` / `SettingsScreen.js` / `ANNOUNCEMENT.md` | All hard-coded version strings bumped to **v1.3.5** |
</details>

<details>
<summary><strong>v1.3.4</strong> — Camera Default View & Wall Safety Margin</summary>

### Camera Default View & Wall Safety Margin

| # | Change | Detail |
|---|--------|--------|
| 1 | **Default camera position** | Free-camera initial position moved to `(140, 180, 100)` — a dramatic side-above angle that showcases the table and room on first load |
| 2 | **Wall safety margin** | `_clampCameraToRoom()` now uses `wallMargin = 25` so the camera never clips inside the walls |
</details>

<details>
<summary><strong>v1.3.0</strong> — Lighting Detail: Suspension Rods & Plaque Spotlight</summary>

### Lighting Detail — Suspension Rods & Plaque Spotlight

| # | Change | Detail |
|---|--------|--------|
| 1 | **Table lights now hang from ceiling** | Three brushed-metal suspension rods (`0x8a7a68`, `metalness: 0.65`) connect the crossbar directly to the ceiling, eliminating the floating-lamp look |
| 2 | **Dedicated plaque spotlight** | A warm `SpotLight(0xffeedd, 1.0, 260)` is mounted above the table and aimed at the "厚德载物" plaque on the back wall, making the calligraphy stand out even under dim ambient conditions |
</details>

<details>
<summary><strong>v1.2.9</strong> — Full Room Redecoration: Beige Theme, Carpet Floor, Calligraphy Plaque</summary>

### Full Room Redecoration — Beige Theme, Carpet Floor, Calligraphy Plaque

The billiard hall has been completely redecorated into a warm, inviting beige-toned space:

| # | Change | Detail |
|---|--------|--------|
| 1 | **Walls → warm beige** | Colour changed from brown `#3d3028` → cream `#f5e6c8`; wainscot, chair-rail, and baseboard all harmonised in matching beige tones |
| 2 | **Ceiling → warm beige** | Colour `#2a2520` → `#f5e6c8`, emissive removed — now reads as a real surface |
| 3 | **Floor → carpet** | Deep grey `#141414` replaced by soft beige `#e0d5c0` with `roughness: 0.92` for a plush carpet feel; grid lines recoloured to subtle `#d4c8b0` |
| 4 | **Paintings removed** | All 5 landscape paintings on front/back/side walls removed per design direction |
| 5 | **"厚德载物" plaque enhanced** | Canvas resolution doubled (512×128 → 1024×256); multi-layer brush rendering with ink-wash shadow, gold body, dark core, fly-white (飞白) streaks, ink splatter, and a red seal stamp — much closer to real brush calligraphy |
| 6 | **Lighting tuned for light walls** | Ambient / main / fill / rim all softened to prevent over-exposure on the highly reflective beige surfaces |
</details>

<details>
<summary><strong>v1.2.8</strong> — Room Remodeling: Lower Walls, Brighter Lighting, Visible Ceiling</summary>

The billiard hall has been completely redecorated into a warm, inviting beige-toned space:

| # | Change | Detail |
|---|--------|--------|
| 1 | **Walls → warm beige** | Colour changed from brown `#3d3028` → cream `#f5e6c8`; wainscot, chair-rail, and baseboard all harmonised in matching beige tones |
| 2 | **Ceiling → warm beige** | Colour `#2a2520` → `#f5e6c8`, emissive removed — now reads as a real surface |
| 3 | **Floor → carpet** | Deep grey `#141414` replaced by soft beige `#e0d5c0` with `roughness: 0.92` for a plush carpet feel; grid lines recoloured to subtle `#d4c8b0` |
| 4 | **Paintings removed** | All 5 landscape paintings on front/back/side walls removed per design direction |
| 5 | **"厚德载物" plaque enhanced** | Canvas resolution doubled (512×128 → 1024×256); multi-layer brush rendering with ink-wash shadow, gold body, dark core, fly-white (飞白) streaks, ink splatter, and a red seal stamp — much closer to real brush calligraphy |
| 6 | **Lighting tuned for light walls** | Ambient / main / fill / rim all softened to prevent over-exposure on the highly reflective beige surfaces |

---

## Previous Releases

<details>
<summary><strong>v1.2.8</strong> — Room Remodeling: Lower Walls, Brighter Lighting, Visible Ceiling</summary>

### Room Remodeling — Lower Walls, Brighter Lighting, Visible Ceiling

A complete overhaul of the billiard room's vertical proportions and lighting to eliminate the dark void above the walls and bring the space into a warm, inviting scale.

| # | Change | Detail |
|---|--------|--------|
| 1 | **Wall height lowered** | `ROOM.wallHeight` reduced from **280 → 160**. The back wall, side walls, and all attached trims now end much closer to the table, giving the room a cosy, intimate billiard-hall feel instead of a cavernous void |
| 2 | **Ceiling now visible** | The ceiling plane drops with the walls to **y = 160** and its colour is lightened from `#1a1a1a` → `#2a2520` with a subtle emissive wash (`0.15`), so it actually reads as a surface rather than disappearing into blackness |
| 3 | **12 recessed downlights added** | A 3×4 grid of warm `PointLight(0xffe8c8, 0.35, 280)` is embedded in the ceiling, providing soft fill that bounces off walls and eliminates the previous pitch-black corners |
| 4 | **Wall material brightened** | Wall colour shifted from `#2e231c` → `#3d3028` so the warm brown is visible under the new lighting instead of reading as near-black |
| 5 | **Decor repositioned** | All 5 landscape paintings, the "厚德载物" plaque, and the 3 table lamps are shifted down proportionally to match the new wall height |
| 6 | **Global lighting boosted** | Renderer ambient light **0.26 → 0.55**, main directional **1.65 → 2.0**, fill **0.22 → 0.35**, rim **0.38 → 0.5** |
| 7 | **Camera vertical range tightened** | `ROOM.maxCameraY` lowered from **340 → 220** to match the new room height and prevent the camera from floating above the ceiling |
</details>

<details>
<summary><strong>v1.2.7</strong> — Comprehensive Deep Audit & Polish</summary>

### Comprehensive Deep Audit — 15+ Fixes Across All Systems

A complete overhaul of the billiard room's vertical proportions and lighting to eliminate the dark void above the walls and bring the space into a warm, inviting scale.

| # | Change | Detail |
|---|--------|--------|
| 1 | **Wall height lowered** | `ROOM.wallHeight` reduced from **280 → 160**. The back wall, side walls, and all attached trims now end much closer to the table, giving the room a cosy, intimate billiard-hall feel instead of a cavernous void |
| 2 | **Ceiling now visible** | The ceiling plane drops with the walls to **y = 160** and its colour is lightened from `#1a1a1a` → `#2a2520` with a subtle emissive wash (`0.15`), so it actually reads as a surface rather than disappearing into blackness |
| 3 | **12 recessed downlights added** | A 3×4 grid of warm `PointLight(0xffe8c8, 0.35, 280)` is embedded in the ceiling, providing soft fill that bounces off walls and eliminates the previous pitch-black corners |
| 4 | **Wall material brightened** | Wall colour shifted from `#2e231c` → `#3d3028` so the warm brown is visible under the new lighting instead of reading as near-black |
| 5 | **Decor repositioned** | All 5 landscape paintings, the "厚德载物" plaque, and the 3 table lamps are shifted down proportionally to match the new wall height |
| 6 | **Global lighting boosted** | Renderer ambient light **0.26 → 0.55**, main directional **1.65 → 2.0**, fill **0.22 → 0.35**, rim **0.38 → 0.5** |
| 7 | **Camera vertical range tightened** | `ROOM.maxCameraY` lowered from **340 → 220** to match the new room height and prevent the camera from floating above the ceiling |

---

## Previous Releases

<details>
<summary><strong>v1.2.7</strong> — Comprehensive Deep Audit & Polish</summary>

### Comprehensive Deep Audit — 15+ Fixes Across All Systems

A full-system fourth-round audit uncovered and fixed **15+ issues** spanning gameplay rules, audio lifecycle, UI/UX state management, physics, and the new Ball Return System.

### Critical Gameplay Fixes

| # | File | Issue | Fix |
|---|------|-------|-----|
| 1 | `NineBallRules.js` | **Illegal break (4-ball-to-rail) was dead code** — when nothing was pocketed on break, the function returned early at line 164, making the WPA 4-ball rule unreachable | Moved the rail-check **before** the "no balls pocketed" return so dry breaks with <4 rail contacts are correctly flagged as fouls |
| 2 | `ChallengeManager.js` | **`resetMatch()` never reset `completed`/`failed`** — after finishing a challenge and clicking "New Game", those flags stayed `true`, causing `Game.update()` to schedule `onReturnToMenu()` ~2 s after every reset | `completed` and `failed` are now reset inside `_resetMatch()` |
| 3 | `Game.js` | **`this.achievements` was never initialized** — `AchievementSystem` was constructed in `MenuSystem` but never injected into `Game`, so all achievement calls in `Game` were no-ops | `new AchievementSystem()` is now created in `Game.init()` |
| 4 | `BallsManager.js` | **9-ball mode leaked 6 dormant physics bodies** — balls 10‑15 were marked `pocketed` and teleported to `y=-1000`, but `addToScene()` unconditionally added every body to the physics world | `addToScene()` now skips `ball.pocketed` balls |

### Critical Audio & UI Fixes

| # | File | Issue | Fix |
|---|------|-------|-----|
| 5 | `AudioManager.js` | **`toggleSound(true)` unconditionally started BGM** — toggling sound ON from the in-game settings panel triggered the menu ambient drone inside active gameplay | `toggleSound()` now **only** controls the master gain node; BGM start/stop is left to the caller (`MenuSystem`) |
| 6 | `MenuSystem.js` | **`_delay()` timeouts were untracked and uncancellable** — if `_quit()` was called while `_startGame()` or `_startChallenge()` awaited a fade delay, the timeout continued and the async method resumed after destruction | `_delay()` now stores its timer in `this._delayTimer`; `_quit()` clears it |
| 7 | `MenuSystem.js` | **Challenge result never restored `menu-layer`** — `_startChallenge()` hid `menu-layer`, but `_stopChallenge()` never showed it again, leaving the main-menu container invisible if the user eventually returned to it | `_stopChallenge()` now restores `menu-layer` to `display: flex; opacity: 1` |
| 8 | `AchievementPanel.js` | **Toast timers were completely untracked** — `showToast()` used raw `setTimeout` (2 per toast); rapid unlocks or `destroy()` during animation leaked detached DOM nodes | Added `_toastTimers[]`; both dismiss and remove timers are tracked and cleared in `destroy()` |
| 9 | `SettingsScreen.js` | **`_toast()` `removeTimer` was never tracked** — the inner 300 ms removal timeout was created but never pushed to `_toastTimers`, so `destroy()` could not cancel it | `removeTimer` is now pushed to `_toastTimers` and the fade timer is correctly removed from the array when fired |
| 10 | `Renderer.js` | **Wheel listener removal mismatch** — `addEventListener('wheel', ..., { passive: false })` was removed without the options object, causing some browsers to fail matching and leak the listener | `removeEventListener` now passes `{ passive: false }` |

### Game Lifecycle Hardening

| # | File | Issue | Fix |
|---|------|-------|-----|
| 11 | `Game.js` | **`resetGame()` did not reset `paused`** — resetting while the pause menu was open left the new match frozen | `this.paused = false` and `ui.hidePauseMenu()` are now called in `resetGame()` |
| 12 | `Game.js` | **`resetGame()` leaked stale aim/camera state** — `aimDirection`, `lockedAimDirection`, and `_wasShiftCameraControl` retained values from the previous match | All three are now reset to defaults |
| 13 | `Game.js` | **`startAITurn()` crashed on disposal** — `await aiPlayer.takeTurn()` and the charge-animation rAF could resume after `dispose()` nulled `ballsManager`, causing null-dereference | Added `!this.ballsManager` guards at every resumption point after an `await` |
| 14 | `Game.js` | **Pocket null-guard placed after usage** — `pocketPositions[entry.pocketIndex]` was used by `animateBallReturn` **before** the defensive `if (!pocket) continue` check | Moved the `pocket` assignment and null-check to the **top** of the loop body |

### Ball Return System Polish

| # | File | Issue | Fix |
|---|------|-------|-----|
| 15 | `BallReturnSystem.js` | **Tray z-fought with back apron** — the tray at `z=-144` overlapped the back apron (`z=-137`) in both Z and Y, causing flickering faces | Tray moved to `z=-155` so its front edge clears the apron |
| 16 | `BallReturnSystem.js` | **Clone meshes retained disposed geometry/material refs** — after `resetGame()` disposed original ball resources, clone meshes in the tray still pointed to them | `reset()` now sets `mesh.geometry = null` and `mesh.material = null` on every removed clone |
| 17 | `BallReturnSystem.js` | **Concurrent pocket slot collision** (discovered & fixed in RC) — multiple balls pocketed on the same frame competed for the same tray slot | Monotonic `_nextSlot` allocator ensures every ball gets a unique slot |

### Localization & Consistency

| # | File | Fix |
|---|------|-----|
| 18 | `StatsPanel.js` | `Scratches` → `滑杆` |
| 19 | `SettingsScreen.js` | `Version 1.2.5` → `版本 1.2.7` |
| 20 | `SettingsScreen.js` | `All rights reserved.` → `保留所有权利。` |
| 21 | `UI.js` / `MainMenuScreen.js` / `SettingsScreen.js` | RAF null-guards added to all fade-in callbacks so `destroy()` mid-animation no longer throws |
| 22 | `MenuSystem.js` | `_showAchievements()` and `_showReplays()` now hide `settingsScreen` to prevent orphaned overlapping panels |
| 23 | `MenuSystem.js` | `_quit()` now removes `menu-layer` from the DOM so a fresh `MenuSystem` boot starts clean |

---

## Previous Releases

<details>
<summary><strong>v1.2.6</strong> — Room Integrity, Camera Bounds, Ball Return System</summary>

### Room Integrity & Camera Bounds

The billiard room is now fully enclosed and camera movement is strictly bounded:

| # | Fix | Detail |
|---|-----|--------|
| 1 | **Ceiling added** | `createCeiling()` now generates a dark-brown ceiling plane (matching walls) so the room is no longer open to the void above |
| 2 | **Camera clamped to room** | `_clampCameraToRoom()` is now called after **every** camera operation — pan, orbit, zoom, wheel, and both `_resetCameraFree()` / `_resetCameraTop()` — preventing the camera from ever leaving the 520×760 cm room |
| 3 | **Furniture repositioned** | Sofa and coffee table were overlapping (茶几只差 20 cm 就撞上沙发扶手). Coffee table moved to z = 280 (was 150) for a realistic 90 cm gap |
| 4 | **Replay camera bounded** | Replay auto-orbit now clamps its computed position to `ROOM` bounds so cinematic fly-bys never clip outside the room |

### Gameplay & Rule Fixes

| # | File | Fix |
|---|------|-----|
| 5 | `Game.resolveTurn()` | Scratch logic reordered: `resetCueBallIfPocketed()` is now called **after** stats/recording updates, preventing the cue-ball respawn from desynchronizing turn-resolution state |
| 6 | `Game._updatePlayerStats()` | Default player names now use Chinese (`'玩家 1'` / `'玩家 2'` / `'AI'`) instead of the stale English `'Player 1'` |
| 7 | `Game.resetGame()` | Ball material disposal now safely handles `Array.isArray(ball.material)` — future-proofing for multi-material balls |
| 8 | `Room.js dispose()` | Same array-guard added for wall/ceiling/furniture materials with `child.material.forEach(m => m.dispose())` |

### Ball Return System — Pocketed Balls No Longer Vanish

The biggest visual upgrade in v1.2.6: when an object ball drops into a pocket, it **no longer disappears into thin air**. Instead, a cloned mesh performs a three-phase animation:

1. **Drop** (~220 ms) — the ball falls through the pocket mouth into the chute below the table surface
2. **Slide** (~520 ms) — it glides horizontally beneath the table toward the head end
3. **Settle** (~180 ms) — a slight bounce dampens into its final resting position

All returned balls accumulate in a **real 3D collection tray** attached to the underside of the table head-end:

- Dark wood construction with metal trim, matching the table's existing aesthetic
- Balls arrange in a natural 8-column grid with subtle random jitter — no sterile stacking
- Tray is fully shadow-casting and visible from low camera angles or the table end
- **Monotonic slot allocator** guarantees that even when multiple balls are pocketed on the same frame (break shots, combo pockets), they never overlap in the tray
- Cue ball is intentionally excluded — it gets respotted, so showing it in the tray would look like a duplicate

The tray and every returned ball are properly disposed on `resetGame()` and `dispose()`, leaving no mesh or material leaks.

### Version Consistency

All hard-coded version strings bumped from **v1.2.5 → v1.2.6**:
- `index.html` `<title>`
- `MainMenuScreen.js` version label
- `SettingsScreen.js` About section
- `index.html` `#version-tag`
</details>

<details>
<summary><strong>v1.2.5</strong> — UI/UX/SFX/BGM Deep Audit & Polish</summary>

### Room Integrity & Camera Bounds

The billiard room is now fully enclosed and camera movement is strictly bounded:

| # | Fix | Detail |
|---|-----|--------|
| 1 | **Ceiling added** | `createCeiling()` now generates a dark-brown ceiling plane (matching walls) so the room is no longer open to the void above |
| 2 | **Camera clamped to room** | `_clampCameraToRoom()` is now called after **every** camera operation — pan, orbit, zoom, wheel, and both `_resetCameraFree()` / `_resetCameraTop()` — preventing the camera from ever leaving the 520×760 cm room |
| 3 | **Furniture repositioned** | Sofa and coffee table were overlapping (茶几只差 20 cm 就撞上沙发扶手). Coffee table moved to z = 280 (was 150) for a realistic 90 cm gap |
| 4 | **Replay camera bounded** | Replay auto-orbit now clamps its computed position to `ROOM` bounds so cinematic fly-bys never clip outside the room |

### Gameplay & Rule Fixes

| # | File | Fix |
|---|------|-----|
| 5 | `Game.resolveTurn()` | Scratch logic reordered: `resetCueBallIfPocketed()` is now called **after** stats/recording updates, preventing the cue-ball respawn from desynchronizing turn-resolution state |
| 6 | `Game._updatePlayerStats()` | Default player names now use Chinese (`'玩家 1'` / `'玩家 2'` / `'AI'`) instead of the stale English `'Player 1'` |
| 7 | `Game.resetGame()` | Ball material disposal now safely handles `Array.isArray(ball.material)` — future-proofing for multi-material balls |
| 8 | `Room.js dispose()` | Same array-guard added for wall/ceiling/furniture materials with `child.material.forEach(m => m.dispose())` |

### Ball Return System — Pocketed Balls No Longer Vanish

The biggest visual upgrade in v1.2.6: when an object ball drops into a pocket, it **no longer disappears into thin air**. Instead, a cloned mesh performs a three-phase animation:

1. **Drop** (~220 ms) — the ball falls through the pocket mouth into the chute below the table surface
2. **Slide** (~520 ms) — it glides horizontally beneath the table toward the head end
3. **Settle** (~180 ms) — a slight bounce dampens into its final resting position

All returned balls accumulate in a **real 3D collection tray** attached to the underside of the table head-end:

- Dark wood construction with metal trim, matching the table's existing aesthetic
- Balls arrange in a natural 8-column grid with subtle random jitter — no sterile stacking
- Tray is fully shadow-casting and visible from low camera angles or the table end
- **Monotonic slot allocator** guarantees that even when multiple balls are pocketed on the same frame (break shots, combo pockets), they never overlap in the tray
- Cue ball is intentionally excluded — it gets respotted, so showing it in the tray would look like a duplicate

The tray and every returned ball are properly disposed on `resetGame()` and `dispose()`, leaving no mesh or material leaks.

### Version Consistency

All hard-coded version strings bumped from **v1.2.5 → v1.2.6**:
- `index.html` `<title>`
- `MainMenuScreen.js` version label
- `SettingsScreen.js` About section
- `index.html` `#version-tag`

---

## Previous Releases

<details>
<summary><strong>v1.2.5</strong> — UI/UX/SFX/BGM Deep Audit & Polish</summary>

A comprehensive third-round audit of the entire user-experience, audio, and visual-effects stack fixed **20+ issues** — from native audio-node leaks to UI button overlap, from English leftovers to listener leaks.

### Critical Fixes

| # | File | Issue |
|---|------|-------|
| 1 | `AudioManager.js` | **`stopBGM()` destroyed `_bgmWasPlaying`** — the flag was reset to `false` inside `stopBGM()`, so switching browser tabs permanently killed BGM recovery. **Fix:** removed the erroneous assignment; the visibility-change handler now correctly restores BGM when returning to the tab |
| 2 | `AudioManager.js` | **SFX node leak on `stop()` failure** — a single `try-catch` around both `node.stop()` and `node.disconnect()` meant a thrown `stop()` skipped `disconnect()`. **Fix:** split into two independent `try-catch` blocks so `disconnect()` always runs |
| 3 | `SettingsScreen.js` | **Keybinding listener leak** — clicking "修改" installs a global `window.keydown` listener via `keyBindings.startListening()`. If the user switched to another settings tab without pressing a key, the listener was never removed. **Fix:** `_switchCategory()` now calls `keyBindings.cancelListening()` first |
| 4 | `SettingsScreen.js` | **Toast timer accumulation** — `_toastTimer` was overwritten on every new toast, leaving orphaned nested timers in memory. **Fix:** track all active toast timers in `_toastTimers[]` and clear every entry on `destroy()` |
| 5 | `SettingsScreen.js` | **`localStorage.clear()` wiped the entire origin** — the "清除本地缓存" button called `localStorage.clear()`, destroying data for other apps on the same domain. **Fix:** now only removes keys prefixed with `billiards_` |
| 6 | `MenuSystem.js` | **Physics-body iteration skip** — `_quit()` used `forEach((b) => removeBody(b))` on the live `world.bodies` array, causing every other body to be skipped because cannon-es re-indexes after each removal. **Fix:** copy the array with `[...world.bodies]` before iterating |
| 7 | `MenuSystem.js` | **Async transition race** — `_startGame()` awaited a 500 ms fade-out but never re-checked `this.state`; rapid menu navigation could launch a game into a destroyed/transitioned state. **Fix:** state guard after every `await _delay()` |
| 8 | `Game.js` | **Back-to-menu button overlapped pause button** — both `#back-to-menu` and the ⚙️ pause button were absolutely-positioned at `top: 18px; right: 24px`, making the pause gear unclickable. **Fix:** moved back-to-menu to the top-left corner |

### Audio Polish

| # | File | Change |
|---|------|--------|
| 9 | `AudioManager.js` | **SFX cooldown halved** — `SFX_COOLDOWN_MS` reduced from 40 ms → 20 ms. Multiple balls pocketed in the same frame (break shots, combo pockets) now produce distinct sounds instead of being swallowed by cooldown |
| 10 | `AudioManager.js` | **`toggleSound()` respects master volume** — previously enabling sound reset master gain to `1.0`, ignoring the user's slider. Now restores `_masterVolume` |

### UI/UX Hardening

| # | File | Change |
|---|------|--------|
| 11 | `UI.js` | **Pause/settings overlay timer leaks fixed** — `hidePauseMenu()` and `hideInGameSettings()` now clear their hide timers before setting new ones; `destroy()` cancels both timers |
| 12 | `UI.js` | **No double backdrop** — opening in-game settings now first fades out the pause overlay, preventing two dark backdrops from stacking |
| 13 | `UI.js` | **`flashRed()` DOM cleanup** — the red-flash overlay is now removed in `destroy()` instead of persisting forever |
| 14 | `UI.js` | **Player groups now in Chinese** — badge labels changed from "Solids / Stripes" to "全色 / 花色" to match the bottom HUD |
| 15 | `UI.js` | **"New Game" → "再来一局"** — bottom HUD reset button now uses Chinese copy |
| 16 | `index.html` | **Initial message Chinese** — the default `#message` text is now fully localized |
| 17 | `Game.js` | **AI messages localized** — "AI is thinking..." and "AI failed to plan a shot..." replaced with Chinese equivalents |
| 18 | `main.js` | **Engine-init error boundary** — `new MenuSystem(container)` is now wrapped in `try/catch` with `showError()`, preventing an infinite loading spinner if Renderer or PhysicsWorld initialization fails |
| 19 | `MenuSystem.js` | **Promise chain catch** — `_initAudio().then(() => _setupMenu())` now has a `.catch()` handler that routes errors to the diagnostic overlay |

### FX Parameterization (v1.2.4 carry-over)

All visual-effect durations and intensities are now user-adjustable in **Settings → Graphics → 特效动画**:

- **FX 动画速度** — scales particle lifetimes, shockwave expansion, and power-label hold time
- **粒子效果强度** — multiplies spark count, fountain count, and chalk-dust count (0.2× – 2.0×)
- **拖尾淡出时间** — controls how long shot-trail lines linger before vanishing (2.0 – 10.0 s)
</details>

<details>
<summary><strong>v1.2.4</strong> — FX Parameters & Animation Sync</summary>

### FX Adjustable Parameters

Three new sliders in **Settings → Graphics → 特效动画**:

| Parameter | Range | Effect |
|-----------|-------|--------|
| FX 动画速度 | 50% – 200% | Scales all JS-driven effect durations (shockwave, particles, power label) |
| 粒子效果强度 | 20% – 200% | Multiplies spawn counts for chalk dust, collision sparks, pocket fountains |
| 拖尾淡出时间 | 2.0 – 10.0 s | How long cue-ball trail lines remain visible after a shot |

### Animation Sync

- `UI.hidePauseMenu()` / `UI.hideInGameSettings()` transitioned from hardcoded `300 ms` to `animMs(300)`, keeping CSS and JS in sync with the user's animation-speed preference
</details>

<details>
<summary><strong>v1.2.3</strong> — Gameplay & Rules Overhaul</summary>

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
</details>

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

- **Ball dots** coloured by type (solids / stripes / 8-ball / cue ball)
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
- **NineBallRules.getStatus()` — no longer mutates `this.targetBall` as a side effect.

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
