# Settings Audit Report

> Updated for v1.7.28 — LAN fairness locks, trajectory/minimap appearance implemented.  
> Total settings keys in `SettingsStore.DEFAULTS`: **~168** (after removing dormant keys from fairness set).

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | **Effective** — actively read by runtime code |
| ⚠️ | **Partial** — stored & exposed in UI but effect is limited / stubbed |
| ❌ | **Dormant** — defined in store & shown in UI but **not consumed** by any game system |
| 🗑️ | **Removed / Deprecated** — duplicate or superseded by another key |
| 🔒 | **Fairness-related** — should be host-controlled in competitive / LAN modes |

---

## 1. Audio (14 keys)

| Key | Status | Consumer | Notes |
|-----|--------|----------|-------|
| `soundEnabled` | ✅ | `AudioManager`, `MenuSystem` | |
| `masterVolume` | ✅ | `AudioManager` | |
| `musicVolume` | ✅ | `AudioManager` | |
| `sfxVolume` | ✅ | `AudioManager` | |
| `muteWhenUnfocused` | ✅ | `AudioManager` | |
| `collisionVolumeScale` | ✅ | `AudioManager` | |
| `pocketVolumeScale` | ✅ | `AudioManager` | |
| `cueHitVolumeScale` | ✅ | `AudioManager` | |
| `foulVolumeScale` | ✅ | `AudioManager` | |
| `uiSoundVolumeScale` | ⚠️ | `AudioManager` (field exists, no dedicated UI SFX yet) | Reserved for future UI click sounds |
| `ambientVolumeScale` | ✅ | `AudioManager`, `SettingsScreen` | |
| `hitFeedbackVolumeScale` | ✅ | `AudioManager` | |
| `audioDynamicRange` | ❌ | — | Stored but never read |
| `vibrationEnabled` | ✅ | `Game.shoot()` | |
| `lowLatencyMode` | ✅ | `AudioManager` (AudioContext latencyHint) | Requires page refresh to take full effect |

---

## 2. Graphics & Performance (21 keys)

| Key | Status | Consumer | Notes |
|-----|--------|----------|-------|
| `trajectoryEnabled` | ✅🔒 | `Game._applySettings()` | |
| `particlesEnabled` | ✅ | `Game`, `ParticleSystem` | |
| `shotTrailsEnabled` | ✅ | `Game`, `ShotTrailSystem` | |
| `quality` | ✅ | `Renderer.applyQualitySettings()` | Drives shadow map size & pixel ratio |
| `shadowsEnabled` | ✅ | `Renderer.applyQualitySettings()` | |
| `renderScale` | ✅ | `Renderer._onSettingsChanged` | |
| `antialiasEnabled` | ✅ | `Renderer` constructor *(fixed in cleanup)* | Was hard-coded `true`; now reads setting |
| `maxPixelRatio` | ✅ | `Renderer.applyQualitySettings()` | |
| `toneMappingExposure` | ✅ | `Renderer._onSettingsChanged` | |
| `fogEnabled` | ✅ | `Renderer._onSettingsChanged` | |
| `roomLightingQuality` | ❌ | — | UI exists; no runtime consumer |
| `reflectionQuality` | ❌ | — | UI exists; no runtime consumer |
| `ballDetail` | 🗑️ | — | **Removed** — duplicate of `ballTextureQuality` |
| `tableDetail` | 🗑️ | — | **Removed** — no consumer, no semantic equivalent |
| `backgroundAnimationEnabled` | ❌ | — | UI exists; no runtime consumer |
| `vSync` | ❌ | — | UI exists; `GameLoop` only enforces `fpsLimit` |
| `fpsLimit` | ✅ | `GameLoop` | |
| `fovZoomed` | ❌ | — | UI exists; no dedicated "aim zoom" FOV transition implemented |
| `dynamicFov` | ❌ | — | UI exists; no runtime consumer |
| `postProcess` | ❌ | — | Requires `EffectComposer` pipeline (not implemented) |
| `bloom` | ❌ | — | Requires `EffectComposer` pipeline |
| `chromaticAberration` | ❌ | — | Requires `EffectComposer` pipeline |
| `filmGrain` | ❌ | — | Requires `EffectComposer` pipeline |
| `vignette` | ❌ | — | Requires `EffectComposer` pipeline |

---

## 3. Visual Appearance (30 keys)

