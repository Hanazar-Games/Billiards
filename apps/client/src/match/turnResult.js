/**
 * Ruling (packages/modes) → the result object Game.resolveTurn consumed from
 * the legacy rules, so the interface flow after a shot stays as it was.
 */
import { rulingText } from './rulingText.js';

/** Codes the legacy rules reported as reasonCode ahead of the foul itself. */
const OUTCOME_CODES = new Set([
  'EIGHT_ON_BREAK_RESPOT', 'EARLY_EIGHT', 'LEGAL_EIGHT_WIN', 'NINE_ON_BREAK_WIN', 'NINE_ON_FOUL_RESPOT', 'LEGAL_NINE_WIN', 'THREE_FOUL_LOSS',
]);

/**
 * @param {'8ball' | '9ball'} modeId
 * @param {import('@billiards/modes').Ruling<any>} ruling
 * @param {{ currentPlayer: number, pushOutPending?: boolean } | null} status the controller status after the ruling
 * @param {[string, string]} names
 */
export function toTurnResult(modeId, ruling, status, names) {
  const outcome = ruling.messages.find((m) => OUTCOME_CODES.has(m.code))?.code;
  return {
    nextPlayer: ruling.nextSeat === null ? status?.currentPlayer ?? 1 : ruling.nextSeat + 1,
    foul: ruling.fouls.length > 0,
    scratch: ruling.fouls.includes('SCRATCH'),
    ballInHand: !!ruling.ballInHand,
    ballInHandBehindLine: ruling.ballInHand?.zone === 'kitchen',
    message: rulingText(modeId, ruling.messages, names),
    gameOver: ruling.winnerTeam !== null,
    winner: ruling.winnerTeam === null ? null : ruling.winnerTeam + 1,
    respotEightBall: ruling.respot.includes(8),
    respotNineBall: ruling.respot.includes(9),
    pushOutPending: !!status?.pushOutPending,
    reasonCode: outcome ?? ruling.fouls[0],
  };
}
