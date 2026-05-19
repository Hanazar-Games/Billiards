/**
 * MenuSystem — Application state machine.
 *
 * Manages the entire app lifecycle:
 *   MENU → (select mode) → PLAYING → (game over / quit) → MENU
 *
 * Owns the shared Renderer and PhysicsWorld instances.
 * Creates and destroys Game instances per session.
 * Pauses/resumes the GameLoop on state transitions.
 */
import { Renderer } from '../core/Renderer.js';
import { PhysicsWorld } from '../core/PhysicsWorld.js';
import { GameLoop } from '../core/GameLoop.js';
import { Game } from '../game/Game.js';
import { Table } from '../game/Table.js';
import { BallsManager } from '../game/BallsManager.js';
import { getTableProfile, validateModeTableProfile } from '../game/TableProfiles.js';
import { MainMenuScreen } from './MainMenuScreen.js';
import { keyBindings } from '../input/KeyBindings.js';
import { SettingsScreen } from './SettingsScreen.js';
import { AchievementSystem } from '../achievements/AchievementSystem.js';
import { AchievementPanel } from '../achievements/AchievementPanel.js';
import { ReplayLibrary } from '../replay/ReplayLibrary.js';
import { ReplayPanel } from '../replay/ReplayPanel.js';
import { ShotReplay } from '../replay/ShotReplay.js';
import { ChallengePanel } from '../challenges/ChallengePanel.js';
import { ChallengeManager } from '../challenges/ChallengeManager.js';
import { ChallengeResult } from '../challenges/ChallengeResult.js';
import { TrainerPanel } from '../trainer/TrainerPanel.js';
import { TrainerResult } from '../trainer/TrainerResult.js';
import { DrillManager } from '../trainer/DrillManager.js';
import { LanRoomPanel } from './LanRoomPanel.js';
import { MatchSetupPanel } from './MatchSetupPanel.js';
import { MatchManager } from '../game/MatchManager.js';
import { animMs } from '../core/AnimSpeed.js';


export class MenuSystem {
  constructor(container) {
    this.container = container;
    this.state = 'MENU'; // MENU | PLAYING | TRANSITION

    // Shared core systems (persist across mode changes)
    this.renderer = new Renderer(container);
    this.physics = new PhysicsWorld();

    // Game instance (recreated per session)
    this.game = null;
    this.loop = null;

    // Menu screens
    this.mainMenu = null;
    this.settingsScreen = null;

    // Audio manager (shared, init once)
    this.audio = null;

    // Achievement system (shared, persistent across sessions)
    this.achievements = new AchievementSystem();
    this.achievementPanel = null;

    // Replay system
    this.replayLibrary = new ReplayLibrary();
    this.replayPanel = null;
    this.replayEngine = null;
    this.replayBallsManager = null;

    // Challenge system
    this.challengePanel = null;
    this.challengeManager = null;
    this.activeChallenge = null;
    this.challengeResult = null;
    this._menuLoopId = null;

    // Local match system
    this.matchSetupPanel = null;
    this.matchManager = null;

    // Trainer system
    this.trainerPanel = null;
    this.trainerResult = null;
    this.drillManager = null;
    this.activeDrill = null;

    this._initAudio().then(() => {
      this._setupMenu();
      if (typeof window !== 'undefined' && window.updateLoadingProgress) {
        window.updateLoadingProgress(60, '加载资源...');
      }
    }).catch((err) => {
      console.warn('Menu setup failed:', err);
      if (typeof window !== 'undefined' && window.showError) {
        window.showError('MENU SETUP ERROR: ' + (err?.message || String(err)));
      }
    });
  }

  async _initAudio() {
    if (typeof window !== 'undefined' && window.updateLoadingProgress) {
      window.updateLoadingProgress(45, '加载音频...');
    }
    try {
      const { AudioManager } = await import('../audio/AudioManager.js');
      this.audio = new AudioManager();
      this.audio.init();
      // Sync soundEnabled from persisted settings so BGM can auto-start
      if (this.audio) {
        const { settings } = await import('../core/SettingsStore.js');
        this.audio.toggleSound(settings.get('soundEnabled'));
      }
      if (typeof window !== 'undefined' && window.updateLoadingProgress) {
        window.updateLoadingProgress(55, '音频就绪...');
      }
    } catch (e) {
      console.warn('Audio init failed:', e);
    }
  }

