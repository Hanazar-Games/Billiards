# 3D Billiards v1.26.1 — Latest Update

## What's New in v1.26.1

### 🔧 v1.26.0 深度审计修复 — Critical 1 + High 6 + Medium 5 + Low 3

在 v1.26.0「精彩瞬间」功能发布后，立即启动 3 条并行深度审计流水线（Highlight 系统、UI/UX 全项目、SFX/BGM 音频），并辅以手动走查，共发现并修复 15 项问题。

**Critical（崩溃/功能异常级）：**
- `Game.js resolveTurn()` 中 `highlightStore.save()` 使用了尚未定义的 `result` 变量：`result = this.rules.resolveShot()` 在 save 调用之后才执行，导致 `isGameWinner` 永远是 `undefined`，CLUTCH_WIN 标签和决胜球星级评分完全失效。已将 save 逻辑分别移到 trainer / freeplay / normal 三个分支的正确位置。
- `AudioManager.init()` 未重置 `_disposing`：`dispose()` 将其设为 `true` 后，`reinit()`（如切换低延迟模式）复用同一实例，`_disposing` 仍为 `true`，导致 `_autoDisconnect` 跳过断开 SFX 节点，每次音效都泄漏 Web Audio 节点。已在 `init()` 入口重置 `_disposing = false`。

**High（明确的 bug 或不一致）：**
- `MenuSystem._hideAllPanels()` 遗漏 `this.highlightPanel`：打开其他面板（如成就、回放）时，精彩瞬间面板不会被隐藏，造成 z-index 重叠。已补充 `hide(this.highlightPanel)`。
- `SettingsScreen` 缺失 Escape 键盘关闭：作为唯一不响应 Escape 的主要模态面板，破坏键盘无障碍一致性。已添加 `_setupKeyboard()`，支持 Escape 关闭并 `stopPropagation()`。
- `LanRoomPanel` / `MatchSetupPanel` 缺失 Escape 键盘关闭：两个网络/匹配模态面板均无键盘关闭支持。已分别为两者添加 `_setupKeyboard()`。
- `SettingsScreen` 两处 `setTimeout` 硬编码：`400ms` 保存 toast 延迟和 `600ms` 首次提示延迟未接入 `animMs()`。已统一改为 `animMs(400)` / `animMs(600)`。
- 15 处 CSS transition 硬编码未接入 `--ui-anim-speed`：`ShotAnalyzerPanel.js`（3 处）、`CareerPanel.js`（4 处）、`TournamentPanel.js`（2 处）、`StatsPanel.js`（2 处）、`LanRoomPanel.js`（1 处）、`MatchSetupPanel.js`（2 处）、`HighlightPanel.js`（1 处）均使用固定秒数。已全部替换为 `calc(Xs / var(--ui-anim-speed))`。

**Medium（代码异味、边界情况、可维护性）：**
- `AudioManager.playPocket()` 绕过 `_safeVolumeScale()`：直接读取 `settings.get('pocketVolumeScale') ?? 1.0`，若设置值为 `NaN` 会导致 gain 为 `NaN` 并抛出 DOMException。已改为 `this._safeVolumeScale('pocketVolumeScale')`。
- `_safeVolumeScale()` 无上界钳制：若设置注入大于 1.0 的值（如 `Infinity`），会直接传入 Web Audio 导致削波失真。已添加 `Math.min(..., 2.0)` 上限。
- `AudioManager.toggleSound()` 未规范化 `enabled`：传入 `undefined` 时 `this.soundEnabled` 变为 `undefined`，逻辑判断异常。已改为 `Boolean(enabled)`。
- `AudioManager.stopBGM()` 直接切断振荡器：非零交叉处停止正弦波会产生可闻 click/pop。已添加 `this._bgmGain.gain` 的 80ms 指数淡出，并将 `node.stop(t)` 推迟到 `t + 0.08`。
- `UI.js` 4 处 `reduce-motion` 检查未使用 `isReducedMotion()` 辅助函数：内联 `document.documentElement.classList.contains('reduce-motion')` 与全代码库风格不一致。已统一替换为 `isReducedMotion()`。

**Low（代码整洁度）：**
- `UI.js` `_addTrackedListener()` 死代码：方法存在但从未被调用，`_aiListeners` 数组始终为空。已移除该方法。
- `MenuSystem._delay()` 未暴露 timer/resolve：`_clearPendingTimeouts()` 引用 `this._delayTimer` / `this._delayResolve` 但 `_delay()` 从不设置它们，导致延迟无法被取消。已改为存储 timer 和 resolve 引用。
- `index.html` 错误覆盖层按钮缺少 `type="button"`：虽然不在 `<form>` 内，但存在未来意外提交风险。已补充 `type="button"`。

**构建与测试：**
- 全部 20 项 highlight 单元测试通过
- 全部 131 项 Node 测试通过（0 失败）
- `npm run build` 成功

---

## What's New in v1.26.0

### ✨ 精彩瞬间 — 自动识别 & 收藏墙

新增 **Highlight / 精彩瞬间** 系统，自动检测并收藏游戏中的难忘击球，无需手动操作。

**自动识别引擎（10 种标签）：**
- 📏 长台进攻（距离 > 160cm）
- 🔪 精准薄球（高分 + 低碰撞 + 短距离）
- 🏦 翻袋进球（碰库后再进球）
- 💥 重炮击球（力量 > 75%）
- 🌀 旋转进球（使用 spin）
- 🔢 多球连进（单杆 ≥ 2 球）
- 💢 高频碰撞（≥ 4 次球-球碰撞）
- 🏆 决胜球（制胜一击）
- ⚡ 连杆（连续 ≥ 3 杆进球）
- ✨ 完美走位（ShotRecorder 评分 ≥ 70）

**星级评分（1–3 ⭐）：** 综合进球数、难度标签、评分自动计算，最高三星。

**收藏墙面板：**
- 玻璃拟态卡片网格，按标签筛选（全部 / 10 种分类）
- 每条瞬间显示标题、标签、星级、摘要、日期、模式
- 一键回放（直接调用即时回放引擎）
- 导出 JSON（可分享或备份）
- 单条删除 + 全局清空
- 顶部统计栏：总数、平均星级、三星数量
- 支持 `reducedMotion` 无障碍模式
- 支持 `uiAnimSpeed` 动画速度缩放

**技术实现：**
- `src/highlight/HighlightData.js` — 纯数据检测逻辑，零 DOM 依赖
- `src/highlight/HighlightStore.js` — localStorage 持久化，最大 50 条 FIFO，5s 防重复
- `src/highlight/HighlightPanel.js` — 独立面板，遵循面板生命周期规范
- `Game.js resolveTurn()` — 每杆结束后自动调用 `highlightStore.save()`
- `ShotRecorder.setExtra()` — 补充 `firstHitDistance` / `isBank` 等元数据
- 菜单入口集成到「资料与社交」分组

**测试：** 新增 20 项单元测试，覆盖检测逻辑、存储生命周期、去重、FIFO、统计

---

## What's New in v1.25.0

### 🔍 第三轮总体深度审计 — UI/UX/SFX/BGM/Core 全维度修复 8 项 Critical + 14 项 High + 12 项 Medium

在 v1.24.0 第二轮审计基础上，启动 4 条并行 background audit 流水线（UI/UX 面板、SFX/BGM 音频、FX 视觉效果、核心游戏逻辑），并辅以手动走查，共发现并修复 34 项问题。

