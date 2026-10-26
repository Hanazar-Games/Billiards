// The test bot that plays a whole 8-ball match (F4-07): from the table and the match state the
// server sent, it picks a shot with the ghost-ball method. Deterministic (no random numbers), so
// the same table gives the same shot. It is a test helper, not a good player: it aims at the
// straightest pocketable ball, shoots with no spin, and takes the ball in hand behind the target.
// 8-ball only: the groups and the 8 are read from the mode state.
import type { EightBallState, MatchState, TableState } from '@billiards/modes';
import type { ShotRequest } from '@billiards/protocol';
import { getPocketPositions } from '@billiards/sim';
import { getTableProfile } from '@billiards/sim/constants';

interface Point { x: number; z: number }
type Ball = TableState['balls'][number];

export interface ShotHeader { match: MatchState; table: TableState }

/** The break: straight at the head ball, with this power (the sim's maximum is 110). */
const BREAK_POWER = 100;
/** A shot's power is MIN_POWER + POWER_PER_CM · (cue to ghost + target to pocket), up to MAX_POWER. */
const MIN_POWER = 30;
const MAX_POWER = 90;
const POWER_PER_CM = 0.25;
/** With ball in hand, the cue ball goes this many radii behind the target, on the line to the pocket. */
const BEHIND_RADII = 6;
/** A ball closer than this many diameters to a path blocks it; a spot is free when no ball is closer than this many diameters. */
const PATH_CLEARANCE = 1.05;
const SPOT_CLEARANCE = 1.05;
/**
 * The cue ball's center and the ghost ball stay this many radii inside the table's edge: the cushions
 * and their bevel reach about 4 radii from the edge, and a ball that starts there is deflected at once.
 */
const EDGE_RADII = 4.5;
/** The head ball of the rack. */
const HEAD_BALL = 1;
const EIGHT = 8;

const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.z - a.z);
/** The sim shoots along (cos angle, sin angle) in the XZ plane. */
const angleTo = (from: Point, to: Point) => Math.atan2(to.z - from.z, to.x - from.x);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Distance from `p` to the segment `a`–`b`. */
function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const lengthSquared = dx * dx + dz * dz;
  const t = lengthSquared === 0 ? 0 : clamp(((p.x - a.x) * dx + (p.z - a.z) * dz) / lengthSquared, 0, 1);
  return distance(p, { x: a.x + t * dx, z: a.z + t * dz });
}

/** The balls the seat may aim at: its group, the 8 once the group is gone, or any of 1 to 15 but the 8 on an open table. */
function targetsOf(mode: EightBallState, seat: number, inPlay: Ball[]): Ball[] {
  const group = mode.groups[mode.turn.seats[seat].team];
  const own = (id: number) => (group === 'solid' ? id >= 1 && id <= 7 : id >= 9 && id <= 15);
  if (group === null) return inPlay.filter((b) => b.id >= 1 && b.id <= 15 && b.id !== EIGHT);
  const targets = inPlay.filter((b) => own(b.id));
  return targets.length > 0 ? targets : inPlay.filter((b) => b.id === EIGHT);
}

interface Geometry { width: number; depth: number; r: number; pockets: Point[]; inPlay: Ball[] }

/** A cue ball or ghost ball center can be at `p`: clear of the cushions. */
const onTable = (g: Geometry, p: Point) => Math.abs(p.x) <= g.width / 2 - EDGE_RADII * g.r && Math.abs(p.z) <= g.depth / 2 - EDGE_RADII * g.r;

/** No ball but `except` (and the cue ball) has its center within SPOT_CLEARANCE diameters of `p`. */
function isFree(g: Geometry, p: Point, except: number[] = []): boolean {
  return onTable(g, p) && g.inPlay.every((b) => b.id === 0 || except.includes(b.id) || distance(b, p) >= 2 * g.r * SPOT_CLEARANCE);
}

/** No ball but `except` and the cue ball has its center within PATH_CLEARANCE diameters of the segment. */
function isClear(g: Geometry, from: Point, to: Point, except: number[]): boolean {
  return g.inPlay.every((b) => b.id === 0 || except.includes(b.id) || distanceToSegment(b, from, to) >= 2 * g.r * PATH_CLEARANCE);
}

interface Aim { ghost: Point; target: Ball; pocket: Point; clear: boolean; cut: number }

/** The ghost-ball aim of every ball–pocket pair from `cue`; shots that cannot pot (a cut of 90° or more, a ghost off the table) are left out. */
function aimsFrom(g: Geometry, cue: Point, targets: Ball[]): Aim[] {
  const aims: Aim[] = [];
  for (const target of targets) {
    for (const pocket of g.pockets) {
      const toPocket = distance(target, pocket);
      const ghost = { x: target.x - (2 * g.r * (pocket.x - target.x)) / toPocket, z: target.z - (2 * g.r * (pocket.z - target.z)) / toPocket };
      const toGhost = distance(cue, ghost);
      if (toGhost < 1e-6 || !onTable(g, ghost)) continue;
      const cos = ((ghost.x - cue.x) * (pocket.x - target.x) + (ghost.z - cue.z) * (pocket.z - target.z)) / (toGhost * toPocket);
      if (cos <= 0.05) continue;
      const clear = isClear(g, cue, ghost, [target.id]) && isClear(g, target, pocket, [target.id]);
      aims.push({ ghost, target, pocket, clear, cut: Math.acos(Math.min(1, cos)) });
    }
  }
  return aims;
}

/** The aim with a clear path and the smallest cut; with none clear, the smallest cut. */
function bestAim(aims: Aim[]): Aim | null {
  let best: Aim | null = null;
  for (const aim of aims) {
    if (!best || (aim.clear && !best.clear) || (aim.clear === best.clear && aim.cut < best.cut)) best = aim;
  }
  return best;
}