  _setupMenu() {
    if (this.state === 'DESTROYED') return;
    // Ensure menu-layer exists
    let menuLayer = document.getElementById('menu-layer');
    if (!menuLayer) {
      menuLayer = document.createElement('div');
      menuLayer.id = 'menu-layer';
      menuLayer.style.cssText = `
        position: absolute; inset: 0;
        z-index: 20; pointer-events: auto;
        background: radial-gradient(ellipse at center, #1a2a1a 0%, #0a0a0a 100%);
      `;
      document.body.appendChild(menuLayer);
    }

    // Show menu layer, hide game UI
    menuLayer.style.display = 'flex';
    const uiLayer = document.getElementById('ui-layer');
    if (uiLayer) uiLayer.style.display = 'none';

    // Create main menu
    this.mainMenu = new MainMenuScreen(
      (mode) => this._startGame(mode),
      () => this._showSettings(),
      () => this._showAchievements(),
      () => this._showReplays(),
      () => this._showChallenges(),
      () => this._quit(),
      () => this._showLanRoom(),
      () => this._showMatchSetup(),
      () => this._showTrainer()
    );

    // Create achievement panel (for viewing from menu)
    this.achievementPanel = new AchievementPanel(this.achievements);

    // Create settings screen (audio reference will be set after init)
    this.settingsScreen = new SettingsScreen(() => this._showMainMenu());
    this.settingsScreen.setAudioManager(this.audio);

    // Start menu BGM if sound is enabled
    if (this.audio && this.audio.soundEnabled) {
      this.audio.startBGM();
    }

    // Start a render loop for the menu background (just the 3D scene, no physics)
    this._startMenuLoop();
  }

  _startMenuLoop() {
    if (this._menuLoopId !== null) return; // already running
    const renderMenu = () => {
      if (this.state === 'MENU' || this.state === 'TRANSITION') {
        this.renderer.render();
        this._menuLoopId = requestAnimationFrame(renderMenu);
      } else {
        this._menuLoopId = null;
      }
    };
    this._menuLoopId = requestAnimationFrame(renderMenu);
  }

  _showSettings() {
    this.mainMenu.hide();
    if (this.replayPanel) this.replayPanel.hideList();
    if (this.achievementPanel) this.achievementPanel.hideWall?.();
    if (this.challengePanel) this.challengePanel.hide();
    if (this.challengeResult) this.challengeResult.hide();
    if (this.trainerPanel) this.trainerPanel.hide();
    if (this.trainerResult) this.trainerResult.hide();
    if (this.lanRoomPanel) { this.lanRoomPanel.hide?.(true); this.lanRoomPanel = null; }
    if (this.matchSetupPanel) { this.matchSetupPanel.hide?.(true); this.matchSetupPanel = null; }
    this.settingsScreen.show();
  }

  _showMainMenu() {
    this.state = 'MENU';
    this.settingsScreen.hide();
    if (this.replayPanel) { this.replayPanel.destroy(); this.replayPanel = null; }
    if (this.achievementPanel) this.achievementPanel.hideWall();
    if (this.challengePanel) this.challengePanel.hide();
    if (this.trainerPanel) this.trainerPanel.hide();
    if (this.challengeResult) { this.challengeResult.destroy(); this.challengeResult = null; }
    if (this.trainerResult) { this.trainerResult.destroy(); this.trainerResult = null; }
    if (this.lanRoomPanel) { this.lanRoomPanel.hide?.(true); this.lanRoomPanel = null; }
    if (this.matchSetupPanel) { this.matchSetupPanel.hide?.(true); this.matchSetupPanel = null; }
    this.mainMenu.show();
  }

  _showAchievements() {
    this.mainMenu.hide();
    if (this.settingsScreen) this.settingsScreen.hide();
    if (this.replayPanel) this.replayPanel.hideList();
    if (this.challengePanel) this.challengePanel.hide();
    if (this.challengeResult) this.challengeResult.hide();
    if (this.trainerPanel) this.trainerPanel.hide();
    if (this.trainerResult) this.trainerResult.hide();
    if (this.lanRoomPanel) { this.lanRoomPanel.hide?.(true); this.lanRoomPanel = null; }
    if (this.matchSetupPanel) { this.matchSetupPanel.hide?.(true); this.matchSetupPanel = null; }
    this.achievementPanel.showWall();
  }

  _showReplays() {
    this.mainMenu.hide();
    if (this.settingsScreen) this.settingsScreen.hide();
    if (this.achievementPanel) this.achievementPanel.hideWall?.();
    if (this.challengePanel) this.challengePanel.hide();
    if (this.challengeResult) this.challengeResult.hide();
    if (this.trainerPanel) this.trainerPanel.hide();
    if (this.trainerResult) this.trainerResult.hide();
    if (this.lanRoomPanel) { this.lanRoomPanel.hide?.(true); this.lanRoomPanel = null; }
    if (this.matchSetupPanel) { this.matchSetupPanel.hide?.(true); this.matchSetupPanel = null; }
    if (!this.replayPanel) {
      this.replayPanel = new ReplayPanel(
        this.replayLibrary,
        (replay) => this._startReplayPlayback(replay),
        () => this.mainMenu.show(),
        () => this._stopReplayPlayback()
      );
    }
    this.replayPanel.showList();
  }