**Critical（崩溃/功能异常级）：**
- `StatsPanel` Game Over 键盘监听器泄漏：`_gameOverKeyHandler` 通过 `document.addEventListener` 注册，但 `_hideGameOver()` 从未移除，每局游戏结束后按 Escape 都会触发且监听器累积。已在 `_hideGameOver()` 中补充 `removeEventListener`。
- `MenuSystem` 回放资源竞态：`_startReplayPlayback()` 在状态改为 `'REPLAY'` 后才清理旧场景，快速连点可能导致旧 `Three.js` 对象和 physics body 泄漏。已在函数入口前置 `this._cleanupReplayScene()`。
- `UI.js` Confirm Dialog 快速重复打开：旧的 overlay 在 250ms 过渡期间仍留在 DOM，且 `close()` 的 `setTimeout` 未被追踪，快速打开→关闭→打开会导致旧 handler 引用丢失。已保存 `_confirmCloseTimer` 并在 `destroy()` 中清理。
- `AudioManager.dispose()` 不停止 SFX：dispose 后 `_disposing` 被重置为 `false`，异步回调（如 `_autoDisconnect` 的 timeout）无法判断生命周期已结束。已改为保留 `_disposing = true`，并在 `_autoDisconnect` 中增加 disposing 时禁止创建新 timer 的防护。
- `AudioManager` 各 `settings.get('xxxVolumeScale')` 使用 `?? 1.0` 无法过滤 `NaN/Infinity`，直接传入 Web Audio API 会抛出 `DOMException`。已新增 `_safeVolumeScale()` 统一过滤非有限值。
- `Game.js` 网络客户端在即时回放期间收到延迟的口袋事件会播放不该播放的音效：`_onNetPocketEvent` 检查了 `this.paused`，但未检查 `this.state === 'REPLAYING'`。已补充 `REPLAYING` 守卫。
- `ScreenShake.js` 完全未接入 `fxAnimSpeed`：高强度击球时震动时长固定，无法通过设置加速/减速。已在 `trigger()` 中读取 `settings.get('fxAnimSpeed')` 并缩放时长。
- `BallReturnSystem.js` 无任何 `reducedMotion` 检查：减弱动态模式下仍执行完整的掉落→滑动→归位 3 阶段动画。已添加 `reducedMotion` 分支，直接放置到目标位置。
- `index.html` 缺失 `@keyframes badgePulse`：Three-foul 警告徽章内联样式引用 `badgePulse`，但全局 CSS 中不存在该 keyframe，导致动画实际永不生效。已补充 keyframe 定义。
- `Game.js _startInstantReplay()` 未调用 `this.screenShake?.cancel()`：若回放开始时 screenShake 仍在衰减，`_restoreCameraState()` 会把带有震动偏移的脏相机状态保存并恢复，导致回放结束后相机残留偏移。已补充 `cancel()` 调用，并同步暂停 BGM、清理 `_cameraResetTimer`。
- `InstantReplayCamera.js` 平滑注视方向未生效：`_currentLook` 被逐帧 lerp，但 `lookAt` 直接指向了未平滑的 `_targetLook`，导致 `_currentLook` 的计算完全浪费，相机注视点会出现跳变/抖动。已修正为 `this.camera.lookAt(this._currentLook)`。
- `Game.js resolveTurn()` 使用 `this.table?.pocketPositions`（属性），但 `Table` 实际暴露的是 `getPocketPositions()` 方法，导致击球分析面板拿不到袋口坐标。已统一改为方法调用。

**High（明确的 bug 或不一致）：**
- 全部 10 个面板/结果屏幕的 Escape 键盘事件未 `stopPropagation()`：当多个面板同时处于显示状态时，按 Escape 会同时触发多个面板的关闭逻辑。已在每个 Escape handler 中加入 `e.stopPropagation()`。
- `SettingsScreen._switchCategory` 使用硬编码 `120ms` 延迟：未接入 `animMs()`，当用户将 `--ui-anim-speed` 调至很慢时，切换动画与 CSS transition 时长不一致。已改为 `animMs(120)`。
- `AchievementPanel` Toast opacity transition 硬编码 `0.4s`：未接入 `--ui-anim-speed`。已改为 `calc(0.4s / var(--ui-anim-speed))`。
- `AchievementPanel` Toast auto-dismiss 时长硬编码 `3500ms`：未使用 `animMs(3500)`。已接入动画速度。
- `SettingsScreen` Toast 系统硬编码 `2000ms` 停留时间：不受 `animMs()` 影响。已改为 `animMs(2000)`。
- `UI.js` `showReplayHint` 的 RAF 未保存 ID：在 `destroy()` 中无法取消。已保存到 `this._replayHintRaf`。
- `UI.js` Three-foul 警告徽章 `animation: badgePulse 2s` 硬编码：未接入 `--ui-anim-speed`。已改为 `calc(2s / var(--ui-anim-speed))`。
- `index.html` `#turn-timer.warning` / `.danger` 的 `animation: timerPulse` 时长完全硬编码：未使用 `--ui-anim-speed`。已改为 `calc(0.6s / ...)` 和 `calc(0.35s / ...)`。
- `TournamentResult._appendSeasonContext` 重复操作 DOM：在 `_render()` 已设置 `display = 'flex'` 后，再次设置 `opacity = '0'` 并触发 RAF 淡入，视觉上可能出现闪烁。已添加 `display !== 'flex'` 守卫，避免重复淡入。
- `ReplayPanel._importReplays` 的 `<input type="file">` 未作为实例属性追踪：若用户在 5 秒 timeout 内销毁 ReplayPanel，input 可能残留 DOM。已改为 `this._importInput` 并在 `destroy()` 中清理。
- `ShotAnalyzerPanel` 缺少 `isReducedMotion()` 检查：bar fill transition 未考虑无障碍设置。已添加 `reducedMotion` 判断。
- `Game.js _handleSettingsChange()` 完全不处理音量相关 key：非 UI 路径修改音量不会同步到 AudioManager。已补充 10 个音量 key 的 `syncVolumesFromSettings()` 调用。
- `AudioManager._settingsChangedHandler` 仅监听 `muteWhenUnfocused`：不监听音量变化。已补充全部音量 key 的监听。
- `main.js` Intro screen 清理不完整：嵌套 `setTimeout` 若应用在初始化阶段崩溃无法被取消。已导出 `__introHideTimer` / `__introRemoveTimer` 以便取消。

**Medium（代码异味、边界情况、可维护性）：**
- `TournamentPanel.destroy()` 未清理 `_nameInput`、`_selectedColorIndex` 等 DOM 引用。已补充 null 化。
- `ReplayPanel.destroy()` 未清理 `playBtn.onclick`、`speedBtn.onclick`、`progressBar.onclick` 等事件处理器。已补充清空。
- `Game.js onMouseDown/onMouseUp` 入口缺少 `this.state === 'DISPOSED'` 末段防护：浏览器事件队列中可能存在待执行的 mouseup，回调一旦执行会访问已被 dispose 的资源。已添加 DISPOSED 守卫。
- `Game.js resolveTurn()` 入口缺少 `DISPOSED` 防护：若 `dispose()` 恰好在同一帧稍早被调用，update() 顶部的守卫可能挡不住已进入调用栈的 `resolveTurn`。已添加 DISPOSED 守卫。
- `Game.js update()` 对 `ballsManager` 缺少空指针防御：若在 `resetGame()` 或 `dispose()` 执行过程中意外进入一帧 `update`，会直接抛异常。已前置判空。
- `Game.js _endInstantReplay()` 未清理 `_cameraResetTimer`：与 `_startInstantReplay` 类似，回放被手动跳过时延时器可能突然拉走相机。已补充清理。

**构建与测试：**
- 全部 10 组非浏览器测试通过（227/227）
- `npm run build` 成功

---

# 3D Billiards v1.24.0

## What's New in v1.24.0

### 🔍 UI/UX/SFX/BGM 深度审计 Round 2 — 修复 6 项 Critical + 8 项 High + 6 项 Medium

在 v1.23.0 第一轮审计基础上，启动 4 条并行 background audit 流水线（Game.js dispose/safety、SFX/BGM 状态切换、面板生命周期 + RAF/timer、CSS 动画 + reducedMotion），并辅以手动走查，共发现并修复 20 项问题。

**Critical（崩溃/泄漏级）：**
- `TournamentPanel.show()` / `TournamentResult.show()`：使用匿名 `requestAnimationFrame()` 做淡入动画，但 `destroy()` 未存储/取消该 RAF ID。若面板在淡入期间被销毁，回调会在已释放的 DOM 节点上执行，轻则无意义 RAF 泄漏，重则访问已移除元素的 `style` 抛出异常。已统一添加 `_showRafId` 字段并在 `destroy()` 中 `cancelAnimationFrame`。
- `Game.js shoot()`：`this._cameraResetTimer` 未在每次出杆前清理，快速连续出杆时旧 timer 仍存活，导致相机在不应该的时候跳回默认视角。已在 `shoot()` 入口与 `_enterAimState()` 前统一清理。
- `Game.js _wireBallsManagerEvents()`：`onManualBallContact` / `onManualCushionContact` 闭包持有 `this` 引用，但 `dispose()` 仅 `this.ballsManager = null`，未将 callbacks 设为 `null`，旧的 `BallsManager` 实例仍保留对 `Game` 的强引用，造成内存泄漏。已在 `dispose()` 中补充 callback nullification。
- `Game.js startAITurn()`：未在入口检查 `this.state === 'DISPOSED'`，游戏销毁后 AI 仍在计划/瞄准阶段时会继续执行并访问已释放资源。已在顶部添加 DISPOSED 守卫。
- `MenuSystem` 错误路径 BGM 丢失：`startTournamentMatch` / `startTrainer` / `startChallenge` / `startGame` 的 `try…catch` 失败分支均调用 `_fadeToMenu()` 返回菜单，但未重启 BGM，用户回到菜单后无背景音乐。已将 BGM 重启逻辑统一到 `_fadeToMenu()`，保证任何回退到菜单的场景都有音乐。

