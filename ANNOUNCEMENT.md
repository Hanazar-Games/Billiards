# 3D Billiards v1.7.8 — Latest Update

## What's New in v1.7.8

### 🔧 Network & Input Safety Fixes

| # | 改动 | 详情 |
|---|------|------|
| 1 | **网络客户端 Push-out 保护** | 局域网客户端在推杆后未选择接受/拒绝前，现在会正确阻止发送击球指令，与单机/主机端行为一致 |
| 2 | **键盘输入分层保护** | 游戏暂停或游戏内设置面板打开时，所有游戏快捷键（除 Escape 外）被完全屏蔽，防止热键穿透设置面板触发意外操作 |
| 3 | **设置确认框监听器完整清理** | `SettingsScreen.hide()` 和 `destroy()` 现在会正确移除确认对话框的 `keydown` 监听器，补充 v1.7.7 #2 的完整性 |
| 4 | **网络客户端力度值规范化** | 客户端发送给主机的击球力度现在经过 `Math.max(power, minPower)` 处理，确保力度值不低于有效下限 |

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
| 2 | **BGM 自动恢复** | `_initAudio()` 从 `settings` 同步 `soundEnabled`，解决声音设置开启但 BGM 不自动播放的问题 |
| 3 | **面板切换一致性** | 6 个 `_show*` 方法补充隐藏 `lanRoomPanel` / `matchSetupPanel`，防止面板堆叠 |
| 4 | **设置确认框 Escape** | `_showConfirmDialog` 支持 Escape 键关闭，并阻止事件冒泡避免误触游戏内 Escape 处理 |
| 5 | **About 链接事件清理** | 使用 `addEventListener` / `removeEventListener` 管理链接 hover，避免 destroy 时内存泄漏 |
| 6 | **Game dispose 完整性** | 补充清理 `_netDisconnectTimer`，防止网络断开后返回菜单的定时器残留 |
| 7 | **游戏结束状态保护** | `_onInGameSettingsClose` 增加 `state !== 'GAME_OVER'` 检查，避免游戏结束时关闭设置意外恢复暂停菜单 |
| 8 | **训练模式重置完整性** | `_resetTrainerDrill` 补充 `recorder.reset()` 和 `gameStartTime` 重置 |
| 9 | **9-ball HUD 优化** | `setPlayerStats` 在 9-ball 模式下隐藏分组标签（改为仅显示剩余球数），默认剩余球数改为 9 |

---

# 3D Billiards v1.7.3 — Latest Update

## What's New in v1.7.3

### 🎱 Pocket System Overhaul — 袋口系统重构

| # | 改动 | 详情 |
|---|------|------|
| 1 | **不同位置袋口大小** | 支持 `cornerPocketRadius` 和 `sidePocketRadius`，角落袋和中袋可独立配置 |
| 2 | **pool9ft/pool8ft** | corner = BALL.r×2.25, side = BALL.r×2.1（标准美式，中袋稍小） |
| 3 | **bar7ft** | corner = BALL.r×2.35, side = BALL.r×2.2（酒吧台更宽松） |
| 4 | **chinese8** | corner = BALL.r×1.95, side = BALL.r×1.75（中式八球，中袋明显更小） |
| 5 | **snooker12ft** | corner = BALL.r×1.7, side = BALL.r×1.5（斯诺克风格） |
| 6 | **视觉-检测一致** | `checkPockets` 和 `_isNearPocketMouth` 统一使用 `pocket.radius + pocketDetectMargin`，消除 0.95 不一致因子 |
| 7 | **检测使用 body.position** | `checkPockets` 从 `ball.mesh.position` 改为 `ball.body.position`，更准确 |
| 8 | **config.js 清理** | 移除未被引用的 `POCKET` 死代码常量 |
| 9 | **公平性注释** | TableProfiles 注释明确列出 `cornerPocketRadius` / `sidePocketRadius` 为网络同步参数 |

---

# 3D Billiards v1.7.2 — Latest Update

## What's New in v1.7.2

