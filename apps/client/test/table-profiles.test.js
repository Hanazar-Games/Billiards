import assert from 'assert';
import {
  getTableProfile,
  getDefaultTableProfile,
  getEnabledProfilesForMode,
  resolveTableProfileId,
  validateModeTableProfile,
  getEnabledProfileIds,
} from '../src/game/TableProfiles.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

// ── Profile basics ──
console.log('\nTableProfiles — Basics');

test('pool9ft exists and is enabled', () => {
  const p = getTableProfile('pool9ft');
  assert.ok(p, 'pool9ft should exist');
  assert.strictEqual(p.enabled, true);
});

test('pool9ft dimensions match legacy 254 x 127 cm', () => {
  const p = getTableProfile('pool9ft');
  assert.strictEqual(p.width, 127, 'width should be 127');
  assert.strictEqual(p.depth, 254, 'depth should be 254');
  assert.strictEqual(p.height, 5);
  assert.strictEqual(p.cushionWidth, 4);
});

test('pool9ft is the default profile', () => {
  const def = getDefaultTableProfile();
  assert.strictEqual(def.id, 'pool9ft');
});

test('snooker12ft is disabled', () => {
  const p = getTableProfile('snooker12ft');
  assert.ok(p);
  assert.strictEqual(p.enabled, false);
});

test('carom10ft is disabled', () => {
  const p = getTableProfile('carom10ft');
  assert.ok(p);
  assert.strictEqual(p.enabled, false);
});

test('unknown profile id falls back to pool9ft', () => {
  const p = getTableProfile('does-not-exist');
  assert.strictEqual(p.id, 'pool9ft');
});

// ── validateModeTableProfile ──
console.log('\nTableProfiles — validateModeTableProfile');

test('8ball + pool9ft is valid', () => {
  const r = validateModeTableProfile('local2p', 'pool9ft');
  assert.strictEqual(r.valid, true);
  assert.strictEqual(r.tableProfileId, 'pool9ft');
});

test('8ball + chinese8 is valid', () => {
  const r = validateModeTableProfile('local2p', 'chinese8');
  assert.strictEqual(r.valid, true);
  assert.strictEqual(r.tableProfileId, 'chinese8');
});

test('9ball + pool9ft is valid', () => {
  const r = validateModeTableProfile('9ball', 'pool9ft');
  assert.strictEqual(r.valid, true);
});

test('9ball + bar7ft is valid', () => {
  const r = validateModeTableProfile('nineball', 'bar7ft');
  assert.strictEqual(r.valid, true);
  assert.strictEqual(r.tableProfileId, 'bar7ft');
});

test('9ball + chinese8 is NOT valid → fallback pool9ft', () => {
  const r = validateModeTableProfile('9ball', 'chinese8');
  assert.strictEqual(r.valid, false);
  assert.strictEqual(r.tableProfileId, 'pool9ft');
  assert.ok(r.reason.includes('chinese8'));
});

test('nineball + chinese8 is NOT valid → fallback pool9ft', () => {
  const r = validateModeTableProfile('nineball', 'chinese8');
  assert.strictEqual(r.valid, false);
  assert.strictEqual(r.tableProfileId, 'pool9ft');
});

test('8ball + snooker12ft is NOT valid → fallback pool9ft', () => {
  const r = validateModeTableProfile('local2p', 'snooker12ft');
  assert.strictEqual(r.valid, false);
  assert.strictEqual(r.tableProfileId, 'pool9ft');
});

test('8ball + carom10ft is NOT valid → fallback pool9ft', () => {
  const r = validateModeTableProfile('vsai', 'carom10ft');
  assert.strictEqual(r.valid, false);
  assert.strictEqual(r.tableProfileId, 'pool9ft');
});

test('unknown profile is NOT valid → fallback pool9ft', () => {
  const r = validateModeTableProfile('local2p', 'fake-table');
  assert.strictEqual(r.valid, false);
  assert.strictEqual(r.tableProfileId, 'pool9ft');
});

// ── getEnabledProfilesForMode ──
console.log('\nTableProfiles — getEnabledProfilesForMode');

test('match 8ball includes chinese8', () => {
  const list = getEnabledProfilesForMode('match', '8ball');
  const ids = list.map(p => p.id);
  assert.ok(ids.includes('pool9ft'));
  assert.ok(ids.includes('chinese8'));
});

test('match 9ball excludes chinese8', () => {
  const list = getEnabledProfilesForMode('match', '9ball');
  const ids = list.map(p => p.id);
  assert.ok(ids.includes('pool9ft'));
  assert.ok(!ids.includes('chinese8'), 'chinese8 should not appear in 9ball');
});

test('lan mode excludes snooker and carom', () => {
  const list = getEnabledProfilesForMode('lan', '8ball');
  const ids = list.map(p => p.id);
  assert.ok(!ids.includes('snooker12ft'));
  assert.ok(!ids.includes('carom10ft'));
});

test('freeplay mode includes pool9ft/pool8ft/bar7ft/chinese8', () => {
  const list = getEnabledProfilesForMode('freeplay', '8ball');
  const ids = list.map(p => p.id);
  assert.ok(ids.includes('pool9ft'));
  assert.ok(ids.includes('pool8ft'));
  assert.ok(ids.includes('bar7ft'));
  assert.ok(ids.includes('chinese8'));
});