| Key | Status | Consumer | Notes |
|-----|--------|----------|-------|
| `cueTheme` | ✅ | `Game.init()`, `Cue.applyTheme()` | |
| `tableTheme` | ✅ | `Table.applyVisualSettings()` | |
| `feltTheme` | ✅ | `Table.applyVisualSettings()` | |
| `woodTheme` | ✅ | `Table.applyVisualSettings()` | |
| `metalTrimTheme` | ✅ | `Table.applyVisualSettings()` | |
| `clothNapEnabled` | ✅ | `Table.applyVisualSettings()` | |
| `clothPatternStrength` | ✅ | `Table.applyVisualSettings()` | |
| `clothWearEnabled` | ✅ | `Table.applyVisualSettings()` | |
| `ballTextureQuality` | ✅ | `Ball.updateVisualSettings()` | |
| `ballNumberSize` | ✅ | `Ball.updateVisualSettings()` | |
| `ballNumberContrast` | ✅ | `Ball.updateVisualSettings()` | |
| `cueBallMarkStyle` | ✅ | `Ball.updateVisualSettings()` | |
| `pocketNetDetail` | ✅ | `Table.applyVisualSettings()` | |
| `pocketLeatherTheme` | ✅ | `Table.applyVisualSettings()` | |
| `roomTheme` | ✅ | `Room.applyVisualSettings()` | |
| `floorTheme` | ✅ | `Room.applyVisualSettings()` | |
| `wallTheme` | ✅ | `Room.applyVisualSettings()` | |
| `decorativePropsEnabled` | ✅ | `Room.applyVisualSettings()` | |
| `wallDecorEnabled` | ✅ | `Room.applyVisualSettings()` | |
| `plantsEnabled` | ✅ | `Room.applyVisualSettings()` | |
| `ceilingGridEnabled` | ✅ | `Room.applyVisualSettings()` | |
| `lampStyle` | ✅ | `Room.applyVisualSettings()` | |
| `ambientLightTheme` | ✅ | `Room.applyVisualSettings()` | |
| `tableLightIntensity` | ✅ | `Room.applyVisualSettings()` | |
| `feltColorTheme` | ✅ | `Table.applyVisualSettings()` (legacy fallback) | |
| `woodColorTheme` | ✅ | `Table.applyVisualSettings()` (legacy fallback) | |
| `ballStyle` | ✅ | `Ball.updateVisualSettings()` | |
| `ballNumbers` | ✅ | `Ball.updateVisualSettings()` | |
| `lightingStyle` | ✅ | `Room.applyVisualSettings()` (legacy fallback) | |
| `lightingIntensity` | ✅ | `Room.applyVisualSettings()`, `Renderer` | |
| `ambientIntensity` | ✅ | `Room.applyVisualSettings()`, `Renderer` | |
| `roomStyle` | ✅ | `Room.applyVisualSettings()` (legacy fallback) | |
| `tableReflection` | ✅ | `Table.applyVisualSettings()` | |
| `ballReflection` | ❌ | — | No runtime consumer |
| `depthOfField` | ❌ | — | No runtime consumer |
| `colorBlindMode` | ❌ | — | No runtime consumer |
| `pocketHighlightEnabled` | ❌ | — | No runtime consumer |
| `cushionHighlightEnabled` | ❌ | — | No runtime consumer |
| `cueOpacity` | ❌ | — | No runtime consumer |
| `tableWearEnabled` | 🗑️ | — | **Removed** — duplicate of `clothWearEnabled` |

---

## 4. Camera & View (13 keys)

| Key | Status | Consumer | Notes |
|-----|--------|----------|-------|
| `defaultCamera` | ✅ | `Game._applyCameraMode()` | |
| `autoFollowCueBall` | ✅ | `Game.shoot()`, `Game.resolveTurn()` | |
| `cameraFov` | ✅ | `Renderer._onSettingsChanged` | |
| `cameraDamping` | ✅ | `Renderer._onSettingsChanged` | |
| `zoomMinDistance` | ❌ | — | `OrbitControls.minDistance` hard-coded to `80` |
| `zoomMaxDistance` | ❌ | — | `OrbitControls.maxDistance` hard-coded to `700` |
| `followCameraHeight` | ❌ | — | No runtime consumer |
| `followCameraDistance` | ❌ | — | No runtime consumer |
| `topCameraZoom` | ❌ | — | No runtime consumer |
| `cameraCollisionAvoidance` | ✅ | `Renderer._clampCameraToRoom()` | |
| `cameraAutoResetAfterShot` | ✅ | `Game.resolveTurn()` | |
| `cameraResetDelay` | ✅ | `Game.resolveTurn()` | |
| `hideCueOnShot` | ✅ | `Game.shoot()` | |
| `topDownAngle` | ✅ | `Game._resetCameraTop()` | |
| `cameraShake` | ✅ | `Game.shoot()` | |
| `cameraSmoothing` | ✅ | `Game._updateCamera()` | |
| `cameraSmoothFactor` | ✅ | `Game._updateCamera()` | |

