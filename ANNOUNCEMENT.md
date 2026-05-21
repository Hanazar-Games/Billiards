# 3D Billiards v1.7.29 — Latest Update

## What's New in v1.7.29

### 🔒 LAN Fairness & Host Authority — Competitive Settings Lock, Room Experience, State Sync

| # | 改动 | 详情 |
|---|------|------|
| 1 | **公平设置真正锁定（UI + 运行时）** | `MATCH_FAIRNESS_KEYS` 中的 5 项已实现设置（轨迹线、小地图、回合计时器、击球力度灵敏度、准星）现在在 LAN 客户端和本地比赛中被真正锁定：`SettingsScreen` 显示 `🔒` 灰度禁用控件 + tooltip「由房主/比赛锁定」；房主仍可调，客户端不可改 |
| 2 | **公平设置 host-authority 同步** | `GameStateSerializer` 现在在状态快照中附带 `fairness` 字段（房主本地设置）；客户端收到后自动覆盖自己的对应设置，确保所有玩家使用完全相同的竞技参数；客户端本地修改被忽略，返回单机后恢复个人设置 |
| 3 | **清理公平键列表** | 移除 5 个尚未实现的占位键（`showWinProbability`、`showOpponentTrajectory`、`skipOpponentTurn`、`autoHints`、`hintFrequency`）出 `MATCH_FAIRNESS_KEYS`，移至 `MATCH_FAIRNESS_RESERVED`；避免未实现功能意外锁定正常 UI |
| 4 | **房间体验优化** | `LanRoomPanel` 现在对所有服务器错误提供中文说明：房间不存在、房间已满、游戏已开始、已在其他房间、服务器未启动等；连接失败和操作出错后按钮自动恢复可用，用户不会卡住 |
| 5 | **LAN 测试增强** | 新增 4 项测试：自定义桌型（`chinese8`）在 `startGame` 中同步到客户端、加入不存在房间被拒、游戏已开始后加入被拒；总测试数从 10 项增至 14 项 |

### 🔧 Version Sync, Build Hygiene & Settings Audit Update

| # | 改动 | 详情 |
|---|------|------|
| 6 | **统一版本号** | `package.json`、`src/core/Version.js`、`index.html`、`dist/index.html`、`README.md` 全部同步为 `v1.7.29`，消除线上/线下版本显示不一致 |
| 7 | **清理旧 dist assets** | 移除并替换旧的 hash 化 JS 文件，确保 `dist/index.html` 不引用已不存在的 chunk |
| 8 | **SETTINGS_AUDIT.md 更新** | 轨迹外观、小地图外观、FX 独立开关全部标记为 ✅ 已实现；公平键审查反映当前实现/保留状态；待办列表更新 |
| 9 | **README 脚本说明更新** | 新增 `npm run preview`、`npm run test:lan`、`npm run test:smoke` 说明；版本号更新 |

---

# 3D Billiards v1.7.27

## What's New in v1.7.27

### 🎨 Visual Enhancements — Configurable Trajectory, Minimap, FX & Cloth Textures

| # | 改动 | 详情 |
|---|------|------|
| 1 | **轨迹透明度/粗细可调** | 设置面板新增「轨迹透明度」（10%–100%）和「轨迹粗细」（0.5x–3.0x）滑块；`TrajectoryPredictor` 实时读取并应用到瞄准线、碰撞线和幽灵球材质 |
| 2 | **轨迹颜色模式** | 新增「轨迹颜色」下拉选项：默认（淡青）、高对比（亮黄）、色盲友好（深蓝）；色盲模式下瞄准线为实线而非虚线，提升辨识度 |
| 3 | **轨迹幽灵球脉冲动画** | 开启「轨迹动画」后，幽灵球透明度按正弦波脉冲呼吸（0.5 + sin×0.15），动画使用 `dt` 驱动保证帧率无关；关闭后保持恒定透明度 |
| 4 | **FX 独立开关** | 粒子总开关保留，但冲击波、碰撞火花、袋口喷泉、球回收动画现在各有独立开关，玩家可按喜好分别启停 |
| 5 | **小地图球大小可调** | 设置面板新增「小地图球大小」（0.5x–2.0x）滑块；Minimap 初始化时读取并支持设置变更后热更新 |
| 6 | **小地图高对比模式** | 开启后小地图使用深绿台面 `#145233`、亮金边框 `rgba(216,177,95,0.7)`、粗黑球边、白球白色光晕，提升低视力玩家可读性 |
| 7 | **小地图 cue trail 可控** | 新增「显示球杆轨迹」开关和「轨迹长度」（10–100）滑块，独立控制 cue ball 历史轨迹的显示与保留长度 |
| 8 | **桌布纹理合成** | 之前 nap/pattern/wear 纹理互相覆盖导致只有最后一个生效；现在统一合成到一张 CanvasTexture `bumpMap` 中，使用 `lighter` 混合与 `NoColorSpace`， Nap + 图案 + 磨损可同时呈现 |
| 9 | **金属饰板主题键修复** | `TableThemes.js` 中 `stretcherN` 键与 `Table.js` 查找的 `stretcherNickel` 不匹配，导致镍色金属饰板主题不生效。已统一为 `stretcherNickel` |
| 10 | **RoomThemes 材质透明度支持** | `applyMaterialTheme()` 现在正确处理 `opacity` 和 `transparent` 字段，与 `TableThemes` 行为一致 |

### 🔧 Deep Audit Bug Fixes — Audio Mute, DOM Race, NaN Guards & Physics Safety

