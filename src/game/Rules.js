import { getBallType, BALL_TYPE } from '../config.js';

export class Rules {
  constructor() {
    this.reset();
  }

  reset() {
    this.player1Group = null; // 'solid' or 'stripe'
    this.player2Group = null;
    this.currentPlayer = 1;
    this.player1Pocketed = [];
    this.player2Pocketed = [];
    this.breakShot = true;
    this.gameOver = false;
    this.winner = null;
    this.foul = false;
    this.firstBallHit = null;
    this.railContactAfterFirstHit = false;
    this.scratch = false;
    this.breakRailContacts = new Set();
  }

  // Called at start of a shot to reset per-shot tracking
  startShot(player) {
    this.currentPlayer = player;
    this.foul = false;
    this.scratch = false;
    this.firstBallHit = null;
    this.railContactAfterFirstHit = false;
    this.breakRailContacts.clear();
    // Remember whether the table was open BEFORE this shot
    this.wasOpenTable = (this.player1Group === null);
  }

  // Track first ball hit by cue ball (for foul detection)
  recordFirstHit(ballId) {
    if (this.firstBallHit === null && ballId !== 0) {
      this.firstBallHit = ballId;
    }
  }

  recordCushionHit(ballId) {
    if (this.firstBallHit !== null) {
      this.railContactAfterFirstHit = true;
    }
    if (this.breakShot && ballId !== 0 && ballId !== undefined) {
      this.breakRailContacts.add(ballId);
    }
  }