---

## 5. UI & HUD (16 keys)

| Key | Status | Consumer | Notes |
|-----|--------|----------|-------|
| `turnTimer` | ✅🔒 | `Game.init()` | |
| `minimapEnabled` | ✅🔒 | `Game`, `Minimap` | |
| `minimapSize` | ✅ | `Minimap` | |
| `minimapOpacity` | ✅ | `Minimap` | |
| `hudScale` | ✅ | `Game._applySettings()` → `UI.setHudScale()` | |
| `hudOpacity` | ✅ | `Game._applySettings()` → `UI.setHudOpacity()` | |
| `messageDurationScale` | ✅ | `UI.setMessage()` *(fixed in cleanup)* | Was dormant; now scales `duration` param |
| `floatingTextEnabled` | ❌ | — | No runtime consumer |
| `floatingTextScale` | ❌ | — | No runtime consumer |
| `compactHud` | ❌ | — | No runtime consumer |
| `showShotPowerPercent` | ✅ | `Game._applySettings()` → `UI.setShowPowerBar()` | |
| `showSpinIndicator` | ✅ | `Game._applySettings()` → `UI.setShowSpinIndicator()` | |
| `showPlayerStatsPanel` | 🗑️ | — | **Renamed to `statsPanelEnabled`** (SettingsScreen & Game.js already agreed) |
| `statsPanelEnabled` | ✅ | `Game._applySettings()` → `UI.setStatsPanelEnabled()` | |
| `showFPS` | ✅ | `Game._applySettings()` → `UI.setShowFPS()` | |
| `showBallLabels` | ✅ | `Game._applySettings()` → `UI.setShowBallLabels()` | |
| `showRemainingBalls` | ✅ | `Game._applySettings()` → `UI.setShowRemainingBalls()` | |
| `showComboCounter` | ✅ | `Game._applySettings()` → `UI.setShowComboCounter()` | |
| `showCrosshair` | ✅🔒 | `Game._applySettings()` → `UI.setShowCrosshair()` | |
| `timerPosition` | ✅ | `Game._handleSettingsChange()` → `UI.setTimerPosition()` | |
| `reducedMotion` | ✅ | `Game._applySettings()` → `UI.setReducedMotion()` | |
| `highContrastUI` | ✅ | `Game._applySettings()` → `UI.setHighContrastUI()` | |
| `largeTextMode` | ✅ | `Game._applySettings()` → `UI.setLargeTextMode()` | |
| `pauseBlurEnabled` | ❌ | — | No runtime consumer |

---

## 6. Minimap Appearance (5 keys)

| Key | Status | Consumer | Notes |
|-----|--------|----------|-------|
| `minimapPosition` | ✅ | `Minimap._applyStyle()` | |
| `minimapBallSize` | ✅ | `Minimap` | v1.7.27 |
| `minimapShowCueTrail` | ✅ | `Minimap` | v1.7.27 |
| `minimapTrailLength` | ✅ | `Minimap` | v1.7.27 |
| `minimapHighContrast` | ✅ | `Minimap` | v1.7.27 |

---

## 7. Trajectory Appearance (4 keys)

| Key | Status | Consumer | Notes |
|-----|--------|----------|-------|
| `trajectoryOpacity` | ✅ | `TrajectoryPredictor` | v1.7.27 |
| `trajectoryWidth` | ✅ | `TrajectoryPredictor` | v1.7.27 (WebGL linewidth ignored on most platforms) |
| `trajectoryColorMode` | ✅ | `TrajectoryPredictor` | v1.7.27 (default/highContrast/colorBlind) |
| `trajectoryAnimationEnabled` | ✅ | `TrajectoryPredictor` | v1.7.27 (ghost-ball pulse animation) |