**High（严重影响级）：**
- 硬编码 CSS 过渡时长（8 处）：ChallengePanel、TrainerPanel、ReplayPanel 中的 hover/卡片交互 transition 使用 `180ms` / `400ms` 字面量，未接入 `--ui-anim-speed`，与用户设置的动画速度不一致。已全部改为 `calc(0.18s / var(--ui-anim-speed))` / `calc(0.4s / var(--ui-anim-speed))`。
- `panelIn` 动画缺少 `isReducedMotion()` 守卫（5 个文件）：StatsPanel、TournamentResult、TournamentBracket、TournamentPanel、UI.js（暂停面板）的入场动画均未检查 reduced-motion 偏好， motion-sensitive 用户仍会看到缩放淡入。已统一添加 `isReducedMotion() ? 'none' : 'panelIn ...'` 条件。
- `Game.js` AI aiming 时长硬编码：`const aimDuration = 350 + Math.random() * 300;` 不受 `fxAnimSpeed` 影响。已改为 `animMs(350 + Math.random() * 300)`。
- `UI.js` turn-badge pulse 硬编码：`setTimeout(..., 180)` 不受 `fxAnimSpeed` 影响。已改为 `animMs(180)`。
- `main.js` intro 清理硬编码：`setTimeout(() => introScreen?.remove(), 1400)` 不受 `fxAnimSpeed` 影响。已改为 `animMs(1400)`。
- `Game.js _concede()` 错误 SFX：认输时播放 `playWin()`（胜利音效），应为 `playFoul()`（犯规音效）+ `flashRed()`。已修正。
- `AudioManager.playCushionBounce()`：缺少 `Number.isFinite(velocity)` 守卫，与 `playBallCollision` 不一致。已补充 `if (!Number.isFinite(velocity)) velocity = 5;`。
- `AudioManager.dispose()`：重复调用时 `_disposing` 会被末尾的 `= false` 重置，导致第二次 dispose 不生效。已在入口添加 `if (this._disposing) return;` 防护。

**Medium（明显缺陷级）：**
- `ReplayPanel.showControls()` / `hideControls()`：缺少 `_controlsShown` 去重，重复调用会导致 `uiLayout.claim/release` 失衡。已添加早期返回。
- `Game.js` 网络 client pocket SFX：`_onNetPocketEvent` 未检查 `this.paused`，游戏暂停时仍收到网络 packet 会播放口袋音效。已添加 `if (this.paused) return;` 守卫。
- `Game.js` AI aim RAF tick 中 `this.ballsManager.getCueBall()` 未做空守卫：dispose 期间可能返回 `null`。已补充 `const cb = this.ballsManager ? this.ballsManager.getCueBall() : null;` 并做空判断。
- `Game.js _onKeyDown`：未检查 `this.state === 'DISPOSED'`，游戏销毁后键盘事件仍可触发逻辑。已添加 DISPOSED 守卫。

**构建与测试：**
- 全部 13 组非浏览器测试通过（54/54）
- `npm run build` 成功

---

# 3D Billiards v1.23.0

## What's New in v1.23.0

### 🔍 UI/UX/SFX/BGM 深度审计 — 修复 4 项 High + 6 项 Medium

对 v1.20.0–v1.22.0 新增功能（成就 Toast、训练/挑战数据安全、面板生命周期治理）进行逐文件深度复查，覆盖 UI 渲染、动画一致性、SFX/BGM 状态切换、事件泄漏、NaN/undefined 显示、键盘路由、reducedMotion/uiAnimSpeed 合规。

**High（严重影响级）：**
- `AchievementStore.getUnlockTime`：使用 `|| null` 导致 epoch 0（1970-01-01）被误判为 `null`，成就墙解锁日期会显示为空白。已改为 `?? null` 以正确保留 `0` 值。
- `AchievementPanel.showToast`：去重逻辑仅检查 `_toastQueue`，未检查 `_activeToasts`，同一成就可在 3 个可见 toast 内被重复渲染导致重叠。已在入队前同时检查 visible + queue，并在 entry 上记录 `achId` 用于比对。
- `DrillManager.onShot` / `AchievementSystem.onShot`：`spin` 参数未做空值守卫，当调用方传入 `undefined` 时 `Math.abs(spin.x)` 会直接抛出 `TypeError`。已统一补充 `spin || { x: 0, y: 0 }` 回退。
- 5 处面板入场动画硬编码 `260ms`：CareerPanel、TrainerPanel、ChallengePanel、ReplayPanel 的 `show()` 均使用 `'panelIn 260ms ...'` 字面量，未接入 `--ui-anim-speed`，与 v1.22.0 修复的 AchievementPanel 不一致。已全部改为 `calc(0.26s / var(--ui-anim-speed))`。

**Medium（明显缺陷级）：**
- `TournamentResult._appendSeasonContext`：`seasonStats.totalEntered`、`championships`、`currentStreak`、`bestStreak` 未做 `??` fallback，若 SeasonStats 字段缺失会显示 `undefined` 字符串。已补充 `?? 0` 回退。
- `AchievementPanel._renderToast`：reducedMotion 下 transition 使用 `0.01ms`，部分浏览器仍可能渲染一帧过渡闪烁。已改为 `0.001s` 并同步更新测试断言。
- `MenuSystem._stopTrainer`：局部变量 `drillId` 实际存储的是 drill 对象而非 ID，命名具有误导性。已重命名为 `drill` 以准确反映其类型。

**构建与测试：**
- 全部 13 组非浏览器测试通过
- `npm run build` 成功
- 新增测试：`deduplicates against active toasts`

---

# 3D Billiards v1.22.0

## What's New in v1.22.0

### 🛡️ 内容系统 + UI 生命周期总体审计 — 修复 6 项 Critical + 6 项 High + 5 项 Medium

对全仓库进行了跨模块的总体审计，覆盖 trainer、challenges、career、tournament、achievements、replay、analyzer、ui、game 目录，重点检查面板重叠、Escape 路由冲突、事件/timer/RAF 泄漏、localStorage 坏数据、NaN/undefined 显示、reducedMotion/uiAnimSpeed 合规。修复清单如下：

**Critical（崩溃/泄漏级）：**
- `Game.js startAITurn`：AI aim/charge RAF 循环在 `this.paused` 分支未检查 `this.state === 'DISPOSED'`，玩家暂停后离开游戏会导致无限 RAF 泄漏。已在两个 tick 的 paused 分支顶部增加 DISPOSED 检查并 `resolve()` 退出。
- `Game.js resolveTurn`：trainer 模式下 `onTrainerComplete` 回调内部调用 `_stopTrainer()` → `game.dispose()` 后，`update()` 仍继续执行到 `ballsManager.getCueBall()` 抛出 `TypeError`。已在 `resolveTurn()` 返回后增加 `if (this.state === 'DISPOSED') return;` 守卫。
- `MenuSystem._stopTrainer()`：在显示 `trainerResult` 后才 null `activeDrill`，但 retry 回调的箭头函数在构造时捕获 `this.activeDrill`，执行时已经变为 `null`。已改为在构造回调前用局部变量 `drillId` 捕获当前 drill ID。
- `AchievementPanel` 缺少 `hide()` 方法：`_hideAllPanels()` 调用 `panel.hide?.()`，但成就墙只有 `hideWall()`，导致进入游戏时成就墙仍可见。已新增 `hide() { this.hideWall(); }` 别名。
- `CareerPanel.destroy()`：键盘监听器通过 `window.addEventListener` 添加，但 `destroy()` 用 `document.removeEventListener` 移除，导致监听器永久泄漏。已修正为 `window.removeEventListener`。
- `src/replay/ReplaySystem.js`：导入不存在的 `./ReplayRecorder.js`，任何引用该模块都会导致构建/加载崩溃。该文件为未使用的死代码，已删除。

