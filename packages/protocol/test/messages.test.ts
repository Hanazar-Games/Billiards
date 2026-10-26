// Match messages and shot quantization (D055). Runs in the Nakama runtime (goja) too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PROTOCOL_VERSION, SIM_VERSION, OP, SERVER_REJECT_REASONS, MAX_ABS_NUMBER,
  parseShotRequest, parseAimUpdate, parseBallInHandMove, parsePushOutChoice, quantizeShot,
} from '../src/index.ts';

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const SPIN0 = { x: 0, y: 0 };

test('versões e operações do protocolo v1', () => {
  assert.equal(PROTOCOL_VERSION, 1);
  assert.equal(SIM_VERSION, 1);
  assert.ok(Object.isFrozen(OP));
  assert.deepEqual({ ...OP }, {
    AIM_UPDATE: 1, SHOT_REQUEST: 2, BALL_IN_HAND_MOVE: 3, EMOTE: 4, CONCEDE: 5, REMATCH_VOTE: 6, PUSH_OUT_CHOICE: 7,
    MATCH_SNAPSHOT: 101, AIM_RELAY: 102, SHOT_ACCEPTED: 103, SHOT_REJECTED: 104, SHOT_RESULT: 105,
    SEAT_UPDATE: 106, MATCH_END: 107, ERROR: 108, BALL_IN_HAND_RELAY: 109,
  });
  assert.equal(new Set(Object.values(OP)).size, Object.keys(OP).length);
  assert.deepEqual([...SERVER_REJECT_REASONS], ['BAD_MESSAGE', 'NOT_AWAITING_SHOT', 'TURN_MISMATCH', 'NO_CHOICE_PENDING', 'CUE_BALL_INVALID']);
  assert.equal(MAX_ABS_NUMBER, 1e6);
});

test('shot_request válido volta só com os campos conhecidos', () => {
  assert.deepEqual(parseShotRequest({ turnId: 3, seq: 7, angle: 1, power: 50, spin: { x: 0, y: 0.5 }, extra: 1 }),
    { turnId: 3, seq: 7, angle: 1, power: 50, spin: { x: 0, y: 0.5 } });
  assert.deepEqual(parseShotRequest({ turnId: 0, seq: 2147483647, angle: -3, power: 0, spin: { x: -1, y: 0, z: 9 },
    cueBall: { x: 1, z: -2, y: 5 }, pushOut: true }),
  { turnId: 0, seq: 2147483647, angle: -3, power: 0, spin: { x: -1, y: 0 }, cueBall: { x: 1, z: -2 }, pushOut: true });
});

test('shot_request devolve um objeto novo, sem aliasing com a entrada', () => {
  const raw = { turnId: 1, seq: 1, angle: 0, power: 1, spin: { x: 0, y: 0 }, cueBall: { x: 1, z: 2 } };
  const parsed = parseShotRequest(raw)!;
  assert.notEqual(parsed, raw);
  assert.notEqual(parsed.spin, raw.spin);
  assert.notEqual(parsed.cueBall, raw.cueBall);
});

test('números não finitos e inteiros inválidos dão null', () => {
  const ok = { turnId: 0, seq: 0, angle: 0, power: 1, spin: SPIN0 };
  for (const bad of [JSON.parse('{"turnId":0,"seq":0,"angle":1e999,"power":1,"spin":{"x":0,"y":0}}'),
    { turnId: -1, seq: 0, angle: 0, power: 1, spin: SPIN0 }, { turnId: 1.5, seq: 0, angle: 0, power: 1, spin: SPIN0 },
    { turnId: 0, seq: 0, angle: '1', power: 1, spin: SPIN0 }, { turnId: 0, seq: 0, angle: 0, power: 1, spin: null }, null, 'x',
    undefined, 7, [], [ok],
    { ...ok, turnId: 2147483648 }, { ...ok, seq: 2 ** 31 }, { ...ok, seq: -1 }, { ...ok, seq: 0.5 }, { ...ok, turnId: '1' },
    { ...ok, turnId: undefined }, { ...ok, seq: undefined }, { ...ok, power: NaN }, { ...ok, power: Infinity },
    { ...ok, angle: undefined }, { ...ok, spin: { x: 0 } }, { ...ok, spin: { x: 0, y: NaN } }, { ...ok, spin: [0, 0] },
    { ...ok, cueBall: { x: 1 } }, { ...ok, cueBall: { x: 1, z: Infinity } }, { ...ok, cueBall: null }, { ...ok, cueBall: 'x' },
    { ...ok, pushOut: 1 }, { ...ok, pushOut: 'true' }, { ...ok, pushOut: null }]) {
    assert.equal(parseShotRequest(bad), null, JSON.stringify(bad));
  }
  assert.deepEqual(parseShotRequest(ok), ok);
  assert.deepEqual(parseShotRequest({ ...ok, cueBall: undefined, pushOut: undefined }), ok);
});

