/**
 * ChallengeData — All skill-based challenges.
 *
 * Each challenge defines constraints and win conditions.
 * Stars are awarded based on performance (1-3).
 */

export const CHALLENGE_TYPE = {
  MULTI_POCKET: 'multi_pocket',
  CUSHION_SHOT: 'cushion_shot',
  POWER_LIMIT: 'power_limit',
  TIME_ATTACK: 'time_attack',
  LONG_SHOT: 'long_shot',
  SPIN_REQUIRED: 'spin_required',
  BREAK_SHOT: 'break_shot',
  NO_FOUL: 'no_foul',
};

export const CHALLENGES = [
  {
    id: 'multi_3',
    name: '一杆双响',
    desc: '单次击球进袋 3 个球',
    type: CHALLENGE_TYPE.MULTI_POCKET,
    params: { minPockets: 3 },
    difficulty: 3,
    gameMode: 'freeplay',
  },
  {
    id: 'cushion_master',
    name: '库边舞者',
    desc: '单次击球中球碰库边 4+ 次后进袋',
    type: CHALLENGE_TYPE.CUSHION_SHOT,
    params: { minCushions: 4 },
    difficulty: 4,
    gameMode: 'freeplay',
  },
  {
    id: 'soft_touch',
    name: '蜻蜓点水',
    desc: '使用 ≤15% 力度进球',
    type: CHALLENGE_TYPE.POWER_LIMIT,
    params: { maxPower: 15 },
    difficulty: 2,
    gameMode: 'freeplay',
  },
  {
    id: 'speed_demon',
    name: '速战速决',
    desc: '60 秒内完成一局对战',
    type: CHALLENGE_TYPE.TIME_ATTACK,
    params: { timeLimit: 60 },
    difficulty: 5,
    gameMode: 'local2p',
  },
  {
    id: 'long_shot',
    name: '长台神射',
    desc: '从台面另一端 (>180cm) 进球',
    type: CHALLENGE_TYPE.LONG_SHOT,
    params: { minDistance: 180 },
    difficulty: 3,
    gameMode: 'freeplay',
  },
  {
    id: 'spin_win',
    name: '旋转大师',
    desc: '必须使用旋转进球并获胜',
    type: CHALLENGE_TYPE.SPIN_REQUIRED,
    params: {},
    difficulty: 4,
    gameMode: 'local2p',
  },
  {
    id: 'perfect_break',
    name: '完美开球',
    desc: '开球进袋 4+ 球',
    type: CHALLENGE_TYPE.BREAK_SHOT,
    params: { minPockets: 4 },
    difficulty: 5,
    gameMode: 'local2p',
  },
  {
    id: 'no_foul_win',
    name: '完美比赛',
    desc: '整局无犯规获胜',
    type: CHALLENGE_TYPE.NO_FOUL,
    params: {},
    difficulty: 4,
    gameMode: 'local2p',
  },
];

export function getChallenge(id) {
  return CHALLENGES.find((c) => c.id === id);
}
