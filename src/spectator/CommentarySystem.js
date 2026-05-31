import { settings } from '../core/SettingsStore.js';

/**
 * CommentarySystem — Real-time text commentary for Spectator Mode.
 *
 * Generates contextual commentary lines based on game events:
 *   - Break shots
 *   - Pocketed balls
 *   - Fouls & scratches
 *   - Turn changes
 *   - Difficult shots
 *   - Game-winning shots
 *   - Safety play
 *   - Streaks & combos
 *
 * Commentary is displayed with a typewriter effect in the broadcast overlay.
 */

// Commentary line pools per event type
const COMMENTARY_LINES = {
  matchStart: [
    '比赛开始！双方选手已经就位。',
    '欢迎来到这场精彩的对决！',
    '裁判示意，比赛正式打响！',
    '观众们屏息凝神，期待这场巅峰之战。',
  ],

  breakShot: [
    '开球！',
    '力量十足的开球！',
    '球堆炸开了！',
    '完美的开球，球四处飞散。',
  ],

  breakNoPocket: [
    '开球后没有球进袋，轮到对手了。',
    '干开——没有球落袋。',
    '开球没有收获，局面交给对方。',
  ],

  breakMultiple: [
    '哇！一下子进了好几个球！',
    '不可思议的开球，连进 {count} 球！',
    '今天的运气站在他这一边！',
  ],

  pocket: [
    '漂亮！应声落袋。',
    '稳稳打进！',
    '好球！',
    '精准的一击。',
    '干净利落！',
  ],

  pocketDifficult: [
    '难度极高的一杆……进了！不可思议！',
    '这球角度很刁钻……哇！打进了！',
    '几乎是贴着袋口滑进去的！',
    '太精彩了！这种球都能打进！',
  ],

  pocketLong: [
    '长台进攻……命中！',
    '远距离一击，稳稳落袋！',
  ],

  combo: [
    '连续进球！手感火热！',
    '又进了！已经连进 {count} 球！',
    '势不可挡！',
  ],

  foul: [
    '犯规了！',
    '哎呀，这是一次犯规。',
    '裁判示意犯规。',
  ],

  scratch: [
    '母球也进去了！这是个犯规。',
    '母球落袋，给对方自由球。',
    '太可惜了，母球跟进袋口。',
  ],

  miss: [
    '没有打进。',
    '球在袋口转了一圈……没进。',
    '力度稍欠，球停在了袋口附近。',
    '差一点点！',
  ],

  safety: [
    '做了一杆漂亮的防守。',
    '这杆选择防守，把难题留给对手。',
    '母球藏得很好，对方不好下手了。',
  ],

  turnChange: [
    '轮到 {player} 了。',
    '现在由 {player} 击球。',
    '{player} 上场。',
  ],

  ballInHand: [
    '{player} 获得自由球，可以把母球放到任意位置。',
    '自由球！{player} 拥有完全的选择权。',
  ],

  eightBallApproach: [
    '8号球已经露面了，局势进入关键时刻！',
    '大局已定，现在开始争夺黑八！',
    '紧张时刻——谁能先打进8号球？',
  ],

  eightBallDanger: [
    '这杆如果打进8号球就赢了……',
    '关键时刻！8号球悬而未决……',
  ],

  gameWin: [
    '比赛结束！{player} 获胜！',
    '{player} 以精彩的表现赢得了比赛！',
    '恭喜 {player}！',
  ],

  closeCall: [
    '这球太险了，几乎就是犯规边缘。',
    '差一点点就碰到了不该碰的球。',
  ],

  bankShot: [
    '翻袋！漂亮！',
    '借库进球！技术精湛！',
  ],

  kickShot: [
    '跳球/解球成功！',
    '精彩的救球！',
  ],

  thinking: [
    '{player} 正在思考……',
    '{player} 在仔细观察台面……',
    '这一杆不好打，{player} 需要好好盘算。',
  ],

  stalemate: [
    '局面很僵持，双方都在等待机会。',
    '这盘球变得很胶着。',
  ],
};

