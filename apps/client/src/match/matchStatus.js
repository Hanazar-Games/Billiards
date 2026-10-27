/**
 * The legacy getStatus() shape of a match, for the HUD, the AI and the
 * spectator — shared by the local and the online match controllers.
 */
import { currentSeat, eightBallStatus, nineBallStatus } from '@billiards/modes';

/**
 * @param {'8ball' | '9ball' | null} modeId
 * @param {import('@billiards/modes').MatchState | null} match
 */
export function matchStatus(modeId, match) {
  if (!match) return null;
  const m = match.mode;
  const seat = currentSeat(match) ?? m.turn.currentSeat;
  const eight = modeId === '8ball' ? eightBallStatus(m) : null;
  const nine = modeId === '9ball' ? nineBallStatus(m) : null;
  return {
    currentPlayer: seat + 1,
    breakShot: m.breakShot,
    gameOver: m.winnerTeam !== null,
    winner: m.winnerTeam === null ? null : m.winnerTeam + 1,
    ballInHand: m.ballInHand ? { player: m.ballInHand.seat + 1, kitchen: m.ballInHand.zone === 'kitchen' } : null,
    player1Group: eight?.groups[0] ?? null,
    player2Group: eight?.groups[1] ?? null,
    player1Remaining: eight?.remaining[0] ?? 7,
    player2Remaining: eight?.remaining[1] ?? 7,
    targetBall: nine?.targetBall ?? null,
    pocketedCount: m.pocketed.length,
    player1ConsecutiveFouls: m.fouls?.[0] ?? 0,
    player2ConsecutiveFouls: m.fouls?.[1] ?? 0,
    pushOutAvailable: !!m.pushOut?.available,
    pushOutPending: !!m.pushOut?.pending,
  };
}