| # | 改动 | 详情 |
|---|------|------|
| 11 | **AudioManager 静音失效** | 6 处音量比例使用 `|| 1.0`，导致用户设为 `0` 时被误判为 falsy 回退到 `1.0`，静音不生效。已全部改为 `?? 1.0` |
| 12 | **AudioManager playWin 音量错误** | `playWin()` 使用 `hitFeedbackVolumeScale` 控制胜利和弦音量，已修正为使用自身的 `_sfxVolume` |
| 13 | **UI.flashRed DOM 竞态** | `flashRed()` 内部定时器未追踪，300ms 后可能操作已被 `destroy()` 移除的 DOM 节点。已改为实例级 `_flashTimer` 并在 `destroy()` 中清理 |
| 14 | **SettingsScreen 滑块 NaN** | 小地图透明度、球大小、轨迹透明度等 slider 的初始值在设置项缺失时产生 `NaN`，控件显示异常。已全部添加 `??` 回退 |
| 15 | **Table.js bumpMap 颜色空间错误** | 合成后的 CanvasTexture 默认使用 SRGB 颜色空间，但 bump map 存储的是高度数据而非颜色。已显式设为 `THREE.NoColorSpace` |
| 16 | **Trajectory 动画硬编码 dt** | `update()` 中动画增量写死 `0.016`，高帧率下脉冲过快。已改为接受 `dt` 参数，由 `Game.updateTrajectory()` 传入 |
| 17 | **ImpactShockwave 硬编码 maxPower** | 粒子强度计算使用硬编码 `82`，与实际的 `SHOT.maxPower` 不同步。已改为从常量模块导入 |
| 18 | **PowerLabel 硬编码 maxPower** | 同上，`PowerLabel.js` 中分级逻辑使用硬编码 `82`。已统一导入 `SHOT.maxPower` |
| 19 | **ParticleSystem 强度上限** | `_getIntensityMult()` 缺少上限，极端/损坏值可导致渲染压力暴增。已钳制到 `[0.2, 3.0]` |
| 20 | **BallReturn 空指针防护** | `animateBallReturn()` 在 `pBall.mesh` 为 `null` 时可能崩溃。已添加守卫 |
| 21 | **Room 铭牌纹理未赋值** | `createRoomPlaque()` 生成 CanvasTexture 后未正确赋给 `roomPlaque.material.map`，铭牌始终显示默认材质。已修复赋值 |
| 22 | **键盘 Enter 输入框穿透** | 游戏快捷键在 `INPUT`/`TEXTAREA` 获得焦点时仍触发击球。已添加 `event.target.tagName` 检查，输入框聚焦时忽略 Enter 击球 |

---

# 3D Billiards v1.7.26

## What's New in v1.7.26

### 🎮 Game Experience Enhancements — Foul Feedback, Target Hints & Practice Mode

| # | 改动 | 详情 |
|---|------|------|
| 1 | **犯规原因详细提示** | 8球/9球规则引擎的犯规消息现在带具体原因：「白球落袋」「没有球被撞到」「没有球碰库」「先碰了错误的球」「开球犯规（少于4颗球碰库）」等，玩家清楚知道为什么犯规 |
| 2 | **8球 HUD 动态目标提示** | 台面开放时显示「台面开放 · 先进球决定分组」；分组后显示「玩家 1: 全色 ● | 玩家 2: 花色 ◯」，每回合自动更新 |
| 3 | **9球 HUD 目标球提示** | 顶部玩家详情栏从「剩 9」改为显示当前目标球号码「目标 3号」；顶部信息栏显示「9球模式 · 目标球: 3号」 |
| 4 | **自由球摆放具体原因提示** | 白球摆放位置无效时，不再只显示笼统的「当前位置无效」，而是具体提示「自由球必须放在台面内」「自由球必须放在开球线后」「自由球不能贴住其他球」「自由球不能放在袋口附近」 |
| 5 | **练习模式击球反馈** | freeplay 模式每次击球后显示 2.5 秒 shot feedback，如「力度 78% · 进 2 颗 · 右旋 · 中」，帮助玩家感知力度、进球数和旋转效果 |
| 6 | **犯规引导提示通用化** | 首次犯规提示从仅适用于 8球的「先碰自己的球，不能先碰黑八」改为通用规则说明「白球不能落袋，且必须先碰合法目标球，击球后需有球碰库或进袋」 |
| 7 | **9球开球文案修正** | 移除 9球开球成功消息中不恰当的「台面开放」表述（9球没有 open table 概念） |

### 🔧 Deep Audit Bug Fixes — Critical Crashes, Memory Leaks & State Bugs

