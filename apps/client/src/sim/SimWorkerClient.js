// Main-thread side of the simulation worker: one request in, one decoded
// result out. The worker is created on the first warm()/simulate() and replaced
// if it dies.
import { decodeTrajectory } from '@billiards/protocol';

/**
 * @typedef {{
 *   frames: import('@billiards/protocol').TrajectoryFrame[],
 *   events: import('@billiards/sim').SimEvent[],
 *   final: import('@billiards/sim').TableState,
 *   steps: number,
 *   simSeconds: number,
 *   capped: boolean
 * }} SimResult
 */

export class SimWorkerClient {
  constructor(createWorker = () => new Worker(new URL('./sim.worker.js', import.meta.url), { type: 'module' })) {
    this._createWorker = createWorker;
    this._worker = null;
    this._pending = new Map();
    this._nextId = 0;
  }

  /** Starts the worker now, so the first shot does not pay for loading it. */
  warm() {
    this._ensureWorker();
  }

  /**
   * @param {import('@billiards/sim').TableState} table
   * @param {import('@billiards/sim').ShotInput} shot
   * @returns {Promise<SimResult>}
   */
  simulate(table, shot) {
    return new Promise((resolve, reject) => {
      const worker = this._ensureWorker();
      const id = this._nextId++;
      this._pending.set(id, { resolve, reject });
      worker.postMessage({ id, table, shot });
    });
  }

  /** Rejects whatever is pending and shuts the worker down. */
  dispose() {
    this._drop(new Error('SimWorkerClient disposed'));
  }

  _ensureWorker() {
    if (this._worker) return this._worker;
    const worker = this._createWorker();
    worker.addEventListener('message', (e) => {
      if (worker === this._worker) this._onReply(e.data);
    });
    const fail = (e) => {
      if (worker === this._worker) this._drop(new Error(`sim worker failed: ${e.message || 'unknown error'}`));
    };
    worker.addEventListener('error', fail);
    worker.addEventListener('messageerror', fail);
    this._worker = worker;
    return worker;
  }

  _onReply(reply) {
    const request = this._pending.get(reply.id);
    if (!request) return;
    this._pending.delete(reply.id);
    if (!reply.ok) {
      request.reject(new Error(reply.error));
      return;
    }
    try {
      const { trajectory, events, final, steps, simSeconds, capped } = reply;
      request.resolve({ frames: decodeTrajectory(trajectory), events, final, steps, simSeconds, capped });
    } catch (err) {
      request.reject(err);
    }
  }

  // Forgets the worker (the next simulate() builds a new one) and rejects the
  // requests nobody will answer now.
  _drop(error) {
    const worker = this._worker;
    this._worker = null;
    const pending = [...this._pending.values()];
    this._pending.clear();
    if (worker) worker.terminate();
    for (const request of pending) request.reject(error);
  }
}

/** The instance the app shares. It creates its worker lazily. */
export const simClient = new SimWorkerClient();
