// Binary shot trajectory, version 1 (spec §6.1). Little-endian:
//   header:    u8 version, u8 sampleRate, u16 frameCount
//   per frame: u8 movingCount
//   per ball:  u8 id, i16 x, i16 z (hundredths of a cm),
//              u8 index of the largest quaternion component,
//              3 × i16 the other three components ("smallest three")
// Frame i is at t = (i + 1) / sampleRate. Out-of-range values throw instead
// of wrapping silently.

export const TRAJECTORY_VERSION = 1;
export const SAMPLE_RATE = 30;

export interface TrajectoryBall {
  id: number;
  x: number;
  z: number;
  q: [number, number, number, number];
}

export interface TrajectoryFrame {
  t: number;
  balls: TrajectoryBall[];
}

const HEADER_BYTES = 4;
const BALL_BYTES = 12;
const MAX_POSITION = 327.67;
const POSITION_SCALE = 100;
// Components other than the largest lie in [-1/√2, 1/√2] for a unit quaternion.
const QUAT_SCALE = 32767 * Math.SQRT2;
const T_TOLERANCE = 1e-9;

export function encodeTrajectory(frames: TrajectoryFrame[]): Uint8Array {
  if (frames.length > 0xffff) throw new RangeError(`too many frames: ${frames.length}`);
  let size = HEADER_BYTES + frames.length;
  frames.forEach((frame, i) => {
    const expected = (i + 1) / SAMPLE_RATE;
    if (!(Math.abs(frame.t - expected) <= T_TOLERANCE)) {
      throw new RangeError(`frame ${i} t must be ${expected}: ${frame.t}`);
    }
    if (frame.balls.length > 0xff) throw new RangeError(`frame ${i} has too many balls: ${frame.balls.length}`);
    size += frame.balls.length * BALL_BYTES;
  });

  const bytes = new Uint8Array(size);
  const view = new DataView(bytes.buffer);
  view.setUint8(0, TRAJECTORY_VERSION);
  view.setUint8(1, SAMPLE_RATE);
  view.setUint16(2, frames.length, true);
  let at = HEADER_BYTES;
  for (const frame of frames) {
    view.setUint8(at, frame.balls.length);
    at += 1;
    for (const ball of frame.balls) {
      writeBall(view, at, ball);
      at += BALL_BYTES;
    }
  }
  return bytes;
}

export function decodeTrajectory(bytes: Uint8Array): TrajectoryFrame[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  need(view, 0, HEADER_BYTES);
  const version = view.getUint8(0);
  if (version !== TRAJECTORY_VERSION) throw new Error(`unsupported trajectory version: ${version}`);
  const sampleRate = view.getUint8(1);
  if (sampleRate !== SAMPLE_RATE) throw new Error(`unsupported trajectory sample rate: ${sampleRate}`);
  const frameCount = view.getUint16(2, true);

  const frames: TrajectoryFrame[] = [];
  let at = HEADER_BYTES;
  for (let i = 0; i < frameCount; i++) {
    need(view, at, 1);
    const count = view.getUint8(at);
    at += 1;
    need(view, at, count * BALL_BYTES);
    const balls: TrajectoryBall[] = [];
    for (let j = 0; j < count; j++) {
      balls.push(readBall(view, at));
      at += BALL_BYTES;
    }
    frames.push({ t: (i + 1) / SAMPLE_RATE, balls });
  }
  if (at !== view.byteLength) throw new RangeError(`trailing bytes after trajectory: ${view.byteLength - at}`);
  return frames;
}

function writeBall(view: DataView, at: number, ball: TrajectoryBall): void {
  if (!(Number.isInteger(ball.id) && ball.id >= 0 && ball.id <= 0xff)) {
    throw new RangeError(`ball id must be an integer in 0..255: ${ball.id}`);
  }
  for (const [name, value] of [['x', ball.x], ['z', ball.z]] as const) {
    if (!(Math.abs(value) <= MAX_POSITION)) {
      throw new RangeError(`ball ${ball.id} ${name} must be within ±${MAX_POSITION} cm: ${value}`);
    }
  }
  const [qx, qy, qz, qw] = ball.q;
  const norm = Math.hypot(qx, qy, qz, qw);
  if (!(Number.isFinite(norm) && norm > 0)) throw new RangeError(`ball ${ball.id} q must be a finite non-zero quaternion`);
  const q = [qx / norm, qy / norm, qz / norm, qw / norm];

  let largest = 0;
  for (let k = 1; k < 4; k++) if (Math.abs(q[k]) > Math.abs(q[largest])) largest = k;
  // q and -q are the same rotation: keep the largest component positive.
  const sign = q[largest] < 0 ? -1 : 1;

  view.setUint8(at, ball.id);
  view.setInt16(at + 1, Math.round(ball.x * POSITION_SCALE), true);
  view.setInt16(at + 3, Math.round(ball.z * POSITION_SCALE), true);
  view.setUint8(at + 5, largest);
  let offset = at + 6;
  for (let k = 0; k < 4; k++) {
    if (k === largest) continue;
    const v = Math.round(sign * q[k] * QUAT_SCALE);
    view.setInt16(offset, Math.max(-32767, Math.min(32767, v)), true);
    offset += 2;
  }
}

function readBall(view: DataView, at: number): TrajectoryBall {
  const id = view.getUint8(at);
  const x = view.getInt16(at + 1, true) / POSITION_SCALE;
  const z = view.getInt16(at + 3, true) / POSITION_SCALE;
  const largest = view.getUint8(at + 5);
  if (largest > 3) throw new RangeError(`ball ${id} has an invalid quaternion index: ${largest}`);
  const q: [number, number, number, number] = [0, 0, 0, 0];
  let offset = at + 6;
  let sumSq = 0;
  for (let k = 0; k < 4; k++) {
    if (k === largest) continue;
    q[k] = view.getInt16(offset, true) / QUAT_SCALE;
    sumSq += q[k] * q[k];
    offset += 2;
  }
  q[largest] = Math.sqrt(Math.max(0, 1 - sumSq));
  return { id, x, z, q };
}

function need(view: DataView, at: number, length: number): void {
  if (at + length > view.byteLength) {
    throw new RangeError(`truncated trajectory: needs ${at + length} bytes, has ${view.byteLength}`);
  }
}