  _showChallenges() {
    this.state = 'MENU';
    this.mainMenu.hide();
    if (this.settingsScreen) this.settingsScreen.hide();
    if (this.replayPanel) this.replayPanel.hideList();
    if (this.achievementPanel) this.achievementPanel.hideWall?.();
    if (this.challengeResult) this.challengeResult.hide();
    if (this.trainerPanel) this.trainerPanel.hide();
    if (this.trainerResult) this.trainerResult.hide();
    if (this.lanRoomPanel) { this.lanRoomPanel.hide?.(true); this.lanRoomPanel = null; }
    if (this.matchSetupPanel) { this.matchSetupPanel.hide?.(true); this.matchSetupPanel = null; }
    if (!this.challengePanel) {
      this.challengePanel = new ChallengePanel(
        (challenge) => this._startChallenge(challenge),
        () => this._showMainMenu()
      );
    }
    this.challengePanel.show();
  }

  _showTrainer() {
    this.state = 'MENU';
    this.mainMenu.hide();
    if (this.settingsScreen) this.settingsScreen.hide();
    if (this.replayPanel) this.replayPanel.hideList();
    if (this.achievementPanel) this.achievementPanel.hideWall?.();
    if (this.challengePanel) this.challengePanel.hide();
    if (this.challengeResult) this.challengeResult.hide();
    if (this.trainerResult) this.trainerResult.hide();
    if (this.lanRoomPanel) { this.lanRoomPanel.hide?.(true); this.lanRoomPanel = null; }
    if (this.matchSetupPanel) { this.matchSetupPanel.hide?.(true); this.matchSetupPanel = null; }
    if (!this.trainerPanel) {
      this.trainerPanel = new TrainerPanel(
        (drill) => this._startTrainer(drill),
        () => this._showMainMenu()
      );
    }
    this.trainerPanel.show();
  }

  async _startTrainer(drill) {
    if (this.state !== 'MENU' && this.state !== 'TRANSITION') return;
    this.state = 'TRANSITION';

    // Dispose any existing game instance before creating a new one
    if (this.game) {
      try { this.game.dispose(); } catch (e) { console.warn('Old game dispose error:', e); }
      this.game = null;
    }
    if (this.loop) {
      this.loop.stop();
      this.loop = null;
    }

    if (this.trainerPanel) this.trainerPanel.hide();
    if (this.trainerResult) this.trainerResult.hide();
    if (this.replayPanel) this.replayPanel.hideList();
    if (this.achievementPanel) this.achievementPanel.hideWall();

    // Hide menu
    const menuLayer = document.getElementById('menu-layer');
    if (menuLayer) {
      menuLayer.style.transition = 'opacity calc(0.5s / var(--ui-anim-speed)) ease';
      menuLayer.style.opacity = '0';
    }
    await this._delay(animMs(500));
    if (this.state !== 'TRANSITION') return;
    if (menuLayer) menuLayer.style.display = 'none';

    // Show game UI
    const uiLayer = document.getElementById('ui-layer');
    if (uiLayer) uiLayer.style.display = 'flex';

    // Stop menu BGM before entering trainer
    if (this.audio) this.audio.stopBGM(false);

    // Create drill manager with absolute ideal zone
    this.activeDrill = drill;
    const { resolveDrillPositions } = await import('../trainer/DrillData.js');
    const { idealZone } = resolveDrillPositions(drill, getTableProfile('pool9ft'));
    this.drillManager = new DrillManager(drill.id, idealZone);
    this.drillManager.start();

    // Create game with trainer mode
    this.game = new Game(this.renderer, this.physics, this.audio);
    this.game.achievements = this.achievements;
    this.game.replayLibrary = this.replayLibrary;
    this.game.drillManager = this.drillManager;
    this.game.onTrainerComplete = (completed, stars) => {
      this._stopTrainer();
    };

    const modeConfig = { mode: 'trainer', aiEnabled: false, drill, tableProfileId: 'pool9ft' };
    try {
      await this.game.init(modeConfig);
    } catch (err) {
      console.error('Trainer game init failed:', err);
      this.state = 'MENU';
      if (menuLayer) { menuLayer.style.display = 'flex'; menuLayer.style.opacity = '1'; }
      if (uiLayer) uiLayer.style.display = 'none';
      return;
    }
    this.game.onReturnToMenu = () => this._stopTrainer();

    // Create and start game loop
    this.loop = new GameLoop({
      update: (dt) => {
        this.physics.step(dt);
        this.game.update(dt);
      },
      render: () => {
        if (this.game) this.game.render(this.renderer);
        this.renderer.render();
      },
    });

    this.state = 'PLAYING';
    this.loop.start();
  }

