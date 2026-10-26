// The call to the simulation service (D059): POST /simulate with the shared
// secret, LIMITS.simTimeoutMs per attempt and LIMITS.simAttempts attempts. An
// exception (network error or timeout), a status other than 200 or a reply that
// cannot be read is a failed attempt; the last one's error is returned.
import type { SimEvent } from '@billiards/modes';
import { base64ToBytes } from '@billiards/protocol';
import type { ShotRequest } from '@billiards/protocol';
import type { Nakama } from '../nakama.ts';
import { LIMITS } from './state.ts';
import type { GameTable } from './state.ts';

export interface SimRequest { simVersion: number; table: GameTable; shot: ShotRequest }

/** The reply of services/sim, with the trajectory decoded. */
export interface SimReply {
  trajectory: Uint8Array;
  events: SimEvent[];
  final: GameTable;
  steps: number;
  simSeconds: number;
  capped: boolean;
}

export type SimError = 'SIM_TIMEOUT' | 'SIM_HTTP' | 'SIM_BAD_REPLY';

export type SimOutcome = { ok: true; reply: SimReply } | { ok: false; error: SimError };

export function callSim(nk: Nakama, sim: { url: string; secret: string }, request: SimRequest): SimOutcome {
  const headers = { 'Content-Type': 'application/json', 'x-sim-secret': sim.secret };
  const body = JSON.stringify(request);
  let error: SimError = 'SIM_TIMEOUT';
  for (let attempt = 0; attempt < LIMITS.simAttempts; attempt++) {
    let response: { code: number; body: string };
    try {
      response = nk.httpRequest(sim.url + '/simulate', 'post', headers, body, LIMITS.simTimeoutMs);
    } catch {
      error = 'SIM_TIMEOUT';
      continue;
    }
    if (response.code !== 200) {
      error = 'SIM_HTTP';
      continue;
    }
    const reply = readReply(response.body);
    if (reply) return { ok: true, reply };
    error = 'SIM_BAD_REPLY';
  }
  return { ok: false, error };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && isFinite(value) && value >= 0;
}

/** The reply's fields, checked for their shape; null for anything else. */
function readReply(text: string): SimReply | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(raw) || typeof raw.trajectory !== 'string' || !Array.isArray(raw.events) || !isRecord(raw.final)
    || !Array.isArray(raw.final.balls) || !isNumber(raw.steps) || !isNumber(raw.simSeconds) || typeof raw.capped !== 'boolean') {
    return null;
  }
  let trajectory: Uint8Array;
  try {
    trajectory = base64ToBytes(raw.trajectory);
  } catch {
    return null;
  }
  return {
    trajectory,
    events: raw.events as SimEvent[],
    final: raw.final as unknown as GameTable,
    steps: raw.steps,
    simSeconds: raw.simSeconds,
    capped: raw.capped,
  };
}
