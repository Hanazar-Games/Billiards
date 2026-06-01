# 3D Billiards v1.10.0 — Latest Update

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
| 27 | `BroadcastUI.destroy()` 无条件移除共享 stylesheet，多实例会互相破坏 | 添加 `data-refcount` 引用计数 |
| 28 | `PowerLabel` 构造函数立即创建 DOM，即使从不显示 | 推迟到 `show()` 时创建 |
| 29 | `MenuSystem` 声明死属性 `replayBallsManager` | 移除 |
| 30 | `_cleanupReplayScene()` 未清空 `_replayBalls.balls` 数组 | 添加 `balls.length = 0` |
| 31 | `_returnToMenu()` 未清理 `tournamentPanel` / `tournamentResult` | 添加对应清理 |
| 32 | `GameLoop.start()` 未重置 `_errorCount`，重启后容错窗口失效 | 添加 `_errorCount = 0` |

---

# 3D Billiards v1.9.1 — Previous Update

## What's New in v1.9.1

### 🔧 v1.9.0 Post-Release Polish — UI/UX/SFX Improvements

**即时回放设置面板**
- 设置 → 回放与分析 面板新增三项即时回放控制：
  - **即时回放** 开关 — 启用/禁用整个回放系统
  - **自动触发回放** 开关 — 控制精彩进球后是否自动播放
  - **触发阈值** 滑块（15–60 分）— 自定义自动回放的评分门槛

**音效动态范围增强**
- `playBallCollision`：采用非线性音量曲线（`0.05 + intensity² × 0.12`），轻碰可闻、重击更有冲击力，同时根据力度动态延长衰减时间
- `playCushionBounce`：同样的非线性曲线（`0.06 + intensity² × 0.14`），库边反弹反馈更具层次感

---

# 3D Billiards v1.9.0 — Previous Update

## What's New in v1.9.0

### 🎬 Instant Replay — Cinematic Shot Playback

全新**即时回放系统**，让你的每一杆精彩击球都能像电视转播一样多角度慢动作重播。

**核心功能：**
- **自动触发**：精彩进球（评分 ≥ 35）击球后自动进入慢动作回放
- **手动触发**：AIM 状态下按 `R` 键随时回放上一杆
- **五机位自动切换**：
  1. **击球特写**（0-8%）— 低角度近距离捕捉杆头击球瞬间
  2. **追踪镜头**（8-35%）— 跟随白球，视角逐渐升高拉远
  3. **俯视全局**（35-65%）— 俯瞰整个球桌，看清球群散开
  4. **动态追踪**（65-88%）— 追踪场上最活跃的球
  5. **定格全景**（88-100%）— 宽角度展示最终球局
- **慢动作播放**：默认 0.5x 速度，配合 ShotReplay 插值引擎流畅回放
- **HUD 提示**：AIM 状态下右下角显示 "🔁 回放上一杆 (R)" 按钮
- **完整状态恢复**：回放结束后精确恢复所有球的位置和物理状态，不影响下一杆

**技术实现：**
- `InstantReplayController` — 回放主控，管理状态保存/恢复、ShotReplay 引擎、UI
- `InstantReplayCamera` — 电影级相机导演，基于进度自动切换 5 个预设机位
- `InstantReplayUI` — 回放 HUD（即时回放标签、进度条、跳过按钮、速度显示）
- 网络对战自动禁用，避免状态不同步

---

# 3D Billiards v1.8.7 — Previous Update

## What's New in v1.8.7

### 🔧 Global Deep Audit — UI/UX/SFX/BGM Bug Fixes & Experience Improvements

**🔴 Critical — Runtime Errors & Commentary Bugs (2 项)**

| # | 问题 | 修复 |
|---|------|------|
| 1 | `SpectatorMode._onBallPocketed()` 将 `isCombo` 硬编码为 `false`，导致 `CommentarySystem` 的连击评论（"连续进球！"）永远不会触发 | 改为动态判断 `this.commentary._comboCount >= 2` |
| 2 | `ShotAnalyzerPanel.hide()` 仅调用 `graph.pause()`，未取消 `_trajectoryRafId`，隐藏面板后轨迹图 RAF 可能多跑一帧 | `hide()` 现调用 `_cleanupGraph()` 彻底释放资源 |

**🟠 High — Timer Display & Detection Logic (3 项)**

| # | 问题 | 修复 |
|---|------|------|
| 3 | `BroadcastUI.setMatchTimer()` 仅计算 `mm:ss`，超过 60 分钟时分钟数回绕（如 65 分钟显示为 05:00） | 新增小时计算，>60 分钟显示 `h:mm:ss` |
| 4 | `StatsPanel._fmtTime()` 同样不处理小时，对局统计和结算面板中长时间比赛显示异常 | 统一修复为 `h:mm:ss` / `mm:ss` / `ss` 分层显示 |
| 5 | `SpectatorMode._isLongShot()` 始终返回 `false` 且声明了未使用的 `aim` 变量，长台评论（"远距离一击"）永不触发 | 基于 table profile 对角线距离实现真实长台检测 |

