# 3D Billiards v1.5.1 — Latest Update

## What's New in v1.5.1

### 🏠 房间视觉与摄像机优化

| # | 改动 | 详情 |
|---|------|------|
| 1 | **纯米黄色墙壁** | 去掉护墙板、腰线、踢脚线等所有墙面装饰，四面墙统一为纯米黄色 |
| 2 | **摄像机防穿模** | 摄像机离墙安全距离从 25 扩大到 70；orbit target 活动范围从 60% 缩小到 45%，防止视角穿入墙体 |

---

## Previous Versions

### v1.5.0 — 房间场景重构

- 移除沙发、茶几、牌匾及其射灯
- 地板上升至台球桌腿底部（y=-76），墙壁/天花板/花盆同步调整

### v1.4.9 — 全面 Bug 修复

- AI 安全球回归修复、safety 评分修正、贴库评分修正
- AI 除以零防护、disposed 检查、瞄球动画崩溃与 Pause 修复
- 新手引导网络过滤、spin 教程位置修正
- OnboardingStore 类型校验、Settings 定时器泄漏修复
- AudioManager / ScreenShake / ImpactShockwave / PowerLabel / ParticleSystem / Minimap / MatchManager 多处健壮性修复
