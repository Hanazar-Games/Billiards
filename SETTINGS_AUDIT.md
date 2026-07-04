# Settings Audit Report

> Updated for **v1.7.31** — comprehensive reconciliation of `SettingsStore.DEFAULTS`, `SettingsScreen` UI, and runtime consumers.  
> Total settings keys in `SettingsStore.DEFAULTS`: **197**.

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | **Effective** — actively read by runtime code and produces a visible/audible/behavioural effect |
| ⚠️ | **Partial** — stored & exposed in UI but effect is limited / stubbed / requires page reload |
| ❌ | **Dormant** — defined in store but **not consumed** by any game system (UI now shows disabled state) |
| 🔒 | **Fairness-related** — host-controlled in competitive / LAN modes; clients see greyed-out `🔒` badge |
| 🔄 | **Restart-required** — changing the value requires a page refresh to take full effect |

---

## UI Status Labels

The settings panel now displays a small badge next to every disabled or special-status row:

| Badge | Meaning |
|-------|---------|
| `未实现` | Feature is not yet built — control is disabled |
| `需重启` | Value is read once at startup — refresh page after changing |
| `实时生效` | Value is applied immediately without restart |
| `🔒` | Locked by host in LAN / match mode — cannot be changed locally |
| `暂不可用` | Platform or browser limitation prevents implementation |

---

## 1. Audio (13 keys)

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
| `ambientVolumeScale` | ✅ | `AudioManager` | |
| `hitFeedbackVolumeScale` | ✅ | `AudioManager` | |
| `vibrationEnabled` | ✅ | `Game.shoot()` | |
| `lowLatencyMode` | ✅🔄 | `AudioManager` (AudioContext `latencyHint`) | Tooltip: "刷新页面后生效" |

---

## 2. Graphics & Performance (22 keys)

| Key | Status | Consumer | Notes |
|-----|--------|----------|-------|
| `trajectoryEnabled` | ✅🔒 | `Game._applySettings()` | |
| `particlesEnabled` | ✅ | `Game`, `ParticleSystem` | |
| `shotTrailsEnabled` | ✅ | `Game`, `ShotTrailSystem` | |
| `quality` | ✅ | `Renderer.applyQualitySettings()` | Drives shadow map size & pixel ratio |
| `shadowsEnabled` | ✅ | `Renderer.applyQualitySettings()` | |
| `renderScale` | ✅🔄 | `Renderer._onSettingsChanged` | UI disabled with badge `需重启`; shows current value |
| `antialiasEnabled` | ✅ | `Renderer` constructor | |
| `maxPixelRatio` | ✅ | `Renderer.applyQualitySettings()` | |
| `toneMappingExposure` | ✅ | `Renderer._onSettingsChanged` | |
| `fogEnabled` | ✅ | `Renderer._onSettingsChanged` | |
| `fpsLimit` | ✅ | `GameLoop` | |
| `roomLightingQuality` | ✅ | `Room.applyVisualSettings()` | Scales secondary light intensity & emissive glow |
| `reflectionQuality` | ❌ | — | Dormant; not exposed in UI |
| `backgroundAnimationEnabled` | ❌ | — | Dormant; not exposed in UI |
| `vSync` | ❌ | — | UI disabled with badge `暂不可用`; browser controls vsync |
| `fovZoomed` | ❌ | — | UI disabled with badge `未实现` |
| `dynamicFov` | ❌ | — | UI disabled with badge `未实现` |
| `postProcess` | ❌ | — | UI disabled with badge `未实现`; requires EffectComposer |
| `bloom` | ❌ | — | UI disabled with badge `未实现` |
| `chromaticAberration` | ❌ | — | UI disabled with badge `未实现` |
| `filmGrain` | ❌ | — | UI disabled with badge `未实现` |
| `vignette` | ❌ | — | UI disabled with badge `未实现` |

---