  async _stopTrainer() {
    if (this.state !== 'PLAYING') return;
    this.state = 'TRANSITION';

    // Stop game loop
    if (this.loop) {
      this.loop.stop();
      this.loop = null;
    }

    // Dispose game
    if (this.game) {
      this.game.dispose();
      this.game = null;
    }

    // Hide game UI
    const uiLayer = document.getElementById('ui-layer');
    if (uiLayer) uiLayer.style.display = 'none';

    // Restart menu render loop
    this._startMenuLoop();

    // Show trainer result
    if (this.drillManager) {
      const hud = this.drillManager.getHUDData();
      if (!this.trainerResult) {
        this.trainerResult = new TrainerResult(
          () => this._startTrainer(this.activeDrill),
          () => this._showTrainer()
        );
      }
      const stats = {
        power: this.drillManager.shotPower,
        powerError: this.drillManager.powerError,
        isNewBestStars: this.drillManager.isNewBestStars,
        isNewBestPowerError: this.drillManager.isNewBestPowerError,
      };
      if (this.drillManager.idealZone && this.drillManager.cueBallRestPos) {
        const dx = this.drillManager.cueBallRestPos.x - this.drillManager.idealZone.x;
        const dz = this.drillManager.cueBallRestPos.z - this.drillManager.idealZone.z;
        stats.distance = Math.sqrt(dx * dx + dz * dz);
      }
      const best = DrillManager.getAllBest()[this.drillManager.drill.id];
      if (best) {
        stats.attempts = best.attempts;
        stats.completions = best.completions;
        stats.prevBestStars = best.stars;
      }

      this.trainerResult.show(
        hud.name,
        this.drillManager.completed,
        this.drillManager.stars || 0,
        stats
      );
    }

    // Restore menu-layer
    const menuLayer = document.getElementById('menu-layer');
    if (menuLayer) {
      menuLayer.style.display = 'flex';
      menuLayer.style.opacity = '1';
    }

    this.drillManager = null;
  }

  async _startChallenge(challenge) {
    if (this.state !== 'MENU' && this.state !== 'TRANSITION') return;
    this.state = 'TRANSITION';

    if (this.challengePanel) this.challengePanel.hide();
    if (this.challengeResult) this.challengeResult.hide();
    if (this.replayPanel) this.replayPanel.hideList();
    if (this.achievementPanel) this.achievementPanel.hideWall();

    // Hide menu
    const menuLayer = document.getElementById('menu-layer');
    if (menuLayer) {
      menuLayer.style.transition = 'opacity calc(0.5s / var(--ui-anim-speed)) ease';
      menuLayer.style.opacity = '0';
    }
    await this._delay(animMs(500));
    if (this.state !== 'TRANSITION') return;
    if (menuLayer) menuLayer.style.display = 'none';

    // Show game UI
    const uiLayer = document.getElementById('ui-layer');
    if (uiLayer) uiLayer.style.display = 'flex';

    // Stop menu BGM before entering challenge
    if (this.audio) this.audio.stopBGM(false);

    // Create challenge manager
    this.activeChallenge = challenge;
    this.challengeManager = new ChallengeManager(challenge.id);
    this.challengeManager.start();

    // Validate challenge mode/profile combo
    const challengeProfileId = challenge.tableProfileId || null;
    const challengeValidated = validateModeTableProfile(challenge.gameMode, challengeProfileId);
    if (!challengeValidated.valid && challengeProfileId) {
      console.warn('[MenuSystem] Invalid challenge mode/profile combo (%s / %s): %s. Using fallback.',
        challenge.gameMode, challengeProfileId, challengeValidated.reason);
    }

    // Create game with challenge mode
    const modeConfig = { mode: challenge.gameMode, aiEnabled: false };
    if (challengeValidated.tableProfileId) {
      modeConfig.tableProfileId = challengeValidated.tableProfileId;
    }
    this.game = new Game(this.renderer, this.physics, this.audio);
    this.game.achievements = this.achievements;
    this.game.replayLibrary = this.replayLibrary;
    this.game.challengeManager = this.challengeManager;

    try {
      await this.game.init(modeConfig);
    } catch (err) {
      console.error('Challenge game init failed:', err);
      this.state = 'MENU';
      if (menuLayer) { menuLayer.style.display = 'flex'; menuLayer.style.opacity = '1'; }
      if (uiLayer) uiLayer.style.display = 'none';
      return;
    }
    this.game.onReturnToMenu = () => this._stopChallenge();

    // Create and start game loop
    this.loop = new GameLoop({
      update: (dt) => {
        this.physics.step(dt);
        this.game.update(dt);
      },
      render: () => {
        if (this.game) this.game.render(this.renderer);
        this.renderer.render();
      },
    });

    this.state = 'PLAYING';
    this.loop.start();
  }