---

## 8. Trail & Particle FX (7 keys)

| Key | Status | Consumer | Notes |
|-----|--------|----------|-------|
| `trailOpacity` | ❌ | — | No runtime consumer |
| `trailWidth` | ❌ | — | No runtime consumer |
| `trailColorMode` | ❌ | — | No runtime consumer |
| `collisionSparksEnabled` | ✅ | `Game.shoot()` | v1.7.27 — independent of `particlesEnabled` master switch |
| `pocketFountainEnabled` | ✅ | `Game.shoot()` | v1.7.27 — independent of `particlesEnabled` master switch |
| `impactShockwaveEnabled` | ✅ | `Game.shoot()` | v1.7.27 — independent of `particlesEnabled` master switch |
| `ballReturnAnimationEnabled` | ✅ | `BallReturnSystem` | v1.7.27 — independent of `particlesEnabled` master switch |

---

## 9. Control Comfort (16 keys)

| Key | Status | Consumer | Notes |
|-----|--------|----------|-------|
| `mouseSensitivity` | ✅ | `Renderer` (pan/orbit/wheel) | |
| `cameraRotateSens` | ✅ | `Renderer` (orbit) | |
| `cameraPanSens` | ✅ | `Renderer` (pan) | |
| `cameraZoomSens` | ✅ | `Renderer` (wheel, OrbitControls) | |
| `shotPowerSens` | ✅🔒 | `Game.updateDragPower()` | |
| `aimSens` | ❌ | — | Mouse aim uses direct table projection; sensitivity not applicable without keyboard aim |
| `spinStepSens` | ✅ | `Game._handleSettingsChange()` → keyboard spin | |
| `trackpadSens` | ✅ | `Renderer.onWheel()` | |
| `holdToCharge` | ❌ | — | Current drag-to-charge is always "hold"; no tap-to-charge mode exists |
| `powerBarSmoothing` | ❌ | — | No runtime consumer |
| `dragDeadzone` | ✅ | `Game.updateDragPower()` *(fixed in cleanup)* | Now subtracts deadzone from pull distance |
| `doubleClickResetSpin` | ❌ | — | No runtime consumer |
| `rightClickCancelShot` | ❌ | — | No runtime consumer |
| `confirmShotOnRelease` | ✅ | `Game.onMouseUp()` | |
| `keyboardAimStep` | ❌ | — | Keyboard aiming not yet implemented |
| `keyboardFineAimMultiplier` | ❌ | — | Keyboard aiming not yet implemented |
| `touchControlsEnabled` | ❌ | — | Touch overlay UI not yet implemented |
| `touchButtonScale` | ❌ | — | Touch overlay UI not yet implemented |

---

## 10. Replay & Stats (11 keys)

| Key | Status | Consumer | Notes |
|-----|--------|----------|-------|
| `autoSaveReplays` | ❌ | — | `ReplayLibrary` may read it, but no explicit consumer found |
| `replayQuality` | ❌ | — | No runtime consumer |
| `replayMaxSaved` | ❌ | — | No runtime consumer |
| `replayShowHud` | ❌ | — | No runtime consumer |
| `replayShowShotTrail` | ❌ | — | No runtime consumer |
| `statsPanelEnabled` | ✅ | `Game._applySettings()` | |
| `statsPrivacyMode` | ❌ | — | No runtime consumer |
| `showShotData` | ❌ | — | No runtime consumer |
| `showHeatmap` | ❌ | — | No runtime consumer |
| `showWinProbability` | ❌🔒 | — | In fairness set but not implemented |
| `showDetailedStats` | ❌ | — | No runtime consumer |
| `shotHistoryTracking` | ❌ | — | No runtime consumer |
| `replaySpeed` | ❌ | — | No runtime consumer |

---

## 11. Accessibility (16 keys)

