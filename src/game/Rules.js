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
    this.scratch = false;
  }

  // Called at start of a shot to reset per-shot tracking
  startShot(player) {
    this.currentPlayer = player;
    this.foul = false;
    this.scratch = false;
    this.firstBallHit = null;
  }

  // Track first ball hit by cue ball (for foul detection)
  recordFirstHit(ballId) {
    if (this.firstBallHit === null && ballId !== 0) {
      this.firstBallHit = ballId;
    }
  }

  // Process pocketed balls after shot
  resolveShot(pocketedIds, cueBallPocketed) {
    if (this.gameOver) return { gameOver: true, winner: this.winner };

    this.scratch = cueBallPocketed;
    if (cueBallPocketed) {
      this.foul = true;
    }

    const currentGroup = this.currentPlayer === 1 ? this.player1Group : this.player2Group;
    const opponent = this.currentPlayer === 1 ? 2 : 1;
    const opponentGroup = this.currentPlayer === 1 ? this.player2Group : this.player1Group;

    let pocketedOwn = 0;
    let pocketedOpponent = 0;
    let pocketedEight = false;

    for (const id of pocketedIds) {
      const type = getBallType(id);
      if (type === BALL_TYPE.EIGHT) {
        pocketedEight = true;
      } else if (type === BALL_TYPE.SOLID) {
        if (currentGroup === 'solid') pocketedOwn++;
        else if (currentGroup === 'stripe') pocketedOpponent++;
        else {
          // Group not yet assigned
          if (this.breakShot) {
            // On break, assign groups based on who pockets what first
            // We handle assignment after the loop
          }
        }
      } else if (type === BALL_TYPE.STRIPE) {
        if (currentGroup === 'stripe') pocketedOwn++;
        else if (currentGroup === 'solid') pocketedOpponent++;
      }
    }

    // Group assignment on first legal pocket after break
    if (!this.breakShot && currentGroup === null && pocketedIds.length > 0 && !cueBallPocketed) {
      const firstPocketed = pocketedIds[0];
      const firstType = getBallType(firstPocketed);
      if (firstType === BALL_TYPE.SOLID) {
        this.assignGroup(this.currentPlayer, 'solid');
        this.assignGroup(opponent, 'stripe');
        pocketedOwn = pocketedIds.filter(id => getBallType(id) === BALL_TYPE.SOLID).length;
        pocketedOpponent = pocketedIds.filter(id => getBallType(id) === BALL_TYPE.STRIPE).length;
      } else if (firstType === BALL_TYPE.STRIPE) {
        this.assignGroup(this.currentPlayer, 'stripe');
        this.assignGroup(opponent, 'solid');
        pocketedOwn = pocketedIds.filter(id => getBallType(id) === BALL_TYPE.STRIPE).length;
        pocketedOpponent = pocketedIds.filter(id => getBallType(id) === BALL_TYPE.SOLID).length;
      }
    }

    // Break shot special rules
    if (this.breakShot) {
      this.breakShot = false;
      // If nothing pocketed on break and no foul, next player continues
      if (pocketedIds.length === 0 && !cueBallPocketed) {
        return { nextPlayer: opponent, foul: false, scratch: false, message: 'Break: no balls pocketed' };
      }
      // If something pocketed on break, assign groups
      if (pocketedIds.length > 0 && !cueBallPocketed) {
        const solids = pocketedIds.filter(id => getBallType(id) === BALL_TYPE.SOLID);
        const stripes = pocketedIds.filter(id => getBallType(id) === BALL_TYPE.STRIPE);
        if (solids.length > stripes.length) {
          this.assignGroup(this.currentPlayer, 'solid');
          this.assignGroup(opponent, 'stripe');
        } else if (stripes.length > solids.length) {
          this.assignGroup(this.currentPlayer, 'stripe');
          this.assignGroup(opponent, 'solid');
        } else {
          // Tie or only 8-ball — assign based on first pocketed
          const firstType = getBallType(pocketedIds[0]);
          if (firstType === BALL_TYPE.SOLID) {
            this.assignGroup(this.currentPlayer, 'solid');
            this.assignGroup(opponent, 'stripe');
          } else if (firstType === BALL_TYPE.STRIPE) {
            this.assignGroup(this.currentPlayer, 'stripe');
            this.assignGroup(opponent, 'solid');
          }
        }
      }
    }

    // Check 8-ball pocketed
    if (pocketedEight) {
      const currentList = this.currentPlayer === 1 ? this.player1Pocketed : this.player2Pocketed;
      const hasAll = currentList.length >= 7;

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

    // Foul checks after groups are assigned
    if (currentGroup && !cueBallPocketed) {
      const firstHitType = getBallType(this.firstBallHit);
      const expectedType = currentGroup === 'solid' ? BALL_TYPE.SOLID : BALL_TYPE.STRIPE;

      if (firstHitType !== null && firstHitType !== expectedType && firstHitType !== BALL_TYPE.EIGHT) {
        // Did not hit own group first
        this.foul = true;
      }

      if (pocketedIds.length === 0 && !this.foul) {
        // No ball pocketed and no cushion contact after hit = foul
        // (Simplified: we skip cushion contact check for now)
      }
    }

    // Track pocketed balls
    for (const id of pocketedIds) {
      const type = getBallType(id);
      if (type === BALL_TYPE.SOLID || type === BALL_TYPE.STRIPE) {
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
      message = cueBallPocketed ? 'Scratch! Opponent\'s turn.' : 'Foul! Opponent\'s turn.';
    } else if (pocketedOwn === 0) {
      nextPlayer = opponent;
      message = 'No ball pocketed. Opponent\'s turn.';
    } else {
      message = `Pocketed ${pocketedOwn}! Your turn continues.`;
    }

    return {
      nextPlayer,
      foul: this.foul,
      scratch: this.scratch,
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
