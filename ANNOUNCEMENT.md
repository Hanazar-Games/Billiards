# 3D Billiards v1.7.43 — Latest Update

## What's New in v1.7.43

### 🎬 AI 对战观赛模式 (Spectator Mode)

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

**UI/UX 细节**
- 观赛模式下默认 HUD 自动隐藏，转播覆盖层独占显示
- 仅保留 Escape（返回菜单）和 1/2/3（手动切换相机视角）键盘响应
- 比赛结束后显示 🏆 获胜徽章与获胜者名称
- 自动检测 8 号球决胜时刻并触发「黑八时刻」解说

**修复（本轮深度审查）**

| # | 问题 | 修复 |
|---|------|------|
| 1 | 获胜者名称硬编码为 "AI Alpha/Beta" | 改为读取实际玩家名（`networkPlayer1Name` / `networkPlayer2Name`） |
| 2 | `CommentarySystem` 存在未使用导入 | 移除 `getBallType`、`BALL_TYPE` 和 `_gamePhase` 未使用变量 |
| 3 | `BroadcastUI.destroy()` 调用 `hide()` 产生悬空 `setTimeout` | `hide()` 中保存 timeout 引用，`destroy()` / `show()` 中统一清除 |
| 4 | `CameraDirector` `_tmpVec3` 在 cueBall 缺失时产生别名冲突 | 新增独立 `_tmpVec3c` 用于 `desiredLook` 计算 |
| 5 | `_eightBallAnnounced` / `_totalShots` 未在 `start()` 中重置 | 多局观赛时状态正确重置 |

---

## Historical Updates

### v1.7.42 — Fifth-Round Global Deep Audit — Panel Lifecycle & Memory Leak Fix Sweep

**菜单面板生命周期（6 项）**

| # | 改动 | 详情 |
|---|------|------|
| 1 | **LanRoomPanel WebSocket 监听器泄漏修复** | `_connect()` 向 `NetworkClient` 添加了约 10 个事件监听器，但 `hide()` / `destroy()` 从未移除；现通过 `_clientListeners` 数组统一追踪，在清理阶段全部 `removeEventListener` |
| 2 | **LanRoomPanel 输入框监听器泄漏修复** | `_joinInput` 的 `input` 事件监听器在 `show()` 中添加但从未移除；现存储句柄并在 `destroy()` 中移除 |
| 3 | **LanRoomPanel `hide()` 竞态修复** | 原先在淡出前立即 `this.client = null`，若淡出期间收到网络事件会导致空指针；现将 client 清理移入 `setTimeout` 回调，与 DOM 移除同步 |
| 4 | **MainMenuScreen `destroy()` 完整性** | 补充 `this._showRaf` 的构造器初始化与 `destroy()` 取消；补充 `_quitBtn.onfocus` / `onblur` 置空；补充 8 个外部回调引用置空，防止闭包滞留整个菜单实例 |
| 5 | **AchievementPanel `showToast()` 空指针泄漏修复** | 原先在 `toastContainer` 为 `null` 时仍创建完整 toast DOM，然后才 `return`，产生游离 DOM 节点；现将 `if (!this.toastContainer) return` 移至 DOM 创建之前 |
| 6 | **AchievementPanel 单例容器竞态修复** | `_buildToast()` 的 DOM 单例复用导致两个实例共享同一容器，`destroy()` 会误删另一实例的容器；现标记 `_ownsToastContainer`，仅在创建者销毁时才移除 DOM |

**挑战 & 成就系统（2 项）**

| # | 改动 | 详情 |
|---|------|------|
| 7 | **ChallengeManager `_saveBest()` 内存同步修复** | 写入 `localStorage` 后未更新内存中的 `this.best`，导致 `getResultStats()` 的 `prevStars` 和 `isNewRecord` 在本会话内始终报告旧值；现写入后立即同步 `this.best` |
| 8 | **ChallengeManager 完成次数统计修正** | `_saveBest()` 原仅在 `isNewRecord && stars > 0` 时增加 `completions`，导致重复完成同星级挑战不计数；现改为只要 `this.completed && stars > 0` 就增加，与「总完成次数」语义一致 |

** onboarding & 成就墙（3 项）**

| # | 改动 | 详情 |
|---|------|------|
| 9 | **OnboardingTips `destroy()` 清理修复** | `gotIt` 按钮的 `onmouseenter` / `onmouseleave` / `onclick` 内联处理器在销毁时未置空；现在先置空处理器再移除 DOM |
| 10 | **AchievementPanel `showToast()` RAF 泄漏修复** | 动画入场使用的 `requestAnimationFrame` 未被追踪，若面板在帧回调前被销毁则 RAF 泄漏；现存储 `_toastShowRaf` 并在 `destroy()` 中取消 |
| 11 | **AchievementPanel 成就墙标签清理修复** | `destroy()` 未置空标签按钮的内联事件处理器；现遍历 `ach-tabs` 下的所有按钮并清空处理器 |

---

### v1.7.41 — Fourth-Round Global Deep Audit — FX/Input/Renderer/Lifecycle Bug Fix Sweep

**UI/UX & Lifecycle**