### 🎵 UI/UX/SFX/BGM 全面优化

| # | 改动 | 详情 |
|---|------|------|
| 1 | **菜单初始 BGM** | 首次进入菜单时若声音已开启，自动启动环境背景音乐（此前仅在从游戏返回菜单时才启动） |
| 2 | **BGM 状态追踪修复** | `AudioManager.startBGM()` 成功后设置 `_bgmWasPlaying = true`，确保标签页切换、声音开关等场景下 BGM 恢复行为一致 |
| 3 | **训练完成音效** | 练习成功时播放胜利音效 `playWin()`，提供正向反馈（此前完全静默） |
| 4 | **结果面板 Enter 键** | 训练结果面板支持按 Enter 快速"再试一次"，提升键盘操作体验 |
| 5 | **认输模式保护** | `_concede()` 增加 trainer 模式保护，防止快捷键等非常规途径触发认输 |
| 6 | **死代码清理** | 移除 `resolveTurn()` 中永远不会执行的 trainer 分支（trainer 已在更早处 return） |
| 7 | **事件处理器清理** | `TrainerHUD.setOnReset()` 先清空旧 `onclick` 再绑定新回调，防止重复注册 |
| 8 | **DrillManager 死代码** | `getHUDData()` 移除未使用的 `idealCueZone` 解构 |
| 9 | **应用退出清理** | `MenuSystem._quit()` 补充 `trainerPanel` 和 `trainerResult` 的 `destroy()` 调用，防止 DOM/事件泄漏 |
| 10 | **防御性 dispose** | `_startTrainer()` 启动前检查并 dispose 旧 game 实例，与 `_startGame()` 行为一致 |

---

# 3D Billiards v1.7.1

## What's New in v1.7.1

### 🔧 Shot Trainer Bug 修复

| # | 改动 | 详情 |
|---|------|------|
| 1 | **DrillManager 坐标修复** | `idealCueZone` 原为相对坐标（-1~1），与绝对坐标的 `cueBallRestPos` 混合计算导致走位偏差完全错误。现由 Game.js 通过 `resolveDrillPositions` 解析为绝对坐标后传入 DrillManager |
| 2 | **DrillManager 解锁逻辑修复** | `isUnlocked()` 引用了 `DRILLS` 但未导入，导致解锁判断抛出 ReferenceError。已补充导入 |
| 3 | **Game.js dispose 结构修复** | `trainerHUD.dispose()` 被错误嵌套在 `if (this.trajectory)` 代码块内，若 trajectory 不存在则 trainerHUD 泄漏。已分离为独立 if 块 |
| 4 | **Game.js rules null 防护** | trainer mode 下 `this.rules` 为 null，`shoot()` 中的 `this.rules.breakShot` / `this.rules.startShot()` 以及碰撞监听中的 `this.rules.recordFirstHit()` 会抛出错误。已全部添加可选链或前置判断 |
| 5 | **resetGame 消息处理** | 训练模式下点击"重置球型"后，UI 消息错误显示为 8-ball 对战文本，现正确显示训练模式提示 |
| 6 | **_getObjectiveText 训练模式** | 未处理 trainer mode，返回默认 8-ball 文本。现返回"击球训练" |
| 7 | **TrainerHUD y 坐标修正** | 提示线绘制高度使用 0.5（台面下方），现修正为 `BALL.radius`（球心高度） |
| 8 | **TrainerPanel 死代码清理** | 移除未使用的 `animMs` 导入 |
| 9 | **DrillData 死代码清理** | 移除未使用的 `categoryFor` 函数 |

---

# 3D Billiards v1.7.0

## What's New in v1.7.0

### 🎯 Shot Trainer — 击球训练模式

全新的训练系统，帮助玩家从直线球到走位控制逐步提升击球技巧。

**11 种预设练习球型：**