| # | 改动 | 详情 |
|---|------|------|
| 8 | **挑战模式球碰撞崩溃** | `setupCollisionEvents` 中引用不存在的 `ballA`/`ballB` 变量，挑战模式下每次球碰撞抛出 `ReferenceError`。已修正为 `ball`/`otherBall` |
| 9 | **训练模式库边碰撞崩溃** | `this.rules.recordCushionHit?.(ball.id)` 在训练模式（`this.rules === null`）下抛出 `TypeError`。已改为 `this.rules?.recordCushionHit?.(ball.id)` |
| 10 | **Push-out Accept 按钮逻辑错误** | `acceptPushOut()` 返回 `this.currentPlayer`（即推杆者本人），导致对手点击「接受」后仍然是推杆者击球。已修正为返回对手 |
| 11 | **犯规引导提示显示函数源码** | `OnboardingTips.show()` 当 `dynamicText` 为 falsy 且 `tip.text` 为函数时，`textContent` 被设为函数对象本身，玩家看到 JavaScript 源码。已改为始终调用函数并传入空字符串 |
| 12 | **PowerLabel 重置后不重建** | `resetGame()` 中 `powerLabel?.dispose()` 后未重新创建，导致「再来一局」后力度分级标签永久消失。已补充重建 |
| 13 | **AudioManager 音量 NaN 防护** | 6 处 `settings.get('...VolumeScale')` 在设置项缺失时返回 `undefined`，与数字相乘产生 `NaN`，导致对应音效无声。已全部添加 `|| 1.0` 回退 |
| 14 | **AudioManager 环境音量设置丢失** | `setAmbientVolume()` 在音频上下文未就绪时提前返回，导致 `_ambientVolume` 未被存储，设置丢失。已将赋值移至 guard 之前 |
| 15 | **MenuSystem _delay 定时器泄漏** | `_delay()` 连续调用时旧 timer ID 被覆盖且无法取消，泄漏定时器并可能在错误状态触发 resolve。已添加 `clearTimeout` 清理旧 timer |
| 16 | **回放桌面配置崩溃** | `_startReplayPlayback()` 中 `getTableProfile()` 对未知 ID 可能返回 `null`，`new Table(..., null)` 会崩溃。已添加 `getDefaultTableProfile()` 回退 |
| 17 | **粒子系统 bounding sphere 膨胀** | 死粒子被移到 `(99999, ...)` 导致 Three.js 计算巨大的 bounding sphere，破坏视锥剔除。已为 Points mesh 设置 `frustumCulled = false` |
| 18 | **SettingsScreen 键位预设崩溃** | `keyBindings.getCurrentPreset()` 可能返回 `null`，`.split(':')` 抛出 TypeError。已添加空字符串回退 |
| 19 | **SettingsScreen 配置下载 URL 过早释放** | 导出设置时 `URL.revokeObjectURL(url)` 紧跟 `a.click()` 之后，部分浏览器可能在下载开始前 revoke。已改为 5 秒后延迟释放 |
| 20 | **ScreenShake dispose 引用不存在属性** | `dispose()` 中 `this._originalPosition = null` 引用从未声明的属性，已移除无效代码 |
| 21 | **Game.js 硬编码中文统一化** | 训练模式「练习击球技巧 — 进球后查看评分」「重置球型」、声音开关「声音已开启/已关闭」、挑战模式「挑战模式」共 5 处硬编码中文已移至 `UIText.js` |
| 22 | **UIText 练习模式文案修正** | `freeplayIntro` 提到「犯规自由球时白球可在球桌内任意摆放」，但练习模式没有犯规系统。已改为更准确的描述 |

---

# 3D Billiards v1.7.25

## What's New in v1.7.25

### 🎨 UI/UX Overhaul — Menu Hierarchy, HUD Clarity & Settings Transparency

| # | 改动 | 详情 |
|---|------|------|
| 1 | **主菜单按钮分组** | 将 11 个扁平按钮重组为 4 个视觉区块（开始游戏 / 练习与挑战 / 资料与社交 / 系统），宽屏下 2 列网格布局，移动端自动折叠为单列 |
| 2 | **主菜单滚动支持** | 修复短视口下菜单内容被截断无法访问的问题；容器新增 `overflow-y: auto` 与底部内边距 |
| 3 | **主菜单 show/hide 竞态修复** | `show()` 现在会清除 pending 的 `hide` 定时器，避免快速切换时菜单闪烁后消失 |
| 4 | **HUD 旋转指示器** | 底部 HUD 中心新增实时旋转方向显示（如「左旋 · 强」「下右旋 · 中」「无旋转」），与球杆击球点同步 |
| 5 | **HUD 连击计数器** | 设置中开启后，连续进球时顶部显示「连击 ×N」；犯规或 Miss 后自动清零 |
| 6 | **顶部玩家徽章同步** | 顶部 `#player1` / `#player2` 徽章现在显示实际玩家名字，减少与底部 HUD 的信息冗余 |
| 7 | **29 项未实现设置标记为「未实现」** | 设置面板中所有占位功能（后处理、热力图、胜率预测、语音播报、单手柄/左撇子模式、语言切换等）现在显示「未实现」灰色徽章，控件不可交互且不会意外修改配置 |
| 8 | **移动端布局安全** | 520px 以下屏幕小地图自动缩小；菜单网格强制单列；玩家徽章缩小内边距 |

### 🔧 Deep Audit Bug Fixes — Memory Leaks, Crashes & Event Hygiene

| # | 改动 | 详情 |
|---|------|------|
| 9 | **AchievementPanel 定时器数组泄漏** | `showToast()` 将 dismiss/remove 定时器推入 `_toastTimers` 后永不清理，长游戏会话中数组无限增长。已在回调完成后从数组中过滤移除 |
| 10 | **AudioManager 悬空 setTimeout** | `_autoDisconnect()` 的回退 `setTimeout(doDisconnect, 5000)` 未存储 ID，`dispose()` 无法取消，导致闭包与音频节点被额外持有 5 秒。已引入 `_pendingDisconnects` Set 追踪并统一清理 |
| 11 | **Game.init() 重复调用泄漏监听器** | 同一 `Game` 实例若被 `init()` 两次，第一次的 `window` 事件监听器（trajectory、shotTrail、comboCounter、settingsChanged）会因引用被覆盖而永远无法移除。已添加 `_initialized` 标志阻止重复初始化 |
| 12 | **Game._handleManualBallContact 未定义变量崩溃** | 手动球碰撞处理函数中引用不存在的 `ball` 和 `otherBall`（应为 `ballA`、`ballB`），挑战模式下触发碰撞时抛出 `ReferenceError`。已修正变量名 |
| 13 | **Game.dispose() 遗漏关键引用** | 销毁时未清空 `aiPlayer`、`networkController`、`rules`，若实例被闭包意外持有会导致这些子图持续泄漏。已补充显式置空 |
| 14 | **SettingsScreen 确认框 keydown 泄漏** | 确认对话框的 `keydown` 处理器仅存储在 DOM 元素的 `_keydownHandler` 属性上，若 DOM 被外部移除则处理器永远无法清理。已引入实例级 `_confirmHandlers` Set 双重追踪，确保 `hide()` / `destroy()` 全量移除 |
| 15 | **UI.flashRed 游离 DOM 闭包** | 内层 `setTimeout` 闭包捕获了已被 `destroy()` 移除的 DOM 节点引用，导致节点在 300ms 内无法被 GC。已改为在回调内部重新 `getElementById` 查询 |
| 16 | **KeyBindings 全局监听器未清理** | 模块级单例 `keyBindings` 的 `dispose()` 从未被调用，`settingsChanged` 监听器永久驻留。已在 `MenuSystem._quit()` 中补充调用 |
| 17 | **UI.setSpin NaN 防护** | 传入非法 spin 对象（含 `NaN` 或非数字）时，`Math.abs(undefined)` 产生 `NaN`，HUD 显示异常文本「旋 · 弱」。已添加 `Number.isFinite` 校验与回退到零 |
| 18 | **MainMenuScreen 回调校验** | `_fadeOut` 未校验 `callback` 是否为函数，传入非函数值时 400ms 后抛出 `TypeError`。已添加 `typeof` 守卫；构造函数中 `onSelectMode` 默认值为空函数防止未定义崩溃 |
| 19 | **MainMenuScreen destroy 事件清理** | 退出按钮的 `onmouseenter/onmouseleave/onclick` 在 `destroy()` 中未清空，闭包可能短暂持有引用。已补充显式置空 |