**🟡 Medium — Shot Difficulty & UX Improvements (1 项)**

| # | 问题 | 修复 |
|---|------|------|
| 6 | `SpectatorMode._isDifficultShot()` 纯随机（固定 15% 概率），高难度评论（"难度极高的一杆"）触发无依据 | 改为基于 cue ball 到 pocket 距离的比例加权概率（10%~30%） |

---

# 3D Billiards v1.8.6 — Previous Update

## What's New in v1.8.6

### 🔧 Global Deep Audit — UI/UX/SFX/BGM & Lifecycle Fix Round

**🔴 Critical — Runtime Errors & Memory Leaks (4 项)**

| # | 问题 | 修复 |
|---|------|------|
| 1 | `MenuSystem._replayTick()` 使用 RAF 循环但未存储 id，`_stopReplayPlayback()` 无法取消，导致 replay 停止后仍多执行一帧甚至持续泄漏 | 新增 `this._replayRafId`，停止时 `cancelAnimationFrame` |
| 2 | `SpectatorMode._onBallPocketed()` 中 `ball.mesh.position.x` 未防御 `mesh` 为 null（球被 pocketed 后 mesh 可能已被移除） | 增加 `ball.mesh` 存在性检查后再访问位置 |
| 3 | `SpectatorMode.onFoul/onMiss/onSafety` 未检查 `this.active`，stop/dispose 后仍被外部调用会导致对已销毁对象的访问 | 三个公共回调入口处增加 `if (!this.active) return;` |
| 4 | `MenuSystem._startReplayPlayback()` 中 replayPanel 按钮的 `onclick` 在 `_stopReplayPlayback()` 后未被清空，形成对已销毁 `replayEngine` 的闭包引用 | 停止时显式将四个按钮的 `onclick` 设为 `null` |

**🟠 High — Resource Cleanup & Null Safety (3 项)**

| # | 问题 | 修复 |
|---|------|------|
| 5 | `BroadcastUI.destroy()` 只将 `container` 设为 null，内部 DOM 引用（`_topBar`、`_p1Box`、`_commentaryText` 等）仍保留对已移除元素的引用，阻碍 GC | destroy 后逐一 null 化所有内部 DOM 引用 |
| 6 | `ShotReplay._applyFrame()` / `_applyInterpolated()` 未防御 `ball.mesh` 为 null，极端情况下可能抛出 TypeError | 增加 `ball.mesh` 存在性检查 |
| 7 | `AudioManager.reinit()`（lowLatencyMode 切换）dispose+init 后不恢复静音状态，`syncVolumesFromSettings()` 只在设置有效时才应用 | 在 `syncVolumesFromSettings()` 后追加 `toggleSound(this.soundEnabled)` 确保静音状态正确 |

**🟡 Medium — Code Quality & Consistency (4 项)**

| # | 问题 | 修复 |
|---|------|------|
| 8 | `MenuSystem` 三个 catch 块（`_startTrainer`、`_startChallenge`、`_startGame`）直接引用未声明的 `menuLayer`/`uiLayer` 变量 | 改为统一调用 `this._fadeToMenu()` |
| 9 | `TrajectoryGraph.removeEventListener('wheel')` 未传递 `{ passive: false }`，与 `addEventListener` 参数不匹配 | 补充 options 参数 |
| 10 | `SpectatorMode` 中存在 `_onGameEvent` 和 `_tmpPocketed` 死代码 | 移除未使用的绑定和数组 |
| 11 | `UI.destroy()` 中设置 player badge textContent 的代码重复执行两次 | 删除冗余的第二次赋值 |

---

# 3D Billiards v1.8.5 — Previous Update

## What's New in v1.8.5

### 🔧 Global Bug/UIUX/SFX/BGM Deep Audit

**🔴 Critical — Release & Test Consistency (2 项)**

| # | 问题 | 修复 |
|---|------|------|
| 1 | `package.json`、`README.md`、`index.html` 仍停在旧版本号，和核心版本/公告不一致 | 统一升级到 `v1.8.5`，并通过构建同步 `dist` |
| 2 | `test/analyzer.test.js` 存在但未接入 npm 测试脚本 | 新增 `test:analyzer`，主测试链纳入击球分析器回归测试 |

**🟠 High — Replay & Analyzer Robustness (5 项)**

