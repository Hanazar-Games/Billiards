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
import { Minimap } from '../ui/Minimap.js';
import { AudioManager } from '../audio/AudioManager.js';
import { AIPlayer, AI_DIFFICULTY } from '../ai/AIPlayer.js';
import { TrajectoryPredictor } from './TrajectoryPredictor.js';
import { StatsTracker } from '../stats/StatsTracker.js';
import { StatsPanel } from '../stats/StatsPanel.js';
import { ParticleSystem } from '../fx/ParticleSystem.js';
import { ShotTrailSystem } from '../fx/ShotTrail.js';
import { ImpactShockwave } from '../fx/ImpactShockwave.js';
import { ScreenShake } from '../fx/ScreenShake.js';
import { PowerLabel } from '../fx/PowerLabel.js';
import { ShotRecorder } from '../replay/ShotRecorder.js';
import { settings } from '../core/SettingsStore.js';
import { keyBindings } from '../input/KeyBindings.js';
import { BALL, TABLE, POCKET, SHOT } from '../config.js';
import { animMs } from '../core/AnimSpeed.js';


export class Game {
  constructor(renderer, physics, audioManager = null) {
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
    // Use injected shared AudioManager, or create our own if standalone
    this.audio = audioManager || new AudioManager();
    this._ownsAudio = !audioManager;
    this.aiPlayer = null;
    this.trajectory = null;
    this.powerLabel = null;
    this.achievements = null;
    this.statsTracker = new StatsTracker();
    this.statsPanel = new StatsPanel();
    this.particles = new ParticleSystem(this.scene);
    this.trails = new ShotTrailSystem(this.scene);
    this.shockwaves = new ImpactShockwave(this.scene);
    this.screenShake = new ScreenShake(this.camera);
    this.powerLabel = new PowerLabel();
    this.minimap = new Minimap();
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

    // Cue tip offset for english/spin: [-1, 1] for X (left/right) and Y (top/bottom)
    this.cueTipOffset = { x: 0, y: 0 };

    // Camera mode: 'free' | 'top' | 'follow'
    this.cameraMode = 'free';
    this.mode = 'local2p'; // 'freeplay' | 'local2p' | 'vsai'
    this.onReturnToMenu = null;
    this.paused = false;

    this._tmpVec2 = new THREE.Vector2();
    this._tmpVec3a = new THREE.Vector3();
    this._tmpVec3b = new THREE.Vector3();
    this._tmpVec3c = new THREE.Vector3();
    this._tmpVec3d = new THREE.Vector3();

    this.turnPocketedIds = [];
    this._isBreakShot = false;
    this._wasShiftCameraControl = false;

    // Listener refs for clean disposal
    this._ballCollideListeners = new Map(); // ballId -> listener fn
    this._cueTipBallWrap = null;
    this._cueTipListeners = [];

    // Cached canvas rect to avoid getBoundingClientRect() every frame
    this._canvasRect = null;
    this._updateCanvasRect = () => {
      this._canvasRect = this.renderer.renderer.domElement.getBoundingClientRect();
    };
    this._updateCanvasRect();
    window.addEventListener('resize', this._updateCanvasRect);
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
    this._wireBallsManagerEvents();
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

    // Mount minimap into UI layer
    const uiLayer = document.getElementById('ui-layer');
    if (uiLayer) this.minimap.mount(uiLayer);
    if (this.table) this.minimap.setPocketPositions(this.table.getPocketPositions());

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

    // Pause menu controls
    this.ui.setupPauseControls(
      () => this._togglePause(),
      () => this._hidePause(),
      () => this._openInGameSettings(),
      () => { if (this.onReturnToMenu) this.onReturnToMenu(); }
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
    this._addCueTipPicker();

    // Keyboard controls for spin
    this._setupSpinControls();

    // Apply persisted settings and listen for changes
    this._applySettings();
    this._onSettingsChanged = (e) => this._handleSettingsChange(e.detail.key, e.detail.value);
    window.addEventListener('settingsChanged', this._onSettingsChanged);

    this.setupCollisionEvents();
  }

  setAIEnabled(enabled) {
    this.aiEnabled = enabled;
    if (enabled && !this.aiPlayer) {
      this.aiPlayer = new AIPlayer(AI_DIFFICULTY.NORMAL);
    }
    if (this.currentPlayer === 2 && enabled && this.state === 'AIM' && !this.ballInHand) {
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
      const listener = (e) => {
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
          if (this.state === 'SHOOTING' && ball.id === 0 && otherBall.id !== 0) {
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
          if (this.state === 'SHOOTING') {
            this.rules.recordCushionHit?.(ball.id);
          }
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
      };
      ball.body.addEventListener('collide', listener);
      this._ballCollideListeners.set(ball.id, listener);
    }
  }

  _wireBallsManagerEvents() {
    if (!this.ballsManager) return;
    this.ballsManager.onManualBallContact = (ballA, ballB, relVel) => {
      this._handleManualBallContact(ballA, ballB, relVel);
    };
    this.ballsManager.onManualCushionContact = (ball) => {
      if (this.state === 'SHOOTING') {
        this.rules.recordCushionHit?.(ball.id);
      }
    };
  }

  _handleManualBallContact(ballA, ballB, relVel) {
    if (this.state !== 'SHOOTING') return;

    if (ballA.id === 0 && ballB.id !== 0) {
      this.rules.recordFirstHit(ballB.id);
      this.achievements.onBallCollision(relVel);
    } else if (ballB.id === 0 && ballA.id !== 0) {
      this.rules.recordFirstHit(ballA.id);
      this.achievements.onBallCollision(relVel);
    }
  }

  onMouseMove() {
    // Freeze aim while in camera-control mode
    if (this.renderer._shiftCameraControl) return;
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

    const rect = this._canvasRect;
    if (!rect) return;

    const ballScreen = this._tmpVec3a.copy(cueBall.mesh.position).project(this.camera);
    const pullAnchor = this._tmpVec3b.copy(cueBall.mesh.position).addScaledVector(this.lockedAimDirection, -24);
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
    const powerSens = settings.get('shotPowerSens') || 1.0;
    this.power = Math.min(SHOT.maxPower, pullDistance * 0.42 * powerSens);
    this.ui.setPower((this.power / SHOT.maxPower) * 100);

    const cuePullback = (this.power / SHOT.maxPower) * 40;
    this.cue.setAim(cueBall.mesh.position, this.lockedAimDirection, cuePullback);
  }

  updateAimDirection() {
    const cueBall = this.ballsManager.getCueBall();
    if (!cueBall || cueBall.pocketed) return;

    const ballPos = this._tmpVec3a.copy(cueBall.mesh.position);
    const hit = this.getMouseTablePoint(ballPos.y);
    if (!hit) return;
    const aim = this._tmpVec3d.subVectors(hit, ballPos);
    aim.y = 0;
    aim.normalize();

    if (aim.lengthSq() > 0.001) {
      this.aimDirection.copy(aim);
    }

    this.cue.setAim(ballPos, this.aimDirection);
  }

  getMouseTablePoint(y = BALL.radius) {
    const rect = this._canvasRect;
    if (!rect) return null;
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

  isCueBallPlacementLegal(x, z, behindHeadString = false) {
    const halfW = TABLE.width / 2 - BALL.radius * 1.1;
    const halfD = TABLE.depth / 2 - BALL.radius * 1.1;
    if (x < -halfW || x > halfW || z < -halfD || z > halfD) return false;

    // Behind the head string restriction (break foul ball-in-hand)
    if (behindHeadString) {
      const headStringZ = -TABLE.depth / 2 * 0.55;
      if (z > headStringZ + BALL.radius * 0.5) return false;
    }

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

  startBallInHand(message = '', behindHeadString = false) {
    const cueBall = this.ballsManager.getCueBall();
    if (cueBall?.pocketed) {
      this.ballsManager.resetCueBallIfPocketed();
    }
    this.ballInHand = true;
    this.ballInHandValid = false;
    this.ballInHandBehindLine = behindHeadString;
    this.power = 0;
    this.ui.setPower(0);
    this.cue.hide();
    this.trajectory.setVisible(false);
    if (behindHeadString) {
      this.ui.setMessage(`${message ? `${message} ` : ''}自由球：白球必须摆放在开球线后，移动鼠标预览，左键确认。`);
    } else {
      this.ui.setMessage(`${message ? `${message} ` : ''}自由球：白球可以在球桌内任意摆放，移动鼠标预览，左键确认。`);
    }
    this.updateBallInHandPreview();
  }

  updateBallInHandPreview() {
    const cueBall = this.ballsManager.getCueBall();
    const point = this.getMouseTablePoint(BALL.radius);
    if (!cueBall) return;
    if (!point) {
      this.ballInHandValid = false;
      return;
    }

    const halfW = TABLE.width / 2 - BALL.radius * 1.1;
    const halfD = TABLE.depth / 2 - BALL.radius * 1.1;
    const headStringZ = -TABLE.depth / 2 * 0.55;
    const x = Math.max(-halfW, Math.min(halfW, point.x));
    let z;
    if (this.ballInHandBehindLine) {
      z = Math.max(-halfD, Math.min(headStringZ - BALL.radius * 0.5, point.z));
    } else {
      z = Math.max(-halfD, Math.min(halfD, point.z));
    }
    this.ballInHandValid = this.isCueBallPlacementLegal(x, z, this.ballInHandBehindLine);

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
    this.ballInHandBehindLine = false;
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
    this.rules.startShot(this.currentPlayer);

    const force = Math.max(this.power, SHOT.minPower);
    cueBall.applyImpulse(
      this.aimDirection.x * force,
      0,
      this.aimDirection.z * force,
      this.cueTipOffset.x,
      this.cueTipOffset.y
    );

    this.audio.playCueHit(force);

    // Stats & effects
    this.turnPocketedIds = [];
    this.statsTracker.startTurn(this.currentPlayer);
    this.statsTracker.recordShot(this.currentPlayer, force);
    this.achievements.onShot(cueBall, force, this.cueTipOffset, this.currentPlayer);
    if (this.challengeManager) this.challengeManager.onShot(cueBall, force, this.cueTipOffset);
    this.particles.spawnChalkDust(
      cueBall.mesh.position,
      this.aimDirection,
      force
    );
    this.shockwaves?.spawn(cueBall.mesh.position, force);
    this.screenShake?.trigger(force, this.aimDirection);
    this.powerLabel?.show(force);
    this.trails.startRecording(cueBall);
    this.recorder.start(this.ballsManager, this.mode, force, this.cueTipOffset);

    // Strike snap: cue visually touches the ball for one frame before hiding
    this.cue.strikeSnap(cueBall.mesh.position, this.aimDirection);
    if (this._strikeHideTimer) clearTimeout(this._strikeHideTimer);
    this._strikeHideTimer = setTimeout(() => {
      if (this.cue) this.cue.hide();
      if (this.trajectory) this.trajectory.setVisible(false);
      this._strikeHideTimer = null;
    }, animMs(70));

    // Auto-switch to follow mode if enabled
    if (settings.get('autoFollowCueBall') && this.cameraMode !== 'follow') {
      this.cameraMode = 'follow';
    }
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

    // Set aim and spin
    this.aimDirection.set(decision.aimDirection.x, 0, decision.aimDirection.z).normalize();
    this.cueTipOffset = decision.cueTipOffset || { x: 0, y: 0 };
    this._updateCueTipPicker();
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
        if (this.ui) this.ui.setPower((this.power / SHOT.maxPower) * 100);

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
    if (this.paused) return;
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
        const flashed = new Set();
        for (const entry of newlyPocketed) {
          const isFirstTime = !this.turnPocketedIds.includes(entry.id);
          if (isFirstTime) {
            this.turnPocketedIds.push(entry.id);
            this.achievements.onPocket(entry.id, pocketPositions[entry.pocketIndex], this.mode);
            this.recorder.recordPocket(entry.id);
            if (this.challengeManager) this.challengeManager.onPocket(entry.id);
          }
          const pocket = pocketPositions[entry.pocketIndex];
          if (!pocket) continue;
          // Visual FX only on first detection per ball
          if (isFirstTime) {
            if (!flashed.has(entry.pocketIndex)) {
              flashed.add(entry.pocketIndex);
              this.particles.spawnPocketFlash(pocket);
            }
            this.particles.spawnPocketFountain(pocket, entry.id);
            if (this.renderer?.camera && this.renderer.width > 0 && this.renderer.height > 0) {
              const p = this._tmpVec3a.set(pocket.x, pocket.y + 15, pocket.z);
              p.project(this.renderer.camera);
              const sx = (p.x * 0.5 + 0.5) * this.renderer.width;
              const sy = (-p.y * 0.5 + 0.5) * this.renderer.height;
              const txt = entry.id === 8 ? '🎱 8号球!' : (entry.id === 0 ? '⚠️ 白球' : `+${entry.id}`);
              const col = entry.id === 0 ? '#ff6b6b' : (entry.id === 8 ? '#fff' : '#d8b15f');
              this.ui.showFloatingText(txt, sx, sy, col);
            }
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
    this.shockwaves.update(dt);
    this.screenShake.update(dt);
    if (this.minimap && this.ballsManager) {
      this.minimap.updateBallData(this.ballsManager.balls);
      this.minimap.draw();
    }
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

    // Fade table lights when they obstruct the camera view
    if (this.room) {
      this.room.updateLampOpacity(this.camera);
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
        this.ui.flashRed();
      }
      this.state = 'AIM';
      this.power = 0;
      this.ui.setPower(0);
      this.cue.show();
      this.setAimTrajectoryVisible(true);
      return;
    }

    const result = this.rules.resolveShot(pocketedIds, cuePocketed);

    // Respot 8-ball or 9-ball if pocketed on break / foul
    if (result.respotEightBall) {
      const eightBall = this.ballsManager.getBall(8);
      if (eightBall && eightBall.pocketed) {
        const footZ = TABLE.depth / 2 * 0.55;
        // Ensure foot spot is clear; if not, offset along X
        let finalX = 0;
        const checkClear = (x, z) => {
          for (const b of this.ballsManager.balls) {
            if (b.id === 8 || b.pocketed) continue;
            const dx = b.body.position.x - x;
            const dz = b.body.position.z - z;
            if (dx * dx + dz * dz < (BALL.radius * 2.2) ** 2) return false;
          }
          return true;
        };
        if (!checkClear(0, footZ)) {
          for (let offset = 1; offset <= 10; offset++) {
            if (checkClear(offset * BALL.radius * 2, footZ)) { finalX = offset * BALL.radius * 2; break; }
            if (checkClear(-offset * BALL.radius * 2, footZ)) { finalX = -offset * BALL.radius * 2; break; }
          }
        }
        eightBall.pocketed = false;
        eightBall.mesh.visible = true;
        eightBall.setPosition(finalX, BALL.radius, footZ);
      }
    }
    if (result.respotNineBall) {
      const nineBall = this.ballsManager.getBall(9);
      if (nineBall && nineBall.pocketed) {
        const footZ = TABLE.depth / 2 * 0.55;
        let finalX = 0;
        const checkClear = (x, z) => {
          for (const b of this.ballsManager.balls) {
            if (b.id === 9 || b.pocketed) continue;
            const dx = b.body.position.x - x;
            const dz = b.body.position.z - z;
            if (dx * dx + dz * dz < (BALL.radius * 2.2) ** 2) return false;
          }
          return true;
        };
        if (!checkClear(0, footZ)) {
          for (let offset = 1; offset <= 10; offset++) {
            if (checkClear(offset * BALL.radius * 2, footZ)) { finalX = offset * BALL.radius * 2; break; }
            if (checkClear(-offset * BALL.radius * 2, footZ)) { finalX = -offset * BALL.radius * 2; break; }
          }
        }
        nineBall.pocketed = false;
        nineBall.mesh.visible = true;
        nineBall.setPosition(finalX, BALL.radius, footZ);
      }
    }

    // Filter out respotted balls before counting stats/achievements
    const effectivePocketedIds = pocketedIds.filter((id) => {
      if (id === 0) return false; // cue ball never counts
      if (result.respotEightBall && id === 8) return false;
      if (result.respotNineBall && id === 9) return false;
      return true;
    });

    // Record stats for this turn
    for (const id of effectivePocketedIds) {
      this.statsTracker.recordPocket(this.currentPlayer, id);
    }
    if (result.foul) {
      this.statsTracker.recordFoul(this.currentPlayer, result.scratch);
    } else if (effectivePocketedIds.length === 0) {
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
        this.ui.flashRed();
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
      this.ui.flashRed();
      this.achievements.onFoul();
    }

    // Achievement: turn end
    this.achievements.onTurnEnd(result, effectivePocketedIds, this.mode);
    if (this.challengeManager) this.challengeManager.onTurnEnd(result);

    // Achievement: break shot check
    if (this._isBreakShot) {
      this.achievements.onBreakShot(effectivePocketedIds, this.mode);
      if (this.challengeManager) this.challengeManager.onBreakShot(effectivePocketedIds);
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
      this.startBallInHand(result.message, result.ballInHandBehindLine);
    }

    // Update live stats panel
    this.statsPanel.update(this.statsTracker.getLiveStats());

    // Trigger AI if needed
    if (this.aiEnabled && this.currentPlayer === 2) {
      if (this.ballInHand) {
        this.ballInHand = false;
        const cue = this.ballsManager.getCueBall();
        const behindLine = this.ballInHandBehindLine;
        this.ballInHandBehindLine = false;
        // Find a legal cue-ball placement for AI
        let placed = false;
        const headStringZ = -TABLE.depth / 2 * 0.55;
        const candidates = [];
        if (behindLine) {
          // Behind head string: scan along a line slightly behind the string
          for (let x = 0; x <= 10; x++) {
            candidates.push({ x: x * BALL.radius * 2.5, z: headStringZ - BALL.radius * 2 });
            if (x > 0) candidates.push({ x: -x * BALL.radius * 2.5, z: headStringZ - BALL.radius * 2 });
          }
        } else {
          // Full ball-in-hand: scan a grid near the head end
          for (let x = 0; x <= 6; x++) {
            for (let z = -3; z <= 0; z++) {
              candidates.push({ x: x * BALL.radius * 2.5, z: headStringZ + z * BALL.radius * 2.5 });
              if (x > 0) candidates.push({ x: -x * BALL.radius * 2.5, z: headStringZ + z * BALL.radius * 2.5 });
            }
          }
        }
        for (const pos of candidates) {
          if (this.isCueBallPlacementLegal(pos.x, pos.z, behindLine)) {
            cue?.reset(pos.x, BALL.radius, pos.z);
            placed = true;
            break;
          }
        }
        if (!placed) {
          // Fallback: let resetCueBallIfPocketed pick a spot
          const fallback = this.ballsManager.resetCueBallIfPocketed(0, headStringZ - BALL.radius * 2);
          cue?.reset(fallback.x, BALL.radius, fallback.z);
        }
      }
      // Reset AI spin so human player starts with center hit
      this.cueTipOffset = { x: 0, y: 0 };
      this._updateCueTipPicker();
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

    this._ballCollideListeners.clear();
    this.ballsManager = new BallsManager(this.physics);
    this.ballsManager.createBalls();
    const rackMode = this.mode === '9ball' ? '9ball' : '8ball';
    this.ballsManager.rackBalls(rackMode);
    this._wireBallsManagerEvents();
    this.ballsManager.addToScene(this.scene);
    this.setupCollisionEvents();

    this.rules.reset();
    this.statsTracker.reset();
    this.particles.clear();
    this.trails.clear();
    this.shockwaves?.clear();
    this.screenShake?.cancel();
    this.recorder.reset();
    this.statsPanel.reset();
    if (this.challengeManager) this.challengeManager.resetMatch();

    // Clear challenge auto-end timeout
    if (this._challengeEndTimeout) {
      clearTimeout(this._challengeEndTimeout);
      this._challengeEndTimeout = null;
    }
    this._challengeEnding = false;

    // Remove stale challenge HUD
    const chHud = document.getElementById('challenge-hud');
    if (chHud && chHud.parentNode) {
      chHud.parentNode.removeChild(chHud);
    }

    this.currentPlayer = 1;
    this.state = 'AIM';
    this.ballInHand = false;
    this.ballInHandValid = false;
    this.ballInHandBehindLine = false;
    this.cueTipOffset = { x: 0, y: 0 };
    this._updateCueTipPicker();
    this.power = 0;
    this.charging = false;
    this.dragStart = null;
    this.turnPocketedIds = [];
    this._isBreakShot = false;
    this.gameStartTime = performance.now();
    this.cameraMode = 'free';
    this.powerLabel?.dispose();
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
      backdrop-filter: blur(10px); transition: all calc(0.2s / var(--ui-anim-speed));
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

  _addCueTipPicker() {
    const uiLayer = document.getElementById('ui-layer');
    if (!uiLayer || uiLayer.querySelector('#cue-tip-picker')) return;

    const container = document.createElement('div');
    container.id = 'cue-tip-picker';
    container.style.cssText = `
      position: absolute; bottom: 38px; right: 60px;
      width: 110px; display: flex; flex-direction: column; align-items: center;
      gap: 6px; z-index: 15; user-select: none;
    `;

    // Label
    const label = document.createElement('div');
    label.textContent = '击球点';
    label.style.cssText = `
      font-size: 11px; color: rgba(255,255,255,0.6);
      font-weight: 600; letter-spacing: 0.5px;
    `;
    container.appendChild(label);

    // Ball surface circle
    const ballWrap = document.createElement('div');
    ballWrap.id = 'cue-tip-ball';
    ballWrap.style.cssText = `
      width: 88px; height: 88px; border-radius: 50%;
      background: radial-gradient(circle at 35% 35%, #ffffff 0%, #e0e0e0 50%, #b0b0b0 100%);
      border: 2px solid rgba(255,255,255,0.35);
      box-shadow: 0 6px 20px rgba(0,0,0,0.45), inset 0 0 12px rgba(0,0,0,0.15);
      position: relative; cursor: crosshair; overflow: hidden;
      flex-shrink: 0;
    `;

    // Crosshair (centre lines)
    const hLine = document.createElement('div');
    hLine.style.cssText = `
      position: absolute; top: 50%; left: 0; width: 100%; height: 1px;
      background: rgba(0,0,0,0.18); transform: translateY(-50%); pointer-events: none;
    `;
    ballWrap.appendChild(hLine);
    const vLine = document.createElement('div');
    vLine.style.cssText = `
      position: absolute; left: 50%; top: 0; height: 100%; width: 1px;
      background: rgba(0,0,0,0.18); transform: translateX(-50%); pointer-events: none;
    `;
    ballWrap.appendChild(vLine);

    // Rim circle (max legal hit)
    const rim = document.createElement('div');
    rim.style.cssText = `
      position: absolute; top: 50%; left: 50%; width: 82%; height: 82%;
      border: 1px dashed rgba(255,60,60,0.35); border-radius: 50%;
      transform: translate(-50%, -50%); pointer-events: none;
    `;
    ballWrap.appendChild(rim);

    // Tip marker (red dot)
    const marker = document.createElement('div');
    marker.id = 'cue-tip-marker';
    marker.style.cssText = `
      position: absolute; width: 10px; height: 10px; border-radius: 50%;
      background: #ff3b30; border: 1.5px solid #fff;
      box-shadow: 0 0 6px rgba(255,59,48,0.7);
      transform: translate(-50%, -50%); pointer-events: none;
      top: 50%; left: 50%; transition: top calc(0.08s / var(--ui-anim-speed)), left 0.08s;
    `;
    ballWrap.appendChild(marker);

    // Text hint
    const hint = document.createElement('div');
    hint.id = 'cue-tip-hint';
    hint.textContent = '中心击球';
    hint.style.cssText = `
      font-size: 10px; color: rgba(255,255,255,0.45);
      text-align: center; min-height: 14px;
    `;
    container.appendChild(ballWrap);
    container.appendChild(hint);

    uiLayer.appendChild(container);
    this._updateCueTipPicker();

    // Mouse / touch interaction
    let dragging = false;
    const RADIUS_PX = 44; // half of 88px
    const MAX_OFF = 0.88; // keep inside rim

    const setOffsetFromEvent = (e) => {
      const rect = ballWrap.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const rawX = (e.clientX - cx) / RADIUS_PX;
      const rawY = -(e.clientY - cy) / RADIUS_PX; // Y up = positive cueTipOffset.y
      const dist = Math.hypot(rawX, rawY);
      const clampedDist = Math.min(dist, MAX_OFF);
      const scale = dist > 0 ? clampedDist / dist : 0;
      this.cueTipOffset.x = rawX * scale;
      this.cueTipOffset.y = rawY * scale;
      this._updateCueTipPicker();
    };

    const onPointerDown = (e) => {
      if (this.state !== 'AIM' && this.state !== 'CHARGING') return;
      dragging = true;
      ballWrap.setPointerCapture(e.pointerId);
      setOffsetFromEvent(e);
      e.preventDefault();
    };
    const onPointerMove = (e) => {
      if (!dragging) return;
      setOffsetFromEvent(e);
      e.preventDefault();
    };
    const onPointerUp = () => { dragging = false; };
    const onPointerCancel = () => { dragging = false; };

    ballWrap.addEventListener('pointerdown', onPointerDown);
    ballWrap.addEventListener('pointermove', onPointerMove);
    ballWrap.addEventListener('pointerup', onPointerUp);
    ballWrap.addEventListener('pointercancel', onPointerCancel);

    this._cueTipBallWrap = ballWrap;
    this._cueTipListeners = [
      { type: 'pointerdown', fn: onPointerDown },
      { type: 'pointermove', fn: onPointerMove },
      { type: 'pointerup', fn: onPointerUp },
      { type: 'pointercancel', fn: onPointerCancel },
    ];
  }

  _updateCueTipPicker() {
    const marker = document.getElementById('cue-tip-marker');
    const hint = document.getElementById('cue-tip-hint');
    if (!marker || !hint) return;

    const ox = this.cueTipOffset.x;
    const oy = this.cueTipOffset.y;
    const RADIUS_PX = 44;
    const maxOff = 0.88 * RADIUS_PX;

    marker.style.left = `${50 + (ox / 0.88) * 41}%`;
    marker.style.top = `${50 - (oy / 0.88) * 41}%`;

    // Build descriptive label
    const parts = [];
    if (Math.abs(ox) > 0.08) parts.push(ox > 0 ? '右塞' : '左塞');
    if (Math.abs(oy) > 0.08) parts.push(oy > 0 ? '高杆' : '低杆');
    hint.textContent = parts.length ? parts.join(' + ') : '中心击球';
  }

  _setupSpinControls() {
    this._onKeyDown = (e) => {
      const key = e.key.toLowerCase();
      const mods = { ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey, meta: e.metaKey };

      // Camera mode switching (works in any state)
      if (keyBindings.matches('cameraFree', key, mods)) {
        this.cameraMode = 'free';
        this._resetCameraFree();
        return;
      }
      if (keyBindings.matches('cameraTop', key, mods)) {
        this.cameraMode = 'top';
        this._resetCameraTop();
        return;
      }
      if (keyBindings.matches('cameraFollow', key, mods)) {
        this.cameraMode = 'follow';
        return;
      }
      if (keyBindings.matches('pause', key, mods)) {
        this._togglePause();
        return;
      }

      // Cue tip offset controls only in AIM/CHARGING
      if (this.state !== 'AIM' && this.state !== 'CHARGING') return;
      const step = 0.15 * (settings.get('spinStepSens') || 1.0);
      let changed = false;
      // Prevent default for any bound spin key
      if (keyBindings.matches('spinUp', key, mods) || keyBindings.matches('spinDown', key, mods) ||
          keyBindings.matches('spinLeft', key, mods) || keyBindings.matches('spinRight', key, mods) ||
          keyBindings.matches('spinReset', key, mods)) {
        e.preventDefault();
      }
      if (keyBindings.matches('spinUp', key, mods)) {
        this.cueTipOffset.y = Math.min(0.88, this.cueTipOffset.y + step);
        changed = true;
      } else if (keyBindings.matches('spinDown', key, mods)) {
        this.cueTipOffset.y = Math.max(-0.88, this.cueTipOffset.y - step);
        changed = true;
      } else if (keyBindings.matches('spinLeft', key, mods)) {
        this.cueTipOffset.x = Math.max(-0.88, this.cueTipOffset.x - step);
        changed = true;
      } else if (keyBindings.matches('spinRight', key, mods)) {
        this.cueTipOffset.x = Math.min(0.88, this.cueTipOffset.x + step);
        changed = true;
      } else if (keyBindings.matches('spinReset', key, mods)) {
        this.cueTipOffset.x = 0;
        this.cueTipOffset.y = 0;
        changed = true;
      }
      if (changed) {
        this._updateCueTipPicker();
      }
    };
    window.addEventListener('keydown', this._onKeyDown);
  }

  _resetCameraFree() {
    this.screenShake?.cancel();
    const cam = this.camera;
    cam.position.set(0, 320, 280);
    cam.lookAt(0, 0, 0);
    if (this.renderer.controls) {
      this.renderer.controls.target.set(0, 0, 0);
      this.renderer.controls.enabled = true;
    }
  }

  _resetCameraTop() {
    this.screenShake?.cancel();
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
        transition: border-color calc(0.3s / var(--ui-anim-speed));
      `;
      const uiLayer = document.getElementById('ui-layer');
      if (uiLayer) uiLayer.appendChild(el);
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
    if (this.renderer._shiftCameraControl) {
      this._wasShiftCameraControl = true;
      return;
    }

    // Shift was just released: snap aim to the current camera view
    if (this._wasShiftCameraControl) {
      this._wasShiftCameraControl = false;
      if (this.state === 'AIM' && !this.ballInHand) {
        this._snapAimToCameraView();
      }
    }

    // Screen shake takes over camera position briefly; skip follow/orbit.
    if (this.screenShake?.active) {
      // Still disable orbit controls so they don't fight the shake
      if (this.renderer.controls) {
        this.renderer.controls.enabled = false;
      }
      return;
    }

    if (this.cameraMode === 'follow') {
      // Disable orbit controls so follow mode doesn't fight user input
      if (this.renderer.controls) {
        this.renderer.controls.enabled = false;
      }
      const cueBall = this.ballsManager.getCueBall();
      if (cueBall && !cueBall.pocketed) {
        const pos = cueBall.mesh.position;
        const cam = this.camera;
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
      }
    } else if (this.renderer.controls) {
      // Re-enable orbit controls when leaving follow mode
      this.renderer.controls.enabled = true;
    }
  }

  _snapAimToCameraView() {
    const cueBall = this.ballsManager.getCueBall();
    if (!cueBall || cueBall.pocketed) return;

    const ballPos = cueBall.mesh.position;

    // Project camera look direction onto the table plane (XZ)
    const camDir = this._tmpVec3c;
    this.camera.getWorldDirection(camDir);
    camDir.y = 0;
    if (camDir.lengthSq() < 0.001) return;
    camDir.normalize();

    this.aimDirection.copy(camDir);
    this.lockedAimDirection.copy(camDir);
    this.cue.setAim(ballPos, this.aimDirection);
    this.updateTrajectory();
  }

  _togglePause() {
    if (this.paused) {
      this._hidePause();
    } else {
      this._showPause();
    }
  }

  _showPause() {
    this.paused = true;
    this.ui.showPauseMenu();
  }

  _hidePause() {
    this.paused = false;
    this.ui.hidePauseMenu();
  }

  _openInGameSettings() {
    this.ui.showInGameSettings(this.audio);
  }

  _applySettings() {
    this.trajectoryEnabled = settings.get('trajectoryEnabled');
    if (this.particles) this.particles.setEnabled(settings.get('particlesEnabled'));
    if (this.trails) this.trails.setEnabled(settings.get('shotTrailsEnabled'));

    const defaultCam = settings.get('defaultCamera');
    if (defaultCam && ['free', 'top', 'follow'].includes(defaultCam)) {
      this.cameraMode = defaultCam;
      if (defaultCam === 'top') this._resetCameraTop();
      else if (defaultCam === 'free') this._resetCameraFree();
    }
  }

  _handleSettingsChange(key, value) {
    switch (key) {
      case 'trajectoryEnabled':
        this.trajectoryEnabled = value;
        this.setAimTrajectoryVisible(this.state === 'AIM');
        break;
      case 'particlesEnabled':
        if (this.particles) this.particles.setEnabled(value);
        break;
      case 'shotTrailsEnabled':
        if (this.trails) this.trails.setEnabled(value);
        break;
      case 'defaultCamera':
        if (['free', 'top', 'follow'].includes(value)) {
          this.cameraMode = value;
          if (value === 'top') this._resetCameraTop();
          else if (value === 'free') this._resetCameraFree();
        }
        break;
    }
  }

  dispose() {
    if (this._strikeHideTimer) {
      clearTimeout(this._strikeHideTimer);
      this._strikeHideTimer = null;
    }
    // Remove canvas rect resize listener
    if (this._updateCanvasRect) {
      window.removeEventListener('resize', this._updateCanvasRect);
      this._updateCanvasRect = null;
    }

    // Remove back-to-menu button
    const backBtn = document.getElementById('back-to-menu');
    if (backBtn) {
      backBtn.onclick = null;
      backBtn.onmouseenter = null;
      backBtn.onmouseleave = null;
      if (backBtn.parentNode) backBtn.parentNode.removeChild(backBtn);
    }

    // Remove cue tip picker and its listeners
    if (this._cueTipBallWrap && this._cueTipListeners) {
      for (const { type, fn } of this._cueTipListeners) {
        this._cueTipBallWrap.removeEventListener(type, fn);
      }
      this._cueTipBallWrap = null;
      this._cueTipListeners = [];
    }
    const picker = document.getElementById('cue-tip-picker');
    if (picker && picker.parentNode) {
      picker.parentNode.removeChild(picker);
    }

    this._hidePause();

    // Remove settings change listener
    if (this._onSettingsChanged) {
      window.removeEventListener('settingsChanged', this._onSettingsChanged);
      this._onSettingsChanged = null;
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

    // Remove all balls and their collide listeners
    if (this.ballsManager) {
      for (const ball of this.ballsManager.balls) {
        const listener = this._ballCollideListeners.get(ball.id);
        if (listener) {
          ball.body.removeEventListener('collide', listener);
        }
        this.scene.remove(ball.mesh);
        this.physics.removeBody(ball.body);
        ball.geometry.dispose();
        ball.material.dispose();
      }
      this._ballCollideListeners.clear();
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
      this.cue.dispose();
      this.cue = null;
    }

    // Cancel active screen shake before nulling
    if (this.screenShake) {
      this.screenShake.cancel();
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
    if (this.shockwaves) {
      this.shockwaves.dispose();
      this.shockwaves = null;
    }
    this.screenShake = null;
    if (this.powerLabel) {
      this.powerLabel.dispose();
      this.powerLabel = null;
    }
    if (this.minimap) {
      this.minimap.dispose();
      this.minimap = null;
    }

    // Stop audio (only dispose if we own the instance)
    if (this.audio) {
      this.audio.stopBGM();
      if (this._ownsAudio) {
        this.audio.dispose();
      }
      this.audio = null;
    }

    // Remove event listeners
    window.removeEventListener('toggleTrajectory', this._onToggleTrajectory);
    window.removeEventListener('toggleShotTrail', this._onToggleShotTrail);
    this._onToggleTrajectory = null;
    this._onToggleShotTrail = null;

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

    // Null out remaining references to aid GC
    this.onReturnToMenu = null;
    this.recorder = null;
    this.challengeManager = null;
    this.statsTracker = null;
    this.statsPanel = null;
    this.trajectory = null;
    this.renderer = null;
    this.physics = null;
    this.scene = null;
    this.camera = null;

    this.state = 'DISPOSED';
  }

  render(renderer) {
    // Per-frame render logic if needed
  }
}