---

# 3D Billiards v1.7.22

## What's New in v1.7.22

### 🔧 Deep Audit Bug Fixes — Challenge UI, AI, Replay & Game Stability

| # | 改动 | 详情 |
|---|------|------|
| 1 | **ChallengePanel ID 作用域冲突** | `_renderList()` 使用 `document.getElementById` 全局查询 `#challenge-grid` / `#challenge-banners`，若其他组件使用相同 ID 会导致渲染到错误的 DOM 子树。已改为 `this.container.querySelector` 限定作用域 |
| 2 | **TrainerHUD 个人最佳徽章被覆盖** | `updateLabel(text)` 直接设置 `this.labelEl.textContent`，抹除了 `_buildUI()` 中附加的个人最佳徽章子元素。已改为只更新内部的 `titleSpan`，保留徽章 |
| 3 | **ShotPlanner 缺失 mesh 空指针防护** | `findAllShots()` / `findBankShots()` / `evaluateShot()` / `evaluateBankShot()` / `findSafetyShot()` 直接访问 `cueBall.mesh.position` / `targetBall.mesh.position` 未做空值检查，异常球对象可导致崩溃。已统一添加 `if (!ball || !ball.mesh) return` 守卫 |
| 4 | **ShotPlanner bank shot 未接收 tableProfile** | `findAllShots()` 将 `tableProfile` 参数透传给 `evaluateShot()`，但 `findBankShots()` 未接收该参数，导致 bank shot 始终使用默认桌面尺寸。已修复参数透传 |
| 5 | **ShotPlanner isPathBlocked 退化路径漏检** | 当起点终点重合（`abLenSq < 0.001`）时直接返回 `false`，若该位置恰有其他非排除球存在则漏检。已补充退化路径下的点位置碰撞检测 |
| 6 | **ReplayLibrary._save() 静默失败** | `_save()` 捕获异常后未返回值，`save()` 始终返回 `true`，调用方无法感知 localStorage 写入失败（如超出配额）。已改为 `_save()` 返回布尔状态，`save()` 透传该返回值 |
| 7 | **ReplayLibrary 导入校验过弱** | `importAll()` 仅检查 `item.frames` 真值和 `frameCount >= 2`，不校验 `frames` 是否为数组、`frameCount` 是否为数字、`score` 是否存在，畸形数据可 corrupt 库。已增加严格类型校验 |
| 8 | **ReplayLibrary 导入批次内 ID 碰撞** | 同一批次导入的两个条目若原 ID 相同，碰撞检查仅对比已有库，导致两者被赋予相同的生成 ID。已引入 `seenIds` Set 追踪本批次已分配 ID，确保批次内唯一 |
| 9 | **ShotReplay.load() 残留旧帧** | 传入无效数据时 `load()` 直接 `return false`，未清空 `this.frames`，播放器仍持有上一局数据。已补充 `this.frames = null; this.frameCount = 0` 后再返回 |
| 10 | **ShotReplay frameRate 非法值** | `frameRate` 直接取 `data.frameRate || 20`，接受 `0`、负数、`Infinity` 等非法值，导致 `frameInterval` 计算异常。已添加正数且有限校验，非法时回退到 20 |
| 11 | **ShotReplay.seekRatio() 越界** | 未对输入 `ratio` 做边界校验，可传入负数或大于 1 的值导致越界寻址。已添加 `Math.max(0, Math.min(1, ratio))` 钳制 |
| 12 | **ReplayPanel 导入 input 无 ID 泄漏** | `_importReplays()` 创建的 `<input>` 无 ID，`destroy()` 中通过 `#replay-import-input` 查询不到，无法清理 DOM。已添加 `input.id = 'replay-import-input'` |
| 13 | **ReplayPanel updateControls 每帧 DOM 抖动** | `updateControls()` 每帧无条件重写 `textContent` / `style.width`，造成不必要的回流重绘。已引入缓存字段 `_lastPlayText` / `_lastSpeedText` / `_lastTimeText` / `_lastProgressPct` / `_lastMetaText`，仅变化时更新 |
| 14 | **ReplayPanel 元数据残留** | `meta` 为 falsy 时未清空 `metaDisplay`，上一局元数据会持续显示。已补充 `else` 分支清空 |
| 15 | **MenuSystem 回放进度条除零** | `progressBar.onclick` 中 `(e.clientX - rect.left) / rect.width` 在 `rect.width === 0` 时产生 `NaN`。已添加 `rect.width <= 0` 提前返回 |

---

# 3D Billiards v1.7.19

## What's New in v1.7.19

### 🎱 Training Course Progression System