| # | 问题 | 修复 |
|---|------|------|
| 3 | `ReplayLibrary` fallback 默认上限仍是 30，与设置默认 `replayMaxSaved: 50` 不一致 | fallback 和面板兜底统一改为 50 |
| 4 | `ReplayPanel` 对 `meta.duration` 只判空，异常数据可能触发 `.toFixed()` 崩溃 | 改为 `Number.isFinite()` 防御 |
| 5 | `ShotAnalyzer` 仍维护本地球数/帧宽常量，可能和 `ShotRecorder` 漂移 | 统一复用 `BALL_COUNT` / `FLOATS_PER_FRAME`，并校验帧数据长度 |
| 6 | `ShotAnalyzerPanel.show()` 遇到无效回放时可能保留旧分析/旧图状态 | 无效数据时清理图表、隐藏面板并清空缓存 |
| 7 | `ShotAnalyzerPanel` 元数据时长对 `NaN` 防御不足 | 改为有限数字校验后再格式化 |

**🟡 Medium — UI/Spectator Lifecycle (6 项)**

| # | 问题 | 修复 |
|---|------|------|
| 8 | `StatsPanel` 结算层隐藏 timeout 未统一追踪，销毁时可能留下延迟回调 | 新增 `_gameOverHideTimer` 生命周期清理 |
| 9 | `SpectatorMode` 隐藏默认 HUD 后用空字符串恢复 display，可能破坏原始显示状态 | 记录每个 HUD 元素原 display，并按原值恢复 |
| 10 | `CommentarySystem` 打字机效果不尊重 `reducedMotion` / `uiAnimSpeed` | reduced motion 下即时显示，普通模式按 UI 动画速度缩放 |
| 11 | `TrajectoryGraph` 零尺寸 resize 和播放结束 RAF 有轻微生命周期风险 | 增加尺寸守卫，播放结束后不再多排一帧 |
| 12 | 双 AI/观战自动开杆 timer 在初始化和重置快速交错时可能残留旧 timer | 创建新 timer 前先清旧 timer，回调执行后清空引用 |
| 13 | `SpectatorMode.dispose()` 在 active 状态下会经过 `stop()` 后再次销毁 UI | 区分 active/inactive dispose 路径，避免重复销毁观战 UI |

---

# 3D Billiards v1.8.4 — Previous Update

## What's New in v1.8.4

### 🔧 Bug Fixes & Polish (Fourth Audit Round)

**🟠 High — Data Consistency & Interface Robustness (4 项)**

| # | 问题 | 修复 |
|---|------|------|
| 1 | `ShotAnalyzerPanel.show()` 不保存 `replayData`，轨迹图依赖调用方预先调用 `setReplayData()` | `show()` 内部自动保存 `this._lastReplayData = replayData`，消除隐性依赖 |
| 2 | `ShotAnalyzer` 碰撞/进球时间硬编码 60fps，与 `ShotRecorder` 实际帧率脱钩 | 引入 `frameRate` 参数，使用 `replayData.frameRate` 计算真实时间 |
| 3 | `ReplayPanel` 回放数量显示硬编码 `/30 已保存` | 改为调用 `library.getMaxReplays()`，与设置中的 `replayMaxSaved` 同步 |
| 4 | `ShotAnalyzer._computeScore()` 中 `pathRatio` 可能因浮点误差 > 1 | 使用 `Math.min(1, ...)` 将路径比限制在 `[0, 1]` |

**🟡 Medium — Magic Numbers & Defensive Checks (4 项)**

| # | 问题 | 修复 |
|---|------|------|
| 5 | `ShotReplay.js` 多处硬编码 `32`（每帧浮点数）和 `16`（球数） | 统一导入 `FLOATS_PER_FRAME` 和 `BALL_COUNT` 常量 |
| 6 | `TrajectoryGraph.js` 球号显示范围硬编码 `b <= 15` | 改为 `b < BALL_COUNT`，与常量定义一致 |
| 7 | `TrajectoryGraph.js` 哨兵值检测仅检查 `x` 坐标 | 改为检查 `x === POCKETED_SENTINEL && z === POCKETED_SENTINEL`，防御数据损坏 |
| 8 | `ShotRecorder.js` 文件头注释与实际参数不符（20fps/15s/300帧 vs 60fps/18s/1080帧） | 更新注释为 `60fps (~16.67ms) for up to 18 seconds (1080 frames)` |

---

# 3D Billiards v1.8.3 — Previous Update

## What's New in v1.8.3

### 🔧 Bug Fixes & Polish (Self-Audit Round)

**🟠 High — UX & Defensive Improvements (4 项)**

