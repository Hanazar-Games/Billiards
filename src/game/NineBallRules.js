/**
 * NineBallRules — Standard 9-ball rule engine.
 *
 * Rules:
 *  - 9 balls on table (1-9), cue ball is separate
 *  - Balls arranged in a diamond: 1 at apex, 9 in center
 *  - Must hit the lowest-numbered ball first each shot
 *  - Any ball pocketed after legal first hit is legal
 *  - Combination shots are legal (e.g. hit 1, 1 hits 2, 2 drops)
 *  - 9-ball pocketed on any legal shot = win
 *  - Scratch (cue ball pocketed) = foul, opponent gets ball-in-hand
 *  - No rail contact after first hit = foul
 *  - Push-out: player can call "push" to pass the shot
 */
export class NineBallRules {
  constructor() {
    this.reset();
  }

  reset() {
    this.currentPlayer = 1;
    this.gameOver = false;
    this.winner = null;
    this.foul = false;
    this.scratch = false;
    this.firstBallHit = null;
    this.railContactAfterFirstHit = false;
    this.targetBall = 1; // lowest ball on table
    this.breakShot = true;
    this.pocketedBalls = []; // all pocketed ball IDs
    this.breakRailContacts = 0; // balls contacting rail on break (for 4-ball rule)
  }

  startShot(player) {
    this.currentPlayer = player;
    this.foul = false;
    this.scratch = false;
    this.firstBallHit = null;
    this.railContactAfterFirstHit = false;
  }

  recordFirstHit(ballId) {
    if (this.firstBallHit === null && ballId !== 0) {
      this.firstBallHit = ballId;
    }
  }

  recordCushionHit(ballId) {
    if (this.firstBallHit !== null) {
      this.railContactAfterFirstHit = true;
    }
    // Count unique balls hitting a rail during break shot (WPA 4-ball rule)
    if (this.breakShot && ballId !== 0 && ballId !== undefined) {
      // Simple count — a ball may hit rail multiple times, but we just need
      // to know whether at least 4 distinct balls contacted a rail.
      // We approximate by incrementing each cushion hit; on break, any
      // substantial rail contact usually indicates the ball reached the rail.
      this.breakRailContacts++;
    }
  }

  setTargetBall(target) {
    this.targetBall = target;
  }

  trackPocketedBalls(pocketedIds) {
    for (const id of pocketedIds) {
      if (id >= 1 && id <= 9 && !this.pocketedBalls.includes(id)) {
        this.pocketedBalls.push(id);
      }
    }
  }

