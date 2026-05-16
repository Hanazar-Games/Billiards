# 3D Billiards v1.5.0 — Latest Update

## What's New in v1.5.0

### 🏠 房间场景重构

| # | 改动 | 详情 |
|---|------|------|
| 1 | **去掉沙发与茶几** | 移除后墙的两张沙发和中间的茶几，空间更开阔 |
| 2 | **去掉牌匾** | 移除后墙"厚德载物"牌匾及其专属射灯 |
| 3 | **统一房间高度** | 地板从 y=-75 上升至 y=-76，与台球桌腿底部对齐；墙壁、天花板、踢脚线、腰线随地板同步调整，整个房间处于同一高度基准 |
| 4 | **花盆落地** | 四个角的花盆从悬空（y=0）落回地板（y=-76），与台球桌处于统一空间高度 |

---

## Previous Versions

### v1.4.9 — 全面 Bug 修复

- AI 安全球回归修复、safety 评分修正、贴库评分修正
- AI 除以零防护、disposed 检查、瞄球动画崩溃与 Pause 修复
- 新手引导网络过滤、spin 教程位置修正
- OnboardingStore 类型校验、Settings 定时器泄漏修复
- AudioManager closed/NaN/timer 防护、ScreenShake dispose
- ImpactShockwave / PowerLabel / ParticleSystem / ShotTrail / Minimap / MatchManager 多处健壮性修复

### v1.4.8 — AI 安全球向量修复

- 修复 `ShotPlanner.findSafetyShot()` 临时向量重用 bug
- 修复 spin 教程在 AI 回合触发、优化犯规提示文案

### v1.4.7 — 轻量新手引导

- `OnboardingStore` + `OnboardingTips`：3 步非阻塞教程
- 上下文提示：首次犯规、自由球、设置面板

### v1.4.6 — 性能与稳定性

- DOM 脏标记优化、特效开关守卫、完整 dispose 链路

### v1.4.5 — AI 增强

- `ShotPlanner` 智能安全球评分、AI 难度分级旋转控制
- AI 瞄球动画 + 蓄力动画