## 3. Visual Appearance (39 keys)

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
| `ballReflection` | ❌ | — | Dormant; not exposed in UI |
| `depthOfField` | ❌ | — | Dormant; not exposed in UI |
| `colorBlindMode` | ❌ | — | **Was active in UI** — now disabled with badge `未实现` |
| `pocketHighlightEnabled` | ❌ | — | Dormant; not exposed in UI |
| `cushionHighlightEnabled` | ❌ | — | Dormant; not exposed in UI |
| `cueOpacity` | ❌ | — | Dormant; not exposed in UI |

---

## 4. Camera & View (17 keys)

| Key | Status | Consumer | Notes |
|-----|--------|----------|-------|
| `defaultCamera` | ✅ | `Game._applyCameraMode()` | |
| `autoFollowCueBall` | ✅ | `Game.shoot()`, `Game.resolveTurn()` | |
| `cameraFov` | ✅ | `Renderer._onSettingsChanged` | UI shows disabled text with current value + badge `实时生效` |
| `cameraDamping` | ✅ | `Renderer._onSettingsChanged` | |
| `cameraCollisionAvoidance` | ✅ | `Renderer._clampCameraToRoom()` | |
| `cameraAutoResetAfterShot` | ✅ | `Game.resolveTurn()` | |
| `cameraResetDelay` | ✅ | `Game.resolveTurn()` | |
| `hideCueOnShot` | ✅ | `Game.shoot()` | |
| `topDownAngle` | ✅ | `Game._resetCameraTop()` | |
| `cameraShake` | ✅ | `Game.shoot()` | |
| `cameraSmoothing` | ✅ | `Game._updateCamera()` | |
| `cameraSmoothFactor` | ✅ | `Game._updateCamera()` | |
| `zoomMinDistance` | ❌ | — | Dormant; not exposed in UI |
| `zoomMaxDistance` | ❌ | — | Dormant; not exposed in UI |
| `followCameraHeight` | ❌ | — | Dormant; not exposed in UI |
| `followCameraDistance` | ❌ | — | Dormant; not exposed in UI |
| `topCameraZoom` | ❌ | — | Dormant; not exposed in UI |

---

## 5. UI & HUD (21 keys)

| Key | Status | Consumer | Notes |
|-----|--------|----------|-------|
| `turnTimer` | ✅🔒 | `Game.init()` | |
| `minimapEnabled` | ✅🔒 | `Game`, `Minimap` | |
| `minimapSize` | ✅ | `Minimap` | |
| `minimapOpacity` | ✅ | `Minimap` | |
| `hudScale` | ✅ | `Game._applySettings()` → `UI.setHudScale()` | |
| `hudOpacity` | ✅ | `Game._applySettings()` → `UI.setHudOpacity()` | |
| `messageDurationScale` | ✅ | `UI.setMessage()` | |
| `showShotPowerPercent` | ✅ | `Game._applySettings()` → `UI.setShowPowerBar()` | |
| `showSpinIndicator` | ✅ | `Game._applySettings()` → `UI.setShowSpinIndicator()` | |
| `showFPS` | ✅ | `Game._applySettings()` → `UI.setShowFPS()` | |
| `showBallLabels` | ✅ | `Game._applySettings()` → `UI.setShowBallLabels()` | |
| `showRemainingBalls` | ✅ | `Game._applySettings()` → `UI.setShowRemainingBalls()` | |
| `showComboCounter` | ✅ | `Game._applySettings()` → `UI.setShowComboCounter()` | |
| `showCrosshair` | ✅🔒 | `Game._applySettings()` → `UI.setShowCrosshair()` | |
| `timerPosition` | ✅ | `Game._handleSettingsChange()` → `UI.setTimerPosition()` | |
| `reducedMotion` | ✅ | `Game._applySettings()` → `UI.setReducedMotion()` | |
| `highContrastUI` | ✅ | `Game._applySettings()` → `UI.setHighContrastUI()` | |
| `floatingTextEnabled` | ❌ | — | Dormant; not exposed in UI |
| `floatingTextScale` | ❌ | — | Dormant; not exposed in UI |
| `compactHud` | ❌ | — | Dormant; not exposed in UI |
| `pauseBlurEnabled` | ❌ | — | Dormant; not exposed in UI |

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
| `trajectoryWidth` | ✅ | `TrajectoryPredictor` | v1.7.27 |
| `trajectoryColorMode` | ✅ | `TrajectoryPredictor` | v1.7.27 |
| `trajectoryAnimationEnabled` | ✅ | `TrajectoryPredictor` | v1.7.27 |

