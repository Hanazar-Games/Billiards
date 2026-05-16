# 3D Billiards v1.4.8 — Latest Update

## What's New in v1.4.8

### 🔧 Bug Fixes & Polish

| # | 修复项 | 详情 |
|---|--------|------|
| 1 | **AI 安全球计算** | 修复 `ShotPlanner.findSafetyShot()` 中临时向量 `_v3` 被重复覆盖导致安全球位置估计完全错误的严重 bug |
| 2 | **新手引导触发时机** | 旋转教程（spin tip）不再在 AI 回合触发，确保只在玩家自己击球时显示 |
| 3 | **犯规提示文案** | 优化犯规提示的显示文案，避免 "犯规原因：犯规！" 的重复修辞 |
| 4 | **OnboardingStore 写优化** | `set()` 增加变化检测，值不变时不重复写入 localStorage |
| 5 | **引导卡片 DOM 健壮性** | `_ensureCard()` 增加 `parentNode` 检查，防止外部移除 DOM 后无法重建 |

---

## Previous Versions

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