test('valores finitos acima de 1e6 dão null em todo campo numérico, e 1e6 ainda passa', () => {
  const shot = (patch: (m: any, v: number) => void, v: number) => {
    const m = { turnId: 1, seq: 1, angle: 0, power: 1, spin: { x: 0, y: 0 }, cueBall: { x: 1, z: 2 } };
    patch(m, v);
    return m;
  };
  const aim = (patch: (m: any, v: number) => void, v: number) => {
    const m = { turnId: 1, angle: 0, spin: { x: 0, y: 0 }, power: 1 };
    patch(m, v);
    return m;
  };
  const hand = (patch: (m: any, v: number) => void, v: number) => {
    const m = { turnId: 1, x: 0, z: 0 };
    patch(m, v);
    return m;
  };
  const cases: [string, (raw: unknown) => unknown, typeof shot, ((m: any, v: number) => void)[]][] = [
    ['shot_request', parseShotRequest, shot, [(m, v) => { m.angle = v; }, (m, v) => { m.power = v; }, (m, v) => { m.spin.x = v; },
      (m, v) => { m.spin.y = v; }, (m, v) => { m.cueBall.x = v; }, (m, v) => { m.cueBall.z = v; }]],
    ['aim_update', parseAimUpdate, aim, [(m, v) => { m.angle = v; }, (m, v) => { m.power = v; }, (m, v) => { m.spin.x = v; }, (m, v) => { m.spin.y = v; }]],
    ['ball_in_hand_move', parseBallInHandMove, hand, [(m, v) => { m.x = v; }, (m, v) => { m.z = v; }]],
  ];
  for (const [name, parse, build, patches] of cases) {
    patches.forEach((patch, field) => {
      for (const v of [1e7, -1e7, 1e6 + 1, -1e304, 1e306, 1.7e308]) {
        assert.equal(parse(build(patch, v)), null, `${name} field ${field} value ${v}`);
      }
      for (const v of [MAX_ABS_NUMBER, -MAX_ABS_NUMBER]) {
        assert.notEqual(parse(build(patch, v)), null, `${name} field ${field} value ${v}`);
      }
    });
  }
  // turnId and seq are counters with their own bound.
  assert.notEqual(parseShotRequest({ turnId: 2147483647, seq: 2147483647, angle: 0, power: 0, spin: SPIN0 }), null);
});

test('o que os leitores aceitam, a quantização mantém finito', () => {
  const big = MAX_ABS_NUMBER;
  const parsed = parseShotRequest({ turnId: 0, seq: 0, angle: big, power: -big, spin: { x: big, y: -big }, cueBall: { x: -big, z: big } })!;
  assert.ok(parsed);
  const q = quantizeShot(parsed);
  for (const value of [q.angle, q.power, q.cueBall!.x, q.cueBall!.z]) assert.ok(Number.isFinite(value));
  assert.ok(Number.isFinite(q.spin.x) && Number.isFinite(q.spin.y) && Math.hypot(q.spin.x, q.spin.y) <= 1 + 1e-9);
});

test('aim_update, ball_in_hand_move e push_out_choice', () => {
  assert.deepEqual(parseAimUpdate({ turnId: 4, angle: 0.5, spin: { x: 0.1, y: -0.2 }, seat: 1 }),
    { turnId: 4, angle: 0.5, spin: { x: 0.1, y: -0.2 } });
  assert.deepEqual(parseAimUpdate({ turnId: 4, angle: 0.5, spin: { x: 0.1, y: -0.2 }, power: 33 }),
    { turnId: 4, angle: 0.5, spin: { x: 0.1, y: -0.2 }, power: 33 });
  for (const bad of [{ turnId: 4, angle: 0.5 }, { turnId: 4, angle: 0.5, spin: { x: 0, y: 0 }, power: 'x' },
    { turnId: 4, angle: 0.5, spin: { x: 0, y: 0 }, power: NaN }, { turnId: 4.5, angle: 0, spin: SPIN0 },
    { turnId: 4, angle: Infinity, spin: SPIN0 }, { turnId: 4, angle: 0, spin: { x: 'a', y: 0 } }, null, 3]) {
    assert.equal(parseAimUpdate(bad), null, JSON.stringify(bad));
  }

  assert.deepEqual(parseBallInHandMove({ turnId: 9, x: -12.5, z: 40, spin: 1 }), { turnId: 9, x: -12.5, z: 40 });
  for (const bad of [{ turnId: 9, x: 1 }, { turnId: 9, x: NaN, z: 0 }, { turnId: -9, x: 0, z: 0 }, { turnId: 9, x: '1', z: 0 }, [], null]) {
    assert.equal(parseBallInHandMove(bad), null, JSON.stringify(bad));
  }

  assert.deepEqual(parsePushOutChoice({ turnId: 2, accept: false, extra: 1 }), { turnId: 2, accept: false });
  assert.deepEqual(parsePushOutChoice({ turnId: 2, accept: true }), { turnId: 2, accept: true });
  for (const bad of [{ turnId: 2 }, { turnId: 2, accept: 1 }, { turnId: 2, accept: 'true' }, { turnId: 1.5, accept: true }, 'x', undefined]) {
    assert.equal(parsePushOutChoice(bad), null, JSON.stringify(bad));
  }
});