  async _stopChallenge() {
    if (this.state !== 'PLAYING') return;
    this.state = 'TRANSITION';

    // Stop game loop
    if (this.loop) {
      this.loop.stop();
      this.loop = null;
    }

    // Dispose game
    if (this.game) {
      this.game.dispose();
      this.game = null;
    }

    // Hide game UI
    const uiLayer = document.getElementById('ui-layer');
    if (uiLayer) uiLayer.style.display = 'none';

    // Restart menu render loop (3D background behind result panel)
    this._startMenuLoop();

    // Show challenge result
    if (this.challengeManager) {
      const hud = this.challengeManager.getHUDData();
      if (!this.challengeResult) {
        this.challengeResult = new ChallengeResult(
          () => this._startChallenge(this.activeChallenge),
          () => this._showChallenges()
        );
      }
      this.challengeResult.show(
        hud.name,
        this.challengeManager.completed,
        this.challengeManager.stars || 0,
        {
          challengeId: this.activeChallenge?.id,
          duration: this.challengeManager.gameDuration,
          fouls: this.challengeManager.totalFouls,
          spinPockets: this.challengeManager.spinPocketCount,
          breakPocketed: this.challengeManager.breakPocketedCount,
          totalShots: this.challengeManager.totalShots,
          consecutivePockets: this.challengeManager.maxConsecutivePocketShots,
          totalBallsPocketed: this.challengeManager.totalBallsPocketed,
          bestStars: this.challengeManager.best?.stars || 0,
          isNewRecord: this.challengeManager.completed && (this.challengeManager.stars || 0) > (this.challengeManager.best?.prevStars || 0),
          failureReason: this.challengeManager.failureReason,
        }
      );
    }

    // Restore menu-layer so challenge result / panel have the menu visible underneath
    const menuLayer = document.getElementById('menu-layer');
    if (menuLayer) {
      menuLayer.style.display = 'flex';
      menuLayer.style.opacity = '1';
    }

    this.challengeManager = null;
    this.activeChallenge = null;
  }

  async _startGame(mode, networkClient = null, networkRole = null, localPlayerId = 1, matchStatus = null, tableProfileId = null) {
    if (this.state !== 'MENU' && !networkClient && !matchStatus) return;
    this.state = 'TRANSITION';

    // Dispose any existing game instance before creating a new one
    if (this.game) {
      try { this.game.dispose(); } catch (e) { console.warn('Old game dispose error:', e); }
      this.game = null;
    }
    if (this.loop) {
      this.loop.stop();
      this.loop = null;
    }

    // Hide any open panels before starting the game
    if (this.replayPanel) this.replayPanel.hideList();
    if (this.achievementPanel) this.achievementPanel.hideWall();

    // Hide menu
    const menuLayer = document.getElementById('menu-layer');
    if (menuLayer) {
      menuLayer.style.transition = 'opacity calc(0.5s / var(--ui-anim-speed)) ease';
      menuLayer.style.opacity = '0';
    }

    // Wait for fade-out
    await this._delay(animMs(500));
    if (this.state !== 'TRANSITION') {
      // State changed during fade (e.g., quit) — restore menu visibility
      if (menuLayer) { menuLayer.style.display = 'flex'; menuLayer.style.opacity = '1'; }
      return;
    }
    if (menuLayer) menuLayer.style.display = 'none';

    // Show game UI
    const uiLayer = document.getElementById('ui-layer');
    if (uiLayer) uiLayer.style.display = 'flex';

    // Stop menu BGM before entering game
    if (this.audio) this.audio.stopBGM(false);

    // Create new Game instance
    this.game = new Game(this.renderer, this.physics, this.audio);
    this.game.achievements = this.achievements;
    this.game.replayLibrary = this.replayLibrary;

    // Setup network if provided
    if (networkClient && networkRole) {
      this.game.setNetworkController(networkClient, networkRole, localPlayerId);
      if (networkRole === 'host') {
        this.game.networkPlayer1Name = '玩家 1 (房主)';
        this.game.networkPlayer2Name = '玩家 2';
      } else {
        this.game.networkPlayer1Name = '玩家 1 (房主)';
        this.game.networkPlayer2Name = '玩家 2 (你)';
      }
    }

    // Validate mode/profile combo before proceeding
    const validated = validateModeTableProfile(mode, tableProfileId);
    if (!validated.valid) {
      if (tableProfileId) {
        console.warn('[MenuSystem] Invalid mode/profile combo (%s / %s): %s. Using fallback.',
          mode, tableProfileId, validated.reason);
      }
      tableProfileId = validated.tableProfileId;
    }

    // Configure mode
    const modeConfig = this._getModeConfig(mode, tableProfileId);

    // Initialize game with mode
    try {
      await this.game.init(modeConfig);
    } catch (err) {
      console.error('Game init failed:', err);
      this.state = 'MENU';
      if (menuLayer) { menuLayer.style.display = 'flex'; menuLayer.style.opacity = '1'; }
      if (uiLayer) uiLayer.style.display = 'none';
      return;
    }

    // Set up match mode if provided
    if (matchStatus) {
      this.matchManager.setOnGameEnd((winner) => this._onMatchGameEnd(winner));
      this.game.setMatchManager(this.matchManager);
    }

    // Set up game-over callback
    this.game.onReturnToMenu = () => this._returnToMenu();

    // Create and start game loop
    this.loop = new GameLoop({
      update: (dt) => {
        if (!this.game || this.game.networkRole !== 'client') {
          this.physics.step(dt);
        }
        this.game.update(dt);
      },
      render: () => {
        if (this.game) this.game.render(this.renderer);
        this.renderer.render();
      },
    });

    this.state = 'PLAYING';
    this.loop.start();
  }