| # | 改动 | 详情 |
|---|------|------|
| 1 | **训练课程进度系统** | 训练模式升级为课程进度系统：每个关卡记录最佳星级、最佳力度误差、完成次数；基础关卡完成后解锁进阶关卡，进阶完成后解锁高级关卡 |
| 2 | **DrillManager 数据模型增强** | 新增 `powerError`（力度误差）、`completions`（完成次数）、`bestPowerError`（历史最佳误差）、`lastPlayed`（最后游玩时间）字段，所有数据持久化到 localStorage（`billiards_trainer_v1`） |
| 3 | **TrainerPanel 进度 UI** | 训练列表顶部新增总进度条（完成关卡数 + 总星级）；每个训练卡片显示完成次数徽章、最佳力度误差徽章、建议力度徽章；类别头部显示 `X/Y 完成 · N/M 星` |
| 4 | **TrainerPanel 解锁提示** | 锁定的进阶/高级关卡显示具体解锁条件（如"完成 1 个基础练习以解锁"），替代模糊的"完成前置练习以解锁" |
| 5 | **TrainerHUD 个人最佳徽章** | 游戏内 HUD 顶部标签旁显示个人最佳星级和力度误差；新增蓝色"建议力度"药丸提示 |
| 6 | **TrainerResult 新纪录提示** | 结果面板新增金色横幅：获得新星级纪录时显示"🌟 新纪录！"，获得新力度误差纪录时显示"🎯 最佳力度！"；统计区显示力度误差、历史最佳星级 |
| 7 | **MenuSystem 数据透传** | `_stopTrainer()` 将 `powerError`、`isNewBestStars`、`isNewBestPowerError`、`completions`、`prevBestStars` 完整传递给结果面板 |
| 8 | **Game.js 修复 drillConfig 未赋值** | `init()` 中补充 `this.drillConfig = modeConfig.drill || null`，修复训练模式动态导入 `TrainerHUD.js` 时 `drillConfig` 始终为 `undefined` 导致 HUD 无法创建的隐患 |
| 9 | **烟雾测试增强** | 训练流程新增 3 项断言：总进度条可见、卡片包含力度提示、游戏内 HUD 可见（含 🎯 和建议力度），烟雾测试总数从 44 项增至 47 项 |

---

### 🔧 Deep Audit — Network Stability, Audio Resilience & UI Hardening

| # | 改动 | 详情 |
|---|------|------|
| 1 | **Game dispose 遗漏网络监听器** | `Game.dispose()` 移除了 `stateSnapshot`/`shotInput`/`pocketEvent`/`pushOutDeclare`/`pushOutChoice`/`disconnected`，但漏了 `roomClosed`。已补充移除 `roomClosed` 监听器并清空 `_onNetRoomClosed` 引用，防止销毁后 LAN 房间关闭事件仍触发已释放对象的回调 |
| 2 | **网络客户端回合计时器越权** | `_onTurnTimerExpired()` 在网络客户端模式下仍本地切换玩家并给自由球，导致与房主状态不同步。已修复：客户端仅显示提示并停止本地计时，等待房主权威快照 |
| 3 | **网络客户端回放录制缺失** | 局域网客户端路径的 `shoot()` 未调用 `recorder.start()`，导致客户端无法录制回放。已补充与本地路径一致的录制启动 |
| 4 | **游戏循环 render 空指针** | `MenuSystem` 游戏循环 `render` 回调未检查 `this.game` 是否存在，极端场景下（游戏快速dispose）可能崩溃。已添加 `if (this.game)` 守卫 |
| 5 | **音频手势恢复一次性失效** | `AudioManager` 的 click/keydown/touchstart/pointerdown 手势监听器使用 `{ once: true }`，浏览器再次挂起 AudioContext 后无法通过后续手势恢复。已移除 `{ once: true }`，保证任意手势均可尝试恢复 |
| 6 | **浮动文字越界** | `UI.showFloatingText()` 对屏幕外坐标（如投影失败时的极端值）未做限制，文字可能飘出视口甚至产生滚动条。已添加视口边界 clamp |
| 7 | **局域网面板按钮连击** | 创建/加入/开始按钮在异步操作期间未禁用，快速点击可导致重复请求和状态错乱。已添加 `_setButtonsDisabled()` 在操作期间锁定按钮 |
| 8 | **局域网模式参数丢失** | `_startNetworkGame()` 硬编码 `'local2p'` 忽略了房主广播的实际 `mode`（未来 9 球联机时会导致规则错误）。已改为透传 `mode`，并在 `_getModeConfig()` 中显式处理 `'8ball'` |

---

# 3D Billiards v1.7.17

## What's New in v1.7.17

### 🔧 Comprehensive Deep Audit — UI/UX/SFX/BGM & Critical Bug Fixes