| 练习 | 类型 | 难度 | 说明 |
|------|------|------|------|
| 直线球 | 基础 | ⭐ | 母球、目标球、袋口三点一线 |
| 简单角度球 | 基础 | ⭐⭐ | 调整角度击打偏离直线的目标球 |
| 轻推练习 | 基础 | ⭐⭐ | 极小力度控球，训练力度精度 |
| 大角度球 | 进阶 | ⭐⭐⭐ | 大夹角下的精确切入 |
| 长台球 | 进阶 | ⭐⭐⭐ | 远距离击球，对瞄准要求极高 |
| 贴库球 | 进阶 | ⭐⭐⭐⭐ | 目标球紧贴库边，需薄切入袋 |
| 走位入门 | 进阶 | ⭐⭐⭐ | 进球同时将母球控制在目标区域内 |
| 极限薄球 | 高级 | ⭐⭐⭐⭐⭐ | 母球与目标球几乎平行的极限薄切 |
| 组合球 | 高级 | ⭐⭐⭐⭐ | 借助中间球将目标球撞入袋口 |
| 库边反弹 | 高级 | ⭐⭐⭐⭐⭐ | 碰库边反弹后目标球入袋 |
| 精准走位 | 高级 | ⭐⭐⭐⭐⭐ | 母球停球区域极小，走位精度要求高 |

**核心特性：**

| # | 功能 | 详情 |
|---|------|------|
| 1 | **AI 教练提示** | 点击"💡 提示"按钮显示建议瞄准线（绿色虚线）、ghost ball 位置（黄色光环）、建议力度弧 |
| 2 | **走位可视化** | 走位练习中，目标区域以半透明绿色圆环显示在台面上 |
| 3 | **星级评分** | 非走位练习：进球即 3 星；走位练习：按母球落点与目标区域距离评 1-3 星 |
| 4 | **渐进解锁** | 完成 2 个基础练习解锁进阶，完成 2 个进阶练习解锁高级 |
| 5 | **自动重试** | 未进球时球型自动保留（仅重置白球），玩家可立即再试 |
| 6 | **一键重置** | 点击"↺ 重置球型"可完全重置当前练习到初始布局 |
| 7 | **成绩持久化** | 最佳星级和累计尝试次数保存到 localStorage |
| 8 | **自适应桌型** | 练习球型使用相对坐标，自动适配当前桌型尺寸 |

---

# 3D Billiards v1.6.1 — Latest Update

## What's New in v1.6.1

### 🔧 Table Profile System 后续修复

| # | 改动 | 详情 |
|---|------|------|
| 1 | **AI 桌型参数传递** | `ShotPlanner.evaluateShot` 新增 `tableProfile` 参数，修复 AI 计算 ghost ball 边界时 `ReferenceError`；所有调用点（含 8-ball 清台路径）已更新 |
| 2 | **AI 选杆权重计算** | `AIPlayer._selectShot` 接收 `tableProfile` 并传入 `_evaluatePositionPlay`，修复 Hard 难度下 position play 评分使用的未定义变量 |
| 3 | **设置导入二次校验** | `resolveTableProfileId` 在读取 settings 默认值后增加 `validateModeTableProfile` 校验，防止通过配置导入非法组合（如 9-ball + chinese8） |
| 4 | **库边材质共享** | `Table.js` 的 `addCushion` 改为 6 条库边共享同一材质；修复切换台呢主题时只有第一条库边变色的 bug |
| 5 | **灯具漫射材质共享** | `Room.js` 的吊灯 shade 不再 `clone()` glowMat；修复切换灯具风格时 3 个 shade 颜色不更新的 bug |
| 6 | **UI 死代码清理** | 移除 `MatchSetupPanel` 中无意义的 `originalModeClick` 变量；移除 `Game.js` constructor 中重复的 `this.powerLabel = null` |

### 🧪 测试扩展

- `test/table-profiles.test.js` 从 25 项扩展至 **34 项**，新增：
  - pool8ft / bar7ft / chinese8 尺寸验证
  - 全部桌型 `pocketDetectMargin` 一致性检查
  - 设置值非法时的 fallback 路径
  - 扩展模式过滤（vsai / challenge / lan 9-ball）