  _showLanRoom() {
    this.mainMenu.hide();
    if (this.settingsScreen) this.settingsScreen.hide();
    if (this.replayPanel) this.replayPanel.hideList();
    if (this.achievementPanel) this.achievementPanel.hideWall?.();
    if (this.challengePanel) this.challengePanel.hide();
    if (this.challengeResult) this.challengeResult.hide();
    if (this.trainerPanel) this.trainerPanel.hide();
    if (this.trainerResult) this.trainerResult.hide();
    if (this.matchSetupPanel) { this.matchSetupPanel.hide?.(true); this.matchSetupPanel = null; }
    if (this.lanRoomPanel) { this.lanRoomPanel.destroy(); this.lanRoomPanel = null; }
    this.lanRoomPanel = new LanRoomPanel(
      (client, mode, tableProfileId) => this._startNetworkGame(client, mode, tableProfileId),
      () => this._showMainMenu()
    );
    this.lanRoomPanel.show();
  }

  async _startNetworkGame(client, mode, tableProfileId = null) {
    const role = client.isHost ? 'host' : 'client';
    const localId = client.playerId || 1;
    await this._startGame(mode, client, role, localId, null, tableProfileId);
  }

  // ── Local Match Mode ──

  _showMatchSetup() {
    this.mainMenu.hide();
    if (this.settingsScreen) this.settingsScreen.hide();
    if (this.replayPanel) this.replayPanel.hideList();
    if (this.achievementPanel) this.achievementPanel.hideWall?.();
    if (this.challengePanel) this.challengePanel.hide();
    if (this.challengeResult) this.challengeResult.hide();
    if (this.trainerPanel) this.trainerPanel.hide();
    if (this.trainerResult) this.trainerResult.hide();
    if (this.lanRoomPanel) { this.lanRoomPanel.hide?.(true); this.lanRoomPanel = null; }
    if (this.matchSetupPanel) { this.matchSetupPanel.destroy(); this.matchSetupPanel = null; }
    this.matchSetupPanel = new MatchSetupPanel(
      (config) => this._startMatchGame(config),
      () => this._showMainMenu()
    );
    this.matchSetupPanel.show();
  }

  async _startMatchGame(config) {
    if (this.matchSetupPanel) {
      this.matchSetupPanel.destroy();
      this.matchSetupPanel = null;
    }
    // Create or reset match engine
    this.matchManager = new MatchManager(config);
    this.matchManager.startGame();
    await this._startMatchRound();
  }

  async _startMatchRound() {
    if (!this.matchManager) return;
    const status = this.matchManager.getStatus();
    const mode = status.mode === '9ball' ? 'nineball' : 'local2p';
    const tableProfileId = status.tableProfileId || null;
    await this._startGame(mode, null, null, null, status, tableProfileId);
  }

  _onMatchGameEnd(gameWinner) {
    if (!this.matchManager) return;
    this.matchManager.recordWinner(gameWinner);
    const status = this.matchManager.getStatus();

    if (status.finished) {
      // Match over — show result then return to menu
      const winnerName = status.winner === 1 ? status.p1Name : status.p2Name;
      this.game.ui.setMessage(`🏆 ${winnerName} 赢得比赛！ 比分 ${status.p1Score} : ${status.p2Score}`, 0);
      this.game.ui.showResetButton(() => {
        this.matchManager = null;
        this._returnToMenu();
      }, '返回菜单');
      return;
    }

    // Next game
    this.game.ui.setMessage(`第 ${status.currentGame} 局结束！比分 ${status.p1Score} : ${status.p2Score} — 点击"下一局"继续`, 0);
    this.game.ui.showResetButton(() => {
      this.matchManager.startGame();
      this._restartMatchRound();
    }, '下一局');
  }

  async _restartMatchRound() {
    if (!this.matchManager) return;
    // Stop old loop
    if (this.loop) {
      this.loop.stop();
      this.loop = null;
    }
    // Dispose old game but keep match engine
    if (this.game) {
      this.game.dispose();
      this.game = null;
    }
    await this._startMatchRound();
  }

