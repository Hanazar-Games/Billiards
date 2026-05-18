# 3D Billiards v1.7.14 — Latest Update

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
