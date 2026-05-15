# 3D Billiards v1.4.1 — Latest Update

## What's New in v1.4.1

### 🎨 HUD & 菜单体验优化

| # | 优化项 | 详情 |
|---|--------|------|
| 1 | **版本号统一** | 新增 `src/core/Version.js` 作为唯一版本来源，所有菜单、设置、页面角标自动同步，避免多处版本不一致 |
| 2 | **底部 HUD 布局优化** | 玩家名、球组、剩余球、比分、计时器排版更清晰；添加 `white-space: nowrap` 防止文字换行错位 |
| 3 | **小屏幕适配** | 新增 `@media (max-width: 760px)` 和 `@media (max-width: 520px)` 响应式规则：击球点、力度条、小地图自动缩小/上移，避免互相遮挡 |
| 4 | **中文文案统一** | 所有游戏内提示（8球/9球规则消息、加载文本、错误提示）统一为纯中文，消除中英文混杂 |
| 5 | **错误弹窗优化** | 错误提示更友好，显示「资源加载异常，请尝试刷新页面或检查网络连接」，并提供「重新加载」按钮 |

---

## Previous Versions

### v1.4.0 — 回合计时器 (Turn Timer)

- 新增 per-turn 倒计时（不限时 / 30秒 / 60秒）
- 仅标准对战模式生效，freeplay/挑战/回放自动禁用
- 计时器 ≤5s 橙色警告、≤3s 红色脉冲
- 暂停菜单/设置/回放时自动冻结倒计时
- 超时 = 犯规 + 对手自由球

### v1.3.9 — 本地比赛模式 (Local Match Mode)

A tournament-style local 2-player mode with customizable names, 8-ball/9-ball selection, best-of-N match formats, live score HUD, and match end flow.

### v1.3.8 — Deep Bug Audit

12 stability fixes including LAN anonymous listener leak elimination, WebSocket disconnect auto-return, host concede block, server payload guards, BGM lifecycle preservation, and various cleanup leak fixes.
