// What the rules need from a shot, read from the sim's events exactly as the
// F1-B Game fed the legacy rules: the cue ball's first object ball, whether a
// cushion contact came after it, the distinct object balls that touched a
// cushion (the break's four-ball rule) and the pocketed balls in order.
import type { SimEvent } from './types.ts';

export interface ShotFacts {
  firstHit: number | null;
  railAfterFirstHit: boolean;
  breakRailBalls: number[];
  /** Object balls, without the cue ball, each once, in pocket order. */
  pocketed: number[];
  cuePocketed: boolean;
}

export function shotFacts(events: SimEvent[]): ShotFacts {
  const facts: ShotFacts = { firstHit: null, railAfterFirstHit: false, breakRailBalls: [], pocketed: [], cuePocketed: false };
  for (const e of events) {
    if (e.type === 'first_contact') {
      if (facts.firstHit === null && e.ball !== 0) facts.firstHit = e.ball;
    } else if (e.type === 'ball_cushion') {
      if (facts.firstHit !== null) facts.railAfterFirstHit = true;
      if (e.ball !== 0 && !facts.breakRailBalls.includes(e.ball)) facts.breakRailBalls.push(e.ball);
    } else if (e.type === 'pocket') {
      if (e.ball === 0) facts.cuePocketed = true;
      else if (!facts.pocketed.includes(e.ball)) facts.pocketed.push(e.ball);
    }
  }
  return facts;
}