| # | 改动 | 详情 |
|---|------|------|
| 1 | **Enter 键直接击球失效** | `Game._setupSpinControls()` 中按 Enter 击球前未设置 `this.state = 'SHOOTING'`，导致 `update()` 不处理物理和进袋判定，Enter 键击球完全失效。已修复为先切状态再调用 `shoot()` |
| 2 | **球杆可见性空指针防护** | `Game.update()` 中 `this.cue.visible` 两处访问未做空值检查，球杆未初始化时会崩溃。已补充 `this.cue &&` 守卫 |
| 3 | **回合计时器到期后状态不一致** | `_onTurnTimerExpired()` 手动重置 `this.state = 'AIM'` 但未清理 `charging` 和 `dragStart`，若玩家正在拖动会导致状态残留。已改为调用 `_enterAimState()` 统一重置 |
| 4 | **resolveTurn 状态重置统一化** | `resolveTurn()` 中手动设置 AIM 状态和重置球杆/轨迹/力度逻辑，与 `_enterAimState()` 重复。已替换为统一调用 `_enterAimState()` |
| 5 | **挑战 HUD 帧级 DOM 泄漏** | `_updateChallengeHUD()` 在 `ui-layer` 被移除时仍每帧创建新的 `<div>` 孤儿节点。已添加 `if (!uiLayer) return;` 提前退出 |
| 6 | **比赛设置面板未显示** | `MenuSystem._showMatchSetup()` 创建 `MatchSetupPanel` 后未调用 `.show()`，面板始终不可见。已补充 `.show()` 调用 |
| 7 | **比赛设置面板重复实例泄漏** | `_showMatchSetup()` 未销毁旧面板直接覆盖引用，快速点击会产生孤儿实例。已添加先 `destroy()` 再创建的逻辑 |
| 8 | **训练/挑战开始时结果面板未隐藏** | `_startTrainer()` 和 `_startChallenge()` 未隐藏 `trainerResult`/`challengeResult`，点击"再试一次"时结果面板残留。已补充 `hide()` |
| 9 | **UI 全局 CSS 属性泄漏** | `UI.destroy()` 未重置 `--ball-labels-visible` 和 `high-contrast`/`large-text`/`reduce-motion` 类，销毁后仍影响全局样式。已补充清理 |
| 10 | **UI 重置按钮 onclick 泄漏** | `UI.destroy()` 显式清空设置/认输按钮的 `onclick`，但遗漏了 `_hudNewGameBtn.onclick`。已补充清空 |
| 11 | **回放导入定时器泄漏** | `ReplayPanel._importReplays()` 中 5 秒清理 `input` 的 `setTimeout` 未被追踪，`destroy()` 前触发会导致 DOM 残留。已追踪并在 `destroy()` 中清理 |
| 12 | **ScreenShake 缺失 dispose** | `ScreenShake` 类无 `dispose()` 方法，`this.camera` 引用永不释放，阻碍 GC。已添加 `dispose()` 清空引用 |
| 13 | **冲击波 NaN/Infinity 泄漏** | `ImpactShockwave.spawn()` 对非法 `power`（NaN/Infinity）无防护，`update()` 中 `p` 永远达不到 1.0，网格永久残留。已添加 `Number.isFinite(power)` 守卫 |
| 14 | **8 球开台规则错误** | 开台时同时打进纯色和花色，代码未分配组别且将球权交给对手。已修复：开台状态打进任意目标球时击球者继续击球 |
| 15 | **9 球 pushOutPending 状态泄漏** | `startShot()` 未清除 `pushOutPending`，若对手未及时选择 accept/pass， stale 状态会带入下一杆。已补充清零 |
| 16 | **局域网服务器 JSON 崩溃** | `lan-server.js` 中 `JSON.stringify` 无 try/catch，循环引用消息会导致整个服务器进程崩溃。已全路径包裹 try/catch |
| 17 | **局域网服务器类型错误崩溃** | `data.roomId.toUpperCase()` 假设输入为字符串，数字输入会抛出未捕获 TypeError。已改为 `String()` 转换 |
| 18 | **局域网房间 host 引用泄漏** | 最后一个客人离开后房间被删除，但 `room.host._room` 未清空，房主无法再创建新房。已补充清空 |
| 19 | **网络客户端 Promise 挂起** | `connect()` 在仅触发 `onclose` 无 `onerror` 时 Promise 永不 resolve/reject，调用方永久等待。已添加 `_connectResolved` 标志并在 `onclose` 中 reject |
| 20 | **网络客户端旧 socket 监听器泄漏** | `connect()` 未清理旧 WebSocket 的事件处理器就创建新连接。已先置空旧处理器 |
| 21 | **键位绑定原型污染** | `KeyBindings.saveCustomPreset()` / `loadCustomPreset()` 使用 `__proto__` 或 `constructor` 作为名称可污染对象原型。已添加名称黑名单拦截 |
| 22 | **设置存储 JSON 解析损坏** | `SettingsStore._load()` 对 `JSON.parse` 结果直接展开，非对象值（如字符串/数字）会 corrupt 所有设置。已添加 `typeof === 'object'` 校验并回退到默认配置 |

---

# 3D Billiards v1.7.16

## What's New in v1.7.16

### 🔧 Panel Lifecycle Leak Fixes

| # | 改动 | 详情 |
|---|------|------|
| 1 | **返回主菜单时彻底销毁结果面板** | `MenuSystem._showMainMenu()` 中将 `replayPanel.hideList()`、`challengeResult.hide()`、`trainerResult.hide()` 改为 `destroy()` 并清空引用，防止结果面板的键盘事件监听器和 DOM 元素在返回主菜单后持续泄漏 |
| 2 | **回放结束后清理结果面板** | `MenuSystem._stopReplayPlayback()` 中同样将 `challengeResult.hide()` 改为 `destroy()`，确保回放流程结束后不留残余监听器 |
| 3 | **普通游戏返回菜单时清理结果面板** | `MenuSystem._returnToMenu()` 中将 `challengeResult.hide()` 改为 `destroy()`，统一所有返回主菜单路径的清理行为 |

---

# 3D Billiards v1.7.15

## What's New in v1.7.15

### 🔧 Comprehensive Deep Audit Fixes

| # | 改动 | 详情 |
|---|------|------|
| 1 | **球杆实例全路径空指针保护** | `Game.js` 中所有 18 处 `this.cue.show()`/`hide()`/`setAim()`/`strikeSnap()` 调用统一增加 `this.cue` 存在性检查，覆盖蓄力、瞄准、AI 动画、球权切换、认输、重置等全部代码路径，彻底消除球杆未初始化或已销毁时的崩溃风险 |
| 2 | **blur 事件指针捕获清理** | `InputHandler._handleBlur()` 在 `isDown` 分支中补充清空 `_capturedPointerId`，防止窗口失焦后指针捕获状态残留 |
| 3 | **构造函数缩进修复** | `InputHandler` 构造函数中 `_capturedPointerId` 初始化语句缩进修正 |
| 4 | **移除重复的挑战结果隐藏调用** | `MenuSystem` 中 `_showSettings`、`_showAchievements`、`_showReplays`、`_showChallenges`、`_showTrainer`、`_showLanRoom`、`_showMatchSetup` 共 7 处方法删除多余的 `challengeResult.hide()` 重复调用 |

---

# 3D Billiards v1.7.14

## What's New in v1.7.14

