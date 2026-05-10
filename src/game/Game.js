import * as THREE from 'three';
import { Table } from './Table.js';
import { Room } from './Room.js';
import { BallsManager } from './BallsManager.js';
import { InputHandler } from '../input/InputHandler.js';
import { Cue } from './Cue.js';
import { Rules } from './Rules.js';
import { NineBallRules } from './NineBallRules.js';
import { AchievementSystem } from '../achievements/AchievementSystem.js';
import { AchievementPanel } from '../achievements/AchievementPanel.js';
import { UI } from '../ui/UI.js';
import { AudioManager } from '../audio/AudioManager.js';
import { AIPlayer, AI_DIFFICULTY } from '../ai/AIPlayer.js';
import { TrajectoryPredictor } from './TrajectoryPredictor.js';
import { StatsTracker } from '../stats/StatsTracker.js';
import { StatsPanel } from '../stats/StatsPanel.js';
import { ParticleSystem } from '../fx/ParticleSystem.js';
import { ShotTrailSystem } from '../fx/ShotTrail.js';
import { ShotRecorder } from '../replay/ShotRecorder.js';
import { BALL, TABLE, POCKET, SHOT } from '../config.js';

export class Game {
  constructor(renderer, physics) {
    this.renderer = renderer;
    this.physics = physics;
    this.scene = renderer.scene;
    this.camera = renderer.camera;

    this.table = null;
    this.ballsManager = null;
    this.input = null;
    this.cue = null;
    this.rules = null;
    this.ui = new UI();
    this.audio = new AudioManager();
    this.aiPlayer = null;
    this.trajectory = null;
    this.statsTracker = new StatsTracker();
    this.statsPanel = new StatsPanel();
    this.particles = new ParticleSystem(this.scene);
    this.trails = new ShotTrailSystem(this.scene);
    this.recorder = new ShotRecorder();
    this.replayLibrary = null; // injected by MenuSystem

    this.state = 'AIM'; // AIM, CHARGING, SHOOTING, RESOLVING, AI_THINKING, GAME_OVER
    this.power = 0;
    this.charging = false;
    this.currentPlayer = 1;
    this.aimDirection = new THREE.Vector3(0, 0, 1);
    this.lockedAimDirection = new THREE.Vector3(0, 0, 1);
    this.dragStart = null;
    this.trajectoryEnabled = true;
    this.ballInHand = false;
    this.ballInHandValid = false;
    this.aiEnabled = false;

    // English spin state: [-1, 1] for X (left/right) and Z (top/back)
    this.spin = { x: 0, z: 0 };

    // Camera mode: 'free' | 'top' | 'follow'
    this.cameraMode = 'free';
    this.mode = 'local2p'; // 'freeplay' | 'local2p' | 'vsai'
    this.onReturnToMenu = null;

    this._tmpVec2 = new THREE.Vector2();
    this._tmpVec3a = new THREE.Vector3();
    this._tmpVec3b = new THREE.Vector3();
    this._tmpVec3c = new THREE.Vector3();
    this._tmpVec3d = new THREE.Vector3();

    this.turnPocketedIds = [];
    this._isBreakShot = false;
  }

  async init(modeConfig = {}) {
    this.mode = modeConfig.mode || 'local2p';
    this.aiEnabled = modeConfig.aiEnabled || false;
    if (modeConfig.aiDifficulty) {
      this.aiPlayer = new AIPlayer(modeConfig.aiDifficulty);
    }

    // Create rules engine based on game mode
    if (this.mode === '9ball') {
      this.rules = new NineBallRules();
    } else {
      this.rules = new Rules();
    }

    this.audio.init();

    this.table = new Table(this.physics);
    this.table.addToScene(this.scene);

    this.room = new Room();
    this.room.addToScene(this.scene);

    this.ballsManager = new BallsManager(this.physics);
    this.ballsManager.createBalls();
    const rackMode = this.mode === '9ball' ? '9ball' : '8ball';
    this.ballsManager.rackBalls(rackMode);
    this.ballsManager.addToScene(this.scene);

    this.input = new InputHandler(this.renderer.renderer.domElement);
    this.input.onMouseMove = () => this.onMouseMove();
    this.input.onMouseDown = (e) => this.onMouseDown(e);
    this.input.onMouseUp = (e) => this.onMouseUp(e);

    this.cue = new Cue();
    this.scene.add(this.cue.mesh);

    this.trajectory = new TrajectoryPredictor(this.scene);

    this.statsTracker.reset();
    this.particles.clear();
    this.gameStartTime = performance.now();

    this.ui.setPlayerTurn(1);
    if (this.mode === 'freeplay') {
      this.ui.setMessage('练习模式：无胜负规则；白球进袋会自动复位，犯规自由球时白球可在球桌内任意摆放。');
    } else if (this.mode === '9ball') {
      this.ui.setMessage('9 球规则：白球必须先碰当前最小号码球；合法打进 9 号球获胜。');
    } else {
      this.ui.setMessage('标准 8 球规则：开球后按进球分配全色/花色；清完本组后打进 8 号球获胜。');
    }
    this.ui.setupAIControls(
      (enabled) => this.setAIEnabled(enabled),
      (difficulty) => this.setAIDifficulty(difficulty),
      (enabled) => this.audio.toggleSound(enabled)
    );

    // Hide AI panel during challenge mode
    if (this.challengeManager) {
      this.ui.aiPanel.style.display = 'none';
    }
    this._onToggleTrajectory = (e) => {
      this.trajectoryEnabled = Boolean(e.detail);
      this.setAimTrajectoryVisible(this.state === 'AIM');
    };
    this._onToggleShotTrail = (e) => {
      if (this.trails) this.trails.setEnabled(e.detail);
    };
    window.addEventListener('toggleTrajectory', this._onToggleTrajectory);
    window.addEventListener('toggleShotTrail', this._onToggleShotTrail);
    this.ui.showResetButton(() => this.resetGame());

    // Back-to-menu button
    this._addBackToMenuButton();

    // Achievement panel
    this.achievementPanel = new AchievementPanel(this.achievements);

    // Spin indicator UI
    this._addSpinIndicator();

    // Keyboard controls for spin
    this._setupSpinControls();

    this.setupCollisionEvents();
  }