/** Every number is finite, and within MAX_ABS_NUMBER unless it is a turnId or seq counter. */
function onlyBoundedNumbers(value: unknown, key = ''): boolean {
  if (typeof value === 'number') {
    return Number.isFinite(value) && (key === 'turnId' || key === 'seq' || Math.abs(value) <= MAX_ABS_NUMBER);
  }
  if (value && typeof value === 'object') return Object.entries(value).every(([k, v]) => onlyBoundedNumbers(v, k));
  return true;
}

test('fuzz: os leitores nunca lançam e só aceitam números finitos', () => {
  const rng = mulberry32(2024);
  const pick = <T>(items: T[]): T => items[Math.floor(rng() * items.length)];
  const junkNumbers = [NaN, Infinity, -Infinity, -0, 0, 1, -1, 0.5, 1e308, -1e308, 2 ** 31, 2 ** 31 - 1, 2 ** 53, 1e-320, 1.5,
    1e6, -1e6, 1e6 + 1, 1e7, 1e304];
  const junk = (depth = 0): unknown => {
    const kind = Math.floor(rng() * (depth < 2 ? 9 : 6));
    switch (kind) {
      case 0: return pick(junkNumbers);
      case 1: return (rng() - 0.5) * 2 * pick([1, 10, 1e6, 1e7, 1e300]);
      case 2: return pick(['', 'NaN', '1e999', '0', 'x', '{}', 'Infinity']);
      case 3: return pick([true, false]);
      case 4: return null;
      case 5: return undefined;
      case 6: return Array.from({ length: Math.floor(rng() * 4) }, () => junk(depth + 1));
      case 7: return { x: junk(depth + 1), y: junk(depth + 1), z: junk(depth + 1) };
      default: return { turnId: junk(depth + 1), seq: junk(depth + 1), nested: junk(depth + 1) };
    }
  };
  // Mostly well-formed fields, sometimes junk, so the accept path is exercised too.
  const field = (valid: () => unknown) => (rng() < 0.75 ? valid() : junk());
  const int = () => Math.floor(rng() * 2 ** 31);
  const real = () => (rng() - 0.5) * 200;
  const vec = (a: string, b: string) => () => ({ [a]: field(real), [b]: field(real), extra: junk() });
  const accepted = { shot: 0, aim: 0, hand: 0, push: 0 };
  for (let i = 0; i < 5000; i++) {
    const raw: Record<string, unknown> = {};
    if (rng() < 0.9) raw.turnId = field(int);
    if (rng() < 0.9) raw.seq = field(int);
    if (rng() < 0.9) raw.angle = field(real);
    if (rng() < 0.9) raw.power = field(real);
    if (rng() < 0.9) raw.spin = field(vec('x', 'y'));
    if (rng() < 0.3) raw.cueBall = field(vec('x', 'z'));
    if (rng() < 0.3) raw.pushOut = field(() => rng() < 0.5);
    if (rng() < 0.9) raw.x = field(real);
    if (rng() < 0.9) raw.z = field(real);
    if (rng() < 0.9) raw.accept = field(() => rng() < 0.5);
    if (rng() < 0.3) raw.extra = junk();
    const input = rng() < 0.05 ? junk() : raw;
    const results: [keyof typeof accepted, unknown][] = [];
    assert.doesNotThrow(() => {
      results.push(['shot', parseShotRequest(input)], ['aim', parseAimUpdate(input)],
        ['hand', parseBallInHandMove(input)], ['push', parsePushOutChoice(input)]);
    }, `input ${i}`);
    for (const [name, result] of results) {
      if (result === null) continue;
      accepted[name]++;
      assert.ok(onlyBoundedNumbers(result), `${name} accepted a non-finite or out-of-bound number`);
      assert.ok(!('extra' in (result as object)), `${name} kept an unknown field`);
      assert.notEqual(result, input);
    }
  }
  for (const [name, count] of Object.entries(accepted)) assert.ok(count > 50, `${name} accepted only ${count} of 5000`);
});

