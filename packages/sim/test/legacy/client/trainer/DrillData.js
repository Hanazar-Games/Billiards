/**
 * DrillData — Preset ball layouts for Shot Trainer mode.
 *
 * All positions use relative coordinates [-1, 1]:
 *   x = -1 → left cushion,  x = 1 → right cushion
 *   z = -1 → top cushion,   z = 1 → bottom cushion
 *
 * These are scaled to the current table profile at runtime.
 *
 * Pocket indices (from Table.createPockets):
 *   0: top-left     (-hw, 0, -hd)
 *   1: top-right    ( hw, 0, -hd)
 *   2: middle-left  (-hw, 0,   0)
 *   3: middle-right ( hw, 0,   0)
 *   4: bottom-left  (-hw, 0,  hd)
 *   5: bottom-right ( hw, 0,  hd)
 */

import { BALL } from '../config.js';

export const DRILL_TYPE = {
  STRAIGHT: 'straight',
  CUT: 'cut',
  LONG: 'long',
  THIN: 'thin',
  RAIL: 'rail',
  COMBO: 'combo',
  POSITION: 'position',
  BANK: 'bank',
};

export const DRILL_CATEGORIES = {
  BASIC: { label: '基础技巧', color: '#00e676' },
  INTERMEDIATE: { label: '进阶技巧', color: '#448aff' },
  ADVANCED: { label: '高级技巧', color: '#ffab00' },
};