  // Process pocketed balls after shot
  resolveShot(pocketedIds, cueBallPocketed) {
    if (this.gameOver) return { gameOver: true, winner: this.winner };

    this.scratch = cueBallPocketed;
    if (cueBallPocketed) {
      this.foul = true;
    }

    let currentGroup = this.currentPlayer === 1 ? this.player1Group : this.player2Group;
    const opponent = this.currentPlayer === 1 ? 2 : 1;

    let pocketedOwn = 0;
    let pocketedOpponent = 0;
    let pocketedEight = false;

    // Deduplicate pocketed IDs
    const uniquePocketed = [...new Set(pocketedIds)];

    for (const id of uniquePocketed) {
      const type = getBallType(id);
      if (type === BALL_TYPE.EIGHT) {
        pocketedEight = true;
      } else if (type === BALL_TYPE.SOLID) {
        if (currentGroup === 'solid') pocketedOwn++;
        else if (currentGroup === 'stripe') pocketedOpponent++;
      } else if (type === BALL_TYPE.STRIPE) {
        if (currentGroup === 'stripe') pocketedOwn++;
        else if (currentGroup === 'solid') pocketedOpponent++;
      }
    }

    // Break shot special rules
    if (this.breakShot) {
      this.breakShot = false;

      // Break foul: scratch or no ball hit
      if (this.foul || this.firstBallHit === null) {
        return {
          nextPlayer: opponent,
          foul: true,
          scratch: this.scratch,
          ballInHand: true,
          ballInHandBehindLine: true,
          message: cueBallPocketed
            ? 'Break scratch! Opponent gets ball-in-hand behind the head string.'
            : 'Break foul: no ball hit. Opponent gets ball-in-hand behind the head string.',
          respotEightBall: pocketedEight,
        };
      }

      // 8-ball pocketed on break is SPOTTED, not a loss (WPA rule)
      if (pocketedEight) {
        return {
          nextPlayer: this.currentPlayer,
          foul: false,
          scratch: false,
          message: '8-ball on break — respotted. Table is still open.',
          respotEightBall: true,
        };
      }

      // Illegal break: nothing pocketed AND fewer than 4 object balls hit a rail
      if (uniquePocketed.length === 0 && this.breakRailContacts.size < 4) {
        return {
          nextPlayer: opponent,
          foul: true,
          scratch: false,
          ballInHand: true,
          ballInHandBehindLine: true,
          message: 'Break foul: fewer than 4 balls hit a rail. Opponent gets ball-in-hand behind the head string.',
          gameOver: false,
        };
      }

      // Nothing pocketed on break: opponent's turn, table still OPEN
      if (uniquePocketed.length === 0) {
        return {
          nextPlayer: opponent,
          foul: false,
          scratch: false,
          message: 'Break: no balls pocketed. Table is open.',
        };
      }

      // Balls pocketed on break — per WPA the table REMAINS OPEN.
      // Groups are NOT assigned until a subsequent legal shot.
      return {
        nextPlayer: this.currentPlayer,
        foul: false,
        scratch: false,
        message: 'Break: legal. Table is still open.',
      };
    }

    // All foul checks (must come BEFORE group assignment and 8-ball win/loss check)
    if (!cueBallPocketed && this.firstBallHit === null) {
      this.foul = true;
    }
    if (!cueBallPocketed && this.firstBallHit !== null && uniquePocketed.length === 0 && !this.railContactAfterFirstHit) {
      this.foul = true;
    }

    // Group assignment on first legal pocket after break (only on non-foul, non-break shots)
    if (!this.breakShot && currentGroup === null && uniquePocketed.length > 0 && !this.foul && this.firstBallHit !== null && this.firstBallHit !== 8) {
      const hasSolid = uniquePocketed.some(id => getBallType(id) === BALL_TYPE.SOLID);
      const hasStripe = uniquePocketed.some(id => getBallType(id) === BALL_TYPE.STRIPE);
      // WPA: if both solid and stripe pocketed on same shot, table remains open
      if (hasSolid && !hasStripe) {
        this.assignGroup(this.currentPlayer, 'solid');
        this.assignGroup(opponent, 'stripe');
        currentGroup = 'solid';
        pocketedOwn = uniquePocketed.filter(id => getBallType(id) === BALL_TYPE.SOLID).length;
        pocketedOpponent = uniquePocketed.filter(id => getBallType(id) === BALL_TYPE.STRIPE).length;
      } else if (hasStripe && !hasSolid) {
        this.assignGroup(this.currentPlayer, 'stripe');
        this.assignGroup(opponent, 'solid');
        currentGroup = 'stripe';
        pocketedOwn = uniquePocketed.filter(id => getBallType(id) === BALL_TYPE.STRIPE).length;
        pocketedOpponent = uniquePocketed.filter(id => getBallType(id) === BALL_TYPE.SOLID).length;
      }
      // If both solid and stripe pocketed, table remains open (currentGroup stays null)
    }

    // 8-ball first-hit foul: ALWAYS illegal to hit the 8-ball first
    // unless you have already cleared your group.
    if (!cueBallPocketed) {
      const firstHitType = getBallType(this.firstBallHit);
      const currentList = this.currentPlayer === 1 ? this.player1Pocketed : this.player2Pocketed;
      const justPocketedOwn = uniquePocketed.filter(id => {
        const t = getBallType(id);
        return (currentGroup === 'solid' && t === BALL_TYPE.SOLID) ||
               (currentGroup === 'stripe' && t === BALL_TYPE.STRIPE);
      }).length;
      const hasClearedGroup = currentList.length + justPocketedOwn >= 7;
      if (firstHitType === BALL_TYPE.EIGHT && !hasClearedGroup) {
        this.foul = true;
      }
    }

    // Group-specific first-hit foul: only enforce when the table was ALREADY CLOSED
    // before this shot. On an open table, first contact does not determine group
    // (except for the 8-ball check above).
    if (!cueBallPocketed && !this.wasOpenTable) {
      const firstHitType = getBallType(this.firstBallHit);
      if (currentGroup) {
        const expectedType = currentGroup === 'solid' ? BALL_TYPE.SOLID : BALL_TYPE.STRIPE;
        if (firstHitType !== null && firstHitType !== expectedType && firstHitType !== BALL_TYPE.EIGHT) {
          // Did not hit own group first
          this.foul = true;
        }
      }
    }

    // Check 8-ball pocketed — AFTER all foul checks so this.foul is fully resolved
    if (pocketedEight) {
      const currentList = this.currentPlayer === 1 ? this.player1Pocketed : this.player2Pocketed;
      // Count own-group balls pocketed THIS shot too, to handle
      // the case where the 7th group ball and 8-ball drop together.
      const justPocketedOwn = uniquePocketed.filter(id => {
        const t = getBallType(id);
        return (currentGroup === 'solid' && t === BALL_TYPE.SOLID) ||
               (currentGroup === 'stripe' && t === BALL_TYPE.STRIPE);
      }).length;
      const hasAll = currentList.length + justPocketedOwn >= 7;

      if (!hasAll || this.foul) {
        // Pocketed 8-ball too early or on foul = lose
        this.gameOver = true;
        this.winner = opponent;
        return { gameOver: true, winner: opponent, foul: true, message: '8-ball pocketed illegally! You lose!' };
      } else {
        // Legal 8-ball pocket = win
        this.gameOver = true;
        this.winner = this.currentPlayer;
        return { gameOver: true, winner: this.currentPlayer, message: 'You win!' };
      }
    }

    // Track pocketed balls
    for (const id of uniquePocketed) {
      const type = getBallType(id);
      const isCurrentPlayersBall =
        (currentGroup === 'solid' && type === BALL_TYPE.SOLID) ||
        (currentGroup === 'stripe' && type === BALL_TYPE.STRIPE);

      if (isCurrentPlayersBall) {
        if (this.currentPlayer === 1) {
          if (!this.player1Pocketed.includes(id)) this.player1Pocketed.push(id);
        } else {
          if (!this.player2Pocketed.includes(id)) this.player2Pocketed.push(id);
        }
      }
    }

    // Determine next player
    let nextPlayer = this.currentPlayer;
    let message = '';

    if (this.foul) {
      nextPlayer = opponent;
      message = cueBallPocketed
        ? 'Scratch! Opponent gets ball-in-hand.'
        : 'Foul! Opponent gets ball-in-hand.';
    } else if (pocketedOwn === 0 && !this.foul) {
      nextPlayer = opponent;
      message = 'No ball pocketed. Opponent\'s turn.';
    } else if (!this.foul) {
      message = `Pocketed ${pocketedOwn}! Your turn continues.`;
    }

    return {
      nextPlayer,
      foul: this.foul,
      scratch: this.scratch,
      ballInHand: this.foul,
      message,
      pocketedOwn,
      pocketedOpponent,
    };
  }

  assignGroup(player, group) {
    if (player === 1) this.player1Group = group;
    else this.player2Group = group;
  }

  getPlayerGroup(player) {
    return player === 1 ? this.player1Group : this.player2Group;
  }

  getStatus() {
    return {
      currentPlayer: this.currentPlayer,
      player1Group: this.player1Group,
      player2Group: this.player2Group,
      player1Remaining: this.player1Group ? 7 - this.player1Pocketed.length : 7,
      player2Remaining: this.player2Group ? 7 - this.player2Pocketed.length : 7,
      breakShot: this.breakShot,
      gameOver: this.gameOver,
      winner: this.winner,
    };
  }
}