  setAIEnabled(enabled) {
    this.aiEnabled = enabled;
    if (enabled && !this.aiPlayer) {
      this.aiPlayer = new AIPlayer(AI_DIFFICULTY.NORMAL);
    }
    if (this.currentPlayer === 2 && enabled && this.state === 'AIM') {
      this.startAITurn();
    }
    if (!enabled && this.state === 'AI_THINKING') {
      this.state = 'AIM';
      this.power = 0;
      this.ui.setPower(0);
      this.cue.show();
    }
  }

  setAIDifficulty(difficulty) {
    this.aiPlayer = new AIPlayer(difficulty);
  }

  setupCollisionEvents() {
    for (const ball of this.ballsManager.balls) {
      ball.body.addEventListener('collide', (e) => {
        this._trackShotDistance(ball);
        // In cannon-es, e.body is ALREADY the other body involved in the collision
        const otherBody = e.body;
        const otherBall = this.ballsManager.balls.find(b => b.body === otherBody);
        const v = ball.body.velocity.length();

        if (otherBall) {
          // Ball-ball collision
          // True relative velocity = vector difference magnitude (not scalar diff)
          const relVel = ball.body.velocity.distanceTo(otherBall.body.velocity);

          // First hit tracking (only for cue ball)
          if (ball.id === 0 && otherBall.id !== 0) {
            this.rules.recordFirstHit(otherBall.id);
            this.achievements.onBallCollision(relVel);
          }

          // Deduplicate: cannon-es fires collide on BOTH bodies.
          // Use lower ID as canonical to process each pair exactly once.
          if (ball.id < otherBall.id) {
            this._applyCollisionSpinTransfer(ball, otherBall, relVel);
            if (relVel > 0.5) {
              this.audio.playBallCollision(relVel);
            }
            if (this.state === 'SHOOTING' && relVel > 1.0) {
              this.statsTracker.recordBallCollision(this.currentPlayer);
              this._tmpVec3d
                .copy(ball.mesh.position)
                .add(otherBall.mesh.position)
                .multiplyScalar(0.5);
              this.particles.spawnCollisionSparks(this._tmpVec3d, relVel);
            }
          }
        } else if (otherBody.material === this.physics.cushionMaterial) {
          // Ball-cushion collision
          if (v > 0.8) {
            this.audio.playCushionBounce(v);
          }

          if (this.state === 'SHOOTING' && v > 0.5) {
            this.statsTracker.recordCushionCollision(this.currentPlayer);
            this.achievements.onCushionCollision();
            this.recorder.recordCushion();
            if (this.challengeManager) this.challengeManager.onCushionHit();
          }
        }
      });
    }
  }

  _applyCollisionSpinTransfer(ballA, ballB, relVel) {
    if (relVel < 1.2) return;

    const dx = ballB.body.position.x - ballA.body.position.x;
    const dz = ballB.body.position.z - ballA.body.position.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.001) return;

    const tx = -dz / len;
    const tz = dx / len;
    const spinDelta = ballA.body.angularVelocity.y - ballB.body.angularVelocity.y;
    const throwSpeed = Math.max(-0.35, Math.min(0.35, spinDelta * relVel * BALL.collisionThrow));