export const DRILLS = [
  // ─── BASIC ───
  {
    id: 'straight_shot',
    name: '直线球',
    desc: '母球、目标球、袋口三点一线。掌握稳定的直球是台球基本功。',
    type: DRILL_TYPE.STRAIGHT,
    difficulty: 1,
    category: 'BASIC',
    ballPositions: {
      0: { x: 0.00, z: -0.45 },
      1: { x: 0.00, z: 0.20 },
    },
    targetPocket: 4,
    idealCueZone: null,
    hintPower: 40,
  },
  {
    id: 'cut_shot_easy',
    name: '简单角度球',
    desc: '目标球偏离直线路径，需要调整击球角度。',
    type: DRILL_TYPE.CUT,
    difficulty: 2,
    category: 'BASIC',
    ballPositions: {
      0: { x: 0.35, z: -0.40 },
      1: { x: 0.00, z: 0.15 },
    },
    targetPocket: 4,
    idealCueZone: null,
    hintPower: 42,
  },
  {
    id: 'soft_touch',
    name: '轻推练习',
    desc: '使用极小力度将球推入袋口，训练力度控制。',
    type: DRILL_TYPE.STRAIGHT,
    difficulty: 2,
    category: 'BASIC',
    ballPositions: {
      0: { x: 0.00, z: -0.20 },
      1: { x: 0.00, z: 0.50 },
    },
    targetPocket: 4,
    idealCueZone: null,
    hintPower: 12,
  },

  // ─── INTERMEDIATE ───
  {
    id: 'cut_shot_hard',
    name: '大角度球',
    desc: '目标球与袋口夹角较大，需要精确计算切入角度。',
    type: DRILL_TYPE.CUT,
    difficulty: 3,
    category: 'INTERMEDIATE',
    ballPositions: {
      0: { x: 0.50, z: -0.35 },
      1: { x: 0.00, z: 0.10 },
    },
    targetPocket: 4,
    idealCueZone: null,
    hintPower: 45,
  },
  {
    id: 'long_shot',
    name: '长台球',
    desc: '母球与目标球距离很远，对瞄准精度要求极高。',
    type: DRILL_TYPE.LONG,
    difficulty: 3,
    category: 'INTERMEDIATE',
    ballPositions: {
      0: { x: 0.00, z: -0.70 },
      1: { x: 0.00, z: 0.55 },
    },
    targetPocket: 5,
    idealCueZone: null,
    hintPower: 55,
  },
  {
    id: 'rail_shot',
    name: '贴库球',
    desc: '目标球紧贴库边，需要用薄切将球挤入袋口。',
    type: DRILL_TYPE.RAIL,
    difficulty: 4,
    category: 'INTERMEDIATE',
    ballPositions: {
      0: { x: 0.00, z: -0.40 },
      1: { x: 0.82, z: 0.25 },
    },
    targetPocket: 5,
    idealCueZone: null,
    hintPower: 38,
  },
  {
    id: 'position_play',
    name: '走位入门',
    desc: '进球的同时将母球控制在目标区域内。',
    type: DRILL_TYPE.POSITION,
    difficulty: 3,
    category: 'INTERMEDIATE',
    ballPositions: {
      0: { x: 0.00, z: -0.40 },
      1: { x: 0.00, z: 0.20 },
    },
    targetPocket: 4,
    idealCueZone: { x: 0.00, z: -0.15, radius: 0.12 },
    hintPower: 35,
  },

  // ─── ADVANCED ───
  {
    id: 'thin_cut',
    name: '极限薄球',
    desc: '母球与目标球几乎平行，需要极度精确的薄切。',
    type: DRILL_TYPE.THIN,
    difficulty: 5,
    category: 'ADVANCED',
    ballPositions: {
      0: { x: 0.45, z: -0.30 },
      1: { x: 0.00, z: 0.15 },
    },
    targetPocket: 4,
    idealCueZone: null,
    hintPower: 30,
  },
  {
    id: 'combination',
    name: '组合球',
    desc: '目标球被遮挡，需要借助其他球将其撞入袋口。',
    type: DRILL_TYPE.COMBO,
    difficulty: 4,
    category: 'ADVANCED',
    ballPositions: {
      0: { x: 0.00, z: -0.50 },
      1: { x: 0.00, z: 0.30 },
      2: { x: 0.00, z: 0.05 },
    },
    targetPocket: 4,
    idealCueZone: null,
    hintPower: 48,
  },
  {
    id: 'bank_shot',
    name: '库边反弹',
    desc: '目标球无法直接击入袋口，需要碰库边反弹后入袋。',
    type: DRILL_TYPE.BANK,
    difficulty: 5,
    category: 'ADVANCED',
    ballPositions: {
      0: { x: -0.60, z: -0.35 },
      1: { x: -0.25, z: 0.20 },
    },
    targetPocket: 5,
    idealCueZone: null,
    hintPower: 50,
  },
  {
    id: 'position_master',
    name: '精准走位',
    desc: '进球后将母球停在极小的目标区域内，走位精度要求高。',
    type: DRILL_TYPE.POSITION,
    difficulty: 5,
    category: 'ADVANCED',
    ballPositions: {
      0: { x: 0.30, z: -0.45 },
      1: { x: 0.00, z: 0.30 },
    },
    targetPocket: 4,
    idealCueZone: { x: 0.30, z: -0.10, radius: 0.06 },
    hintPower: 32,
  },
];

/** Get drill by ID */
export function getDrill(id) {
  return DRILLS.find((d) => d.id === id);
}

/** Get drills by category */
export function getDrillsByCategory(cat) {
  return DRILLS.filter((d) => d.category === cat);
}

/**
 * Convert relative ball positions to absolute world coordinates
 * based on the current table profile.
 */
export function resolveDrillPositions(drill, profile) {
  const margin = profile.cushionWidth + BALL.radius;
  const playW = profile.width / 2 - margin;
  const playD = profile.depth / 2 - margin;

  const positions = {};
  for (const [ballId, rel] of Object.entries(drill.ballPositions)) {
    positions[ballId] = {
      x: rel.x * playW,
      z: rel.z * playD,
    };
  }

  let idealZone = null;
  if (drill.idealCueZone) {
    idealZone = {
      x: drill.idealCueZone.x * playW,
      z: drill.idealCueZone.z * playD,
      radius: drill.idealCueZone.radius * Math.min(playW, playD),
    };
  }

  return { positions, idealZone };
}
