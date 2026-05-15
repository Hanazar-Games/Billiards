# 3D Billiards v1.4.3 — Latest Update

## What's New in v1.4.3

### 🏗️ 架构整理（小步重构）

为未来的联机对战做准备，将 Game.js 中的核心能力拆分为独立模块，同时保持所有现有功能不变。

| # | 整理项 | 详情 |
|---|--------|------|
| 1 | **ShotInput 模块** | 新建 `src/game/ShotInput.js`，统一封装 `createShotInput(game)` 和 `applyShotInput(game, input)`。Game.js 的 `applyRemoteShot` 现在直接委托给 `applyShotInput`，网络层与游戏逻辑解耦 |
| 2 | **序列化接口显性化** | Game.js 新增 `serializeGameState()` 和 `applyGameState(snapshot)` 方法，作为 `GameStateSerializer` 的薄包装，方便外部模块（网络、回放）直接调用 |
| 3 | **MatchManager 提取** | 新建 `src/game/MatchManager.js` 包装 `MatchEngine` 并接管比赛比分 HUD 更新。Game.js 不再内联渲染比赛分数，而是通过 `matchManager.updateHUD(ui)` 委托；MenuSystem 统一使用 MatchManager |
| 4 | **UI 文案常量集中** | 新建 `src/core/UIText.js`，集中存放 Game.js 中所有玩家-facing 的中文字符串（模式介绍、自由球提示、网络消息等），为后续 i18n 打基础 |
| 5 | **重复代码清理** | 提取 `_enterAimState()`、`_endBallInHand()`、`_respotBall(id)`、`_applyCameraMode(mode)`、`_broadcastSnapshot()`、`_removeChallengeHUD()` 等 6 个共享辅助方法，消除 Game.js 中多处复制粘贴 |

### 改动文件

- **新增**: `src/game/ShotInput.js`, `src/game/MatchManager.js`, `src/core/UIText.js`
- **修改**: `src/game/Game.js`, `src/menu/MenuSystem.js`, `src/core/SettingsStore.js`, `src/core/Renderer.js`

---

## Previous Versions

### v1.4.2 — 设置系统增强

- 自定义确认弹窗、配置导入/导出 JSON、即时保存 toast
- 性能模式 / 新手模式一键预设
- 阴影效果独立开关

### v1.4.1 — HUD & 菜单体验优化

- 版本号统一来源、底部 HUD 布局优化、小屏幕响应式适配
- 中文文案统一、错误弹窗优化

### v1.4.0 — 回合计时器 (Turn Timer)

- 新增 per-turn 倒计时（不限时 / 30秒 / 60秒）
