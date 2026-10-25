/**
 * Message codes from packages/modes → the interface texts the legacy rules
 * produced (Rules.js, NineBallRules.js and Game._onTurnTimerExpired). The
 * texts stay in Chinese until the translation (F5).
 */
import { UIText } from '../core/UIText.js';

const REASON_TEXT = {
  NO_BALL_HIT: '没有球被撞到',
  NO_RAIL_AFTER_CONTACT: '没有球碰库',
  WRONG_FIRST_HIT: '先碰了错误的球',
  EARLY_EIGHT: '非法打进8号球',
};

function foulText(reason) {
  if (reason === 'SCRATCH') return '白球落袋！对手获得自由球。';
  const text = REASON_TEXT[reason];
  return text ? `犯规：${text}！对手获得自由球。` : '犯规！对手获得自由球。';
}

const EIGHT_BALL = {
  BREAK_FOUL: ({ reason }) => `开球犯规：${reason === 'SCRATCH' ? '白球落袋' : '没有球被撞到'}！对手获得开球线后自由球`,
  EIGHT_ON_BREAK_RESPOT: () => '开球进8号球 — 重新摆回。台面仍为开放状态。',
  ILLEGAL_BREAK: () => '开球犯规：少于4颗球碰库！对手获得开球线后自由球',
  BREAK_NO_POCKET: () => '开球：没有球进袋。台面开放。',
  BREAK_LEGAL: () => '开球有效。台面仍为开放状态。',
  EARLY_EIGHT: () => '非法打进8号球！你输了！',
  LEGAL_EIGHT_WIN: () => '恭喜你赢了！',
};

const NINE_BALL_BREAK_FOUL = {
  SCRATCH: '开球犯规：白球落袋！对手获得自由球',
  NO_BALL_HIT: '开球犯规：没有球被撞到！对手获得自由球',
  WRONG_FIRST_HIT: '开球犯规：必须先碰到1号球！对手获得自由球',
};

const NINE_BALL = {
  BREAK_FOUL: ({ reason }) => NINE_BALL_BREAK_FOUL[reason] || NINE_BALL_BREAK_FOUL.NO_BALL_HIT,
  NINE_ON_BREAK_WIN: () => '开球进9号球！你赢了！',
  ILLEGAL_BREAK: () => '开球犯规：少于4颗球碰库。对手获得自由球',
  BREAK_NO_POCKET: () => '开球：没有球进袋。',
  BREAK_LEGAL: () => '开球有效。继续击球。',
  // The scratch text wins over the 9-ball one, as in NineBallRules.
  NINE_ON_FOUL_RESPOT: ({ reason }) => (reason === 'SCRATCH' ? foulText('SCRATCH') : '犯规：9号球进袋（已摆回）。对手获得自由球。'),
  LEGAL_NINE_WIN: () => '打进9号球！你赢了！',
  PUSH_OUT_PENDING: () => 'Push-out。对手可选择接受或让回。',
  THREE_FOUL_WARNING: () => UIText.threeFoulWarning,
  // NineBallRules names the player by number, not by the player's name.
  THREE_FOUL_LOSS: ({ seat }) => UIText.threeFoulLoss(`玩家 ${seat + 1}`),
};

const SHARED = {
  FOUL: ({ reason }) => foulText(reason),
  NO_POCKET: () => '没有球进袋。轮到对手。',
  POCKETED: ({ count }) => `打进 ${count} 颗球！继续击球。`,
};

/**
 * @param {'8ball' | '9ball'} modeId
 * @param {{ code: string, params?: Record<string, number | string> }[]} messages
 * @param {[string, string]} names player 1 and player 2 names
 * @returns {string} the texts joined in order ('' for an unknown code)
 */
export function rulingText(modeId, messages, names) {
  const own = modeId === '9ball' ? NINE_BALL : EIGHT_BALL;
  const named = {
    TIMEOUT: ({ seat, next }) => UIText.turnTimeout(names[seat], names[next]),
    PUSH_OUT_ACCEPTED: ({ seat }) => UIText.pushOutAcceptedMsg(names[seat]),
    PUSH_OUT_PASSED: ({ seat }) => UIText.pushOutPassedMsg(names[seat]),
  };
  return messages
    .map(({ code, params = {} }) => (own[code] || SHARED[code] || named[code])?.(params) ?? '')
    .filter(Boolean)
    .join(' ');
}
