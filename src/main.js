import { Renderer } from './core/Renderer.js';
import { PhysicsWorld } from './core/PhysicsWorld.js';
import { GameLoop } from './core/GameLoop.js';
import { Game } from './game/Game.js';

const container = document.getElementById('app');

// Core systems
const renderer = new Renderer(container);
const physics = new PhysicsWorld();

// Game logic
const game = new Game(renderer, physics);

// Loop
const loop = new GameLoop({
  update: (dt) => {
    physics.step(dt);
    game.update(dt);
  },
  render: () => {
    game.render(renderer);
    renderer.render();
  },
});

// Init
async function init() {
  await game.init();
  loop.start();
}

init().catch(console.error);
