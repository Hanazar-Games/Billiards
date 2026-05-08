import * as THREE from 'three';
import { Table } from './Table.js';
import { BallsManager } from './BallsManager.js';
import { InputHandler } from '../input/InputHandler.js';
import { Cue } from './Cue.js';
import { Rules } from './Rules.js';
import { UI } from '../ui/UI.js';
import { AudioManager } from '../audio/AudioManager.js';
import { AIPlayer, AI_DIFFICULTY } from '../ai/AIPlayer.js';
import { TrajectoryPredictor } from './TrajectoryPredictor.js';
import { StatsTracker } from '../stats/StatsTracker.js';
import { StatsPanel } from '../stats/StatsPanel.js';
import { ParticleSystem } from '../fx/ParticleSystem.js';
import { ShotTrailSystem } from '../fx/ShotTrail.js';
import { SHOT } from '../config.js';

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
    this.rules = new Rules();
    this.ui = new UI();
    this.audio = new AudioManager();
    this.aiPlayer = null;
    this.trajectory = null;
    this.statsTracker = new StatsTracker();
    this.statsPanel = new StatsPanel();
    this.particles = new ParticleSystem(this.scene);
    this.trails = new ShotTrailSystem(this.scene);

    this.state = 'AIM'; // AIM, CHARGING, SHOOTING, RESOLVING, AI_THINKING, GAME_OVER
    this.power = 0;
    this.charging = false;
    this.currentPlayer = 1;
    this.aimDirection = new THREE.Vector3(0, 0, 1);
    this.aiEnabled = false;

    this._tmpVec2 = new THREE.Vector2();
    this._tmpVec3a = new THREE.Vector3();
    this._tmpVec3b = new THREE.Vector3();
    this._tmpVec3c = new THREE.Vector3();
    this._tmpVec3d = new THREE.Vector3();

    this.turnPocketedIds = [];
  }

  async init() {
    this.audio.init();

    this.table = new Table(this.physics);
    this.table.addToScene(this.scene);

    this.ballsManager = new BallsManager(this.physics);
    this.ballsManager.createBalls();
    this.ballsManager.rackBalls();
    this.ballsManager.addToScene(this.scene);

    this.input = new InputHandler(this.renderer.renderer.domElement);
    this.input.onMouseMove = () => this.onMouseMove();
    this.input.onMouseDown = () => this.onMouseDown();
    this.input.onMouseUp = () => this.onMouseUp();

    this.cue = new Cue();
    this.scene.add(this.cue.mesh);

    this.trajectory = new TrajectoryPredictor(this.scene);

    this.statsTracker.reset();
    this.particles.clear();

    this.ui.setPlayerTurn(1);
    this.ui.setMessage('Aim with mouse, hold LEFT CLICK to charge, release to shoot. RIGHT CLICK to rotate camera.');
    this.ui.setupAIControls(
      (enabled) => this.setAIEnabled(enabled),
      (difficulty) => this.setAIDifficulty(difficulty),
      (enabled) => this.audio.toggleSound(enabled)
    );
    window.addEventListener('toggleTrajectory', (e) => {
      if (this.trajectory) this.trajectory.setVisible(e.detail);
    });
    window.addEventListener('toggleShotTrail', (e) => {
      if (this.trails) this.trails.setEnabled(e.detail);
    });
    this.ui.showResetButton(() => this.resetGame());

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
          }

          // Deduplicate: cannon-es fires collide on BOTH bodies.
          // Use lower ID as canonical to process each pair exactly once.
          if (ball.id < otherBall.id) {
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
          }
        }
      });
    }
  }

  onMouseMove() {
    if (this.state !== 'AIM' && this.state !== 'CHARGING') return;
    this.updateAimDirection();
    this.updateTrajectory();
  }

  onMouseDown() {
    if (this.state !== 'AIM') return;
    if (this.aiEnabled && this.currentPlayer === 2) return; // AI turn
    this.audio.resume();
    this.state = 'CHARGING';
    this.charging = true;
    this.power = 0;
    this.trajectory.setVisible(false);
  }

  onMouseUp() {
    if (this.state !== 'CHARGING') return;
    this.state = 'SHOOTING';
    this.charging = false;
    this.shoot();
  }

  updateAimDirection() {
    const cueBall = this.ballsManager.getCueBall();
    if (!cueBall || cueBall.pocketed) return;

    const rect = this.renderer.renderer.domElement.getBoundingClientRect();
    this._tmpVec2.set(
      ((this.input.mouseX - rect.left) / rect.width) * 2 - 1,
      -((this.input.mouseY - rect.top) / rect.height) * 2 + 1
    );

    const ballPos = this._tmpVec3a.copy(cueBall.mesh.position);
    const cameraPos = this._tmpVec3b.copy(this.camera.position);

    const dir = this._tmpVec3c.set(this._tmpVec2.x, this._tmpVec2.y, 0.5)
      .unproject(this.camera)
      .sub(cameraPos)
      .normalize();

    const t = (ballPos.y - cameraPos.y) / dir.y;
    if (t <= 0 || !isFinite(t)) return;

    const hit = cameraPos.add(dir.multiplyScalar(t));
    const aim = new THREE.Vector3().subVectors(hit, ballPos);
    aim.y = 0;
    aim.normalize();

    if (aim.lengthSq() > 0.001) {
      this.aimDirection.copy(aim);
    }

    this.cue.setAim(ballPos, this.aimDirection);
  }

  updateTrajectory() {
    if (!this.trajectory || !this.trajectory.visible) return;
    if (this.state !== 'AIM' && this.state !== 'CHARGING') return;

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

    const force = Math.max(this.power, SHOT.minPower);
    cueBall.applyImpulse(
      this.aimDirection.x * force,
      0,
      this.aimDirection.z * force
    );

    this.audio.playCueHit(force);

    // Stats & effects
    this.turnPocketedIds = [];
    this.statsTracker.startTurn(this.currentPlayer);
    this.statsTracker.recordShot(this.currentPlayer, force);
    this.particles.spawnChalkDust(
      cueBall.mesh.position,
      this.aimDirection,
      force
    );
    this.trails.startRecording(cueBall);

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

    const decision = await this.aiPlayer.takeTurn(this);

    if (this.state !== 'AI_THINKING') return; // player may have cancelled

    // Set aim
    this.aimDirection.set(decision.aimDirection.x, 0, decision.aimDirection.z).normalize();
    this.cue.setAim(this.ballsManager.getCueBall().mesh.position, this.aimDirection);
    this.cue.show();

    // Show trajectory briefly for visual feedback
    this.trajectory.setVisible(true);
    this.updateTrajectory();

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

  update(dt) {
    if (this.charging) {
      this.power = Math.min(this.power + SHOT.chargeRate * dt, SHOT.maxPower);
      this.ui.setPower((this.power / SHOT.maxPower) * 100);
    }

    this.ballsManager.sync();

    if (this.state === 'SHOOTING') {
      const newlyPocketed = this.ballsManager.checkPockets(this.table.getPocketPositions());

      // Accumulate pocketed ball IDs across frames of a single shot
      for (const entry of newlyPocketed) {
        if (!this.turnPocketedIds.includes(entry.id)) {
          this.turnPocketedIds.push(entry.id);
        }
      }

      if (newlyPocketed.length > 0) {
        this.audio.playPocket();

        // Pocket flash particles — use the exact pocket from checkPockets
        // Deduplicate: multiple balls in same pocket = one flash
        const pockets = this.table.getPocketPositions();
        const flashed = new Set();
        for (const entry of newlyPocketed) {
          if (flashed.has(entry.pocketIndex)) continue;
          flashed.add(entry.pocketIndex);
          const pocket = pockets[entry.pocketIndex];
          if (pocket) {
            this.particles.spawnPocketFlash(pocket);
          }
        }
      }

      const cueBall = this.ballsManager.getCueBall();
      if (cueBall && !cueBall.pocketed) {
        this.trails.recordPoint(cueBall);
      }

      if (this.ballsManager.allStopped()) {
        this.resolveTurn(this.turnPocketedIds);
      }
    }

    // Update visual effects
    this.trails.update(dt);
    this.particles.update(dt);

    if ((this.state === 'AIM' || this.state === 'CHARGING') && this.cue.visible) {
      this.updateAimDirection();
      this.updateTrajectory();
    }
  }

  resolveTurn(pocketedIds) {
    this.trails.stopRecording();

    const cueBall = this.ballsManager.getCueBall();
    const cuePocketed = cueBall.pocketed;

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
    }

    if (result.scratch) {
      this.ballsManager.resetCueBallIfPocketed();
    }

    this.state = 'AIM';
    this.power = 0;
    this.ui.setPower(0);
    this.cue.show();
    this.trajectory.setVisible(true);

    // Update live stats panel
    this.statsPanel.update(this.statsTracker.getLiveStats());

    // Trigger AI if needed
    if (this.aiEnabled && this.currentPlayer === 2) {
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
    this.ballsManager.rackBalls();
    this.ballsManager.addToScene(this.scene);
    this.setupCollisionEvents();

    this.rules.reset();
    this.statsTracker.reset();
    this.particles.clear();
    this.trails.clear();
    this.statsPanel.reset();
    this.currentPlayer = 1;
    this.state = 'AIM';
    this.power = 0;
    this.ui.setPower(0);
    this.ui.setPlayerTurn(1);
    this.ui.setPlayerGroups(null, null);
    this.ui.setMessage(this.aiEnabled ? 'New game! Player 1 breaks (vs AI).' : 'New game! Player 1 breaks.');
    this.ui.hideResetButton();
    this.ui.showResetButton(() => this.resetGame());
    this.cue.show();
    this.trajectory.setVisible(true);
  }

  render(renderer) {
    // Per-frame render logic if needed
  }
}
