// Shared test helpers: synthetic sim events, a seeded PRNG and pool9ft configs.
import type { MatchConfig, Rng, ShotRequest, SimEvent, TableState } from '../src/index.ts';

const STEP = 1 / 360;

/**
 * Sim events in the order the sim emits them for a simple shot: cushions
 * before the first contact, the cue ball's first contact, cushions after it,
 * then the pockets (object balls, then the cue ball).
 */
export function ev({ first = null, cushions = [], pocketed = [], cue = false, cushionsBeforeFirst = [] }: {
  first?: number | null; cushions?: number[]; pocketed?: number[]; cue?: boolean; cushionsBeforeFirst?: number[];
} = {}): SimEvent[] {
  let t = 0;
  const next = () => (t += STEP);
  const out: SimEvent[] = [];
  for (const ball of cushionsBeforeFirst) out.push({ t: next(), type: 'ball_cushion', ball, speed: 50 });
  if (first !== null) {
    const at = next();
    out.push({ t: at, type: 'ball_ball', a: 0, b: first, speed: 100 });
    out.push({ t: at, type: 'first_contact', ball: first });
  }
  for (const ball of cushions) out.push({ t: next(), type: 'ball_cushion', ball, speed: 50 });
  for (const ball of pocketed) out.push({ t: next(), type: 'pocket', ball, pocket: 0 });
  if (cue) out.push({ t: next(), type: 'pocket', ball: 0, pocket: 0 });
  return out;
}

/** Deterministic PRNG in [0, 1). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** pool9ft geometry (apps/client/src/game/TableProfiles.js) and SHOT.maxPower. */
export const config8: MatchConfig = { format: { kind: '1v1' }, table: { width: 127, depth: 254, ballRadius: 2.8575 }, maxPower: 110 };
export const config9: MatchConfig = config8;

/** The rules never read the final table; tests pass this placeholder. */
export const FINAL: TableState = { tableProfileId: 'pool9ft', balls: [] };
export const SHOT: ShotRequest = { angle: 0, power: 50, spin: { x: 0, y: 0 } };
