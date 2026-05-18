/**
 * UIText — Centralised Chinese UI strings for Game.js.
 *
 * Keeping all player-facing text in one place makes it easier to
 * maintain consistency and eventually support i18n.
 */

export const UIText = {
  // Mode introduction messages
  freeplayIntro: '练习模式：无胜负规则；白球进袋会自动复位，犯规自由球时白球可在球桌内任意摆放。',
  nineBallIntro: '9 球规则：白球必须先碰当前最小号码球；合法打进 9 号球获胜。',
  eightBallIntro: '标准 8 球规则：开球后按进球分配全色/花色；清完本组后打进 8 号球获胜。',
  freeplayReset: '练习模式：无胜负规则；白球进袋会自动复位，自由球可在球桌内任意摆放。',
  nineBallReset: '新 9 球局：白球必须先碰当前最小号码球；合法打进 9 号球获胜。',
  eightBallResetVsAI: '新 8 球局：玩家 1 开球，对手为 AI；先清完本组再打 8 号球。',
  eightBallReset: '新 8 球局：玩家 1 开球；先清完本组再打 8 号球。',

  // Ball-in-hand messages
  ballInHandBehindLine: '自由球：白球必须摆放在开球线后，移动鼠标预览，左键确认。',
  ballInHandAnywhere: '自由球：白球可以在球桌内任意摆放，移动鼠标预览，左键确认。',
  ballInHandInvalid: '自由球：当前位置无效，请放在台面内且不要贴住其他球或袋口。',
  ballInHandPlaced: '自由球已放置。继续瞄准，后拉球杆击球。',
  ballInHandWaitHost: '等待房主确认自由球位置…',
  ballInHandCanceled: '自由球已取消。',

  // AI messages
  aiThinking: 'AI 思考中…',
  aiPlanningFailed: 'AI 规划失败，已恢复玩家控制。',

  // Turn timer
  turnTimeout: (currentName, otherName) =>
    `⏰ 回合超时！${currentName} 犯规，${otherName} 获得自由球`,

  // Network messages
  networkDisconnect: '网络连接已断开，即将返回主菜单…',
  hostLeft: '房主已离开，房间关闭，即将返回主菜单…',
  hostDisconnected: '房主连接已断开，即将返回主菜单…',
  networkCannotConcede: '网络对战中无法主动认输',
  concedeWinner: (winner) => `玩家 ${winner} 获胜！（对手认输）`,
  resetRequested: '已请求重新开始…',
  opponentInvalidPlacement: '对手自由球位置无效，已拒绝。',

  // Push-out
  pushOutButton: 'Push-out',
  pushOutTooltip: 'Push-out：将击球权交给对手，对手可选择接受或让回',
  pushOutPrompt: '对手打出了 Push-out，请选择：',
  pushOutAccept: '接受',
  pushOutPass: '让回',
  pushOutAcceptedMsg: (player) => `${player} 接受了 Push-out`,
  pushOutPassedMsg: (player) => `${player} 让回了 Push-out`,
  pushOutMustChoose: '请先选择接受或让回 Push-out',

  // Three-foul
  threeFoulWarning: '⚠️ 已连续两次犯规，再犯一次将判负！',
  threeFoulLoss: (player) => `${player} 连续三次犯规，判负！`,

  // Game over
  gameOverResetLabel: '再来一局',

  // Input hints
  pressEnterToShoot: '按 Enter 键确认击球',

  // Menu actions
  backToMenu: '返回菜单',

  // Cue-tip English labels
  cueTipLabel: '击球点',
  cueTipCenter: '中心击球',
  cueTipRightEnglish: '右塞',
  cueTipLeftEnglish: '左塞',
  cueTipHigh: '高杆',
  cueTipLow: '低杆',

  // Objective lines
  objectiveFreeplay: '练习模式 · 自由击球',
  objective9Ball: '9球模式 · 先进9号球获胜',
  objective8BallVsAI: '标准8球 · 对战AI · 清台获胜',
  objective8Ball: '标准8球 · 清台获胜',
};