// ── resolveTableProfileId ──
console.log('\nTableProfiles — resolveTableProfileId');

const mockSettings8Ball = {
  get(key) {
    if (key === 'defaultTableProfile8Ball') return 'pool8ft';
    if (key === 'defaultTableProfile9Ball') return 'bar7ft';
    if (key === 'defaultTableProfileFreeplay') return 'bar7ft';
    return null;
  },
};

test('explicit valid id is returned', () => {
  const id = resolveTableProfileId({ mode: 'local2p', tableProfileId: 'chinese8' }, mockSettings8Ball);
  assert.strictEqual(id, 'chinese8');
});

test('explicit invalid id (9ball+chinese8) falls back to settings', () => {
  const id = resolveTableProfileId({ mode: '9ball', tableProfileId: 'chinese8' }, mockSettings8Ball);
  assert.strictEqual(id, 'bar7ft');
});

test('explicit disabled id (snooker) falls back to settings', () => {
  const id = resolveTableProfileId({ mode: 'local2p', tableProfileId: 'snooker12ft' }, mockSettings8Ball);
  assert.strictEqual(id, 'pool8ft');
});

test('freeplay uses defaultTableProfileFreeplay setting', () => {
  const id = resolveTableProfileId({ mode: 'freeplay' }, mockSettings8Ball);
  assert.strictEqual(id, 'bar7ft');
});

test('no explicit id + no settings → pool9ft fallback', () => {
  const id = resolveTableProfileId({ mode: 'local2p' }, null);
  assert.strictEqual(id, 'pool9ft');
});

// ── getEnabledProfileIds ──
console.log('\nTableProfiles — getEnabledProfileIds');

test('enabled IDs list contains only active profiles', () => {
  const ids = getEnabledProfileIds();
  assert.ok(ids.includes('pool9ft'));
  assert.ok(ids.includes('pool8ft'));
  assert.ok(ids.includes('bar7ft'));
  assert.ok(ids.includes('chinese8'));
  assert.ok(!ids.includes('snooker12ft'));
  assert.ok(!ids.includes('carom10ft'));
});


// ── Additional profile dimensions ──
console.log('\nTableProfiles — Additional Dimensions')

test('pool8ft dimensions are correct', () => {
  const p = getTableProfile('pool8ft');
  assert.strictEqual(p.width, 116.84, 'width should be 116.84');
  assert.strictEqual(p.depth, 233.68, 'depth should be 233.68');
  assert.strictEqual(p.enabled, true);
});

test('bar7ft dimensions are correct', () => {
  const p = getTableProfile('bar7ft');
  assert.strictEqual(p.width, 99, 'width should be 99');
  assert.strictEqual(p.depth, 198, 'depth should be 198');
  assert.strictEqual(p.enabled, true);
});

test('chinese8 dimensions are correct', () => {
  const p = getTableProfile('chinese8');
  assert.strictEqual(p.width, 126, 'width should be 126');
  assert.strictEqual(p.depth, 254, 'depth should be 254');
  assert.strictEqual(p.enabled, true);
});

test('all enabled profiles have pocketDetectMargin = BALL.radius', () => {
  const enabled = getEnabledProfileIds();
  for (const id of enabled) {
    const p = getTableProfile(id);
    assert.strictEqual(p.pocketDetectMargin, 2.8575, id + ' pocketDetectMargin should equal BALL.radius');
  }
});

// ── getEnabledProfilesForMode extended ──
console.log('\nTableProfiles — getEnabledProfilesForMode Extended')

test('vsai mode includes all enabled 8ball profiles', () => {
  const list = getEnabledProfilesForMode('vsai', '8ball');
  const ids = list.map(p => p.id);
  assert.ok(ids.includes('pool9ft'));
  assert.ok(ids.includes('chinese8'));
});

test('challenge mode includes bar7ft', () => {
  const list = getEnabledProfilesForMode('challenge', '8ball');
  const ids = list.map(p => p.id);
  assert.ok(ids.includes('bar7ft'));
});

test('lan 9ball excludes chinese8', () => {
  const list = getEnabledProfilesForMode('lan', '9ball');
  const ids = list.map(p => p.id);
  assert.ok(!ids.includes('chinese8'));
});

// ── resolveTableProfileId settings validation ──
console.log('\nTableProfiles — resolveTableProfileId Settings Validation')

const mockSettingsInvalid9Ball = {
  get(key) {
    if (key === 'defaultTableProfile9Ball') return 'chinese8'; // invalid for 9ball
    if (key === 'defaultTableProfile8Ball') return 'pool9ft';
    if (key === 'defaultTableProfileFreeplay') return 'pool9ft';
    return null;
  },
};

test('9ball with invalid settings (chinese8) falls back to pool9ft', () => {
  const id = resolveTableProfileId({ mode: '9ball' }, mockSettingsInvalid9Ball);
  assert.strictEqual(id, 'pool9ft');
});

const mockSettingsInvalidFreeplay = {
  get(key) {
    if (key === 'defaultTableProfileFreeplay') return 'snooker12ft'; // disabled
    if (key === 'defaultTableProfile8Ball') return 'pool9ft';
    return null;
  },
};

test('freeplay with disabled settings falls back to pool9ft', () => {
  const id = resolveTableProfileId({ mode: 'freeplay' }, mockSettingsInvalidFreeplay);
  assert.strictEqual(id, 'pool9ft');
});

// ── Summary ──
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
