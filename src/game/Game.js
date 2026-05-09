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
    this.rules = null;
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
    this.input.onMouseDown = () => this.onMouseDown();
    this.input.onMouseUp = () => this.onMouseUp();

    this.cue = new Cue();
    this.scene.add(this.cue.mesh);

    this.trajectory = new TrajectoryPredictor(this.scene);

    this.statsTracker.reset();
    this.particles.clear();
    this.gameStartTime = performance.now();

    this.ui.setPlayerTurn(1);
    if (this.mode === 'freeplay') {
      this.ui.setMessage('练习模式 — 无限击球，白球进袋自动重生');
    } else if (this.mode === '9ball') {
      this.ui.setMessage('9-ball 模式 — 按顺序击球，9号球进袋即胜！');
    } else {
      this.ui.setMessage('Aim with mouse, hold LEFT CLICK to charge, release to shoot. RIGHT CLICK to rotate camera.');
    }
    this.ui.setupAIControls(
      (enabled) => this.setAIEnabled(enabled),
      (difficulty) => this.setAIDifficulty(difficulty),
      (enabled) => this.audio.toggleSound(enabled)
    );
    this._onToggleTrajectory = (e) => {
      if (this.trajectory) this.trajectory.setVisible(e.detail);
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
      this.aimDirection.z * force,
      this.spin.x,
      this.spin.z
    );

    this.audio.playCueHit(force);

    // Stats & effects
    this.turnPocketedIds = [];
    this.statsTracker.startTurn(this.currentPlayer);
    this.statsTracker.recordShot(this.currentPlayer, force);
    this.achievements.onShot(cueBall, force, this.spin);
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

  _trackShotDistance(ball) {
    if (this.state === 'SHOOTING' && ball.id === 0) {
      this.achievements.onShotUpdate(ball);
    }
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
        for (const entry of newlyPocketed) {
          const pockets = this.table.getPocketPositions();
          this.achievements.onPocket(entry.id, pockets[entry.pocketIndex], this.mode);
        }

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

    // Camera mode updates
    this._updateCamera();

    if ((this.state === 'AIM' || this.state === 'CHARGING') && this.cue.visible) {
      this.updateAimDirection();
      this.updateTrajectory();
    }
  }

  resolveTurn(pocketedIds) {
    this.trails.stopRecording();

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
      this.trajectory.setVisible(true);
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

    // Achievement: break shot check
    if (this.rules.breakShot === false && pocketedIds.length > 0) {
      this.achievements.onBreakShot(pocketedIds, this.mode);
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
    if (this.mode === 'freeplay') {
      this.ui.setMessage('练习模式 — 无限击球');
    } else {
      this.ui.setMessage(this.aiEnabled ? 'New game! Player 1 breaks (vs AI).' : 'New game! Player 1 breaks.');
    }
    this.ui.hideResetButton();
    this.ui.showResetButton(() => this.resetGame());
    this.cue.show();
    this.trajectory.setVisible(true);
  }

  _addBackToMenuButton() {
    const uiLayer = document.getElementById('ui-layer');
    if (!uiLayer || uiLayer.querySelector('#back-to-menu')) return;

    const btn = document.createElement('button');
    btn.id = 'back-to-menu';
    btn.textContent = '返回菜单';
    btn.style.cssText = `
      position: absolute; top: 20px; right: 20px;
      padding: 8px 18px; font-size: 13px; font-weight: 600;
      background: rgba(255,255,255,0.1); color: #fff;
      border: 1px solid rgba(255,255,255,0.25);
      border-radius: 8px; cursor: pointer; pointer-events: auto;
      backdrop-filter: blur(4px); transition: all 0.2s;
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
      position: absolute; bottom: 44px; right: 80px;
      width: 60px; height: 60px;
      border: 2px solid rgba(255,255,255,0.3);
      border-radius: 50%;
      background: rgba(0,0,0,0.4);
      backdrop-filter: blur(4px);
      pointer-events: none;
      display: flex; align-items: center; justify-content: center;
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

  _updateCamera() {
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

    // Remove event listeners
    window.removeEventListener('toggleTrajectory', this._onToggleTrajectory);
    window.removeEventListener('toggleShotTrail', this._onToggleShotTrail);

    // Destroy UI elements created by this game session
    if (this.statsPanel) {
      this.statsPanel.destroy();
      this.statsPanel = null;
    }

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
