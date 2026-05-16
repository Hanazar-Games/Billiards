# 3D Billiards v1.5.7 — Latest Update

## What's New in v1.5.7

### ⚙️ 设置系统大规模扩展

| # | 改动 | 详情 |
|---|------|------|
| 1 | **新增 10 个设置分类** | 音频 / 图形 / 外观 / 相机 / 界面 / 控制 / 回放 / 辅助 / 其他 / 关于 |
| 2 | **新增 44+ 个设置参数** | 涵盖音频子音量、渲染质量、视觉风格、相机偏好、HUD 开关、辅助功能、语言单位等 |
| 3 | **设置即时生效** | FOV、相机缩放速度、HUD 缩放、FPS 显示、小地图位置等参数修改后立即生效 |
| 4 | **统一设置弹窗** | 菜单与游戏内复用同一套 SettingsScreen，移除旧版 overlay 避免维护两套 UI |

### 🐛 Bug Fixes

| # | 问题 | 修复 |
|---|------|------|
| 1 | `_row` / `_rowSlider` 不支持 tooltip | 添加 tooltip 参数，低延迟模式、渲染缩放等提示现在正确显示 |
| 2 | AudioManager 缺少 `setAmbientVolume` | 新增方法，环境音效滑块现在真正影响音量 |
| 3 | `ScreenShake` 硬编码 `maxPower = 82` | 改为读取 `SHOT.maxPower`（110），与物理配置同步 |
| 4 | `cameraShake` 开关不生效 | 关闭后击球不再触发屏幕震动 |
| 5 | 小地图位置设置无效 | `minimapPosition` 现在正确控制小地图出现在四个角落 |
| 6 | `cameraFov` 修改无效 | Renderer 和 Game 均实时响应 FOV 变化 |
| 7 | Confirm dialog 层级与泄漏 | backdrop z-index 提升到 110，hide/destroy 时自动清理残留弹窗 |
| 8 | `Renderer` 忽略 `maxPixelRatio` | `applyQualitySettings` 现在尊重用户的像素比上限设置 |

---

## Previous Versions

### v1.5.6 — 9球规则完善（三次犯规判负 + Push-out）

- **三次连续犯规判负**：`threeFoulLoss` 选项开启后，同一玩家连续三次犯规自动判负，第二次犯规时弹出警告
- **Push-out 机制**：合法开球后可声明 Push-out，跳过最低球先碰和碰库检查，对手可选择接受或让回
- **Serializer 补全**：同步 pushOut 状态与连续犯规计数器
- **规则测试扩展**：27 项测试覆盖三次犯规、Push-out、8球规则、状态序列化

### v1.5.5 — 规则返回码与联机同步

- 所有规则引擎返回路径携带 `reasonCode`（`SCRATCH` / `NO_RAIL_AFTER_CONTACT` / `THREE_FOUL_LOSS` 等）
- 修复 9 球开球 4 球碰库判断 bug（`&& !railContactAfterFirstHit` → 仅 `< 4`）
- 联机 `sendTurnResolved` 同步 `reasonCode`
- 新增 `test/rules.test.js` 规则自动化测试

### v1.5.4 — 台球桌袋口与边角建模增强

- **袋口增大**：POCKET.radius 从 `BALL.radius * 1.92`（直径≈11cm）增大到 `BALL.radius * 2.25`（直径≈13.1cm）
- **边角铸铁件缩小**：`createTournamentCastings()` 中黑色方块从 18×2.7×10 缩小为 11×1.4×5.5
- **边角帽缩小**：`createCornerCaps()` 中八棱柱帽半径从 10/8.6 缩小到 6.2/5.2
- **袋口角调整**：`createPocketJaws()` 中 jaw 长度随袋口增大同步外扩

### v1.5.3 — 自由球边框弹开修复

- 自由球放置边界计算加入 cushionWidth，防止球被放到边框内部

### v1.5.2 — 桌腿垂直修复

- 去除桌腿倾斜，四条腿完全垂直于地面

### v1.5.1 — 纯墙壁 + 摄像机防穿模

- 去掉护墙板/腰线/踢脚线，摄像机离墙安全距离增大

### v1.5.0 — 房间场景重构

- 移除沙发、茶几、牌匾，地板上升与台球桌腿底部对齐
