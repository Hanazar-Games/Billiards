# 3D Billiards v1.12.0 — Latest Update

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
