// Type-level checks: `npm run typecheck` includes this file (tsconfig.json) and
// fails if an @ts-expect-error below stops being an error. No Node imports, so
// tsc needs no @types/node.
import type { MatchFormat, ModeStateBase, Ruling } from '../src/index.ts';

const state = {} as ModeStateBase;

// @ts-expect-error a Ruling must list the balls to respot
export const noRespot: Ruling<ModeStateBase> = { state, fouls: [], ballInHand: null, nextSeat: 0, eliminatedSeats: [], winnerTeam: null, messages: [] };

// @ts-expect-error only 1v1, 2v2 and ffa exist
export const threeOnThree: MatchFormat = { kind: '3v3' };

export const ok: Ruling<ModeStateBase> = { state, fouls: [], ballInHand: null, nextSeat: 0, eliminatedSeats: [], winnerTeam: null, respot: [], messages: [] };