- `npm test` 现在同时运行 rules（28 项）+ table-profiles（34 项），共 **62 项**

---

# 3D Billiards v1.6.0

## What's New in v1.6.0

### 🎱 Table Profile System (球桌类型系统)

| # | 功能 | 详情 |
|---|------|------|
| 1 | **6 种桌型定义** | pool9ft（默认）、pool8ft、bar7ft、chinese8、snooker12ft（预留）、carom10ft（预留） |
| 2 | **尺寸参数化** | 全部球桌几何（台面、库边、袋口、球房地板/灯具/地毯）使用 profile 尺寸，不再硬编码全局 TABLE |
| 3 | **模式-桌型兼容性** | 8-Ball 支持 pool9ft/8ft/bar7ft/chinese8；9-Ball 支持 pool9ft/8ft/bar7ft（不含 chinese8）；LAN 由房主锁定桌型 |
| 4 | **UI 桌型选择** | MatchSetupPanel 与 LanRoomPanel 增加桌型下拉选择；切换 8/9 球时自动过滤不兼容桌型 |
| 5 | **设置默认桌型** | SettingsScreen 增加"默认球桌 (8球 / 9球 / 练习)"三项独立设置 |
| 6 | **回放携带桌型** | ShotRecorder 元数据记录 `tableProfileId`，回放时重建与录制时一致的球桌尺寸 |
| 7 | **LAN 同步** | startGame 消息携带 `tableProfileId`，server 广播保留并转发；client 以 host 为准初始化 |
| 8 | **校验层** | 新增 `validateModeTableProfile(mode, tableProfileId)`，非法组合（如 9ball + chinese8）自动 fallback 到 pool9ft |

### 🔧 深度 Bug 修复

| # | 改动 | 详情 |
|---|------|------|
| 1 | **袋口视觉与判定一致** | 将所有桌型的 `pocketDetectMargin` 统一为 `BALL.radius`，消除"球看起来没进却被判进"或相反的情况 |
| 2 | **Room.js 遗漏硬编码** | 修复地板、灯具、植物、地毯的 Y 坐标和尺寸仍使用全局 TABLE 的问题 |
| 3 | **Cue.js 未注入桌型** | Game.js 创建 Cue 后补充 `setTableProfile`，球杆防穿帮边界随桌型变化 |
| 4 | **BallReturnSystem 硬编码位置** | tray 回收槽 Z 坐标从固定 `-155` 改为 `-(profile.depth / 2 + 28)`，适配不同桌长 |
| 5 | **LAN callback 签名缺失** | MenuSystem `_showLanRoom` 的 callback 未接收 `tableProfileId`，导致 host 选择的桌型在联机中不生效 |
| 6 | **Table.js 未导入 TABLE** | `TABLE.feltColor` / `TABLE.cushionColor` 使用但无 import，补充 `import { TABLE, BALL }` |
| 7 | **bar7ft/pool8ft enabledFor 补全** | 补充 'match' / 'lan' / '9ball'，使比赛模式与联机模式能正确选择这些桌型 |
| 8 | **freeplay 设置回退顺序** | `resolveTableProfileId` 中 freeplay 默认设置被 8ball 默认设置遮挡，调整判断顺序 |

### 🧪 测试扩展

- 新增 `test/table-profiles.test.js`（25 项），覆盖 profile 存在性、尺寸、validateModeTableProfile、getEnabledProfilesForMode、resolveTableProfileId
- `npm test` 现在同时运行 rules（28 项）+ table-profiles（25 项），共 53 项

---

## Previous Versions

### v1.5.9 — 深度 Bug 修复与规则校正

