# 3D Billiards v1.7.42 — Latest Update

## What's New in v1.7.42

### 🔍 Fifth-Round Global Deep Audit — Panel Lifecycle & Memory Leak Fix Sweep

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

## Historical Updates

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

### v1.7.40 — Third-Round Global Deep Audit — UI/UX/SFX/BGM Bug Fix Sweep

| # | 改动 | 详情 |
|---|------|------|
| 1 | **计时器位置设置真正生效** | `UI.setTimerPosition()` 原先只改动底部 HUD 的比赛用时标签（`_hudTimer`），完全没有触及 `#turn-timer`（回合倒计时）；现已重写为通过 `.top`/`.bottom` CSS 类实际移动 `#turn-timer`，并移除无意义的 `'center'` 选项 |
| 2 | **`timerPosition` 默认改为 `'bottom'`** | 与 `index.html` 中 `#turn-timer` 的默认 `bottom` 定位保持一致，避免首次进入游戏时出现设置值与视觉位置不符 |
| 3 | **移除 `showBallLabels` 死代码** | 该设置通过 CSS 变量 `--ball-labels-visible` 控制 `.ball-label` 透明度，但 3D 场景中从未创建过 `.ball-label` 元素，属于无操作；已移除 `UI.setShowBallLabels()`、`index.html` 中对应 CSS 规则、`Game._applyHudVisibility()` 中的调用，并在设置面板中改为禁用状态并标注「尚未实现」 |
| 4 | **回合超时消息被覆盖修复** | `_onTurnTimerExpired()` 中先调用 `ui.setMessage()` 显示超时提示，紧接着 `startBallInHand()` 又调用 `setMessage()` 把提示覆盖为「自由球」；现已移除前面的冗余 `setMessage()`，玩家现在能正确看到超时提示 |
| 5 | **胜利音效音量双重衰减修复** | `AudioManager.playWin()` 在单个音符的 gain node 上额外乘了 `this._sfxVolume`，而整条链路已经经过 `_sfxGain`（同样受 `_sfxVolume` 控制），导致胜利音效比其他 SFX 安静得多；已移除单音符层的额外乘数 |
| 6 | **`_handleSettingsChange` 清理 `showBallLabels` 分支** | 从批量 HUD 更新 switch 中移除已废弃的 `showBallLabels` case，保持代码整洁 |

### v1.7.39 — Second-Round Global Deep Audit — Cross-Module & Lifecycle Fixes

| # | 改动 | 详情 |
|---|------|------|
| 1 | **LAN 游戏结束状态广播修复** | `resolveTurn()` 中 `result.gameOver` 路径直接 `return` 但未调用 `_broadcastSnapshot()`，导致 LAN 主机在正常游戏结束时（如打进黑八/九号球）不向客户端广播最终状态；现在在返回前广播最终快照 |
| 2 | **灯罩自发光 fade 修复** | `updateCameraVisibility()` 循环遍历 3 个共享同一 `glowMat` 的 diffuser，每个迭代覆盖前一个的 `opacity`/`emissiveIntensity`；改为先计算最大 fade，再统一应用一次，相机 fade 现在正确 |
| 3 | **不同灯种的 emissive 独立缩放** | `_lightingQualityMult` 原为单一值（= downlight 倍数），但 sconce/table-lamp 的 emissive 也用它缩放；新增 `_sconceQualityMult` 和 `_tableLampQualityMult`，为每种灯保留独立倍数空间 |
| 4 | **Table.js dispose 完整性** | 新增 `_materials`/`_themeMeshes`/`pocketPositions`/`profile`/`physics`/`meshGroup` 的置空；dispose traverse 后 `child.material.map = null`（与 Room.js 模式一致）；`dullReflective` 新增 `jaw` 和 `cushionCap` |
| 5 | **训练/挑战/回放返回菜单时 BGM 重启** | `_stopTrainer()`、`_stopChallenge()`、`_stopReplayPlayback()` 返回菜单后没有重启 BGM；现在与 `_returnToMenu()` 保持一致 |
| 6 | **`_delay()` hanging promise 修复** | 连续调用 `_delay()` 时，第一次的 Promise 因旧 timeout 被 clear 而永远 unresolved；现在覆盖前会先 `resolve()` 旧 promise |
| 7 | **AudioManager 音量 NaN 防护** | `setMasterVolume`/`setMusicVolume`/`setSFXVolume`/`setAmbientVolume` 新增 `Number.isFinite(vol)` 前置校验，防止 slider 异常值导致音频节点崩溃 |
| 8 | **`_handleSettingsChange` 默认分支** | switch 语句新增 `default` case，静默忽略未知设置键（便于向前兼容），避免静默 fall-through 导致的行为不确定 |