---

## 8. Trail & Particle FX (7 keys)

| Key | Status | Consumer | Notes |
|-----|--------|----------|-------|
| `trailOpacity` | ❌ | — | Dormant; not exposed in UI |
| `trailWidth` | ❌ | — | Dormant; not exposed in UI |
| `trailColorMode` | ❌ | — | Dormant; not exposed in UI |
| `collisionSparksEnabled` | ✅ | `Game.shoot()` | v1.7.27 — independent of `particlesEnabled` master switch |
| `pocketFountainEnabled` | ✅ | `Game.shoot()` | v1.7.27 — independent of `particlesEnabled` master switch |
| `impactShockwaveEnabled` | ✅ | `Game.shoot()` | v1.7.27 — independent of `particlesEnabled` master switch |
| `ballReturnAnimationEnabled` | ✅ | `BallReturnSystem` | v1.7.27 — independent of `particlesEnabled` master switch |

---

## 9. Control Comfort (18 keys)

| Key | Status | Consumer | Notes |
|-----|--------|----------|-------|
| `mouseSensitivity` | ✅ | `Renderer` (pan/orbit/wheel) | |
| `cameraRotateSens` | ✅ | `Renderer` (orbit) | |
| `cameraPanSens` | ✅ | `Renderer` (pan) | |
| `cameraZoomSens` | ✅ | `Renderer` (wheel, OrbitControls) | |
| `shotPowerSens` | ✅🔒 | `Game.updateDragPower()` | |
| `aimSens` | ❌ | — | **Was active in UI** — now disabled with badge `未实现` |
| `spinStepSens` | ✅ | `Game._handleSettingsChange()` → keyboard spin | |
| `trackpadSens` | ✅ | `Renderer.onWheel()` | |
| `dragDeadzone` | ✅ | `Game.updateDragPower()` | Now subtracts deadzone from pull distance |
| `confirmShotOnRelease` | ✅ | `Game.onMouseUp()` | |
| `holdToCharge` | ❌ | — | Dormant; not exposed in UI |
| `powerBarSmoothing` | ❌ | — | Dormant; not exposed in UI |
| `doubleClickResetSpin` | ❌ | — | Dormant; not exposed in UI |
| `rightClickCancelShot` | ❌ | — | Dormant; not exposed in UI |
| `keyboardAimStep` | ❌ | — | Dormant; not exposed in UI |
| `keyboardFineAimMultiplier` | ❌ | — | Dormant; not exposed in UI |
| `touchControlsEnabled` | ❌ | — | Dormant; not exposed in UI |
| `touchButtonScale` | ❌ | — | Dormant; not exposed in UI |

---

## 10. Replay & Stats (8 keys)

| Key | Status | Consumer | Notes |
|-----|--------|----------|-------|
| `statsPanelEnabled` | ✅ | `Game._applySettings()` → `UI.setStatsPanelEnabled()` | |
| `autoSaveReplays` | ✅ | `ReplayLibrary.save()` | |
| `replayQuality` | ❌ | — | Dormant; not exposed in UI |
| `replayMaxSaved` | ✅ | `ReplayLibrary.getMaxReplays()` | |
| `replayShowHud` | ❌ | — | Dormant; not exposed in UI |
| `replayShowShotTrail` | ❌ | — | Dormant; not exposed in UI |
| `statsPrivacyMode` | ❌ | — | Dormant; not exposed in UI |
| `replaySpeed` | ✅ | `ShotReplay._resolveInitialSpeedIndex()` | |

---

## 11. Accessibility (16 keys)

