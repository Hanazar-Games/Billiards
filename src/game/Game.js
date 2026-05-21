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
import { BallReturnSystem } from '../fx/BallReturnSystem.js';
import { ShotRecorder } from '../replay/ShotRecorder.js';
import { settings, MATCH_FAIRNESS_KEYS } from '../core/SettingsStore.js';
import { keyBindings } from '../input/KeyBindings.js';
import { BALL, SHOT, CAMERA } from '../config.js';
import { getTableProfile, resolveTableProfileId, validateModeTableProfile } from './TableProfiles.js';
import { GameStateSerializer } from '../net/GameStateSerializer.js';
import { SettingsScreen } from '../menu/SettingsScreen.js';
import { animMs } from '../core/AnimSpeed.js';
import { createShotInput, applyShotInput } from './ShotInput.js';
import { UIText } from '../core/UIText.js';
import { OnboardingTips } from '../ui/OnboardingTips.js';
import { onboarding } from '../core/OnboardingStore.js';


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
    this.onboardingTips = new OnboardingTips();

    this.state = 'AIM'; // AIM, CHARGING, SHOOTING, RESOLVING, AI_THINKING, GAME_OVER
    this.power = 0;
    this.charging = false;
    this.currentPlayer = 1;
    this.aimDirection = new THREE.Vector3(0, 0, 1);
    this.lockedAimDirection = new THREE.Vector3(0, 0, 1);
    this.dragStart = null;
    this.directPullAim = false;
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

    // Network multiplayer fields
    this.networkMode = null; // null | 'lan'
    this.networkRole = null; // null | 'host' | 'client'
    this.localPlayerId = 1;
    this.networkController = null;
    this._lastSnapshotTime = 0;
    this.networkPlayer1Name = '玩家 1';
    this.networkPlayer2Name = '玩家 2';
    this._netDisconnectHandled = false;
    this._netDisconnectTimer = null;

    // Host-authority fairness settings (overrides local settings in client mode)
    this._hostFairness = null;

    // Local match mode
    this.matchManager = null;

    this._tmpVec2 = new THREE.Vector2();
    this._tmpVec3a = new THREE.Vector3();
    this._tmpVec3b = new THREE.Vector3();
    this._tmpVec3c = new THREE.Vector3();
    this._tmpVec3d = new THREE.Vector3();

    this.turnPocketedIds = [];
    this._shotStartTime = null;
    this._isBreakShot = false;
    this._wasShiftCameraControl = false;

    // Turn timer
    this._turnTimerEnabled = false;
    this._turnTimerMax = 0; // seconds, 0 = off
    this._turnTimerRemaining = 0;
    this._turnTimerRunning = false;
    this._settingsOpen = false;
    this.inGameSettings = null;
    this.tableProfile = null;
    this.tableProfileId = null;

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
    if (this._initialized) {
      console.warn('[Game] init() called twice on same instance');
      return;
    }
    this.mode = modeConfig.mode || 'local2p';
    this.drillConfig = modeConfig.drill || null;
    this.aiEnabled = modeConfig.aiEnabled || false;

    // Resolve table profile (match setting, locked for the whole game)
    const validated = validateModeTableProfile(this.mode, modeConfig.tableProfileId);
    if (!validated.valid) {
      console.warn('[Game] Invalid mode/profile combo (%s / %s): %s. Falling back to pool9ft.',
        this.mode, modeConfig.tableProfileId, validated.reason);
    }
    this.tableProfileId = resolveTableProfileId(modeConfig, settings);
    this.tableProfile = getTableProfile(this.tableProfileId);
    this.ballReturn = new BallReturnSystem(this.scene, this.tableProfile);
    if (modeConfig.aiDifficulty) {
      this.aiPlayer = new AIPlayer(modeConfig.aiDifficulty);
    }

    // Create rules engine based on game mode
    if (this.mode === 'trainer') {
      // Trainer mode uses no rules engine — pure physics practice
      this.rules = null;
    } else if (this.mode === '9ball') {
      this.rules = new NineBallRules();
    } else {
      this.rules = new Rules();
    }

    // Audio manager is already initialised by MenuSystem (shared singleton).
    // Game only calls init() when it owns a standalone instance.
    if (this._ownsAudio) {
      this.audio.init();
    }

    // Initialize turn timer (disabled for freeplay / challenge / replay)
    const timerSetting = settings.get('turnTimer') || 'off';
    const isStandardMode = ['local2p', 'vsai', '9ball'].includes(this.mode) || this.matchManager;
    if (isStandardMode && timerSetting !== 'off') {
      this._turnTimerMax = parseInt(timerSetting, 10) || 30;
      this._turnTimerEnabled = true;
    } else {
      this._turnTimerEnabled = false;
      this._turnTimerMax = 0;
    }
    this._turnTimerRemaining = this._turnTimerMax;
    this._turnTimerRunning = false;

    this.table = new Table(this.physics, this.tableProfile);
    this.table.addToScene(this.scene);
    this.table.applyVisualSettings(settings);

    this.room = new Room(this.tableProfile);
    this.room.addToScene(this.scene);
    this.room.applyVisualSettings(settings);

    this.ballsManager = new BallsManager(this.physics, this.tableProfile);
    this.ballsManager.createBalls();
    if (this.mode === 'trainer' && this.drillConfig) {
      const { idealZone } = this.ballsManager.setupDrill(this.drillConfig, this.tableProfile);
      this.drillIdealZone = idealZone;
    } else {
      const rackMode = this.mode === '9ball' ? '9ball' : '8ball';
      this.ballsManager.rackBalls(rackMode);
    }
    this._wireBallsManagerEvents();
    this.ballsManager.addToScene(this.scene);
    // Apply ball visual settings after creation
    for (const ball of this.ballsManager.balls) {
      ball.updateVisualSettings(settings);
    }

    this.input = new InputHandler(this.renderer.renderer.domElement);
    this.input.onMouseMove = () => this.onMouseMove();
    this.input.onMouseDown = (e) => this.onMouseDown(e);
    this.input.onMouseUp = (e) => this.onMouseUp(e);

    this.cue = new Cue();
    this.cue.setTableProfile(this.tableProfile);
    this.cue.applyTheme(settings.get('cueTheme'));
    this.scene.add(this.cue.mesh);

    this.trajectory = new TrajectoryPredictor(this.scene, this.tableProfile);

    if (this.mode === 'trainer' && this.drillConfig) {
      const { TrainerHUD } = await import('../trainer/TrainerHUD.js');
      this.trainerHUD = new TrainerHUD(this.scene, this.drillConfig, this.tableProfile);
      if (this.drillIdealZone) {
        this.trainerHUD.showTargetZone(this.drillIdealZone);
      }
      this.trainerHUD.setOnReset(() => this._resetTrainerDrill());
    }

    if (!this.achievements) {
      this.achievements = new AchievementSystem();
    }
    this.statsTracker.reset();
    this.particles.clear();
    this.gameStartTime = performance.now();

    // Mount minimap into UI layer
    const uiLayer = document.getElementById('ui-layer');
    if (uiLayer) this.minimap.mount(uiLayer);
    if (this.table) this.minimap.setPocketPositions(this.table.getPocketPositions());
    this.minimap.setTableProfile(this.tableProfile);

    this.ui.setPlayerTurn(1);
    if (this.mode === 'freeplay') {
      this.ui.setMessage(UIText.freeplayIntro);
    } else if (this.mode === 'trainer') {
      this.ui.setMessage(UIText.trainerReset);
    } else if (this.mode === '9ball') {
      this.ui.setMessage(UIText.nineBallIntro);
    } else {
      this.ui.setMessage(UIText.eightBallIntro);
    }
    // Pause menu controls
    this.ui.setupPauseControls(
      () => this._togglePause(),
      () => this._hidePause(),
      () => this._openInGameSettings(),
      () => { if (this.onReturnToMenu) this.onReturnToMenu(); }
    );

    // Concede button (hidden in freeplay and trainer)
    this.ui.setupConcede(() => this._concede());
    this.ui.setShowConcede(this.mode !== 'freeplay' && this.mode !== 'trainer');

    // Match info
    if (this.mode === 'trainer') {
      this.ui.setMatchInfo(UIText.trainerObjective);
    } else {
      const objective = this._getObjectiveText();
      this.ui.setMatchInfo(objective);
    }
    this._updatePlayerStats();
    this._onToggleTrajectory = (e) => {
      if (this.networkRole !== 'client' || !this._hostFairness) {
        this.trajectoryEnabled = Boolean(e.detail);
      }
      this.setAimTrajectoryVisible(this.state === 'AIM');
    };
    this._onToggleShotTrail = (e) => {
      if (this.trails) this.trails.setEnabled(e.detail);
    };
    this._onToggleComboCounter = (e) => {
      if (this.ui) this.ui.setShowComboCounter(e.detail);
    };
    window.addEventListener('toggleTrajectory', this._onToggleTrajectory);
    window.addEventListener('toggleShotTrail', this._onToggleShotTrail);
    window.addEventListener('toggleComboCounter', this._onToggleComboCounter);
    if (this.mode === 'trainer') {
      this.ui.showResetButton(() => this._resetTrainerDrill(), UIText.trainerResetLabel);
    } else {
      this.ui.showResetButton(() => this._onResetButtonClicked(), UIText.gameOverResetLabel);
    }

    // Back-to-menu button
    this._addBackToMenuButton();

    // Achievement panel (guard against duplicate creation on reset)
    if (this.achievementPanel) {
      try { this.achievementPanel.destroy(); } catch (e) {}
    }
    this.achievementPanel = new AchievementPanel(this.achievements);

    // In-game settings (reuses SettingsScreen, mounted to body with high z-index)
    if (this.inGameSettings) {
      try { this.inGameSettings.destroy(); } catch (e) {}
    }
    this.inGameSettings = new SettingsScreen(() => this._onInGameSettingsClose(), document.body);
    this.inGameSettings.setAudioManager(this.audio);
    this.inGameSettings.setZIndex(100);
    // Lock fairness settings in competitive modes (both UI and SettingsStore)
    const fairnessKeys = Array.from(MATCH_FAIRNESS_KEYS);
    if (this.networkRole === 'client' || this.matchManager) {
      this.inGameSettings.setLockedKeys(fairnessKeys);
      settings.setLockedKeys(fairnessKeys);
    }

    // Spin indicator UI
    this._addCueTipPicker();

    // Keyboard controls for spin
    this._setupSpinControls();

    // Apply persisted settings and listen for changes
    this._applySettings();
    this._onSettingsChanged = (e) => this._handleSettingsChange(e.detail.key, e.detail.value);
    window.addEventListener('settingsChanged', this._onSettingsChanged);

    // For host: keep _hostFairness in sync with local settings so snapshots propagate changes
    if (this.networkRole === 'host') {
      this._hostFairness = {
        trajectoryEnabled: settings.get('trajectoryEnabled'),
        minimapEnabled: settings.get('minimapEnabled'),
        turnTimer: settings.get('turnTimer'),
        shotPowerSens: settings.get('shotPowerSens'),
        showCrosshair: settings.get('showCrosshair'),
      };
    }

    this.setupCollisionEvents();

    // Show game tutorial steps for new players
    this._showGameTutorial();
    this._initialized = true;
  }

  _showGameTutorial() {
    const step = onboarding.get('gameTutorialStep');
    if (step === 0) {
      // Network mode: only show on the device where local player is player 1
      if (this.networkMode && this.localPlayerId !== 1) return;
      this.onboardingTips.show('aim', null, 8000);
      onboarding.advanceGameTutorial();
    }
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
      this._enterAimState({ showCue: true, showTrajectory: false, updateAim: false });
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
            this.rules?.recordFirstHit(otherBall.id);
            this.achievements.onBallCollision(relVel);
              if (this.challengeManager) this.challengeManager.onBallCollision(ball, otherBall);
          }

          // Deduplicate: cannon-es fires collide on BOTH bodies.
          // Use lower ID as canonical to process each pair exactly once.
          if (ball.id < otherBall.id) {
            if (relVel > 0.5) {
              this.audio?.playBallCollision(relVel);
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
          this.ballsManager?.applyCushionSpin(ball);
          if (this.state === 'SHOOTING') {
            this.rules?.recordCushionHit?.(ball.id);
          }
          if (v > 0.8) {
            this.audio?.playCushionBounce(v);
          }

          // Subtle cushion bounce dust for significant hits (restrained)
          if (v > 1.2 && settings.get('particlesEnabled') !== false) {
            this._tmpVec3d.set(ball.mesh.position.x, ball.mesh.position.y - BALL.radius * 0.5, ball.mesh.position.z);
            this.particles.spawnCollisionSparks(this._tmpVec3d, v * 0.3);
          }

          if (this.state === 'SHOOTING' && v > 0.5) {
            this.statsTracker.recordCushionCollision(this.currentPlayer);
            this.achievements.onCushionCollision();
            this.recorder.recordCushion();
            if (this.challengeManager) this.challengeManager.onCushionHit(ball.id);
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
        this.rules?.recordCushionHit?.(ball.id);
      }
    };
  }

  _handleManualBallContact(ballA, ballB, relVel) {
    if (this.state !== 'SHOOTING') return;

    if (ballA.id === 0 && ballB.id !== 0) {
      this.rules?.recordFirstHit(ballB.id);
      this.achievements.onBallCollision(relVel);
              if (this.challengeManager) this.challengeManager.onBallCollision(ballA, ballB);
    } else if (ballB.id === 0 && ballA.id !== 0) {
      this.rules?.recordFirstHit(ballA.id);
      this.achievements.onBallCollision(relVel);
              if (this.challengeManager) this.challengeManager.onBallCollision(ballA, ballB);
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
    if (this.paused) return;
    // Recover from soft-locked CHARGING state (e.g. missed mouseup)
    if (this.state === 'CHARGING' && this.input && !this.input.isDown) {
      this._enterAimState();
    }
    if (this.state !== 'AIM') return;
    if (this.aiEnabled && this.currentPlayer === 2) return; // AI turn
    if (this.networkMode && !this.isLocalPlayerTurn()) return; // Network: not your turn
    // Block input if turn timer has expired
    if (this._turnTimerEnabled && this._turnTimerRemaining <= 0) {
      this.ui.setMessage('⏰ 回合时间已到', 2000);
      return;
    }
    if (this.ballInHand) {
      this.confirmBallInHandPlacement();
      return;
    }
    // Block shot while push-out choice is pending
    if (this.rules?.pushOutPending && this.isLocalPlayerTurn()) {
      this.ui.setMessage(UIText.pushOutMustChoose, 2000);
      return;
    }
    this.audio?.resume();
    this.updateAimDirection();
    this.lockedAimDirection.copy(this.aimDirection);
    const cueBall = this.ballsManager?.getCueBall();
    const startX = e?.clientX ?? this.input.mouseX;
    const startY = e?.clientY ?? this.input.mouseY;
    let startsNearCueBall = false;
    if (cueBall && !cueBall.pocketed && this._canvasRect) {
      const ballScreen = this._tmpVec3a.copy(cueBall.mesh.position).project(this.camera);
      const ballX = (ballScreen.x * 0.5 + 0.5) * this._canvasRect.width + this._canvasRect.left;
      const ballY = (-ballScreen.y * 0.5 + 0.5) * this._canvasRect.height + this._canvasRect.top;
      startsNearCueBall = Math.hypot(startX - ballX, startY - ballY) <= 90;
    }
    this.dragStart = {
      x: startX,
      y: startY,
      nearCueBall: startsNearCueBall,
    };
    this.directPullAim = startsNearCueBall;
    this.state = 'CHARGING';
    this.charging = true;
    this.power = 0;
    this.ui.setPower(0);
    this.trajectory?.setVisible(false);

    // Show charge tutorial on first charge
    if (onboarding.get('gameTutorialStep') === 1) {
      this.onboardingTips.show('charge', null, 8000);
      onboarding.advanceGameTutorial();
    }
  }

  onMouseUp() {
    if (this.paused) return;
    if (this.state !== 'CHARGING') return;
    if (this.power < 1) {
      this._enterAimState();
      return;
    }
    if (settings.get('confirmShotOnRelease') === false) {
      // Release only stops charging; user must press Enter to shoot
      this._enterAimState({ resetPower: false, showCue: true, showTrajectory: true, updateAim: false });
      this.ui.setMessage(UIText.pressEnterToShoot, 2000);
      return;
    }
    this.state = 'SHOOTING';
    this._shotStartTime = performance.now();
    this.charging = false;
    this.dragStart = null;
    this.directPullAim = false;

    // Show spin tutorial on first real player shot (local human only)
    if (onboarding.get('gameTutorialStep') === 2 && !(this.aiEnabled && this.currentPlayer === 2)) {
      this.onboardingTips.show('spin', null, 8000);
      onboarding.advanceGameTutorial();
    }

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
    if (pullLen < 0.001) {
      // Fallback: project aim direction onto screen when anchor overlaps ball
      const fallbackScreen = this._tmpVec3c.copy(this.lockedAimDirection).project(this.camera);
      pullX = fallbackScreen.x;
      pullY = -fallbackScreen.y;
      const fbLen = Math.hypot(pullX, pullY);
      if (fbLen < 0.001) return;
      pullX /= fbLen;
      pullY /= fbLen;
    } else {
      pullX /= pullLen;
      pullY /= pullLen;
    }

    const dragX = this.input.mouseX - this.dragStart.x;
    const dragY = this.input.mouseY - this.dragStart.y;
    const dragLen = Math.hypot(dragX, dragY);
    let rawPull = Math.max(0, dragX * pullX + dragY * pullY);

    if (this.directPullAim && dragLen > 6) {
      const currentPoint = this.getMouseTablePoint(cueBall.mesh.position.y);
      if (currentPoint) {
        const directAim = this._tmpVec3d.subVectors(cueBall.mesh.position, currentPoint);
        directAim.y = 0;
        if (directAim.lengthSq() > (BALL.radius * 2.2) ** 2) {
          directAim.normalize();
          this.lockedAimDirection.copy(directAim);
          this.aimDirection.copy(directAim);
        }
      }
      rawPull = Math.max(rawPull, dragLen);
    } else if (dragLen > 10) {
      const startBallX = this.dragStart.x - ballX;
      const startBallY = this.dragStart.y - ballY;
      const nowBallX = this.input.mouseX - ballX;
      const nowBallY = this.input.mouseY - ballY;
      const radialPull = Math.max(
        0,
        Math.hypot(nowBallX, nowBallY) - Math.hypot(startBallX, startBallY)
      );
      const offAxisAssist = dragX * pullX + dragY * pullY > -dragLen * 0.25
        ? dragLen * 0.55
        : 0;
      rawPull = Math.max(rawPull, radialPull, offAxisAssist);
    }
    const deadzone = settings.get('dragDeadzone') ?? 4;
    const pullDistance = rawPull > deadzone ? rawPull - deadzone : 0;
    const powerSens = (this.networkRole === 'client' && this._hostFairness)
      ? (this._hostFairness.shotPowerSens ?? 1.0)
      : (settings.get('shotPowerSens') || 1.0);
    this.power = Math.min(SHOT.maxPower, pullDistance * 0.42 * powerSens);
    this.ui.setPower((this.power / SHOT.maxPower) * 100);

    const cuePullback = (this.power / SHOT.maxPower) * 40;
    if (this.cue) this.cue.setAim(cueBall.mesh.position, this.lockedAimDirection, cuePullback);
  }

  updateAimDirection() {
    const cueBall = this.ballsManager.getCueBall();
    if (!cueBall || cueBall.pocketed) return;

    const ballPos = this._tmpVec3a.copy(cueBall.mesh.position);
    const hit = this.getMouseTablePoint(ballPos.y);
    if (!hit) return;
    const aim = this._tmpVec3d.subVectors(hit, ballPos);
    aim.y = 0;
    if (aim.lengthSq() < (BALL.radius * 2.2) ** 2) {
      return;
    }
    if (aim.lengthSq() > 0) aim.normalize();

    if (aim.lengthSq() > 0.001) {
      this.aimDirection.copy(aim);
    }

    if (this.cue) this.cue.setAim(ballPos, this.aimDirection);
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
    return this.getCueBallPlacementReason(x, z, behindHeadString) === null;
  }

  getCueBallPlacementReason(x, z, behindHeadString = false) {
    // Cue ball must stay inside the playing surface, clear of cushion faces
    const halfW = this.tableProfile.width / 2 - this.tableProfile.cushionWidth - BALL.radius;
    const halfD = this.tableProfile.depth / 2 - this.tableProfile.cushionWidth - BALL.radius;
    if (x < -halfW || x > halfW || z < -halfD || z > halfD) {
      return 'OUT_OF_BOUNDS';
    }

    // Behind the head string restriction (break foul ball-in-hand)
    if (behindHeadString) {
      const headStringZ = -this.tableProfile.depth / 2 * 0.55;
      if (z > headStringZ) return 'BEHIND_LINE';
    }

    for (const pocket of this.table.getPocketPositions()) {
      const dx = x - pocket.x;
      const dz = z - pocket.z;
      const avoidRadius = pocket.radius + BALL.radius * 0.45;
      if (dx * dx + dz * dz < avoidRadius * avoidRadius) {
        return 'NEAR_POCKET';
      }
    }

    for (const ball of this.ballsManager.balls) {
      if (ball.id === 0 || ball.pocketed) continue;
      const dx = x - ball.body.position.x;
      const dz = z - ball.body.position.z;
      if (dx * dx + dz * dz < (BALL.radius * 2.15) ** 2) {
        return 'NEAR_BALL';
      }
    }
    return null;
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
    if (this.cue) this.cue.hide();
    this.trajectory.setVisible(false);
    const bihMsg = behindHeadString ? UIText.ballInHandBehindLine : UIText.ballInHandAnywhere;
    this.ui.setMessage(`${message ? `${message} ` : ''}${bihMsg}`);
    this.updateBallInHandPreview();
    if (!onboarding.get('ballInHandExplained')) {
      this.onboardingTips.show('ballInHand', null, 10000);
      onboarding.set('ballInHandExplained', true);
    }
  }

  updateBallInHandPreview() {
    const cueBall = this.ballsManager.getCueBall();
    const point = this.getMouseTablePoint(BALL.radius);
    if (!cueBall) return;
    if (!point) {
      this.ballInHandValid = false;
      this.ballInHandInvalidReason = null;
      return;
    }

    // Keep cue ball fully inside the playing surface, away from cushion faces
    const halfW = this.tableProfile.width / 2 - this.tableProfile.cushionWidth - BALL.radius;
    const halfD = this.tableProfile.depth / 2 - this.tableProfile.cushionWidth - BALL.radius;
    const headStringZ = -this.tableProfile.depth / 2 * 0.55;
    const x = Math.max(-halfW, Math.min(halfW, point.x));
    let z;
    if (this.ballInHandBehindLine) {
      z = Math.max(-halfD, Math.min(headStringZ, point.z));
    } else {
      z = Math.max(-halfD, Math.min(halfD, point.z));
    }
    this.ballInHandInvalidReason = this.getCueBallPlacementReason(x, z, this.ballInHandBehindLine);
    this.ballInHandValid = this.ballInHandInvalidReason === null;

    if (this.ballInHandValid) {
      cueBall.reset(x, BALL.radius, z);
    }
  }

  confirmBallInHandPlacement() {
    if (this.paused) return;
    this.updateBallInHandPreview();
    if (!this.ballInHandValid) {
      const reasonMap = {
        OUT_OF_BOUNDS: UIText.ballInHandInvalidOutOfBounds,
        BEHIND_LINE: UIText.ballInHandInvalidBehindLine,
        NEAR_BALL: UIText.ballInHandInvalidNearBall,
        NEAR_POCKET: UIText.ballInHandInvalidNearPocket,
      };
      const msg = reasonMap[this.ballInHandInvalidReason] || UIText.ballInHandInvalid;
      this.ui.setMessage(msg, 2500);
      return;
    }

    // Network client sends placement to host instead of applying locally
    if (this.networkMode && this.networkRole === 'client') {
      const cueBall = this.ballsManager?.getCueBall();
      if (cueBall) {
        this.networkController?.sendShotInput(
          { x: 0, y: 0, z: 0 }, // aimDirection not used for placement
          0,
          { x: 0, y: 0 },
          { x: cueBall.mesh.position.x, y: cueBall.mesh.position.y, z: cueBall.mesh.position.z }
        );
      }
      if (this.cue) this.cue.show();
      this.ui.setMessage(UIText.ballInHandWaitHost, 2000);
      return;
    }

    this._endBallInHand();
  }

  setAimTrajectoryVisible(visible) {
    if (!this.trajectory) return;
    this.trajectory.setVisible(Boolean(visible && this.trajectoryEnabled && this.state === 'AIM'));
  }

  updateTrajectory(dt = 0.016) {
    if (!this.trajectory || !this.trajectory.visible) return;
    if (this.ballInHand) return;
    if (this.state !== 'AIM') return;

    const cueBall = this.ballsManager.getCueBall();
    if (!cueBall || cueBall.pocketed) return;

    this.trajectory.update(
      cueBall,
      this.aimDirection,
      this.ballsManager.balls,
      this.table.getPocketPositions(),
      dt
    );
  }

  shoot() {
    const cueBall = this.ballsManager.getCueBall();
    if (!cueBall) return;

    // Block shot while push-out choice is pending
    if (this.rules?.pushOutPending && this.isLocalPlayerTurn()) {
      this.ui.setMessage(UIText.pushOutMustChoose, 2000);
      return;
    }

    // Client sends shot intent to host; host executes physically
    if (this.networkMode && this.networkRole === 'client' && this.isLocalPlayerTurn()) {
      if (this._turnTimerEnabled && this._turnTimerRemaining <= 0) {
        this.ui.setMessage('⏰ 回合时间已到', 2000);
        return;
      }
      if (!this.networkController || !this.networkController.connected) {
        this.ui.setMessage(UIText.networkDisconnect, 2000);
        this._enterAimState();
        return;
      }
      const force = Math.max(this.power, SHOT.minPower);
      this._lastShotPower = this.power;
      this.networkController.sendShotInput(this.aimDirection, force, this.cueTipOffset);
      this.state = 'SHOOTING';
      this._shotStartTime = performance.now();
      this.charging = false;
      this.dragStart = null;
      if (settings.get('hideCueOnShot') !== false && this.cue) this.cue.hide();
      this.trajectory.setVisible(false);
      // Local immediate feedback: audio + FX (host will authoritatively resolve physics)
      this.audio?.playCueHit(force);
      this.particles.spawnChalkDust(cueBall.mesh.position, this.aimDirection, force);
      if (settings.get('impactShockwaveEnabled') !== false) {
        this.shockwaves?.spawn(cueBall.mesh.position, force);
      }
      if (settings.get('cameraShake') !== false) {
        this.screenShake?.trigger(force, this.aimDirection);
      }
      if (settings.get('vibrationEnabled')) {
        try { navigator.vibrate?.(30 + force); } catch (e) {}
      }
      this.powerLabel?.show(force);
      this.trails.startRecording(cueBall);
      this.recorder.start(this.ballsManager, this.mode, force, this.cueTipOffset, this.tableProfileId);
      return;
    }

    // Track whether this shot is the break shot for achievement purposes
    this._isBreakShot = this.rules?.breakShot || false;
    this.rules?.startShot(this.currentPlayer);

    const force = Math.max(this.power, SHOT.minPower);
    this._lastShotPower = this.power;
    cueBall.applyImpulse(
      this.aimDirection.x * force,
      0,
      this.aimDirection.z * force,
      this.cueTipOffset.x,
      this.cueTipOffset.y
    );

    this.audio?.playCueHit(force);

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
    if (settings.get('impactShockwaveEnabled') !== false) {
      this.shockwaves?.spawn(cueBall.mesh.position, force);
    }
    if (settings.get('cameraShake') !== false) {
      this.screenShake?.trigger(force, this.aimDirection);
    }
    if (settings.get('vibrationEnabled')) {
      try { navigator.vibrate?.(30 + force); } catch (e) {}
    }
    this.powerLabel?.show(force);
    this.trails.startRecording(cueBall);
    this.recorder.start(this.ballsManager, this.mode, force, this.cueTipOffset, this.tableProfileId);

    // Strike snap: cue visually touches the ball for one frame before hiding
    if (this.cue) this.cue.strikeSnap(cueBall.mesh.position, this.aimDirection);
    if (this._strikeHideTimer) clearTimeout(this._strikeHideTimer);
    const hideCue = settings.get('hideCueOnShot') !== false;
    this._strikeHideTimer = setTimeout(() => {
      if (this.cue && hideCue) this.cue.hide();
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
    this.ui.setMessage(UIText.aiThinking);
    this.trajectory.setVisible(false);
    if (this.cue) this.cue.hide();

    let decision = null;
    try {
      decision = await this.aiPlayer.takeTurn(this);
    } catch (err) {
      console.error('AI turn failed', err);
      if (this.state === 'AI_THINKING') {
        this._enterAimState({ showCue: true, showTrajectory: true, updateAim: false });
        this.ui.setMessage(UIText.aiPlanningFailed, 4000);
      }
      return;
    }

    if (this.state !== 'AI_THINKING') return; // player may have cancelled
    if (!decision) {
      this._enterAimState({ showCue: true, showTrajectory: true, updateAim: false });
      return;
    }

    // Set aim and spin
    const targetAim = new THREE.Vector3(decision.aimDirection.x, 0, decision.aimDirection.z).normalize();
    this.cueTipOffset = decision.cueTipOffset || { x: 0, y: 0 };
    this._updateCueTipPicker();
    if (!this.ballsManager || !this.cue) return; // disposed during await

    // Animate AI cue rotating toward aim direction
    const aimStart = performance.now();
    const aimDuration = 350 + Math.random() * 300;
    const startAim = this.aimDirection.clone();
    if (this.cue) this.cue.show();
    await new Promise(resolve => {
      const tick = () => {
        if (this.paused) {
          requestAnimationFrame(tick);
          return;
        }
        if (!this.cue || !this.ballsManager || this.state === 'DISPOSED') {
          resolve();
          return;
        }
        const elapsed = performance.now() - aimStart;
        const t = Math.min(elapsed / aimDuration, 1);
        // Smooth ease-out
        const eased = 1 - Math.pow(1 - t, 3);
        this.aimDirection.lerpVectors(startAim, targetAim, eased).normalize();
        if (this.cue) this.cue.setAim(this.ballsManager.getCueBall().mesh.position, this.aimDirection);
        if (t < 1 && this.state === 'AI_THINKING') {
          requestAnimationFrame(tick);
        } else {
          this.aimDirection.copy(targetAim);
          if (this.cue) this.cue.setAim(this.ballsManager.getCueBall().mesh.position, this.aimDirection);
          resolve();
        }
      };
      tick();
    });

    if (this.state !== 'AI_THINKING' || !this.ballsManager) return; // game may have been reset/disposed

    // Charge
    this.state = 'CHARGING';
    this.charging = true;
    this.power = 0;
    this.trajectory.setVisible(false);
    if (this.cue) this.cue.hide();

    // Animate charging
    const targetPower = decision.power;
    const chargeStart = performance.now();
    const chargeDuration = (targetPower / SHOT.chargeRate) * 1000;

    await new Promise(resolve => {
      const tick = () => {
        // Respect pause state — stop charging while paused
        if (this.paused) {
          requestAnimationFrame(tick);
          return;
        }
        const elapsed = performance.now() - chargeStart;
        const progress = Math.min(elapsed / chargeDuration, 1);
        this.power = targetPower * progress;
        if (this.ui) this.ui.setPower((this.power / SHOT.maxPower) * 100);

        if (progress < 1 && this.state === 'CHARGING' && this.state !== 'DISPOSED') {
          requestAnimationFrame(tick);
        } else {
          resolve();
        }
      };
      tick();
    });

    if (this.state !== 'CHARGING' || !this.ballsManager) return;

    // Shoot
    this.state = 'SHOOTING';
    this._shotStartTime = performance.now();
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
    const isClient = this.networkRole === 'client';
    const pocketPositions = this.table.getPocketPositions();

    if (!isClient) {
      this.ballsManager.updatePhysicsGuards(dt, pocketPositions);
      this.ballsManager.sync();
    }

    if (this.state === 'SHOOTING') {
      if (!isClient) {
        // Physics safety timeout: force turn resolution after 20s
        if (!this._shotStartTime) this._shotStartTime = performance.now();
        if (performance.now() - this._shotStartTime > 20000) {
          this.resolveTurn(this.turnPocketedIds);
          this._shotStartTime = null;
          return;
        }
        const newlyPocketed = this.ballsManager.checkPockets(pocketPositions);

        if (newlyPocketed.length > 0) {
          this.audio?.playPocket();
          const flashed = new Set();
          for (const entry of newlyPocketed) {
            const pocket = pocketPositions[entry.pocketIndex];
            if (!pocket) continue;
            const isFirstTime = !this.turnPocketedIds.includes(entry.id);
            if (isFirstTime) {
              this.turnPocketedIds.push(entry.id);
              this.achievements.onPocket(entry.id, pocket, this.mode);
              this.recorder.recordPocket(entry.id);
              if (this.challengeManager) this.challengeManager.onPocket(entry.id);
              if (this.drillManager) this.drillManager.onPocket(entry.id);
              const pBall = this.ballsManager.getBall(entry.id);
              if (pBall && this.ballReturn && entry.id !== 0 && settings.get('ballReturnAnimationEnabled') !== false) {
                this.ballReturn.animateBallReturn(pBall.mesh, pocket);
              }
            }
            if (isFirstTime) {
              if (!flashed.has(entry.pocketIndex)) {
                flashed.add(entry.pocketIndex);
                this.particles.spawnPocketFlash(pocket);
              }
              if (settings.get('pocketFountainEnabled') !== false) {
                this.particles.spawnPocketFountain(pocket, entry.id);
              }
              if (this.renderer?.camera && this.renderer.width > 0 && this.renderer.height > 0) {
                const p = this._tmpVec3a.set(pocket.x, pocket.y + 15, pocket.z);
                p.project(this.renderer.camera);
                const sx = (p.x * 0.5 + 0.5) * this.renderer.width;
                const sy = (-p.y * 0.5 + 0.5) * this.renderer.height;
                const txt = entry.id === 8 ? '🎱 8号球!' : (entry.id === 0 ? '⚠️ 白球' : `+${entry.id}`);
                const col = entry.id === 0 ? '#ff6b6b' : (entry.id === 8 ? '#fff' : '#d8b15f');
                this.ui.showFloatingText(txt, sx, sy, col);
              }
              // Broadcast pocket FX to clients so they see the same visual feedback
              if (this.networkRole === 'host' && this.networkController) {
                this.networkController.sendPocketEvent(entry.id, entry.pocketIndex, { x: pocket.x, y: pocket.y, z: pocket.z });
              }
            }
          }
        }

        if (this.ballsManager.allStopped()) {
          this._shotStartTime = null;
          this.resolveTurn(this.turnPocketedIds);
        }
      }

      const cueBall = this.ballsManager.getCueBall();
      if (cueBall && !cueBall.pocketed) {
        this.trails.recordPoint(cueBall);
        if (this.challengeManager) this.challengeManager.onShotUpdate(cueBall);
      }
    }

    // Update visual effects
    this.trails.update(dt);
    this.particles.update(dt);
    this.shockwaves.update(dt);
    this.screenShake.update(dt);
    if (this.ballReturn) this.ballReturn.update(dt);

    // Update match timer
    if (this.gameStartTime) {
      this.ui.updateTimer(performance.now() - this.gameStartTime);
    }
    const minimapActive = (this.networkRole === 'client' && this._hostFairness)
      ? (this._hostFairness.minimapEnabled !== false)
      : (settings.get('minimapEnabled') !== false);
    if (this.minimap && this.ballsManager && minimapActive) {
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

    if (this.state === 'AIM' && this.cue && this.cue.visible) {
      this.updateAimDirection();
      this.setAimTrajectoryVisible(true);
      this.updateTrajectory(dt);
    } else if (this.state === 'CHARGING' && this.cue && this.cue.visible) {
      this.updateDragPower();
    }

    // Fade or hide room elements that obstruct the camera view
    if (this.room) {
      this.room.updateCameraVisibility(this.camera);
    }

    // Host broadcasts snapshot during shooting (20–30 Hz)
    if (!isClient && this.networkRole === 'host' && this.state === 'SHOOTING' && this.networkController) {
      const now = performance.now();
      if (now - this._lastSnapshotTime > 50) {
        this._lastSnapshotTime = now;
        const snapshot = GameStateSerializer.serializeGameState(this);
        this.networkController.sendStateSnapshot(snapshot);
      }
    }

    // Update match score HUD
    if (this.matchManager) {
      this.matchManager.updateHUD(this.ui, this.networkPlayer1Name, this.networkPlayer2Name);
    }

    // Sync 9-ball push-out UI
    if (this.mode === '9ball' && this.rules && this.state === 'AIM' && !this.ballInHand && !this.rules.gameOver) {
      const status = this.rules.getStatus();
      if (status.pushOutAvailable && this.isLocalPlayerTurn()) {
        this.ui.showPushOutButton(() => this._onPushOutClicked());
      } else {
        this.ui.hidePushOutButton();
      }
      if (status.pushOutPending && this.isLocalPlayerTurn()) {
        this.ui.showPushOutChoice(
          () => this._onPushOutAccept(),
          () => this._onPushOutPass()
        );
      } else {
        this.ui.hidePushOutChoice();
      }
    }

    // Turn timer
    this._updateTurnTimer(dt);

    // FPS counter
    this._fpsFrameCount = (this._fpsFrameCount || 0) + 1;
    const fpsNow = performance.now();
    if (!this._fpsLastTime) this._fpsLastTime = fpsNow;
    if (fpsNow - this._fpsLastTime >= 1000) {
      this.ui.updateFPS?.(this._fpsFrameCount);
      this._fpsFrameCount = 0;
      this._fpsLastTime = fpsNow;
    }
  }

  _updateTurnTimer(dt) {
    if (!this._turnTimerEnabled) return;

    // Start timer when entering AIM state
    if (this.state === 'AIM' && !this.paused && !this._turnTimerRunning) {
      this._turnTimerRunning = true;
    }

    // Stop timer when not in AIM or when paused or settings open
    if ((this.state !== 'AIM' || this.paused || this._settingsOpen) && this._turnTimerRunning) {
      this._turnTimerRunning = false;
    }

    if (this._turnTimerRunning) {
      this._turnTimerRemaining -= dt;
      if (this._turnTimerRemaining <= 0) {
        this._turnTimerRemaining = 0;
        this._turnTimerRunning = false;
        this._onTurnTimerExpired();
      }
      this.ui.setTurnTimer(this._turnTimerRemaining, this._turnTimerMax);
    } else {
      this.ui.hideTurnTimer();
    }
  }

  _onTurnTimerExpired() {
    if (this.state === 'GAME_OVER' || this.state === 'DISPOSED') return;
    // Network clients should not locally resolve turn timeouts — host is authoritative
    if (this.networkMode && this.networkRole === 'client') {
      this.ui.setMessage('⏰ 回合时间到，等待房主确认…', 2000);
      this._turnTimerRemaining = 0;
      this._turnTimerRunning = false;
      return;
    }
    // Foul: switch to other player with ball-in-hand
    const otherPlayer = this.currentPlayer === 1 ? 2 : 1;
    const cName = this.currentPlayer === 1 ? this.networkPlayer1Name : this.networkPlayer2Name;
    const oName = otherPlayer === 1 ? this.networkPlayer1Name : this.networkPlayer2Name;
    this.currentPlayer = otherPlayer;
    this._turnTimerRemaining = this._turnTimerMax;
    this.ui.setMessage(UIText.turnTimeout(cName, oName), 3000);
    this.audio?.playFoul();
    this.ui.flashRed();
    this.startBallInHand(UIText.turnTimeout(cName, oName), false);
    this._updatePlayerStats();
    this.ui.setPlayerTurn(this.currentPlayer);
  }

  /* ── Small helpers extracted from duplicated code ── */

  /** Reset to AIM state with optional cue/trajectory visibility. */
  _enterAimState({ resetPower = true, showCue = true, showTrajectory = true, updateAim = true } = {}) {
    if (this.state === 'GAME_OVER' || this.state === 'DISPOSED') return;
    this.state = 'AIM';
    this.charging = false;
    this.dragStart = null;
    this.directPullAim = false;
    if (resetPower) {
      this.power = 0;
      this.ui.setPower(0);
    }
    if (showCue && this.cue) this.cue.show();
    if (showTrajectory) this.setAimTrajectoryVisible(true);
    if (updateAim) {
      this.updateAimDirection();
      this.updateTrajectory();
    }
  }

  /** Common ball-in-hand cleanup after placement is confirmed. */
  _endBallInHand() {
    this.ballInHand = false;
    this.ballInHandValid = false;
    this.ballInHandBehindLine = false;
    if (this.cue) this.cue.show();
    this.setAimTrajectoryVisible(true);
    this.updateAimDirection();
    this.updateTrajectory();
    this.ui.setMessage(UIText.ballInHandPlaced, 1800);
  }

  /** Player clicked the Push-out button. */
  _onPushOutClicked() {
    if (!this.rules || this.mode !== '9ball') return;
    const declared = this.rules.declarePushOut();
    if (!declared) return;
    this.ui.hidePushOutButton();
    this.ui.setMessage(UIText.pushOutTooltip, 3000);
    if (this.networkMode && this.networkRole === 'client') {
      this.networkController?.sendPushOutDeclare();
    } else if (this.networkRole === 'host') {
      this._broadcastSnapshot();
    }
  }

  /** Player chose to accept the push-out. */
  _onPushOutAccept() {
    this._applyPushOutChoice('accept');
    if (this.networkMode && this.networkRole === 'client') {
      this.networkController?.sendPushOutChoice('accept');
    }
  }

  /** Player chose to pass the push-out back. */
  _onPushOutPass() {
    this._applyPushOutChoice('pass');
    if (this.networkMode && this.networkRole === 'client') {
      this.networkController?.sendPushOutChoice('pass');
    }
  }

  /** Apply push-out choice (accept/pass) and update game state. */
  _applyPushOutChoice(choice) {
    if (!this.rules || !this.rules.pushOutPending) return;
    let result;
    if (choice === 'accept') {
      result = this.rules.acceptPushOut();
    } else {
      result = this.rules.passPushOut();
    }
    if (!result) return;

    this.currentPlayer = result.nextPlayer;
    this._turnTimerRemaining = this._turnTimerMax;
    this.ui.setPlayerTurn(this.currentPlayer);
    this.ui.hidePushOutChoice();

    const playerName = this.currentPlayer === 1 ? this.networkPlayer1Name : this.networkPlayer2Name;
    const msg = choice === 'accept'
      ? UIText.pushOutAcceptedMsg(playerName)
      : UIText.pushOutPassedMsg(playerName);
    this.ui.setMessage(msg, 3000);

    this._enterAimState({ resetPower: true, showCue: true, showTrajectory: true, updateAim: false });
    this._updatePlayerStats();

    if (this.aiEnabled && this.currentPlayer === 2) {
      this.startAITurn();
    }

    if (this.networkRole === 'host') {
      this._broadcastSnapshot();
    }
  }

  /** Shared respot logic for 8-ball and 9-ball. */
  _respotBall(ballId) {
    const ball = this.ballsManager.getBall(ballId);
    if (!ball || !ball.pocketed) return;
    const footZ = this.tableProfile.depth / 2 * 0.55;
    let finalX = 0;
    const checkClear = (x, z) => {
      for (const b of this.ballsManager.balls) {
        if (b.id === ballId || b.pocketed) continue;
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
    ball.pocketed = false;
    ball.mesh.visible = true;
    ball.setPosition(finalX, BALL.radius, footZ);
  }

  /** Remove challenge HUD if present. */
  _removeChallengeHUD() {
    const chHud = document.getElementById('challenge-hud');
    if (chHud && chHud.parentNode) {
      chHud.parentNode.removeChild(chHud);
    }
  }

  /** Apply camera mode from settings string. */
  _applyCameraMode(mode) {
    if (!mode || !['free', 'top', 'follow'].includes(mode)) return;
    this.cameraMode = mode;
    if (mode === 'top') this._resetCameraTop();
    else if (mode === 'free') this._resetCameraFree();
    else if (mode === 'follow') this._resetCameraFollow();
  }

  /** Host broadcasts current game state to all clients. */
  _broadcastSnapshot(extraPayload = null) {
    if (this.networkRole !== 'host' || !this.networkController) return;
    const snapshot = GameStateSerializer.serializeGameState(this);
    this.networkController.sendStateSnapshot(snapshot);
    if (extraPayload) {
      this.networkController.sendTurnResolved(extraPayload);
    }
  }

  /** Thin wrappers so Game.js owns the serialization interface. */
  serializeGameState() {
    return GameStateSerializer.serializeGameState(this);
  }

  applyGameState(snapshot) {
    GameStateSerializer.applyGameState(this, snapshot);
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

    // Trainer mode: evaluate drill, auto-reset for retry
    if (this.mode === 'trainer') {
      if (this.drillManager) {
        this.drillManager.onBallsStopped(cueBall);
      }
      if (this.drillManager && this.drillManager.completed) {
        this.audio?.playWin();
        if (this.onTrainerComplete) {
          this.onTrainerComplete(this.drillManager.completed, this.drillManager.stars);
        }
      } else {
        // Auto-reset for next attempt (cue ball only if pocketed)
        if (cuePocketed) {
          this.ballsManager.resetCueBallIfPocketed();
        }
        this._enterAimState({ showCue: true, showTrajectory: true, updateAim: false });
      }
      return;
    }

    // Free Play mode: no rules, no win/lose, no turn switching
    if (this.mode === 'freeplay') {
      if (cuePocketed) {
        this.ballsManager.resetCueBallIfPocketed();
        this.audio?.playFoul();
        this.ui.flashRed();
      }
      // Show brief shot feedback
      const pocketedCount = pocketedIds.filter(id => id !== 0).length;
      const powerPct = Math.round((this._lastShotPower || 0) * 100);
      const spin = this.cueTipOffset || { x: 0, y: 0 };
      const absX = Math.abs(spin.x);
      const absY = Math.abs(spin.y);
      let spinText = '无旋转';
      if (absX >= 0.05 || absY >= 0.05) {
        const dirH = spin.x > 0.05 ? '右' : spin.x < -0.05 ? '左' : '';
        const dirV = spin.y > 0.05 ? '下' : spin.y < -0.05 ? '上' : '';
        const strength = Math.max(absX, absY);
        const level = strength > 0.7 ? '强' : strength > 0.35 ? '中' : '弱';
        spinText = `${dirV}${dirH}旋 · ${level}`;
      }
      const feedback = UIText.freeplayFeedback({
        power: powerPct,
        pocketedCount,
        spinText,
      });
      if (feedback) {
        this.ui.setMessage(feedback, 2500);
      }
      this._enterAimState({ showCue: true, showTrajectory: true, updateAim: false });
      return;
    }

    const result = this.rules.resolveShot(pocketedIds, cuePocketed);

    // Respot 8-ball or 9-ball if pocketed on break / foul
    if (result.respotEightBall) this._respotBall(8);
    if (result.respotNineBall) this._respotBall(9);

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
      if (this.ui) this.ui.updateComboCounter(0);
    } else if (effectivePocketedIds.length === 0) {
      this.statsTracker.recordMiss(this.currentPlayer);
      if (this.ui) this.ui.updateComboCounter(0);
    } else {
      const streak = this.statsTracker.playerStats[this.currentPlayer].consecutivePockets;
      if (this.ui) this.ui.updateComboCounter(streak);
    }

    if (result.gameOver) {
      this.state = 'GAME_OVER';
      this.ui.setMessage(result.message);
      this.ui.hidePushOutButton();
      this.ui.hidePushOutChoice();
      this.ui.hideThreeFoulWarning();

      // Match mode: delegate to match engine instead of local reset
      if (this.matchManager) {
        this.matchManager.onGameEnd(result.winner);
      } else {
        this.ui.showResetButton(() => this._onResetButtonClicked(), UIText.gameOverResetLabel);
      }

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
        this.audio?.playWin();
      } else {
        this.audio?.playFoul();
        this.ui.flashRed();
      }
      this._updatePlayerStats();
      return;
    }

    this.ui.setMessage(result.message, 4000);
    this.currentPlayer = result.nextPlayer;
    this._turnTimerRemaining = this._turnTimerMax;
    this.ui.setPlayerTurn(this.currentPlayer);

    const status = this.rules.getStatus();
    this.ui.setPlayerGroups(status.player1Group, status.player2Group);
    this._updatePlayerStats();

    if (result.foul || result.scratch) {
      this.audio?.playFoul();
      this.ui.flashRed();
      this.achievements.onFoul();
      if (!onboarding.get('foulExplained')) {
        this.onboardingTips.show('foul', result.message, 10000);
        onboarding.set('foulExplained', true);
      }
    }

    // Achievement: turn end
    this.achievements.onTurnEnd(result, effectivePocketedIds, this.mode);
    if (this.challengeManager) {
      const cueBall = this.ballsManager && this.ballsManager.getCueBall();
      const cueBallPos = cueBall ? { x: cueBall.mesh.position.x, z: cueBall.mesh.position.z } : null;
      this.challengeManager.onTurnEnd({ ...result, cueBallPos });
      }

    // Achievement: break shot check
    if (this._isBreakShot) {
      this.achievements.onBreakShot(effectivePocketedIds, this.mode);
      if (this.challengeManager) this.challengeManager.onBreakShot(effectivePocketedIds);
      this._isBreakShot = false;
    }

    if (result.scratch) {
      this.ballsManager.resetCueBallIfPocketed();
    }

    // Three-foul warning badge
    const p1Fouls = this.rules.player1ConsecutiveFouls;
    const p2Fouls = this.rules.player2ConsecutiveFouls;
    if (p1Fouls >= 2 || p2Fouls >= 2) {
      this.ui.showThreeFoulWarning();
    } else {
      this.ui.hideThreeFoulWarning();
    }

    // Push-out pending: AI auto-accepts; human sees choice UI in update loop
    if (result.pushOutPending && this.aiEnabled && this.currentPlayer === 2) {
      this._applyPushOutChoice('accept');
      return;
    }

    this._enterAimState({ resetPower: true, showCue: true, showTrajectory: true, updateAim: false });

    // Host broadcasts final state after turn resolution
    if (this.networkRole === 'host' && this.networkController) {
      const snapshot = GameStateSerializer.serializeGameState(this);
      this.networkController.sendStateSnapshot(snapshot);
    }

    // Auto-switch camera back from follow mode after shot resolves
    if (this.cameraMode === 'follow' && settings.get('autoFollowCueBall')) {
      const defaultCam = settings.get('defaultCamera');
      if (defaultCam && defaultCam !== 'follow') {
        this.cameraMode = defaultCam;
        if (defaultCam === 'top') this._resetCameraTop();
        else if (defaultCam === 'free') this._resetCameraFree();
      }
    }

    // Auto-reset camera after shot (independent of follow mode)
    if (settings.get('cameraAutoResetAfterShot') && !result.gameOver) {
      const delayMs = (settings.get('cameraResetDelay') ?? 3.0) * 1000;
      const defaultCam = settings.get('defaultCamera') || 'free';
      if (this._cameraResetTimer) clearTimeout(this._cameraResetTimer);
      this._cameraResetTimer = setTimeout(() => {
        if (this.cameraMode !== defaultCam) {
          this.cameraMode = defaultCam;
          if (defaultCam === 'top') this._resetCameraTop();
          else if (defaultCam === 'free') this._resetCameraFree();
          else if (defaultCam === 'follow') this._resetCameraFollow();
        }
        this._cameraResetTimer = null;
      }, delayMs);
    }

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
        const headStringZ = -this.tableProfile.depth / 2 * 0.55;
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
    if (this.state === 'DISPOSED') return;
    if (this.ballReturn) this.ballReturn.reset();
    for (const ball of this.ballsManager.balls) {
      const listener = this._ballCollideListeners.get(ball.id);
      if (listener) ball.body.removeEventListener('collide', listener);
      this.scene.remove(ball.mesh);
      this.physics.removeBody(ball.body);
      ball.geometry.dispose();
      ball.material.dispose();
    }
    this._ballCollideListeners.clear();
    this.ballsManager = new BallsManager(this.physics, this.tableProfile);
    this.ballsManager.createBalls();
    if (this.mode === 'trainer' && this.drillConfig) {
      const { idealZone } = this.ballsManager.setupDrill(this.drillConfig, this.tableProfile);
      this.drillIdealZone = idealZone;
    } else {
      const rackMode = this.mode === '9ball' ? '9ball' : '8ball';
      this.ballsManager.rackBalls(rackMode);
    }
    this._wireBallsManagerEvents();
    this.ballsManager.addToScene(this.scene);
    this.setupCollisionEvents();
    for (const ball of this.ballsManager.balls) {
      ball.updateVisualSettings(settings);
    }

    if (this.rules) this.rules.reset();
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
    if (this._netDisconnectTimer) {
      clearTimeout(this._netDisconnectTimer);
      this._netDisconnectTimer = null;
    }
    this._netDisconnectHandled = false;
    if (this._strikeHideTimer) {
      clearTimeout(this._strikeHideTimer);
      this._strikeHideTimer = null;
    }
    if (this._cameraResetTimer) {
      clearTimeout(this._cameraResetTimer);
      this._cameraResetTimer = null;
    }
    this._challengeEnding = false;

    this._removeChallengeHUD();

    this.paused = false;
    this.ui.hidePauseMenu?.();
    this.ui.hideTurnTimer?.();
    this.ui.hidePushOutButton?.();
    this.ui.hidePushOutChoice?.();
    this.ui.hideThreeFoulWarning?.();
    this._turnTimerRunning = false;
    this._turnTimerRemaining = this._turnTimerMax;
    this.currentPlayer = 1;
    this.state = 'AIM';
    this._enterAimState({ resetPower: true, showCue: false, showTrajectory: false, updateAim: false });
    this.ballInHand = false;
    this.ballInHandValid = false;
    this.ballInHandBehindLine = false;
    this.cueTipOffset = { x: 0, y: 0 };
    this._updateCueTipPicker();
    if (this.ui) this.ui.updateComboCounter(0);
    this.aimDirection.set(0, 0, 1);
    this.lockedAimDirection.set(0, 0, 1);
    this._wasShiftCameraControl = false;
    this.turnPocketedIds = [];
    this._shotStartTime = null;
    this._isBreakShot = false;
    this.gameStartTime = performance.now();
    this._applyCameraMode(settings.get('defaultCamera') || 'free');
    this.powerLabel?.dispose();
    this.powerLabel = new PowerLabel();
    this.ui.setPower(0);
    this.ui.setPlayerTurn(1);
    this.ui.setPlayerGroups(null, null);
    if (this.mode === 'freeplay') {
      this.ui.setMessage(UIText.freeplayReset);
    } else if (this.mode === 'trainer') {
      this.ui.setMessage(UIText.trainerReset);
    } else if (this.mode === '9ball') {
      this.ui.setMessage(UIText.nineBallReset);
    } else {
      this.ui.setMessage(this.aiEnabled ? UIText.eightBallResetVsAI : UIText.eightBallReset);
    }
    this.ui.hideResetButton();
    if (this.mode === 'trainer') {
      this.ui.showResetButton(() => this._resetTrainerDrill(), UIText.trainerResetLabel);
    } else {
      this.ui.showResetButton(() => this._onResetButtonClicked(), UIText.gameOverResetLabel);
    }
    this.ui.setMatchInfo(this._getObjectiveText());
    this._updatePlayerStats();
    if (this.cue) this.cue.show();
    this.setAimTrajectoryVisible(true);

    this._broadcastSnapshot();
  }

  _addBackToMenuButton() {
    const uiLayer = document.getElementById('ui-layer');
    if (!uiLayer || uiLayer.querySelector('#back-to-menu')) return;

    const btn = document.createElement('button');
    btn.id = 'back-to-menu';
    btn.textContent = UIText.backToMenu;
    btn.style.cssText = `
      position: absolute; top: 18px; left: 24px;
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
      position: absolute; bottom: 38px; left: 60px;
      width: 110px; display: flex; flex-direction: column; align-items: center;
      gap: 6px; z-index: 15; user-select: none;
    `;

    // Label
    const label = document.createElement('div');
    label.textContent = UIText.cueTipLabel;
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
    hint.textContent = UIText.cueTipCenter;
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
    if (this.ui) this.ui.setSpin(this.cueTipOffset);
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
    if (Math.abs(ox) > 0.08) parts.push(ox > 0 ? UIText.cueTipRightEnglish : UIText.cueTipLeftEnglish);
    if (Math.abs(oy) > 0.08) parts.push(oy > 0 ? UIText.cueTipHigh : UIText.cueTipLow);
    hint.textContent = parts.length ? parts.join(' + ') : UIText.cueTipCenter;
  }

  _setupSpinControls() {
    this._onKeyDown = (e) => {
      const key = e.key.toLowerCase();
      // Ignore all game keys while paused (except Escape which toggles pause)
      if (this.paused && key !== 'escape') return;
      // Ignore all game keys while in-game settings is open (except Escape which closes it)
      if (this._settingsOpen) {
        // If a confirm dialog is open inside settings, let it handle Escape
        if (document.querySelector('.settings-confirm-backdrop')) return;
        if (key === 'escape' && this.inGameSettings) {
          this._onInGameSettingsClose();
        }
        return;
      }
      const mods = { ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey, meta: e.metaKey };

      // Escape cancels charging and ball-in-hand preview
      if (key === 'escape') {
        if (this.state === 'CHARGING') {
          this.state = 'AIM';
          this.power = 0;
          this.charging = false;
          this.dragStart = null;
          this.ui.setPower(0);
          if (this.cue) this.cue.show();
          return;
        }
        if (this.state === 'GAME_OVER') return;
        if (this.ballInHand) {
          this.ballInHand = false;
          this.ballInHandValid = false;
          this.state = 'AIM';
          if (this.cue) this.cue.show();
          this.ui.setMessage(UIText.ballInHandCanceled);
          return;
        }
      }

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

      // Toggle sound (M key)
      if (keyBindings.matches('toggleSound', key, mods)) {
        const next = !settings.get('soundEnabled');
        settings.set('soundEnabled', next);
        this.audio?.toggleSound(next);
        this.ui?.setMessage(next ? UIText.soundOn : UIText.soundOff, 1200);
        return;
      }

      // Enter to confirm shot when confirmShotOnRelease is disabled
      if (key === 'enter' && settings.get('confirmShotOnRelease') === false) {
        if (this.paused) return;
        // Prevent accidental shot when typing in an input/textarea
        const tag = e.target?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        if (this.state === 'AIM' && this.power >= 1) {
          this.state = 'SHOOTING';
          this.shoot();
          return;
        }
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
        if (this.ui) this.ui.setSpin(this.cueTipOffset);
      }
    };
    window.addEventListener('keydown', this._onKeyDown);
  }

  _resetCameraFree() {
    this.screenShake?.cancel();
    const cam = this.camera;
    cam.position.set(...CAMERA.defaultPos);
    cam.lookAt(...CAMERA.lookAt);
    if (this.renderer.controls) {
      this.renderer.controls.target.set(...CAMERA.lookAt);
      this.renderer.controls.enabled = true;
      this.renderer.controls.update();
      this.renderer._clampCameraToRoom();
    }
  }

  _resetCameraTop() {
    this.screenShake?.cancel();
    const cam = this.camera;
    const topDown = settings.get('topDownAngle');
    cam.position.set(0, 170, topDown ? 0.01 : 0.1);
    cam.lookAt(0, 0, 0);
    if (this.renderer.controls) {
      this.renderer.controls.target.set(0, 0, 0);
      this.renderer.controls.enabled = true;
      this.renderer.controls.update();
      this.renderer._clampCameraToRoom();
    }
  }

  _resetCameraFollow() {
    this.screenShake?.cancel();
    const cueBall = this.ballsManager?.getCueBall();
    if (cueBall && !cueBall.pocketed) {
      const cam = this.camera;
      const pos = cueBall.mesh.position;
      cam.position.set(pos.x, pos.y + 120, pos.z - 140);
      cam.lookAt(pos.x, pos.y, pos.z);
    }
    if (this.renderer.controls) {
      const cueBall = this.ballsManager?.getCueBall();
      if (cueBall && !cueBall.pocketed) {
        this.renderer.controls.target.copy(cueBall.mesh.position);
      }
      this.renderer.controls.enabled = false;
      this.renderer.controls.update();
    }
  }

  _updateChallengeHUD() {
    if (!this.challengeManager) return;
    const data = this.challengeManager.getHUDData();
    const uiLayer = document.getElementById('ui-layer');
    if (!uiLayer) return;
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
      uiLayer.appendChild(el);
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
        const smoothing = settings.get('cameraSmoothing') !== false;
        const factor = smoothing ? (settings.get('cameraSmoothFactor') ?? 0.5) : 1.0;
        const lerp = 0.05 + factor * 0.15; // 0.05 ~ 0.20
        cam.position.x += (targetX - cam.position.x) * lerp;
        cam.position.y += (targetY - cam.position.y) * lerp;
        cam.position.z += (targetZ - cam.position.z) * lerp;
        cam.lookAt(pos.x, pos.y, pos.z);
      } else if (cueBall && cueBall.pocketed) {
        // Cue ball pocketed: keep camera looking at table center
        this.camera.lookAt(0, 0, 0);
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
    if (this.cue) this.cue.setAim(ballPos, this.aimDirection);
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

  _getObjectiveText() {
    if (this.challengeManager) return UIText.objectiveChallenge;
    if (this.mode === 'trainer') return '击球训练';
    if (this.mode === 'freeplay') return UIText.objectiveFreeplay;
    if (this.mode === '9ball') {
      const status = this.rules?.getStatus();
      if (status?.targetBall) {
        return UIText.objective9Ball(status.targetBall);
      }
      return UIText.objective9BallOpen;
    }
    // 8-ball: dynamic based on open/closed table
    const status = this.rules?.getStatus();
    if (status) {
      if (!status.player1Group && !status.player2Group) {
        return UIText.objective8BallOpen;
      }
      return UIText.objective8BallClosed(status.player1Group, status.player2Group);
    }
    if (this.aiEnabled) return UIText.objective8BallVsAI;
    return UIText.objective8Ball;
  }

  _updateObjectiveText() {
    if (this.ui) {
      this.ui.setMatchInfo(this._getObjectiveText());
    }
  }

  _updatePlayerStats() {
    const status = this.rules ? this.rules.getStatus() : null;
    const p2Name = this.aiEnabled ? 'AI' : (this.networkPlayer2Name || '玩家 2');
    const p1Name = this.networkPlayer1Name || '玩家 1';
    const is9Ball = this.mode === '9ball';
    const defaultRemaining = is9Ball ? 9 : 7;
    this.ui.setPlayerStats({
      p1Name,
      p1Group: status?.player1Group ?? null,
      p1Remaining: status?.player1Remaining ?? defaultRemaining,
      p2Name,
      p2Group: status?.player2Group ?? null,
      p2Remaining: status?.player2Remaining ?? defaultRemaining,
      mode: this.mode,
      targetBall: is9Ball ? status?.targetBall : undefined,
    });
    this._updateObjectiveText();
  }

  _onResetButtonClicked() {
    if (this.networkMode && this.networkRole === 'client') {
      if (!this.networkController || !this.networkController.connected) {
        this.ui.setMessage(UIText.networkDisconnect, 2000);
        return;
      }
      // Client asks host to reset; host will broadcast the new state
      this.networkController.sendShotInput({ x: 0, y: 0, z: 0 }, 0, { x: 0, y: 0 }, null, true);
      this.ui.setMessage(UIText.resetRequested, 2000);
      return;
    }
    this.resetGame();
  }

  // ── Network multiplayer methods ──

  setNetworkController(controller, role, localPlayerId) {
    this.networkController = controller;
    this.networkRole = role;
    this.localPlayerId = localPlayerId || 1;
    this.networkMode = role ? 'lan' : null;
    this._netDisconnectHandled = false;
    if (controller) {
      this._onStateSnapshot = (e) => {
        if (this.networkRole === 'client' && e.detail.snapshot) {
          const snapshot = e.detail.snapshot;
          // Reject out-of-order snapshots
          const ts = snapshot.timestamp || 0;
          if (ts < (this._lastAppliedSnapshotTime || 0)) return;
          this._lastAppliedSnapshotTime = ts;
          // Apply host-authority fairness if present in snapshot; otherwise leave current fairness unchanged
          if (snapshot.fairness && typeof snapshot.fairness === 'object' && Object.keys(snapshot.fairness).length > 0) {
            this._applyHostFairness(snapshot.fairness);
          }
          GameStateSerializer.applyGameState(this, snapshot);
        }
      };
      this._onNetShotInput = (e) => {
        if (this.networkRole === 'host') {
          this.applyRemoteShot(e.detail);
        }
      };
      this._onNetPocketEvent = (e) => {
        if (this.networkRole === 'client') {
          const detail = e.detail;
          const pocket = detail.pocket;
          if (pocket) {
            this.particles.spawnPocketFlash(pocket);
            this.particles.spawnPocketFountain(pocket, detail.ballId);
            this.audio?.playPocket();
            if (this.renderer?.camera && this.renderer.width > 0 && this.renderer.height > 0) {
              const p = this._tmpVec3a.set(pocket.x, pocket.y + 15, pocket.z);
              p.project(this.renderer.camera);
              const sx = (p.x * 0.5 + 0.5) * this.renderer.width;
              const sy = (-p.y * 0.5 + 0.5) * this.renderer.height;
              const txt = detail.ballId === 8 ? '🎱 8号球!' : (detail.ballId === 0 ? '⚠️ 白球' : `+${detail.ballId}`);
              const col = detail.ballId === 0 ? '#ff6b6b' : (detail.ballId === 8 ? '#fff' : '#d8b15f');
              this.ui.showFloatingText(txt, sx, sy, col);
            }
          }
        }
      };
      this._onNetPushOutDeclare = (e) => {
        if (this.networkRole === 'host' && this.rules) {
          if (e.detail?.fromPlayer !== this.currentPlayer) return;
          if (!this.rules.pushOutAvailable) return;
          this.rules.declarePushOut();
          this._broadcastSnapshot();
        }
      };
      this._onNetPushOutChoice = (e) => {
        if (this.networkRole === 'host' && this.rules) {
          if (e.detail?.fromPlayer !== this.currentPlayer) return;
          const choice = e.detail?.choice;
          if (choice === 'accept' || choice === 'pass') {
            this._applyPushOutChoice(choice);
          }
        }
      };
      this._onNetRoomClosed = (e) => {
        if (!this.networkMode || this._netDisconnectHandled) return;
        this._netDisconnectHandled = true;
        settings.clearLockedKeys();
        const reason = e.detail?.reason;
        const msg = reason === 'hostLeft' ? UIText.hostLeft
          : reason === 'hostDisconnected' ? UIText.hostDisconnected
          : UIText.networkDisconnect;
        this.ui.setMessage(msg, 3000);
        this._netDisconnectTimer = setTimeout(() => {
          this._netDisconnectTimer = null;
          if (this.onReturnToMenu) this.onReturnToMenu();
        }, 3000);
      };
      this._onNetDisconnected = () => {
        if (!this.networkMode || this._netDisconnectHandled) return;
        this._netDisconnectHandled = true;
        settings.clearLockedKeys();
        this.ui.setMessage(UIText.networkDisconnect, 3000);
        this._netDisconnectTimer = setTimeout(() => {
          this._netDisconnectTimer = null;
          if (this.onReturnToMenu) this.onReturnToMenu();
        }, 3000);
      };
      controller.addEventListener('stateSnapshot', this._onStateSnapshot);
      controller.addEventListener('shotInput', this._onNetShotInput);
      controller.addEventListener('pocketEvent', this._onNetPocketEvent);
      controller.addEventListener('pushOutDeclare', this._onNetPushOutDeclare);
      controller.addEventListener('pushOutChoice', this._onNetPushOutChoice);
      controller.addEventListener('roomClosed', this._onNetRoomClosed);
      controller.addEventListener('disconnected', this._onNetDisconnected);
    }
  }

  setMatchManager(manager) {
    this.matchManager = manager;
    // Override player names from match config
    if (manager) {
      const status = manager.getStatus();
      this.networkPlayer1Name = status.p1Name || '玩家 1';
      this.networkPlayer2Name = status.p2Name || '玩家 2';
    }
    // Lock fairness settings when match mode is active (init already completed)
    const fairnessKeys = Array.from(MATCH_FAIRNESS_KEYS);
    if (this.inGameSettings) this.inGameSettings.setLockedKeys(fairnessKeys);
    settings.setLockedKeys(fairnessKeys);
  }

  isLocalPlayerTurn() {
    if (!this.networkMode) return true;
    return this.currentPlayer === this.localPlayerId;
  }

  applyRemoteShot(shotInput) {
    if (this.networkRole !== 'host') return;
    applyShotInput(this, shotInput);
  }

  _concede() {
    if (this.state === 'GAME_OVER' || this.state === 'DISPOSED') return;
    if (this.mode === 'freeplay') return;
    if (this.mode === 'trainer') return;
    if (this.networkMode) {
      this.ui.setMessage(UIText.networkCannotConcede, 2000);
      return;
    }
    const winner = this.currentPlayer === 1 ? 2 : 1;
    this.ui.setMessage(UIText.concedeWinner(winner), 0);
    this.state = 'GAME_OVER';
    if (this.cue) this.cue.hide();

    // Notify rules engine
    if (this.rules) {
      this.rules.gameOver = true;
      this.rules.winner = winner;
    }

    // End stats tracking and show summary
    const summary = this.statsTracker.endGame(winner);
    this.statsPanel.showGameOver(summary, this.aiEnabled);

    // Notify achievements
    const duration = (performance.now() - this.gameStartTime) / 1000;
    const stats = summary.player1 || summary.player2 ? summary : null;
    this.achievements.onGameEnd(
      winner, this.currentPlayer, this.mode,
      this.aiPlayer?.difficulty || 'normal', duration, stats
    );
    if (this.challengeManager) {
      this.challengeManager.onGameEnd(winner);
    }

    this.audio?.playWin();
    this.ui.showResetButton(() => this._onResetButtonClicked(), UIText.gameOverResetLabel);
    this.ui.setPlayerTurn(winner);
    this.ui.hideThreeFoulWarning();
    this.ui.hidePushOutButton();
    this.ui.hidePushOutChoice();
    // Host broadcasts final state after concession
    this._broadcastSnapshot();
  }

  _openInGameSettings() {
    this._settingsOpen = true;
    // Hide pause overlay first to prevent double-backdrop
    this.ui.hidePauseMenu();
    if (this.inGameSettings) {
      this.inGameSettings.show();
    }
  }

  _onInGameSettingsClose() {
    this._settingsOpen = false;
    if (this.inGameSettings) {
      this.inGameSettings.hide();
    }
    if (this.paused && this.state !== 'GAME_OVER') {
      this.ui.showPauseMenu();
    }
  }

  /**
   * Apply host-authority fairness settings in network client mode.
   * These override local settings so all players have the same competitive parameters.
   */
  _applyHostFairness(fairness) {
    if (this.state === 'DISPOSED') return;
    if (!fairness || typeof fairness !== 'object') return;
    const changed = !this._hostFairness ||
      Object.keys(fairness).some(k => this._hostFairness[k] !== fairness[k]);
    this._hostFairness = { ...(this._hostFairness || {}), ...fairness };
    if (changed) {
      // Sync locked fairness values into SettingsStore so the settings UI shows host values
      for (const key of Object.keys(fairness)) {
        if (MATCH_FAIRNESS_KEYS.has(key)) {
          settings.updateLockedValue(key, fairness[key]);
        }
      }
      this._applySettings();
      // Refresh in-game settings UI if open so host values are visible
      if (this.inGameSettings) this.inGameSettings._syncAllControls();
    }
  }

  _applySettings() {
    // In network client mode, use host's fairness settings if available
    const fairness = this.networkRole === 'client' && this._hostFairness ? this._hostFairness : {};
    this.trajectoryEnabled = fairness.trajectoryEnabled !== undefined ? fairness.trajectoryEnabled : settings.get('trajectoryEnabled');
    if (this.particles) this.particles.setEnabled(settings.get('particlesEnabled'));
    if (this.trails) this.trails.setEnabled(settings.get('shotTrailsEnabled'));

    this._applyCameraMode(settings.get('defaultCamera'));
    const minimapEnabled = fairness.minimapEnabled !== undefined ? fairness.minimapEnabled : settings.get('minimapEnabled');
    if (this.minimap) this.minimap.setEnabled(minimapEnabled !== false);

    // Apply HUD visibility settings
    this._applyHudVisibility(fairness);

    // Apply turn timer setting
    const turnTimer = fairness.turnTimer !== undefined ? fairness.turnTimer : settings.get('turnTimer');
    const isStandardMode = ['local2p', 'vsai', '9ball'].includes(this.mode) || this.matchManager;
    if (isStandardMode && turnTimer !== 'off') {
      this._turnTimerMax = parseInt(turnTimer, 10) || 30;
      this._turnTimerEnabled = true;
    } else {
      this._turnTimerEnabled = false;
      this._turnTimerMax = 0;
    }
    this._turnTimerRemaining = this._turnTimerMax;
    this._turnTimerRunning = false;
  }

  _applyHudVisibility(fairness = {}) {
    if (!this.ui) return;
    const hudScale = settings.get('hudScale') ?? 1.0;
    this.ui.setHudScale?.(hudScale);
    this.ui.setHudOpacity?.(settings.get('hudOpacity'));
    this.ui.setShowFPS?.(settings.get('showFPS'));
    this.ui.setShowPowerBar?.(settings.get('showShotPowerPercent'));
    this.ui.setShowSpinIndicator?.(settings.get('showSpinIndicator'));
    const showCrosshair = fairness.showCrosshair !== undefined ? fairness.showCrosshair : settings.get('showCrosshair');
    this.ui.setShowCrosshair?.(showCrosshair);
    this.ui.setShowBallLabels?.(settings.get('showBallLabels'));
    this.ui.setShowRemainingBalls?.(settings.get('showRemainingBalls'));
    this.ui.setShowComboCounter?.(settings.get('showComboCounter'));
    this.ui.setStatsPanelEnabled?.(settings.get('statsPanelEnabled'));
    this.ui.setHighContrastUI?.(settings.get('highContrastUI'));
    this.ui.setLargeTextMode?.(settings.get('largeTextMode'));
    this.ui.setReducedMotion?.(settings.get('reducedMotion'));
  }

  _handleSettingsChange(key, value) {
    // In network client mode, ignore local changes to fairness keys
    // (host settings are authoritative and applied via snapshot)
    if (this.networkRole === 'client' && this._hostFairness && key in this._hostFairness) {
      return;
    }
    // Host: propagate fairness changes into _hostFairness so next snapshot reflects them
    if (this.networkRole === 'host' && this._hostFairness && key in this._hostFairness) {
      this._hostFairness[key] = value;
      // Broadcast updated fairness to clients immediately so they stay in sync
      this._broadcastSnapshot();
    }
    switch (key) {
      case 'trajectoryEnabled':
        this.trajectoryEnabled = value;
        this.setAimTrajectoryVisible(this.state === 'AIM');
        break;
      case 'particlesEnabled':
        if (this.particles) this.particles.setEnabled(value);
        break;
      case 'trajectoryOpacity':
      case 'trajectoryWidth':
      case 'trajectoryColorMode':
      case 'trajectoryAnimationEnabled':
        // Applied live by TrajectoryPredictor
        break;
      case 'minimapBallSize':
      case 'minimapShowCueTrail':
      case 'minimapTrailLength':
      case 'minimapHighContrast':
        // Applied live by Minimap
        break;
      case 'shotTrailsEnabled':
        if (this.trails) this.trails.setEnabled(value);
        break;
      case 'defaultCamera':
        this._applyCameraMode(value);
        break;
      case 'cueTheme':
        if (this.cue) this.cue.applyTheme(value);
        break;
      case 'shadowsEnabled':
        // Shadows are handled globally by Renderer; no per-game action needed
        break;
      case 'minimapEnabled':
        if (this.minimap) this.minimap.setEnabled(value);
        break;
      case 'turnTimer': {
        const isStandardMode = ['local2p', 'vsai', '9ball'].includes(this.mode) || this.matchManager;
        if (isStandardMode && value !== 'off') {
          this._turnTimerMax = parseInt(value, 10) || 30;
          this._turnTimerEnabled = true;
        } else {
          this._turnTimerEnabled = false;
          this._turnTimerMax = 0;
        }
        this._turnTimerRemaining = this._turnTimerMax;
        this._turnTimerRunning = false;
        this.ui.hideTurnTimer();
        break;
      }
      case 'cameraFov':
        if (this.renderer && this.renderer.camera) {
          this.renderer.camera.fov = Number(value) || 45;
          this.renderer.camera.updateProjectionMatrix();
        }
        break;
      case 'screenShakeIntensity':
        // ScreenShake reads the setting live in trigger(), no cache needed
        break;
      case 'cameraShake':
        // Toggles whether shake is applied at all (ScreenShake reads this live)
        break;
      case 'hudScale':
      case 'hudOpacity':
      case 'showFPS':
      case 'showShotPowerPercent':
      case 'showSpinIndicator':
      case 'showCrosshair':
      case 'showBallLabels':
      case 'showRemainingBalls':
      case 'showComboCounter':
      case 'statsPanelEnabled':
      case 'highContrastUI':
      case 'largeTextMode':
      case 'reducedMotion':
        this._applyHudVisibility();
        break;
      case 'minimapPosition':
        if (this.minimap) this.minimap._applyStyle();
        break;
      case 'timerPosition':
        this.ui.setTimerPosition?.(value);
        break;
      case 'hideCueOnShot':
        // Applied live when shooting; no cache needed
        break;
      case 'cameraAutoResetAfterShot':
      case 'cameraResetDelay':
      case 'cameraSmoothing':
      case 'cameraSmoothFactor':
      case 'topDownAngle':
        // Camera behaviour params are read live in _updateCamera / _resetCameraTop
        break;
      case 'showPhysicsDebug':
        this._togglePhysicsDebug?.(value);
        break;
      case 'devMode':
        this._toggleDevMode?.(value);
        break;
      case 'quickBreak':
        // Applied when starting a new game
        break;
      case 'language':
        // Language switch requires page reload or full text refresh
        break;
      case 'lightingIntensity':
      case 'ambientIntensity':
      case 'fogEnabled':
      case 'toneMappingExposure':
      case 'cameraDamping':
      case 'renderScale':
        // Handled by Renderer._onSettingsChanged
        break;
      case 'fpsLimit':
      case 'vSync':
        // Handled by GameLoop or requestAnimationFrame
        break;
      case 'vibrationEnabled':
        // Read live before navigator.vibrate() calls
        break;
      case 'lowLatencyMode':
        // Requires AudioManager re-init; shown as tooltip in UI
        break;
      case 'tableTheme':
      case 'feltTheme':
      case 'woodTheme':
      case 'metalTrimTheme':
      case 'clothNapEnabled':
      case 'clothPatternStrength':
      case 'clothWearEnabled':
      case 'pocketNetDetail':
      case 'pocketLeatherTheme':
      case 'tableReflection':
      case 'feltColorTheme':
      case 'woodColorTheme':
        if (this.table) this.table.applyVisualSettings(settings);
        break;
      case 'ballTextureQuality':
      case 'ballNumberSize':
      case 'ballNumberContrast':
      case 'cueBallMarkStyle':
      case 'ballStyle':
      case 'ballNumbers':
        if (this.ballsManager) {
          for (const ball of this.ballsManager.balls) {
            ball.updateVisualSettings(settings);
          }
        }
        break;
      case 'roomTheme':
      case 'floorTheme':
      case 'wallTheme':
      case 'decorativePropsEnabled':
      case 'wallDecorEnabled':
      case 'plantsEnabled':
      case 'ceilingGridEnabled':
      case 'lampStyle':
      case 'ambientLightTheme':
      case 'tableLightIntensity':
      case 'roomStyle':
      case 'lightingStyle':
      case 'lightingIntensity':
      case 'ambientIntensity':
        if (this.room) this.room.applyVisualSettings(settings);
        break;
      case 'ballReflection':
      case 'depthOfField':
        // Legacy appearance params not yet implemented
        break;
      case 'postProcess':
      case 'bloom':
      case 'chromaticAberration':
      case 'filmGrain':
      case 'vignette':
        // Post-processing requires EffectComposer setup (not yet implemented)
        break;
      case 'autoSaveReplays':
      case 'replayMaxSaved':
      case 'replaySpeed':
      case 'showShotData':
      case 'showHeatmap':
      case 'showWinProbability':
      case 'showDetailedStats':
      case 'shotHistoryTracking':
        // Replay / stats params are read live by ReplayLibrary / StatsTracker
        break;
      case 'singleHandMode':
      case 'leftHandMode':
      case 'autoHints':
      case 'hintFrequency':
      case 'voiceAnnounce':
      case 'soundCueVisualHints':
      case 'focusMode':
      case 'focusOpacity':
      case 'colorBlindMode':
      case 'highContrastUI':
      case 'largeTextMode':
      case 'reducedMotion':
      case 'hudOpacity':
        // Accessibility / HUD params are read live by UI layer
        break;
      case 'autoSkipAnimation':
      case 'skipOpponentTurn':
      case 'showOpponentTrajectory':
      case 'speedUnit':
      case 'unitSystem':
        // Read live at point of use
        break;
      case 'confirmShotOnRelease':
        // Read live by InputHandler
        break;
    }
  }

  _resetTrainerDrill() {
    if (this.mode !== 'trainer' || !this.drillConfig) return;

    // Remove old balls
    for (const ball of this.ballsManager.balls) {
      const listener = this._ballCollideListeners.get(ball.id);
      if (listener) ball.body.removeEventListener('collide', listener);
      this.scene.remove(ball.mesh);
      this.physics.removeBody(ball.body);
      ball.geometry.dispose();
      ball.material.dispose();
    }
    this._ballCollideListeners.clear();

    // Recreate balls in drill layout
    this.ballsManager = new BallsManager(this.physics, this.tableProfile);
    this.ballsManager.createBalls();
    const { idealZone } = this.ballsManager.setupDrill(this.drillConfig, this.tableProfile);
    this.drillIdealZone = idealZone;
    this._wireBallsManagerEvents();
    this.ballsManager.addToScene(this.scene);
    this.setupCollisionEvents();
    for (const ball of this.ballsManager.balls) {
      ball.updateVisualSettings(settings);
    }

    // Reset drill manager state
    if (this.drillManager) {
      this.drillManager.resetDrill();
    }

    // Update target zone visualization
    if (this.trainerHUD) {
      this.trainerHUD._hideTargetZone();
      if (this.drillIdealZone) {
        this.trainerHUD.showTargetZone(this.drillIdealZone);
      }
      this.trainerHUD.updateLabel(`🎯 ${this.drillConfig.name}`);
      if (this.trainerHUD.hintsEnabled) {
        this.trainerHUD._showHints();
      }
    }

    this._enterAimState({ resetPower: true, showCue: true, showTrajectory: true, updateAim: false });
    this.power = 0;
    this.ui.setPower(0);
    this.recorder.reset();
    this.gameStartTime = performance.now();
  }

  dispose() {
    try {
    if (this._strikeHideTimer) {
      clearTimeout(this._strikeHideTimer);
      this._strikeHideTimer = null;
    }
    if (this._cameraResetTimer) {
      clearTimeout(this._cameraResetTimer);
      this._cameraResetTimer = null;
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

    // Unlock fairness keys
    settings.clearLockedKeys();

    // Remove spin keyboard listener
    if (this._onKeyDown) {
      window.removeEventListener('keydown', this._onKeyDown);
      this._onKeyDown = null;
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
    if (this.trainerHUD) {
      this.trainerHUD.dispose();
      this.trainerHUD = null;
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
    if (this.ballReturn) {
      this.ballReturn.dispose();
      this.ballReturn = null;
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
      this.audio.stopBGM(false);
      if (this._ownsAudio) {
        this.audio.dispose();
      }
      this.audio = null;
    }

    // Remove network listeners and close connection
    if (this.networkController) {
      if (this._onStateSnapshot) this.networkController.removeEventListener('stateSnapshot', this._onStateSnapshot);
      if (this._onNetShotInput) this.networkController.removeEventListener('shotInput', this._onNetShotInput);
      if (this._onNetPocketEvent) this.networkController.removeEventListener('pocketEvent', this._onNetPocketEvent);
      if (this._onNetPushOutDeclare) this.networkController.removeEventListener('pushOutDeclare', this._onNetPushOutDeclare);
      if (this._onNetPushOutChoice) this.networkController.removeEventListener('pushOutChoice', this._onNetPushOutChoice);
      if (this._onNetDisconnected) this.networkController.removeEventListener('disconnected', this._onNetDisconnected);
      if (this._onNetRoomClosed) this.networkController.removeEventListener('roomClosed', this._onNetRoomClosed);
      this._onStateSnapshot = null;
      this._onNetShotInput = null;
      this._onNetPocketEvent = null;
      this._onNetPushOutDeclare = null;
      this._onNetPushOutChoice = null;
      this._onNetDisconnected = null;
      this._onNetRoomClosed = null;
      try { this.networkController.disconnect(); } catch (e) {}
    }

    // Remove event listeners
    window.removeEventListener('toggleTrajectory', this._onToggleTrajectory);
    window.removeEventListener('toggleShotTrail', this._onToggleShotTrail);
    window.removeEventListener('toggleComboCounter', this._onToggleComboCounter);
    this._onToggleTrajectory = null;
    this._onToggleShotTrail = null;
    this._onToggleComboCounter = null;

    // Destroy UI elements created by this game session
    if (this.ui) {
      this.ui.destroy();
      this.ui = null;
    }
    if (this.statsPanel) {
      this.statsPanel.destroy();
      this.statsPanel = null;
    }
    if (this.achievementPanel) {
      try { this.achievementPanel.destroy(); } catch (e) {}
      this.achievementPanel = null;
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
    if (this._strikeHideTimer) {
      clearTimeout(this._strikeHideTimer);
      this._strikeHideTimer = null;
    }
    if (this._cameraResetTimer) {
      clearTimeout(this._cameraResetTimer);
      this._cameraResetTimer = null;
    }
    this._challengeEnding = false;

    // Cancel network disconnect timer
    if (this._netDisconnectTimer) {
      clearTimeout(this._netDisconnectTimer);
      this._netDisconnectTimer = null;
    }

    // Clean up in-game settings screen
    if (this.inGameSettings) {
      try { this.inGameSettings.destroy(); } catch (e) {}
      this.inGameSettings = null;
    }

    // Clean up onboarding tips
    if (this.onboardingTips) {
      this.onboardingTips.destroy();
      this.onboardingTips = null;
    }

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
    this.matchManager = null;
    this.aiPlayer = null;
    this.networkController = null;
    this.rules = null;
    this._settingsOpen = false;
    this._initialized = false;
    this._hostFairness = null;
    this.networkRole = null;
    this.networkMode = null;

    this.state = 'DISPOSED';
    } finally {
      // Guarantee cleanup of competitive locks and host fairness
      settings.clearLockedKeys();
      this._hostFairness = null;
    }
  }

  render(renderer) {
    // Per-frame render logic if needed
  }
}