### v1.7.38 — Global Deep Audit — Lighting, Match, Texture, UI, Settings

| # | 改动 | 详情 |
|---|------|------|
| 1 | **房间灯光质量实时生效** | 新增 `roomLightingQuality` 设置（高/中/低），控制天花板筒灯、壁灯、边桌台灯的亮度倍数 |
| 2 | **灯光质量与自发光同步** | 当灯光质量设为「低」时，按比例压低所有自发光材质，避免「灯亮着却不发光」 |
| 3 | **主题灯光值不被硬编码覆盖** | downlights/sconces/tableLamps 亮度基于 `lamp.pointIntensity` 主题值缩放 |
| 4 | **壁灯中等质量一致缩放** | 中等质量下壁灯从 `0.0` 改为 `0.5` |
| 5 | **天花板网格尊重用户设置** | `updateCameraVisibility()` 不再每帧强制覆盖 |
| 6 | **认输后比赛引擎通知修复** | `_concede()` 调用 `matchManager.onGameEnd(winner)` |
| 7 | **设置变更处理去重** | `lightingIntensity`/`ambientIntensity` 从 Renderer 块移除，Room 能正确收到更新 |
| 8 | **台呢纹理释放顺序修复** | `bumpMap = null` 先于 `dispose()` |
| 9 | **袋底网袋材质主题化** | `bagMats` 数组追踪克隆材质 |
| 10 | **护角与缓冲垫端帽主题化** | `jaw` → `wood.rail`，`cushionCap` → `felt.cushion` |
| 11 | **桌面聚光灯初始强度匹配主题** | `1.70` → `1.25` |
| 12 | **Room.js 析构完整性** | 新增 temp vectors / `_lightingQualityMult` 置空 |
| 13 | **SettingsScreen 死代码清理** | 移除未使用常量，同步清理 `_confirmHandlers` |
| 14 | **SETTINGS_AUDIT.md 更新** | `roomLightingQuality` 标记为 active |

### v1.7.37 — Deep Audit & Bug Fix Sweep — Room, Table, UI, Audio

