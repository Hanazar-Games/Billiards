// Turn order for 1×1, 2×2 and free-for-all (spec §7.2). Seats and teams count
// from 0. 1×1: seat i is team i. 2×2: seats 0..3 are A1, B1, A2, B2 (teams
// 0, 1, 0, 1). ffa: seat i is team i. Every function returns a new state.
import type { MatchFormat, Team, TurnState } from './types.ts';

/** @param firstSeat the seat that plays first (the breaker) */
export function createTurnState(format: MatchFormat, firstSeat = 0): TurnState {
  let count: number;
  let teamOf: (seat: number) => number;
  if (format.kind === '1v1') {
    count = 2;
    teamOf = (seat) => seat;
  } else if (format.kind === '2v2') {
    count = 4;
    teamOf = (seat) => seat % 2;
  } else {
    if (!Number.isInteger(format.seats) || format.seats < 3 || format.seats > 5) {
      throw new RangeError(`ffa takes 3 to 5 seats, got ${format.seats}`);
    }
    count = format.seats;
    teamOf = (seat) => seat;
  }
  if (!Number.isInteger(firstSeat) || firstSeat < 0 || firstSeat >= count) {
    throw new RangeError(`no seat ${firstSeat} in a ${format.kind} match`);
  }
  const seats = Array.from({ length: count }, (_, index) => ({ index, team: teamOf(index), eliminated: false }));
  const teams: Team[] = [];
  for (const seat of seats) {
    const team = teams[seat.team] ??= { index: seat.team, members: [], nextMember: seat.index };
    team.members.push(seat.index);
    if (seat.index === firstSeat) team.nextMember = firstSeat;
  }
  return { seats, teams, currentSeat: firstSeat };
}

/** Teams with at least one seat still playing, in index order. */
export function activeTeams(turn: TurnState): number[] {
  return turn.teams.filter((team) => team.members.some((seat) => isActive(turn, seat))).map((team) => team.index);
}

/** The current team's turn ends; the next team in index order plays its next member. */
export function endTurn(turn: TurnState): TurnState {
  const current = turn.seats[turn.currentSeat].team;
  const teams = turn.teams.map((team) => (team.index === current
    ? { ...team, members: [...team.members], nextMember: nextActiveMember(turn, team, turn.currentSeat) ?? team.nextMember }
    : { ...team, members: [...team.members] }));
  const seats = turn.seats.map((seat) => ({ ...seat }));
  for (let k = 1; k <= teams.length; k++) {
    const team = teams[(current + k) % teams.length];
    const seat = isActive(turn, team.nextMember) ? team.nextMember : nextActiveMember(turn, team, team.nextMember);
    if (seat !== null) return { seats, teams, currentSeat: seat };
  }
  return { seats, teams, currentSeat: turn.currentSeat };
}

/** The seat leaves; on its turn, a partner takes over (§7.4), else the turn passes. */
export function removeSeat(turn: TurnState, seat: number): TurnState {
  if (!turn.seats[seat]) throw new RangeError(`no seat ${seat}`);
  const next: TurnState = {
    seats: turn.seats.map((s) => (s.index === seat ? { ...s, eliminated: true } : { ...s })),
    teams: turn.teams.map((team) => ({ ...team, members: [...team.members] })),
    currentSeat: turn.currentSeat,
  };
  if (seat !== turn.currentSeat) return next;
  const partner = nextActiveMember(next, next.teams[next.seats[seat].team], seat);
  return partner === null ? endTurn(next) : { ...next, currentSeat: partner };
}

function isActive(turn: TurnState, seat: number): boolean {
  return !turn.seats[seat].eliminated;
}

/** The next active member after `after`, cycling through the team; null if none is active. */
function nextActiveMember(turn: TurnState, team: Team, after: number): number | null {
  const start = team.members.indexOf(after);
  for (let k = 1; k <= team.members.length; k++) {
    const seat = team.members[(start + k) % team.members.length];
    if (isActive(turn, seat)) return seat;
  }
  return null;
}