- **9球 Push-out 9号球规则校正**：Push-out 杆打进 9 号球不再直接获胜，9 号球被复位，对手正常选择接受/让回（符合 WPA 规则）
- **回合计时器初始化修复**：`turnTimer` 设置在开始新游戏时未生效，现在 `_applySettings()` 中正确初始化
- **三次犯规 UI 清理**：游戏结束/认输/重新开始时自动隐藏三次犯规警告条与 Push-out UI，防止残留
- **字符串全面集中化**：Game.js、NineBallRules.js、UI.js 中所有玩家可见中文文本统一收归 `UIText.js`，消除硬编码散落
- **FX 系统健壮性**：PowerLabel 动画帧回调增加 null 防护；ImpactShockwave / BallReturnSystem 增加 dt 上限钳制，防止切标签后帧爆
- **AudioManager 初始化补全**：`_ambientVolume` 在构造函数中补初始值，避免首次调用时出现 undefined
- **网络死代码清理**：移除 `sendTurnResolved` 无监听调用，减少冗余网络流量
- **网络断开定时器泄漏修复**：`Game.dispose()` 中补充 `clearTimeout(this._netDisconnectTimer)`
- **测试扩展**：新增 `9-ball pocketed on push-out is spotted, not a win` 测试用例，总测试数 28 项

### v1.5.8 — 程序化建模主题系统 + Push-out / 三次犯规 UI 完整落地

- **程序化建模主题系统**：球桌（台呢/木材/金属/皮革）、房间（地板/墙壁/灯具/环境光）、球体风格（标准/光泽/磨砂/霓虹/复古）实时切换；legacy 设置自动映射到新系统
- **Push-out UI 完整落地**：合法开球后显示 Push-out 按钮；对手看到接受/让回选择；AI 自动接受；联机同步
- **三次犯规 UI**：第二次连续犯规显示红色脉冲警告条；第三次判负走标准 Game Over 流程
- **设置参数全面落地**：相机阻尼/平滑/复位、渲染缩放/灯光/雾效、HUD 透明度/高对比度/大字体、射击确认模式、音频低延迟等全部生效
- **旧设置面板清理**：移除游戏中内嵌的旧设置浮层，统一使用 SettingsScreen 全屏设置

### v1.5.7 — 设置系统大规模扩展 + UI Bug 修复

- **10 个设置分类**：音频 / 图形 / 外观 / 相机 / 界面 / 控制 / 回放 / 辅助 / 其他 / 关于
- **44+ 新增参数**：音频子音量、渲染质量、视觉风格、相机偏好、HUD 开关、辅助功能、语言单位等
- **Bug 修复**：tooltip 支持、AudioManager `setAmbientVolume`、ScreenShake 硬编码 `maxPower`、cameraShake 开关无效、minimapPosition 响应、confirm dialog z-index 与泄漏

### v1.5.6 — 9球规则完善（三次犯规判负 + Push-out 规则层）

- **三次连续犯规判负**：`threeFoulLoss` 选项开启后，同一玩家连续三次犯规自动判负
- **Push-out 规则层**：合法开球后可声明 Push-out，对手可选择接受或让回（规则引擎已实现，UI 在 v1.5.8 完整接入）
- **规则测试扩展**：27 项测试覆盖三次犯规、Push-out、8球规则、状态序列化

### v1.5.5 — 规则返回码与联机同步

- 所有规则引擎返回路径携带 `reasonCode`
- 修复 9 球开球 4 球碰库判断 bug
- 联机 `sendTurnResolved` 同步 `reasonCode`
- 新增 `test/rules.test.js` 规则自动化测试

### v1.5.4 — 台球桌袋口与边角建模增强

- **袋口增大**：POCKET.radius 从 `BALL.radius * 1.92` 增大到 `BALL.radius * 2.25`
- **边角铸铁件缩小**：`createTournamentCastings()` 中黑色方块缩小
- **边角帽缩小**：`createCornerCaps()` 中八棱柱帽半径缩小

### v1.5.3 — 自由球边框弹开修复

- 自由球放置边界计算加入 cushionWidth

### v1.5.2 — 桌腿垂直修复

- 去除桌腿倾斜

### v1.5.1 — 纯墙壁 + 摄像机防穿模

- 去掉护墙板/腰线/踢脚线

### v1.5.0 — 房间场景重构

- 移除沙发、茶几、牌匾，地板上升与台球桌腿底部对齐
