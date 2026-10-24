// Reference shots, all from the initial 8-ball rack. Ball 1 sits at the rack
// apex (BallsManager._rackEightBall), so it is the object ball nearest the cue.
export const CORPUS = [
  { name: 'break', shot: { aim: { atBall: 1 }, force: 110, spin: { x: 0, y: 0 } } },
  { name: 'medium', shot: { aim: { atBall: 1 }, force: 50, spin: { x: 0, y: 0 } } },
  { name: 'draw', shot: { aim: { atBall: 1 }, force: 60, spin: { x: 0, y: -0.8 } } },
  { name: 'english', shot: { aim: { atBall: 1 }, force: 60, spin: { x: 0.8, y: 0 } } },
  { name: 'soft', shot: { aim: { atBall: 1 }, force: 15, spin: { x: 0, y: 0 } } },
];