**High（严重影响级）：**
- `UI.js _showConfirmDialog`：确认对话框的 Escape/Enter 键盘处理器未调用 `e.stopPropagation()`，事件继续冒泡到 `Game.js`，导致取消对话框的同时意外触发暂停/取消蓄力。已添加 `e.stopPropagation()`。
- `Achievement toast pointer-events`：单个 toast 为 `pointer-events: auto`，会拦截右上角 HUD 按钮（如即时回放跳过按钮）的点击。已改为 `pointer-events: none`（toast 无需交互）。
- `TrainerResult.show()`：使用 `typeof === 'number'` 守卫统计值，但 `typeof NaN === 'number'`，导致可显示 "击球力度: NaN%"。已统一改为 `Number.isFinite()` 守卫。
- `AchievementStore._load()`：localStorage 解析后直接返回，未校验 `stats` 和 `unlocked` 是否为对象。若 `stats` 被污染为 `null`，后续 `incrementStat` 会抛出 `TypeError`。已增加形状校验与回退。
- `AchievementStore` 原型污染：`incrementStat`/`setStat` 的 `key` 直接用于属性访问，未过滤 `__proto__`/`constructor`/`prototype`。已增加键名白名单过滤。
- `TournamentResult.showChampion/showEliminated`：调用 `_render()` 但 `_render()` 本身不设置 `display = 'flex'`（仅在 `_appendSeasonContext` 中设置），导致直接调用这两个 API 时面板不可见。已在 `_render()` 入口统一设置 `display = 'flex'`。

**Medium（明显缺陷级）：**
- `ChallengeManager` 事件钩子：`onShot`/`onBreakShot`/`onTurnEnd`/`onBallCollision`/`onShotUpdate` 未对入参做空值/类型守卫，Game.js 的异常调用会直接抛错。已补充 null/undefined/array 类型校验。
- `CareerPanel._render()`：清空各 section 时遗漏 `_growthPathSection`，如果面板从有数据切换到无数据（如 reset 后），旧 growth path 卡片会残留。已补充清空。
- `AchievementPanel.showWall()`：入场动画 `panelIn 260ms` 硬编码，未检查 `reducedMotion` 也未使用 `--ui-anim-speed`。已改为 `isReducedMotion()` 时 `animation: none`，正常时使用 `calc(0.26s / var(--ui-anim-speed))`。
- `TournamentBracket`：staggered entrance 使用 `setTimeout` 但 `destroy()` 不清理这些 timer，导致被 detached 的 card 节点被闭包引用直到超时。已增加 `_staggerTimers` 数组并在 `destroy()` 中全部 `clearTimeout`。
- `TournamentPanel._showBracket()`：重复进入 bracket 屏幕时，旧的 `TournamentBracket` 实例被 `this.content.innerHTML = ''` 从 DOM 移除但从未调用 `destroy()`，timer 泄漏。已在 `_showBracket()` 开头增加 `if (this.bracket) { this.bracket.destroy(); this.bracket = null; }`。

**构建与测试：**
- 全部 13 组非浏览器测试通过（rules/table/lan/ai/analyzer/instant-replay/career/ui-layout/settings-audit/trainer-challenge-safety/achievement-toast）
- `npm run build` 成功

---

# 3D Billiards v1.21.0

## What's New in v1.21.0

### 🔔 成就 Toast 布局重构 — 不再遮挡 HUD

将成就解锁通知从硬编码的右下角迁移到**右上角 UILayout safe-zone**，彻底避免与 minimap、力度条、bottom HUD、统计面板、设置按钮重叠。

**布局安全：**
- Toast container 位置改为 `top: calc(var(--hud-top-safe) + 16px); right: calc(var(--hud-right-safe) + 16px);`
- 不再硬编码 `bottom: 24px; right: 24px`
- 最大宽度受 safe-zone 限制，小屏幕自动收缩：`max-width: min(400px, calc(100vw - var(--hud-right-safe) - var(--hud-left-safe) - 32px))`
- Container 设 `max-height` 与 `overflow: hidden`，防止极端情况下无限向下延伸

**队列与堆叠：**
- 最多同时显示 **3** 个 toast，超出的进入队列 `_toastQueue`
- 队列自动去重，同一成就不会重复排队
- Toast 消失后自动从队列取出下一个渲染，避免一次性全部弹出造成的视觉混乱

**动画可访问性：**
- `reducedMotion` 下 transition 设为 `0.01ms`（立即生效），停留时间从 3.5s 缩短到 2s
- 非 reducedMotion 下继续使用 `calc(0.5s / var(--ui-anim-speed))` 与 `animMs(500)`，尊重用户动画速度设置

**生命周期安全：**
- 每个 toast 独立管理 `dismissTimer` 和 `removeTimer`
- `destroy()` 清空 `_toastQueue`、取消所有 active toast 的 timer、取消 RAF、移除 DOM
- 修复了旧版 `_toastShowRaf` 被多次覆盖导致早期 RAF 无法取消的隐患

**新增测试：**
- `test/achievement-toast.test.js` 覆盖 7 个场景：safe-zone 定位、队列上限、去重、destroy 清理、reducedMotion、未知 ID 忽略、队列自动出队

---

# 3D Billiards v1.20.0

## What's New in v1.20.0

### 🛡️ 训练/挑战数据安全审计 — 从存储到 UI 的全链路加固

对 `DrillManager`、`ChallengeManager` 和 `ChallengeData` 进行了全链路的数据安全审计，确保任何来源的损坏、旧版或畸形 localStorage 数据都不会导致程序崩溃或错误显示。

**DrillManager 加固：**
- 新增 `_clampStars()` 和 `_sanitizeEntry()`，将非法 star 值（NaN、负数、>3、小数）统一钳制到 `0-3` 整数
- `_loadBest()` 对 corrupted JSON、非对象 entry、字符串/数字/数组 entry 全部走 `_sanitizeEntry()` 回退到安全默认值
- `_saveBest()` 在写入前对现有 attempts/completions 做 `(existing.attempts || 0) + 1` 安全累加，防止 `NaN + 1 = NaN` 污染
- `getProgress()` 对未知 `drillId` 返回 `null` 而不是 `undefined`，UI 层已用 `|| {}` 兜底
- `isUnlocked()` / `getUnlockRequirement()` 对未知 `drillId` 返回 `false` / `''`，避免 `getDrill()` 返回 `undefined` 时抛异常
- `getAllBest()` 在根数据为数组时返回 `{}`，防止旧 schema 格式导致后续遍历崩溃

**ChallengeManager 加固：**
- 新增 `_clampStars()` 和 `_sanitizeEntry()`，与 DrillManager 同等强度
- `_loadBest()` / `_saveBest()` 同样对 corrupted JSON 和非法 entry 做 sanitize + clamp
- `_complete()` 在保存前通过 `_clampStars()` 确保 stars 始终落在 `0-3`
- `getAllBest()` 根数据为数组时返回 `{}`
- `getResultStats()` 在 `best.stars` 为 `NaN` 时安全降级，`isNewRecord` 为 `false`

**ChallengeData 加固：**
- 新增 `isValidChallengeId(id)` 用于外部快速校验
- `isUnlocked()` 对 `null` / `undefined` challenge 返回 `false`，不再依赖调用方前置校验
- `getUnlockRequirement()` / `getStarConditions()` 对 `null` challenge 返回 `''`
- `getProgress()` 对 `bestData` 中的每个 entry 的 `stars` 做 `Math.max(0, Math.min(3, ...))` 钳制，并支持非对象 `bestData` 安全降级
- `getFeaturedChallengeId()` 对 `bestData` 做空值安全处理，避免每日推荐在数据损坏时崩溃

**UI 层防崩溃：**
- `ChallengeResult.show()` 和 `TrainerResult.show()` 对 `NaN` stars 已做防御，不会触发 `RangeError: Invalid count`
- `TrainerPanel._createCard()` 和 `ChallengePanel._createCard()` 对缺失 progress 字段已用 `|| 0` 兜底

**新增测试：**
- `test/trainer-challenge-safety.test.js` 覆盖 25 个场景：坏 JSON、NaN stars、负 attempts、非对象 entry、未知 ID、钳制行为、解锁逻辑、UI show() 防崩溃

---

# 3D Billiards v1.19.0

## What's New in v1.19.0

### 🛡️ 面板生命周期治理 — 全面防御性 UI 加固

对所有 9 个全屏/覆盖面板进行了系统级的生命周期审计与加固，消除重复显示、动画泄漏、监听器残留、DOM 堆积、z-index 冲突和 Escape 路由不一致等隐患。

**防重复进入与动画泄漏：**
- 全部面板（CareerPanel、TrainerPanel、ChallengePanel、AchievementPanel、ReplayPanel、ShotAnalyzerPanel、TournamentPanel、TournamentResult、ChallengeResult、TrainerResult、SettingsScreen）新增 `_shown` 状态标志
- `show()` 重复调用时被忽略，防止重复渲染、重复动画和计时器堆积
- `hide()` / `destroy()` 立即重置 `_shown`，确保状态与 DOM 同步

**监听器与计时器清理：**
- `destroy()` 统一清理 `window.removeEventListener('keydown', ...)`，杜绝键盘事件泄漏
- TournamentPanel / TournamentResult 新增原本缺失的 Escape 监听
- 所有面板 `destroy()` 前执行 `container.innerHTML = ''`，释放全部内联事件处理器（onclick/onmouseenter/onmouseleave），切断闭包引用链
- SettingsScreen `destroy()` 清理 `_tabEls`、`_confirmHandlers`、toast 元素、backdrop 元素