| # | 改动 | 详情 |
|---|------|------|
| 1 | **扶手椅不再悬空** | 椅腿球形脚垫 `thetaStart` 从 `0` 修正为 `Math.PI/2`，group Y 从 `floorY + 44` 改为 `floorY + 33.5*LS`，椅脚现在真正落在地板上 |
| 2 | **球杆架朝向修正** | 旋转从 `Math.PI`（面朝墙）改为 `0`（面朝房间），6 根球杆现在面向球桌 |
| 3 | **壁灯移出窗户范围** | 壁灯 Z 坐标从 `±152`（与窗户重叠）改为 `±230`，避免与窗户穿模 |
| 4 | **边桌配件方向修正** | 配件（杯垫、玻璃杯）偏移逻辑从 `idx % 2` 改为墙侧感知 `x < 0 ? 1 : -1`，杯垫不再越出桌面边缘 |
| 5 | **地毯边框显影** | 边框层 Y 坐标统一提升到 `baseY + 1.35~1.65`，高于 1.2 单位厚的地毯，边框现在可见 |
| 6 | **风景画纹理双重释放修复** | 移除 `_landscapeTextures` 手动 `dispose()`，由 `traverse` 统一释放并置空 `map`，避免重复释放崩溃 |
| 7 | **地板尺寸收紧** | 从基于球桌的超大平面改为 `ROOM.halfWidth*2 × halfDepth*2`，消除房间边缘多余地板 |
| 8 | **边桌内部几何缩放** | `_createSideTable()` 中桌面、支柱、底座的几何尺寸和位置统一按 `S=1.38` 缩放，比例正确 |
| 9 | **配件放置高度修正** | `createTableAccessories()` 的 `tableTopY` 从错误值修正为 `floorY + 38*S`，与边桌实际桌面平齐 |
| 10 | **踢脚线高度提升** | 从 4.5 提升到 7.0，关闭与护墙板之间的 2.5 单位缝隙 |
| 11 | **海报分辨率翻倍** | 从 256×360 提升到 512×720，更清晰 |
| 12 | **天花板筒灯实体化** | 新增圆柱形灯罩 + 喇叭口挡板（12 盏），从纯点光源升级为有体积的灯具 |
| 13 | **墙角几何优化** | 四面墙现在精确对缝相接，移除冗余的重叠几何体 |
| 14 | **袋口半径扩大** | pool9ft/pool8ft 2.25×→2.55×，bar7ft 2.35×→2.65×，chinese8 1.95×→2.25×（相对球半径），进球更容易、更真实 |
| 15 | **缓冲垫端帽补全** | 新增 `createCushionEndCaps()`，12 个倾斜四边形桥接缓冲垫末端到袋口，消除视觉缺口 |
| 16 | **袋口护角重建** | `createPocketJaws()` 改为实体块（7.5 高 × 4.5 厚）+ 倾斜顶面 BufferGeometry，护角现在是有体积的物理阻挡 |
| 17 | **轨顶间隙消除** | 圆角半圆柱 Y 坐标下移 0.1，与轨身完全贴合 |
| 18 | **轨斜面乘数对齐** | `createRailBevels()` 的宽高乘数与 `createRails()` 统一为 2.9/3.05，消除轨斜面与轨身的微小错位 |
| 19 | **护角顶面法线修正** | 前/后倾斜面三角形顶点顺序调整，法线从朝内改为朝外，光照正确 |
| 20 | **重置按钮流程修复** | 非训练模式初始化时隐藏重置按钮；训练模式显示「重置球型」；比赛模式认输后正确委托 `matchManager.onGameEnd`，不再显示本地「再来一局」 |
| 21 | **设置面板音频同步修复** | 重置/导入配置后完整同步 5 个音频参数（开关、总音量、SFX、BGM、环境音），修复 `this._audioManager` 引用错误 |
| 22 | **确认对话框键盘支持** | 新增 Esc 取消、Enter 确认；实例级 `_confirmKeyHandler` 管理，支持重入防护和 `destroy()` 完整清理 |
| 23 | **底部 HUD CSS 清理** | 移除 flex 容器上无效的 `grid-template-columns`；添加 `flex-shrink: 0` 和 `.hud-center { flex: 1 1 auto }`，布局更稳定；移除孤儿 `.hud-detail` 规则 |

---

### v1.7.36 — Room Modelling Overhaul — Furniture & Wall Art

| # | 改动 | 详情 |
|---|------|------|
| 1 | **扶手椅建模重构** | 座面改为双层（软垫 8 + 底座 4），靠背加圆柱形顶部包边并微向后倾 3.4°，扶手改为「软垫顶 + 木质支撑」结构，椅腿加粗并新增球形脚垫 (SphereGeometry 半球) |
| 2 | **台灯建模重构** | 从简单圆柱灯罩改为完整台灯：圆形金属底座、细长灯杆、钟形 LatheGeometry 灯罩、内部灯泡球体，暖色点光源 |
| 3 | **花盆建模优化** | 添加装饰性底足环 (potFoot)、加厚卷边盆沿 (TorusGeometry r=1.0)，盆体比例更优雅 |
| 4 | **墙上风景画** | 新增 4 幅程序化山水画（CanvasTexture 512px）：前墙「mountain」、后墙「lake」、左墙「forest」、右墙「sunset」；每幅画有独立配色（天空渐变、远山层次、云雾、飞鸟） |
| 5 | **风景画生命周期** | `createPaintings()` 加入构造函数，`applyVisualSettings()` 中受 `wallDecorEnabled` 控制，`dispose()` 中正确释放纹理 |

---

### v1.7.35 — Physics Tuning, Default Settings & Room Furniture Scale

