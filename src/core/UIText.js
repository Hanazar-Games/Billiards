/**
 * UIText — Centralised Chinese UI strings for Game.js.
 *
 * Keeping all player-facing text in one place makes it easier to
 * maintain consistency and eventually support i18n.
 */

export const UIText = {
  // Mode introduction messages
  freeplayIntro: '练习模式：无胜负规则，白球进袋会自动复位，可自由摆放白球。',
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

  // Ball-in-hand invalid placement reasons
  ballInHandInvalidOutOfBounds: '自由球必须放在台面内。',
  ballInHandInvalidBehindLine: '自由球必须放在开球线后。',
  ballInHandInvalidNearBall: '自由球不能贴住其他球。',
  ballInHandInvalidNearPocket: '自由球不能放在袋口附近。',

  // Foul reason mapping (used by UI to explain WHY a foul happened)
  foulReasonMap: {
    SCRATCH: '白球落袋',
    NO_BALL_HIT: '没有球被撞到',
    NO_RAIL_AFTER_CONTACT: '没有球碰库',
    WRONG_FIRST_HIT: '先碰了错误的球',
    ILLEGAL_BREAK: '开球犯规（少于4颗球碰库）',
    EARLY_EIGHT: '非法打进8号球',
    NINE_ON_FOUL_RESPOT: '犯规时9号球进袋（已摆回）',
    THREE_FOUL_LOSS: '连续三次犯规',
    NINE_ON_BREAK_WIN: '开球进9号球',
    LEGAL_NINE_WIN: '合法打进9号球',
    LEGAL_EIGHT_WIN: '合法打进8号球',
    EIGHT_ON_BREAK_RESPOT: '开球进8号球（已摆回）',
  },

  foulReason(code) {
    return this.foulReasonMap[code] || '未知犯规';
  },

  // AI messages
  aiThinking: 'AI 思考中…',
  aiPlanningFailed: 'AI 规划失败，已恢复玩家控制。',

  // Turn timer
  turnTimeout: (currentName, otherName) =>
    `⏰ 回合超时！${currentName} 犯规，${otherName} 获得自由球`,

  // Sound toggle
  soundOn: '声音已开启',
  soundOff: '声音已关闭',

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

  // Trainer
  trainerReset: '训练模式：调整瞄准线和力度，将目标球击入指定袋口',
  trainerObjective: '练习击球技巧 — 进球后查看评分',
  trainerResetLabel: '重置球型',

  // Objective lines
  objectiveChallenge: '挑战模式',
  objectiveFreeplay: '练习模式 · 自由击球',
  objective9Ball: (target) => `9球模式 · 目标球: ${target}号`,
  objective9BallOpen: '9球模式 · 先打1号球',
  objective8BallVsAI: '标准8球 · 对战AI · 清台获胜',
  objective8Ball: '标准8球 · 清台获胜',
  objective8BallOpen: '台面开放 · 先进球决定分组',
  objective8BallClosed: (p1Group, p2Group) => {
    const g1 = p1Group === 'solid' ? '全色 ●' : (p1Group === 'stripe' ? '花色 ◯' : '待定');
    const g2 = p2Group === 'solid' ? '全色 ●' : (p2Group === 'stripe' ? '花色 ◯' : '待定');
    return `玩家 1: ${g1}  |  玩家 2: ${g2}`;
  },

  // Freeplay feedback
  freeplayFeedback: ({ power, pocketedCount, spinText, positionQuality }) => {
    const parts = [];
    if (typeof power === 'number') parts.push(`力度 ${power}%`);
    if (pocketedCount > 0) parts.push(`进 ${pocketedCount} 颗`);
    else parts.push('未进球');
    if (spinText && spinText !== '中心击球') parts.push(spinText);
    if (positionQuality) parts.push(positionQuality);
    return parts.join(' · ');
  },
};
