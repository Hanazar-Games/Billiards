# 3D Billiards v1.4.2 — Latest Update

## What's New in v1.4.2

### ⚙️ 设置系统增强

| # | 功能 | 详情 |
|---|------|------|
| 1 | **恢复默认设置确认弹窗** | 替换浏览器原生 `confirm()` 为自定义样式弹窗，与游戏 UI 风格统一 |
| 2 | **导入/导出配置 JSON** | 支持「复制到剪贴板」「下载文件」两种导出方式；支持「粘贴 JSON」或「选择文件」导入；自动过滤无效键名 |
| 3 | **即时生效 + 保存提示** | 设置变更后 400ms 防抖显示「设置已保存」toast，无需手动确认 |
| 4 | **性能模式** | 图形页新增「性能模式 / 均衡模式 / 画质优先」一键预设；性能模式自动降低画质、关闭粒子/拖尾/阴影；新增「阴影效果」独立开关 |
| 5 | **新手模式** | 游戏页新增「新手模式 / 高手模式」一键预设；新手模式自动开启轨迹线、小地图、自动追踪白球、跟随视角 |

### 技术改动

- `src/core/SettingsStore.js`：新增 `shadowsEnabled` 默认 `true`
- `src/core/Renderer.js`：新增 `applyQualitySettings()` 方法，根据 `quality` 和 `shadowsEnabled` 实时调整像素比率和阴影贴图分辨率
- `src/menu/SettingsScreen.js`：新增自定义确认弹窗 `_showConfirmDialog`、预设按钮 `_presetButton`、配置导入导出 UI、防抖保存 toast
- `src/game/Game.js`：`shadowsEnabled` 变更监听（实际由 Renderer 全局处理）

---

## Previous Versions

### v1.4.1 — HUD & 菜单体验优化

- 版本号统一来源 (`src/core/Version.js`)
- 底部 HUD 布局优化，小屏幕响应式适配
- 所有游戏内提示统一中文文案
- 错误弹窗更友好

### v1.4.0 — 回合计时器 (Turn Timer)

- 新增 per-turn 倒计时（不限时 / 30秒 / 60秒）
- 仅标准对战模式生效
- 计时器 ≤5s 橙色警告、≤3s 红色脉冲
- 超时 = 犯规 + 对手自由球