| # | 改动 | 详情 |
|---|------|------|
| 1 | **球低速阻尼提高** | `BALL.damping` 0.004→0.012，`angularDamping` 0.008→0.02，`slowBrakeStrength` 0.08→0.15；球在低速时更快停下，滚动距离更符合真实台球手感 |
| 2 | **默认关闭轨迹预测线** | `trajectoryEnabled` 默认 `true`→`false`，新玩家默认看不到辅助轨迹，需要手动在设置中开启 |
| 3 | **默认关闭准星** | `showCrosshair` 默认 `true`→`false`，与轨迹线保持一致，回归更纯粹的瞄准体验 |
| 4 | **扶手椅比例再放大** | 座面 36→70×55，靠背 36→70×35，扶手 6→10×18，椅腿 1.8→2.5 半径 / 10→30 高；group 定位 `floorY + 36`，座高约 42cm，与台球桌（75cm 高）比例协调；离墙偏移 18→35 防止穿模 |
| 5 | **边桌比例放大** | 桌面直径 20→36，柱高 10→18，底座直径 12→13→26；group 定位 `floorY + 9`，桌面高约 22cm，与扶手椅高度匹配 |
| 6 | **台灯比例放大** | 灯罩直径 4/5→7/8，高度 5→7；位置跟随边桌调整为 `floorY + 26` |
| 7 | **花盆植物整体放大** | `createPlant` 末尾统一缩放 `PLANT_SCALE = 1.6`，盆径从 28→44.8，与房间比例协调 |

---

### v1.7.34 — Deep UI/UX/SFX/BGM & Modelling QA Fixes

| # | 改动 | 详情 |
|---|------|------|
| 1 | **Room lounge modelling grouped under settings** | Armchairs, side tables, table lamps and rug are now grouped under `lounge` / `rug` theme groups and respect `decorativePropsEnabled`; disabling decorative props no longer leaves the new furniture visible. |
| 2 | **Armchair floor contact and scale corrected** | Re-applied the intended v1.7.33 chair proportions: wider 36-unit seat/back, 6×28 armrests, 1.8-radius legs and `floorY + 9.5` placement with leg centers adjusted so chairs touch the floor instead of floating. |
| 3 | **Table metal theme key mismatch fixed** | `gold` and `blackChrome` metal presets now expose `stretcherNickel`, matching `Table.js` consumers; leg stretcher metal accents now update correctly across all table themes. |
| 4 | **Audio autoplay warning reduction** | BGM startup is now deferred until a real user gesture when the AudioContext is suspended; `statechange` auto-resume only fires after a recent gesture, reducing browser "AudioContext not allowed to start" warnings. |
| 5 | **Audio listener cleanup hardened** | Gesture listener options are stored and reused for add/remove, making lifecycle cleanup more robust across browser implementations. |
| 6 | **UI destroy cleanup completed** | `UI.destroy()` now also clears push-out button hover/focus handlers and pause overlay button `onfocus`/`onblur` handlers, closing the remaining detached-DOM closure paths. |
| 7 | **Dist smoke test version check hardened** | `test/dist-smoke.test.js` now imports `VERSION_TAG` instead of hard-coding the version string, so future release bumps cannot break the production smoke test by stale text. |
| 8 | **Version sync** | `package.json`, `package-lock.json`, `src/core/Version.js`, `index.html`, `README.md`, and rebuilt `dist/index.html` are synced to `v1.7.34`. |

---

### v1.7.33 — Room Furniture Proportions & UI Memory Leak Fixes

| # | 改动 | 详情 |
|---|------|------|
| 1 | **Armchair proportions enlarged** | Seat 22→36, backrest 22→36, armrests 4→6 wide / 18→28 deep, legs 1.2→1.8 radius / 8→10 height, group positioned at `floorY + 9.5` (was `floorY + 18`) to eliminate 7.5-unit floating gap. Chairs now properly touch the floor and scale better against the pool table (254×127). |
| 2 | **UI.js `destroy()` pause button focus/blur cleanup** | `pauseBtn` and all pause overlay buttons now nullify `onfocus`/`onblur` handlers, preventing detached DOM nodes retaining closure references after game exit. |
| 3 | **UI.js `setPlayerTurn()` RAF + timeout tracking** | Added `_turnRaf` and `_turnTimeout` fields; both canceled in `destroy()`, preventing detached badge DOM retention after UI teardown. |
| 4 | **UI.js `flashRed()` RAF tracking** | Added `_flashRaf` field; canceled before creating a new flash and in `destroy()`, preventing orphaned flash nodes on rapid successive calls. |

---

### v1.7.32 — UI/UX/SFX/BGM Deep Audit