| # | 问题 | 修复 |
|---|------|------|
| 1 | `ShotAnalyzerPanel` 轨迹图播放速度始终从 1.0x 开始，忽略设置中的「回放速度」 | 初始化时读取 `settings.get('replaySpeed')`，与设置面板同步 |
| 2 | `ShotAnalyzerPanel` 元数据「时长」可能显示 `NaN` | 改为 `(meta.duration \|\| 0).toFixed(1)` 防御性处理 |
| 3 | `ShotAnalyzer` 碰撞检测计算入射角时未防御前一帧的哨兵值 | 新增 `aPrevX === POCKETED_SENTINEL` 检查，跳过异常数据 |
| 4 | `ReplayLibrary` 注释仍写「最多保存 30 条」 | 更新为「最多保存 replayMaxSaved 条（默认 50）」 |

**🟡 Medium — 代码清理 (2 项)**

| # | 问题 | 修复 |
|---|------|------|
| 5 | `TrajectoryGraph` 定义了未使用的 `BALL_STRIPE_COLORS` 数组 | 删除死代码 |
| 6 | `ShotAnalyzerPanel` 存在未使用的 `_listeners` 数组 | 替换为注释说明，避免维护者困惑 |

---

## What's New in v1.8.2

### 🐛 Bug Fixes & Polish

**🔴 Critical — Memory Leaks & Crashes (5 项)**

| # | 问题 | 修复 |
|---|------|------|
| 1 | `ShotAnalyzerPanel` 切换标签时旧 `TrajectoryGraph` 和 `ResizeObserver` 未销毁 | 新增 `_cleanupGraph()`，在 `_switchTab()` 和 `_renderTrajectory()` 前调用，彻底释放旧资源 |
| 2 | `ShotAnalyzerPanel` `updateTime` RAF 回调在 `destroy()` 后访问 `null.isConnected` 崩溃 | 改为 `this.content?.isConnected` 可选链调用 |
| 3 | `ShotAnalyzerPanel` 初始 `getBoundingClientRect()` 在布局前读取可能为 0×0 | 改为由 `ResizeObserver` 驱动初始尺寸设置 |
| 4 | `Game.js` `_cleanupAfterMatch()` 只调用 `analyzerPanel.hide()`，未销毁 | 改为 `destroy()` + `null`，彻底释放面板资源 |
| 5 | `InputHandler.js` `_handleBlur()` 假事件缺少 `clientX/clientY` | 补充当前鼠标坐标，避免下游读到 `undefined` |

**🟠 High — Logic Errors & Missing Guards (5 项)**

| # | 问题 | 修复 |
|---|------|------|
| 6 | `TrajectoryGraph.js` 多处硬编码 `16` 为球数 | 提取 `BALL_COUNT` 常量，统一使用 |
| 7 | `TrajectoryGraph.js` `load()` 传入无效数据时仅清空 `frames`，其余字段残留旧值 | 无效数据时重置所有数据字段为默认值 |
| 8 | `TrajectoryGraph.js` 碰撞标记透明度计算方向反了（越来越亮而不是淡出） | 反转公式：`1.0 - 0.7 * ...`，使标记随时间淡出 |
| 9 | `ReplayLibrary.js` `save()` 不检查 `autoSaveReplays` 设置 | 开头检查设置，自动保存关闭时直接返回 |
| 10 | `ReplayLibrary.js` 使用硬编码 `MAX_REPLAYS = 30` | 改为读取 `settings.get('replayMaxSaved')`，上限 200 |

**🟡 Medium — Code Quality (3 项)**

| # | 问题 | 修复 |
|---|------|------|
| 11 | `SettingsScreen.js` `_switchCategory()` 中存在重复 `clearTimeout(this._switchTimer)` | 移除冗余块，保留单一清理逻辑 |
| 12 | `ShotAnalyzer.js` `inCircle()` 函数定义后从未使用 | 删除死代码 |
| 13 | `ShotAnalyzer.js` `_computeScore()` 中 `cuePath` 的冗余 `if` 包裹 | 移除多余条件，改用局部守卫 |

---

## What's New in v1.8.1

### 🐛 Bug Fixes & Polish

**高优先级修复（2 项）**

| # | 问题 | 修复 |
|---|------|------|
| 1 | `Game.js` 中 `TABLE` 常量未导入导致 `resolveTurn()` 运行时错误 | 补全 `import { ..., TABLE }` |
| 2 | `ShotAnalyzerPanel.js` 引用未定义的 `BALL_COLORS` | 在文件顶部添加字符串颜色表 |

**中优先级修复（4 项）**

| # | 问题 | 修复 |
|---|------|------|
| 3 | `TrajectoryGraph.js` 中硬编码 `32`（每帧浮点数） | 提取为 `FLOATS_PER_FRAME` 常量 |
| 4 | `ShotAnalyzerPanel.js` 回放速度按钮无实际功能 | 为 `TrajectoryGraph` 添加 `playbackSpeed` 属性与 `setPlaybackSpeed()` 方法 |
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
