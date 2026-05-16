# 3D Billiards v1.5.3 — Latest Update

## What's New in v1.5.3

### 🎱 自由球边框弹开修复

- 自由球放置的边界计算错误：原代码只减了 `BALL.radius * 1.1`（≈3.1cm），没有扣除边框（cushion）厚度 4cm，导致球被放到了边框内部一碰就弹开
- 修正为：`台面半宽 - cushionWidth - 球半径`，确保球完全在可玩区域内，不触碰边框
- 影响范围：`isCueBallPlacementLegal()`、`updateBallInHandPreview()`、`resetCueBallIfPocketed()` 三处全部修复

---

## Previous Versions

### v1.5.2 — 桌腿垂直修复

- 去除桌腿 0.08 弧度的倾斜，四条腿完全垂直于地面

### v1.5.1 — 纯墙壁 + 摄像机防穿模

- 去掉护墙板、腰线、踢脚线，四面墙统一纯米黄色
- 摄像机离墙安全距离 25 -> 70，orbit target 范围缩小

### v1.5.0 — 房间场景重构

- 移除沙发、茶几、牌匾，地板上升至台球桌腿底部
