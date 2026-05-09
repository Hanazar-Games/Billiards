import { MenuSystem } from './menu/MenuSystem.js';

const container = document.getElementById('app');

// MenuSystem owns Renderer, Physics, Game lifecycle
const menu = new MenuSystem(container);
