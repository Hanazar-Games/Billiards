// Feel reference of each corpus shot. Most shots keep the legacy envelope at
// 14 frame rates (D038). D041 accepted a new feel for the shots below, which
// changed with the draw calibration: their reference is the calibrated sim
// (sim-reference.json, from tools/sim-reference.mjs), with the same margins.
import { readFileSync } from 'node:fs';

/** D041: changing this list needs a new decision. */
export const SIM_REFERENCE_SHOTS = Object.freeze(['long-stun', 'pot-corner', 'pot-side']);

/** @type {{ legacy: Record<string, any>, sim: Record<string, any> } | undefined} */
let files;

/**
 * @param {string} name corpus shot
 * @returns {{ source: 'legado' | 'D041', byFps: Record<string, any> }} metrics by frame rate
 */
export function feelReference(name) {
  files ??= { legacy: read('./legacy-reference.json'), sim: read('./sim-reference.json') };
  const [source, file] = SIM_REFERENCE_SHOTS.includes(name) ? ['D041', files.sim] : ['legado', files.legacy];
  if (!file[name]) throw new Error(`no ${source} feel reference for ${name}`);
  return { source: /** @type {'legado' | 'D041'} */ (source), byFps: file[name] };
}

/** @param {string} file */
function read(file) {
  return JSON.parse(readFileSync(new URL(file, import.meta.url), 'utf8'));
}
