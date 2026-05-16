/**
 * TableProfiles — Ball-table dimension definitions for different game types.
 *
 * All dimensions use the same scale as config.js (1 meter = 100 units).
 * The default pool9ft profile matches the legacy TABLE/POCKET constants exactly.
 */
import { SCALE, BALL } from '../config.js';

function cm(v) {
  return (v / 100) * SCALE;
}

export const TABLE_PROFILES = {
  pool9ft: {
    id: 'pool9ft',
    label: 'WPA 9ft Tournament',
    labelZh: 'WPA 9尺 锦标赛',
    width: cm(127),
    depth: cm(254),
    height: 5,
    cushionHeight: 5,
    cushionWidth: 4,
    pocketRadius: BALL.radius * 2.25,
    pocketDetectMargin: BALL.radius * 1.1,
    pocketStyle: 'american',
    ballSet: 'pool57',
    enabledFor: new Set(['freeplay', 'local2p', 'vsai', '9ball', 'match', 'lan']),
    default: true,
    enabled: true,
  },

  pool8ft: {
    id: 'pool8ft',
    label: 'WPA 8ft / Pro 8',
    labelZh: 'WPA 8尺 / Pro 8',
    width: cm(116.84),
    depth: cm(233.68),
    height: 5,
    cushionHeight: 5,
    cushionWidth: 4,
    pocketRadius: BALL.radius * 2.25,
    pocketDetectMargin: BALL.radius * 1.1,
    pocketStyle: 'american',
    ballSet: 'pool57',
    enabledFor: new Set(['freeplay', 'local2p', 'vsai', 'match']),
    default: false,
    enabled: true,
  },

  bar7ft: {
    id: 'bar7ft',
    label: '7ft Bar Box',
    labelZh: '7尺 酒吧台',
    width: cm(99),
    depth: cm(198),
    height: 5,
    cushionHeight: 5,
    cushionWidth: 4,
    pocketRadius: BALL.radius * 2.35,
    pocketDetectMargin: BALL.radius * 1.15,
    pocketStyle: 'american_bar',
    ballSet: 'pool57',
    enabledFor: new Set(['freeplay', 'local2p', 'vsai', 'challenge']),
    default: false,
    enabled: true,
  },

  chinese8: {
    id: 'chinese8',
    label: 'Chinese 8-ball',
    labelZh: '中式八球',
    width: cm(126),
    depth: cm(254),
    height: 5,
    cushionHeight: 5,
    cushionWidth: 4,
    pocketRadius: BALL.radius * 1.95,
    pocketDetectMargin: BALL.radius * 0.95,
    pocketStyle: 'chinese',
    ballSet: 'pool57',
    enabledFor: new Set(['freeplay', 'local2p', 'vsai', 'match']),
    default: false,
    enabled: true,
  },

  snooker12ft: {
    id: 'snooker12ft',
    label: 'Snooker 12ft',
    labelZh: '斯诺克 12尺',
    width: cm(177.8),
    depth: cm(356.9),
    height: 5,
    cushionHeight: 5,
    cushionWidth: 4,
    pocketRadius: BALL.radius * 1.7,
    pocketDetectMargin: BALL.radius * 0.85,
    pocketStyle: 'snooker',
    ballSet: 'snooker52',
    enabledFor: new Set([]),
    default: false,
    enabled: false,
    reason: 'future mode, requires snooker rules and 22-ball set',
  },

  carom10ft: {
    id: 'carom10ft',
    label: 'Carom 10ft',
    labelZh: '开伦 10尺',
    width: cm(142),
    depth: cm(284),
    height: 5,
    cushionHeight: 5,
    cushionWidth: 4,
    pocketRadius: 0,
    pocketDetectMargin: 0,
    pocketStyle: 'none',
    ballSet: 'carom61',
    enabledFor: new Set([]),
    default: false,
    enabled: false,
    reason: 'future mode, requires pocketless table and carom rules',
  },
};

export function getTableProfile(id) {
  return TABLE_PROFILES[id] || TABLE_PROFILES.pool9ft;
}

export function getDefaultTableProfile() {
  return TABLE_PROFILES.pool9ft;
}

export function getEnabledProfilesForMode(mode, rulesMode) {
  const list = [];
  for (const profile of Object.values(TABLE_PROFILES)) {
    if (!profile.enabled) continue;
    if (!profile.enabledFor.has(mode)) continue;
    if (profile.id === 'chinese8' && rulesMode === '9ball') continue;
    list.push(profile);
  }
  return list;
}

export function resolveTableProfileId(modeConfig, settingsStore) {
  if (modeConfig.tableProfileId && TABLE_PROFILES[modeConfig.tableProfileId]?.enabled) {
    return modeConfig.tableProfileId;
  }
  const rulesMode = modeConfig.mode === '9ball' ? '9ball' : '8ball';
  if (settingsStore) {
    const settingKey = rulesMode === '9ball'
      ? 'defaultTableProfile9Ball'
      : 'defaultTableProfile8Ball';
    const fromSettings = settingsStore.get(settingKey);
    if (fromSettings && TABLE_PROFILES[fromSettings]?.enabled) {
      const profile = TABLE_PROFILES[fromSettings];
      if (profile.enabledFor.has(modeConfig.mode)) {
        if (profile.id === 'chinese8' && rulesMode === '9ball') {
          // fall through
        } else {
          return fromSettings;
        }
      }
    }
  }
  if (modeConfig.mode === 'freeplay' && settingsStore) {
    const freeplayDefault = settingsStore.get('defaultTableProfileFreeplay');
    if (freeplayDefault && TABLE_PROFILES[freeplayDefault]?.enabled) {
      return freeplayDefault;
    }
  }
  return 'pool9ft';
}

export function getEnabledProfileIds() {
  return Object.values(TABLE_PROFILES)
    .filter(p => p.enabled)
    .map(p => p.id);
}