  _getModeConfig(mode, tableProfileId = null) {
    const config = (() => {
      switch (mode) {
        case 'freeplay':
          return { mode: 'freeplay', aiEnabled: false };
        case 'local2p':
        case '8ball':
          return { mode: 'local2p', aiEnabled: false };
        case 'vsai':
          return { mode: 'vsai', aiEnabled: true, aiDifficulty: 'normal' };
        case 'nineball':
          return { mode: '9ball', aiEnabled: false };
        default:
          return { mode: 'local2p', aiEnabled: false };
      }
    })();
    if (tableProfileId) {
      config.tableProfileId = tableProfileId;
    }
    return config;
  }

  async _returnToMenu() {
    if (this.state !== 'PLAYING') return;
    this.state = 'TRANSITION';

    // Stop game loop
    if (this.loop) {
      this.loop.stop();
      this.loop = null;
    }

    // Dispose game
    if (this.game) {
      this.game.dispose();
      this.game = null;
    }

    // Clear match engine when leaving match mode
    if (this.matchManager) {
      this.matchManager = null;
    }

    // Clean up LAN room panel if present
    if (this.lanRoomPanel) {
      this.lanRoomPanel.destroy();
      this.lanRoomPanel = null;
    }

    // Hide game UI
    const uiLayer = document.getElementById('ui-layer');
    if (uiLayer) uiLayer.style.display = 'none';

    // Show menu layer
    const menuLayer = document.getElementById('menu-layer');
    if (menuLayer) {
      menuLayer.style.display = 'flex';
      menuLayer.style.transition = 'opacity calc(0.5s / var(--ui-anim-speed)) ease';
      menuLayer.style.opacity = '0';
      requestAnimationFrame(() => {
        menuLayer.style.opacity = '1';
      });
    }

    // Show main menu
    if (this.challengeResult) { this.challengeResult.destroy(); this.challengeResult = null; }
    this.mainMenu.show();
    this.state = 'MENU';

    // Restart menu BGM if sound is enabled
    if (this.audio && this.audio.soundEnabled) {
      this.audio.startBGM();
    }

    // Restart menu render loop
    this._startMenuLoop();
  }

  async _startReplayPlayback(replayData) {
    if (this.state !== 'MENU') return;
    this.state = 'REPLAY';

    // Hide replay list
    if (this.replayPanel) this.replayPanel.hideList();

    // Hide menu layer and game UI
    const menuLayer = document.getElementById('menu-layer');
    if (menuLayer) menuLayer.style.display = 'none';
    const uiLayer = document.getElementById('ui-layer');
    if (uiLayer) uiLayer.style.display = 'none';

    // Create table and balls for replay (visual only, no physics step)
    const replayProfileId = replayData.metadata?.tableProfileId || null;
    const replayProfile = replayProfileId ? getTableProfile(replayProfileId) : null;
    this._replayTable = new Table(this.physics, replayProfile);
    this._replayTable.addToScene(this.renderer.scene);

    this._replayBalls = new BallsManager(this.physics);
    this._replayBalls.createBalls();
    this._replayBalls.addToScene(this.renderer.scene);

    // Position camera for replay view
    const cam = this.renderer.camera;
    cam.position.set(0, 280, 250);
    cam.lookAt(0, 0, 0);
    if (this.renderer.controls) {
      this.renderer.controls.target.set(0, 0, 0);
      this.renderer.controls.enabled = true;
    }

    // Load and start replay
    this.replayEngine = new ShotReplay(this.renderer.scene, this._replayBalls);
    if (!this.replayEngine.load(replayData)) {
      // Invalid replay data — abort and return to menu
      this._stopReplayPlayback();
      return;
    }
    // Attach metadata for HUD display
    this.replayEngine._meta = replayData.metadata || null;
    this.replayEngine.play();
    this.replayEngine.onComplete = () => {
      // Auto-stop after playback completes
      this._replayCompleteTimeout = setTimeout(() => this._stopReplayPlayback(), animMs(800));
    };

    // Show controls
    if (this.replayPanel) {
      this.replayPanel.showControls();
      this.replayPanel.updateControls(this.replayEngine);
      // Wire control buttons
      this.replayPanel.playBtn.onclick = () => this.replayEngine.toggle();
      this.replayPanel.speedBtn.onclick = () => {
        this.replayEngine.nextSpeed();
        this.replayPanel.updateControls(this.replayEngine);
      };
      this.replayPanel.exitBtn.onclick = () => this._stopReplayPlayback();
      this.replayPanel.progressBar.onclick = (e) => {
        const rect = this.replayPanel.progressBar.getBoundingClientRect();
        if (rect.width <= 0) return;
        const ratio = (e.clientX - rect.left) / rect.width;
        this.replayEngine.seekRatio(ratio);
      };
    }

    // Start replay loop
    this._replayLastTime = performance.now();
    this._replayTick();
  }

