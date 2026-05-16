# 3D Billiards v1.4.9 — Latest Update

## What's New in v1.4.9

### 🔧 Critical Bug Fixes & Stability

| # | 修复项 | 详情 |
|---|--------|------|
| 1 | **AI 安全球回归修复** | v1.4.8 的 `_v3` 修复引入了新 bug：`ghostPos` 被 `_v2` 覆盖污染。已改为先 `clone()` 保存正确位置 |
| 2 | **AI safety 评分** | `_scoreSafety()` 中 `isPathBlocked` 未排除目标球自身，导致每颗球都被误判为"被阻挡"，评分虚高。已排除自身 |
| 3 | **AI 贴库评分** | `halfW`/`halfD` 未扣除 cushion 厚度，贴库位置评分偏低。已修正 |
| 4 | **AI 除以零** | `findDesperateShot()` 在 cue ball 与目标球位置重合时 `dist=0` 产生 NaN。已加防护 |
| 5 | **AI disposed 检查** | `takeTurn()` 思考延迟期间 game 被 dispose 后不做检查，返回无效决策。已加短路 |
| 6 | **AI 瞄球动画崩溃** | `startAITurn()` 在瞄球期间 game 被 dispose 会空指针崩溃。已加 `!this.cue/!this.ballsManager` 守卫 |
| 7 | **AI 瞄球 Pause** | 瞄球动画未响应 pause，按暂停后球杆继续旋转。已增加 pause 检查 |
| 8 | **新手引导网络过滤** | `_showGameTutorial()` 在网络模式下不区分本地玩家身份，玩家 2 设备也会弹出 aim 教程。已过滤 |
| 9 | **spin 教程位置** | spin 教程放在 `shoot()` 内，被网络 host 远程执行时错误触发。已移至 `onMouseUp()` |
| 10 | **OnboardingStore 校验** | `_load()` 对损坏的 localStorage 数据缺少类型校验，原始值/数组会静默重置进度。已加校验 |
| 11 | **Settings 定时器泄漏** | `show()` 的 settings 提示 `setTimeout` 未被跟踪；`_toast()` 的 `removeTimer` 永不从数组移除。已修复 |
| 12 | **AudioManager 崩溃** | `startBGM()` 未检查 `AudioContext.state === 'closed'`；`setVolume` 未防御 NaN；`_autoDisconnect` timeout 泄漏。已修复 |
| 13 | **ScreenShake 崩溃** | 缺少 `dispose()`，game dispose 后仍被调用会崩溃。已添加 |
| 14 | **ImpactShockwave 校验** | `spawn()` 未校验 `position` 参数；`update()` 未防御负 `dt`。已修复 |
| 15 | **PowerLabel 崩溃** | `_ensureElement()` 在 `document.body` 不存在时崩溃。已加防护 |
| 16 | **ParticleSystem 崩溃** | `_getIntensityMult()` 未防御 `Infinity`，会导致 `Float32Array(Infinity)` 崩溃。已修复 |
| 17 | **Minimap 不更新** | `_resize()`/`setEnabled()` 未标记 `_dirty`；`draw()` 过早清除标志导致异常后永久停滞。已修复 |
| 18 | **Minimap null 防护** | `updateBallData()` 缺少 `balls` null 校验。已添加 |
| 19 | **MatchManager 缓存** | `updateHUD()` hash 中 `undefined` 与字符串 `'undefined'` 冲突导致缓存失效。已修复 |
| 20 | **UI 事件泄漏** | `destroy()` 未清理 `_hudSettingsBtn`/`_hudConcedeBtn` onclick。已修复 |
| 21 | **ShotTrail 健壮性** | `recordPoint()` 未校验 `ball.mesh` 存在性和 `getSpeed` 类型。已修复 |

---

## Previous Versions

### v1.4.8 — AI 安全球向量修复

- 修复 `ShotPlanner.findSafetyShot()` 中临时向量 `_v3` 被重复覆盖导致安全球位置估计错误的 bug
- 修复 spin 教程在 AI 回合触发的问题
- 优化犯规提示文案、OnboardingStore 写优化、引导卡片 DOM 健壮性

### v1.4.7 — 轻量新手引导

- `OnboardingStore` + `OnboardingTips`：3 步非阻塞教程（瞄准 → 蓄力 → 旋转）
- 上下文提示：首次犯规、自由球、设置面板
- 设置中新增「重置新手引导」按钮

### v1.4.6 — 性能与稳定性

- DOM 脏标记优化（计时器、小地图、HUD）减少无效重绘
- 特效开关守卫（粒子/冲击波）提升低端设备性能
- 完整 dispose 链路修复，Puppeteer 内存测试通过

### v1.4.5 — AI 增强

- `ShotPlanner` 智能安全球评分 `_scoreSafety`
- `AIPlayer` 难度分级旋转控制与击球选择策略
- AI 瞄球动画 + 蓄力动画

### v1.4.4 — 精彩回放系统增强

- 回放卡片增强（模式标签、命名、统计）
- 播放控制（倍速、进度拖拽、暂停）
- 导出/导入 JSON