**Escape 行为统一：**
- 规则：**当前最顶层显示的面板**响应 Escape，关闭自身并调用 `onBack` / `onExit`
- TournamentPanel：Escape 时若处于 PreMatch 屏幕则返回 Bracket，否则隐藏并返回菜单
- TournamentResult / ChallengeResult / TrainerResult：Escape 隐藏并返回上级
- ReplayPanel：Escape 时优先关闭列表；若列表已关则退出回放
- 不存在 Escape 穿透到游戏或菜单底层的问题

**进入游戏前强制清场：**
- `MenuSystem._fadeToGame()` 之前统一调用 `_hideAllPanels()`，确保所有菜单面板、结果面板、回放控制面板全部隐藏
- `_hideAllPanels()` 新增覆盖：`challengeResult`、`trainerResult`、`tournamentResult`、`replayControls`、`analyzerPanel`
- 杜绝「游戏中菜单面板残留」或「z-index 堆叠导致 UI 遮挡」

**reducedMotion 合规：**
- CareerPanel、TrainerPanel、ChallengePanel、ReplayPanel 的 `show()` 动画现在检查 `isReducedMotion()`，在减弱动态效果设置下直接设为 `animation: none`
- TournamentPanel 的淡入动画在 reducedMotion 下跳过 `requestAnimationFrame` 渐变，直接显示

---

# 3D Billiards v1.18.0

## What's New in v1.18.0

### 🏆 锦标赛赛季体验 — 从单纯对战到完整赛季旅程

将原有的 8 人单淘汰锦标赛升级为完整的**赛季体验**，新增赛季记录、对手风格标签、赛前预览、赛后总结、冠军历史卡片五大模块。数据全部保存在 TournamentStore 中，**兼容旧存档**（v1 历史记录会自动迁移到新格式）。

**赛季记录：**
- TournamentStore schema 升级至 v2，新增 `seasonStats` 聚合统计
- 追踪：参赛次数、冠军次数、最佳成绩（八强/四强/决赛）、总胜/负场、对手击败记录、连胜纪录、常用项目
- 旧存档自动迁移：检测到 v1 纯数组格式时自动计算并补全赛季统计

**对手风格标签：**
- 12 位 AI 对手每位拥有独特风格（进攻型 ⚔️、防守型 🛡️、旋转型 🌀、力量型 💪、均衡型 ⚖️、速度型 ⚡）
- 风格标签在对阵表卡片、赛前预览、历史记录中全程展示
- 每种风格配有专属图标和一句话描述

**赛前预览（新增屏幕）：**
- 在对阵表点击「查看赛前情报」进入全新 PreMatch 屏幕
- 展示对手头像（代表色 + 风格图标）、名字、头衔、风格描述
- 展示比赛信息（轮次、赛制、难度）
- 历史交锋提示：如果你曾击败过该对手，显示连胜记录
- 赛季快照：参赛次数、冠军次数、最佳成绩、当前连胜

**赛后总结升级：**
- TournamentResult 新增 `showSummary()` 方法，展示击败的对手列表（带风格标签和轮次）
- 赛季数据更新提示：这是你第 X 次参赛 · 累计夺冠 Y 次 · 最佳连胜 Z 届

**冠军历史卡片：**
- 历史记录屏幕从简单列表升级为富卡片网格
- 冠军记录以金色渐变边框 + 高亮背景标识
- 每张卡片展示：奖杯图标、选手名、日期、项目、成绩标签
- 对手快照列表：每位对手显示风格图标、名字、轮次、胜负标记
-  hover 时卡片微抬 + 边框高亮

**UI 一致性：**
- 全部使用现有 glassmorphism 设计体系，与菜单风格统一
- 移动端适配：单列布局、不重叠、安全区兼容
- 返回/继续比赛/历史查看流程清晰：Setup → Bracket → PreMatch → Game → Result → Setup/Menu

**MenuSystem 集成：**
- `_showTournament()` 从 placeholder 变为完整实现
- `_startTournamentMatch()` / `_onTournamentGameEnd()` 管理比赛生命周期
- 比赛结束后自动判断锦标赛是否结束，展示对应结果屏幕

**技术实现：**
- `TournamentStore` — v2 schema + v1 迁移 + `_rebuildSeasonStats()` + `_updateSeasonStats()`
- `TournamentData` — 新增 `STYLE_META`、`getStyleMeta()`、`buildMatchPreview()`
- `TournamentEngine` — 新增 `getMatchPreview()`、`getTournamentSummary()`
- `TournamentPanel` — 新增 `_showPreMatch()`、`_renderSeasonStatsCard()`、`_buildHeadToHead()`、升级 `_showHistory()` 为卡片网格
- `TournamentBracket` — match card 中展示风格标签
- `TournamentResult` — 新增 `showSummary()` 与对手列表、赛季上下文

**测试覆盖：**
- 新增 `test/tournament.test.js`（15 项测试）
- TournamentStore：空数据、记录更新、淘汰追踪、清空、未完成的忽略、跨赛事对手统计
- TournamentEngine：创建、preview、summary（冠军/淘汰）
- TournamentData：风格元数据、preview 构建、null 处理

---

# 3D Billiards v1.17.0 — Previous Update

## What's New in v1.17.0

### 🌱 成长路线系统 — 从数据短板到针对性训练

全新 **GrowthPath（成长路线）** 系统，将 CareerStore 生涯统计与 ShotProfiler 风格分析真正落地为可执行的训练计划。系统会自动识别你的技术短板（力度控制、旋转使用、长台稳定性、薄球成功率、犯规率等），并推荐最多 3 个具体的训练关卡（Drill）或挑战（Challenge）。

**核心功能：**
- **智能短板识别** — 基于真实击球数据：力度分布偏轻/偏重、旋转使用不足、长台/薄球/库边球命中率低、犯规率偏高、进球率偏低
- **精准映射推荐** — 每个短板对应 1 个训练关卡 + 1 个挑战候选，按优先级排序后去重，确保推荐质量
- **空数据友好** — 新玩家或无足够数据时，自动展示初学者推荐（直线球 → 轻推练习 → 蜻蜓点水挑战）
- **一键直达训练** — CareerPanel 的推荐卡片上可直接点击「开始练习」，无需手动翻找

**UI 集成点：**
- **生涯面板** — 新增「🌱 成长路线 / 推荐训练」区块，显示类型标签、名称、难度、推荐理由和解锁状态
- **训练面板** — 顶部新增「为你推荐」横幅，点击即可进入推荐 Drill；推荐 Drill 的卡片以蓝色高亮边框标识
- **挑战面板** — 顶部新增「为你推荐」横幅，点击即可进入推荐 Challenge；推荐 Challenge 的卡片以红色高亮边框标识

**技术实现：**
- `src/career/GrowthPath.js` — 纯数据分析引擎，零 DOM 依赖，输入 ShotProfiler + Drill/Challenge 最佳数据，输出结构化推荐
- `CareerPanel` — 新增 `_renderGrowthPath()`，支持可选的 `onStartDrill` / `onStartChallenge` 回调
- `TrainerPanel` / `ChallengePanel` — 新增 `_renderForYou()` 横幅与卡片高亮
- `MenuSystem` — 统一传入共享的 `GrowthPath` 实例与跳转回调
- **测试覆盖** — 新增 11 项 GrowthPath 单元测试：空数据、力度偏重/偏轻、旋转不足、长台弱、薄球弱、犯规高、无短板回退、数量上限、元数据完整性、去重

---

# 3D Billiards v1.16.0 — Previous Update

## What's New in v1.16.0

### 🛡️ 总体防御性审计与崩溃修复

对整个仓库进行了系统性运行时审计，修复了 **6 Critical + 8 High + 8 Medium** 共 22 项问题，覆盖崩溃、状态机错乱、数据污染、计时器泄漏、网络不同步、UI 死代码。

**Critical（运行时崩溃）：**
- `MenuSystem._showReplayAnalysis()` — `getTableProfile()` 可能返回 `null`，随后访问 `.width` 导致白屏崩溃 → 已加 null guard
- `Game.update()` — `this.table.getPocketPositions()` 无 null guard，初始化/销毁竞争时崩溃 → 已加 optional chaining
- `Game.resolveTurn()` — `getCueBall()` 返回 null 时访问 `.pocketed` 崩溃 → 已加 null guard
- `Game._updateCamera()` — `this.ballsManager` 为 null 时调用 `getCueBall()` 崩溃 → 已加前置检查
- `AIPlayer.takeTurn()` — trainer 模式下 `game.rules === null`，解构后调用 `.getStatus()` 崩溃 → 已加空值短路
- `AudioManager` — `playCueHit` / `playBallCollision` 未验证参数 finite；NaN 传入 Web Audio API 会抛出 `DOMException` → 已加 `Number.isFinite` guard