test('quantizeShot arredonda nos passos da D055 e é idempotente', () => {
  const q = quantizeShot({ angle: 0.123456789, power: 50.12345, spin: { x: 0.70710678, y: 0.70710678 }, cueBall: { x: 1.23456, z: -7.891 } });
  assert.deepEqual(q, { angle: 0.12346, power: 50.123, spin: { x: 0.707, y: 0.707 }, cueBall: { x: 1.23, z: -7.89 } });
  assert.deepEqual(quantizeShot(q), q);
});

test('quantizeShot preserva os demais campos, não altera a entrada e troca -0 por 0', () => {
  const input = { angle: -0.000001, power: 1, spin: { x: -0.0001, y: 0 }, pushOut: true, turnId: 5 };
  const frozen = JSON.stringify(input);
  const q = quantizeShot(input);
  assert.equal(JSON.stringify(input), frozen);
  assert.deepEqual(q, { angle: 0, power: 1, spin: { x: 0, y: 0 }, pushOut: true, turnId: 5 });
  for (const value of [q.angle, q.spin.x, q.spin.y]) assert.ok(Object.is(value, 0), 'no negative zero');
  assert.ok(!('cueBall' in quantizeShot({ angle: 0, power: 0, spin: SPIN0 })));
});

test('quantizeShot leva o efeito a comprimento 1 quando o arredondamento passa de 1 + 1e-9', () => {
  const x = 0.7066;
  const spin = { x, y: Math.sqrt(1 - x * x) }; // unit length; both components round up to 0.707 and 0.708
  assert.ok(Math.hypot(Math.round(spin.x * 1000) / 1000, Math.round(spin.y * 1000) / 1000) > 1 + 1e-9);
  const q = quantizeShot({ angle: 0, power: 1, spin });
  assert.deepEqual(q.spin, { x: 0.706, y: 0.707 });
  assert.deepEqual(quantizeShot(q), q);
  assert.deepEqual(quantizeShot({ angle: 0, power: 1, spin: { x: 0.6, y: -0.8 } }).spin, { x: 0.6, y: -0.8 });
  assert.deepEqual(quantizeShot({ angle: 0, power: 1, spin: { x: -1, y: 0 } }).spin, { x: -1, y: 0 });
});

test('o corte em direção a zero tem folga de 1e-6 contra o erro de ponto flutuante', () => {
  // x sits on a multiple of 1e-3 and y rounds up past the unit disc. After scaling to length 1, x / length can come
  // out a hair below the multiple (for 0.009, x / length * 1000 = 8.999999999999998); without the slack the floor would give 0.008.
  for (const x of [0.001, 0.009, 0.047, 0.064]) {
    const y = Math.sqrt(1 - x * x);
    assert.ok(Math.hypot(Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000) > 1 + 1e-9, `x ${x} must trigger the clamp`);
    const length = Math.hypot(x, y);
    assert.notEqual(Math.floor((x / length) * 1000) / 1000, x, `x ${x} must need the slack`);
    for (const sign of [1, -1]) {
      const q = quantizeShot({ angle: 0, power: 1, spin: { x: sign * x, y: -sign * y } });
      assert.deepEqual(q.spin, { x: sign * x, y: -sign * Math.floor((y / length) * 1000) / 1000 }, `x ${sign * x}`);
    }
  }
});

test('o efeito quantizado nunca passa de comprimento 1', () => {
  const rng = mulberry32(99);
  for (let i = 0; i < 2000; i++) {
    const theta = rng() * 2 * Math.PI;
    const length = i % 2 === 0 ? 1 : Math.sqrt(rng());
    const spin = { x: Math.cos(theta) * length, y: Math.sin(theta) * length };
    const q = quantizeShot({ angle: 0, power: 1, spin });
    assert.ok(Math.hypot(q.spin.x, q.spin.y) <= 1 + 1e-9, `spin ${JSON.stringify(spin)} -> ${JSON.stringify(q.spin)}`);
    // 1e-12 is the floating-point error of the subtraction.
    assert.ok(Math.abs(q.spin.x - spin.x) <= 1e-3 + 1e-12 && Math.abs(q.spin.y - spin.y) <= 1e-3 + 1e-12, `spin ${JSON.stringify(spin)}`);
    assert.deepEqual(quantizeShot(q), q);
  }
});
