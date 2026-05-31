# 3D Billiards v1.8.1 — Latest Update

## What's New in v1.8.1

### 🐛 Bug Fixes & Polish

**高优先级修复（2 项）**

| # | 问题 | 修复 |
|---|------|------|
| 1 | `Game.js` 中 `TABLE` 常量未导入导致 `resolveTurn()` 运行时错误 | 补全 `import { ..., TABLE } from '../config.js'` |
| 2 | `ShotAnalyzerPanel.js` 引用未定义的 `BALL_COLORS` | 在文件顶部添加与 `TrajectoryGraph.js` 一致的字符串颜色表 |

**中优先级修复（4 项）**

| # | 问题 | 修复 |
|---|------|------|
| 3 | `TrajectoryGraph.js` 中硬编码 `32`（每帧浮点数） | 提取为 `FLOATS_PER_FRAME` 常量，提升可维护性 |
| 4 | `ShotAnalyzerPanel.js` 回放速度按钮无实际功能 | 为 `TrajectoryGraph` 添加 `playbackSpeed` 属性与 `setPlaybackSpeed()` 方法，按钮点击后实际生效 |
| 5 | `AudioManager.js` 的 `statechange` 恢复时不处理待启动 BGM | `_stateHandler` 在 context 变为 `running` 后检查 `_pendingBGMStart`，自动启动 BGM |
| 6 | `SettingsScreen.js` 中回放设置仍标记为 disabled | 自动保存回放、最大回放数、回放速度三个设置项已启用（后端功能在 v1.8.0 已实现） |

---

## What's New in v1.8.0

### 🎯 Shot Analyzer (击球分析器)

每次击球后自动显示详细分析面板。

**三大标签页**

| 标签 | 内容 |
|------|------|
| **概览** | 击球评分、AI 建议与改进提示 |
| **轨迹图** | 交互式 2D 球路回放，支持缩放与逐帧查看 |
| **碰撞详情** | 每次碰撞的球号、速度、角度与能量损失 |

**其他特性**

- 支持从回放库中打开历史击球的分析
- 可在设置中随时开启或关闭自动显示

---

## What's New in v1.7.44

### 🔍 UI/UX/SFX/BGM Deep Audit & Spectator Mode Polish

**观赛模式体验改进（5 项）**

| # | 改动 | 详情 |
|---|------|------|
| 1 | **回合结果消息保留** | `Game.startAITurn()` 在 bothAI 模式下不再覆盖 `resolveTurn()` 的回合结果消息（犯规/换行/自由球等），观众现在能正确看到每条回合反馈 |
| 2 | **相机键冲突消除** | 禁用 1/2/3 相机快捷键在 bothAI 模式下对 `_resetCameraFree/Top` 的直接操作，避免与 `CameraDirector` 的平滑过渡产生跳变 |
| 3 | **浮动文字泄漏修复** | `Game.update()` 和 `_onNetPocketEvent` 中的进球浮动文字（`+1`、`🎱 8号球!`）在 bothAI 模式下被屏蔽，不再穿透广播覆盖层 |
| 4 | **小地图泄漏修复** | `SpectatorMode._hideDefaultHUD()` 现在正确隐藏 `.table-minimap`，返回菜单后自动恢复 |
| 5 | **进球计数修复** | `SpectatorMode._detectStateChanges` 在 `SHOOTING` 开始时重置 `_lastPocketCount`，修复连续回合进球解说遗漏问题；移除对不存在 `RESOLVING` 状态的依赖 |

**广播 UI 响应式适配（2 项）**

| # | 改动 | 详情 |
|---|------|------|
| 6 | **移动端布局优化** | 解说框在小屏幕下宽度自适应（`min(320px, 46vw)`），顶部栏高度从 52px 降至 44/40px，选手名 `max-width` 改为 `min(160px, 22vw)` |
| 7 | **z-index 层级修正** | 广播覆盖层从 `z-index: 15` 提升至 `18`，高于推杆按钮（15）但低于菜单层（20），避免视觉竞争 |

**主菜单布局优化（1 项）**

| # | 改动 | 详情 |
|---|------|------|
| 8 | **按钮重新分区** | 「AI 对战观赛」从「开始游戏」（5→4 个按钮）移至「资料与社交」（3→4 个按钮），2×2 网格视觉更均衡 |

**无障碍改进（1 项）**

| # | 改动 | 详情 |
|---|------|------|
| 9 | **HUD 按钮 aria-label** | 返回菜单、认输、再来一局、设置四个底部 HUD 按钮新增 `aria-label`，提升屏幕阅读器兼容性 |

---

## Historical Updates

### v1.7.43 — AI Spectator Mode with Broadcast Camera & Live Commentary

全新「AI 对战观赛」模式——作为观众观看两台 AI 自动对弈，配有电影级转播视角和实时文字解说。

**新增模块（4 个）**

| 模块 | 文件 | 职责 |
|------|------|------|
| **CameraDirector** | `src/spectator/CameraDirector.js` | 5 种转播视角（自动/俯视/跟随母球/袋口特写/选手肩后），弹簧阻尼平滑切换 |
| **CommentarySystem** | `src/spectator/CommentarySystem.js` | 事件驱动实时解说（开球、进球、犯规、换人等），支持连击追踪与打字机效果 |
| **BroadcastUI** | `src/spectator/BroadcastUI.js` | 直播风格 HUD：顶部选手条、左下角比赛统计、右下角解说框、中央事件徽章 |
| **SpectatorMode** | `src/spectator/SpectatorMode.js` | 主控制器，协调相机/解说/UI，纯观察层不干扰游戏物理 |

**集成改动（3 个文件）**

| 文件 | 改动 |
|------|------|
| `MainMenuScreen.js` | 「开始游戏」区新增「AI 对战观赛」入口按钮 |
| `MenuSystem.js` | spectator 模式启动/停止流程，游戏循环中注入 `spectator.update(dt)` |
| `Game.js` | 支持 `bothAI` 双 AI 对战：双 AI 实例、输入完全屏蔽、回合自动触发、push-out 自动处理 |

**修复（深度审查）**

| # | 问题 | 修复 |
|---|------|------|
| 1 | 获胜者名称硬编码为 "AI Alpha/Beta" | 改为读取实际玩家名 |
| 2 | `CommentarySystem` 存在未使用导入 | 移除 `getBallType`、`BALL_TYPE` 和 `_gamePhase` |
| 3 | `BroadcastUI.destroy()` 调用 `hide()` 产生悬空 `setTimeout` | `hide()` 中保存 timeout 引用，`destroy()` / `show()` 中统一清除 |
| 4 | `CameraDirector` `_tmpVec3` 在 cueBall 缺失时别名冲突 | 新增独立 `_tmpVec3c` |
| 5 | `_eightBallAnnounced` / `_totalShots` 未在 `start()` 中重置 | 多局观赛状态正确重置 |

---

（以下历史版本详见完整文件）
