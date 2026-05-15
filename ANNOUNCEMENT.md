# 3D Billiards v1.4.0 — Latest Update

## What's New in v1.4.0

### ⏱️ 回合计时器 — Turn Timer

A new **per-turn countdown timer** that adds tension to standard match modes. Players must complete their shot before time runs out, or face a foul penalty.

| # | Feature | Detail |
|---|---------|--------|
| 1 | **Three time limits** | Choose from **不限时** (unlimited) / **30 秒** / **60 秒** per turn |
| 2 | **In-game settings** | Change the timer limit from the in-game settings overlay without restarting |
| 3 | **Smart activation** | Timer only activates in standard match modes: **local 2P**, **vs AI**, **LAN**, and **local match** — disabled in freeplay, challenge, and replay |
| 4 | **Visual warning** | Timer text turns **orange** at ≤5s and **red + pulsing** at ≤3s for clear urgency feedback |
| 5 | **Auto-pause** | Countdown pauses during pause menu, in-game settings, and replay playback — resumes seamlessly |
| 6 | **Timeout penalty** | When time expires, it's a **foul**: opponent gets **ball-in-hand** anywhere on the table |

### Changed Files

| File | Change |
|------|--------|
| `src/core/SettingsStore.js` | Added `turnTimer` setting (`'off'` / `'30'` / `'60'`) |
| `src/game/Game.js` | Integrated timer lifecycle with AIM state, pause, settings, and replay; added `_onTurnTimerExpired()` foul handler; live settings change support |
| `src/ui/UI.js` | Added `setTurnTimer()` / `hideTurnTimer()` HUD methods with warning/danger styling; added turn timer select card to in-game settings |
| `index.html` | Added `#turn-timer` element and CSS (position, pulse animation, color states) |

---

## Previous Versions

### v1.3.9 — 本地比赛模式 (Local Match Mode)

A tournament-style local 2-player mode with customizable names, 8-ball/9-ball selection, best-of-N match formats, live score HUD, and match end flow.

### v1.3.8 — Deep Bug Audit

12 stability fixes including LAN anonymous listener leak elimination, WebSocket disconnect auto-return, host concede block, server payload guards, BGM lifecycle preservation, and various cleanup leak fixes.

### v1.3.7 — UI/UX/SFX/BGM Bug Audit

Renderer wheel listener fix, SettingsScreen toast null guard, UI message timer leak fix, UI button cloneNode cleanup, ParticleSystem dt clamp, Game.js reset button unified path, network dispose cleanup, LAN concede block, server null guard.