    ballA.body.velocity.x -= tx * throwSpeed * 0.18;
    ballA.body.velocity.z -= tz * throwSpeed * 0.18;
    ballB.body.velocity.x += tx * throwSpeed * 0.45;
    ballB.body.velocity.z += tz * throwSpeed * 0.45;
    ballA.body.angularVelocity.y *= 0.55;
    ballB.body.angularVelocity.y += spinDelta * 0.025;
  }

  onMouseMove() {
    if (this.ballInHand && this.state === 'AIM') {
      this.updateBallInHandPreview();
      return;
    }
    if (this.state === 'AIM') {
      this.updateAimDirection();
      this.updateTrajectory();
    } else if (this.state === 'CHARGING') {
      this.updateDragPower();
    }
  }

  onMouseDown(e) {
    if (this.state !== 'AIM') return;
    if (this.aiEnabled && this.currentPlayer === 2) return; // AI turn
    if (this.ballInHand) {
      this.confirmBallInHandPlacement();
      return;
    }
    this.audio.resume();
    this.updateAimDirection();
    this.lockedAimDirection.copy(this.aimDirection);
    this.dragStart = {
      x: e?.clientX ?? this.input.mouseX,
      y: e?.clientY ?? this.input.mouseY
    };
    this.state = 'CHARGING';
    this.charging = true;
    this.power = 0;
    this.ui.setPower(0);
    this.trajectory.setVisible(false);
  }

  onMouseUp() {
    if (this.state !== 'CHARGING') return;
    if (this.power < 1) {
      this.state = 'AIM';
      this.charging = false;
      this.dragStart = null;
      this.power = 0;
      this.ui.setPower(0);
      this.setAimTrajectoryVisible(true);
      this.updateAimDirection();
      this.updateTrajectory();
      return;
    }
    this.state = 'SHOOTING';
    this.charging = false;
    this.dragStart = null;
    this.shoot();
  }

  updateDragPower() {
    const cueBall = this.ballsManager.getCueBall();
    if (!cueBall || cueBall.pocketed || !this.dragStart) return;

    const rect = this.renderer.renderer.domElement.getBoundingClientRect();
    const ballScreen = cueBall.mesh.position.clone().project(this.camera);
    const pullAnchor = cueBall.mesh.position.clone().addScaledVector(this.lockedAimDirection, -24);
    const anchorScreen = pullAnchor.project(this.camera);

    const ballX = (ballScreen.x * 0.5 + 0.5) * rect.width + rect.left;
    const ballY = (-ballScreen.y * 0.5 + 0.5) * rect.height + rect.top;
    const anchorX = (anchorScreen.x * 0.5 + 0.5) * rect.width + rect.left;
    const anchorY = (-anchorScreen.y * 0.5 + 0.5) * rect.height + rect.top;

    let pullX = anchorX - ballX;
    let pullY = anchorY - ballY;
    const pullLen = Math.hypot(pullX, pullY);
    if (pullLen < 0.001) return;
    pullX /= pullLen;
    pullY /= pullLen;

    const dragX = this.input.mouseX - this.dragStart.x;
    const dragY = this.input.mouseY - this.dragStart.y;
    const pullDistance = Math.max(0, dragX * pullX + dragY * pullY);
    this.power = Math.min(SHOT.maxPower, pullDistance * 0.42);
    this.ui.setPower((this.power / SHOT.maxPower) * 100);

    const cuePullback = (this.power / SHOT.maxPower) * 24;
    this.cue.setAim(cueBall.mesh.position, this.lockedAimDirection, cuePullback);
  }

  updateAimDirection() {
    const cueBall = this.ballsManager.getCueBall();
    if (!cueBall || cueBall.pocketed) return;

    const ballPos = this._tmpVec3a.copy(cueBall.mesh.position);
    const hit = this.getMouseTablePoint(ballPos.y);
    if (!hit) return;
    const aim = new THREE.Vector3().subVectors(hit, ballPos);
    aim.y = 0;
    aim.normalize();

    if (aim.lengthSq() > 0.001) {
      this.aimDirection.copy(aim);
    }

    this.cue.setAim(ballPos, this.aimDirection);
  }

  getMouseTablePoint(y = BALL.radius) {
    const rect = this.renderer.renderer.domElement.getBoundingClientRect();
    this._tmpVec2.set(
      ((this.input.mouseX - rect.left) / rect.width) * 2 - 1,
      -((this.input.mouseY - rect.top) / rect.height) * 2 + 1
    );

    const cameraPos = this._tmpVec3b.copy(this.camera.position);
    const dir = this._tmpVec3c.set(this._tmpVec2.x, this._tmpVec2.y, 0.5)
      .unproject(this.camera)
      .sub(cameraPos)
      .normalize();

    const t = (y - cameraPos.y) / dir.y;
    if (t <= 0 || !isFinite(t)) return null;
    return cameraPos.add(dir.multiplyScalar(t));
  }

  isCueBallPlacementLegal(x, z) {
    const halfW = TABLE.width / 2 - BALL.radius * 1.1;
    const halfD = TABLE.depth / 2 - BALL.radius * 1.1;
    if (x < -halfW || x > halfW || z < -halfD || z > halfD) return false;

    for (const pocket of this.table.getPocketPositions()) {
      const dx = x - pocket.x;
      const dz = z - pocket.z;
      if (dx * dx + dz * dz < (POCKET.radius + BALL.radius * 0.45) ** 2) {
        return false;
      }
    }

    for (const ball of this.ballsManager.balls) {
      if (ball.id === 0 || ball.pocketed) continue;
      const dx = x - ball.body.position.x;
      const dz = z - ball.body.position.z;
      if (dx * dx + dz * dz < (BALL.radius * 2.15) ** 2) {
        return false;
      }
    }
    return true;
  }

  startBallInHand(message = '') {
    const cueBall = this.ballsManager.getCueBall();
    if (cueBall?.pocketed) {
      this.ballsManager.resetCueBallIfPocketed();
    }
    this.ballInHand = true;
    this.ballInHandValid = false;
    this.power = 0;
    this.ui.setPower(0);
    this.cue.hide();
    this.trajectory.setVisible(false);
    this.ui.setMessage(`${message ? `${message} ` : ''}自由球：白球可以在球桌内任意摆放，移动鼠标预览，左键确认。`);
    this.updateBallInHandPreview();
  }

  updateBallInHandPreview() {
    const cueBall = this.ballsManager.getCueBall();
    const point = this.getMouseTablePoint(BALL.radius);
    if (!cueBall || !point) return;

    const halfW = TABLE.width / 2 - BALL.radius * 1.1;
    const halfD = TABLE.depth / 2 - BALL.radius * 1.1;
    const x = Math.max(-halfW, Math.min(halfW, point.x));
    const z = Math.max(-halfD, Math.min(halfD, point.z));
    this.ballInHandValid = this.isCueBallPlacementLegal(x, z);

    if (this.ballInHandValid) {
      cueBall.reset(x, BALL.radius, z);
    }
  }

  confirmBallInHandPlacement() {
    this.updateBallInHandPreview();
    if (!this.ballInHandValid) {
      this.ui.setMessage('自由球：当前位置无效，请放在台面内且不要贴住其他球或袋口。', 2500);
      return;
    }
    this.ballInHand = false;
    this.ballInHandValid = false;
    this.cue.show();
    this.setAimTrajectoryVisible(true);
    this.updateAimDirection();
    this.updateTrajectory();
    this.ui.setMessage('自由球已放置。继续瞄准，后拉球杆击球。', 1800);
  }

  setAimTrajectoryVisible(visible) {
    if (!this.trajectory) return;
    this.trajectory.setVisible(Boolean(visible && this.trajectoryEnabled && this.state === 'AIM'));
  }

  updateTrajectory() {
    if (!this.trajectory || !this.trajectory.visible) return;
    if (this.state !== 'AIM') return;

    const cueBall = this.ballsManager.getCueBall();
    if (!cueBall || cueBall.pocketed) return;

    this.trajectory.update(
      cueBall,
      this.aimDirection,
      this.ballsManager.balls,
      this.table.getPocketPositions()
    );
  }

  shoot() {
    const cueBall = this.ballsManager.getCueBall();
    if (!cueBall) return;

    // Track whether this shot is the break shot for achievement purposes
    this._isBreakShot = this.rules.breakShot;

    const force = Math.max(this.power, SHOT.minPower);
    cueBall.applyImpulse(
      this.aimDirection.x * force,
      0,
      this.aimDirection.z * force,
      this.spin.x,
      this.spin.z
    );

    this.audio.playCueHit(force);

    // Stats & effects
    this.turnPocketedIds = [];
    this.statsTracker.startTurn(this.currentPlayer);
    this.statsTracker.recordShot(this.currentPlayer, force);
    this.achievements.onShot(cueBall, force, this.spin, this.currentPlayer);
    if (this.challengeManager) this.challengeManager.onShot(cueBall, force, this.spin);
    this.particles.spawnChalkDust(
      cueBall.mesh.position,
      this.aimDirection,
      force
    );
    this.trails.startRecording(cueBall);
    this.recorder.start(this.ballsManager, this.mode, force, this.spin);

    this.cue.hide();
    this.trajectory.setVisible(false);

    this.rules.startShot(this.currentPlayer);
  }

  async startAITurn() {
    if (this.state === 'AI_THINKING') return;
    this.state = 'AI_THINKING';
    this.ui.setMessage('AI is thinking...');
    this.trajectory.setVisible(false);
    this.cue.hide();

    let decision = null;
    try {
      decision = await this.aiPlayer.takeTurn(this);
    } catch (err) {
      console.error('AI turn failed', err);
      if (this.state === 'AI_THINKING') {
        this.state = 'AIM';
        this.power = 0;
        this.ui.setPower(0);
        this.ui.setMessage('AI failed to plan a shot. Player control restored.', 4000);
        this.cue.show();
        this.setAimTrajectoryVisible(true);
      }
      return;
    }

    if (this.state !== 'AI_THINKING') return; // player may have cancelled
    if (!decision) {
      this.state = 'AIM';
      this.power = 0;
      this.ui.setPower(0);
      this.cue.show();
      this.setAimTrajectoryVisible(true);
      return;
    }

    // Set aim
    this.aimDirection.set(decision.aimDirection.x, 0, decision.aimDirection.z).normalize();
    this.cue.setAim(this.ballsManager.getCueBall().mesh.position, this.aimDirection);
    this.cue.show();

    await this.aiPlayer.delay(400); // brief aim pause

    if (this.state !== 'AI_THINKING') return; // game may have been reset

    // Charge
    this.state = 'CHARGING';
    this.charging = true;
    this.power = 0;
    this.trajectory.setVisible(false);
    this.cue.hide();

    // Animate charging
    const targetPower = decision.power;
    const chargeStart = performance.now();
    const chargeDuration = (targetPower / SHOT.chargeRate) * 1000;

    await new Promise(resolve => {
      const tick = () => {
        const elapsed = performance.now() - chargeStart;
        const progress = Math.min(elapsed / chargeDuration, 1);
        this.power = targetPower * progress;
        this.ui.setPower((this.power / SHOT.maxPower) * 100);

        if (progress < 1 && this.state === 'CHARGING') {
          requestAnimationFrame(tick);
        } else {
          resolve();
        }
      };
      tick();
    });

    if (this.state !== 'CHARGING') return;

    // Shoot
    this.state = 'SHOOTING';
    this.charging = false;
    this.shoot();
  }

  _trackShotDistance(ball) {
    if (this.state === 'SHOOTING' && ball.id === 0) {
      this.achievements.onShotUpdate(ball);
    }
  }

  update(dt) {
    const pocketPositions = this.table.getPocketPositions();
    this.ballsManager.updatePhysicsGuards(dt, pocketPositions);
    this.ballsManager.sync();

    if (this.state === 'SHOOTING') {
      const newlyPocketed = this.ballsManager.checkPockets(pocketPositions);

      // Accumulate pocketed ball IDs across frames of a single shot
      for (const entry of newlyPocketed) {
        if (!this.turnPocketedIds.includes(entry.id)) {
          this.turnPocketedIds.push(entry.id);
        }
      }

      if (newlyPocketed.length > 0) {
        this.audio.playPocket();
        for (const entry of newlyPocketed) {
          this.achievements.onPocket(entry.id, pocketPositions[entry.pocketIndex], this.mode);
          this.recorder.recordPocket(entry.id);
          if (this.challengeManager) this.challengeManager.onPocket(entry.id);
        }

        // Pocket flash particles — use the exact pocket from checkPockets
        // Deduplicate: multiple balls in same pocket = one flash
        const flashed = new Set();
        for (const entry of newlyPocketed) {
          if (flashed.has(entry.pocketIndex)) continue;
          flashed.add(entry.pocketIndex);
          const pocket = pocketPositions[entry.pocketIndex];
          if (pocket) {
            this.particles.spawnPocketFlash(pocket);
          }
        }
      }

      const cueBall = this.ballsManager.getCueBall();
      if (cueBall && !cueBall.pocketed) {
        this.trails.recordPoint(cueBall);
        if (this.challengeManager) this.challengeManager.onShotUpdate(cueBall);
      }

      if (this.ballsManager.allStopped()) {
        this.resolveTurn(this.turnPocketedIds);
      }
    }

    // Update visual effects
    this.trails.update(dt);
    this.particles.update(dt);
    if (this.challengeManager) {
      this._updateChallengeHUD();
      // Auto-end challenge when completed or failed (debounced, 2s delay)
      if ((this.challengeManager.completed || this.challengeManager.failed) && !this._challengeEnding) {
        this._challengeEnding = true;
        this._challengeEndTimeout = setTimeout(() => {
          if (this.onReturnToMenu) this.onReturnToMenu();
        }, 2000);
      }
    }
    if (this.state === 'SHOOTING') {
      this.recorder.update(dt, this.ballsManager);
    }

    // Camera mode updates
    this._updateCamera();

    if (this.state === 'AIM' && this.cue.visible) {
      this.updateAimDirection();
      this.setAimTrajectoryVisible(true);
      this.updateTrajectory();
    } else if (this.state === 'CHARGING' && this.cue.visible) {
      this.updateDragPower();
    }
  }

  resolveTurn(pocketedIds) {
    this.trails.stopRecording();

    // Save replay if shot was interesting
    this.recorder.stop();
    const replayData = this.recorder.getReplayData();
    if (replayData && this.replayLibrary) {
      this.replayLibrary.save(replayData);
    }
    this.recorder.reset();

    const cueBall = this.ballsManager.getCueBall();
    const cuePocketed = cueBall.pocketed;

    // Free Play mode: no rules, no win/lose, no turn switching
    if (this.mode === 'freeplay') {
      if (cuePocketed) {
        this.ballsManager.resetCueBallIfPocketed();
        this.audio.playFoul();
      }
      this.state = 'AIM';
      this.power = 0;
      this.ui.setPower(0);
      this.cue.show();
      this.setAimTrajectoryVisible(true);
      return;
    }

    const result = this.rules.resolveShot(pocketedIds, cuePocketed);

    // Record stats for this turn (filter out cue ball from pocket stats)
    for (const id of pocketedIds) {
      if (id !== 0) {
        this.statsTracker.recordPocket(this.currentPlayer, id);
      }
    }
    if (result.foul) {
      this.statsTracker.recordFoul(this.currentPlayer, result.scratch);
    } else if (pocketedIds.length === 0) {
      this.statsTracker.recordMiss(this.currentPlayer);
    }

    if (result.gameOver) {
      this.state = 'GAME_OVER';
      this.ui.setMessage(result.message);
      this.ui.showResetButton(() => this.resetGame());

      const summary = this.statsTracker.endGame(result.winner);
      this.statsPanel.showGameOver(summary, this.aiEnabled);

      // Achievement: game end
      const duration = (performance.now() - this.gameStartTime) / 1000;
      const stats = summary.player1 || summary.player2 ? summary : null;
      this.achievements.onGameEnd(
        result.winner, this.currentPlayer, this.mode,
        this.aiPlayer?.difficulty || 'normal', duration, stats
      );
      if (this.challengeManager) {
        this.challengeManager.onGameEnd(result.winner);
      }

      if (result.winner === this.currentPlayer) {
        this.audio.playWin();
      } else {
        this.audio.playFoul();
      }
      return;
    }

    this.ui.setMessage(result.message, 4000);
    this.currentPlayer = result.nextPlayer;
    this.ui.setPlayerTurn(this.currentPlayer);

    const status = this.rules.getStatus();
    this.ui.setPlayerGroups(status.player1Group, status.player2Group);

    if (result.foul || result.scratch) {
      this.audio.playFoul();
      this.achievements.onFoul();
    }

    // Achievement: turn end
    this.achievements.onTurnEnd(result, pocketedIds, this.mode);
    if (this.challengeManager) this.challengeManager.onTurnEnd(result);

    // Achievement: break shot check
    if (this._isBreakShot) {
      this.achievements.onBreakShot(pocketedIds, this.mode);
      if (this.challengeManager) this.challengeManager.onBreakShot(pocketedIds);
      this._isBreakShot = false;
    }

    if (result.scratch) {
      this.ballsManager.resetCueBallIfPocketed();
    }

    this.state = 'AIM';
    this.power = 0;
    this.ui.setPower(0);
    this.cue.show();
    this.setAimTrajectoryVisible(true);

    if (result.ballInHand) {
      this.startBallInHand(result.message);
    }

    // Update live stats panel
    this.statsPanel.update(this.statsTracker.getLiveStats());

    // Trigger AI if needed
    if (this.aiEnabled && this.currentPlayer === 2) {
      if (this.ballInHand) {
        this.ballInHand = false;
        const cue = this.ballsManager.getCueBall();
        cue?.reset(0, BALL.radius, -TABLE.depth / 2 * 0.35);
      }
      this.startAITurn();
    }
  }

  resetGame() {
    for (const ball of this.ballsManager.balls) {
      this.scene.remove(ball.mesh);
      this.physics.removeBody(ball.body);
      ball.geometry.dispose();
      ball.material.dispose();
    }

    this.ballsManager = new BallsManager(this.physics);
    this.ballsManager.createBalls();
    const rackMode = this.mode === '9ball' ? '9ball' : '8ball';
    this.ballsManager.rackBalls(rackMode);
    this.ballsManager.addToScene(this.scene);
    this.setupCollisionEvents();

    this.rules.reset();
    this.statsTracker.reset();
    this.particles.clear();
    this.trails.clear();
    this.recorder.reset();
    this.statsPanel.reset();
    if (this.challengeManager) this.challengeManager.resetMatch();
    this.currentPlayer = 1;
    this.state = 'AIM';
    this.ballInHand = false;
    this.ballInHandValid = false;
    this.power = 0;
    this.ui.setPower(0);
    this.ui.setPlayerTurn(1);
    this.ui.setPlayerGroups(null, null);
    if (this.mode === 'freeplay') {
      this.ui.setMessage('练习模式：无胜负规则；白球进袋会自动复位，自由球可在球桌内任意摆放。');
    } else if (this.mode === '9ball') {
      this.ui.setMessage('新 9 球局：白球必须先碰当前最小号码球；合法打进 9 号球获胜。');
    } else {
      this.ui.setMessage(this.aiEnabled
        ? '新 8 球局：玩家 1 开球，对手为 AI；先清完本组再打 8 号球。'
        : '新 8 球局：玩家 1 开球；先清完本组再打 8 号球。');
    }
    this.ui.hideResetButton();
    this.ui.showResetButton(() => this.resetGame());
    this.cue.show();
    this.setAimTrajectoryVisible(true);
  }

  _addBackToMenuButton() {
    const uiLayer = document.getElementById('ui-layer');
    if (!uiLayer || uiLayer.querySelector('#back-to-menu')) return;

    const btn = document.createElement('button');
    btn.id = 'back-to-menu';
    btn.textContent = '返回菜单';
    btn.style.cssText = `
      position: absolute; top: 18px; right: 24px;
      padding: 10px 17px; font-size: 13px; font-weight: 750;
      background: rgba(12,14,17,0.6); color: #fff;
      border: 1px solid rgba(255,255,255,0.18);
      border-radius: 8px; cursor: pointer; pointer-events: auto;
      backdrop-filter: blur(10px); transition: all 0.2s;
      box-shadow: 0 10px 28px rgba(0,0,0,0.26);
      z-index: 15;
    `;
    btn.onmouseenter = () => {
      btn.style.background = 'rgba(255,255,255,0.2)';
      btn.style.borderColor = 'rgba(255,255,255,0.5)';
    };
    btn.onmouseleave = () => {
      btn.style.background = 'rgba(255,255,255,0.1)';
      btn.style.borderColor = 'rgba(255,255,255,0.25)';
    };
    btn.onclick = () => {
      if (this.onReturnToMenu) this.onReturnToMenu();
    };
    uiLayer.appendChild(btn);
  }

  _addSpinIndicator() {
    const uiLayer = document.getElementById('ui-layer');
    if (!uiLayer || uiLayer.querySelector('#spin-indicator')) return;

    const container = document.createElement('div');
    container.id = 'spin-indicator';
    container.style.cssText = `
      position: absolute; bottom: 48px; right: 72px;
      width: 62px; height: 62px;
      border: 1px solid rgba(255,255,255,0.22);
      border-radius: 50%;
      background: rgba(10,12,15,0.58);
      backdrop-filter: blur(10px);
      pointer-events: none;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 12px 34px rgba(0,0,0,0.34), inset 0 0 0 1px rgba(255,255,255,0.06);
      z-index: 15;
    `;

    const dot = document.createElement('div');
    dot.id = 'spin-dot';
    dot.style.cssText = `
      width: 10px; height: 10px;
      background: #00e676;
      border-radius: 50%;
      box-shadow: 0 0 8px rgba(0,230,118,0.6);
      transition: transform 0.15s ease;
    `;
    container.appendChild(dot);

    const label = document.createElement('div');
    label.textContent = '旋转';
    label.style.cssText = `
      position: absolute; bottom: -18px; left: 50%;
      transform: translateX(-50%);
      font-size: 10px; color: rgba(255,255,255,0.5);
      white-space: nowrap;
    `;
    container.appendChild(label);

    uiLayer.appendChild(container);
    this._updateSpinIndicator();
  }

  _updateSpinIndicator() {
    const dot = document.getElementById('spin-dot');
    if (!dot) return;
    // Map spin [-1,1] to pixel offset within the 60px circle
    const maxOff = 22;
    const x = this.spin.x * maxOff;
    const z = -this.spin.z * maxOff; // invert Z for visual (up = negative spinZ)
    dot.style.transform = `translate(${x}px, ${z}px)`;
  }

  _setupSpinControls() {
    this._onKeyDown = (e) => {
      const key = e.key.toLowerCase();

      // Camera mode switching (works in any state)
      if (key === '1') {
        this.cameraMode = 'free';
        this._resetCameraFree();
        return;
      }
      if (key === '2') {
        this.cameraMode = 'top';
        this._resetCameraTop();
        return;
      }
      if (key === '3') {
        this.cameraMode = 'follow';
        return;
      }

      // Spin controls only in AIM/CHARGING
      if (this.state !== 'AIM' && this.state !== 'CHARGING') return;
      const step = 0.2;
      let changed = false;
      switch (key) {
        case 'w':
          this.spin.z = Math.max(-1, this.spin.z - step);
          changed = true;
          break;
        case 's':
          this.spin.z = Math.min(1, this.spin.z + step);
          changed = true;
          break;
        case 'a':
          this.spin.x = Math.max(-1, this.spin.x - step);
          changed = true;
          break;
        case 'd':
          this.spin.x = Math.min(1, this.spin.x + step);
          changed = true;
          break;
        case 'r':
          this.spin.x = 0;
          this.spin.z = 0;
          changed = true;
          break;
      }
      if (changed) {
        this._updateSpinIndicator();
      }
    };
    window.addEventListener('keydown', this._onKeyDown);
  }

  _resetCameraFree() {
    const cam = this.camera;
    cam.position.set(0, 320, 280);
    cam.lookAt(0, 0, 0);
    if (this.renderer.controls) {
      this.renderer.controls.target.set(0, 0, 0);
      this.renderer.controls.enabled = true;
    }
  }

  _resetCameraTop() {
    const cam = this.camera;
    cam.position.set(0, 450, 0);
    cam.lookAt(0, 0, 0);
    if (this.renderer.controls) {
      this.renderer.controls.target.set(0, 0, 0);
      this.renderer.controls.enabled = true;
    }
  }

  _updateChallengeHUD() {
    if (!this.challengeManager) return;
    const data = this.challengeManager.getHUDData();
    let el = document.getElementById('challenge-hud');
    if (!el) {
      el = document.createElement('div');
      el.id = 'challenge-hud';
      el.style.cssText = `
        position: absolute; top: 20px; left: 20px;
        padding: 10px 16px;
        background: rgba(0,0,0,0.6);
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 10px;
        backdrop-filter: blur(8px);
        color: #fff;
        font-size: 13px;
        pointer-events: none;
        z-index: 15;
        max-width: 220px;
        transition: border-color 0.3s;
      `;
      document.getElementById('ui-layer').appendChild(el);
    }
    // Only update DOM when data actually changes
    const newHash = `${data.name}|${data.progress}|${data.completed}|${data.failed}`;
    if (el.dataset.hash === newHash) return;
    el.dataset.hash = newHash;

    const statusColor = data.completed ? '#00e676' : data.failed ? '#ff5252' : '#fff';
    el.innerHTML = `
      <div style="font-weight:700;margin-bottom:4px;">${data.name}</div>
      <div style="color:${statusColor};">${data.progress}</div>
    `;
    if (data.completed || data.failed) {
      el.style.borderColor = data.completed ? 'rgba(0,230,118,0.5)' : 'rgba(255,82,82,0.5)';
    }
  }

  _updateCamera() {
    if (this.renderer._shiftCameraControl) return;

    if (this.cameraMode === 'follow') {
      const cueBall = this.ballsManager.getCueBall();
      if (cueBall && !cueBall.pocketed) {
        const pos = cueBall.mesh.position;
        const cam = this.camera;
        // Position camera behind and above the cue ball
        const offsetY = 120;
        const offsetZ = -140;
        const targetX = pos.x;
        const targetY = pos.y + offsetY;
        const targetZ = pos.z + offsetZ;

        // Smooth follow
        cam.position.x += (targetX - cam.position.x) * 0.05;
        cam.position.y += (targetY - cam.position.y) * 0.05;
        cam.position.z += (targetZ - cam.position.z) * 0.05;
        cam.lookAt(pos.x, pos.y, pos.z);

        if (this.renderer.controls) {
          this.renderer.controls.enabled = false;
        }
      }
    }
  }

  dispose() {
    // Remove back-to-menu button
    const backBtn = document.getElementById('back-to-menu');
    if (backBtn && backBtn.parentNode) {
      backBtn.parentNode.removeChild(backBtn);
    }

    // Remove spin indicator
    const spinInd = document.getElementById('spin-indicator');
    if (spinInd && spinInd.parentNode) {
      spinInd.parentNode.removeChild(spinInd);
    }

    // Remove spin keyboard listener
    if (this._onKeyDown) {
      window.removeEventListener('keydown', this._onKeyDown);
      this._onKeyDown = null;
    }

    // Destroy achievement panel
    if (this.achievementPanel) {
      this.achievementPanel.destroy();
      this.achievementPanel = null;
    }

    // Remove all balls
    if (this.ballsManager) {
      for (const ball of this.ballsManager.balls) {
        this.scene.remove(ball.mesh);
        this.physics.removeBody(ball.body);
        ball.geometry.dispose();
        ball.material.dispose();
      }
      this.ballsManager = null;
    }

    // Remove room
    if (this.room) {
      this.room.dispose();
      this.room = null;
    }

    // Remove table (physics bodies first)
    if (this.physics) {
      this.physics.removeTableBody();
    }
    if (this.table) {
      this.table.dispose();
      this.table = null;
    }

    // Remove cue
    if (this.cue) {
      this.scene.remove(this.cue.mesh);
      this.cue = null;
    }

    // Remove trajectory
    if (this.trajectory) {
      this.trajectory.dispose();
      this.trajectory = null;
    }

    // Clear effects
    if (this.particles) {
      this.particles.dispose();
      this.particles = null;
    }
    if (this.trails) {
      this.trails.dispose();
      this.trails = null;
    }

    // Stop audio (BGM may still be playing)
    if (this.audio) {
      this.audio.stopBGM();
      this.audio = null;
    }

    // Remove event listeners
    window.removeEventListener('toggleTrajectory', this._onToggleTrajectory);
    window.removeEventListener('toggleShotTrail', this._onToggleShotTrail);

    // Destroy UI elements created by this game session
    if (this.ui) {
      this.ui.destroy();
      this.ui = null;
    }
    if (this.statsPanel) {
      this.statsPanel.destroy();
      this.statsPanel = null;
    }

    // Remove challenge HUD
    const chHud = document.getElementById('challenge-hud');
    if (chHud && chHud.parentNode) {
      chHud.parentNode.removeChild(chHud);
    }

    // Cancel pending challenge end timeout
    if (this._challengeEndTimeout) {
      clearTimeout(this._challengeEndTimeout);
      this._challengeEndTimeout = null;
    }
    this._challengeEnding = false;

    // Clean up input
    if (this.input) {
      this.input.dispose();
      this.input = null;
    }

    this.state = 'DISPOSED';
  }

  render(renderer) {
    // Per-frame render logic if needed
  }
}
