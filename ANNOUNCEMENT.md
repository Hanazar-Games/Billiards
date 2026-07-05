# 3D Billiards v1.26.9 — Latest Update

## What's New in v1.26.9

### 击球分析动画残留清理

本版本继续收紧“击球分析整个模块不要”的范围，专门处理容易被理解成分析动画的预测线动画残留。旧版本公告已移至 [`ANNOUNCEMENT_HISTORY.md`](./ANNOUNCEMENT_HISTORY.md)。

**功能清理：**
- 删除 `TrajectoryPredictor` 内的 ghost ball 脉冲动画逻辑，瞄准预测线只保留静态显示，不再有分析式动画效果。
- 删除设置页里的“轨迹动画”开关，以及 `trajectoryAnimationEnabled` 默认设置、实时设置分发和设置审计记录。
- 旧存档里的 `trajectoryAnimationEnabled` 会在设置加载与写入时被忽略，不再作为未知键继续保留。
- 清理空的 `src/analyzer` 目录残影，避免仓库结构里继续出现击球分析模块痕迹。

**兼容性修复：**
- 修复 `SettingsStore` 读取旧 localStorage 中未知设置键时的兼容分支作用域错误；移除旧设置键后，老用户设置不会因此整包回退到默认值。

**构建与测试：**
- `npm run build` 成功
- `npm test` 全量通过
- `npm run test:dist` 通过，dist 版本标签确认 `v1.26.9`
- 设置兼容测试确认旧 `trajectoryAnimationEnabled` 会被丢弃，未知未来键仍保留