| # | 改动 | 详情 |
|---|------|------|
| 1 | **MenuSystem.js 重构为 ES 模块** | 从全局脚本改为 ES 模块导出，支持 Tree-shaking 和单元测试导入 |
| 2 | **音效管理器生命周期修复** | `AudioManager.dispose()` 现在正确移除所有事件监听器（visibilitychange、statechange、手势监听），避免内存泄漏 |
| 3 | **设置面板分类重构** | 设置面板从单页滚动改为侧边栏分类（音频、外观、相机、控制、游戏、网络），每个分类可折叠 |
| 4 | **碰撞音效冷却机制** | 添加 `SFX_COOLDOWN_MS = 20`，防止高频碰撞产生爆音 |
| 5 | **UI 文本国际化** | `UIText.js` 添加中英文切换支持，设置面板语言选择实时生效 |

---

### v1.7.31 — Settings Store v1 & Comprehensive Settings Audit

| # | 改动 | 详情 |
|---|------|------|
| 1 | **SettingsStore v1 上线** | 基于 localStorage 的持久化设置系统，支持 197 个配置键，带默认值回退和自定义事件通知 |
| 2 | **SETTINGS_AUDIT.md 审计报告** | 全面审计所有设置键的「默认值 → UI 暴露 → 运行时消费」链路，标记有效/部分/休眠/公平性相关状态 |
| 3 | **设置导入/导出** | 支持 JSON 格式的配置导入导出，便于备份和分享 |
| 4 | **公平性设置锁定** | LAN 和对战模式下，主机控制公平性相关设置，客户端显示锁定图标 |

---

### v1.7.30 — Table Profile System & Physics Engine Upgrade

| # | 改动 | 详情 |
|---|------|------|
| 1 | **TableProfile 系统** | 支持 pool9ft/pool8ft/bar7ft/chinese8/snooker12ft/carom10ft 六种台型，每种有独立尺寸、袋口、物理参数 |
| 2 | **cannon-es 物理引擎** | 从自建物理迁移到 cannon-es，支持更真实的碰撞、旋转和摩擦 |
| 3 | **球体材质系统** | 球体表面支持标准/高光/哑光/霓虹/复古五种风格，号码大小和对比度可调 |
| 4 | **袋口皮革主题** | 支持黑色/棕色/暗红三种袋口皮革颜色 |

---

### v1.7.29 — Procedural Texture System

| # | 改动 | 详情 |
|---|------|------|
| 1 | **程序化台呢纹理** | Canvas 2D 生成台呢绒毛感、菱形纹路和磨损效果，支持实时切换 |
| 2 | **台呢绒感开关** | `clothNapEnabled` 控制是否显示台呢纹理 |
| 3 | **磨损效果** | `clothWearEnabled` 控制是否显示球桌中央的高频使用磨损痕迹 |

---

### v1.7.28 — LAN Multiplayer & WebSocket Networking

| # | 改动 | 详情 |
|---|------|------|
| 1 | **LAN 服务器** | 基于 ws 的 WebSocket 服务器，支持创建房间、加入房间、2 人对战 |
| 2 | **游戏状态序列化** | `GameStateSerializer` 支持 8-ball 和 9-ball 状态的完整序列化和反序列化 |
| 3 | **快照广播** | 主机每帧广播物理快照，客户端通过插值保持同步 |

---

### v1.7.27 — Match Engine & Tournament System

| # | 改动 | 详情 |
|---|------|------|
| 1 | **MatchEngine** | 支持多局比赛（race-to-N），自动切换开球权，记录胜负统计 |
| 2 | **ChallengeManager** | 挑战模式支持多种任务目标（一杆清台、指定球序、限时挑战） |
| 3 | **成就系统** | `AchievementSystem` 支持 20+ 成就，基于游戏事件自动解锁 |

---

### v1.7.26 — AI Player & Shot Planner

| # | 改动 | 详情 |
|---|------|------|
| 1 | **AI ShotPlanner** | 基于物理模拟的击球规划器，支持 8-ball 和 9-ball 规则合法性检查 |
| 2 | **三级 AI 难度** | EASY/NORMAL/HARD 三档，影响击球选择偏好、安全球频率和走位精度 |
| 3 | **AI 训练模式** | 支持单人练习特定杆法和走位路线 |

---

### v1.7.25 — 3D Room Environment

