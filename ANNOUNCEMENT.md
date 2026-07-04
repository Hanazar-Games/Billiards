# 3D Billiards v1.26.8 — Latest Update

## What's New in v1.26.8

### 深度总审计修复 — UI/UX/SFX/BGM + Analyzer Removal Cleanup

本版本围绕“击球分析全部不要”的清理结果继续做全局回查，重点检查 UI/UX、SFX、BGM、LAN、Replay、Settings 和刚刚移除 Shot Analyzer 后的残留入口。旧版本公告已移至 [`ANNOUNCEMENT_HISTORY.md`](./ANNOUNCEMENT_HISTORY.md)。

**功能清理：**
- 已完整移除 Shot Analyzer 功能面：删除 analyzer 引擎、面板、轨迹图和对应测试，并清理主流程、回放按钮、菜单注入、设置项、文案、脚本引用中的残留入口。
- Replay 面板不再出现“分析此杆”相关操作，结束击球后也不会再自动打开击球分析面板。

**UI/UX 修复：**
- LAN 房间面板打开时不再自动连接 WebSocket；现在只在“创建房间 / 加入房间”时连接。这样本机 `3001` 端口被其他非 WebSocket 服务占用时，不会一进面板就刷红色连接错误。
- Replay 删除、清空、导入结果提示已从原生 `confirm()` / `alert()` 改成应用内玻璃拟态确认框和轻提示，视觉风格与其他面板保持一致。
- 设置页“恢复默认快捷键”也改用应用内确认框，避免系统弹窗打断沉浸感。
- Replay 导出延迟释放 Object URL，降低少数浏览器中下载尚未开始就撤销 URL 的风险。
- 瞄准点、生涯统计柱状图、引导提示按钮、回放命名输入框等剩余硬编码动效已接入 `--ui-anim-speed`。

**SFX/BGM 修复：**
- 所有零音量 SFX 路径现在会安全丢弃未连接节点，避免严格 Web Audio 实现中 `disconnect()` 抛错。
- Instant Replay 与 Broadcast 打字光标的动画已尊重减弱动态效果和 UI 动画速度设置。
- BGM 未发现本轮新增回归，保留现有音量恢复与淡出保护。

**构建与测试：**
- `npm run build` 成功
- `npm test` 全量通过
- `npm run test:dist` 通过，dist 版本标签确认 `v1.26.8`
- 重点补充验证覆盖：`test:audio`、`test:lan`、`test:instant-replay`、`test:settings-audit`、`test:achievement-toast`、`test:smoke`