  resolveShot(pocketedIds, cueBallPocketed) {
    if (this.gameOver) return { gameOver: true, winner: this.winner };

    this.scratch = cueBallPocketed;
    const opponent = this.currentPlayer === 1 ? 2 : 1;

    // Scratch is always a foul
    if (cueBallPocketed) {
      this.foul = true;
    }

    // Check if 9-ball was pocketed
    const ninePocketed = pocketedIds.includes(9);

    // On break shot, special rules apply
    if (this.breakShot) {
      this.breakShot = false;

      // Break foul: scratch or no ball hit
      if (cueBallPocketed) {
        // 9-ball spotted if pocketed on break scratch
        if (pocketedIds.includes(9)) {
          const idx = this.pocketedBalls.indexOf(9);
          if (idx !== -1) this.pocketedBalls.splice(idx, 1);
        }
        this.trackPocketedBalls(pocketedIds.filter(id => id !== 9));
        return {
          nextPlayer: opponent,
          foul: true,
          scratch: true,
          ballInHand: true,
          message: 'Break scratch! Opponent ball-in-hand.',
          gameOver: false,
          respotNineBall: pocketedIds.includes(9),
        };
      }

      if (this.firstBallHit === null) {
        this.foul = true;
        if (pocketedIds.includes(9)) {
          const idx = this.pocketedBalls.indexOf(9);
          if (idx !== -1) this.pocketedBalls.splice(idx, 1);
        }
        this.trackPocketedBalls(pocketedIds.filter(id => id !== 9));
        return {
          nextPlayer: opponent,
          foul: true,
          scratch: false,
          ballInHand: true,
          message: 'Break foul: no ball hit. Opponent ball-in-hand.',
          gameOver: false,
          respotNineBall: pocketedIds.includes(9),
        };
      }

      // Check if first hit was the 1-ball (required on break)
      if (this.firstBallHit !== 1) {
        this.foul = true;
        if (pocketedIds.includes(9)) {
          const idx = this.pocketedBalls.indexOf(9);
          if (idx !== -1) this.pocketedBalls.splice(idx, 1);
        }
        this.trackPocketedBalls(pocketedIds.filter(id => id !== 9));
        return {
          nextPlayer: opponent,
          foul: true,
          scratch: false,
          ballInHand: true,
          message: 'Break: must hit 1-ball first! Foul.',
          gameOver: false,
          respotNineBall: pocketedIds.includes(9),
        };
      }

      // If 9-ball pocketed on break (and no foul), it's a win!
      if (ninePocketed && !this.foul) {
        this.gameOver = true;
        this.winner = this.currentPlayer;
        return {
          gameOver: true,
          winner: this.currentPlayer,
          message: '9-ball on the break! You win!',
        };
      }

      // Track pocketed balls
      this.trackPocketedBalls(pocketedIds);

      // If nothing pocketed and no foul, opponent's turn
      if (pocketedIds.length === 0) {
        return {
          nextPlayer: opponent,
          foul: false,
          scratch: false,
          message: 'Break: no balls pocketed.',
          gameOver: false,
        };
      }

      // Check WPA 4-ball-to-rail rule: if no ball pocketed, at least 4
      // balls must hit a rail (or the cue ball must hit a rail after
      // contacting the 1-ball). We approximate with breakRailContacts >= 4.
      if (pocketedIds.length === 0 && this.breakRailContacts < 4) {
        this.foul = true;
        return {
          nextPlayer: opponent,
          foul: true,
          scratch: false,
          ballInHand: true,
          message: 'Break foul: fewer than 4 balls hit a rail. Opponent ball-in-hand.',
          gameOver: false,
        };
      }

      // Legal break with pocketed balls, player continues
      return {
        nextPlayer: this.currentPlayer,
        foul: false,
        scratch: false,
        message: 'Break: legal. Your turn continues.',
        gameOver: false,
      };
    }

    // Normal shot (not break)

    // Foul: did not hit the target ball first
    if (!cueBallPocketed && this.firstBallHit !== null && this.firstBallHit !== this.targetBall) {
      this.foul = true;
    }

    // Foul: no ball hit at all
    if (!cueBallPocketed && this.firstBallHit === null) {
      this.foul = true;
    }

    // Foul: after a legal first contact, at least one ball must touch a rail
    // unless an object ball was pocketed.
    if (!cueBallPocketed && this.firstBallHit !== null && pocketedIds.length === 0 && !this.railContactAfterFirstHit) {
      this.foul = true;
    }

    // If foul occurred, opponent gets ball-in-hand
    if (this.foul) {
      // 9-ball must be spotted if pocketed on a foul (WPA rule)
      const ninePocketedOnFoul = pocketedIds.includes(9);
      if (ninePocketedOnFoul) {
        const idx = this.pocketedBalls.indexOf(9);
        if (idx !== -1) this.pocketedBalls.splice(idx, 1);
      }
      // On a foul, any pocketed object balls are spotted — do NOT track them.
      // Only track balls pocketed on LEGAL shots.
      return {
        nextPlayer: opponent,
        foul: true,
        scratch: this.scratch,
        ballInHand: true,
        message: this.scratch ? 'Scratch! Opponent ball-in-hand.' : 'Foul! Opponent ball-in-hand.',
        gameOver: false,
        respotNineBall: ninePocketedOnFoul,
      };
    }

    // Track pocketed balls
    this.trackPocketedBalls(pocketedIds);

    // Check for 9-ball win (9 pocketed on legal shot)
    if (ninePocketed) {
      this.gameOver = true;
      this.winner = this.currentPlayer;
      return {
        gameOver: true,
        winner: this.currentPlayer,
        message: '9-ball pocketed! You win!',
      };
    }

    // Determine next player
    const pocketedAny = pocketedIds.length > 0;
    const nextPlayer = pocketedAny ? this.currentPlayer : opponent;
    const message = pocketedAny
      ? `Pocketed ${pocketedIds.length} ball(s)! Your turn continues.`
      : 'No balls pocketed. Opponent\'s turn.';

    return {
      nextPlayer,
      foul: false,
      scratch: false,
      message,
      gameOver: false,
    };
  }

  getStatus() {
    // Find next target ball (lowest not pocketed)
    let nextTarget = 1;
    while (nextTarget <= 9 && this.pocketedBalls.includes(nextTarget)) {
      nextTarget++;
    }
    if (nextTarget > 9) nextTarget = 9;

    return {
      currentPlayer: this.currentPlayer,
      targetBall: nextTarget,
      pocketedCount: this.pocketedBalls.length,
      breakShot: this.breakShot,
      gameOver: this.gameOver,
      winner: this.winner,
    };
  }
}