| Key | Status | Consumer | Notes |
|-----|--------|----------|-------|
| `invertMouseX` | ✅ | `Renderer` (pan / orbit / wheel) | |
| `invertMouseY` | ✅ | `Renderer` (pan / orbit / wheel) | |
| `largeTextMode` | ✅ | `Game._applySettings()` → `UI` | |
| `dyslexiaFriendlyFont` | ❌ | — | No runtime consumer |
| `uiContrast` | ❌ | — | No runtime consumer |
| `flashReduction` | ❌ | — | No runtime consumer |
| `screenShakeReduction` | ❌ | — | Use `screenShakeIntensity` instead |
| `subtitleEnabled` | ❌ | — | No runtime consumer |
| `soundCueVisualHints` | ❌ | — | No runtime consumer |
| `singleHandMode` | ❌ | — | No runtime consumer |
| `leftHandMode` | ❌ | — | No runtime consumer |
| `autoHints` | ❌🔒 | — | In fairness set but not implemented |
| `hintFrequency` | ❌🔒 | — | In fairness set but not implemented |
| `voiceAnnounce` | ❌ | — | No runtime consumer |
| `focusMode` | ❌ | — | No runtime consumer |
| `focusOpacity` | ❌ | — | No runtime consumer |
| `colorBlindMode` | ❌ | — | No runtime consumer |

---

## 12. Language & Units (10 keys)

| Key | Status | Consumer | Notes |
|-----|--------|----------|-------|
| `language` | ⚠️ | Stored; UI strings are Chinese hard-coded | Requires full i18n pass or page reload |
| `unitSystem` | ❌ | — | No runtime consumer |
| `numberFormat` | ❌ | — | No runtime consumer |
| `clockFormat` | ❌ | — | No runtime consumer |
| `defaultTableProfile8Ball` | ✅ | `TableProfiles.resolveTableProfileId()` | |
| `defaultTableProfile9Ball` | ✅ | `TableProfiles.resolveTableProfileId()` | |
| `defaultTableProfileFreeplay` | ✅ | `TableProfiles.resolveTableProfileId()` | |
| `quickBreak` | ❌ | — | No runtime consumer |
| `autoSkipAnimation` | ❌ | — | No runtime consumer |
| `skipOpponentTurn` | ❌🔒 | — | In fairness set but not implemented |
| `showOpponentTrajectory` | ❌🔒 | — | In fairness set but not implemented |
| `speedUnit` | ❌ | — | No runtime consumer |
| `showPhysicsDebug` | ⚠️ | `Game._togglePhysicsDebug` (stub) | Dev-only; UI hidden unless `devMode` |
| `devMode` | ⚠️ | Shows/hides dev UI rows | No deep debug systems wired yet |

---

## 13. Effects & UI Sensitivity (5 keys)

| Key | Status | Consumer | Notes |
|-----|--------|----------|-------|
| `screenShakeIntensity` | ✅ | `ScreenShake.js` | |
| `uiAnimSpeed` | ✅ | `AnimSpeed.js`, CSS var | |
| `fxAnimSpeed` | ✅ | `AnimSpeed.js`, `PowerLabel.js` | |
| `particleIntensity` | ✅ | `ParticleSystem.js` | |
| `trailFadeDuration` | ✅ | `ShotTrail.js` | |

---

## 14. Keybindings (3 keys)

| Key | Status | Consumer | Notes |
|-----|--------|----------|-------|
| `keybindingPreset` | ✅ | `KeyBindings.js` | |
| `customKeybindingPresets` | ✅ | `KeyBindings.js` | |
| `keyBindings` | ✅ | `KeyBindings.js` | |

---

## Summary

| Category | Count | ✅ Effective | ⚠️ Partial | ❌ Dormant | 🗑️ Removed |
|----------|-------|-------------|-----------|-----------|------------|
| Audio | 14 | 12 | 1 | 1 | 0 |
| Graphics | 21 | 9 | 0 | 9 | 3 |
| Appearance | 30 | 24 | 0 | 4 | 2 |
| Camera | 13 | 8 | 0 | 5 | 0 |
| UI/HUD | 16 | 11 | 0 | 4 | 1 |
| Minimap | 5 | 5 | 0 | 0 | 0 |
| Trajectory | 4 | 4 | 0 | 0 | 0 |
| FX/Trail | 7 | 4 | 0 | 3 | 0 |
| Controls | 16 | 7 | 0 | 9 | 0 |
| Replay/Stats | 11 | 1 | 0 | 10 | 0 |
| Accessibility | 16 | 3 | 0 | 13 | 0 |
| Language/Units | 10 | 3 | 1 | 5 | 0 |
| FX Sens | 5 | 5 | 0 | 0 | 0 |
| Keybindings | 3 | 3 | 0 | 0 | 0 |
| **Total** | **~171** | **91** | **2** | **71** | **6** |