**High（状态机错乱 / 功能彻底失效 / 数据污染）：**
- `GameStateSerializer.ALLOWED_STATES` 缺少 `'REPLAYING'` 和 `'BALL_IN_HAND'` → 网络客户端在即时回放/球在手状态时不同步 → 已补全
- `Game.shoot()` LAN 客户端分支：连接验证失败前已设置 `this.state = 'SHOOTING'` 和 `this._shotStartTime`，回退时不清理 `_shotStartTime` → 20s 物理安全超时会在下一帧错误触发 → 已在失败路径清理
- `InstantReplayCamera._settlePhase()` — 误用 `cueBall.mesh.x`（Three.js Object3D 无此属性），应为 `cueBall.mesh.position.x` → settle 相机永远只固定在桌子同一侧 → 已修复
- `SettingsScreen` — "清除本地缓存"按钮遍历 `localStorage` 无 `try/catch` → 隐私浏览/沙盒 iframe 中点击崩溃 → 已包裹 try/catch
- `ReplayPanel.updateControls()` — 读取 `replayEngine._meta`，但 `ShotReplay` 根本没有此属性 → metadata 显示永远是空（死代码）→ 已改为读取 `replayEngine.metadata`
- `CareerStore._sanitizeData()` — 不递归清理 `byMode` 嵌套对象；损坏 localStorage 可导致字符串拼接污染统计（如 `"5" + 1 = "51"`）→ 已添加 byMode 嵌套 sanitization
- `SettingsStore._load()` — 类型校验 `typeof defVal === typeof val` 不拒绝 `NaN` / `Infinity` / `null` → 损坏 localStorage 可导致滑块显示 NaN → 已添加 finite / null 拒绝
- `Game.getCueBallPlacementReason()` — 调用 `this.table.getPocketPositions()` 无 `this.table` 检查 → 初始化不完全时崩溃 → 已加 guard

**Medium（可复现的功能缺陷 / 泄漏 / 竞态）：**
- `SettingsScreen` — 导出设置文件的 `URL.revokeObjectURL` timer 每次点击都新建，旧 timer 不被清理 → 已加 clearTimeout
- `Game` — `init()` 和 `resetGame()` 都设置 `_spectatorAutoStartTimer`，但旧 timer 仅在各自函数内被清除 → rapid reset 时旧回调可能在 stale state 上执行 → 已在 `resetGame()` 中统一清理
- `Game._updateTurnTimer(dt)` — 不验证 `dt`；若传入 `undefined` 则 `_turnTimerRemaining` 永久变为 `NaN` → 已加 `Number.isFinite` guard
- `StatsPanel` — `_showCompactVictory` / `_showFullGameOver` 调用 `requestAnimationFrame` 但不存储 id；`_ensureGameOverOverlay` 可能返回 null 但调用者不检查 → 已加 RAF 跟踪 + null guard
- `Game._endInstantReplay()` — 不检查 `DISPOSED`；销毁后被调用会复活 `this.state = 'AIM'` → 已加 DISPOSED guard
- `ReplayPanel._renderList()` — 直接访问 `this.library.replays` 而非封装方法；`new Date(replay.savedAt)` 不验证时间戳 → 已加 library guard 和 savedAt 验证
- `CareerPanel.destroy()` — 注入的 `<style id="career-panel-mq">` 未从 `<head>` 移除 → 已添加移除逻辑
- `CareerStore.reset()` — 不清除待定的 `_saveTimer` → 已添加 clearTimeout

**测试与构建：**
- 所有命令行测试通过（rules/table/lan/ai/analyzer/instant-replay/career/ui-layout/settings-audit）
- Build 成功

---

# 3D Billiards v1.15.0 — Previous Update

## What's New in v1.15.0

### 🔗 击球数据链路深度修复

对从「一杆记录」到「生涯统计」的全链路进行了系统性防御加固，确保无效数据不会污染 UI，也不会残留上一杆的旧图表或旧统计。

**ShotRecorder — 记录层防御：**
- 录制时检测并丢弃 NaN/Inf 物理坐标（写入 POCKETED_SENTINEL 作为失效标记）
- `start()` 中规范化 power/spin 输入（防负数、防 NaN）
- `stop()` 中 clamp duration 为非负数
- `getReplayData()` 最终输出前遍历替换所有非 finite 值为 sentinel
- 新增 `ShotRecorder.validateReplayData()` 静态方法，供下游统一校验

**ShotReplay — 回放层防御：**
- `load()` 调用 `validateReplayData()`，拒绝任何结构不完整或含 NaN 的数据
- `_applyFrame()` / `_applyInterpolated()` 同时检查 sentinel 和 `!Number.isFinite()`，防止 NaN 污染 Three.js 场景

**ReplayLibrary — 存储层防御：**
- `_load()` 加载后自动 `_sanitizeReplay()` 清洗，损坏条目会被过滤或修复
- `save()` / `importAll()` 强制通过校验，拒绝脏数据入库
- `_sanitizeReplay()` 修复：metadata 字段类型归一化、数组过滤非 finite ID、pocketedIds 重建

**ShotAnalyzer — 分析层防御：**
- `analyze()` 前置检查 frames 长度、NaN/Inf、frameRate 合法性
- 所有元数据字段读取时强制类型转换（`String(mode)`、`Boolean(spinUsed)`、`Math.max(0, duration)`）
- `_computeScore()` 所有分项计算防御 NaN，最终 clamp 到 0–100
- `getSummaryText()` 防御 null/缺失 metadata

**TrajectoryGraph — 图表层防御：**
- `load()` 拒绝含 NaN 的帧数据
- 所有绘制函数（轨迹、球体、碰撞标记）同时检查 sentinel 和 `!Number.isFinite()`
- `_drawFrameIndicator()` 防御 frameRate 为 0 的除零

**ShotAnalyzerPanel — UI 层防御：**
- `show()` 分析失败时不再静默隐藏，而是显示明确的错误状态 `_showErrorState('无法分析此击球：数据无效或已损坏')`
- 切换 tab 时自动清理旧图表（`_cleanupGraph`）
- `_renderOverview()` 所有元数据字段读取时防御非 finite / 非数组
- `_renderCollisions()` 防御碰撞时间非 finite

**CareerStore — 生涯统计防御：**
- `_load()` 后执行 `_sanitizeData()`，修复 localStorage 旧数据损坏导致的类型漂移
- `_mergeDeep()` 增加类型守卫：字符串不会覆盖数字字段，数组长度不会溢出
- `_sanitizeData()` 归一化：powerBuckets 固定 5 个数字、spin 计数强制 number、records/totals 强制 number
- `recordShot()` 防御 `totalShotPower` 为字符串时的拼接错误
- `recordGame()` 防御 `recentGames` 非数组

**ShotProfiler — 画像分析防御：**
- `analyzeStyle()` / `getAveragePower()` / `getPocketRate()` 等全部 getter 使用 `Number()` 包裹，防字符串/NaN 污染
- `getSummary()` 中所有 records 字段读取时做 `Number.isFinite` 检查

**Game.js — 调用点加固：**
- `shoot()` 中统一使用 `safePower = Number.isFinite(this.power) ? Math.max(0, this.power) : 0`
- `resolveTurn()` 中传给 `careerStore.recordShot()` 的参数全部经过 `Number.isFinite` 检查
- `dispose()` 中清理 `_lastReplayData`，防止旧回放数据残留

**新增测试：**
- `test/analyzer.test.js`：NaN 帧数据拒绝、帧长度不足拒绝、元数据损坏归一化、score clamp
- `test/instant-replay.test.js`：`validateReplayData`、ShotReplay NaN 拒绝、ReplayLibrary `_sanitizeReplay`、损坏元数据修复
- `test/career.test.js`：字符串 totalShotPower 修复、非数组 recentGames 修复、powerBuckets 溢出修复、ShotProfiler NaN 防御

---

# 3D Billiards v1.14.0 — Previous Update

## What's New in v1.14.0

### ⚙️ Settings System Consistency Audit

全面审计并修复设置项的「显示但未生效」问题，确保所有在设置面板中出现的选项都能实时作用于游戏。

**已启用的设置项：**
- **自动保存回放 (autoSaveReplays)** — 之前灰显，现已可开关
- **最大回放数 (replayMaxSaved)** — 之前灰显，现已可调节 (10–100)
- **回放速度 (replaySpeed)** — 之前灰显，现已可调节 (0.25x–2x)