| # | 改动 | 详情 |
|---|------|------|
| 1 | **HUD 返回按钮添加 `id`** | `UI.js` 动态创建的返回菜单按钮新增 `id="back-to-menu"`，修复 `smoke.test.js` 中 Trainer/Challenge 模式的「Drill/Challenge game UI visible」检测失败 |
| 2 | **MenuSystem 状态机竞态修复** | `_startTrainer` / `_startChallenge` 现在拒绝 `TRANSITION` 状态下的重叠启动，避免快速点击导致多个 Game 实例并发 |
| 3 | **`_delay()` 竞态修复** | 将共享的 `this._delayTimer` / `this._delayResolve` 改为独立的 `setTimeout` Promise，消除跨过渡的计时器覆盖问题 |
| 4 | **`_startChallenge` 缺失 dispose 修复** | 补充与 `_startGame` / `_startTrainer` 一致的旧 Game/Loop 清理逻辑，防止重复进入挑战时内存泄漏 |
| 5 | **`_returnToMenu` 清理完整性** | 补充 `activeDrill` 置空和 `trainerResult` 销毁，退出训练模式后不再残留结果覆盖层 |
| 6 | **`_quit()` 不再销毁全局 `keyBindings`** | `keyBindings` 是模块级单例，`_quit()` 中销毁会导致重建 MenuSystem 后键盘输入失效；已移除该调用 |
| 7 | **`_onMatchGameEnd` 空指针防护** | 添加 `if (!this.game) return`，防止比赛结束时游戏已被提前 dispose 导致崩溃 |
| 8 | **训练/挑战 init 失败清理** | 错误路径中补充 `drillManager`/`activeDrill` 和 `challengeManager`/`activeChallenge` 置空，避免失败后的状态残留 |
| 9 | **`_showMainMenu` DESTROYED 防护** | 防止 `_quit()` 后被调用的 `_showMainMenu()` 在已销毁的实例上恢复菜单交互 |
| 10 | **SettingsScreen 重建优化** | `_switchCategory` 增加同分类早退、`show()` 增加可见性检测，避免重复重建破坏用户输入状态 |
| 11 | **设置面板音频方法防护** | `setAudioManager` 中 `setAmbientVolume` 调用增加方法存在性检查 |
| 12 | **`pushOutButton` 中文化** | `'Push-out'` → `'击球权转移'`，与 UIText 中其他中文字符串保持一致 |

**FX 层**

| # | 改动 | 详情 |
|---|------|------|
| 13 | **ScreenShake `reducedMotion` 支持** | `trigger()` 现在检查 `settings.get('reducedMotion')`，为 Motion 敏感用户提供无障碍支持 |
| 14 | **ScreenShake 空指针防护** | `trigger()` / `cancel()` 增加 `this.camera` 存在性检查；`dispose()` 前先调用 `cancel()` 防止相机永久偏移 |
| 15 | **ScreenShake 零向量防护** | `trigger()` 中拒绝 `direction.lengthSq() < 0.001`，避免 `normalize()` 产生 NaN 永久污染相机位置 |
| 16 | **ImpactShockwave `reducedMotion` 支持** | `spawn()` 现在检查 `settings.get('reducedMotion')`，并增加 `this.scene` 存在性检查 |
| 17 | **PowerLabel `reducedMotion` 支持** | `show()` 现在检查 `settings.get('reducedMotion')`，避免强制动画干扰 |
| 18 | **PowerLabel 空元素防护** | `_ensureElement()` 在 `document.body` 未就绪时返回，`show()` 中增加 `if (!this.el) return` |
| 19 | **PowerLabel dispose 完整性** | 无论元素是否仍在 DOM 中，`dispose()` 都置空 `this.el`，防止 RAF 循环在销毁后意外重启 |
| 20 | **ParticleSystem `setEnabled(false)` 立即清除** | 关闭粒子时立即调用 `clear()` 移除所有活跃粒子，与 `ShotTrailSystem` 行为一致 |
| 21 | **ParticleSystem 强度下限修正** | `_getIntensityMult()` 的 `0.2` 硬编码下限改为 `0`，允许通过强度设置完全关闭粒子 |

**输入 & 渲染**

| # | 改动 | 详情 |
|---|------|------|
| 22 | **InputHandler `dispose()` 空元素防护** | 增加 `if (!this.element) return`，防止画布已移除时抛 `TypeError` |
| 23 | **InputHandler 回调置空** | `dispose()` 末尾将 `onMouseMove`/`onMouseDown`/`onMouseUp`/`onRightMouseDown`/`onRightMouseUp` 置 `null`，消除闭包导致的 GC 滞留 |
| 24 | **InputHandler blur 事件对象** | `_handleBlur()` 现在向回调传入合成事件对象 `{ type: 'blur', button: 0/2 }`，避免消费者读取 `e.clientX` 时崩溃 |
| 25 | **Renderer `renderScale` 持久化** | 窗口 `resize` 时 `onResize()` 现在读取并应用 `_renderScale`，修复调整浏览器大小后渲染缩放被重置为 1.0 的问题 |

---

（以下历史版本省略，详见完整文件）
