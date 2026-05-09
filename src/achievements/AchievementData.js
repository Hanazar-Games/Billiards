/**
 * AchievementData — All unlockable achievements.
 *
 * Categories:
 *   SKILL   — technical feats during a single shot
 *   CAREER  — cumulative lifetime stats
 *   SPECIAL — rare or memorable moments
 *
 * Each achievement:
 *   id: unique string key
 *   name: display name
 *   desc: description of unlock condition
 *   category: 'SKILL' | 'CAREER' | 'SPECIAL'
 *   icon: emoji
 *   hidden: false (visible from start) or true (hidden until unlocked)
 */

export const ACHIEVEMENT_CATEGORIES = {
  SKILL: { label: '技术成就', color: '#00e676' },
  CAREER: { label: '生涯成就', color: '#448aff' },
  SPECIAL: { label: '特殊成就', color: '#ffab00' },
};

export const ACHIEVEMENTS = [
  // ─── SKILL ───
  {
    id: 'multi_pocket_3',
    name: '一杆双响',
    desc: '单次击球进袋 3 个球',
    category: 'SKILL',
    icon: '🎯',
    hidden: false,
  },
  {
    id: 'multi_pocket_4',
    name: '一杆清台',
    desc: '单次击球进袋 4 个球',
    category: 'SKILL',
    icon: '🎱',
    hidden: false,
  },
  {
    id: 'long_shot',
    name: '长台神射',
    desc: '从台面另一端（距离 >200cm）进球',
    category: 'SKILL',
    icon: '🏹',
    hidden: false,
  },
  {
    id: 'spin_shot',
    name: '旋转大师',
    desc: '使用 English Spin 进球',
    category: 'SKILL',
    icon: '🌀',
    hidden: false,
  },
  {
    id: 'perfect_break',
    name: '完美开球',
    desc: '开球进袋 4+ 球',
    category: 'SKILL',
    icon: '💥',
    hidden: false,
  },
  {
    id: 'combo_3',
    name: '连环撞击',
    desc: '一杆造成 3+ 次球-球碰撞',
    category: 'SKILL',
    icon: '⚡',
    hidden: false,
  },
  {
    id: 'bank_shot',
    name: '库边反弹',
    desc: '球先碰库边再进袋',
    category: 'SKILL',
    icon: '🔄',
    hidden: false,
  },
  {
    id: 'max_power',
    name: '全力一击',
    desc: '使用 100% 力度击球并进球',
    category: 'SKILL',
    icon: '💪',
    hidden: false,
  },
  {
    id: 'soft_touch',
    name: '蜻蜓点水',
    desc: '使用 ≤10% 力度击球并进球',
    category: 'SKILL',
    icon: '🦋',
    hidden: false,
  },
  {
    id: 'cushion_master',
    name: '库边舞者',
    desc: '单次击球中球碰库边 4+ 次',
    category: 'SKILL',
    icon: '🎭',
    hidden: false,
  },

  // ─── CAREER ───
  {
    id: 'shots_100',
    name: '百杆高手',
    desc: '累计击球 100 次',
    category: 'CAREER',
    icon: '🔨',
    hidden: false,
  },
  {
    id: 'shots_500',
    name: '千锤百炼',
    desc: '累计击球 500 次',
    category: 'CAREER',
    icon: '⚒️',
    hidden: false,
  },
  {
    id: 'pockets_50',
    name: '进球机器',
    desc: '累计进球 50 个',
    category: 'CAREER',
    icon: '🕳️',
    hidden: false,
  },
  {
    id: 'pockets_200',
    name: '袋口主宰',
    desc: '累计进球 200 个',
    category: 'CAREER',
    icon: '👑',
    hidden: false,
  },
  {
    id: 'wins_10',
    name: '常胜将军',
    desc: '累计获胜 10 局',
    category: 'CAREER',
    icon: '🏆',
    hidden: false,
  },
  {
    id: 'wins_50',
    name: '传奇球手',
    desc: '累计获胜 50 局',
    category: 'CAREER',
    icon: '🥇',
    hidden: false,
  },
  {
    id: 'games_20',
    name: '资深玩家',
    desc: '累计完成 20 局游戏',
    category: 'CAREER',
    icon: '🎮',
    hidden: false,
  },
  {
    id: 'streak_5',
    name: '连胜纪录',
    desc: '连续赢 5 局',
    category: 'CAREER',
    icon: '🔥',
    hidden: false,
  },
  {
    id: 'vs_ai_win',
    name: 'AI 克星',
    desc: '击败 AI 一次',
    category: 'CAREER',
    icon: '🤖',
    hidden: false,
  },
  {
    id: 'vs_ai_hard',
    name: 'AI 终结者',
    desc: '在困难难度下击败 AI',
    category: 'CAREER',
    icon: '💀',
    hidden: false,
  },

  // ─── SPECIAL ───
  {
    id: 'nine_ball_break',
    name: '9球奇迹',
    desc: '开球直接进 9 号球',
    category: 'SPECIAL',
    icon: '✨',
    hidden: true,
  },
  {
    id: 'eight_ball_perfect',
    name: '黑八绝杀',
    desc: '黑8一杆决胜',
    category: 'SPECIAL',
    icon: '🖤',
    hidden: false,
  },
  {
    id: 'shutout',
    name: '零封',
    desc: '对手一球未进的情况下获胜',
    category: 'SPECIAL',
    icon: '🚫',
    hidden: false,
  },
  {
    id: 'no_foul_win',
    name: '完美比赛',
    desc: '整局无犯规获胜',
    category: 'SPECIAL',
    icon: '💎',
    hidden: false,
  },
  {
    id: 'comeback',
    name: '绝地反击',
    desc: '落后时连续进球逆转获胜',
    category: 'SPECIAL',
    icon: '🚀',
    hidden: false,
  },
  {
    id: 'first_win',
    name: '首胜',
    desc: '赢得第一局游戏',
    category: 'SPECIAL',
    icon: '🎉',
    hidden: false,
  },
  {
    id: 'all_modes',
    name: '全能球手',
    desc: '在所有游戏模式下各赢一局',
    category: 'SPECIAL',
    icon: '🌟',
    hidden: false,
  },
  {
    id: 'trail_beauty',
    name: '艺术轨迹',
    desc: '单次击球轨迹点数 >100',
    category: 'SPECIAL',
    icon: '🎨',
    hidden: true,
  },
  {
    id: 'speed_demon',
    name: '速战速决',
    desc: '30 秒内完成一局',
    category: 'SPECIAL',
    icon: '⏱️',
    hidden: false,
  },
  {
    id: 'collector',
    name: '收藏家',
    desc: '解锁 20 个成就',
    category: 'SPECIAL',
    icon: '📚',
    hidden: false,
  },
];

/** Get achievement by ID */
export function getAchievement(id) {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

/** Get all achievements in a category */
export function getAchievementsByCategory(category) {
  return ACHIEVEMENTS.filter((a) => a.category === category);
}