**UI 动画与减弱动态效果一致性：**
- `reducedMotion` 现在被所有 HUD 元素和动画系统读取
- `flashRed()` 等视觉反馈在减弱动态模式下直接跳过
- `CommentarySystem` 在减弱动态模式下瞬间显示完整解说文本
- 新增 `prefers-reduced-motion` 操作系统级媒体查询支持

**HUD 不透明度一致性：**
- `hudOpacity` 现在统一作用于：迷你地图、连击计数器、FPS 计数器、准星、消息提示、回放提示、Push-out 按钮/选项、三次犯规徽章
- 新增 `--hud-opacity` CSS 自定义属性

**音频设置验证：**
- `AudioManager` 所有音效和音乐均实时读取对应音量比例 (master/collision/cue/ambient/sfx/music)
- `toggleSound()` 平滑渐变主音量增益

**测试覆盖：**
- 新增 `test/settings-audit.test.js` (14 项测试)：默认值完整性、锁定键保护、重置保留、动画速度缩放、CSS 类切换、自定义属性发布

---

# 3D Billiards v1.12.0 — Previous Update

## What's New in v1.12.0

### 🎬 Cinematic Instant Replay & Spectator Mode Upgrade

即时回放与观赛模式的电影感全面升级。

**即时回放镜头系统重设计：**
- **Impact (0-5%)** — 更低更近的母球后 close-up，强化击球瞬间张力
- **Action (5-30%)** — 母球追踪 + 智能碰撞侧视角：当碰撞数 ≥ 4 时自动切换戏剧性侧面角度
- **Target Track (30-60%)** — 追踪被击中的目标球，模拟第一视角跟随
- **Pocket Close-up (60-85%)** — 进球时自动 close-up 袋口，营造落袋仪式感
- **Settle (85-100%)** — 根据母球位置交替选择宽角侧面，避免千篇一律
- **Reduced Motion 兼容** — 开启减弱动态效果后，镜头切换大幅减少，以稳定 overhead +  gentle follow 为主，过渡更柔和

**Spectator Mode 修复与增强：**
- 修复 bank shot 检测 TODO：利用 `Game._shotIsBank`（击球时根据「先碰库再碰球」自动标记）为解说系统提供真实的翻袋信号，不再硬编码 `false`
- `SpectatorMode.update()` 已存在 `state === 'REPLAYING'` 提前返回，与即时回放相机互不抢占

**回放 HUD 防遮挡：**
- 进度条从 `bottom: 20px` 抬高到 `bottom: 110px`，彻底避开 power bar、minimap、bottom HUD
- 「跳过」按钮从右下角移至右上角，不与任何底部游戏元素重叠

**设置尊重：**
- `reducedMotion` — 减少镜头切换频率与移动速度
- `instantReplayEnabled` / `autoInstantReplay` / `instantReplayThreshold` — 保持原有逻辑不变
- `replaySpeed` — 由 `ShotReplay` 读取设置后映射到 0.25x/0.5x/1.0x/2.0x，未覆盖

**测试覆盖：**
- `test/instant-replay.test.js` 新增 4 项测试：metadata 传递、reducedMotion 稳定 overhead、正常模式阶段切换、碰撞侧视角检测

---

# 3D Billiards v1.11.0 — Previous Update

## What's New in v1.11.0

### 🎯 Personal Training Coach — From Stats to Actionable Advice

生涯统计系统全面升级：**个人训练教练**。基于你的真实击球数据，系统会自动生成 3-5 条个性化训练建议，让数据真正转化为提升路径。

**新增训练建议维度：**
- **力度偏好分析** — 检测你是否过于依赖重杆或轻推，给出针对性的力度练习方向
- **旋转使用指导** — 分析中杆/高杆/低杆/塞球的使用比例，提示走位手段是否单一
- **长台命中反馈** — 根据长台进攻成功率，建议强化稳定性或更自信地选择长台
- **薄球命中反馈** — 评估薄球成功率，指出技术短板或鼓励关键时刻的信任
- **模式胜率短板** — 自动识别胜率最低的对战模式，推荐针对性规则与策略练习
- **犯规与效率监控** — 当犯规率或进球率偏离健康区间时给出警示

**产品体验：**
- CareerPanel 新增「🎯 训练建议 / 下一步提升」区块，数据不足时自动隐藏，绝不显示假建议
- 卡片式网格布局，自动适配移动端（窄屏下单列展示），不与关闭按钮、标题、滚动区域重叠
- 建议按优先级排序，最重要的问题排在最前
- 完全基于现有 CareerStore 数据计算，**零 schema 变更**，旧 localStorage 数据无缝兼容

**技术实现：**
- `ShotProfiler.getTrainingTips()` — 纯数据分析引擎，零 DOM 依赖，可测试
- `CareerPanel._renderTrainingTips()` — 独立渲染区块，复用现有 glassmorphism 设计体系
- 补充 7 项单元测试，覆盖空数据、力度、旋转、长台、薄球、模式短板与上限截断

---

# 3D Billiards v1.10.1 — Previous Update

## What's Fixed in v1.10.1

### 🩹 Post-Release Deep Audit — Career Stats Hardening

针对 v1.10.0 生涯统计系统进行的深度代码审计，修复了 **4 Critical + 4 High + 6 Medium** 共 14 项问题。

**🔴 Critical — Data Integrity & Runtime Safety (4 项)**

| # | 问题 | 修复 |
|---|------|------|
| 1 | `CareerStore._mergeDeep()` 接受 localStorage 中任意 key，恶意/旧数据可注入 `__proto__` 或未知字段污染 schema | 增加 `__proto__`/`constructor`/`prototype` 过滤；仅复制 `DEFAULTS` 中已存在的 key |
| 2 | `recordShot()` 负值和 `NaN` 可破坏计数器和记录（如 `recordPocketed: -5`） | 所有数值输入添加 `Math.max(0, ...)` clamp，`NaN` 通过 `Number.isFinite` 过滤 |
| 3 | `_scheduleSave()` 无防抖，快速连续调用（如连续击球）触发高频 localStorage 写入，阻塞主线程 | 实现 800ms 防抖；首次调用后 800ms 内的新变更合并为一次写入 |
| 4 | `getByMode()` fallback 返回不完整对象，缺少 `byDifficulty` 和 `completed` 字段，后续代码访问即 `undefined` | fallback 补齐全部字段，与 `DEFAULTS` 结构一致 |

**🟠 High — UX, Lifecycle & Memory (4 项)**

| # | 问题 | 修复 |
|---|------|------|
| 5 | `CareerPanel.show()` 未防重入动画，快速点击或状态切换时动画重启导致闪烁 | 增加 `display === 'flex'` 守卫，已可见时直接返回 |
| 6 | `CareerPanel.destroy()` 未清理事件监听器和内部引用，重复创建/销毁导致内存泄漏 | 完整移除 `keydown`/`resize` 监听器，null 化所有回调和 section refs |
| 7 | 菜单进入游戏模式（Free Play / VS AI / Challenge 等）时 CareerPanel 仍显示在背景层，造成 UI 覆盖泄漏 | `_startGame` / `_startTrainer` / `_startChallenge` 调用前主动 `careerPanel.hide()` |
| 8 | CareerPanel 空数据时各数据区块仍渲染为 `0%`/`0` 的残缺图表，首次使用体验差 | `_render()` 检测 `hasData`，空数据时展示「暂无数据」占位状态，隐藏图表区块 |

**🟡 Medium — Special Shots, Audio, Settings (6 项)**

| # | 问题 | 修复 |
|---|------|------|
| 9 | `isLongShot` 未接入，CareerStore 始终记录 `0` 次长台 | 从 `recorder.metadata.firstHitDistance > 150` 计算并传入 `recordShot` |
| 10 | `getSpecialShots()` 硬编码中文名做分支判断，重构或国际化时易断裂 | 改用 `type` 字段（`'break'|'long'|'thin'|'bank'`）做安全分支 |
| 11 | `ShotProfiler.getSpinPreference()` 左右塞标签与实际方向相反（`sx > 0` 为右塞却标成左塞） | 标签互换：`left` → 右塞，`right` → 左塞 |
| 12 | CareerPanel 网格在移动端（<600px）仍使用 4 列，文字挤压重叠 | 添加 `@media (max-width: 600px)` 断点，降为 2 列并增加 `env(safe-area-inset-bottom)` |
| 13 | `SettingsStore` 缺少 `winVolumeScale` 默认值，AudioManager 启动时读取到 `undefined` | `DEFAULTS` 添加 `winVolumeScale: 1.0` |
| 14 | `AudioManager.dispose()` 将 `_lastUserGestureAt` 重置为 `0`，重新初始化后 1.2 秒内误判为已有用户手势 | 重置为 `-Infinity`，与初始状态一致 |

