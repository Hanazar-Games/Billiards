// Imported first by bench.js so the shims exist before the game modules
// evaluate (ES modules run their imports in order).
import { installEnv } from './env.js';

installEnv({ seed: 1 });
