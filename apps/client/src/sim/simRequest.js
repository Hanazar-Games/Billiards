// One simulation request, the part of the worker that does not depend on the
// worker globals so it can run (and be tested) anywhere.
import { simulateShot } from '@billiards/sim';
import { encodeTrajectory } from '@billiards/protocol';

/**
 * Runs the shot with the default tuning and packs the trajectory into bytes.
 * `transfer` lists what the caller should hand over to postMessage.
 * @param {{ id: number, table: object, shot: object }} request
 * @returns {{ reply: object, transfer: ArrayBuffer[] }}
 */
export function handleSimRequest({ id, table, shot }) {
  try {
    const { frames, events, final, steps, simSeconds, capped } = simulateShot(table, shot);
    const trajectory = encodeTrajectory(frames);
    return {
      reply: { id, ok: true, trajectory, events, final, steps, simSeconds, capped },
      transfer: [trajectory.buffer]
    };
  } catch (err) {
    return { reply: { id, ok: false, error: err instanceof Error ? err.message : String(err) }, transfer: [] };
  }
}