---

# 3D Billiards v1.10.0 — Previous Update

## What's New in v1.10.0

### 📊 Career Stats & Shot Style Profiler — Your Personal Billiards DNA

全新**生涯统计与击球风格分析系统**，让每一次击球都成为你成长路上的数据足迹。

**核心功能：**
- **生涯总览**：总局数、胜率、总击球数、最长连杆 — 一目了然
- **击球风格标签**：系统根据你的击球数据自动分析风格，如「重炮手」「触感型」「旋转艺术家」「长台杀手」「薄球大师」等
- **模式战绩**：各游戏模式的胜率条形图，支持 VS AI 按难度细分
- **杆法偏好**：高杆/低杆/左塞/右塞/中杆的使用比例可视化
- **力度分布**：5 档力度柱状图，直观展示你的发力习惯
- **特殊击球**：长台进攻、薄球、库边球、开球的命中率统计
- **最佳记录**：最快胜利、最高力度、单杆最多进球、单杆最多碰撞等
- **数据持久化**：所有数据自动保存在本地，跨会话累积

**技术实现：**
- `CareerStore` — 独立持久化存储模块，采用 localStorage + 默认合并策略，兼容未来 schema 升级
- `ShotProfiler` — 纯数据分析引擎，零 DOM 依赖，可测试
- `CareerPanel` — 玻璃态全屏面板，CSS 数据可视化（条形图、柱状图、徽章），`Escape` 键返回
- `Game.js` 集成 — `resolveTurn()` 自动记录每杆数据，`gameOver` / `concede` 自动记录整局结果
- 网络对战和观赛模式自动排除，避免污染个人数据

---

# 3D Billiards v1.9.2 — Previous Update

## What's New in v1.9.2

### 🔧 Global Deep Audit — Critical Bug Fixes & Experience Improvements

Full-system audit across Instant Replay, Audio, Input, Settings, Menu Lifecycle, Spectator Mode, and FX. **2 Critical, 8 High, 12 Medium, and 10 Low issues fixed.**

**🔴 Critical — Runtime Errors & Feature Breakage (2 项)**

| # | 问题 | 修复 |
|---|------|------|
| 1 | `Game.resetGame()` 销毁 `instantReplay` 后设为 `null`，但 `init()` 有守卫不再重建，导致重置后回放功能永久失效 | 重置后重新 `new InstantReplayController(...)` |
| 2 | `Game.dispose()` 先销毁 `UI` 再销毁 `instantReplay`；若回放活跃，`_endReplay` 的 `onComplete` 回调会访问已 null 的 `UI` 导致崩溃 | 调整 dispose 顺序：`instantReplay.dispose()` 移到 `ui.destroy()` 之前 |

**🟠 High — State Machine Safety & UX Bugs (8 项)**

| # | 问题 | 修复 |
|---|------|------|
| 3 | `Game.update()` 在 `REPLAYING` 状态时仍执行 `ballsManager.sync()`，物理体覆盖 replay mesh，导致回放开始一帧闪烁 | 添加 `state !== 'REPLAYING'` 守卫 |
| 4 | `SpectatorMode.update()` 与 `InstantReplayCamera` 同时覆盖相机位置，造成 jitter | SpectatorMode 在 `REPLAYING` 时提前返回 |
| 5 | R 键硬编码触发即时回放，与 `spinReset`（同样默认 R）冲突，且完全绕过 `KeyBindings` 系统 | 新增 `instantReplay` 动作，默认绑定 `Shift+R`，通过 `keyBindings.matches()` 消费 |
| 6 | `ballInHand` 状态下仍可触发自动/手动回放，返回后 HUD/控制状态不一致 | 所有回放入口添加 `!this.ballInHand` 检查；`_endInstantReplay` 恢复 `BALL_IN_HAND` HUD |
| 7 | 自动触发逻辑在 `shouldAutoTrigger` 之前消耗 `_lastReplayData`；若回放被禁用，手动回放机会永久丢失 | 先检查 `isEnabled()`，成功后再清空数据 |
| 8 | `ShotReplay._applyInterpolated()` 只检查当前帧 sentinel，过渡帧中球被插值到 `999999` 飞出屏幕 | 增加下一帧 sentinel 检查 |
| 9 | 球-球碰撞从未调用 `recorder.recordCollision()`，兴奋度分数缺失碰撞分（最高 30 分） | 在碰撞处理中添加 `recorder.recordCollision()` |
| 10 | `UI.hideReplayHint()` 的 `setTimeout` 未追踪，旧定时器可能隐藏新显示的提示 | 添加 `_replayHintHideTimer` 追踪并在 `showReplayHint` 时清除 |

**🟡 Medium — Physics Sync, Settings, Audio, Input (12 项)**

| # | 问题 | 修复 |
|---|------|------|
| 11 | `_restoreBallStates()` 未恢复球的旋转（quaternion），回放后球朝向错乱 | 保存/恢复 `mesh.quaternion` |
| 12 | `InstantReplayController.start()` 硬编码 `setSpeed(1)`（0.5x），覆盖用户 `replaySpeed` 设置 | 移除硬编码，让 `load()` 自动解析用户偏好 |
| 13 | `shouldAutoTrigger` 使用 `\|\| 35`，用户设置 `0` 被误升为 `35` | 改用 `?? 35` |
| 14 | `dispose()` 在 `_endReplay` 前未清除 `_onComplete`，销毁时可能回调到已释放的 owner | 先清空 `_onComplete` |
| 15 | `Enter` 键在回放期间仍可尝试射击；FX（screenShake、ballReturn）在回放期间继续动画 | 添加 `REPLAYING` 状态守卫 |
| 16 | `mouse` 输入处理无显式回放守卫，依赖巧合的状态判断 | 三个 mouse handler 顶部添加 `state === 'REPLAYING'` 提前返回 |
| 17 | `SettingsStore` 未对 `instantReplayThreshold` 做范围校验 | 添加 `Math.max(0, Math.min(100, ...))` clamp |
| 18 | `AudioManager.stopBGM()` 清除 `_pendingDisconnects`，错误耦合 BGM 与 SFX 生命周期 | 移除该清理（SFX 节点有 `onended`，不依赖 fallback timeout） |
| 19 | `_hasRecentGesture()` 默认 `_lastUserGestureAt = 0`，启动 1.2 秒内 falsely true | 初始化为 `-Infinity` |
| 20 | `AudioManager.init()` 未调用 `syncVolumesFromSettings()`，启动时音量不正确 | 在 `init()` 末尾添加调用 |
| 21 | `playWin()` 无独立音量控制 | 添加 `winVolumeScale` 设置支持 |
| 22 | `playCueHit` 最低音量 `0.15` 过高，轻推仍然很响 | 调整为 `0.05 + power * 0.35` |

**🟢 Low — Code Quality & Memory Safety (10 项)**

| # | 问题 | 修复 |
|---|------|------|
| 23 | `CommentarySystem` combo 检测 off-by-one，第 3 球才触发连击评论 | `>= 2` 改为 `>= 1` |
| 24 | `UI.updateTimer()` 超过 60 分钟显示 `61:00` 而非 `1:01:00` | 添加小时格式化 |
| 25 | `ShotReplay.getDuration()` off-by-one | 改为 `(frameCount - 1) * interval` |
| 26 | `InstantReplayCamera._getCurrentLook()` 每次分配新 `Vector3` | 复用模块级 `_TMP` |
| 27 | `setCamera()` 未更新 `spectatorCameraPos`，导致观赛退出后相机跳回旧位置 | 同步更新 `spectatorCameraPos` |
| 28 | `setCamera()` 缺少 `REPLAYING` 状态拒绝，回放期间切换相机造成混乱 | 添加状态守卫 |
| 29 | `playCueHit()` 分配 `new AudioBufferSourceNode` 但未设置 `onended`，Node 泄漏 | 补充 `onended` 回调释放引用 |
| 30 | `AudioManager.dispose()` 在 `clearInterval` 之后继续 `this._beatTimer = null`（已被 `clearInterval` 无效化） | 移除重复赋值，仅保留 `clearInterval` |
| 31 | `input/mouse.js` 多球选择阶段未拦截 `mouseDown` | 添加 `state === 'SELECTING_BALL'` 拦截 |
| 32 | `MenuSystem._startGame()` 在 `game.dispose()` 后未 null `game`，下次进入未察觉旧实例 | `game.dispose()` 后立即 `game = null` |
