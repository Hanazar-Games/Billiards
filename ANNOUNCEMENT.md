# 3D Billiards v1.5.9 — Latest Update

## What's New in v1.5.9

### 🐛 深度 Bug 修复与规则校正

| # | 改动 | 详情 |
|---|------|------|
| 1 | **9球 Push-out 9号球规则校正** | Push-out 杆打进 9 号球不再直接获胜，9 号球被复位，对手正常选择接受/让回（符合 WPA 规则） |
| 2 | **回合计时器初始化修复** | `turnTimer` 设置在开始新游戏时未生效，现在 `_applySettings()` 中正确初始化 |
| 3 | **三次犯规 UI 清理** | 游戏结束/认输/重新开始时自动隐藏三次犯规警告条与 Push-out UI，防止残留 |
| 4 | **字符串全面集中化** | Game.js、NineBallRules.js、UI.js 中所有玩家可见中文文本统一收归 `UIText.js`，消除硬编码散落 |
| 5 | **FX 系统健壮性** | PowerLabel 动画帧回调增加 null 防护；ImpactShockwave / BallReturnSystem 增加 dt 上限钳制，防止切标签后帧爆 |
| 6 | **AudioManager 初始化补全** | `_ambientVolume` 在构造函数中补初始值，避免首次调用时出现 undefined |
| 7 | **网络死代码清理** | 移除 `sendTurnResolved` 无监听调用，减少冗余网络流量 |
| 8 | **网络断开定时器泄漏修复** | `Game.dispose()` 中补充 `clearTimeout(this._netDisconnectTimer)` |
| 9 | **测试扩展** | 新增 `9-ball pocketed on push-out is spotted, not a win` 测试用例，总测试数 28 项 |

---

## Previous Versions

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
