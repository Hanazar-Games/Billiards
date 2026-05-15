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
    this.breakShot = true;
    this.pocketedBalls = []; // all pocketed ball IDs
    this.breakRailContacts = new Set(); // distinct balls contacting rail on break (for 4-ball rule)
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
    // Track distinct object balls hitting a rail during break shot (WPA 4-ball rule)
    if (this.breakShot && ballId !== 0 && ballId !== undefined) {
      this.breakRailContacts.add(ballId);
    }
  }

  _currentTarget() {
    let target = 1;
    while (target <= 9 && this.pocketedBalls.includes(target)) target++;
    return target > 9 ? 9 : target;
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
          message: '开球犯规：白球落袋！对手获得自由球',
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
          message: '开球犯规：没有球被撞到。对手获得自由球',
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
          message: '开球犯规：必须先撞到1号球！',
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
          message: '开球进9号球！你赢了！',
        };
      }

      // Track pocketed balls
      this.trackPocketedBalls(pocketedIds);

      // If nothing pocketed, check WPA 4-ball-to-rail rule before handing over
      if (pocketedIds.length === 0) {
        if (this.breakRailContacts.size < 4 && !this.railContactAfterFirstHit) {
          this.foul = true;
          return {
            nextPlayer: opponent,
            foul: true,
            scratch: false,
            ballInHand: true,
            message: '开球犯规：少于4颗球碰库。对手获得自由球',
            gameOver: false,
          };
        }
        return {
          nextPlayer: opponent,
          foul: false,
          scratch: false,
          message: '开球：没有球进袋。',
          gameOver: false,
        };
      }

      // Legal break with pocketed balls, player continues
      return {
        nextPlayer: this.currentPlayer,
        foul: false,
        scratch: false,
        message: pocketedIds.length > 0 ? '开球有效。继续击球。' : '开球有效。台面开放。',
        gameOver: false,
      };
    }

    // Normal shot (not break)

    // Foul: did not hit the target ball first
    const targetBall = this._currentTarget();
    if (!cueBallPocketed && this.firstBallHit !== null && this.firstBallHit !== targetBall) {
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
      // Track pocketed balls (WPA: object balls pocketed on foul remain pocketed;
      // only the 9-ball is spotted if pocketed on foul).
      this.trackPocketedBalls(pocketedIds.filter(id => id !== 9));
      return {
        nextPlayer: opponent,
        foul: true,
        scratch: this.scratch,
        ballInHand: true,
        message: this.scratch ? '白球落袋！对手获得自由球。' : '犯规！对手获得自由球。',
        gameOver: false,
        respotNineBall: ninePocketedOnFoul,
      };
    }

    // Track pocketed balls (already tracked above if foul; track here for legal shots)
    if (!this.foul) this.trackPocketedBalls(pocketedIds);

    // Check for 9-ball win (9 pocketed on legal shot)
    if (ninePocketed) {
      this.gameOver = true;
      this.winner = this.currentPlayer;
      return {
        gameOver: true,
        winner: this.currentPlayer,
        message: '打进9号球！你赢了！',
      };
    }

    // Determine next player
    const pocketedAny = pocketedIds.length > 0;
    const nextPlayer = pocketedAny ? this.currentPlayer : opponent;
    const message = pocketedAny
      ? `打进 ${pocketedIds.length} 颗球！继续击球。`
      : '没有球进袋。轮到对手。';

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