function pickRandom(pool, exclude = null) {
  const filtered = exclude ? pool.filter(l => l !== exclude) : pool;
  if (filtered.length === 0) return pool[Math.floor(Math.random() * pool.length)];
  return filtered[Math.floor(Math.random() * filtered.length)];
}

function formatLine(line, vars) {
  let result = line;
  for (const [key, val] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), val);
  }
  return result;
}

export class CommentarySystem {
  constructor() {
    this._lines = [];
    this._currentLine = '';
    this._displayedText = '';
    this._charIndex = 0;
    this._typeTimer = 0;
    this._typeInterval = 35; // ms per char
    this._lastEventType = null;
    this._lastLine = null;
    this._comboCount = 0;
    this._lastPocketPlayer = null;
    this._streakPlayer = null;
    this._thinkingShown = false;
  }

  /** Call at game start. */
  onMatchStart(player1Name, player2Name) {
    this._lines = [];
    this._pushLine(pickRandom(COMMENTARY_LINES.matchStart), 'matchStart');
    this._player1Name = player1Name || '选手 1';
    this._player2Name = player2Name || '选手 2';
  }

  /** Call when AI starts thinking. */
  onThinking(playerNum) {
    if (this._thinkingShown) return;
    this._thinkingShown = true;
    const name = playerNum === 1 ? this._player1Name : this._player2Name;
    this._pushLine(formatLine(pickRandom(COMMENTARY_LINES.thinking, this._lastLine), {
      player: name,
    }), 'thinking');
  }

  /** Call when AI stops thinking (starts aiming). */
  onAimStart() {
    this._thinkingShown = false;
  }

  /** Call on break shot. */
  onBreakShot(pocketedCount) {
    this._comboCount = 0;
    this._lastPocketPlayer = null;
    this._streakPlayer = null;
    if (pocketedCount === 0) {
      this._pushLine(pickRandom(COMMENTARY_LINES.breakNoPocket), 'breakNoPocket');
    } else if (pocketedCount >= 2) {
      this._pushLine(formatLine(pickRandom(COMMENTARY_LINES.breakMultiple), { count: pocketedCount }), 'breakMultiple');
    } else {
      this._pushLine(pickRandom(COMMENTARY_LINES.breakShot), 'breakShot');
    }
  }

  /** Call when a ball is pocketed. */
  onPocket(ballId, playerNum, isDifficult = false, isLongShot = false, isBank = false, isCombo = false) {
    const name = playerNum === 1 ? this._player1Name : this._player2Name;

    if (this._streakPlayer !== playerNum) {
      this._comboCount = 0;
      this._streakPlayer = playerNum;
    }
    this._comboCount++;

    // Check for 8-ball
    if (ballId === 8) {
      // Game win handled separately
      return;
    }

    let line;
    if (isCombo && this._comboCount >= 2) {
      line = formatLine(pickRandom(COMMENTARY_LINES.combo, this._lastLine), { count: this._comboCount });
    } else if (isBank) {
      line = pickRandom(COMMENTARY_LINES.bankShot);
    } else if (isDifficult) {
      line = pickRandom(COMMENTARY_LINES.pocketDifficult);
    } else if (isLongShot) {
      line = pickRandom(COMMENTARY_LINES.pocketLong);
    } else {
      line = pickRandom(COMMENTARY_LINES.pocket);
    }

    this._pushLine(line, 'pocket');
  }

  /** Call on foul. */
  onFoul(playerNum, isScratch = false) {
    const name = playerNum === 1 ? this._player1Name : this._player2Name;
    this._comboCount = 0;
    this._streakPlayer = null;

    if (isScratch) {
      this._pushLine(pickRandom(COMMENTARY_LINES.scratch), 'scratch');
    } else {
      this._pushLine(pickRandom(COMMENTARY_LINES.foul), 'foul');
    }
  }

