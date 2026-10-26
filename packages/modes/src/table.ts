// Authoritative table operations (spec §6, §7.2): rack the table, place the cue
// ball (ball in hand), respot balls and check a ball-in-hand placement. Pure
// functions over plain JSON; the server runs them in the Nakama runtime (goja,
// ES2017), so nothing here uses a newer library function.
import type { BallPlacement, TableGeometry, TableState } from './types.ts';

/** The table of a fresh rack: every ball of `layout` in play, in id order. */
export function rackTable(layout: BallPlacement[], tableProfileId: string): TableState {
  const balls = layout.map((p) => ({ id: p.id, x: p.x, z: p.z, pocketed: false }));
  balls.sort((a, b) => a.id - b.id);
  return { tableProfileId, balls };
}

/** The table with the cue ball at `cueBall` and back in play (ball in hand); other fields of each ball stay. */
export function placeCueBall<T extends TableState>(table: T, cueBall: { x: number; z: number }): T {
  return { ...table, balls: table.balls.map((b) => (b.id === 0 ? { ...b, x: cueBall.x, z: cueBall.z, pocketed: false } : b)) };
}

/**
 * Puts the pocketed balls of `ids` back on the foot spot, one after the other
 * (Game._respotBall, shared by 8-ball and 9-ball). A ball that is not pocketed
 * stays. If another ball in play is within 2.2 R of the spot, the ball goes to
 * the first free x = +k · 2R, then −k · 2R (k from 1 to 10), or stays at x = 0
 * when none is free. A ball respotted earlier blocks the next one.
 */
export function respotBalls<T extends TableState>(table: T, ids: number[], geometry: TableGeometry): T {
  const r = geometry.ballRadius;
  const footZ = geometry.depth / 2 * 0.55;
  const clearance = r * 2.2;
  const balls = table.balls.slice();
  for (const id of ids) {
    const index = balls.findIndex((b) => b.id === id);
    if (index < 0 || !balls[index].pocketed) continue;
    const isClear = (x: number): boolean => balls.every((b) => {
      if (b.id === id || b.pocketed) return true;
      const dx = b.x - x;
      const dz = b.z - footZ;
      return dx * dx + dz * dz >= clearance * clearance;
    });
    let x = 0;
    if (!isClear(0)) {
      for (let k = 1; k <= 10; k++) {
        if (isClear(k * r * 2)) { x = k * r * 2; break; }
        if (isClear(-k * r * 2)) { x = -k * r * 2; break; }
      }
    }
    balls[index] = { ...balls[index], x, z: footZ, pocketed: false };
  }
  return { ...table, balls };
}

/**
 * Whether the cue ball may be placed at `cueBall` with ball in hand: its center
 * is inside the rails (R from each edge) and at least 2R from every other ball
 * in play. The cue ball's own current position is ignored.
 */
export function isCueBallPlacementValid(table: TableState, cueBall: { x: number; z: number }, geometry: TableGeometry): boolean {
  const r = geometry.ballRadius;
  if (!(Math.abs(cueBall.x) <= geometry.width / 2 - r && Math.abs(cueBall.z) <= geometry.depth / 2 - r)) return false;
  return table.balls.every((b) => b.id === 0 || b.pocketed || Math.hypot(b.x - cueBall.x, b.z - cueBall.z) >= 2 * r - 1e-9);
}