| # | 改动 | 详情 |
|---|------|------|
| 1 | **Room.js 场景系统** | 完整的台球厅环境：地板、墙壁、天花板、窗户、灯具、装饰画 |
| 2 | **主题系统 v1** | 支持经典/现代/ tournament / 极简四种房间主题，暖色/中性/冷色三种环境光 |
| 3 | **装饰道具** | 扶手椅、边桌、台灯、花盆、地毯等可开关装饰 |

---

### v1.7.24 — Table Geometry Refactor

| # | 改动 | 详情 |
|---|------|------|
| 1 | **统一几何度量** | `_getTableGeometryMetrics()` 统一计算所有台面、缓冲垫、轨条、护角的几何参数 |
| 2 | **袋口护角** | 新增实体护角块，桥接轨条末端到袋口 |
| 3 | **缓冲垫端帽** | 12 个倾斜四边形覆盖缓冲垫末端 |

---

### v1.7.23 — WebGL Renderer & Post-Processing

| # | 改动 | 详情 |
|---|------|------|
| 1 | **Renderer 模块** | 基于 Three.js r170+ 的渲染器，支持阴影、雾效、色调映射 |
| 2 | **质量预设** | 高/中/低三档质量预设，控制阴影分辨率、像素比率和后期效果 |
| 3 | **相机系统** | 支持默认视角、俯视角、自由相机，带阻尼和平滑插值 |

---

### v1.7.22 — Physics Body & Collision System

| # | 改动 | 详情 |
|---|------|------|
| 1 | **cannon-es 集成** | 完整的物理世界：球体、台面、缓冲垫、袋口检测 |
| 2 | **碰撞事件** | 球-球、球-缓冲垫、球-袋口碰撞事件分发 |
| 3 | **物理调试** | `showPhysicsDebug` 控制是否显示碰撞体线框 |

---

### v1.7.21 — Ball System & Number Rendering

| # | 改动 | 详情 |
|---|------|------|
| 1 | **球体管理器** | `BallsManager` 统一管理 16 颗球的创建、重置、隐藏 |
| 2 | **号码渲染** | Canvas 2D 生成球体号码贴图，支持大小和对比度调整 |
| 3 | **球体风格** | 标准/高光/哑光/霓虹/复古五种表面风格 |

---

### v1.7.20 — Cue Stick & Input System

| # | 改动 | 详情 |
|---|------|------|
| 1 | **球杆模型** | 三段式球杆（皮头、前节、后把），支持多种皮肤主题 |
| 2 | **输入系统** | 鼠标/触摸瞄准，拖拽力度控制，旋转（高杆/低杆/侧旋） |
| 3 | **轨迹预测** | 基于物理模拟的击球轨迹预览线 |

---

### v1.7.19 — Game Rules Engine

| # | 改动 | 详情 |
|---|------|------|
| 1 | **8-ball 规则** | 完整的八球规则引擎：开球、选组、犯规、黑八决胜 |
| 2 | **9-ball 规则** | 完整的九球规则引擎：顺序击球、推杆、三连犯规 |
| 3 | **规则验证** | `rules.test.js` 覆盖 28 种规则场景 |

---

### v1.7.18 — UI System & HUD

| # | 改动 | 详情 |
|---|------|------|
| 1 | **HUD 系统** | 底部状态栏、玩家信息、剩余球数、力度指示器 |
| 2 | **暂停菜单** | 游戏中暂停覆盖层，支持恢复、设置、返回主菜单 |
| 3 | **小地图** | 俯视视角球位小地图，支持位置切换 |

---

### v1.7.17 — Menu System & Navigation

| # | 改动 | 详情 |
|---|------|------|
| 1 | **主菜单** | 自由练习、本地双人对战、人机对战、9-ball、训练模式、挑战模式、LAN 对战 |
| 2 | **菜单动画** | 分类切换、按钮悬停、面板滑入滑出动画 |
| 3 | **版本标签** | 主菜单右下角显示当前版本号 |

---

### v1.7.16 — Project Bootstrap

| # | 改动 | 详情 |
|---|------|------|
| 1 | **Vite 构建系统** | ES2022 模块，支持热更新和生产构建 |
| 2 | **测试框架** | 自定义 Node.js assert 测试运行器，覆盖规则、台型、LAN、AI、冒烟测试 |
| 3 | **GitHub Actions** | `.github/workflows` 自动化构建和部署 |
