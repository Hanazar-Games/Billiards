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
import { MainMenuScreen } from './MainMenuScreen.js';
import { SettingsScreen } from './SettingsScreen.js';

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

    this._initAudio();
    this._setupMenu();
  }

  _initAudio() {
    // Import AudioManager dynamically to avoid circular deps if any
    import('../audio/AudioManager.js').then(({ AudioManager }) => {
      this.audio = new AudioManager();
      this.audio.init();
    }).catch(() => {});
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
    menuLayer.style.display = 'block';
    const uiLayer = document.getElementById('ui-layer');
    if (uiLayer) uiLayer.style.display = 'none';

    // Create main menu
    this.mainMenu = new MainMenuScreen(
      (mode) => this._startGame(mode),
      () => this._showSettings(),
      () => this._quit()
    );

    // Create settings screen
    this.settingsScreen = new SettingsScreen(
      () => this._showMainMenu(),
      this.audio
    );

    // Start a render loop for the menu background (just the 3D scene, no physics)
    this._startMenuLoop();
  }

  _startMenuLoop() {
    const renderMenu = () => {
      if (this.state === 'MENU' || this.state === 'TRANSITION') {
        this.renderer.render();
        requestAnimationFrame(renderMenu);
      }
    };
    requestAnimationFrame(renderMenu);
  }

  _showSettings() {
    this.mainMenu.hide();
    this.settingsScreen.show();
  }

  _showMainMenu() {
    this.settingsScreen.hide();
    this.mainMenu.show();
  }

  async _startGame(mode) {
    if (this.state !== 'MENU') return;
    this.state = 'TRANSITION';

    // Hide menu
    const menuLayer = document.getElementById('menu-layer');
    if (menuLayer) {
      menuLayer.style.transition = 'opacity 0.5s ease';
      menuLayer.style.opacity = '0';
    }

    // Wait for fade-out
    await this._delay(500);
    if (menuLayer) menuLayer.style.display = 'none';

    // Show game UI
    const uiLayer = document.getElementById('ui-layer');
    if (uiLayer) uiLayer.style.display = 'flex';

    // Create new Game instance
    this.game = new Game(this.renderer, this.physics);

    // Configure mode
    const modeConfig = this._getModeConfig(mode);

    // Initialize game with mode
    await this.game.init(modeConfig);

    // Set up game-over callback
    this.game.onReturnToMenu = () => this._returnToMenu();

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

  _getModeConfig(mode) {
    switch (mode) {
      case 'freeplay':
        return { mode: 'freeplay', aiEnabled: false };
      case 'local2p':
        return { mode: 'local2p', aiEnabled: false };
      case 'vsai':
        return { mode: 'vsai', aiEnabled: true, aiDifficulty: 'normal' };
      case 'nineball':
        return { mode: 'nineball', aiEnabled: false };
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

    // Hide game UI
    const uiLayer = document.getElementById('ui-layer');
    if (uiLayer) uiLayer.style.display = 'none';

    // Show menu layer
    const menuLayer = document.getElementById('menu-layer');
    if (menuLayer) {
      menuLayer.style.display = 'block';
      menuLayer.style.opacity = '0';
      requestAnimationFrame(() => {
        menuLayer.style.opacity = '1';
      });
    }

    // Show main menu
    this.mainMenu.show();
    this.state = 'MENU';

    // Restart menu render loop
    this._startMenuLoop();
  }

  _quit() {
    // Clean up
    if (this.loop) this.loop.stop();
    if (this.game) this.game.dispose();
    this.renderer.dispose();
    this.mainMenu?.destroy();
    this.settingsScreen?.destroy();
  }

  _delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