| Key | Status | Consumer | Notes |
|-----|--------|----------|-------|
| `invertMouseX` | ✅ | `Renderer` (pan / orbit / wheel) | |
| `invertMouseY` | ✅ | `Renderer` (pan / orbit / wheel) | |
| `largeTextMode` | ✅ | `Game._applySettings()` → `UI.setLargeTextMode()` | |
| `reducedMotion` | ✅ | `Game._applySettings()` → `UI.setReducedMotion()` | Listed under UI & HUD in DEFAULTS |
| `highContrastUI` | ✅ | `Game._applySettings()` → `UI.setHighContrastUI()` | Listed under UI & HUD in DEFAULTS |
| `dyslexiaFriendlyFont` | ❌ | — | Dormant; not exposed in UI |
| `uiContrast` | ❌ | — | Dormant; not exposed in UI |
| `flashReduction` | ❌ | — | Dormant; not exposed in UI |
| `screenShakeReduction` | ❌ | — | Dormant; not exposed in UI |
| `subtitleEnabled` | ❌ | — | Dormant; not exposed in UI |
| `soundCueVisualHints` | ❌ | — | UI disabled with badge `未实现` |
| `singleHandMode` | ❌ | — | UI disabled with badge `未实现` |
| `leftHandMode` | ❌ | — | UI disabled with badge `未实现` |
| `autoHints` | ❌ | — | UI disabled with badge `未实现` |
| `hintFrequency` | ❌ | — | UI disabled with badge `未实现` |
| `voiceAnnounce` | ❌ | — | UI disabled with badge `未实现` |
| `focusMode` | ❌ | — | UI disabled with badge `未实现` |
| `focusOpacity` | ❌ | — | UI disabled with badge `未实现` |

---

## 12. Language & Units (14 keys)

| Key | Status | Consumer | Notes |
|-----|--------|----------|-------|
| `defaultTableProfile8Ball` | ✅ | `TableProfiles.resolveTableProfileId()` | |
| `defaultTableProfile9Ball` | ✅ | `TableProfiles.resolveTableProfileId()` | |
| `defaultTableProfileFreeplay` | ✅ | `TableProfiles.resolveTableProfileId()` | |
| `devMode` | ✅ | `SettingsScreen` (shows/hides dev rows), `Game._toggleDevMode()` | No deep debug systems wired yet, but UI reacts |
| `language` | ⚠️ | Stored; UI strings are Chinese hard-coded | Requires full i18n pass or page reload |
| `showPhysicsDebug` | ⚠️ | `Game._togglePhysicsDebug` (stub) | Dev-only; UI hidden unless `devMode` |
| `unitSystem` | ❌ | — | UI disabled with badge `未实现` |
| `numberFormat` | ❌ | — | Dormant; not exposed in UI |
| `clockFormat` | ❌ | — | Dormant; not exposed in UI |
| `quickBreak` | ❌ | — | UI disabled with badge `未实现` |
| `autoSkipAnimation` | ❌ | — | UI disabled with badge `未实现` |
| `skipOpponentTurn` | ❌ | — | UI disabled with badge `未实现` |
| `showOpponentTrajectory` | ❌ | — | UI disabled with badge `未实现` |
| `speedUnit` | ❌ | — | UI disabled with badge `未实现` |

---

## 13. Effects & UI Sensitivity (5 keys)

| Key | Status | Consumer | Notes |
|-----|--------|----------|-------|
| `screenShakeIntensity` | ✅ | `ScreenShake.js` | |
| `uiAnimSpeed` | ✅ | `AnimSpeed.js`, CSS var `--ui-anim-speed` | |
| `fxAnimSpeed` | ✅ | `AnimSpeed.js`, `PowerLabel.js` | |
| `particleIntensity` | ✅ | `ParticleSystem.js` | |
| `trailFadeDuration` | ✅ | `ShotTrail.js` | |

---

## 14. Keybindings (3 keys)

| Key | Status | Consumer | Notes |
|-----|--------|----------|-------|
| `keybindingPreset` | ✅ | `KeyBindings.js` | |
| `customKeybindingPresets` | ✅ | `KeyBindings.js` | |
| `keyBindings` | ✅ | `KeyBindings.js` | Object storing per-action bindings |

