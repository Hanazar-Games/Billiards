# 3D Billiards v1.5.8 — Latest Update

## What's New in v1.5.8

### 🔧 设置参数全面落地

| # | 改动 | 详情 |
|---|------|------|
| 1 | **相机参数全部生效** | `cameraDamping`（阻尼系数）、`cameraSmoothing`/`cameraSmoothFactor`（跟随平滑度）、`cameraAutoResetAfterShot`/`cameraResetDelay`（自动复位）、`topDownAngle`（垂直俯视）、`hideCueOnShot`（击球时隐藏球杆）、`cameraCollisionAvoidance`（相机边界限制） |
| 2 | **渲染参数实时响应** | `renderScale`（分辨率缩放）、`lightingIntensity`（主灯光强度）、`ambientIntensity`（环境光强度）、`toneMappingExposure`（色调映射曝光）、`fogEnabled`（雾效开关） |
| 3 | **HUD 与辅助功能生效** | `hudOpacity`（HUD 透明度）、`highContrastUI`（高对比度）、`largeTextMode`（大字体）、`reducedMotion`（减弱动态效果）、`vibrationEnabled`（击球震动反馈） |
| 4 | **帧率限制** | `fpsLimit`（30/60/120/144 FPS）在 GameLoop 中实现硬限制，`vSync` 占位（浏览器限制无法直接关闭） |
| 5 | **射击确认模式** | `confirmShotOnRelease` 关闭后，释放鼠标不再自动击球，按 Enter 键确认 |
| 6 | **音频低延迟** | `lowLatencyMode` 在 AudioManager init 时设置 AudioContext latencyHint |
| 7 | **公平性边界修正** | 从 `MATCH_FAIRNESS_KEYS` 中移除没有实际消费者的 `aimSens` |

---

## Previous Versions

### v1.5.7 — 设置系统大规模扩展 + UI Bug 修复

- **10 个设置分类**：音频 / 图形 / 外观 / 相机 / 界面 / 控制 / 回放 / 辅助 / 其他 / 关于
- **44+ 新增参数**：音频子音量、渲染质量、视觉风格、相机偏好、HUD 开关、辅助功能、语言单位等
- **Bug 修复**：tooltip 支持、AudioManager `setAmbientVolume`、ScreenShake 硬编码 `maxPower`、cameraShake 开关无效、minimapPosition 响应、confirm dialog z-index 与泄漏

### v1.5.6 — 9球规则完善（三次犯规判负 + Push-out）

- **三次连续犯规判负**：`threeFoulLoss` 选项开启后，同一玩家连续三次犯规自动判负
- **Push-out 机制**：合法开球后可声明 Push-out，对手可选择接受或让回
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