  /** Call on miss (no ball pocketed, not a foul). */
  onMiss(playerNum) {
    this._comboCount = 0;
    this._streakPlayer = null;
    this._pushLine(pickRandom(COMMENTARY_LINES.miss), 'miss');
  }

  /** Call when player turn changes. */
  onTurnChange(playerNum, ballInHand = false) {
    const name = playerNum === 1 ? this._player1Name : this._player2Name;
    this._thinkingShown = false;

    if (ballInHand) {
      this._pushLine(formatLine(pickRandom(COMMENTARY_LINES.ballInHand), { player: name }), 'ballInHand');
    } else {
      this._pushLine(formatLine(pickRandom(COMMENTARY_LINES.turnChange), { player: name }), 'turnChange');
    }
  }

  /** Call when a safety shot is detected. */
  onSafety(playerNum) {
    this._pushLine(pickRandom(COMMENTARY_LINES.safety), 'safety');
  }

  /** Call when 8-ball becomes the target. */
  onEightBallApproach() {
    this._pushLine(pickRandom(COMMENTARY_LINES.eightBallApproach), 'eightBallApproach');
  }

  /** Call on game-winning shot. */
  onGameWin(winnerNum) {
    const name = winnerNum === 1 ? this._player1Name : this._player2Name;
    this._pushLine(formatLine(pickRandom(COMMENTARY_LINES.gameWin), { player: name }), 'gameWin');
  }

  /** Call when stalemate is detected (no good shots for a while). */
  onStalemate() {
    this._pushLine(pickRandom(COMMENTARY_LINES.stalemate), 'stalemate');
  }

  _pushLine(text, eventType) {
    this._lines.push({ text, time: Date.now(), eventType });
    this._lastLine = text;
    this._lastEventType = eventType;
    // Start typing if not already
    if (!this._currentLine) {
      this._startNextLine();
    }
  }

  _startNextLine() {
    const entry = this._lines.shift();
    if (!entry) {
      this._currentLine = '';
      this._displayedText = '';
      return;
    }
    this._currentLine = entry.text;
    this._displayedText = '';
    this._charIndex = 0;
    this._typeTimer = 0;
  }

  /** Update typewriter effect. Call every frame. */
  update(dt) {
    if (!this._currentLine) return;

    if (settings.get('reducedMotion')) {
      this._displayedText = this._currentLine;
      this._charIndex = this._currentLine.length;
      this._typeTimer += dt * 1000;
      if (this._typeTimer > 2500) this._startNextLine();
      return;
    }

    this._typeTimer += dt * 1000;
    const speed = Math.max(0.5, Math.min(1.5, settings.get('uiAnimSpeed') ?? 1));
    const interval = this._typeInterval / speed;
    while (this._typeTimer >= interval && this._charIndex < this._currentLine.length) {
      this._typeTimer -= interval;
      this._displayedText += this._currentLine[this._charIndex];
      this._charIndex++;
    }

    // Auto-advance to next line after a pause
    if (this._charIndex >= this._currentLine.length) {
      if (this._typeTimer > 2500 / speed) {
        this._startNextLine();
      }
    }
  }

  /** Get current displayed text for rendering. */
  getDisplayedText() {
    return this._displayedText;
  }

  /** Check if currently typing (for UI cursor effect). */
  isTyping() {
    return this._currentLine && this._charIndex < this._currentLine.length;
  }

  /** Get recent history (for a scrollback panel). */
  getHistory(limit = 20) {
    // Include the current line + completed lines from buffer
    const result = [];
    if (this._currentLine) {
      result.push({ text: this._currentLine, time: Date.now(), current: true });
    }
    // Return last N completed lines
    const completed = this._lines.slice(-limit);
    result.push(...completed);
    return result;
  }

  reset() {
    this._lines = [];
    this._currentLine = '';
    this._displayedText = '';
    this._charIndex = 0;
    this._comboCount = 0;
    this._lastPocketPlayer = null;
    this._streakPlayer = null;
    this._thinkingShown = false;
  }

  dispose() {
    this.reset();
  }
}
