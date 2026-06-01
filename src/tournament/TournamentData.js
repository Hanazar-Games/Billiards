/**
 * TournamentData — Player characters, AI opponent generation, and trophy definitions.
 *
 * All names, colours, and difficulty curves are defined here so the rest of
 * the tournament system is data-driven.
 */

import { AI_DIFFICULTY } from '../ai/AIPlayer.js';

/** Pre-defined opponent roster with personalities. */
export const OPPONENT_NAMES = [
  { name: '陈小龙', title: '街头新秀', style: '进攻型' },
  { name: '林思远', title: '学院派', style: '防守型' },
  { name: '王大伟', title: '酒吧冠军', style: '旋转型' },
  { name: '赵铁柱', title: '力量型选手', style: '力量型' },
  { name: '刘文静', title: '冷面杀手', style: '均衡型' },
  { name: '孙浩然', title: '快枪手', style: '速度型' },
  { name: '周子墨', title: '战术大师', style: '防守型' },
  { name: '吴天宇', title: '翻盘王', style: '进攻型' },
  { name: '郑凯文', title: '老将', style: '均衡型' },
  { name: '钱多多', title: '欢乐球手', style: '旋转型' },
  { name: '冯志强', title: '铁人', style: '力量型' },
  { name: '杨帆', title: '海上风暴', style: '速度型' },
];

/** Avatar colour palette (dark theme friendly). */
export const PLAYER_COLORS = [
  '#d8b15f', // gold
  '#e07050', // terracotta
  '#50a0e0', // sky blue
  '#70c070', // mint green
  '#c070c0', // lavender
  '#50c0c0', // cyan
  '#e0a050', // amber
  '#e05070', // rose
];

/** Trophy tiers with unlock thresholds. */
export const TROPHY_TIERS = {
  gold: {
    name: '冠军金杯',
    icon: '🏆',
    desc: '在锦标赛中击败所有对手，夺得冠军',
    color: '#ffd700',
  },
  silver: {
    name: '亚军银杯',
    icon: '🥈',
    desc: '闯入决赛，虽败犹荣',
    color: '#c0c0c0',
  },
  bronze: {
    name: '四强铜杯',
    icon: '🥉',
    desc: '打入半决赛，展现实力',
    color: '#cd7f32',
  },
};

/** Difficulty curve per round (0=quarter, 1=semi, 2=final). */
export const ROUND_DIFFICULTY = [
  [AI_DIFFICULTY.EASY, AI_DIFFICULTY.NORMAL],
  [AI_DIFFICULTY.NORMAL, AI_DIFFICULTY.HARD],
  [AI_DIFFICULTY.HARD, AI_DIFFICULTY.HARD],
];

/** Games needed per round (Bo1 / Bo3 / Bo5). */
export const ROUND_FORMAT = [1, 3, 5];

/** Pick N unique opponents from the roster, shuffled. */
export function generateOpponents(count = 7, seed = Date.now()) {
  const shuffled = [...OPPONENT_NAMES].sort(() => seededRandom(seed++) - 0.5);
  return shuffled.slice(0, count).map((o, i) => ({
    ...o,
    id: `ai_${i}`,
    color: PLAYER_COLORS[(i + 1) % PLAYER_COLORS.length],
    isPlayer: false,
  }));
}

/** Simple seeded random for deterministic opponent generation. */
function seededRandom(seed) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

/** Create the player character object. */
export function createPlayerCharacter(name, colorIndex = 0) {
  return {
    id: 'player',
    name: name || '玩家',
    color: PLAYER_COLORS[colorIndex % PLAYER_COLORS.length],
    title: '挑战者',
    style: '自定义',
    isPlayer: true,
  };
}

/** Generate a complete 8-player single-elimination bracket. */
export function generateBracket(player, opponents, mode = '8ball', tableProfileId = null) {
  const entrants = [player, ...opponents];
  // Shuffle so player position is random
  const shuffled = entrants.sort(() => Math.random() - 0.5);

  const rounds = [
    // Quarter finals: 4 matches
    Array.from({ length: 4 }, (_, i) => createMatch(shuffled[i * 2], shuffled[i * 2 + 1], 0, i, mode, tableProfileId)),
    // Semi finals: 2 matches (placeholders)
    Array.from({ length: 2 }, (_, i) => createMatch(null, null, 1, i, mode, tableProfileId)),
    // Final: 1 match (placeholder)
    [createMatch(null, null, 2, 0, mode, tableProfileId)],
  ];

  return rounds;
}

function createMatch(p1, p2, round, index, mode, tableProfileId) {
  return {
    round,
    index,
    mode,
    tableProfileId,
    player1: p1,
    player2: p2,
    winner: null,
    p1Score: 0,
    p2Score: 0,
    gamesNeeded: ROUND_FORMAT[round] || 1,
    played: false,
    startTime: null,
    endTime: null,
  };
}

/** Determine the next match for a given match result. */
export function getNextMatch(round, index) {
  if (round >= 2) return null; // final has no next match
  const nextRound = round + 1;
  const nextIndex = Math.floor(index / 2);
  return { round: nextRound, index: nextIndex };
}

/** Compute which slot (player1 or player2) the winner fills in the next round. */
export function getWinnerSlot(round, index) {
  return index % 2 === 0 ? 'player1' : 'player2';
}