---

## Summary

| Category | Count | ✅ Effective | ⚠️ Partial | ❌ Dormant |
|----------|-------|-------------|-----------|-----------|
| Audio | 13 | 13 | 0 | 0 |
| Graphics | 22 | 11 | 0 | 11 |
| Appearance | 39 | 33 | 0 | 6 |
| Camera | 17 | 12 | 0 | 5 |
| UI/HUD | 21 | 17 | 0 | 4 |
| Minimap | 5 | 5 | 0 | 0 |
| Trajectory | 4 | 4 | 0 | 0 |
| FX/Trail | 7 | 4 | 0 | 3 |
| Controls | 18 | 9 | 0 | 9 |
| Replay/Stats | 13 | 1 | 0 | 12 |
| Accessibility | 16 | 3 | 0 | 13 |
| Language/Units | 14 | 4 | 2 | 8 |
| FX Sens | 5 | 5 | 0 | 0 |
| Keybindings | 3 | 3 | 0 | 0 |
| **Total** | **197** | **124** | **2** | **71** |

---

## SettingsScreen UI Changes in v1.7.31

### Previously Active → Now Disabled
The following settings were incorrectly shown as interactive controls despite having no runtime consumer. They are now greyed-out with the `未实现` badge:

1. **色盲模式** (`colorBlindMode`) — Accessibility tab
2. **瞄准响应速度** (`aimSens`) — Controls → 击球与瞄准灵敏度

### Previously Mislabeled → Now Accurate
1. **渲染缩放** (`renderScale`) — badge changed from `未实现` → `需重启`; shows current numeric value
2. **视野范围 (FOV)** (`cameraFov`) — badge changed from `未实现` → `实时生效`; shows current degree value
3. **垂直同步** (`vSync`) — badge changed from `未实现` → `暂不可用`

---

## Fairness Key Review

Current `MATCH_FAIRNESS_KEYS` (v1.7.31):
```
trajectoryEnabled     ✅ implemented  → locked for LAN clients
minimapEnabled        ✅ implemented  → locked for LAN clients
turnTimer             ✅ implemented  → locked for LAN clients
shotPowerSens         ✅ implemented  → locked for LAN clients
showCrosshair         ✅ implemented  → locked for LAN clients
```

Reserved (`MATCH_FAIRNESS_RESERVED`) — empty. All fairness keys are actively implemented.

**Rule:** A key may only enter `MATCH_FAIRNESS_KEYS` after its game system is fully implemented.

---

## Remaining TODOs (Post-Audit)

### High Priority
- [x] **Settings audit complete** — 197 keys mapped, 6 misrepresented settings fixed in UI.

### Medium Priority — Easy Wins
- [ ] **`zoomMinDistance` / `zoomMaxDistance`** — wire into `OrbitControls` instead of hard-coded `80` / `700`.
- [ ] **`postProcess` + `bloom` + `chromaticAberration` + `filmGrain` + `vignette`** — either remove from UI or add a minimal `EffectComposer` pass.
- [ ] **`language`** — either remove from UI or implement a minimal i18n dictionary switch.
- [ ] **`vSync`** — remove from UI or implement via `requestAnimationFrame` throttling (already have `fpsLimit`).

### Low Priority — Future Features
- [x] **Trajectory appearance** — ✅ implemented in v1.7.27.
- [x] **Minimap appearance** — ✅ implemented in v1.7.27.
- [ ] **Replay system** (`replayQuality`, `replaySpeed`, `replayShowHud`, etc.) — fully depends on Replay UI completion.
- [ ] **Accessibility suite** (`colorBlindMode`, `dyslexiaFriendlyFont`, `subtitleEnabled`, `soundCueVisualHints`, `voiceAnnounce`, `focusMode`) — large feature set, safe to leave dormant.
- [ ] **Touch controls** (`touchControlsEnabled`, `touchButtonScale`) — requires on-screen touch overlay.
- [ ] **Keyboard aiming** (`keyboardAimStep`, `keyboardFineAimMultiplier`) — requires dedicated keyboard-aim loop.