function shotAt(cue: Point, aim: Aim): ShotRequest {
  const power = clamp(MIN_POWER + POWER_PER_CM * (distance(cue, aim.ghost) + distance(aim.target, aim.pocket)), MIN_POWER, MAX_POWER);
  return { angle: angleTo(cue, aim.ghost), power, spin: { x: 0, y: 0 } };
}

/**
 * With no pot to aim at (a ball in a pocket's mouth or against a cushion has no ghost ball the cue
 * can reach): straight at the center of the nearest target with a clear path, or else the nearest.
 * It is a legal first hit, and it moves the ball.
 */
function straightAt(g: Geometry, cue: Point, targets: Ball[]): ShotRequest {
  let best: { target: Ball; clear: boolean } | null = null;
  for (const target of targets) {
    const clear = isClear(g, cue, target, [target.id]);
    if (!best || (clear && !best.clear) || (clear === best.clear && distance(cue, target) < distance(cue, best.target))) best = { target, clear };
  }
  if (!best) return { angle: 0, power: MIN_POWER, spin: { x: 0, y: 0 } };
  const power = clamp(MIN_POWER + POWER_PER_CM * distance(cue, best.target), MIN_POWER, MAX_POWER);
  return { angle: angleTo(cue, best.target), power, spin: { x: 0, y: 0 } };
}

/**
 * The spot behind the head string for a kitchen ball in hand: the head mark, or the nearest free
 * spot below it. z is rounded down to the 0.01 cm the server quantizes to, so the quantized value
 * does not cross the string (-depth / 2 · 0.55 is -69.85000000000001, which rounds to -69.85).
 */
function kitchenSpot(g: Geometry): Point {
  const headZ = Math.floor((-g.depth / 2) * 0.55 * 100) / 100;
  for (const back of [0, 4, 8, 12, 16]) {
    for (const side of [0, 1, -1, 2, -2, 3, -3, 4, -4]) {
      const spot = { x: side * 3 * g.r, z: headZ - back * g.r };
      if (isFree(g, spot)) return spot;
    }
  }
  return { x: 0, z: headZ };
}

/** With ball in hand anywhere: behind the target on the line to the pocket, for the shortest pot; null if no such spot is free. */
function spotBehindTarget(g: Geometry, targets: Ball[]): { spot: Point; aim: Aim } | null {
  let best: { spot: Point; aim: Aim; length: number } | null = null;
  for (const target of targets) {
    for (const pocket of g.pockets) {
      const length = distance(target, pocket);
      const ux = (pocket.x - target.x) / length;
      const uz = (pocket.z - target.z) / length;
      const ghost = { x: target.x - 2 * g.r * ux, z: target.z - 2 * g.r * uz };
      // Rounded to the 0.01 cm the server quantizes to, so the spot checked is the spot played.
      const spot = {
        x: Math.round((target.x - BEHIND_RADII * g.r * ux) * 100) / 100,
        z: Math.round((target.z - BEHIND_RADII * g.r * uz) * 100) / 100,
      };
      if (!isFree(g, spot, [target.id]) || !onTable(g, ghost)) continue;
      if (!isClear(g, spot, ghost, [target.id]) || !isClear(g, target, pocket, [target.id])) continue;
      if (!best || length < best.length) best = { spot, aim: { ghost, target, pocket, clear: true, cut: 0 }, length };
    }
  }
  return best;
}

/**
 * The shot for `seat` on the match and table the server sent (a snapshot's or a shot_result's
 * `match` and `table`): the break at the head ball, then a pot at the straightest ball–pocket pair
 * of the seat's balls (any ball but the 8 on an open table, the 8 once the group is gone). With
 * ball in hand the shot carries the cue ball's spot: behind the target for `anywhere`, behind the
 * head string for `kitchen`. A seat with no pot to aim at hits the nearest target straight on.
 */
export function chooseShot(header: ShotHeader, seat: number): ShotRequest {
  const mode = header.match.mode as EightBallState;
  const { width, depth, ballRadius } = mode.config.table;
  const profile = getTableProfile(header.table.tableProfileId);
  const geometry: Geometry = {
    width, depth, r: ballRadius,
    pockets: getPocketPositions(profile).map((p: { x: number; z: number }) => ({ x: p.x, z: p.z })),
    inPlay: header.table.balls.filter((b) => !b.pocketed),
  };
  const hand = mode.ballInHand !== null && mode.ballInHand.seat === seat ? mode.ballInHand : null;
  const cueBall = geometry.inPlay.find((b) => b.id === 0);
  const targets = mode.breakShot
    ? geometry.inPlay.filter((b) => b.id === HEAD_BALL)
    : targetsOf(mode, seat, geometry.inPlay);

  // The cue ball goes where it lies, unless the seat has it in hand (or it is off the table).
  let cue: Point | undefined = hand || !cueBall ? undefined : cueBall;
  let placed: Point | undefined;
  if (!cue) {
    const behind = !mode.breakShot && hand?.zone === 'anywhere' ? spotBehindTarget(geometry, targets) : null;
    if (behind) {
      placed = behind.spot;
      return { ...shotAt(behind.spot, behind.aim), cueBall: { x: placed.x, z: placed.z } };
    }
    placed = kitchenSpot(geometry);
    cue = placed;
  }

  let shot: ShotRequest;
  if (mode.breakShot) {
    shot = { angle: angleTo(cue, targets[0]), power: BREAK_POWER, spin: { x: 0, y: 0 } };
  } else {
    const aim = bestAim(aimsFrom(geometry, cue, targets));
    shot = aim ? shotAt(cue, aim) : straightAt(geometry, cue, targets);
  }
  return placed ? { ...shot, cueBall: { x: placed.x, z: placed.z } } : shot;
}