*Note: 6 keys were removed/merged during this cleanup (`ballDetail`, `tableDetail`, `tableWearEnabled`, `showPlayerStatsPanel` plus 2 legacy duplicates).*

---

## Fixes Applied in This Cleanup

1. **`antialiasEnabled`** — `WebGLRenderer` was hard-coded `antialias: true`. Now reads `settings.get('antialiasEnabled') !== false`.
2. **`messageDurationScale`** — `UI.setMessage()` was ignoring this key. Now multiplies `duration` by the scale factor live.
3. **`dragDeadzone`** — `Game.updateDragPower()` was not applying a deadzone. Now subtracts `dragDeadzone` (default 4 px) from raw pull distance before calculating power.
4. **`showPlayerStatsPanel` → `statsPanelEnabled`** — SettingsScreen and Game.js used different names. Removed the duplicate key from `SettingsStore.DEFAULTS`.
5. **`tableWearEnabled` → `clothWearEnabled`** — Duplicate semantic. Removed from store; SettingsScreen already used `clothWearEnabled`.
6. **`ballDetail` / `tableDetail`** — No consumers. Removed from store defaults.

---

## Remaining TODOs (Priority Order)

### High Priority — Fairness Enforcement
- [x] **LAN / match mode locks `MATCH_FAIRNESS_KEYS` for clients**. `SettingsScreen` accepts `setLockedKeys()`; `MenuSystem` passes fairness keys when `networkRole === 'client'` or in local match mode. Locked controls are greyed out with `🔒` badge and tooltip "由房主/比赛锁定". Host can still change fairness settings (authoritative).

### Medium Priority — Easy Wins
- [ ] **`zoomMinDistance` / `zoomMaxDistance`** — wire into `OrbitControls` instead of hard-coded `80` / `700`.
- [ ] **`postProcess` + `bloom` + `chromaticAberration` + `filmGrain` + `vignette`** — either remove from UI or add a minimal `EffectComposer` pass.
- [ ] **`language`** — either remove from UI or implement a minimal i18n dictionary switch.
- [ ] **`vSync`** — remove from UI or implement via `requestAnimationFrame` throttling (already have `fpsLimit`).
- [ ] **Production dist smoke test** — add a `test:dist` script that previews the built `dist/` and verifies no broken asset references.

### Low Priority — Future Features
- [x] **Trajectory appearance** — ✅ implemented in v1.7.27.
- [x] **Minimap appearance** — ✅ implemented in v1.7.27.
- [ ] **Replay system** (`replayQuality`, `replaySpeed`, `replayShowHud`, etc.) — fully depends on Replay UI completion.
- [ ] **Accessibility suite** (`colorBlindMode`, `dyslexiaFriendlyFont`, `subtitleEnabled`, `soundCueVisualHints`, `voiceAnnounce`, `focusMode`) — large feature set, safe to leave dormant.
- [ ] **Touch controls** (`touchControlsEnabled`, `touchButtonScale`) — requires on-screen touch overlay.
- [ ] **Keyboard aiming** (`keyboardAimStep`, `keyboardFineAimMultiplier`) — requires dedicated keyboard-aim loop.

---

## Fairness Key Review

Current `MATCH_FAIRNESS_KEYS` (v1.7.28):
```
trajectoryEnabled     ✅ implemented  → locked for LAN clients
minimapEnabled        ✅ implemented  → locked for LAN clients
turnTimer             ✅ implemented  → locked for LAN clients
shotPowerSens         ✅ implemented  → locked for LAN clients
showCrosshair         ✅ implemented  → locked for LAN clients
```

Removed from `MATCH_FAIRNESS_KEYS` (moved to `MATCH_FAIRNESS_RESERVED`):
```
showWinProbability    ❌ NOT implemented — reserved
showOpponentTrajectory ❌ NOT implemented — reserved
skipOpponentTurn      ❌ NOT implemented — reserved
autoHints             ❌ NOT implemented — reserved
hintFrequency         ❌ NOT implemented — reserved
```

**Rule:** A key may only enter `MATCH_FAIRNESS_KEYS` after its game system is fully implemented. Reserved keys remain in `MATCH_FAIRNESS_RESERVED` until then.