  _replayTick() {
    if (this.state !== 'REPLAY') return;
    const now = performance.now();
    const dt = Math.min((now - this._replayLastTime) / 1000, 0.05);
    this._replayLastTime = now;

    // Sub-step replay update for ultra-smooth interpolation (~600fps feel)
    const SUB_STEPS = 10;
    const subDt = dt / SUB_STEPS;
    if (this.replayEngine) {
      for (let i = 0; i < SUB_STEPS; i++) {
        this.replayEngine.update(subDt);
      }
    }
    if (this.replayPanel) {
      this.replayPanel.updateControls(this.replayEngine);
    }
    this.renderer.render();

    requestAnimationFrame(() => this._replayTick());
  }

  _stopReplayPlayback() {
    if (this.state !== 'REPLAY') return;
    this.state = 'TRANSITION';

    // Cancel pending auto-stop timeout
    if (this._replayCompleteTimeout) {
      clearTimeout(this._replayCompleteTimeout);
      this._replayCompleteTimeout = null;
    }
    if (this._delayTimer) {
      clearTimeout(this._delayTimer);
      this._delayTimer = null;
    }

    // Stop replay engine
    if (this.replayEngine) {
      this.replayEngine.stop();
      this.replayEngine = null;
    }

    // Hide controls
    if (this.replayPanel) {
      this.replayPanel.hideControls();
    }

    // Clean up replay scene objects
    if (this._replayBalls) {
      for (const ball of this._replayBalls.balls) {
        this.renderer.scene.remove(ball.mesh);
        this.physics.removeBody(ball.body);
        ball.geometry?.dispose();
        ball.material?.dispose();
      }
      this._replayBalls = null;
    }
    if (this._replayTable) {
      this.physics.removeTableBody();
      this._replayTable.dispose();
      this._replayTable = null;
    }

    // Show menu layer
    const menuLayer = document.getElementById('menu-layer');
    if (menuLayer) {
      menuLayer.style.display = 'flex';
      menuLayer.style.transition = 'opacity calc(0.5s / var(--ui-anim-speed)) ease';
      menuLayer.style.opacity = '0';
      requestAnimationFrame(() => {
        menuLayer.style.opacity = '1';
      });
    }

    // Show main menu
    if (this.challengeResult) { this.challengeResult.destroy(); this.challengeResult = null; }
    this.mainMenu.show();
    this.state = 'MENU';
    this._startMenuLoop();
  }

  _quit() {
    // Stop all loops and timeouts
    this.state = 'DESTROYED';
    if (this._menuLoopId !== null) {
      cancelAnimationFrame(this._menuLoopId);
      this._menuLoopId = null;
    }
    if (this.loop) {
      this.loop.stop();
      this.loop = null;
    }
    if (this._replayCompleteTimeout) {
      clearTimeout(this._replayCompleteTimeout);
      this._replayCompleteTimeout = null;
    }
    if (this._delayTimer) {
      clearTimeout(this._delayTimer);
      this._delayTimer = null;
    }

    // Clean up game and replay
    try { if (this.game) this.game.dispose(); } catch (e) { console.warn('Game dispose error:', e); }
    try { if (this.replayEngine) this.replayEngine.stop(); } catch (e) {}
    try { if (this.replayPanel) this.replayPanel.destroy(); } catch (e) {}
    try { if (this.challengePanel) this.challengePanel.destroy(); } catch (e) {}
    try { if (this.challengeResult) this.challengeResult.destroy(); } catch (e) {}
    try { if (this.achievementPanel) this.achievementPanel.destroy(); } catch (e) {}
    try { if (this.trainerPanel) { this.trainerPanel.destroy(); this.trainerPanel = null; } } catch (e) {}
    try { if (this.trainerResult) { this.trainerResult.destroy(); this.trainerResult = null; } } catch (e) {}
    try { if (this.lanRoomPanel) { this.lanRoomPanel.destroy(); this.lanRoomPanel = null; } } catch (e) {}
    try { keyBindings.dispose(); } catch (e) {}

    // Clean up shared core
    this.renderer.dispose();
    // Remove bodies by copying array first to avoid mutation-during-iteration
    const bodies = this.physics?.world?.bodies ? [...this.physics.world.bodies] : [];
    bodies.forEach((b) => {
      try { this.physics.world.removeBody(b); } catch (e) {}
    });

    // Clean up audio
    if (this.audio) {
      this.audio.dispose();
      this.audio = null;
    }

    this.mainMenu?.destroy();
    this.settingsScreen?.destroy();
    this.mainMenu = null;
    this.settingsScreen = null;

    // Remove menu-layer from DOM so a fresh MenuSystem starts clean
    const menuLayer = document.getElementById('menu-layer');
    if (menuLayer && menuLayer.parentNode) {
      menuLayer.parentNode.removeChild(menuLayer);
    }
  }

  _delay(ms) {
    return new Promise((resolve) => {
      this._delayTimer = setTimeout(() => {
        this._delayTimer = null;
        resolve();
      }, ms);
    });
  }
}
