// Public API of @billiards/modes.
import { eightBall } from './eightBall.ts';
import { nineBall } from './nineBall.ts';

export type * from './types.ts';
export * from './turns.ts';
export * from './facts.ts';
export * from './eightBall.ts';
export * from './nineBall.ts';
export * from './match.ts';

/** The modes by id. */
export const MODES = Object.freeze({ '8ball': eightBall, '9ball': nineBall });
