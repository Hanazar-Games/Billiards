// @ts-check
// Shot events. The log only ever receives events in step order (the step
// counter never goes back), so it is already sorted by t and keeps insertion
// order between events of the same step.

/** @import { SimBall } from './ball.js' */
/** @import { SimEvent } from './types.js' */

const STEPS_PER_SECOND = 360;

/**
 * @returns {{ push: (e: SimEvent) => void, events: SimEvent[] }}
 */
export function createEventLog() {
  /** @type {SimEvent[]} */
  const events = [];
  return {
    push(e) {
      events.push(e);
    },
    events,
  };
}

/**
 * Turns contacts and pockets into events at `t = currentStep() / 360`.
 * `first_contact` goes out with the first `ball_ball` that involves the cue
 * ball.
 *
 * A contact the guards resolve leaves the pair at 0.995 of the contact
 * distance, so cannon reports the same impact again on the next step: a
 * pair's contact one step after the previous one is the same contact and
 * gives no new event.
 * @param {{ push: (e: SimEvent) => void }} log
 * @param {() => number} currentStep
 */
export function createEventRecorder(log, currentStep) {
  let firstContactSeen = false;
  /** @type {Map<number, number>} last contact step by pair key */
  const lastPairStep = new Map();

  return {
    /**
     * @param {SimBall} ballA
     * @param {SimBall} ballB
     * @param {number} speed
     */
    ballContact(ballA, ballB, speed) {
      const step = currentStep();
      const a = Math.min(ballA.id, ballB.id);
      const b = Math.max(ballA.id, ballB.id);
      const key = a * 256 + b;
      const previous = lastPairStep.get(key);
      lastPairStep.set(key, step);
      if (previous !== undefined && step - previous <= 1) return;

      const t = step / STEPS_PER_SECOND;
      log.push({ t, type: 'ball_ball', a, b, speed });
      if (!firstContactSeen && a === 0) {
        firstContactSeen = true;
        log.push({ t, type: 'first_contact', ball: b });
      }
    },

    /**
     * @param {SimBall} ball
     * @param {number} speed
     */
    cushionContact(ball, speed) {
      log.push({ t: currentStep() / STEPS_PER_SECOND, type: 'ball_cushion', ball: ball.id, speed });
    },

    /**
     * @param {number} ball
     * @param {number} pocket index in getPocketPositions
     */
    pocket(ball, pocket) {
      log.push({ t: currentStep() / STEPS_PER_SECOND, type: 'pocket', ball, pocket });
    },
  };
}