### 🔧 Deep Audit Defensive Fixes

| # | 改动 | 详情 |
|---|------|------|
| 1 | **Pointer Capture 正确释放** | `InputHandler.dispose()` 现在使用实际捕获的 `pointerId` 释放指针捕获，而非硬编码 `1`，避免多指针设备或异常场景下释放失败 |
| 2 | **指针 ID 全生命周期跟踪** | `InputHandler` 在 `pointerdown` 时记录 `pointerId`，在 `pointerup`/`pointercancel`/`blur`/`lostpointercapture` 时清空，确保 dispose 时始终释放正确的捕获 |
| 3 | **瞄准方向零向量防护** | `Game.updateAimDirection()` 在归一化前检查 `aim.lengthSq() > 0`，防止鼠标恰好位于 cue ball 正上方时产生 NaN 方向向量 |
| 4 | **球杆实例空指针保护** | `Game` 中所有 `this.cue.show()` 调用增加 `this.cue` 存在性检查，防止球杆对象未初始化或已销毁时崩溃 |
| 5 | **移除已废弃的 directPullAim 引用** | 清理 `Game` 构造函数和 `_enterAimState` 中残留的 `directPullAim` 属性赋值（该功能已从鼠标事件处理中移除） |

---

# 3D Billiards v1.7.13

## What's New in v1.7.13

### 🎱 Shot Charging Fix

| # | 改动 | 详情 |
|---|------|------|
| 1 | **修复蓄力状态卡住** | `InputHandler` 新增 `pointercancel`、`pointerleave` 和 `blur` 监听器，防止鼠标移出窗口或标签页失焦后蓄力状态 stuck 在 `CHARGING`，导致后续无法再次蓄力 |
| 2 | **PointerMove 坐标精度修复** | `handlePointerMove` 不再依赖 `getCoalescedEvents()` 获取坐标，直接使用当前事件 `e.clientX/clientY`，避免合并事件坐标滞后导致 power 计算不准确 |
| 3 | **Canvas 目标检测兼容性** | `tagName` 比较改为大小写不敏感（`toUpperCase()`），兼容部分浏览器或文档模式下 tagName 返回小写的场景 |
| 4 | **蓄力方向 Fallback** | `updateDragPower` 在 ball/anchor 屏幕投影重合时（极端 camera 角度），改用 `lockedAimDirection` 的屏幕投影作为 fallback 方向，避免 `pullLen ≈ 0` 时直接退出导致 power 始终为零 |
| 5 | **CHARGING 软锁自动恢复** | `Game.onMouseDown` 增加防御性检查：若检测到 `state === 'CHARGING'` 但 `input.isDown === false`（mouseup 丢失），自动调用 `_enterAimState()` 恢复，不影响玩家正常操作 |

---

# 3D Billiards v1.7.12

## What's New in v1.7.12

### 🔧 UI/UX & Lifecycle Fixes (Follow-up to v1.7.11)

| # | 改动 | 详情 |
|---|------|------|
| 1 | **挑战模式引用清理** | `_stopChallenge()` 现在会清空 `this.activeChallenge`，防止挑战配置对象在 MenuSystem 生命周期结束后持续残留 |
| 2 | **设置面板分类切换确认框清理** | `_switchCategory()` 现在会在切换分类前主动移除所有未关闭的确认对话框，防止键盘监听器泄漏 |
| 3 | **设置提示定时器清理** | `SettingsScreen.hide()` 现在会正确清理 `_settingsTipTimer`，修复快速开关设置面板时提示 toast 延迟弹出的问题 |

---

# 3D Billiards v1.7.11

## What's New in v1.7.11

### 🔧 Comprehensive UI/UX & Stability Fixes

| # | 改动 | 详情 |
|---|------|------|
| 1 | **SettingsScreen 分类切换空指针保护** | `_switchCategory()` 添加 `this._contentArea` null guard，修复极端情况下（挂载容器缺失）切换设置分类导致的崩溃 |
| 2 | **MenuSystem 生命周期竞态修复** | `_setupMenu()` 添加 `this.state === 'DESTROYED'` 保护，防止音频初始化异步回调在实例已销毁后错误重建菜单 |
| 3 | **AchievementPanel 销毁后崩溃修复** | `showToast()` 添加 `toastContainer` 非空检查，修复成就面板销毁后仍可能触发的 null 引用崩溃 |
| 4 | **返回主菜单时挑战结果面板残留修复** | `_showMainMenu()` 补充 `challengeResult.hide()`，修复从挑战结果返回主菜单时结果面板滞留屏幕的问题 |
| 5 | **滑块标签单位修正（拖尾淡出/复位延迟）** | 「拖尾淡出时间」和「复位延迟」两个滑块的数值标签现在正确显示实际秒数（如 5.0s 而非 50s），避免用户误解 |
| 6 | **引导提示永久丢失修复** | `OnboardingTips.showOnce()` 改为在成功显示后才标记为已展示，若 UI 层缺失导致显示失败，下次仍会重试 |
| 7 | **犯规红闪元素 DOM 残留修复** | `flashRed()` 现在在淡出动画完成后从 DOM 中移除闪红遮罩元素，避免长时间游戏后 DOM 中积累不可见节点 |
| 8 | **暂停菜单按钮事件清理** | `setupPauseControls()` 移除旧按钮前现在先清空其 `onmouseenter/onmouseleave/onclick`，防止 detached DOM 节点持有闭包引用 |
| 9 | **设置提示定时器泄漏修复** | `SettingsScreen.hide()` 现在会清理 `_settingsTipTimer`，修复快速打开/关闭设置面板时提示 toast 在隐藏后仍弹出的问题 |
| 10 | **分类切换时确认对话框清理** | `_switchCategory()` 现在会主动关闭所有打开的确认对话框，防止切换分类时键盘监听器泄漏和界面遮挡 |
| 11 | **重置游戏定时器清理** | `Game.resetGame()` 现在会清理 `_strikeHideTimer` 和 `_cameraResetTimer`，修复重置后旧定时器仍触发导致的球杆意外隐藏/相机自动复位问题 |

