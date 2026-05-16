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
 *  - Three consecutive fouls by same player = loss (optional)
 *  - Push-out: player can call "push" to pass the shot
 */
import { UIText } from '../core/UIText.js';

export class NineBallRules {
  constructor(options = {}) {
    this.options = {
      threeFoulLoss: options.threeFoulLoss ?? true,
    };
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
    this.foulReason = null;
    this.player1ConsecutiveFouls = 0;
    this.player2ConsecutiveFouls = 0;
    this.pushOutAvailable = false;
    this.pushOutDeclared = false;
    this.pushOutPending = false;
    this.pushOutPlayer = null;
  }

  startShot(player) {
    this.currentPlayer = player;
    this.foul = false;
    this.scratch = false;
    this.firstBallHit = null;
    this.railContactAfterFirstHit = false;
    this.foulReason = null;
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

  declarePushOut() {
    if (this.pushOutAvailable && !this.pushOutPending) {
      this.pushOutDeclared = true;
      this.pushOutAvailable = false;
      return true;
    }
    return false;
  }

  acceptPushOut() {
    if (!this.pushOutPending) return null;
    this.pushOutPending = false;
    return { nextPlayer: this.currentPlayer };
  }

  passPushOut() {
    if (!this.pushOutPending) return null;
    this.pushOutPending = false;
    return { nextPlayer: this.pushOutPlayer };
  }

  _applyConsecutiveFouls(result, opponent) {
    if (this.foul) {
      if (this.currentPlayer === 1) this.player1ConsecutiveFouls++;
      else this.player2ConsecutiveFouls++;

      if (!this.options.threeFoulLoss) return result;

      const count = this.currentPlayer === 1 ? this.player1ConsecutiveFouls : this.player2ConsecutiveFouls;

      if (count >= 3) {
        this.gameOver = true;
        this.winner = opponent;
        return {
          gameOver: true,
          winner: opponent,
          foul: true,
          message: UIText.threeFoulLoss(this.currentPlayer === 1 ? '玩家 1' : '玩家 2'),
          reasonCode: 'THREE_FOUL_LOSS',
        };
      }

      if (count === 2) {
        const baseMsg = result.message || '';
        result.message = baseMsg
          ? `${UIText.threeFoulWarning} ${baseMsg}`
          : UIText.threeFoulWarning;
      }
    } else {
      if (this.currentPlayer === 1) this.player1ConsecutiveFouls = 0;
      else this.player2ConsecutiveFouls = 0;
    }

    return result;
  }


  resolveShot(pocketedIds, cueBallPocketed) {
    if (this.gameOver) return { gameOver: true, winner: this.winner };

    const isPushOut = this.pushOutDeclared;
    const opponent = this.currentPlayer === 1 ? 2 : 1;

    // Consume push-out opportunity if not used
    if (this.pushOutAvailable && !this.pushOutDeclared) {
      this.pushOutAvailable = false;
    }
    this.pushOutDeclared = false;

    this.scratch = cueBallPocketed;

    // Scratch is always a foul
    if (cueBallPocketed) {
      this.foul = true;
      this.foulReason = 'SCRATCH';
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
        const result = {
          nextPlayer: opponent,
          foul: true,
          scratch: true,
          ballInHand: true,
          message: '开球犯规：白球落袋！对手获得自由球',
          gameOver: false,
          respotNineBall: pocketedIds.includes(9),
          reasonCode: 'SCRATCH',
        };
        return this._applyConsecutiveFouls(result, opponent);
      }

      if (this.firstBallHit === null) {
        this.foul = true;
        this.foulReason = 'NO_BALL_HIT';
        if (pocketedIds.includes(9)) {
          const idx = this.pocketedBalls.indexOf(9);
          if (idx !== -1) this.pocketedBalls.splice(idx, 1);
        }
        this.trackPocketedBalls(pocketedIds.filter(id => id !== 9));
        const result = {
          nextPlayer: opponent,
          foul: true,
          scratch: false,
          ballInHand: true,
          message: '开球犯规：没有球被撞到。对手获得自由球',
          gameOver: false,
          respotNineBall: pocketedIds.includes(9),
          reasonCode: 'NO_BALL_HIT',
        };
        return this._applyConsecutiveFouls(result, opponent);
      }

      // Check if first hit was the 1-ball (required on break)
      if (this.firstBallHit !== 1) {
        this.foul = true;
        this.foulReason = 'WRONG_FIRST_HIT';
        if (pocketedIds.includes(9)) {
          const idx = this.pocketedBalls.indexOf(9);
          if (idx !== -1) this.pocketedBalls.splice(idx, 1);
        }
        this.trackPocketedBalls(pocketedIds.filter(id => id !== 9));
        const result = {
          nextPlayer: opponent,
          foul: true,
          scratch: false,
          ballInHand: true,
          message: '开球犯规：必须先撞到1号球！',
          gameOver: false,
          respotNineBall: pocketedIds.includes(9),
          reasonCode: 'WRONG_FIRST_HIT',
        };
        return this._applyConsecutiveFouls(result, opponent);
      }

      // If 9-ball pocketed on break (and no foul), it's a win!
      if (ninePocketed && !this.foul) {
        this.gameOver = true;
        this.winner = this.currentPlayer;
        const result = {
          gameOver: true,
          winner: this.currentPlayer,
          message: '开球进9号球！你赢了！',
          reasonCode: 'NINE_ON_BREAK_WIN',
        };
        return this._applyConsecutiveFouls(result, opponent);
      }

      // Track pocketed balls
      this.trackPocketedBalls(pocketedIds);

      // If nothing pocketed, check WPA 4-ball-to-rail rule before handing over
      if (pocketedIds.length === 0) {
        if (this.breakRailContacts.size < 4) {
          this.foul = true;
          this.foulReason = 'ILLEGAL_BREAK';
          const result = {
            nextPlayer: opponent,
            foul: true,
            scratch: false,
            ballInHand: true,
            message: '开球犯规：少于4颗球碰库。对手获得自由球',
            gameOver: false,
            reasonCode: 'ILLEGAL_BREAK',
          };
          return this._applyConsecutiveFouls(result, opponent);
        }
        const result = {
          nextPlayer: opponent,
          foul: false,
          scratch: false,
          message: '开球：没有球进袋。',
          gameOver: false,
        };
        // Legal break with no pocket: push-out available next shot
        this.pushOutAvailable = true;
        return this._applyConsecutiveFouls(result, opponent);
      }

      // Legal break with pocketed balls, player continues
      const result = {
        nextPlayer: this.currentPlayer,
        foul: false,
        scratch: false,
        message: pocketedIds.length > 0 ? '开球有效。继续击球。' : '开球有效。台面开放。',
        gameOver: false,
      };
      // Legal break: push-out available next shot
      this.pushOutAvailable = true;
      return this._applyConsecutiveFouls(result, opponent);
    }

    // Normal shot (not break)

    // Push-out skips first-hit and rail checks (but scratch / no-hit still count)
    if (!isPushOut) {
      // Foul: did not hit the target ball first
      const targetBall = this._currentTarget();
      if (!cueBallPocketed && this.firstBallHit !== null && this.firstBallHit !== targetBall) {
        this.foul = true;
        this.foulReason = 'WRONG_FIRST_HIT';
      }
    }

    // Foul: no ball hit at all (applies even to push-out)
    if (!cueBallPocketed && this.firstBallHit === null) {
      this.foul = true;
      this.foulReason = 'NO_BALL_HIT';
    }

    // Foul: after a legal first contact, at least one ball must touch a rail
    // unless an object ball was pocketed. (Skipped for push-out)
    if (!isPushOut && !this.foul && !cueBallPocketed && this.firstBallHit !== null && pocketedIds.length === 0 && !this.railContactAfterFirstHit) {
      this.foul = true;
      this.foulReason = 'NO_RAIL_AFTER_CONTACT';
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
      const reasonCode = ninePocketedOnFoul ? 'NINE_ON_FOUL_RESPOT' : this.foulReason;
      const result = {
        nextPlayer: opponent,
        foul: true,
        scratch: this.scratch,
        ballInHand: true,
        message: this.scratch ? '白球落袋！对手获得自由球。' : '犯规！对手获得自由球。',
        gameOver: false,
        respotNineBall: ninePocketedOnFoul,
        reasonCode,
      };
      return this._applyConsecutiveFouls(result, opponent);
    }

    // Track pocketed balls (already tracked above if foul; track here for legal shots)
    this.trackPocketedBalls(pocketedIds);

    // Check for 9-ball win (9 pocketed on legal shot; push-out excluded)
    if (ninePocketed && !isPushOut) {
      this.gameOver = true;
      this.winner = this.currentPlayer;
      const result = {
        gameOver: true,
        winner: this.currentPlayer,
        message: '打进9号球！你赢了！',
        reasonCode: 'LEGAL_NINE_WIN',
      };
      return this._applyConsecutiveFouls(result, opponent);
    }

    // Push-out: enter pending state after a legal push-out shot
    if (isPushOut) {
      this.pushOutPending = true;
      this.pushOutPlayer = this.currentPlayer;
      // 9-ball pocketed on push-out is spotted (WPA rule)
      if (ninePocketed) {
        const idx = this.pocketedBalls.indexOf(9);
        if (idx !== -1) this.pocketedBalls.splice(idx, 1);
      }
      const result = {
        nextPlayer: opponent,
        foul: false,
        pushOutPending: true,
        message: 'Push-out。对手可选择接受或让回。',
        gameOver: false,
        respotNineBall: ninePocketed,
      };
      return this._applyConsecutiveFouls(result, opponent);
    }

    // Determine next player
    const pocketedAny = pocketedIds.length > 0;
    const nextPlayer = pocketedAny ? this.currentPlayer : opponent;
    const message = pocketedAny
      ? `打进 ${pocketedIds.length} 颗球！继续击球。`
      : '没有球进袋。轮到对手。';

    const result = {
      nextPlayer,
      foul: false,
      scratch: false,
      message,
      gameOver: false,
    };
    return this._applyConsecutiveFouls(result, opponent);
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
      player1ConsecutiveFouls: this.player1ConsecutiveFouls,
      player2ConsecutiveFouls: this.player2ConsecutiveFouls,
      pushOutAvailable: this.pushOutAvailable,
      pushOutPending: this.pushOutPending,
    };
  }
}
