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
import { MainMenuScreen } from './MainMenuScreen.js';
import { SettingsScreen } from './SettingsScreen.js';
import { AchievementSystem } from '../achievements/AchievementSystem.js';
import { AchievementPanel } from '../achievements/AchievementPanel.js';
import { ReplayLibrary } from '../replay/ReplayLibrary.js';
import { ReplayPanel } from '../replay/ReplayPanel.js';
import { ShotReplay } from '../replay/ShotReplay.js';
import { ChallengePanel } from '../challenges/ChallengePanel.js';
import { ChallengeManager } from '../challenges/ChallengeManager.js';
import { ChallengeResult } from '../challenges/ChallengeResult.js';
import { LanRoomPanel } from './LanRoomPanel.js';
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
    this.challengeResult = null;
    this.activeChallenge = null;
    this._menuLoopId = null;

    this._initAudio().then(() => {
      this._setupMenu();
      if (typeof window !== 'undefined' && window.updateLoadingProgress) {
        window.updateLoadingProgress(60, 'Loading assets... 加载资源...');
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
      window.updateLoadingProgress(45, 'Loading audio... 加载音频...');
    }
    try {
      const { AudioManager } = await import('../audio/AudioManager.js');
      this.audio = new AudioManager();
      this.audio.init();
      if (typeof window !== 'undefined' && window.updateLoadingProgress) {
        window.updateLoadingProgress(55, 'Audio ready... 音频就绪...');
      }
    } catch (e) {
      console.warn('Audio init failed:', e);
    }
  }

  _setupMenu() {
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
      () => this._showLanRoom()
    );

    // Create achievement panel (for viewing from menu)
    this.achievementPanel = new AchievementPanel(this.achievements);

    // Create settings screen (audio reference will be set after init)
    this.settingsScreen = new SettingsScreen(() => this._showMainMenu());
    this.settingsScreen.setAudioManager(this.audio);

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
    this.settingsScreen.show();
  }

  _showMainMenu() {
    this.state = 'MENU';
    this.settingsScreen.hide();
    if (this.replayPanel) this.replayPanel.hideList();
    if (this.achievementPanel) this.achievementPanel.hideWall();
    if (this.challengePanel) this.challengePanel.hide();
    this.mainMenu.show();
  }

  _showAchievements() {
    this.mainMenu.hide();
    if (this.settingsScreen) this.settingsScreen.hide();
    if (this.replayPanel) this.replayPanel.hideList();
    if (this.challengePanel) this.challengePanel.hide();
    if (this.challengeResult) this.challengeResult.hide();
    this.achievementPanel.showWall();
  }

  _showReplays() {
    this.mainMenu.hide();
    if (this.settingsScreen) this.settingsScreen.hide();
    if (this.achievementPanel) this.achievementPanel.hideWall?.();
    if (this.challengePanel) this.challengePanel.hide();
    if (this.challengeResult) this.challengeResult.hide();
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
    if (this.replayPanel) this.replayPanel.hideList();
    if (this.achievementPanel) this.achievementPanel.hideWall?.();
    if (this.challengeResult) this.challengeResult.hide();
    if (!this.challengePanel) {
      this.challengePanel = new ChallengePanel(
        (challenge) => this._startChallenge(challenge),
        () => this._showMainMenu()
      );
    }
    this.challengePanel.show();
  }

  async _startChallenge(challenge) {
    if (this.state !== 'MENU' && this.state !== 'TRANSITION') return;
    this.state = 'TRANSITION';

    if (this.challengePanel) this.challengePanel.hide();
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
    if (this.audio) this.audio.stopBGM();

    // Create challenge manager
    this.activeChallenge = challenge;
    this.challengeManager = new ChallengeManager(challenge.id);
    this.challengeManager.start();

    // Create game with challenge mode
    const modeConfig = { mode: challenge.gameMode, aiEnabled: false };
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
        this.game.render(this.renderer);
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
          duration: this.challengeManager.gameDuration,
          fouls: this.challengeManager.totalFouls,
          spinPockets: this.challengeManager.spinPocketCount,
          breakPocketed: this.challengeManager.breakPocketedCount,
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
  }

  async _startGame(mode, networkClient = null, networkRole = null, localPlayerId = 1) {
    if (this.state !== 'MENU' && !networkClient) return;
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
    if (this.audio) this.audio.stopBGM();

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

    // Configure mode
    const modeConfig = this._getModeConfig(mode);

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
        this.game.render(this.renderer);
        this.renderer.render();
      },
    });

    this.state = 'PLAYING';
    this.loop.start();
  }

  _showLanRoom() {
    this.mainMenu.hide();
    this.lanRoomPanel = new LanRoomPanel(
      (client, mode) => this._startNetworkGame(client, mode),
      () => this._showMainMenu()
    );
    this.lanRoomPanel.show();
  }

  async _startNetworkGame(client, mode) {
    const role = client.isHost ? 'host' : 'client';
    const localId = client.playerId || 1;
    await this._startGame('local2p', client, role, localId);
  }

  _getModeConfig(mode) {
    switch (mode) {
      case 'freeplay':
        return { mode: 'freeplay', aiEnabled: false };
      case 'local2p':
        return { mode: 'local2p', aiEnabled: false };
      case 'vsai':
        return { mode: 'vsai', aiEnabled: true, aiDifficulty: 'normal' };
      case 'nineball':
        return { mode: '9ball', aiEnabled: false };
      default:
        return { mode: 'local2p', aiEnabled: false };
    }
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
    if (this.challengeResult) this.challengeResult.hide();
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
    this._replayTable = new Table(this.physics);
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

    if (this.replayEngine) {
      this.replayEngine.update(dt);
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
    if (this.challengeResult) this.challengeResult.hide();
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

    // Clean up game and replay
    try { if (this.game) this.game.dispose(); } catch (e) { console.warn('Game dispose error:', e); }
    try { if (this.replayEngine) this.replayEngine.stop(); } catch (e) {}
    try { if (this.replayPanel) this.replayPanel.destroy(); } catch (e) {}
    try { if (this.challengePanel) this.challengePanel.destroy(); } catch (e) {}
    try { if (this.challengeResult) this.challengeResult.destroy(); } catch (e) {}
    try { if (this.achievementPanel) this.achievementPanel.destroy(); } catch (e) {}

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