---

# 3D Billiards v1.7.10

## What's New in v1.7.10

### 🔧 Critical Bug Fixes

| # | 改动 | 详情 |
|---|------|------|
| 1 | **Minimap 初始化崩溃修复** | `Minimap` 构造函数中 `_profile` 赋值移到 `_resize()` 之前，修复 `Cannot read properties of undefined (reading 'depth')` 导致游戏无法启动的问题 |
| 2 | **环境音效滑块单位修正** | 设置面板中「环境音效」滑块回调传入正确单位（0-100），修复拖动滑块后环境音效几乎无声的问题 |
| 3 | **AudioManager 监听器泄漏修复** | `_removeResilienceListeners()` 补充移除 `pointerdown` 手势监听器，避免应用退出后残留全局事件监听 |

---

# 3D Billiards v1.7.9

## What's New in v1.7.9

### 🔊 Audio System Deep Fixes

| # | 改动 | 详情 |
|---|------|------|
| 1 | **低延迟模式逻辑修正** | AudioManager 中低延迟模式配置完全反转：enabled 时正确选择 interactive（最低延迟），disabled 时选择 playback（标准延迟） |
| 2 | **M 键静音切换** | 键盘快捷键 M 现在真正生效——在游戏中按 M 可即时切换声音开关，并显示状态提示 |
| 3 | **各音效独立音量比例生效** | cueHitVolumeScale、collisionVolumeScale、pocketVolumeScale、foulVolumeScale、hitFeedbackVolumeScale 五个滑块现在真正影响对应音效的响度 |
| 4 | **muteWhenUnfocused 设置生效** | 后台静音开关关闭时，切换浏览器标签页不再强制停止 BGM；开启时行为与此前一致 |
| 5 | **AudioContext closed 状态防护** | 所有音量 setter、BGM 控制和 SFX 播放方法现在都会检查 ctx.state !== closed，避免音频硬件被系统回收后抛出异常 |
| 6 | **环境音量初始化同步** | SettingsScreen 首次挂载时环境音效音量不再停留在默认值，而是正确同步到用户持久化设置 |
| 7 | **击球音效防重复** | playCueHit() 增加 20ms 冷却，防止网络延迟或快速点击导致的重音声 |
| 8 | **iOS 中断恢复 + 手势覆盖扩展** | statechange 监听器新增 interrupted 状态自动恢复；手势监听器补充 pointerdown，覆盖 Surface/手写笔等混合设备 |
| 9 | **移除无效滑块** | 设置面板中「菜单音效」（uiSoundVolumeScale）滑块从未被音频系统读取，现已移除，减少用户困惑 |
| 10 | **Game 音频初始化优化** | 共享 AudioManager 实例不再被 Game.init() 重复调用 init()，仅独立音频上下文时执行 |

---

# 3D Billiards v1.7.8

## What's New in v1.7.8

### 🔧 Network & Input Safety Fixes

| # | 改动 | 详情 |
|---|------|------|
| 1 | **网络客户端 Push-out 保护** | 局域网客户端在推杆后未选择接受/拒绝前，现在会正确阻止发送击球指令，与单机/主机端行为一致 |
| 2 | **键盘输入分层保护** | 游戏暂停或游戏内设置面板打开时，所有游戏快捷键（除 Escape 外）被完全屏蔽，防止热键穿透设置面板触发意外操作 |
| 3 | **设置确认框监听器完整清理** | SettingsScreen.hide() 和 destroy() 现在会正确移除确认对话框的 keydown 监听器，补充 v1.7.7 #2 的完整性 |
| 4 | **网络客户端力度值规范化** | 客户端发送给主机的击球力度现在经过 Math.max(power, minPower) 处理，确保力度值不低于有效下限 |

---

---

# 3D Billiards v1.7.7

## What's New in v1.7.7

### 🔧 UI/UX/SFX/BGM 深度修复

| # | 改动 | 详情 |
|---|------|------|
| 1 | **球号标签显示修复** | 补充 CSS 变量 `--ball-labels-visible` 缺失的样式规则，设置中「显示球号标签」开关现可正常工作 |
| 2 | **设置确认框 Escape 泄漏修复** | `SettingsScreen.destroy()` 现在会正确清理确认对话框的 `keydown` 监听器，避免返回菜单后 Escape 键持续触发已销毁对象的逻辑 |
| 3 | **Toast 元素泄漏修复** | `SettingsScreen.destroy()` 现在会清理所有残留的 toast DOM 元素，防止设置面板关闭后浮动提示短暂残留 |
| 4 | **击球音效默认参数修正** | `AudioManager.playCueHit()` 默认参数从 `0.5` 修正为 `50`，与实际的 0–100 力度范围一致 |
| 5 | **低延迟模式提示优化** | 音频设置中「低延迟模式」增加「刷新页面后生效」提示，避免用户误以为切换后无效果 |
| 6 | **局域网房间面板重复创建修复** | `MenuSystem._showLanRoom()` 现在会先销毁旧的 `LanRoomPanel` 再创建新的，防止重复面板和事件残留 |
| 7 | **Game dispose 代码清理** | 移除 `Game.dispose()` 中对 `achievementPanel` 的重复 `destroy()` 调用 |
| 8 | **重置游戏监听器清理** | `Game._resetGame()` 现在会在清空 listener Map 前正确移除旧球的 `collide` 监听器，防止 physics body 残留引用 |

---

# 3D Billiards v1.7.6

## What's New in v1.7.6

### 🔧 UI/UX/SFX/BGM Bug Fixes & Improvements

| # | 改动 | 详情 |
|---|------|------|
| 1 | **主菜单版本号动态化** | `MainMenuScreen` 使用 `VERSION_TAG` 替代硬编码 `v1.6.1` |
