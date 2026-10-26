// docs/protocol.md is the contract of protocol v1 (D055): every operation and every refusal
// the server can send has to be in it, so a change to the code that forgets the document fails here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { OP, PROTOCOL_VERSION, SERVER_REJECT_REASONS, SIM_VERSION } from '../src/index.ts';

const doc = readFileSync(new URL('../../../docs/protocol.md', import.meta.url), 'utf8');
const lines = doc.split('\n');

/** The refusals of packages/modes (RejectReason) that a shot_rejected can carry. */
const MODE_REJECT_REASONS = ['GAME_OVER', 'NOT_YOUR_TURN', 'BAD_INPUT', 'PUSH_OUT_PENDING', 'PUSH_OUT_UNAVAILABLE',
  'CUE_BALL_NOT_ALLOWED', 'CUE_BALL_OUTSIDE_KITCHEN'];

/** The `code` of an `error` (108), the join refusals and the end reasons. */
const OTHER_CODES = ['UNSUPPORTED_OP', 'SIM_FAILED', 'PROTOCOL_MISMATCH', 'MATCH_ENDED', 'ROOM_FULL',
  'WIN', 'CONCEDE', 'ABANDON', 'ABORTED'];

test('docs/protocol.md descreve todos os códigos de operação', () => {
  for (const [name, code] of Object.entries(OP)) {
    const snake = name.toLowerCase();
    const row = lines.find((line) => line.startsWith(`| ${code} |`) && line.includes(`\`${snake}\``));
    assert.ok(row, `docs/protocol.md has no table row "| ${code} | ... \`${snake}\`"`);
  }
});

test('docs/protocol.md lista os motivos de recusa e os códigos de erro', () => {
  for (const code of [...SERVER_REJECT_REASONS, ...MODE_REJECT_REASONS, ...OTHER_CODES]) {
    assert.ok(lines.some((line) => line.startsWith('| `' + code + '`')), `docs/protocol.md has no table row for \`${code}\``);
  }
});

test('docs/protocol.md cita as versões do protocolo e da simulação', () => {
  assert.match(doc, new RegExp(`\`PROTOCOL_VERSION\` = ${PROTOCOL_VERSION}\\b`));
  assert.match(doc, new RegExp(`\`SIM_VERSION\` = ${SIM_VERSION}\\b`));
});
